import type { MediaAsset, MediaScores } from "@/lib/schemas";

const pct = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

/**
 * The image half of the report, computed in code for the same reason the text
 * half is: every figure traces back to specific assets.
 *
 * Savings count only assets whose optimized size was measured. Where f_auto
 * would deliver something larger than the original -- it happens with images
 * that were already well compressed -- the original is what you would keep,
 * so that asset contributes no saving rather than a negative one.
 */
export function computeMediaScores(
  assets: MediaAsset[],
  skipped: number,
): MediaScores {
  const measured = assets.filter((asset) => asset.optimizedBytes !== null);
  const originalBytes = measured.reduce((sum, a) => sum + a.originalBytes, 0);
  const optimizedBytes = measured.reduce(
    (sum, a) => sum + Math.min(a.optimizedBytes as number, a.originalBytes),
    0,
  );
  const withAlt = assets.filter((asset) => asset.siteAlt !== null).length;

  return {
    audited: assets.length,
    skipped,
    altCoverage: pct(withAlt, assets.length),
    missingAlt: assets.length - withAlt,
    captioned: assets.filter((asset) => asset.aiCaption !== null).length,
    originalBytes,
    optimizedBytes,
    savedPct: pct(originalBytes - optimizedBytes, originalBytes),
  };
}
