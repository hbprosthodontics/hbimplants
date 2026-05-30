#!/usr/bin/env node
/**
 * Apply Gemini pairing tags to export, copy gallery assets, emit gallery.astro entries.
 * Usage: node scripts/gallery-sync-export.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'images/before_after');
const EXPORT_PATH = path.join(DIR, '_default-export.json');
const TAGS_PATH = path.join(DIR, '_pairing-tags.json');
const GALLERY_DIR = path.join(ROOT, 'public/images/gallery');

/** Case 14 re-tag (truncated in batch run) */
const CASE14_OVERRIDE = {
  recommendedTag: 'Veneers',
  suggestedCaption: 'A single custom veneer beautifully restores a peg lateral incisor for a seamless, confident smile.',
  treatmentSummary: 'Restoration of a peg lateral incisor using a custom veneer to close diastemas and achieve a natural, symmetrical smile.',
};

function gallerySrc(filename) {
  return `/images/gallery/${encodeURIComponent(filename)}`;
}

function pickDisplayFile(c) {
  if (c.after) return c.after;
  if (c.images.length === 1) return c.images[0].filename;
  const afterImg = c.images.find(i => i.role === 'after');
  return afterImg?.filename ?? c.images[0]?.filename;
}

function escAstro(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function main() {
  const exportData = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  const tagsData = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  const tagByOrder = Object.fromEntries(
    tagsData.results.filter(r => !r.error).map(r => [r.order, r]),
  );
  if (tagByOrder[12]) Object.assign(tagByOrder[12], CASE14_OVERRIDE);

  fs.mkdirSync(GALLERY_DIR, { recursive: true });

  const galleryEntries = [];
  const copied = new Set();

  for (const c of exportData.cases) {
    const tag = tagByOrder[c.order];
    if (tag?.recommendedTag) {
      c.procedure = tag.recommendedTag;
      if (tag.suggestedCaption) c.caption = tag.suggestedCaption;
      c.alt = `${c.procedure} patient result`;
    }

    // Skip model-only case (no before)
    if (c.order === 13) continue;

    const displayFile = pickDisplayFile(c);
    if (!displayFile || displayFile === 'DSC_0422.JPG') continue;

    const srcPath = path.join(DIR, displayFile);
    if (!fs.existsSync(srcPath)) {
      console.warn(`Missing: ${displayFile}`);
      continue;
    }

    const destPath = path.join(GALLERY_DIR, displayFile);
    if (!copied.has(displayFile)) {
      fs.copyFileSync(srcPath, destPath);
      copied.add(displayFile);
    }

    galleryEntries.push({
      src: gallerySrc(displayFile),
      alt: c.caption || c.alt || `${c.procedure} patient result`,
      procedure: c.procedure,
      caption: c.caption || undefined,
      order: c.order,
      patientLabel: c.patientLabel,
    });
  }

  exportData.exportedAt = new Date().toISOString();
  fs.writeFileSync(EXPORT_PATH, JSON.stringify(exportData, null, 2));

  const manifestPath = path.join(DIR, '_gallery-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), entries: galleryEntries }, null, 2));

  const lines = galleryEntries.map(e => {
    const parts = [
      `src: '${escAstro(e.src)}'`,
      `alt: '${escAstro(e.alt)}'`,
      `procedure: '${escAstro(e.procedure)}'`,
    ];
    if (e.caption) parts.push(`caption: '${escAstro(e.caption)}'`);
    return `  { ${parts.join(', ')} },`;
  });

  const astroBlock = `const galleryImages: GalleryImage[] = [\n${lines.join('\n')}\n];`;

  const galleryAstroPath = path.join(ROOT, 'src/pages/gallery.astro');
  let astro = fs.readFileSync(galleryAstroPath, 'utf8');
  astro = astro.replace(
    /const galleryImages: GalleryImage\[\] = \[[\s\S]*?\];/,
    astroBlock,
  );
  fs.writeFileSync(galleryAstroPath, astro);

  console.log(`Updated export: ${EXPORT_PATH}`);
  console.log(`Copied ${copied.size} images → ${GALLERY_DIR}`);
  console.log(`Gallery entries: ${galleryEntries.length}`);
  console.log(`Updated: ${galleryAstroPath}`);
  console.log(`Manifest: ${manifestPath}`);
}

main();
