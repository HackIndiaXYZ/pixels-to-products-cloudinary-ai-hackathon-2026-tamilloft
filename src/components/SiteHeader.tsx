"use client";

import { CirclePlay, Workflow } from "lucide-react";
import { GitHubIcon, Logo, REPO_URL } from "./Brand";

export function SiteHeader({
  onSample,
  onHome,
  busy,
}: {
  onSample: () => void;
  onHome: () => void;
  busy: boolean;
}) {
  const link =
    "text-ink-2 hover:text-ink flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-white/[0.04]";

  return (
    <header className="border-line/80 bg-plane/75 sticky top-0 z-30 border-b backdrop-blur-md">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <button type="button" onClick={onHome} className="flex items-center gap-2.5" aria-label="Echo home">
          <Logo />
          <span className="text-ink font-serif text-2xl leading-none">Echo</span>
          <span className="border-line text-ink-muted hidden rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase sm:inline">
            beta
          </span>
        </button>

        <div className="flex items-center gap-1">
          <a href="#how-it-works" onClick={onHome} className={`${link} hidden md:flex`}>
            <Workflow size={15} aria-hidden />
            How it works
          </a>
          <button type="button" onClick={onSample} disabled={busy} className={`${link} disabled:opacity-40`}>
            <CirclePlay size={15} aria-hidden />
            <span className="hidden sm:inline">Sample report</span>
          </button>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={link} aria-label="Source on GitHub">
            <GitHubIcon size={15} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <span className="border-line text-ink-2 ml-2 hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs lg:flex">
            <span className="bg-mark h-1.5 w-1.5 rounded-full" aria-hidden />
            Powered by Cloudinary
          </span>
        </div>
      </nav>
    </header>
  );
}
