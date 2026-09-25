/**
 * Media rules shared by web and mobile. Storage policies in
 * supabase/migrations/20260925210147_storage.sql enforce the same path shape.
 */
export const MEDIA_BUCKET = 'household-media';
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
/** Images are re-encoded client-side (strips EXIF/GPS) to at most this edge. */
export const MAX_IMAGE_EDGE = 2560;

export const ALLOWED_MEDIA_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
} as const;
export type AllowedMediaMime = keyof typeof ALLOWED_MEDIA_MIME;

export function isAllowedMime(mime: string): mime is AllowedMediaMime {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MEDIA_MIME, mime);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type MediaOwnerType = 'recipes' | 'people';

/**
 * Builds the storage key. Never derived from the user's file name.
 * `fileId` must be a fresh UUID (crypto.randomUUID / expo-crypto).
 */
export function buildMediaPath(householdId: string, owner: MediaOwnerType, ownerId: string, fileId: string, mime: AllowedMediaMime): string {
  for (const [label, v] of [['householdId', householdId], ['ownerId', ownerId], ['fileId', fileId]] as const) {
    if (!UUID.test(v)) throw new Error(`${label} must be a lowercase UUID`);
  }
  return `${householdId}/${owner}/${ownerId}/${fileId}.${ALLOWED_MEDIA_MIME[mime]}`;
}

const PATH = /^([0-9a-f-]{36})\/(recipes|people)\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|jpeg|png|webp|heic|heif|pdf)$/;

export function isValidMediaPath(path: string): boolean {
  return PATH.test(path);
}

export function mediaPathHousehold(path: string): string | null {
  return PATH.exec(path)?.[1] ?? null;
}

/** Validates a file before upload. Returns a Danish error message or null. */
export function validateUpload(file: { size: number; type: string }): string | null {
  if (!isAllowedMime(file.type)) return 'Filtypen understøttes ikke. Brug JPG, PNG, WebP, HEIC eller PDF.';
  if (file.size <= 0) return 'Filen er tom.';
  if (file.size > MAX_MEDIA_BYTES) return 'Filen er for stor (maks. 25 MB).';
  return null;
}

/** Fits width/height inside a max edge, preserving aspect ratio. */
export function fitWithin(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
