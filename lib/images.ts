import { ValidationError } from '@/lib/errors';

/**
 * Image checks shared by every endpoint that accepts a photo (upload, n8n
 * ingest, AI extraction, photo search).
 *
 * The type is read from the file's own first bytes, never from the name or
 * the Content-Type the client claims — so an SVG or HTML file (which can
 * carry script) can't be passed off as a photo.
 */

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Largest photo any endpoint accepts. Photo search sets its own lower cap. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function detectImageType(bytes: Uint8Array): ImageType | null {
  const at = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'; // RIFF....WEBP
  return null;
}

/** Throw a 400 unless `bytes` is a JPEG, PNG or WebP within `maxBytes`; returns its real type. */
export function validateImage(bytes: Uint8Array, maxBytes: number = MAX_IMAGE_BYTES): ImageType {
  if (bytes.length === 0) throw new ValidationError('The photo is empty');
  if (bytes.length > maxBytes) throw new ValidationError(`Photo is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  const type = detectImageType(bytes);
  if (!type) throw new ValidationError('Use a JPEG, PNG or WebP photo');
  return type;
}

/** Decode a base64 image (with or without a data: prefix) and validate it. */
export function decodeBase64Image(base64: string, maxBytes?: number): { bytes: Buffer; type: ImageType } {
  const bytes = Buffer.from(base64.replace(/^data:[^,]+,/, ''), 'base64');
  return { bytes, type: validateImage(bytes, maxBytes) };
}
