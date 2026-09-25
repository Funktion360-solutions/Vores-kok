/** File helpers for legacy images: type sniffing and metadata stripping (privacy). */

export type SniffedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export function sniffMime(buf: Buffer): SniffedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

/** Removes APP1 (EXIF/XMP, incl. GPS), APP13 (IPTC) and COM segments from a JPEG. */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return buf;
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // not a marker: bail out, keep original
    const marker = buf[i + 1]!;
    if (marker === 0xda) { parts.push(buf.subarray(i)); return Buffer.concat(parts); } // start of scan
    const len = buf.readUInt16BE(i + 2);
    const end = i + 2 + len;
    if (end > buf.length) return buf;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(buf.subarray(i, end));
    i = end;
  }
  return buf;
}

/** Removes textual and EXIF chunks from a PNG. */
export function stripPngMetadata(buf: Buffer): Buffer {
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString('latin1');
    const end = i + 12 + len;
    if (end > buf.length) return buf;
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'].includes(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

export function stripMetadata(buf: Buffer, mime: SniffedMime): Buffer {
  if (mime === 'image/jpeg') return stripJpegMetadata(buf);
  if (mime === 'image/png') return stripPngMetadata(buf);
  return buf;
}
