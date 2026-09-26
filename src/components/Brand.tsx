/** A source point and the arcs spreading from it: an echo. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="2.4" fill="var(--color-mark)" />
      <path d="M9.5 7.5a6.4 6.4 0 0 1 0 9" stroke="var(--color-mark)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13.5 4.5a10.6 10.6 0 0 1 0 15" stroke="var(--color-mark)" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
      <path d="M17.5 1.8a14.6 14.6 0 0 1 0 20.4" stroke="var(--color-mark)" strokeWidth="1.8" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/** lucide dropped brand icons, so the GitHub mark is drawn here. */
export function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export const REPO_URL =
  "https://github.com/HackIndiaXYZ/pixels-to-products-cloudinary-ai-hackathon-2026-tamilloft";
