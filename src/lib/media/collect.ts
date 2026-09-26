import { assertPublicDomain } from "@/lib/audit/profile";

export interface SiteImage {
  url: string;
  /** Null when the site ships no alt text, or an empty one. */
  alt: string | null;
}

/** Enough to show a pattern without spending the free-tier quota on one audit. */
export const MAX_IMAGES = 6;

const ATTRIBUTE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
  });
}

function attributes(tag: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of tag.matchAll(ATTRIBUTE)) {
    found[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return found;
}

/** The last srcset candidate is conventionally the largest. */
function largestFromSrcset(srcset: string | undefined): string | undefined {
  const candidates = srcset
    ?.split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
  return candidates?.[candidates.length - 1];
}

function resolve(src: string | undefined, base: string): string | null {
  // Markup embedded in JSON arrives with escaped quotes around the value.
  src = src?.replace(/^\\?["']|\\?["']$/g, "");
  if (!src || src.startsWith("data:")) return null;
  try {
    const url = new URL(src, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Vectors and animations are not product photography, and tiny images are
 * icons or tracking pixels. None of them tell you how a brand looks.
 */
function worthAuditing(url: string, attrs: Record<string, string>): boolean {
  const path = new URL(url).pathname.toLowerCase();
  if (/\.(svg|gif|ico)$/.test(path)) return false;
  if (/pixel|spacer|tracking|favicon/.test(path)) return false;
  const width = Number.parseInt(attrs.width ?? "", 10);
  const height = Number.parseInt(attrs.height ?? "", 10);
  return !(width <= 64 || height <= 64);
}

/**
 * Pull the images a page actually shows. The og:image comes first: it is the
 * picture link previews and AI answers use when they show the brand at all.
 */
export function extractImages(html: string, pageUrl: string): SiteImage[] {
  const images: SiteImage[] = [];
  const seen = new Set<string>();

  const add = (url: string | null, alt: string | undefined) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({ url, alt: alt?.trim() ? alt.trim() : null });
  };

  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
  const meta = (name: string) =>
    metas.find((attrs) => (attrs.property ?? attrs.name)?.toLowerCase() === name)
      ?.content;
  const og = resolve(meta("og:image"), pageUrl);
  if (og && worthAuditing(og, {})) add(og, meta("og:image:alt"));

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    // Lazy loaders park the real source in a data attribute.
    const src =
      resolve(attrs.src, pageUrl) ??
      resolve(attrs["data-src"] ?? attrs["data-lazy-src"], pageUrl) ??
      resolve(largestFromSrcset(attrs.srcset ?? attrs["data-srcset"]), pageUrl);
    if (src && worthAuditing(src, attrs)) add(src, attrs.alt);
  }

  return images.slice(0, MAX_IMAGES);
}

export async function collectImages(domain: string): Promise<SiteImage[]> {
  assertPublicDomain(domain);

  const response = await fetch(`https://${domain}`, {
    headers: {
      "User-Agent": "EchoBot/1.0 (AI visibility audit; +https://echo.audit)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return [];

  return extractImages(await response.text(), response.url || `https://${domain}`);
}
