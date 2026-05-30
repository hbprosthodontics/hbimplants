#!/usr/bin/env node
/**
 * Optional per-image processing during gallery publish (rotate/crop).
 * Add entries here only when automated fixes are needed.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/** @type {Record<string, { rotate?: number, crop?: { h: number, w: number, oy: number, ox: number }, size?: number }>} */
export const GALLERY_IMAGE_PROCESSING = {};

function runSips(args) {
  execFileSync('sips', args, { stdio: 'pipe' });
}

function stripExifOrientation(filePath) {
  try {
    execFileSync('exiftool', ['-Orientation=Horizontal', '-overwrite_original', filePath], {
      stdio: 'pipe',
    });
  } catch {
    // exiftool optional
  }
}

export function processGalleryImage(filePath, preset) {
  if (!preset || !fs.existsSync(filePath)) return;

  if (preset.rotate) runSips(['-r', String(preset.rotate), filePath]);

  if (preset.crop) {
    const { h, w, oy, ox } = preset.crop;
    runSips(['--cropToHeightWidth', String(h), String(w), '--cropOffset', String(oy), String(ox), filePath]);
  }

  if (preset.size) {
    runSips(['-z', String(preset.size), String(preset.size), filePath]);
  }

  stripExifOrientation(filePath);
}

export function processGalleryDir(galleryDir) {
  for (const [filename, preset] of Object.entries(GALLERY_IMAGE_PROCESSING)) {
    const filePath = path.join(galleryDir, filename);
    processGalleryImage(filePath, preset);
  }
}
