#!/usr/bin/env node
/**
 * Copy case images to public/ and emit src/data/gallery-cases.ts from review export.
 * Applies _pairing-tags.json when present (titles + procedure tags).
 *
 * Usage:
 *   node scripts/gallery-publish.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GALLERY_IMAGE_PROCESSING, processGalleryImage } from './gallery-process-images.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_EXPORT = path.join(ROOT, 'images/before_after/_default-export.json');
const TAGS_PATH = path.join(ROOT, 'images/before_after/_pairing-tags.json');
const SOURCE_DIR = path.join(ROOT, 'images/before_after');
const GALLERY_DIR = path.join(ROOT, 'public/images/gallery');
const OUT_TS = path.join(ROOT, 'src/data/gallery-cases.ts');

const SKIP_FILES = new Set(['DSC_0373.JPG', 'DSC_0422.JPG']);

/** Fallback titles/tags when Gemini returns sentences or generic labels */
const CASE_OVERRIDES = {
  4: { title: 'Porcelain Veneer Smile Makeover' },
  5: { title: 'Chipped Tooth Cosmetic Bonding' },
  6: { title: 'White Spot Cosmetic Treatment' },
  8: { title: 'Porcelain Veneer Smile Makeover' },
  10: { title: 'Lower Arch Porcelain Veneers' },
  11: { title: 'Anterior Cosmetic Smile Treatment' },
  12: { title: 'Peg Lateral Incisor Veneer' },
  16: { title: 'Anterior Porcelain Veneers' },
  17: { title: 'Complete Denture Transformation', procedure: 'Dentures' },
  18: { title: 'Porcelain Veneer Smile Makeover', procedure: 'Veneers' },
  19: { title: 'Maxillary Full Arch Restoration', procedure: 'Full Arch' },
  20: { title: 'Full Mouth Smile Restoration', procedure: 'Smile Makeover' },
  21: { title: 'Full Arch Restoration Comparison', procedure: 'Full Arch' },
  22: { title: 'Mandibular Full Arch Restoration', procedure: 'Full Arch' },
  23: { title: 'Full Arch Smile Transformation', procedure: 'Full Arch' },
  24: { title: 'Full Arch Before and After', procedure: 'Full Arch' },
};

const VALID_TAGS = new Set([
  'Dental Implants', 'All-on-4', 'All-on-6', 'Full Arch', 'Veneers',
  'Smile Makeover', 'Crowns & Bridges', 'Dentures', 'Cosmetic Dentistry',
]);

function parseArgs() {
  const args = process.argv.slice(2);
  let exportPath = DEFAULT_EXPORT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--export' && args[i + 1]) exportPath = path.resolve(args[++i]);
  }
  return { exportPath };
}

function imgSrc(filename) {
  return `/images/gallery/${encodeURIComponent(filename)}`;
}

function escTs(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function shouldSkipCase(c) {
  return c.images.some((i) => SKIP_FILES.has(i.filename));
}

function isCompositeCase(c) {
  if (c.images.length === 1) {
    const img = c.images[0];
    return img.phase === 'composite' || img.role === 'other';
  }
  return false;
}

function buildCaseImages(c, title) {
  const label = title || c.procedure;
  return c.images.map((img) => ({
    src: imgSrc(img.filename),
    role: img.role === 'before' || img.role === 'after' ? img.role : 'other',
    alt: `${img.role === 'before' ? 'Before' : img.role === 'after' ? 'After' : 'Result'} — ${label}`,
  }));
}

function pickBeforeAfter(c, images) {
  const findByFile = (filename) =>
    filename ? images.find((i) => i.src === imgSrc(filename)) ?? null : null;

  const fromExport = {
    before: findByFile(c.before),
    after: findByFile(c.after),
  };
  if (fromExport.before && fromExport.after) return fromExport;

  const before = images.find((i) => i.role === 'before') ?? images[0] ?? null;
  const after = images.find((i) => i.role === 'after' && i !== before)
    ?? images.find((i) => i !== before)
    ?? null;
  return { before, after };
}

function sortGalleryCases(cases) {
  return [...cases].sort((a, b) => {
    if (a.display !== b.display) return a.display === 'pair' ? -1 : 1;
    return a.order - b.order;
  });
}

function normalizeCase(c) {
  const title = c.caption?.trim() || '';
  const images = buildCaseImages(c, title);
  const composite = isCompositeCase(c);
  const { before, after } = pickBeforeAfter(c, images);
  const procedure = VALID_TAGS.has(c.procedure) ? c.procedure : 'Cosmetic Dentistry';

  return {
    id: `case-${c.order}`,
    order: c.order,
    procedure,
    caption: title,
    display: composite ? 'composite' : 'pair',
    before: composite ? null : before,
    after: composite ? images[0] : after,
    images,
  };
}

function emitTypeScript(cases) {
  const imgObj = (i) => {
    if (!i) return 'null';
    return `{ src: '${escTs(i.src)}', role: '${i.role}', alt: '${escTs(i.alt)}' }`;
  };

  const body = cases.map((c) => {
    const images = c.images.map((i) => imgObj(i)).join(',\n      ');
    return `  {
    id: '${escTs(c.id)}',
    order: ${c.order},
    procedure: '${escTs(c.procedure)}',
    caption: '${escTs(c.caption)}',
    display: '${c.display}',
    before: ${imgObj(c.before)},
    after: ${imgObj(c.after)},
    images: [
      ${images}
    ],
  }`;
  }).join(',\n');

  return `/** Generated by scripts/gallery-publish.js — do not edit by hand. */
export type GalleryCaseRole = 'before' | 'after' | 'other';

export interface GalleryCaseImage {
  src: string;
  role: GalleryCaseRole;
  alt: string;
}

export interface GalleryCase {
  id: string;
  order: number;
  procedure: string;
  caption: string;
  display: 'pair' | 'composite';
  before: GalleryCaseImage | null;
  after: GalleryCaseImage | null;
  images: GalleryCaseImage[];
}

export const galleryCases: GalleryCase[] = [
${body}
];
`;
}

function isBadTitle(title) {
  if (!title?.trim()) return true;
  const t = title.trim();
  if (/result$/i.test(t)) return true;
  if (t.length > 55) return true;
  if (/[.!?]\s*$/.test(t)) return true;
  if (/\b(using|restores|achieved|treatment to|beautifully)\b/i.test(t)) return true;
  return false;
}

function applyPairingTags(exportData) {
  const tagByOrder = {};
  if (fs.existsSync(TAGS_PATH)) {
    const tagsData = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
    Object.assign(
      tagByOrder,
      Object.fromEntries(tagsData.results.filter((r) => !r.error).map((r) => [r.order, r])),
    );
  }

  for (const c of exportData.cases) {
    const tag = tagByOrder[c.order];
    const manual = CASE_OVERRIDES[c.order];

    if (tag?.recommendedTag && VALID_TAGS.has(tag.recommendedTag)) {
      c.procedure = tag.recommendedTag;
    }
    if (manual?.procedure && VALID_TAGS.has(manual.procedure)) {
      c.procedure = manual.procedure;
    }
    if (c.procedure === 'Other' || !VALID_TAGS.has(c.procedure)) {
      c.procedure = manual?.procedure ?? 'Cosmetic Dentistry';
    }

    const geminiTitle = tag?.title?.trim();
    if (manual?.title) {
      c.caption = manual.title;
    } else if (geminiTitle && !isBadTitle(geminiTitle)) {
      c.caption = geminiTitle.replace(/[.!?]+\s*$/, '');
    } else if (c.caption?.trim() && !isBadTitle(c.caption)) {
      c.caption = c.caption.trim().replace(/[.!?]+\s*$/, '');
    } else {
      c.caption = `${c.procedure} Result`;
    }
  }
}

function main() {
  const { exportPath } = parseArgs();
  if (!fs.existsSync(exportPath)) {
    console.error('Export not found:', exportPath);
    process.exit(1);
  }

  const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  applyPairingTags(exportData);

  const rawCases = (exportData.cases || []).filter((c) => !shouldSkipCase(c));
  const cases = sortGalleryCases(rawCases.map(normalizeCase));

  fs.mkdirSync(GALLERY_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });

  const copied = new Set();
  for (const c of rawCases) {
    for (const img of c.images) {
      if (copied.has(img.filename)) continue;
      const srcPath = path.join(SOURCE_DIR, img.filename);
      const destPath = path.join(GALLERY_DIR, img.filename);
      if (!fs.existsSync(srcPath)) {
        console.warn(`Missing source: ${img.filename}`);
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      copied.add(img.filename);
    }
  }

  for (const filename of Object.keys(GALLERY_IMAGE_PROCESSING)) {
    const destPath = path.join(GALLERY_DIR, filename);
    const srcPath = path.join(SOURCE_DIR, filename);
    if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
    if (fs.existsSync(destPath)) {
      processGalleryImage(destPath, GALLERY_IMAGE_PROCESSING[filename]);
    }
  }

  fs.writeFileSync(OUT_TS, emitTypeScript(cases));
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  console.log(`Cases published: ${cases.length} (skipped cases with ${[...SKIP_FILES].join(', ')})`);
  console.log(`Images copied: ${copied.size} → ${GALLERY_DIR}`);
  console.log(`Wrote: ${OUT_TS}`);
}

main();
