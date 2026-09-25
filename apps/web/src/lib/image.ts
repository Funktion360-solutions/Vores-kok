'use client';
import { fitWithin, MAX_IMAGE_EDGE, type AllowedMediaMime } from '@vores-kok/domain';

export interface PreparedUpload {
  blob: Blob;
  mime: AllowedMediaMime;
  width: number | null;
  height: number | null;
  /** False if we could not re-encode (e.g. HEIC in a browser that cannot decode it). */
  stripped: boolean;
}

/**
 * Re-encodes images through a canvas: resizes to MAX_IMAGE_EDGE and drops all
 * metadata (EXIF, GPS). PDFs pass through unchanged.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.type === 'application/pdf') return { blob: file, mime: 'application/pdf', width: null, height: null, stripped: true };
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const keepPng = file.type === 'image/png' && width * height < 1_500_000;
    const mime: AllowedMediaMime = keepPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), mime, 0.86));
    return { blob, mime, width, height, stripped: true };
  } catch {
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      return { blob: file, mime: file.type, width: null, height: null, stripped: false };
    }
    throw new Error('Billedet kunne ikke læses.');
  }
}
