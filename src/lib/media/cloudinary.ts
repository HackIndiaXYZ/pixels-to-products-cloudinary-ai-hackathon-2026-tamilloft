import { createHash } from "node:crypto";
import { v2 as cloudinary, type TransformationOptions } from "cloudinary";
import type { MediaVariants } from "@/lib/schemas";

export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET),
  );
}

let configured = false;

/** The SDK reads CLOUDINARY_URL on its own; the three separate variables need wiring. */
export function client() {
  if (!configured) {
    if (!process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
    cloudinary.config({ secure: true });
    configured = true;
  }
  return cloudinary;
}

/** Neutral on purpose: it should suit any product without inventing a brand story. */
export const STUDIO_PROMPT = "a bright minimal studio";

/** Every delivery ends with this: the smallest format and quality the viewer's browser accepts. */
const AUTO: TransformationOptions = { fetch_format: "auto", quality: "auto" };

export function variants(publicId: string): MediaVariants {
  const url = (transformation: TransformationOptions[]) =>
    client().url(publicId, { transformation, secure: true });

  return {
    optimized: url([AUTO]),
    thumb: url([{ width: 640, crop: "limit" }, AUTO]),
    social: url([{ width: 1200, height: 630, crop: "fill", gravity: "auto" }, AUTO]),
    square: url([{ width: 1080, height: 1080, crop: "fill", gravity: "auto" }, AUTO]),
    cutout: url([{ effect: "background_removal" }, { width: 800, crop: "limit" }, AUTO]),
    extended: url([{ background: "gen_fill", crop: "pad", width: 1200, height: 630 }, AUTO]),
    studio: url([
      { effect: `gen_background_replace:prompt_${STUDIO_PROMPT}` },
      { width: 800, crop: "limit" },
      AUTO,
    ]),
  };
}

/**
 * The public id is derived from the source URL, and uploads never overwrite,
 * so re-auditing a site reuses the assets already in the account instead of
 * spending upload and AI quota on the same pixels twice.
 */
export function publicIdFor(domain: string, sourceUrl: string): string {
  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
  return `echo/${domain}/${hash}`;
}

/** Cloudinary fetches the image itself, so the original bytes never pass through Echo. */
export async function uploadFromUrl(
  sourceUrl: string,
  domain: string,
  siteAlt: string | null,
) {
  return client().uploader.upload(sourceUrl, {
    public_id: publicIdFor(domain, sourceUrl),
    overwrite: false,
    resource_type: "image",
    tags: ["echo", `site:${domain}`],
    context: { source: sourceUrl, ...(siteAlt ? { alt: siteAlt } : {}) },
  });
}

/** Tags Echo applies itself, as opposed to ones Cloudinary's AI found. */
const OWN_TAG = /^(echo|echo-ai|site:.*)$/;

export interface AiReading {
  caption: string | null;
  tags: string[];
}

function errorText(error: unknown): string {
  const inner = (error as { error?: { message?: string } })?.error?.message;
  return inner ?? (error instanceof Error ? error.message : String(error));
}

/**
 * Ask Cloudinary's AI what is in the picture: a caption (usable as alt text)
 * and content tags. Both are add-ons an account may not have enabled, so each
 * is attempted independently, and a feature that fails once is not retried for
 * the rest of the audit. The audit still reports everything else.
 *
 * Results are written back to the asset -- the caption into its context, the
 * tags onto it -- so a second audit of the same site reads them instead of
 * paying for them again.
 */
export async function readWithAi(
  publicId: string,
  unavailable: Map<string, string>,
): Promise<AiReading> {
  const api = client().api;
  const existing = await api.resource(publicId, { tags: true, context: true });
  const tags = ((existing.tags ?? []) as string[]).filter((tag) => !OWN_TAG.test(tag));
  const stored = existing.context?.custom?.caption as string | undefined;

  if (existing.tags?.includes("echo-ai")) {
    return { caption: stored ?? null, tags };
  }

  let caption: string | null = null;
  if (!unavailable.has("captioning")) {
    try {
      const result = await api.update(publicId, { detection: "captioning" });
      caption = result.info?.detection?.captioning?.data?.caption?.trim() || null;
    } catch (error) {
      unavailable.set("captioning", errorText(error));
    }
  }

  let aiTags = tags;
  for (const engine of ["google_tagging", "aws_rek_tagging"]) {
    if (aiTags.length > 0 || unavailable.has(engine)) continue;
    try {
      const result = await api.update(publicId, {
        categorization: engine,
        auto_tagging: 0.6,
      });
      aiTags = ((result.tags ?? []) as string[]).filter((tag) => !OWN_TAG.test(tag));
    } catch (error) {
      unavailable.set(engine, errorText(error));
    }
  }

  // Only mark the asset as read when something was actually learned, so
  // enabling an add-on later makes the next audit try again.
  if (caption || aiTags.length > 0) {
    const uploader = client().uploader;
    // Context is a key=value|key=value string, so those two characters are escaped.
    if (caption) {
      await uploader.add_context(`caption=${caption.replace(/([=|])/g, "\\$1")}`, [publicId]);
    }
    await uploader.add_tag("echo-ai", [publicId]);
  }

  return { caption, tags: aiTags };
}

/**
 * What a modern browser actually downloads for a delivery URL. Measured rather
 * than estimated, so the savings figure is an observation.
 */
export async function deliveredBytes(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/*;q=0.8" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    return (await response.arrayBuffer()).byteLength;
  } catch {
    return null;
  }
}
