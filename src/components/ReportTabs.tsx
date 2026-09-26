"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface ReportTab<Id extends string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  /** The tab's headline number, so the tab row doubles as the report summary. */
  metric: string;
  hint: string;
  busy: boolean;
  content: ReactNode;
}

export function ReportTabs<Id extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReportTab<Id>[];
  active: Id;
  onChange: (id: Id) => void;
}) {
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  // Arrow keys move between tabs, per the WAI-ARIA tabs pattern.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = tabs.findIndex((tab) => tab.id === current.id);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div className="mt-6">
      <div role="tablist" aria-label="Report sections" className="grid grid-cols-2 gap-3" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                selected ? "border-mark bg-surface" : "border-line bg-plane hover:border-baseline"
              }`}
            >
              <div className="text-ink-muted flex items-center gap-2 font-mono text-xs tracking-widest uppercase">
                <tab.icon size={14} className={selected ? "text-mark" : ""} aria-hidden />
                {tab.label}
                {tab.busy ? <span className="bg-mark h-1.5 w-1.5 animate-pulse rounded-full" aria-label="in progress" /> : null}
              </div>
              <div className={`mt-2 text-2xl ${selected ? "text-ink" : "text-ink-2"}`}>{tab.metric}</div>
              <div className="text-ink-muted mt-0.5 text-xs">{tab.hint}</div>
            </button>
          );
        })}
      </div>

      <div
        id={`panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        className="mt-6 flex flex-col gap-6"
      >
        {current.content}
      </div>
    </div>
  );
}
