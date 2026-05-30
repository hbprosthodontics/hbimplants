#!/usr/bin/env node
/**
 * Generate short gallery titles + procedure tags with Gemini 3.5 Flash.
 * Usage: node scripts/gallery-tag-pairings.js
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'images/before_after');
const EXPORT_PATH = path.join(DIR, '_default-export.json');
const THUMB_DIR = path.join(DIR, '_thumbs');
const MODEL = 'gemini-3.5-flash';
const THUMB_MAX = 768;

/** Gallery filter tags — must not include "Other" */
const GALLERY_TAGS = [
  'Dental Implants',
  'All-on-4',
  'All-on-6',
  'Full Arch',
  'Veneers',
  'Smile Makeover',
  'Crowns & Bridges',
  'Dentures',
  'Cosmetic Dentistry',
];

const SKIP_FILES = new Set(['DSC_0373.JPG', 'DSC_0422.JPG']);

function ensureThumb(filename) {
  const src = path.join(DIR, filename);
  const dest = path.join(THUMB_DIR, filename.replace(/\.[^.]+$/, '.jpg'));
  if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
    fs.mkdirSync(THUMB_DIR, { recursive: true });
    execFileSync('sips', ['-Z', String(THUMB_MAX), src, '--out', dest], { stdio: 'pipe' });
  }
  return dest;
}

function isCompositeCase(c) {
  if (c.images.length === 1) {
    const img = c.images[0];
    return img.phase === 'composite' || img.role === 'other';
  }
  return false;
}

function loadCases() {
  const data = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  return data.cases.filter((c) => {
    if (c.images.some((i) => SKIP_FILES.has(i.filename))) return false;
    return c.images.length >= 1;
  });
}

function pickImages(c) {
  const composite = isCompositeCase(c);
  if (composite) {
    const file = c.images[0].filename;
    return { composite: true, files: [file] };
  }
  const before = c.before
    ?? c.images.find((i) => i.role === 'before')?.filename
    ?? c.images[0]?.filename;
  const after = c.after
    ?? c.images.find((i) => i.role === 'after' && i.filename !== before)?.filename
    ?? c.images.find((i) => i.filename !== before)?.filename;
  const files = [before, after].filter(Boolean);
  return { composite: false, files: [...new Set(files)] };
}

async function tagCase(apiKey, c) {
  const { composite, files } = pickImages(c);

  const parts = [{
    text: `You are labeling dental before/after cases for a prosthodontics practice website gallery.

Case ID: ${c.patientLabel}
Current procedure hint: "${c.procedure}"
${composite
  ? 'This case uses ONE composite image that already shows before (top) and after (bottom) in a single frame. Analyze that image only.'
  : `Images: before="${files[0] || 'none'}", after="${files[1] || 'none'}"`}
${c.caption?.trim() ? `Staff note (convert to noun phrase — do NOT copy as a sentence): "${c.caption}"` : ''}

Choose exactly ONE procedure tag from this list (must match exactly — never use "Other"):
${JSON.stringify(GALLERY_TAGS)}

Rules for procedure tag:
- Pick the most specific accurate tag for the PRIMARY treatment in the after result.
- Use "Veneers" for porcelain veneer cases.
- Use "Crowns & Bridges" for crowns/bridges (not implants).
- Use "Dentures" for removable dentures.
- Use "All-on-4" / "All-on-6" only when clearly that implant count.
- Use "Full Arch" for full-arch fixed restoration when implant count unclear.
- Use "Smile Makeover" for comprehensive multi-procedure aesthetic transformation.
- Use "Cosmetic Dentistry" for bonding, whitening, minor cosmetic fixes.
- Use "Dental Implants" for implant crowns (not full arch).
- If uncertain, choose the closest tag from the list — never invent tags outside the list.

Rules for title (strict):
- MUST be a short noun phrase only: 3–8 words, Title Case, NO period, NO full sentences.
- Describe the specific treatment outcome visible.
- Good: "Front Tooth Diastema Closure", "Porcelain Veneer Smile Makeover", "Complete Upper Denture Restoration", "Single Peg Lateral Veneer"
- Bad: "A beautiful smile transformation using..." or "Other Result" or "Cosmetic Dentistry Result"

Return ONLY valid JSON:
{
  "recommendedTag": "one tag from list",
  "title": "short noun phrase title",
  "confidence": 0.0-1.0
}`,
  }];

  for (const file of files) {
    const thumb = ensureThumb(file);
    const b64 = fs.readFileSync(thumb).toString('base64');
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${c.patientLabel}: ${res.status} ${err.slice(0, 400)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
  } catch {
    parsed = {
      recommendedTag: GALLERY_TAGS.includes(c.procedure) ? c.procedure : 'Cosmetic Dentistry',
      title: c.caption || `${c.procedure} Result`,
      confidence: 0.3,
    };
  }

  if (!GALLERY_TAGS.includes(parsed.recommendedTag)) {
    parsed.recommendedTag = GALLERY_TAGS.includes(c.procedure) ? c.procedure : 'Cosmetic Dentistry';
  }
  if (!parsed.title?.trim()) {
    parsed.title = c.caption?.trim() || `${parsed.recommendedTag} Result`;
  }

  return {
    order: c.order,
    patientLabel: c.patientLabel,
    composite,
    imageCount: c.images.length,
    ...parsed,
    analyzedAt: new Date().toISOString(),
  };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  const cases = loadCases();
  console.log(`Tagging ${cases.length} cases with ${MODEL}…\n`);

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`  [${i + 1}/${cases.length}] ${c.patientLabel}…`);
    try {
      const r = await tagCase(apiKey, c);
      results.push(r);
      process.stdout.write(` ${r.recommendedTag} — "${r.title}"\n`);
    } catch (e) {
      process.stdout.write(` ERROR\n`);
      results.push({ order: c.order, patientLabel: c.patientLabel, error: e.message });
    }
  }

  const outPath = path.join(DIR, '_pairing-tags.json');
  fs.writeFileSync(outPath, JSON.stringify({ model: MODEL, analyzedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nSaved: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
