"use client";

import { useState } from "react";
import type { MediaAsset, MediaScores } from "@/lib/schemas";

// Plain <img> throughout: every URL here is a Cloudinary delivery URL that is
// already resized and format-negotiated, so Next's optimizer would only add a
// second, redundant pass.
/* eslint-disable @next/next/no-img-element */

function kb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="border-line border-t pt-3">
      <div className="text-ink text-2xl">{value}</div>
      <div className="text-ink-2 mt-0.5 text-sm">{label}</div>
      {hint ? <div className="text-ink-muted mt-0.5 text-xs">{hint}</div> : null}
    </div>
  );
}

function Preview({ href, src, label, ratio }: { href: string; src: string; label: string; ratio: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group block">
      <div className="border-line bg-raised overflow-hidden rounded border" style={{ aspectRatio: ratio }}>
        <img src={src} alt={label} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="text-ink-muted group-hover:text-ink-2 mt-1 text-xs">{label}</div>
    </a>
  );
}

type GenState = "idle" | "loading" | "done" | "failed";

/**
 * A generative edit, requested only when asked for. Cloudinary generates it on
 * the first request for its URL, which takes several seconds and spends AI
 * credits, so nothing is generated until someone wants to see it.
 */
function Generated({
  src,
  label,
  ratio,
  action,
}: {
  src: string;
  label: string;
  ratio: string;
  action: string;
}) {
  const [state, setState] = useState<GenState>("idle");

  if (state === "idle") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setState("loading")}
          className="border-line hover:border-mark text-ink-2 hover:text-ink flex w-full flex-col items-center justify-center gap-1 rounded border border-dashed px-2 text-center text-xs"
          style={{ aspectRatio: ratio }}
        >
          <span aria-hidden className="text-mark text-base">✦</span>
          {action}
        </button>
        <div className="text-ink-muted mt-1 text-xs">{label}</div>
      </div>
    );
  }

  return (
    <a href={src} target="_blank" rel="noreferrer" className="group block">
      <div
        className="border-line bg-raised relative overflow-hidden rounded border"
        style={{ aspectRatio: ratio }}
      >
        {state !== "failed" ? (
          <img
            src={src}
            alt={label}
            onLoad={() => setState("done")}
            onError={() => setState("failed")}
            className={`h-full w-full object-contain transition-opacity ${state === "done" ? "opacity-100" : "opacity-0"}`}
          />
        ) : null}
        {state === "loading" ? (
          <div className="text-ink-2 absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs">
            <span className="bg-mark h-1.5 w-1.5 animate-pulse rounded-full" />
            Generating…
          </div>
        ) : null}
        {state === "failed" ? (
          <div className="text-ink-muted absolute inset-0 flex items-center justify-center p-2 text-center text-xs">
            Could not generate. The account&apos;s AI credits may be used up.
          </div>
        ) : null}
      </div>
      <div className="text-ink-muted group-hover:text-ink-2 mt-1 text-xs">{label}</div>
    </a>
  );
}

function AssetCard({ asset }: { asset: MediaAsset }) {
  const optimized = asset.optimizedBytes === null ? null : Math.min(asset.optimizedBytes, asset.originalBytes);
  const saved = optimized === null ? null : Math.round(((asset.originalBytes - optimized) / asset.originalBytes) * 100);

  return (
    <li className="border-line bg-raised fade-up rounded-md border p-4">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <a href={asset.variants.optimized} target="_blank" rel="noreferrer">
          <img
            src={asset.variants.thumb}
            alt={asset.siteAlt ?? asset.aiCaption ?? "Image from the audited site"}
            loading="lazy"
            className="border-line w-full rounded border object-contain"
          />
        </a>

        <div className="min-w-0 text-sm">
          {asset.siteAlt ? (
            <p className="text-ink-2">
              <span style={{ color: "var(--color-good)" }} aria-hidden>● </span>
              Alt text: <span className="text-ink">“{asset.siteAlt}”</span>
            </p>
          ) : (
            <p style={{ color: "var(--color-serious)" }}>
              <span aria-hidden>▲ </span>No alt text. AI crawlers and screen readers see nothing here.
            </p>
          )}

          {asset.aiCaption ? (
            <p className="text-ink-2 mt-2">
              <span className="text-ink-muted">Cloudinary AI sees: </span>
              <span className="text-ink">“{asset.aiCaption}”</span>
              {!asset.siteAlt ? <span className="text-ink-muted"> (ready to use as alt text)</span> : null}
            </p>
          ) : null}

          {asset.aiTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {asset.aiTags.map((tag) => (
                <span key={tag} className="border-line text-ink-2 rounded border px-1.5 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <p className="text-ink-2 mt-2">
            {asset.width}×{asset.height} {asset.format.toUpperCase()} · {kb(asset.originalBytes)}
            {optimized !== null ? (
              <>
                {" → "}
                <span className="text-ink">{kb(optimized)}</span> with f_auto,q_auto
                {saved !== null && saved > 0 ? <span style={{ color: "var(--color-good)" }}> (−{saved}%)</span> : null}
              </>
            ) : null}
          </p>

          <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-ink-2 mt-1 block truncate text-xs">
            {asset.sourceUrl}
          </a>
        </div>
      </div>

      {/* Column widths follow the aspect ratios, so every tile in a row is the same height. */}
      <h3 className="text-ink-muted mt-5 text-xs tracking-widest uppercase">
        Smart crops · g_auto
      </h3>
      <div className="mt-2 grid grid-cols-[1.9fr_1fr] gap-3">
        <Preview href={asset.variants.social} src={asset.variants.social} label="Link preview 1200×630" ratio="1200 / 630" />
        <Preview href={asset.variants.square} src={asset.variants.square} label="Square 1080×1080" ratio="1 / 1" />
      </div>

      <h3 className="text-ink-muted mt-5 text-xs tracking-widest uppercase">
        Generative AI fixes
      </h3>
      <div className="mt-2 grid grid-cols-[1.9fr_1fr_1fr] gap-3">
        <Generated
          src={asset.variants.extended}
          label="1200×630 by generative fill: nothing cropped"
          ratio="1200 / 630"
          action="Extend to 1200×630"
        />
        <Generated
          src={asset.variants.cutout}
          label="Background removed"
          ratio="1 / 1"
          action="Remove background"
        />
        <Generated
          src={asset.variants.studio}
          label="Studio background, generated"
          ratio="1 / 1"
          action="New background"
        />
      </div>
    </li>
  );
}

export function MediaAudit({
  assets,
  expected,
  scores,
  notes,
}: {
  assets: (MediaAsset | undefined)[];
  expected: number;
  scores: MediaScores | null;
  notes: string[];
}) {
  const ready = assets.filter((asset): asset is MediaAsset => Boolean(asset));

  return (
    <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
      <h2 className="text-ink-muted text-xs tracking-widest uppercase">
        Image audit · via Cloudinary
      </h2>
      <p className="text-ink-2 mt-3 max-w-prose text-sm">
        AI answers and link previews describe a brand from its images too. Each
        image on the homepage is uploaded to Cloudinary, read by its AI,
        re-delivered optimized and cropped for where it will be seen, and can
        be fixed with generative AI in one click.
      </p>

      {scores ? (
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat value={`${scores.audited}`} label="Images audited" hint={scores.skipped ? `${scores.skipped} skipped` : "from the homepage"} />
          <Stat value={`${scores.altCoverage}%`} label="Alt text coverage" hint={`${scores.missingAlt} missing`} />
          <Stat value={`${scores.savedPct}%`} label="Weight saved" hint={`${kb(scores.originalBytes)} → ${kb(scores.optimizedBytes)}`} />
          <Stat value={`${scores.captioned}`} label="AI-captioned" hint="alt text written for you" />
        </div>
      ) : expected > 0 ? (
        <p className="text-ink-2 mt-5 flex items-center gap-2 text-sm">
          <span className="bg-mark h-1.5 w-1.5 animate-pulse rounded-full" />
          Processing {ready.length} of {expected} images in Cloudinary
        </p>
      ) : null}

      {notes.length > 0 ? (
        <ul className="text-ink-muted mt-4 space-y-1 text-xs">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {ready.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {ready.map((asset) => (
            <AssetCard key={asset.publicId} asset={asset} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
