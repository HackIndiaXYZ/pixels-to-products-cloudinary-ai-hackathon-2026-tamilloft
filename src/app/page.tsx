"use client";

import { useCallback, useRef, useState } from "react";
import { ScoreCard } from "@/components/ScoreCard";
import { ShareOfVoice } from "@/components/ShareOfVoice";
import { ProbeFeed } from "@/components/ProbeFeed";
import { Findings } from "@/components/Findings";
import type { AuditEvent } from "@/lib/audit/run";
import { computeScores } from "@/lib/audit/score";
import { sampleProfile, sampleProbes, sampleDiagnosis } from "@/lib/sample";
import type {
  BrandProfile,
  Diagnosis,
  ProbeQuery,
  ProbeResult,
  Scores,
} from "@/lib/schemas";

const EXAMPLES = ["linear.app", "posthog.com", "cal.com"];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Home() {
  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [queries, setQueries] = useState<ProbeQuery[]>([]);
  const [probes, setProbes] = useState<(ProbeResult | undefined)[]>([]);
  const [scores, setScores] = useState<Scores | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [isSample, setIsSample] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const apply = useCallback((event: AuditEvent) => {
    switch (event.type) {
      case "status":
        setStatus(event.message);
        break;
      case "profile":
        setProfile(event.profile);
        break;
      case "queries":
        setQueries(event.queries);
        setProbes(new Array(event.queries.length).fill(undefined));
        break;
      case "probe":
        setProbes((current) => {
          const next = [...current];
          next[event.index] = event.result;
          return next;
        });
        break;
      case "scores":
        setScores(event.scores);
        break;
      case "diagnosis":
        setDiagnosis(event.diagnosis);
        break;
      case "done":
        setStatus(null);
        break;
      case "error":
        setError(event.message);
        break;
    }
  }, []);

  const run = useCallback(async () => {
    if (!domain.trim() || running) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError(null);
    setStatus("Starting");
    setProfile(null);
    setQueries([]);
    setProbes([]);
    setScores(null);
    setDiagnosis(null);
    setIsSample(false);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error ?? "The audit could not be started.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          try {
            apply(JSON.parse(line.slice(5).trim()) as AuditEvent);
          } catch {
            // A partial frame; the next read completes it.
          }
        }
      }
    } catch (caught) {
      if ((caught as Error)?.name !== "AbortError") {
        setError(
          caught instanceof Error ? caught.message : "The audit failed.",
        );
      }
    } finally {
      setRunning(false);
      setStatus(null);
    }
  }, [domain, running, apply]);

  /**
   * Replays a stored audit through the same event handler the live run uses,
   * so the sample exercises the real UI path. Scores are computed here by the
   * real scoring function rather than stored, so nothing on screen is a
   * hardcoded number.
   */
  const runSample = useCallback(async () => {
    if (running) return;

    abortRef.current?.abort();
    setRunning(true);
    setIsSample(true);
    setError(null);
    setScores(null);
    setDiagnosis(null);
    setDomain("brightloom.io");

    setStatus("Reading brightloom.io");
    await pause(500);
    setProfile(sampleProfile);

    setStatus("Writing the questions buyers actually ask");
    await pause(700);
    const sampleQueries = sampleProbes.map((result) => result.query);
    setQueries(sampleQueries);
    setProbes(new Array(sampleProbes.length).fill(undefined));

    setStatus(
      `Asking ${sampleQueries.length} questions with no mention of Brightloom`,
    );
    for (let index = 0; index < sampleProbes.length; index++) {
      await pause(170);
      setProbes((current) => {
        const next = [...current];
        next[index] = sampleProbes[index];
        return next;
      });
    }

    setStatus("Scoring the results");
    await pause(400);
    setScores(computeScores(sampleProbes, sampleProfile));

    setStatus("Working out why, and what to do about it");
    await pause(600);
    setDiagnosis(sampleDiagnosis);

    setStatus(null);
    setRunning(false);
  }, [running]);

  const started = running || probes.length > 0 || Boolean(error);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-20">
      <header>
        <div className="flex items-baseline gap-3">
          <h1 className="text-ink text-2xl tracking-tight">Echo</h1>
          <span className="text-ink-muted text-sm">AI visibility auditor</span>
        </div>
        <p className="text-ink-2 mt-3 max-w-prose">
          Buyers ask AI what to buy before they ask Google. Echo measures
          whether the answer includes you.
        </p>
      </header>

      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="yourcompany.com"
            disabled={running}
            spellCheck={false}
            autoComplete="off"
            className="border-line bg-surface text-ink placeholder:text-ink-muted focus:border-mark min-w-0 flex-1 rounded-md border px-4 py-3 outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={running || !domain.trim()}
            className="bg-mark rounded-md px-5 py-3 font-medium text-white disabled:opacity-40"
          >
            {running ? "Auditing…" : "Run audit"}
          </button>
        </div>

        {!started ? (
          <div className="text-ink-muted mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setDomain(example)}
                className="border-line hover:border-baseline hover:text-ink-2 rounded border px-2 py-0.5"
              >
                {example}
              </button>
            ))}
            <span className="text-ink-muted/60">or</span>
            <button
              type="button"
              onClick={() => void runSample()}
              className="border-line hover:border-baseline hover:text-ink-2 rounded border px-2 py-0.5"
            >
              view a sample report
            </button>
          </div>
        ) : null}
      </form>

      {isSample ? (
        <p className="border-line bg-surface text-ink-2 mt-6 rounded-md border p-4 text-sm">
          <span className="text-ink">Sample report.</span> Brightloom and every
          competitor named here are invented, and these answers were not
          measured — this is a worked example of the output. The scores below
          are still computed from it by the real scoring code.
        </p>
      ) : null}

      {status ? (
        <p className="text-ink-2 mt-6 flex items-center gap-2 text-sm">
          <span className="bg-mark h-1.5 w-1.5 animate-pulse rounded-full" />
          {status}
        </p>
      ) : null}

      {error ? (
        <p
          className="border-line bg-surface mt-6 rounded-md border p-4 text-sm"
          style={{ color: "var(--color-critical)" }}
        >
          {error}
        </p>
      ) : null}

      {profile ? (
        <section className="border-line bg-surface mt-6 rounded-lg border p-5 fade-up">
          <h2 className="text-ink">{profile.brand}</h2>
          <p className="text-ink-2 mt-1 text-sm">{profile.description}</p>
          <p className="text-ink-muted mt-3 text-xs">
            Measured against {profile.competitors.join(", ")}
          </p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {scores && profile ? (
          <ScoreCard scores={scores} brand={profile.brand} />
        ) : null}

        {scores ? (
          <ShareOfVoice
            scores={scores}
            totalQuestions={scores.unbrandedTotal}
          />
        ) : null}

        {diagnosis && scores ? (
          <Findings diagnosis={diagnosis} scores={scores} />
        ) : null}

        {queries.length > 0 && profile ? (
          <ProbeFeed
            results={probes}
            total={queries.length}
            brand={profile.brand}
          />
        ) : null}
      </div>

      <footer className="text-ink-muted border-line mt-16 border-t pt-6 text-xs">
        Probes run with no system prompt and no mention of the brand. Every
        figure above is computed in code from those answers, not generated by a
        model.
      </footer>
    </main>
  );
}
