import { test } from "node:test";
import assert from "node:assert/strict";
import { extractImages, MAX_IMAGES } from "./collect";
import { computeMediaScores } from "./score";
import type { MediaAsset } from "@/lib/schemas";

const PAGE = "https://example.com/home/";

test("extracts og:image first, resolves relative URLs, and keeps alt text", () => {
  const html = `
    <meta property="og:image" content="/og.jpg">
    <meta property="og:image:alt" content="Our product">
    <img src="hero.jpg" alt=" A dashboard ">
    <img src='https://cdn.example.com/team.webp' alt="">`;
  assert.deepEqual(extractImages(html, PAGE), [
    { url: "https://example.com/og.jpg", alt: "Our product" },
    { url: "https://example.com/home/hero.jpg", alt: "A dashboard" },
    // An empty alt counts as missing: it describes nothing.
    { url: "https://cdn.example.com/team.webp", alt: null },
  ]);
});

test("follows lazy-loading attributes and picks the largest srcset candidate", () => {
  const html = `
    <img src="data:image/gif;base64,R0lGOD" data-src="/lazy.jpg">
    <img srcset="/a-480.jpg 480w, /a-960.jpg 960w, /a-1920.jpg 1920w">
    <img src="/x.png?w=1&amp;h=2">`;
  assert.deepEqual(
    extractImages(html, PAGE).map((image) => image.url),
    [
      "https://example.com/lazy.jpg",
      "https://example.com/a-1920.jpg",
      "https://example.com/x.png?w=1&h=2",
    ],
  );
});

test("skips vectors, icons, tracking pixels, duplicates, and non-http sources", () => {
  const html = `
    <img src="/logo.svg">
    <img src="/spin.gif">
    <img src="/favicon-32.png">
    <img src="/pixel.png">
    <img src="/icon.png" width="24" height="24">
    <img src="javascript:alert(1)">
    <img src="/real.jpg"><img src="/real.jpg">`;
  assert.deepEqual(
    extractImages(html, PAGE).map((image) => image.url),
    ["https://example.com/real.jpg"],
  );
});

test("decodes entities in alt text and ignores escaped data URIs", () => {
  const html = `
    <img src=\\"data:image/svg+xml,%3Csvg\\">
    <img src="/shoe.png" alt="Men&#39;s Cruiser &amp; laces &#x2014; grey">`;
  assert.deepEqual(extractImages(html, PAGE), [
    { url: "https://example.com/shoe.png", alt: "Men's Cruiser & laces — grey" },
  ]);
});

test("caps the number of images audited", () => {
  const html = Array.from({ length: 20 }, (_, i) => `<img src="/${i}.jpg">`).join("");
  assert.equal(extractImages(html, PAGE).length, MAX_IMAGES);
});

function asset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    sourceUrl: "https://example.com/a.jpg",
    publicId: "echo/example.com/a",
    width: 100,
    height: 100,
    format: "jpg",
    siteAlt: null,
    aiCaption: null,
    aiTags: [],
    originalBytes: 1000,
    optimizedBytes: 400,
    variants: { optimized: "", thumb: "", social: "", square: "", cutout: "", extended: "", studio: "" },
    ...overrides,
  };
}

test("media scores: zeros rather than NaN when nothing was audited", () => {
  assert.deepEqual(computeMediaScores([], 2), {
    audited: 0,
    skipped: 2,
    altCoverage: 0,
    missingAlt: 0,
    captioned: 0,
    originalBytes: 0,
    optimizedBytes: 0,
    savedPct: 0,
  });
});

test("media scores: alt coverage, captions, and savings from measured assets only", () => {
  const scores = computeMediaScores(
    [
      asset({ siteAlt: "A dashboard", originalBytes: 1000, optimizedBytes: 400 }),
      asset({ aiCaption: "A cup of coffee", originalBytes: 3000, optimizedBytes: 600 }),
      // Unmeasured: excluded from savings, still counted for alt coverage.
      asset({ originalBytes: 5000, optimizedBytes: null }),
    ],
    1,
  );
  assert.equal(scores.audited, 3);
  assert.equal(scores.skipped, 1);
  assert.equal(scores.altCoverage, 33.3);
  assert.equal(scores.missingAlt, 2);
  assert.equal(scores.captioned, 1);
  assert.equal(scores.originalBytes, 4000);
  assert.equal(scores.optimizedBytes, 1000);
  assert.equal(scores.savedPct, 75);
});

test("media scores: an optimized file larger than the original counts as no saving", () => {
  const scores = computeMediaScores(
    [asset({ originalBytes: 1000, optimizedBytes: 1200 })],
    0,
  );
  assert.equal(scores.optimizedBytes, 1000);
  assert.equal(scores.savedPct, 0);
});
