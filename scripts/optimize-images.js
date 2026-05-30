#!/usr/bin/env node
/**
 * Resize and compress images in public/images and images/.
 * Targets: long edge <= 1920px, file size <= 1MB.
 *
 * Usage: node scripts/optimize-images.js [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const MAX_BYTES = 1024 * 1024;
const MAX_LONG_EDGE = 1920;
const ROOTS = ['public/images', 'images'];
const EXT_RE = /\.(jpe?g|png|webp|avif|gif)$/i;
const dryRun = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXT_RE.test(entry.name)) out.push(full);
  }
  return out;
}

async function optimizeFile(file) {
  const before = fs.statSync(file).size;
  const meta = await sharp(file).metadata();
  const longEdge = Math.max(meta.width || 0, meta.height || 0);
  const ext = path.extname(file).toLowerCase();

  if (before <= MAX_BYTES && longEdge <= MAX_LONG_EDGE) {
    return { file, skipped: true };
  }

  let pipeline = sharp(file, { failOn: 'none' }).rotate();
  if (longEdge > MAX_LONG_EDGE) {
    pipeline = pipeline.resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const tmp = `${file}.opt.tmp`;
  let outputPath = file;
  let format = ext.replace('.', '');

  const writeJpeg = async (quality) => {
    await pipeline.clone().jpeg({ quality, mozjpeg: true }).toFile(tmp);
  };

  const writeWebp = async (quality) => {
    await pipeline.clone().webp({ quality }).toFile(tmp);
  };

  const writePng = async (quality = 80) => {
    await pipeline
      .clone()
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality, effort: 10 })
      .toFile(tmp);
  };

  const writeAvif = async (quality) => {
    await pipeline.clone().avif({ quality }).toFile(tmp);
  };

  if (format === 'jpg' || format === 'jpeg') {
    for (const q of [85, 80, 75, 70, 65, 60, 55, 50]) {
      await writeJpeg(q);
      if (fs.statSync(tmp).size <= MAX_BYTES) break;
    }
  } else if (format === 'webp') {
    for (const q of [85, 80, 75, 70, 65, 60, 55, 50]) {
      await writeWebp(q);
      if (fs.statSync(tmp).size <= MAX_BYTES) break;
    }
  } else if (format === 'avif') {
    for (const q of [70, 60, 50, 45, 40]) {
      await writeAvif(q);
      if (fs.statSync(tmp).size <= MAX_BYTES) break;
    }
  } else if (format === 'png') {
    for (const q of [80, 70, 60, 50]) {
      await writePng(q);
      if (fs.statSync(tmp).size <= MAX_BYTES) break;
    }
    if (fs.statSync(tmp).size > MAX_BYTES && !meta.hasAlpha) {
      // Photographic PNG without alpha — convert to JPEG for size.
      outputPath = file.replace(/\.png$/i, '.jpg');
      format = 'jpg';
      for (const q of [85, 80, 75, 70, 65, 60, 55, 50]) {
        await writeJpeg(q);
        if (fs.statSync(tmp).size <= MAX_BYTES) break;
      }
    }
  } else if (format === 'gif') {
    await pipeline.clone().gif().toFile(tmp);
  }

  const after = fs.statSync(tmp).size;
  const outMeta = await sharp(tmp).metadata();
  const outLong = Math.max(outMeta.width || 0, outMeta.height || 0);

  if (after > MAX_BYTES || outLong > MAX_LONG_EDGE) {
    fs.unlinkSync(tmp);
    return { file, error: `Still too large: ${(after / 1024 / 1024).toFixed(2)}MB ${outMeta.width}x${outMeta.height}` };
  }

  if (!dryRun) {
    fs.renameSync(tmp, outputPath);
    if (outputPath !== file && fs.existsSync(file)) fs.unlinkSync(file);
  } else {
    fs.unlinkSync(tmp);
  }

  return {
    file,
    outputPath: outputPath !== file ? outputPath : file,
    before,
    after,
    from: `${meta.width}x${meta.height}`,
    to: `${outMeta.width}x${outMeta.height}`,
    converted: outputPath !== file,
  };
}

const files = [...new Set(ROOTS.flatMap((root) => walk(root)))].sort();
const results = { skipped: 0, optimized: 0, converted: [], errors: [] };

for (const file of files) {
  try {
    const result = await optimizeFile(file);
    if (result.skipped) {
      results.skipped++;
      continue;
    }
    if (result.error) {
      results.errors.push(result);
      console.error('FAIL', result.file, result.error);
      continue;
    }
    results.optimized++;
    if (result.converted) results.converted.push({ from: result.file, to: result.outputPath });
    console.log(
      dryRun ? '[dry-run]' : 'OK',
      path.relative(process.cwd(), result.outputPath),
      `${(result.before / 1024 / 1024).toFixed(2)}MB -> ${(result.after / 1024 / 1024).toFixed(2)}MB`,
      `${result.from} -> ${result.to}`,
    );
  } catch (err) {
    results.errors.push({ file, error: err.message });
    console.error('ERR', file, err.message);
  }
}

console.log('\nSummary:', results);
if (results.converted.length) {
  console.log('\nConverted PNG -> JPG (update references):');
  for (const c of results.converted) console.log(`  ${c.from} -> ${c.to}`);
}
process.exit(results.errors.length ? 1 : 0);
