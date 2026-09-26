import { mapWithConcurrency } from "@/lib/audit/probe";
import type { MediaAsset, MediaScores } from "@/lib/schemas";
import { collectImages, type SiteImage } from "./collect";
import {
  cloudinaryConfigured,
  deliveredBytes,
  readWithAi,
  uploadFromUrl,
  variants,
} from "./cloudinary";
import { computeMediaScores } from "./score";

export type MediaEvent =
  | { type: "media-note"; message: string }
  | { type: "media-found"; count: number }
  | { type: "media"; index: number; asset: MediaAsset }
  | { type: "media-scores"; scores: MediaScores };

/** Uploads and AI calls are rate limited on the free plan; three at a time is plenty. */
const MEDIA_CONCURRENCY = 3;

const ADDON_LABELS: Record<string, string> = {
  captioning: "AI captioning",
  google_tagging: "Google auto-tagging",
  aws_rek_tagging: "Amazon Rekognition auto-tagging",
};

async function auditOne(
  image: SiteImage,
  domain: string,
  unavailable: Map<string, string>,
): Promise<MediaAsset | null> {
  try {
    const upload = await uploadFromUrl(image.url, domain, image.alt);
    const links = variants(upload.public_id);
    const [reading, optimizedBytes] = await Promise.all([
      readWithAi(upload.public_id, unavailable).catch(() => ({ caption: null, tags: [] })),
      deliveredBytes(links.optimized),
    ]);

    return {
      sourceUrl: image.url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height,
      format: upload.format,
      siteAlt: image.alt,
      aiCaption: reading.caption,
      aiTags: reading.tags.slice(0, 8),
      originalBytes: upload.bytes,
      optimizedBytes,
      variants: links,
    };
  } catch {
    // Sites block hotlinking, serve HTML at image URLs, and time out. One bad
    // image should cost that image, not the audit.
    return null;
  }
}

/**
 * The image half of the audit: collect what the homepage shows, run it through
 * Cloudinary, and report how well it is described and how heavy it is.
 *
 * Independent of every model call, so it runs alongside the text audit and
 * still completes if the language model is rate limited.
 */
export async function auditMedia(
  domain: string,
  emit: (event: MediaEvent) => void,
): Promise<{ assets: MediaAsset[]; scores: MediaScores } | null> {
  if (!cloudinaryConfigured()) {
    emit({
      type: "media-note",
      message: "Image audit skipped: set the CLOUDINARY_* variables to enable it.",
    });
    return null;
  }

  const images = await collectImages(domain).catch(() => []);
  emit({ type: "media-found", count: images.length });
  if (images.length === 0) {
    emit({ type: "media-note", message: `No auditable images found on ${domain}'s homepage.` });
    return null;
  }

  const unavailable = new Map<string, string>();
  const assets: MediaAsset[] = [];

  await mapWithConcurrency(
    images,
    MEDIA_CONCURRENCY,
    (image) => auditOne(image, domain, unavailable),
    (index, asset) => {
      if (!asset) return;
      assets.push(asset);
      emit({ type: "media", index, asset });
    },
  );

  const skipped = images.length - assets.length;
  if (skipped > 0) {
    emit({
      type: "media-note",
      message: `${skipped} image${skipped === 1 ? "" : "s"} could not be fetched by Cloudinary and ${skipped === 1 ? "was" : "were"} skipped.`,
    });
  }
  for (const feature of unavailable.keys()) {
    emit({
      type: "media-note",
      message: `${ADDON_LABELS[feature] ?? feature} is not enabled on this Cloudinary account.`,
    });
  }

  // Keep page order, not completion order, in the final report.
  const order = new Map(images.map((image, index) => [image.url, index]));
  assets.sort((a, b) => order.get(a.sourceUrl)! - order.get(b.sourceUrl)!);

  const scores = computeMediaScores(assets, skipped);
  emit({ type: "media-scores", scores });
  return { assets, scores };
}
