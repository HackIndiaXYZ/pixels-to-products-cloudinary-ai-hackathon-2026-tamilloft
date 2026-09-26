"use client";

import { useCallback, useRef, useState } from "react";
import {
  Building2,
  CircleAlert,
  CirclePlay,
  Globe,
  Info,
  LoaderCircle,
  Images,
  MessageSquareQuote,
  Radar,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HowItWorks } from "@/components/HowItWorks";
import { ScoreCard } from "@/components/ScoreCard";
import { ShareOfVoice } from "@/components/ShareOfVoice";
import { ProbeFeed } from "@/components/ProbeFeed";
import { Findings } from "@/components/Findings";
import { MediaAudit } from "@/components/MediaAudit";
import { ReportTabs } from "@/components/ReportTabs";
import type { AuditEvent } from "@/lib/audit/run";
import { computeScores } from "@/lib/audit/score";
import { computeMediaScores } from "@/lib/media/score";
import {
  sampleProfile,
  sampleProbes,
  sampleDiagnosis,
  sampleMedia,
} from "@/lib/sample";
import type {
  BrandProfile,
  Diagnosis,
  MediaAsset,
  MediaScores,
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

  const [media, setMedia] = useState<(MediaAsset | undefined)[]>([]);
  const [mediaExpected, setMediaExpected] = useState(0);
  const [mediaScores, setMediaScores] = useState<MediaScores | null>(null);
  const [mediaNotes, setMediaNotes] = useState<string[]>([]);
  const [mediaStarted, setMediaStarted] = useState(false);
  const [tab, setTab] = useState<"answers" | "images">("answers");

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
      case "media-found":
        setMediaStarted(true);
        setMediaExpected(event.count);
        break;
      case "media":
        setMedia((current) => {
          const next = [...current];
          next[event.index] = event.asset;
          return next;
        });
        break;
      case "media-scores":
        setMediaScores(event.scores);
        break;
      case "media-note":
        setMediaStarted(true);
        setMediaNotes((current) => [...current, event.message]);
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
    setMedia([]);
    setMediaExpected(0);
    setMediaScores(null);
    setMediaNotes([]);
    setMediaStarted(false);
    setTab("answers");
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
    setMedia([]);
    setMediaExpected(0);
    setMediaScores(null);
    setMediaNotes([]);
    setMediaStarted(false);
    setTab("answers");
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

    setStatus("Running homepage images through Cloudinary");
    setMediaStarted(true);
    setMediaExpected(sampleMedia.length);
    for (let index = 0; index < sampleMedia.length; index++) {
      await pause(250);
      setMedia((current) => {
        const next = [...current];
        next[index] = sampleMedia[index];
        return next;
      });
    }
    setMediaScores(computeMediaScores(sampleMedia, 0));

    setStatus("Working out why, and what to do about it");
    await pause(600);
    setDiagnosis(sampleDiagnosis);

    setStatus(null);
    setRunning(false);
  }, [running]);

  /** Back to the landing view. Ignored mid-run, so a stray click cannot kill an audit. */
  const reset = useCallback(() => {
    if (running) return;
    abortRef.current?.abort();
    setDomain("");
    setError(null);
    setStatus(null);
    setProfile(null);
    setQueries([]);
    setProbes([]);
    setScores(null);
    setDiagnosis(null);
    setIsSample(false);
    setMedia([]);
    setMediaExpected(0);
    setMediaScores(null);
    setMediaNotes([]);
    setMediaStarted(false);
    setTab("answers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [running]);

  const started = running || probes.length > 0 || Boolean(error);

  const answered = probes.filter(Boolean).length;
  const imagesReady = media.filter(Boolean).length;
  const imagesBusy = mediaStarted && !mediaScores && mediaExpected > 0;

  return (
    <>
      <SiteHeader onSample={() => void runSample()} onHome={reset} busy={running} />

      <main>
        <section id="audit" className="relative scroll-mt-14 overflow-hidden">
          <div className="echo-rings pointer-events-none absolute inset-0" aria-hidden />
          <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />

          <div
            className={`rise relative mx-auto w-full max-w-3xl px-4 text-center ${
              started ? "pt-10 pb-2" : "pt-20 pb-4 sm:pt-28"
            }`}
          >
            {!started ? (
              <>
                <p className="border-line bg-surface/70 text-ink-2 mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider uppercase">
                  <Sparkles size={12} className="text-mark" aria-hidden />
                  AI visibility audit · words and images
                </p>
                <h1 className="text-ink mx-auto mt-6 max-w-2xl font-serif text-5xl leading-[1.05] sm:text-6xl">
                  Is AI recommending your brand, or{" "}
                  <em className="text-mark">someone else&apos;s?</em>
                </h1>
                <p className="text-ink-2 mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
                  Buyers ask AI what to buy before they ask Google. Echo measures
                  whether the answer includes you, and runs your homepage images
                  through Cloudinary&apos;s AI to fix how machines see them.
                </p>
              </>
            ) : null}

            <form
              className={`mx-auto max-w-xl ${started ? "" : "mt-9"}`}
              onSubmit={(event) => {
                event.preventDefault();
                void run();
              }}
            >
              <div className="border-line bg-surface focus-within:border-mark flex items-center gap-2 rounded-xl border p-1.5 shadow-[0_8px_40px_-12px_rgb(57_135_229/0.35)] transition-colors">
                <Globe size={18} className="text-ink-muted ml-2.5 shrink-0" aria-hidden />
                <input
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="yourcompany.com"
                  aria-label="Domain to audit"
                  disabled={running}
                  spellCheck={false}
                  autoComplete="off"
                  className="text-ink placeholder:text-ink-muted min-w-0 flex-1 bg-transparent py-2.5 outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={running || !domain.trim()}
                  className="bg-mark flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {running ? (
                    <LoaderCircle size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Radar size={16} aria-hidden />
                  )}
                  {running ? "Auditing…" : "Run audit"}
                </button>
              </div>

              {!started ? (
                <div className="text-ink-muted mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span>Try</span>
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setDomain(example)}
                      className="border-line hover:border-baseline hover:text-ink-2 rounded-md border px-2 py-0.5 font-mono text-xs"
                    >
                      {example}
                    </button>
                  ))}
                  <span className="text-ink-muted/60">or</span>
                  <button
                    type="button"
                    onClick={() => void runSample()}
                    className="text-mark flex items-center gap-1.5 hover:underline"
                  >
                    <CirclePlay size={15} aria-hidden />
                    view a sample report
                  </button>
                </div>
              ) : null}
            </form>
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4">
          {isSample ? (
            <p className="border-line bg-surface text-ink-2 mt-6 flex gap-3 rounded-lg border p-4 text-sm">
              <Info size={16} className="text-mark mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="text-ink">Sample report.</span> Brightloom and every
                competitor named here are invented, and these answers were not
                measured — this is a worked example of the output. The images are
                real assets on Cloudinary&apos;s public demo cloud, transformed live.
                The scores below are still computed by the real scoring code.
              </span>
            </p>
          ) : null}

          {status ? (
            <p className="text-ink-2 mt-6 flex items-center justify-center gap-2 text-sm">
              <LoaderCircle size={15} className="text-mark animate-spin" aria-hidden />
              {status}
            </p>
          ) : null}

          {error ? (
            <p
              className="border-line bg-surface mt-6 flex gap-3 rounded-lg border p-4 text-sm"
              style={{ color: "var(--color-critical)" }}
              role="alert"
            >
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          {profile ? (
            <section className="border-line bg-surface fade-up mt-6 rounded-lg border p-5">
              <div className="flex items-center gap-3">
                <span className="bg-mark/10 text-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Building2 size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-ink font-medium">{profile.brand}</h2>
                  <p className="text-ink-muted font-mono text-xs">{profile.category}</p>
                </div>
              </div>
              <p className="text-ink-2 mt-3 text-sm">{profile.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-ink-muted mr-1">Measured against</span>
                {profile.competitors.map((competitor) => (
                  <span key={competitor} className="border-line text-ink-2 rounded-md border px-2 py-0.5">
                    {competitor}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {profile || mediaStarted ? (
            <ReportTabs
              active={tab}
              onChange={setTab}
              tabs={[
                {
                  id: "answers",
                  label: "AI answers",
              icon: MessageSquareQuote,
                  metric: scores
                    ? `${scores.visibilityScore}% visible`
                    : queries.length > 0
                      ? `${answered} of ${queries.length}`
                      : "—",
                  hint: scores
                    ? `in ${scores.unbrandedHits} of ${scores.unbrandedTotal} unbranded questions`
                    : queries.length > 0
                      ? "questions answered"
                      : running
                        ? "writing the questions"
                        : "not run",
                  busy: running && !diagnosis,
                  content: (
                    <>
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
                    </>
                  ),
                },
                {
                  id: "images",
                  label: "Images · Cloudinary",
              icon: Images,
                  metric: mediaScores
                    ? `${mediaScores.savedPct}% lighter`
                    : imagesBusy
                      ? `${imagesReady} of ${mediaExpected}`
                      : "—",
                  hint: mediaScores
                    ? `${mediaScores.missingAlt} of ${mediaScores.audited} images missing alt text`
                    : imagesBusy
                      ? "images processed"
                      : mediaNotes[0] ?? "collecting images",
                  busy: imagesBusy,
                  content: mediaStarted ? (
                    <MediaAudit
                      assets={media}
                      expected={mediaExpected}
                      scores={mediaScores}
                      notes={mediaNotes}
                    />
                  ) : (
                    <p className="text-ink-2 text-sm">Collecting the homepage images…</p>
                  ),
                },
              ]}
            />
          ) : null}

        </div>

        <div className="mx-auto w-full max-w-5xl px-4">
          <HowItWorks />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
