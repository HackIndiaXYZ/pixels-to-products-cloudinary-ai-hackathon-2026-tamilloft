import { runAudit, type AuditEvent } from "@/lib/audit/run";

// `runtime` and `dynamic` are omitted deliberately: nodejs is the default and
// the Edge runtime is deprecated, and a POST handler is dynamic already.
// maxDuration is real -- a full audit runs well past the platform default.
export const maxDuration = 300;

/**
 * Streams the audit as server-sent events. The run takes a minute or so and
 * the interesting part is watching it happen, so results are pushed as they
 * land rather than withheld until the end.
 */
export async function POST(request: Request) {
  let domain: string;
  let queryCount: number;

  try {
    const body = await request.json();
    domain = String(body.domain ?? "").trim();
    // Deployed runs can be dialled down: a rate-limited key makes the audit
    // slow, and a serverless function will be killed before a long one ends.
    queryCount =
      Number(body.queryCount) || Number(process.env.ECHO_QUERY_COUNT) || 12;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!domain) {
    return Response.json({ error: "A domain is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;

      const send = (event: AuditEvent) => {
        if (!open) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          open = false; // client went away mid-run
        }
      };

      await runAudit(domain, send, Math.min(Math.max(queryCount, 6), 40));

      if (open) {
        controller.close();
        open = false;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
