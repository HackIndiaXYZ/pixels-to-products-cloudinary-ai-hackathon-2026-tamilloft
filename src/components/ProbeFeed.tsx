"use client";

import { MessageSquareQuote } from "lucide-react";
import { useState } from "react";
import type { ProbeResult } from "@/lib/schemas";

/**
 * The live run. Each row lands as its probe returns, which is both the most
 * watchable part of the product and the most honest: you can read the actual
 * question asked and the actual answer that came back.
 */
export function ProbeFeed({
  results,
  total,
  brand,
}: {
  results: (ProbeResult | undefined)[];
  total: number;
  brand: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const landed = results.filter(Boolean).length;

  return (
    <section className="border-line bg-surface rounded-lg border p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink flex items-center gap-2 text-lg">
          <MessageSquareQuote size={18} className="text-mark" aria-hidden />
          Questions asked
        </h2>
        <span className="text-ink-muted text-sm tabular-nums">
          {landed} of {total}
        </span>
      </div>

      <div className="border-line mt-5 divide-y divide-[var(--color-line)] border-t">
        {results.map((result, index) =>
          result ? (
            <div key={index} className="fade-up py-3">
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-sm"
                  style={{
                    color: result.analysis.brandMentioned
                      ? "var(--color-good)"
                      : "var(--color-critical)",
                  }}
                >
                  {result.analysis.brandMentioned ? "●" : "○"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="text-ink-2 block text-sm">
                    {result.query.text}
                  </span>
                  <span className="text-ink-muted mt-1 block text-xs">
                    {result.query.kind === "branded" ? "names you · " : ""}
                    {result.analysis.brandMentioned
                      ? `${brand} named${
                          result.analysis.brandRank
                            ? ` at #${result.analysis.brandRank}`
                            : ""
                        }`
                      : result.analysis.competitorsMentioned.length > 0
                        ? `recommended instead: ${result.analysis.competitorsMentioned
                            .slice(0, 3)
                            .map((c) => c.name)
                            .join(", ")}`
                        : "no products named"}
                  </span>
                </span>

                <span className="text-ink-muted shrink-0 text-xs">
                  {openIndex === index ? "hide" : "answer"}
                </span>
              </button>

              {openIndex === index ? (
                <pre className="bg-raised border-line text-ink-2 mt-3 max-h-72 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
                  {result.answer}
                </pre>
              ) : null}
            </div>
          ) : (
            <div key={index} className="flex items-center gap-3 py-3">
              <span className="bg-baseline h-2 w-2 shrink-0 animate-pulse rounded-full" />
              <span className="bg-baseline h-3 w-full max-w-md animate-pulse rounded" />
            </div>
          ),
        )}
      </div>
    </section>
  );
}
