#!/usr/bin/env node
/**
 * Analyze before/after dental photos with Gemini Flash, suggest pairings,
 * and generate an interactive HTML review artifact.
 *
 * Usage:
 *   node scripts/gallery-analyze.js
 *   node scripts/gallery-analyze.js --dir ./images/before_after
 *   node scripts/gallery-analyze.js --skip-analysis   # rebuild HTML from cached JSON
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MODEL = 'gemini-2.0-flash';
const THUMB_MAX = 768;
const CONCURRENCY = 4;

const PROCEDURES = [
  'Dental Implants',
  'All-on-4',
  'All-on-6',
  'Full Arch',
  'Veneers',
  'Smile Makeover',
  'Crowns & Bridges',
  'Dentures',
  'Cosmetic Dentistry',
  'Other',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    dir: path.join(ROOT, 'images/before_after'),
    skipAnalysis: false,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) opts.dir = path.resolve(args[i + 1]);
    if (args[i] === '--skip-analysis') opts.skipAnalysis = true;
    if (args[i] === '--force') opts.force = true;
  }
  return opts;
}

function listImages(dir) {
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .filter(f => !f.startsWith('_'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function ensureThumb(dir, filename, cacheDir) {
  const src = path.join(dir, filename);
  const dest = path.join(cacheDir, filename.replace(/\.[^.]+$/, '.jpg'));
  if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
    fs.mkdirSync(cacheDir, { recursive: true });
    execFileSync('sips', ['-Z', String(THUMB_MAX), src, '--out', dest], { stdio: 'pipe' });
  }
  return dest;
}

function fileToBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

function parseExifDate(raw) {
  const m = String(raw).match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

function readExifDates(dir, filenames) {
  if (!filenames.length) return {};
  const paths = filenames.map(f => path.join(dir, f));
  try {
    const out = execFileSync(
      'exiftool',
      ['-DateTimeOriginal', '-CreateDate', '-json', '-fast', ...paths],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    const rows = JSON.parse(out);
    const map = {};
    for (const row of rows) {
      const base = path.basename(row.SourceFile || row.FileName || '');
      const raw = row.DateTimeOriginal || row.CreateDate;
      const takenAt = parseExifDate(raw);
      if (takenAt) map[base] = takenAt;
    }
    return map;
  } catch {
    return {};
  }
}

function enrichAnalysesWithExif(dir, analyses) {
  const dates = readExifDates(dir, analyses.map(a => a.filename));
  return analyses.map(a => ({
    ...a,
    takenAt: dates[a.filename] ?? a.takenAt ?? null,
  }));
}

async function analyzeImage(apiKey, thumbPath, filename) {
  const mime = 'image/jpeg';
  const b64 = fileToBase64(thumbPath);

  const prompt = `You are helping a prosthodontics practice organize patient before/after photos.

Analyze this dental clinical photo. Return ONLY valid JSON (no markdown) with this shape:
{
  "phase": "before" | "after" | "composite" | "unclear",
  "procedure": one of ${JSON.stringify(PROCEDURES)},
  "procedureDetail": "short specific description e.g. upper full arch implant bridge",
  "patientTraits": "anonymous visual traits to match same patient across photos: gender presentation, approximate age range, skin tone, hair color/visibility, facial hair, glasses, distinctive features — NO names",
  "dentalNotes": "brief note on teeth/gums visible",
  "arch": "upper" | "lower" | "both" | "unknown",
  "isComposite": boolean,
  "confidence": 0.0-1.0
}

Filename hint: "${filename}"
If the image shows side-by-side or stacked before+after in one frame, set phase to "composite" and isComposite true.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: b64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error for ${filename}: ${res.status} ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
  } catch {
    parsed = { phase: 'unclear', procedure: 'Other', patientTraits: '', dentalNotes: text.slice(0, 200), confidence: 0.3 };
  }

  return {
    filename,
    ...parsed,
    analyzedAt: new Date().toISOString(),
  };
}

async function poolMap(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
      process.stdout.write(`\r  Analyzed ${Math.min(i + 1, items.length)}/${items.length}…`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  process.stdout.write('\n');
  return results;
}

function parseDscNumber(filename) {
  const m = filename.match(/^DSC_(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseIgGroupKey(filename) {
  const m = filename.match(/^IG-(.+)\.(jpe?g|png|webp)$/i);
  if (!m) return null;
  const stem = m[1].toLowerCase();
  if (stem.startsWith('soll')) return 'ig-soll';
  if (stem.includes('jack')) return 'ig-jack';
  if (stem.includes('lanc')) return 'ig-lanc';
  if (stem.includes('sink')) return 'ig-sink';
  if (stem.includes('ow')) return 'ig-ow';
  return `ig-${stem.split(/[\s.-]/)[0]}`;
}

function inferRole(analysis) {
  if (!analysis) return 'other';
  if (analysis.phase === 'before') return 'before';
  if (analysis.phase === 'after') return 'after';
  return 'other';
}

function roleSort(a, b) {
  const order = { before: 0, other: 1, after: 2 };
  return (order[a.role] ?? 1) - (order[b.role] ?? 1);
}

function clusterByFilename(filenames, byFile, maxGap = 5) {
  const clusters = [];

  // DSC numeric clusters (same shoot when numbers are close)
  const dsc = filenames
    .filter(f => !byFile[f]?.isComposite)
    .map(f => ({ f, n: parseDscNumber(f) }))
    .filter(x => x.n !== null)
    .sort((a, b) => a.n - b.n);

  let batch = [];
  for (const item of dsc) {
    if (!batch.length) {
      batch.push(item);
      continue;
    }
    const gap = item.n - batch[batch.length - 1].n;
    if (gap <= maxGap) batch.push(item);
    else {
      if (batch.length >= 2) {
        clusters.push({ files: batch.map(x => x.f), reason: `DSC ${batch[0].n}–${batch[batch.length - 1].n}`, kind: 'dsc' });
      }
      batch = [item];
    }
  }
  if (batch.length >= 2) {
    clusters.push({ files: batch.map(x => x.f), reason: `DSC ${batch[0].n}–${batch[batch.length - 1].n}`, kind: 'dsc' });
  }

  // IG name clusters — include composites (often multi-view same patient)
  const igGroups = new Map();
  for (const f of filenames) {
    const key = parseIgGroupKey(f);
    if (!key) continue;
    if (!igGroups.has(key)) igGroups.set(key, []);
    igGroups.get(key).push(f);
  }
  for (const [key, files] of igGroups) {
    if (files.length >= 2) {
      clusters.push({ files: files.sort(), reason: `Filename ${key}`, kind: 'ig' });
    }
  }

  return clusters;
}

function traitsConflict(a, b) {
  const ta = String(a?.patientTraits || '').toLowerCase();
  const tb = String(b?.patientTraits || '').toLowerCase();
  const aFem = ta.includes('female');
  const bFem = tb.includes('female');
  const aMale = /\bmale\b/.test(ta) && !aFem;
  const bMale = /\bmale\b/.test(tb) && !bFem;
  return (aFem && bMale) || (aMale && bFem);
}

function clusterAcceptable(files, byFile, kind = 'dsc') {
  if (files.length < 2) return false;
  if (kind === 'ig') return true;

  if (files.length === 2 && traitsConflict(byFile[files[0]], byFile[files[1]])) return false;

  const cohesion = clusterCohesion(files, byFile);
  if (files.length === 2 && cohesion < 0.22) return false;
  if (cohesion >= 0.18) return true;

  const nums = files.map(parseDscNumber).filter(n => n !== null);
  if (nums.length !== files.length) return cohesion >= 0.28;

  const span = Math.max(...nums) - Math.min(...nums);
  if (files.length >= 3 && span <= 5 && cohesion >= 0.1) return true;

  return false;
}

function clusterCohesion(files, byFile) {
  if (files.length < 2) return 0;
  let score = 0;
  let pairs = 0;
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      pairs++;
      score += traitSimilarity(byFile[files[i]]?.patientTraits, byFile[files[j]]?.patientTraits);
      const n1 = parseDscNumber(files[i]);
      const n2 = parseDscNumber(files[j]);
      if (n1 !== null && n2 !== null && Math.abs(n1 - n2) <= 5) score += 0.35;
    }
  }
  return score / pairs;
}

function splitClusterIfMixed(files, byFile) {
  if (files.length <= 2) return [files];

  const sim = clusterCohesion(files, byFile);
  if (sim >= 0.2) return [files];

  // peel lowest-cohesion file until cohesive or pair left
  const remaining = [...files];
  while (remaining.length > 2) {
    let worstIdx = -1;
    let worstScore = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const subset = remaining.filter((_, j) => j !== i);
      const s = clusterCohesion(subset, byFile);
      if (s < worstScore) { worstScore = s; worstIdx = i; }
    }
    if (worstIdx === -1 || worstScore >= 0.15) break;
    remaining.splice(worstIdx, 1);
  }
  return remaining.length >= 2 ? [remaining] : [];
}

function buildCaseFromFiles(files, byFile, reason, confidence, preserveOrder = false) {
  const images = files.map(f => ({
    file: f,
    role: inferRole(byFile[f]),
  }));
  if (!preserveOrder) images.sort(roleSort);

  const analyses = files.map(f => byFile[f]).filter(Boolean);
  const procedure = analyses.reduce((best, a) => (a.procedure !== 'Other' ? a : best), analyses[0])?.procedure ?? 'Other';
  const caption = analyses
    .map(a => a.procedureDetail)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ');

  return {
    images,
    before: images.find(i => i.role === 'before')?.file ?? images[0]?.file,
    after: images.find(i => i.role === 'after')?.file ?? images[images.length - 1]?.file,
    procedure,
    caption,
    confidence,
    reason,
    auto: true,
  };
}

function loadDefaultExport(dir) {
  const jsonPath = path.join(dir, '_default-export.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function loadManualGroups(dir) {
  const jsonPath = path.join(dir, '_manual-groups.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return Array.isArray(data.groups) ? data.groups : null;
  } catch {
    return null;
  }
}

function suggestCasesFromManual(analyses, groups) {
  const byFile = Object.fromEntries(analyses.map(a => [a.filename, a]));
  const used = new Set();
  const cases = [];

  for (const files of groups) {
    const available = files.filter(f => byFile[f] && !used.has(f));
    if (available.length < 2) continue;
    available.forEach(f => used.add(f));
    cases.push(buildCaseFromFiles(available, byFile, 'Manual grouping', 1, true));
  }

  const unpaired = analyses
    .filter(a => !used.has(a.filename))
    .map(a => ({
      filename: a.filename,
      procedure: a.procedure,
      phase: a.phase,
      isComposite: a.isComposite,
    }));

  const pairs = cases.map((c, i) => ({
    id: `case-${i + 1}`,
    before: c.before,
    after: c.after,
    images: c.images,
    procedure: c.procedure,
    caption: c.caption,
    confidence: c.confidence,
    reason: c.reason,
    auto: false,
  }));

  return { cases, pairs, unpaired };
}

function suggestCases(analyses) {
  const byFile = Object.fromEntries(analyses.map(a => [a.filename, a]));
  const used = new Set();
  const cases = [];

  const allFiles = analyses.map(a => a.filename);
  const filenameClusters = clusterByFilename(allFiles, byFile);

  filenameClusters.sort((a, b) => b.files.length - a.files.length);

  for (const cluster of filenameClusters) {
    const available = cluster.files.filter(f => !used.has(f) && (cluster.kind === 'ig' || !byFile[f]?.isComposite));
    if (available.length < 2) continue;
    if (!clusterAcceptable(available, byFile, cluster.kind)) continue;

    const splits = cluster.kind === 'ig' ? [available] : splitClusterIfMixed(available, byFile);
    for (const group of splits) {
      if (group.length < 2) continue;
      if (group.some(f => used.has(f))) continue;
      if (!clusterAcceptable(group, byFile, cluster.kind)) continue;

      const cohesion = clusterCohesion(group, byFile);
      const conf = Math.min(0.95, 0.5 + cohesion * 0.35 + (cluster.kind === 'ig' ? 0.2 : 0.1));

      cases.push(buildCaseFromFiles(group, byFile, cluster.reason, conf));
      group.forEach(f => used.add(f));
    }
  }

  const remaining = analyses.filter(a => !used.has(a.filename) && !a.isComposite);
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i];
    if (used.has(a.filename)) continue;

    let best = null;
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j];
      if (used.has(b.filename)) continue;

      if (traitsConflict(a, b)) continue;

      const sim = traitSimilarity(a.patientTraits, b.patientTraits);
      const n1 = parseDscNumber(a.filename);
      const n2 = parseDscNumber(b.filename);
      const dist = n1 !== null && n2 !== null ? Math.abs(n1 - n2) : 999;
      const prox = dist <= 20 ? Math.max(0, 1 - dist / 20) * 0.45 : 0;

      let beforeFile, afterFile;
      if (a.phase === 'before' && b.phase === 'after') { beforeFile = a.filename; afterFile = b.filename; }
      else if (b.phase === 'before' && a.phase === 'after') { beforeFile = b.filename; afterFile = a.filename; }
      else if (a.phase === 'unclear' || b.phase === 'unclear') {
        beforeFile = a.filename;
        afterFile = b.filename;
      } else continue;

      const score = sim * 0.55 + prox;
      const ok = (dist <= 15 && sim >= 0.18)
        || (dist <= 25 && sim >= 0.35)
        || (dist <= 8 && sim >= 0.22);
      if (!ok) continue;
      if (!best || score > best.score) {
        best = { beforeFile, afterFile, score, dist };
      }
    }

    if (best) {
      cases.push(buildCaseFromFiles(
        [best.beforeFile, best.afterFile],
        byFile,
        best.dist <= 20
          ? `DSC proximity (${parseDscNumber(best.beforeFile)} ↔ ${parseDscNumber(best.afterFile)})`
          : 'Similar patient traits (AI)',
        best.score,
      ));
      used.add(best.beforeFile);
      used.add(best.afterFile);
    }
  }

  const unpaired = analyses
    .filter(a => !used.has(a.filename))
    .map(a => ({
      filename: a.filename,
      procedure: a.procedure,
      phase: a.phase,
      isComposite: a.isComposite,
    }));

  // Legacy shape for before/after fields
  const pairs = cases.map((c, i) => ({
    id: `case-${i + 1}`,
    before: c.before,
    after: c.after,
    images: c.images,
    procedure: c.procedure,
    caption: c.caption,
    confidence: c.confidence,
    reason: c.reason,
    auto: true,
  }));

  return { cases, pairs, unpaired };
}

function traitSimilarity(a, b) {
  if (!a || !b) return 0;
  const ta = new Set(String(a).toLowerCase().split(/[\s,;/]+/).filter(w => w.length > 3));
  const tb = new Set(String(b).toLowerCase().split(/[\s,;/]+/).filter(w => w.length > 3));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

function buildReviewHtml(dir, analyses, pairing, defaultExport) {
  const data = {
    generatedAt: new Date().toISOString(),
    sourceDir: dir,
    procedures: PROCEDURES,
    analyses,
    defaultCases: defaultExport?.cases ?? null,
    defaultSandbox: defaultExport?.sandbox ?? [],
    manualGroups: pairing.manualGroups ?? null,
    suggestedCases: pairing.cases,
    suggestedPairs: pairing.pairs,
    unpaired: pairing.unpaired,
  };

  const htmlPath = path.join(dir, 'review.html');
  const jsonPath = path.join(dir, '_analysis.json');

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gallery Review — Before/After Pairing</title>
  <style>
    :root {
      --navy: #1B3A5C;
      --blue: #2E6DA4;
      --gold: #C9A84C;
      --light: #EBF2FA;
      --border: #E5E7EB;
      --mid: #4B5563;
      --sandbox-bg: #fff7ed;
      --sandbox-border: #fdba74;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #eef1f5; color: #111; padding-bottom: 140px; transition: padding-bottom .2s; }
    body.dock-hidden { padding-bottom: 0; }
    header {
      position: sticky; top: 0; z-index: 200;
      background: var(--navy); color: white; padding: .4rem .6rem;
      display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    header h1 { margin: 0; font-size: .9rem; font-weight: 700; white-space: nowrap; }
    .header-meta { font-size: .68rem; opacity: .85; font-weight: 500; margin-left: .5rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: .25rem; }
    button { border: none; border-radius: 4px; padding: .3rem .5rem; font-size: .72rem; font-weight: 600; cursor: pointer; background: white; color: var(--navy); }
    button.primary { background: var(--gold); color: #111; }
    button.secondary { background: var(--blue); color: white; }
    button.ghost { background: rgba(255,255,255,.15); color: white; }
    button.tiny { padding: .15rem .35rem; font-size: .6rem; border-radius: 2px; background: #f3f4f6; color: #374151; line-height: 1.2; }
    button.tiny:hover { background: #e5e7eb; }
    button.tiny.warn { background: #ffedd5; color: #9a3412; }
    button.icon { width: 1.35rem; height: 1.35rem; padding: 0; line-height: 1.35rem; text-align: center; background: #fee2e2; color: #991b1b; flex-shrink: 0; }
    main { max-width: 100%; margin: 0; padding: .35rem .4rem .5rem; }
    .help { display: none; }
    .stats { display: none; }
    .dup-banner {
      display: none; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
      padding: .35rem .5rem; font-size: .72rem; margin-bottom: .35rem;
    }
    .dup-banner.visible { display: block; }
    .date-banner {
      display: none; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e;
      padding: .35rem .5rem; font-size: .72rem; margin-bottom: .35rem;
    }
    .date-banner.visible { display: block; }
    .date-banner ul { margin: .25rem 0 0; padding-left: 1.1rem; }
    .date-banner li { margin: .15rem 0; }
    .date-banner a { color: #b45309; font-weight: 600; cursor: pointer; }
    section { margin-bottom: .35rem; }
    section > h2 { display: none; }
    .dock {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 150;
      background: white; border-top: 2px solid var(--border);
      box-shadow: 0 -4px 20px rgba(0,0,0,.08);
      max-height: 28vh; overflow: auto;
      transition: transform .2s ease;
    }
    body.dock-hidden .dock { transform: translateY(100%); pointer-events: none; }
    .dock-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 149;
      display: none; align-items: center; justify-content: space-between; gap: .5rem;
      background: var(--navy); color: white; padding: .35rem .75rem; font-size: .72rem;
      box-shadow: 0 -2px 10px rgba(0,0,0,.12);
    }
    body.dock-hidden .dock-bar { display: flex; }
    .dock-bar button { padding: .3rem .55rem; font-size: .72rem; }
    .dock-inner { max-width: 100%; margin: 0 auto; padding: .25rem .4rem .35rem; display: grid; grid-template-columns: 1fr 1fr; gap: .35rem; }
    .dock-inner h2 { font-size: .62rem; text-transform: uppercase; letter-spacing: .05em; color: var(--mid); margin: 0 0 .2rem; }
    body.sandbox-hidden .dock-inner { grid-template-columns: 1fr; }
    body.sandbox-hidden .sandbox-panel { display: none; }
    @media (max-width: 900px) { .dock-inner { grid-template-columns: 1fr; } body:not(.dock-hidden) { padding-bottom: 200px; } }
    .drop-zone {
      border-radius: 0; padding: .25rem; min-height: 56px;
      display: flex; flex-wrap: wrap; gap: .25rem; align-content: flex-start;
    }
    .drop-zone.drag-over { outline: 2px solid var(--blue); outline-offset: 1px; }
    #sandbox-zone { background: var(--sandbox-bg); border: 2px dashed var(--sandbox-border); }
    #sandbox-zone.drag-over { background: #ffedd5; outline-color: #ea580c; }
    #pool-zone { background: #f9fafb; border: 2px dashed var(--border); }
    .drop-zone-empty { width: 100%; text-align: center; color: #9ca3af; font-size: .65rem; padding: .35rem; }
    .tile {
      width: 100px; flex: 0 0 100px;
      border: 2px solid var(--border); border-radius: 0; overflow: hidden; background: white;
      cursor: grab; position: relative; user-select: none;
    }
    .tile:active { cursor: grabbing; }
    .tile.dragging { opacity: .45; }
    .tile.composite { border-color: var(--gold); }
    .tile.duplicate-warn { border-color: #dc2626; }
    .tile .img-wrap {
      width: 100%; height: 88px; background: #dde3ea;
      display: flex; align-items: center; justify-content: center; cursor: zoom-in;
    }
    .tile img { max-width: 100%; max-height: 88px; width: auto; height: auto; object-fit: contain; display: block; pointer-events: none; }
    .tile .fname {
      font-family: ui-monospace, Menlo, monospace; font-size: .52rem; line-height: 1.2;
      padding: .15rem .2rem; background: #111; color: #f3f4f6; word-break: break-all;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tile .fdate {
      font-size: .5rem; line-height: 1.15; padding: .1rem .2rem .15rem;
      background: #374151; color: #d1d5db; font-variant-numeric: tabular-nums;
    }
    .tile .fdate.missing { color: #9ca3af; font-style: italic; }
    .tile .fdate.warn { background: #7f1d1d; color: #fecaca; font-weight: 600; }
    .tile .role-badge {
      position: absolute; top: 2px; left: 2px; z-index: 2;
      font-size: .55rem; font-weight: 800; padding: .1rem .28rem; border: none; cursor: pointer;
      text-transform: uppercase; line-height: 1.1;
    }
    .tile[data-role="before"] { border-color: #ef4444; }
    .tile[data-role="before"] .role-badge { background: #fee2e2; color: #991b1b; }
    .tile[data-role="after"] { border-color: #22c55e; }
    .tile[data-role="after"] .role-badge { background: #dcfce7; color: #166534; }
    .tile[data-role="other"] .role-badge { background: #e5e7eb; color: #374151; }
    .tile .out-btn {
      position: absolute; top: 2px; right: 2px; z-index: 2;
      width: 1rem; height: 1rem; padding: 0; font-size: .75rem; line-height: 1rem;
      background: rgba(0,0,0,.55); color: white; border: none; cursor: pointer; display: none;
    }
    .tile:hover .out-btn { display: block; }
    .card { width: 72px; flex: 0 0 72px; }
    .card .img-wrap { height: 60px; }
    .card img { max-height: 60px; }
    .card .fname { font-size: .5rem; padding: .12rem .15rem; }
    .cases-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: .3rem;
    }
    .case {
      background: white; border: 1px solid #d1d5db; border-radius: 0; padding: .25rem;
    }
    .case.date-error { border-color: #f59e0b; box-shadow: inset 0 0 0 1px #fcd34d; }
    .case-warns {
      font-size: .58rem; color: #92400e; background: #fffbeb; border: 1px solid #fde68a;
      padding: .2rem .3rem; margin-bottom: .2rem; line-height: 1.35;
    }
    .case-warns .warn-line { display: block; }
    .case-warns .warn-line.error { color: #991b1b; font-weight: 600; }
    .case-timeline {
      font-size: .55rem; color: #6b7280; font-family: ui-monospace, monospace;
      margin-bottom: .2rem; line-height: 1.3; word-break: break-all;
    }
    .case-meta {
      display: flex; gap: .2rem; align-items: center; margin-bottom: .25rem;
      min-height: 1.4rem;
    }
    .case-num { font-size: .65rem; font-weight: 800; color: var(--navy); min-width: 1.25rem; }
    .case-meta select, .case-meta input {
      font: inherit; border: 1px solid var(--border); border-radius: 0; padding: .12rem .25rem;
      font-size: .62rem; background: #fafafa; min-width: 0;
    }
    .case-meta select { max-width: 6.5rem; flex-shrink: 0; }
    .case-meta input { flex: 1; }
    .case-images {
      display: flex; flex-wrap: wrap; gap: .25rem; align-content: flex-start;
      min-height: 92px; border: 1px dashed #cbd5e1; border-radius: 0;
      padding: .2rem; background: #f4f6f8;
    }
    .case-images.drag-over { border-color: var(--blue); background: var(--light); }
    .case-images-empty { width: 100%; text-align: center; color: #9ca3af; font-size: .62rem; padding: .75rem .25rem; }
    .case-img-card { width: 100px; flex: 0 0 100px; }
    .case-img-card .img-wrap { height: 88px; }
    .case-img-card img { max-height: 88px; }
    #lightbox {
      position: fixed; inset: 0; z-index: 500; background: rgba(0,0,0,.92);
      display: none; flex-direction: column; align-items: center; justify-content: center;
      padding: 1rem;
    }
    #lightbox.open { display: flex; }
    #lightbox img {
      max-width: min(96vw, 1400px); max-height: 82vh;
      width: auto; height: auto; object-fit: contain;
      border-radius: 0; box-shadow: 0 8px 40px rgba(0,0,0,.5);
    }
    #lightbox .lb-name {
      color: #f9fafb; font-family: ui-monospace, monospace; font-size: .85rem;
      margin-top: .75rem; text-align: center; word-break: break-all; max-width: 90vw;
    }
    #lightbox .lb-close {
      position: absolute; top: .75rem; right: .75rem;
      background: rgba(255,255,255,.15); color: white; font-size: 1.25rem;
      width: 2.25rem; height: 2.25rem; border-radius: 999px; line-height: 1; z-index: 2;
    }
    #lightbox .lb-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(255,255,255,.12); color: white; border: none;
      width: 2.5rem; height: 3.5rem; font-size: 2rem; line-height: 1; cursor: pointer; z-index: 2;
      display: none;
    }
    #lightbox .lb-nav:hover { background: rgba(255,255,255,.22); }
    #lightbox .lb-nav.visible { display: block; }
    #lightbox .lb-prev { left: .5rem; }
    #lightbox .lb-next { right: .5rem; }
    #lightbox .lb-meta {
      color: #9ca3af; font-size: .72rem; margin-top: .35rem; text-align: center;
    }
    .export-box {
      background: #111; color: #e5e7eb; border-radius: 8px; padding: .65rem;
      font-family: ui-monospace, monospace; font-size: .68rem; white-space: pre-wrap; max-height: 200px; overflow: auto;
    }
    details summary { cursor: pointer; font-size: .78rem; color: var(--mid); margin-bottom: .35rem; }
  </style>
</head>
<body>
  <header>
    <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:.25rem">
      <h1>Gallery Review</h1>
      <span class="header-meta" id="header-meta"></span>
    </div>
    <div class="toolbar">
      <button class="ghost" id="btn-toggle-sandbox" title="Toggle sandbox panel">Sandbox</button>
      <button class="ghost" id="btn-toggle-dock" title="Toggle bottom dock">Dock</button>
      <button class="ghost" id="btn-add-case">+</button>
      <button class="ghost" id="btn-reset">↺</button>
      <button class="secondary" id="btn-export">JSON</button>
      <button class="primary" id="btn-download">↓</button>
    </div>
  </header>
  <main>
    <div class="dup-banner" id="dup-banner"></div>
    <div class="date-banner" id="date-banner"></div>

    <section>
      <div class="cases-grid" id="cases"></div>
    </section>

    <details style="margin-top:.5rem">
      <summary style="font-size:.68rem;color:var(--mid)">Export preview</summary>
      <div class="export-box" id="export-preview"></div>
    </details>
  </main>

  <div class="dock-bar" id="dock-bar">
    <span id="dock-bar-summary">Dock hidden</span>
    <button type="button" class="secondary" id="btn-show-dock">Show dock</button>
  </div>

  <div class="dock" id="dock">
    <div class="dock-inner">
      <div class="sandbox-panel">
        <h2>Sb <span class="count" id="sandbox-count">0</span></h2>
        <div class="drop-zone" id="sandbox-zone" data-drop="sandbox"></div>
      </div>
      <div>
        <h2>Free <span class="count" id="pool-count">0</span></h2>
        <div class="drop-zone" id="pool-zone" data-drop="pool"></div>
      </div>
    </div>
  </div>

  <div id="lightbox" role="dialog" aria-modal="true" aria-label="Full image preview">
    <button type="button" class="lb-close" id="lb-close" aria-label="Close">&times;</button>
    <button type="button" class="lb-nav lb-prev" id="lb-prev" aria-label="Previous image in case">&lsaquo;</button>
    <button type="button" class="lb-nav lb-next" id="lb-next" aria-label="Next image in case">&rsaquo;</button>
    <img id="lb-img" src="" alt="" />
    <div class="lb-name" id="lb-name"></div>
    <div class="lb-meta" id="lb-meta"></div>
  </div>

  <script>
    const INITIAL = ${JSON.stringify(data)};
    const STORAGE_KEY = 'hb-gallery-review-v10';
    const ROLES = ['before', 'after', 'other'];
    const ROLE_LABEL = { before: 'B', after: 'A', other: '·' };
    const ROLE_CYCLE = { before: 'after', after: 'other', other: 'before' };

    const analysesByFile = Object.fromEntries(INITIAL.analyses.map(a => [a.filename, a]));
    const procedures = INITIAL.procedures;
    let dragFilename = null;
    let dragStart = null;

    let state;
    let dedupeNotice = null;

    let lbContext = null;

    function openLightbox(filename, caseId) {
      let files = [filename];
      let index = 0;
      let caseLabel = '';

      if (caseId) {
        const c = state.cases.find(x => x.id === caseId);
        if (c?.images?.length) {
          files = c.images.map(img => img.file);
          index = Math.max(0, files.indexOf(filename));
          caseLabel = c.patientLabel || '';
        }
      }

      lbContext = { files, index, caseLabel, caseId: caseId || null };
      showLightboxImage();
      document.getElementById('lightbox').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function showLightboxImage() {
      if (!lbContext) return;
      const c = state.cases.find(x => x.id === lbContext.caseId);
      const imgEntry = c?.images?.[lbContext.index];
      const file = lbContext.files[lbContext.index];
      const role = imgEntry?.role;
      const img = document.getElementById('lb-img');
      img.src = './' + encodeURIComponent(file);
      img.alt = file;
      document.getElementById('lb-name').textContent = file;
      const roleText = role ? ROLE_LABEL[role] : '';
      const pos = lbContext.files.length > 1
        ? (roleText ? roleText + ' · ' : '') + (lbContext.index + 1) + ' / ' + lbContext.files.length
        : roleText;
      const multi = lbContext.files.length > 1;
      const parts = [];
      if (lbContext.caseLabel) parts.push(lbContext.caseLabel);
      if (pos) parts.push(pos);
      const takenAt = getTakenAt(file);
      if (takenAt) parts.push('shot ' + formatTakenAt(takenAt));
      if (multi) parts.push('← → to browse');
      document.getElementById('lb-meta').textContent = parts.join(' · ');
      document.getElementById('lb-prev').classList.toggle('visible', multi);
      document.getElementById('lb-next').classList.toggle('visible', multi);
    }

    function lbNav(delta) {
      if (!lbContext || lbContext.files.length < 2) return;
      lbContext.index = (lbContext.index + delta + lbContext.files.length) % lbContext.files.length;
      showLightboxImage();
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('open');
      document.getElementById('lb-img').src = '';
      document.getElementById('lb-meta').textContent = '';
      document.getElementById('lb-prev').classList.remove('visible');
      document.getElementById('lb-next').classList.remove('visible');
      lbContext = null;
      document.body.style.overflow = '';
    }

    document.getElementById('lb-close').addEventListener('click', closeLightbox);
    document.getElementById('lb-prev').addEventListener('click', e => { e.stopPropagation(); lbNav(-1); });
    document.getElementById('lb-next').addEventListener('click', e => { e.stopPropagation(); lbNav(1); });
    document.getElementById('lightbox').addEventListener('click', e => {
      if (e.target.id === 'lightbox') closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (!document.getElementById('lightbox').classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') { e.preventDefault(); lbNav(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lbNav(1); }
    });

    const UI_KEY = 'hb-gallery-review-ui';
    let ui = { dockHidden: true, sandboxHidden: false };
    try {
      Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || '{}'));
    } catch {}

    function applyUiPrefs() {
      document.body.classList.toggle('dock-hidden', ui.dockHidden);
      document.body.classList.toggle('sandbox-hidden', ui.sandboxHidden);
      document.getElementById('btn-toggle-dock').textContent = ui.dockHidden ? 'Dock' : 'Dock ✓';
      document.getElementById('btn-toggle-sandbox').textContent = ui.sandboxHidden ? 'Sandbox' : 'Sandbox ✓';
      document.getElementById('dock-bar-summary').textContent =
        'Sandbox: ' + state.sandbox.length + ' · Unassigned: ' + state.pool.length;
    }

    function saveUiPrefs() {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
      applyUiPrefs();
    }

    document.getElementById('btn-toggle-dock').addEventListener('click', () => {
      ui.dockHidden = !ui.dockHidden;
      saveUiPrefs();
    });
    document.getElementById('btn-show-dock').addEventListener('click', () => {
      ui.dockHidden = false;
      saveUiPrefs();
    });
    document.getElementById('btn-toggle-sandbox').addEventListener('click', () => {
      ui.sandboxHidden = !ui.sandboxHidden;
      saveUiPrefs();
    });

    function normalizeCase(c) {
      if (Array.isArray(c.images) && c.images.length && typeof c.images[0] === 'object' && c.images[0].file) {
        return { ...c, images: c.images.filter(img => img.file) };
      }
      const images = [];
      if (c.before) images.push({ file: c.before, role: 'before' });
      if (c.after) images.push({ file: c.after, role: 'after' });
      if (Array.isArray(c.images)) {
        c.images.forEach((file, i) => {
          if (typeof file === 'string' && !images.some(x => x.file === file)) {
            images.push({ file, role: defaultRole(file) });
          }
        });
      }
      const { before, after, ...rest } = c;
      return { ...rest, images };
    }

    function defaultRole(filename) {
      const a = analysesByFile[filename];
      if (a?.phase === 'before') return 'before';
      if (a?.phase === 'after') return 'after';
      return 'other';
    }

    function dedupeState() {
      const seen = new Set();
      const removed = [];

      function take(filename) {
        if (!filename || seen.has(filename)) {
          if (filename) removed.push(filename);
          return false;
        }
        seen.add(filename);
        return true;
      }

      for (const c of state.cases) {
        const kept = [];
        for (const img of c.images) {
          if (take(img.file)) kept.push(img);
        }
        c.images = kept;
      }

      state.pool = state.pool.filter(f => take(f));
      const sandboxClean = [];
      for (const f of state.sandbox) {
        if (take(f)) sandboxClean.push(f);
      }
      state.sandbox = sandboxClean;

      return [...new Set(removed)];
    }

    function findFilePlacement(filename) {
      for (const c of state.cases) {
        if (c.images.some(img => img.file === filename)) return c.patientLabel || c.id;
      }
      if (state.sandbox.includes(filename)) return 'sandbox';
      if (state.pool.includes(filename)) return 'unassigned';
      return null;
    }

    function loadState() {
      try {
        for (const key of [STORAGE_KEY, 'hb-gallery-review-v5', 'hb-gallery-review-v4', 'hb-gallery-review-v3', 'hb-gallery-review-v2', 'hb-gallery-review-v1']) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const s = JSON.parse(raw);
          if (!Array.isArray(s.sandbox)) s.sandbox = [];
          if (!Array.isArray(s.pool)) s.pool = [];
          s.cases = (s.cases || []).map(normalizeCase);
          state = s;
          const removed = dedupeState();
          if (removed.length) dedupeNotice = removed;
          return state;
        }
      } catch {}
      state = buildFromSuggestions();
      return state;
    }

    function buildFromSuggestions() {
      const used = new Set();
      const cases = [];

      if (INITIAL.defaultCases?.length) {
        INITIAL.defaultCases.forEach((c, i) => {
          const images = (c.images || [])
            .filter(img => img.filename && analysesByFile[img.filename] && !used.has(img.filename))
            .map(img => ({ file: img.filename, role: img.role || defaultRole(img.filename) }));
          images.forEach(img => used.add(img.file));
          cases.push({
            id: 'case-' + (i + 1),
            procedure: c.procedure || 'Other',
            caption: c.caption || '',
            patientLabel: c.patientLabel || 'Case ' + (cases.length + 1),
            images,
          });
        });
        const pool = INITIAL.analyses.map(a => a.filename).filter(f => !used.has(f));
        return {
          cases,
          pool,
          sandbox: INITIAL.defaultSandbox || [],
          updatedAt: new Date().toISOString(),
        };
      }

      if (INITIAL.manualGroups?.length) {
        INITIAL.manualGroups.forEach((files, i) => {
          const images = files
            .filter(f => analysesByFile[f] && !used.has(f))
            .map(f => ({ file: f, role: defaultRole(f) }));
          if (images.length < 2) return;
          images.forEach(img => used.add(img.file));
          const groupAnalyses = images.map(img => analysesByFile[img.file]);
          const procedure = groupAnalyses.find(a => a.procedure !== 'Other')?.procedure ?? 'Other';
          cases.push({
            id: 'case-' + (i + 1),
            procedure,
            caption: '',
            patientLabel: 'Case ' + (cases.length + 1),
            images,
          });
        });
      } else {
        const source = INITIAL.suggestedCases?.length ? INITIAL.suggestedCases : INITIAL.suggestedPairs;
        source.forEach((item, i) => {
          let images = [];
          if (Array.isArray(item.images) && item.images.length >= 2) {
            images = item.images.map(img =>
              typeof img === 'string' ? { file: img, role: defaultRole(img) } : { file: img.file, role: img.role || defaultRole(img.file) }
            );
          } else if (item.before || item.after) {
            if (item.before) images.push({ file: item.before, role: 'before' });
            if (item.after) images.push({ file: item.after, role: 'after' });
          }
          images = images.filter(img => img.file && !used.has(img.file));
          if (images.length < 2) return;
          images.forEach(img => used.add(img.file));
          cases.push({
            id: 'case-' + (i + 1),
            procedure: item.procedure || 'Other',
            caption: item.caption || '',
            patientLabel: 'Case ' + (cases.length + 1),
            images,
          });
        });
      }

      const pool = INITIAL.analyses.map(a => a.filename).filter(f => !used.has(f));
      return { cases, pool, sandbox: [], updatedAt: new Date().toISOString() };
    }

    function persist() {
      dedupeState();
      state.updatedAt = new Date().toISOString();
      const save = { ...state };
      delete save._dedupeRemoved;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      renderExportPreview();
      renderStats();
    }

    function allFilesInState() {
      const set = new Set();
      state.cases.forEach(c => c.images.forEach(img => set.add(img.file)));
      state.pool.forEach(f => set.add(f));
      state.sandbox.forEach(f => set.add(f));
      return set;
    }

    function renderStats() {
      const grouped = state.cases.filter(c => c.images.length >= 2).length;
      const imgsInCases = state.cases.reduce((n, c) => n + c.images.length, 0);
      document.getElementById('header-meta').textContent =
        state.cases.length + ' cases · ' + grouped + ' grouped · ' +
        imgsInCases + ' imgs · ' + state.sandbox.length + ' sb · ' + state.pool.length + ' free · ' +
        state.cases.filter(c => auditCaseDates(c).some(w => w.level === 'error')).length + ' date ⚠';
      document.getElementById('sandbox-count').textContent = state.sandbox.length;
      document.getElementById('pool-count').textContent = state.pool.length;

      const banner = document.getElementById('dup-banner');
      if (dedupeNotice?.length) {
        banner.className = 'dup-banner visible';
        banner.textContent = 'Removed ' + dedupeNotice.length + ' duplicate placement(s): ' +
          dedupeNotice.slice(0, 8).join(', ') +
          (dedupeNotice.length > 8 ? '…' : '') + ' → moved to sandbox.';
        dedupeNotice = null;
      } else if (!banner.textContent) {
        banner.className = 'dup-banner';
      }
      applyUiPrefs();
    }

    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

    function getTakenAt(filename) {
      return analysesByFile[filename]?.takenAt ?? null;
    }

    function formatTakenAt(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatTakenAtShort(iso) {
      if (!iso) return '—';
      return iso.slice(0, 10);
    }

    function shortFile(filename) {
      return String(filename).replace(/\\.(jpe?g|png|webp)$/i, '');
    }

    function auditCaseDates(c) {
      const warnings = [];
      const dated = c.images
        .map(img => ({
          file: img.file,
          role: img.role,
          takenAt: getTakenAt(img.file),
          ts: getTakenAt(img.file) ? new Date(getTakenAt(img.file)).getTime() : null,
        }))
        .filter(img => img.ts != null)
        .sort((a, b) => a.ts - b.ts);

      if (c.images.length < 2) return warnings;

      if (dated.length === 0) {
        warnings.push({ level: 'info', msg: 'No EXIF capture dates on any image' });
        return warnings;
      }

      const befores = dated.filter(i => i.role === 'before');
      const afters = dated.filter(i => i.role === 'after');

      for (const b of befores) {
        for (const a of afters) {
          if (b.ts > a.ts) {
            warnings.push({
              level: 'error',
              msg: shortFile(b.file) + ' marked before (' + formatTakenAtShort(b.takenAt) + ') but newer than ' +
                shortFile(a.file) + ' marked after (' + formatTakenAtShort(a.takenAt) + ')',
            });
          }
        }
      }

      for (let i = 0; i < dated.length - 1; i++) {
        const cur = dated[i];
        const next = dated[i + 1];
        if (cur.role === 'after' && next.role === 'before') {
          warnings.push({
            level: 'error',
            msg: 'Timeline runs after→before: ' + shortFile(cur.file) + ' (' + formatTakenAtShort(cur.takenAt) + ') then ' +
              shortFile(next.file) + ' (' + formatTakenAtShort(next.takenAt) + ')',
          });
        }
      }

      for (const img of c.images) {
        const a = analysesByFile[img.file];
        if (!img.takenAt || !a?.phase || a.phase === 'unclear' || a.phase === 'composite') continue;
        const expectedRole = a.phase === 'before' ? 'before' : a.phase === 'after' ? 'after' : null;
        if (expectedRole && img.role !== expectedRole && img.role !== 'other') {
          warnings.push({
            level: 'warn',
            msg: shortFile(img.file) + ': role is ' + img.role + ' but AI says ' + a.phase + ' (' + formatTakenAtShort(img.takenAt) + ')',
          });
        }
      }

      if (dated.length >= 2) {
        const spanDays = (dated[dated.length - 1].ts - dated[0].ts) / 86400000;
        if (spanDays > 730) {
          warnings.push({
            level: 'warn',
            msg: 'Photos span ' + Math.round(spanDays) + ' days — confirm same patient',
          });
        }
      }

      if (dated.length === 1 && c.images.length >= 2) {
        warnings.push({ level: 'info', msg: 'Only 1 of ' + c.images.length + ' images has EXIF date' });
      }

      return warnings;
    }

    function caseTimeline(c) {
      return c.images
        .map(img => ({
          file: img.file,
          role: img.role,
          takenAt: getTakenAt(img.file),
          ts: getTakenAt(img.file) ? new Date(getTakenAt(img.file)).getTime() : null,
        }))
        .sort((a, b) => {
          if (a.ts != null && b.ts != null) return a.ts - b.ts;
          if (a.ts != null) return -1;
          if (b.ts != null) return 1;
          return a.file.localeCompare(b.file);
        })
        .map(img => ROLE_LABEL[img.role] + ' ' + shortFile(img.file) + (img.takenAt ? ' ' + formatTakenAtShort(img.takenAt) : ' —'))
        .join(' · ');
    }

    function dateLineHtml(filename, warn) {
      const takenAt = getTakenAt(filename);
      const cls = 'fdate' + (warn ? ' warn' : '') + (takenAt ? '' : ' missing');
      const text = takenAt ? formatTakenAtShort(takenAt) : 'no date';
      return '<div class="' + cls + '" title="EXIF capture: ' + esc(takenAt || 'none') + '">' + esc(text) + '</div>';
    }

    function renderDateBanner() {
      const issues = [];
      state.cases.forEach((c, i) => {
        const warnings = auditCaseDates(c);
        const errors = warnings.filter(w => w.level === 'error');
        if (errors.length) issues.push({ index: i, caseId: c.id, label: c.patientLabel || ('Case ' + (i + 1)), errors });
      });

      const banner = document.getElementById('date-banner');
      if (!issues.length) {
        banner.className = 'date-banner';
        banner.innerHTML = '';
        return;
      }

      banner.className = 'date-banner visible';
      banner.innerHTML =
        '<strong>' + issues.length + ' case(s) with date/role conflicts</strong> (EXIF capture dates vs before/after roles):' +
        '<ul>' + issues.map(item =>
          '<li><a data-scroll-case="' + esc(item.caseId) + '">#' + (item.index + 1) + ' ' + esc(item.label) + '</a>: ' +
          esc(item.errors.map(e => e.msg).join('; ')) + '</li>'
        ).join('') + '</ul>';

      banner.querySelectorAll('[data-scroll-case]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          const el = document.querySelector('[data-case-id="' + a.dataset.scrollCase + '"]');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }

    function makeCard(filename) {
      const a = analysesByFile[filename] || {};
      const el = document.createElement('div');
      el.className = 'tile card' + (a.isComposite ? ' composite' : '');
      el.draggable = true;
      el.dataset.filename = filename;
      el.innerHTML =
        '<div class="img-wrap" data-view><img src="./' + encodeURIComponent(filename) + '" alt="' + esc(filename) + '" loading="lazy" draggable="false" /></div>' +
        '<div class="fname" title="' + esc(filename) + '">' + esc(filename) + '</div>' +
        dateLineHtml(filename, false);

      bindTileDrag(el, filename, null);
      el.querySelector('[data-view]').addEventListener('dblclick', e => { e.stopPropagation(); openLightbox(filename); });
      el.addEventListener('click', e => {
        if (!dragStart) return;
        const dx = Math.abs(e.clientX - dragStart.x);
        const dy = Math.abs(e.clientY - dragStart.y);
        if (dx < 6 && dy < 6) openLightbox(filename);
        dragStart = null;
      });
      return el;
    }

    function bindTileDrag(el, filename, caseId) {
      el.addEventListener('mousedown', e => {
        if (!e.target.closest('button')) dragStart = { x: e.clientX, y: e.clientY };
      });
      el.addEventListener('dragstart', e => {
        dragFilename = filename;
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', filename);
        e.dataTransfer.effectAllowed = 'move';
        if (caseId) e.dataTransfer.setData('application/x-from-case', caseId);
      });
      el.addEventListener('dragend', () => {
        dragFilename = null;
        dragStart = null;
        el.classList.remove('dragging');
      });
    }

    function moveTo(filename, dest) {
      removeFileFromState(filename);
      if (dest === 'sandbox') state.sandbox.push(filename);
      else if (dest === 'pool') state.pool.push(filename);
      render();
      persist();
    }

    function assignFile(filename, target) {
      removeFileFromState(filename);
      if (target.type === 'pool') {
        state.pool.push(filename);
      } else if (target.type === 'sandbox') {
        state.sandbox.push(filename);
      } else if (target.type === 'case') {
        const c = state.cases.find(x => x.id === target.caseId);
        if (!c) return;
        c.images.push({ file: filename, role: defaultRole(filename) });
      }
    }

    function setupDropZone(el, type) {
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', e => {
        if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
      });
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        handleDrop(e, { type });
      });
    }

    function renderDropZone(el, files, emptyLabel) {
      el.innerHTML = '';
      if (!files.length) {
        el.innerHTML = '<div class="drop-zone-empty">' + emptyLabel + '</div>';
        return;
      }
      files.forEach(f => el.appendChild(makeCard(f)));
    }

    function renderCaseImageCard(caseId, img, dateWarnFiles) {
      const el = document.createElement('div');
      el.className = 'tile case-img-card' + (analysesByFile[img.file]?.isComposite ? ' composite' : '');
      el.draggable = true;
      el.dataset.filename = img.file;
      el.dataset.role = img.role;
      const dateWarn = dateWarnFiles?.has(img.file);
      el.innerHTML =
        '<button type="button" class="role-badge" data-role-btn title="Click to cycle role">' + ROLE_LABEL[img.role] + '</button>' +
        '<button type="button" class="out-btn" data-rm title="Remove">×</button>' +
        '<div class="img-wrap" data-view><img src="./' + encodeURIComponent(img.file) + '" alt="' + esc(img.file) + '" loading="lazy" draggable="false" /></div>' +
        '<div class="fname" title="' + esc(img.file) + '">' + esc(img.file) + '</div>' +
        dateLineHtml(img.file, dateWarn);

      el.querySelector('[data-role-btn]').addEventListener('click', e => {
        e.stopPropagation();
        img.role = ROLE_CYCLE[img.role] || 'other';
        el.dataset.role = img.role;
        e.target.textContent = ROLE_LABEL[img.role];
        render(); persist();
      });
      el.querySelector('[data-rm]').addEventListener('click', e => {
        e.stopPropagation();
        const c = state.cases.find(x => x.id === caseId);
        if (!c) return;
        c.images = c.images.filter(x => x.file !== img.file);
        state.sandbox.push(img.file);
        render(); persist();
      });
      bindTileDrag(el, img.file, caseId);
      el.querySelector('[data-view]').addEventListener('dblclick', e => { e.stopPropagation(); openLightbox(img.file, caseId); });
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        if (!dragStart) return;
        const dx = Math.abs(e.clientX - dragStart.x);
        const dy = Math.abs(e.clientY - dragStart.y);
        if (dx < 6 && dy < 6) openLightbox(img.file, caseId);
        dragStart = null;
      });
      return el;
    }

    function renderCase(c, index) {
      const warnings = auditCaseDates(c);
      const errors = warnings.filter(w => w.level === 'error');
      const dateWarnFiles = new Set();
      if (errors.length) {
        const befores = c.images.filter(i => i.role === 'before' && getTakenAt(i.file));
        const afters = c.images.filter(i => i.role === 'after' && getTakenAt(i.file));
        for (const b of befores) {
          for (const a of afters) {
            if (new Date(getTakenAt(b.file)) > new Date(getTakenAt(a.file))) {
              dateWarnFiles.add(b.file);
              dateWarnFiles.add(a.file);
            }
          }
        }
      }

      const wrap = document.createElement('div');
      wrap.className = 'case' + (errors.length ? ' date-error' : '');
      wrap.dataset.caseId = c.id;

      let warnHtml = '';
      if (warnings.length) {
        warnHtml = '<div class="case-warns">' + warnings.map(w =>
          '<span class="warn-line ' + w.level + '">' + esc(w.msg) + '</span>'
        ).join('') + '</div>';
      }
      const timeline = c.images.length ? '<div class="case-timeline" title="Sorted by EXIF date">' + esc(caseTimeline(c)) + '</div>' : '';

      wrap.innerHTML =
        '<div class="case-meta">' +
          '<span class="case-num">' + (index + 1) + '</span>' +
          '<select data-field="procedure" title="Procedure">' +
            procedures.map(p => '<option' + (p === c.procedure ? ' selected' : '') + '>' + esc(p) + '</option>').join('') +
          '</select>' +
          '<input data-field="caption" value="' + esc(c.caption) + '" placeholder="Caption" title="Caption" />' +
          '<button type="button" class="tiny" data-action="merge" title="Merge case">⇣</button>' +
          '<button type="button" class="icon" data-action="delete" title="Delete case">×</button>' +
        '</div>' +
        warnHtml +
        timeline +
        '<div class="case-images" data-case-drop="' + c.id + '"></div>';

      const zone = wrap.querySelector('.case-images');
      if (!c.images.length) {
        zone.innerHTML = '<div class="case-images-empty">drop images</div>';
      } else {
        c.images.forEach(img => zone.appendChild(renderCaseImageCard(c.id, img, dateWarnFiles)));
      }

      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        handleDrop(e, { type: 'case', caseId: c.id });
      });

      wrap.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => { c[el.dataset.field] = el.value; persist(); });
      });
      wrap.querySelector('[data-action="delete"]').addEventListener('click', () => {
        c.images.forEach(img => state.sandbox.push(img.file));
        state.cases = state.cases.filter(x => x.id !== c.id);
        render(); persist();
      });
      wrap.querySelector('[data-action="merge"]').addEventListener('click', () => {
        const others = state.cases.filter(x => x.id !== c.id);
        if (!others.length) { alert('No other cases to merge.'); return; }
        const labels = others.map((x, i) => (i + 1) + ': ' + x.patientLabel + ' (' + x.images.length + ' imgs)').join('\\n');
        const pick = prompt('Merge which case into #' + (index + 1) + '? Enter number:\\n' + labels);
        const n = parseInt(pick, 10);
        if (!n || n < 1 || n > others.length) return;
        const src = others[n - 1];
        src.images.forEach(img => {
          if (c.images.some(x => x.file === img.file)) return;
          if (findFilePlacement(img.file) && !c.images.some(x => x.file === img.file)) return;
          c.images.push(img);
        });
        state.cases = state.cases.filter(x => x.id !== src.id);
        dedupeState();
        render(); persist();
      });

      return wrap;
    }

    function removeFileFromState(filename) {
      for (const c of state.cases) {
        c.images = c.images.filter(img => img.file !== filename);
      }
      state.pool = state.pool.filter(f => f !== filename);
      state.sandbox = state.sandbox.filter(f => f !== filename);
    }

    function handleDrop(e, target) {
      const filename = e.dataTransfer.getData('text/plain');
      if (!filename) return;
      assignFile(filename, target);
      render();
      persist();
    }

    function render() {
      const casesEl = document.getElementById('cases');
      casesEl.innerHTML = '';
      state.cases.forEach((c, i) => casesEl.appendChild(renderCase(c, i)));

      renderDropZone(document.getElementById('sandbox-zone'), state.sandbox, 'sandbox');
      renderDropZone(document.getElementById('pool-zone'), state.pool, 'unassigned');
      renderDateBanner();
    }

    function buildExport() {
      dedupeState();
      return {
        exportedAt: new Date().toISOString(),
        sourceDir: INITIAL.sourceDir,
        cases: state.cases.map((c, i) => {
          const before = c.images.find(img => img.role === 'before')?.file ?? null;
          const after = c.images.find(img => img.role === 'after')?.file ?? null;
          return {
            order: i + 1,
            patientLabel: c.patientLabel,
            procedure: c.procedure,
            caption: c.caption,
            images: c.images.map(img => ({
              filename: img.file,
              role: img.role,
              phase: analysesByFile[img.file]?.phase,
            })),
            before,
            after,
            alt: c.caption || (c.procedure + ' patient result'),
          };
        }),
        sandbox: state.sandbox.map(filename => {
          const a = analysesByFile[filename] || {};
          return { filename, procedure: a.procedure, phase: a.phase, isComposite: a.isComposite };
        }),
        unassigned: state.pool.map(filename => {
          const a = analysesByFile[filename] || {};
          return { filename, procedure: a.procedure, phase: a.phase, isComposite: a.isComposite };
        }),
        analyses: INITIAL.analyses,
      };
    }

    function renderExportPreview() {
      document.getElementById('export-preview').textContent = JSON.stringify(buildExport(), null, 2);
    }

    document.getElementById('btn-add-case').addEventListener('click', () => {
      state.cases.push({
        id: 'case-' + Date.now(),
        patientLabel: 'Case ' + (state.cases.length + 1),
        procedure: 'Other',
        caption: '',
        images: [],
      });
      render(); persist();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Reset to saved groupings? Clears sandbox and all edits.')) {
        localStorage.removeItem(STORAGE_KEY);
        state = buildFromSuggestions();
        render(); persist();
      }
    });

    document.getElementById('btn-export').addEventListener('click', async () => {
      const json = JSON.stringify(buildExport(), null, 2);
      try {
        await navigator.clipboard.writeText(json);
        alert('Copied to clipboard.');
      } catch {
        alert('Copy from export preview below.');
      }
    });

    document.getElementById('btn-download').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gallery-export-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
    });

    setupDropZone(document.getElementById('sandbox-zone'), 'sandbox');
    setupDropZone(document.getElementById('pool-zone'), 'pool');

    state = loadState();
    if (dedupeNotice?.length) {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    render();
    renderStats();
    renderExportPreview();
    applyUiPrefs();
  </script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html);
  return { htmlPath, jsonPath };
}

async function main() {
  const opts = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !opts.skipAnalysis) {
    console.error('Missing GEMINI_API_KEY in .env');
    process.exit(1);
  }

  if (!fs.existsSync(opts.dir)) {
    console.error('Directory not found:', opts.dir);
    process.exit(1);
  }

  const filenames = listImages(opts.dir);
  console.log(`Found ${filenames.length} images in ${opts.dir}`);

  const jsonPath = path.join(opts.dir, '_analysis.json');
  const cacheDir = path.join(opts.dir, '_thumbs');
  let analyses;

  if (opts.skipAnalysis && fs.existsSync(jsonPath)) {
    const cached = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    analyses = cached.analyses;
    console.log('Loaded cached analysis.');
  } else if (!opts.force && fs.existsSync(jsonPath)) {
    const cached = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const cachedFiles = new Set(cached.analyses?.map(a => a.filename) ?? []);
    const missing = filenames.filter(f => !cachedFiles.has(f));
    if (missing.length === 0) {
      analyses = cached.analyses;
      console.log('Using existing analysis (run with --force to re-analyze).');
    } else {
      console.log(`Re-analyzing ${missing.length} new images…`);
      const newAnalyses = await poolMap(missing, CONCURRENCY, async (filename) => {
        const thumb = ensureThumb(opts.dir, filename, cacheDir);
        return analyzeImage(apiKey, thumb, filename);
      });
      analyses = [...cached.analyses, ...newAnalyses];
    }
  } else {
    console.log(`Analyzing with ${MODEL}…`);
    analyses = await poolMap(filenames, CONCURRENCY, async (filename) => {
      const thumb = ensureThumb(opts.dir, filename, cacheDir);
      return analyzeImage(apiKey, thumb, filename);
    });
  }

  analyses = enrichAnalysesWithExif(opts.dir, analyses);
  const dated = analyses.filter(a => a.takenAt).length;
  console.log(`EXIF capture dates: ${dated}/${analyses.length} images.`);

  const defaultExport = loadDefaultExport(opts.dir);
  const manualGroups = defaultExport ? null : loadManualGroups(opts.dir);
  const pairing = manualGroups
    ? { ...suggestCasesFromManual(analyses, manualGroups), manualGroups }
    : suggestCases(analyses);
  const multi = pairing.cases.filter(c => c.images.length >= 2).length;
  const imgs = pairing.cases.reduce((n, c) => n + c.images.length, 0);
  const src = defaultExport ? 'default export' : manualGroups ? 'manual groups' : 'AI';
  console.log(`Defaults: ${src}. Suggested ${pairing.cases.length} cases (${multi} with 2+ imgs, ${imgs} total assigned), ${pairing.unpaired.length} unpaired.`);

  const { htmlPath } = buildReviewHtml(opts.dir, analyses, pairing, defaultExport);
  console.log(`\nReview artifact: ${htmlPath}`);
  console.log(`Analysis data:   ${jsonPath}`);
  console.log('\nOpen review.html in your browser to rearrange pairs and export JSON.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
