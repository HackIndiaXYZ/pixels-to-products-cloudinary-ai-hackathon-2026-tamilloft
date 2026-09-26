import {
  Crop,
  Eraser,
  Expand,
  Gauge,
  Images,
  Layers,
  MessageSquareQuote,
  ScanSearch,
  Type,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ScanSearch,
    title: "Read your site",
    body: "Echo fetches your own pages and works out your category, audience and real competitors.",
  },
  {
    icon: MessageSquareQuote,
    title: "Ask like a buyer",
    body: "It asks AI the questions buyers ask, never naming you, and records who gets recommended.",
  },
  {
    icon: Images,
    title: "Run images through Cloudinary",
    body: "Every homepage image is uploaded, read by Cloudinary's AI, optimized and re-cropped.",
  },
  {
    icon: Gauge,
    title: "Score it, then fix it",
    body: "Scores computed in code, a diagnosis, and fixed images ready to ship.",
  },
];

const CAPABILITIES: { icon: LucideIcon; label: string; code: string }[] = [
  { icon: Layers, label: "Upload & tag", code: "upload" },
  { icon: Zap, label: "Auto format & quality", code: "f_auto,q_auto" },
  { icon: Crop, label: "Content-aware crop", code: "g_auto" },
  { icon: Expand, label: "Generative fill", code: "b_gen_fill" },
  { icon: WandSparkles, label: "Background replace", code: "e_gen_background_replace" },
  { icon: Eraser, label: "Background removal", code: "e_background_removal" },
  { icon: Type, label: "AI captions as alt text", code: "captioning" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mt-24 scroll-mt-20">
      <p className="text-mark font-mono text-xs tracking-widest uppercase">How it works</p>
      <h2 className="text-ink mt-3 max-w-xl font-serif text-4xl leading-tight">
        One domain in. The whole picture of how AI sees you out.
      </h2>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="bg-surface p-6">
            <div className="flex items-center justify-between">
              <span className="bg-mark/10 text-mark flex h-9 w-9 items-center justify-center rounded-lg">
                <Icon size={18} aria-hidden />
              </span>
              <span className="text-ink-muted font-mono text-xs">0{index + 1}</span>
            </div>
            <h3 className="text-ink mt-5 font-medium">{title}</h3>
            <p className="text-ink-2 mt-2 text-sm leading-relaxed">{body}</p>
          </li>
        ))}
      </ol>

      <div className="border-line bg-surface mt-6 rounded-xl border p-6">
        <p className="text-ink-muted font-mono text-xs tracking-widest uppercase">
          What Cloudinary does in every audit
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CAPABILITIES.map(({ icon: Icon, label, code }) => (
            <li
              key={code}
              className="border-line bg-raised text-ink-2 flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 text-sm"
            >
              <Icon size={14} className="text-mark" aria-hidden />
              {label}
              <code className="text-ink-muted font-mono text-[11px]">{code}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
