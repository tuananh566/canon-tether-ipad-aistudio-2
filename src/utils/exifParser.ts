import type { PhotoExif } from '../types/tether';

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatShutterSpeed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds >= 0.4) {
    return `${Number(seconds.toFixed(1))}s`;
  }
  const denom = Math.round(1 / seconds);
  return denom > 0 ? `1/${denom}s` : `${seconds.toFixed(2)}s`;
}

function formatAperture(fNumber: number): string {
  if (!Number.isFinite(fNumber) || fNumber <= 0) return '—';
  const rounded = fNumber < 10 ? Number(fNumber.toFixed(1)) : Math.round(fNumber);
  return `f/${rounded}`;
}

function formatFocalLength(mm: number): string {
  if (!Number.isFinite(mm) || mm <= 0) return '—';
  return `${Math.round(mm)}mm`;
}

function readAscii(view: DataView, offset: number, count: number): string {
  if (offset < 0 || offset + count > view.byteLength) return '';
  let out = '';
  for (let i = 0; i < count; i++) {
    const ch = view.getUint8(offset + i);
    if (ch === 0) break;
    out += String.fromCharCode(ch);
  }
  return out.trim();
}

function readIfdValue(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean,
): number | string | number[] | null {
  if (entryOffset + 12 > view.byteLength) return null;
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const valueOffsetField = entryOffset + 8;

  const typeSizes: Record<number, number> = {
    1: 1, // BYTE
    2: 1, // ASCII
    3: 2, // SHORT
    4: 4, // LONG
    5: 8, // RATIONAL
    7: 1, // UNDEFINED
    9: 4, // SLONG
    10: 8, // SRATIONAL
  };

  const unitSize = typeSizes[type];
  if (!unitSize || count <= 0 || count > 2048) return null;
  const totalBytes = unitSize * count;
  const dataOffset =
    totalBytes <= 4 ? valueOffsetField : tiffStart + view.getUint32(valueOffsetField, littleEndian);

  if (dataOffset < 0 || dataOffset + totalBytes > view.byteLength) return null;

  if (type === 2) {
    return readAscii(view, dataOffset, count);
  }

  const nums: number[] = [];
  for (let i = 0; i < count; i++) {
    const pos = dataOffset + i * unitSize;
    if (type === 1 || type === 7) {
      nums.push(view.getUint8(pos));
    } else if (type === 3) {
      nums.push(view.getUint16(pos, littleEndian));
    } else if (type === 4) {
      nums.push(view.getUint32(pos, littleEndian));
    } else if (type === 9) {
      nums.push(view.getInt32(pos, littleEndian));
    } else if (type === 5) {
      const n = view.getUint32(pos, littleEndian);
      const d = view.getUint32(pos + 4, littleEndian);
      nums.push(d !== 0 ? n / d : 0);
    } else if (type === 10) {
      const n = view.getInt32(pos, littleEndian);
      const d = view.getInt32(pos + 4, littleEndian);
      nums.push(d !== 0 ? n / d : 0);
    }
  }

  return nums.length === 1 ? nums[0] : nums;
}

function parseIfdEntries(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
): Map<number, number | string | number[]> {
  const tags = new Map<number, number | string | number[]>();
  const absOffset = tiffStart + ifdOffset;
  if (absOffset < 0 || absOffset + 2 > view.byteLength) return tags;

  const entryCount = view.getUint16(absOffset, littleEndian);
  if (entryCount > 256) return tags;

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = absOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tagId = view.getUint16(entryOffset, littleEndian);
    const val = readIfdValue(view, tiffStart, entryOffset, littleEndian);
    if (val !== null) {
      tags.set(tagId, val);
    }
  }
  return tags;
}

function parseTiffExifBlock(view: DataView, tiffStart: number): Partial<PhotoExif> {
  if (tiffStart + 8 > view.byteLength) return {};
  const byteOrder = view.getUint16(tiffStart, false);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return {};

  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return {};
  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);

  const ifd0 = parseIfdEntries(view, tiffStart, firstIfdOffset, littleEndian);
  const exifPointer = ifd0.get(0x8769);
  const exifIfd =
    typeof exifPointer === 'number'
      ? parseIfdEntries(view, tiffStart, exifPointer, littleEndian)
      : new Map<number, number | string | number[]>();

  const out: Partial<PhotoExif> = {};

  const isoVal = exifIfd.get(0x8827) ?? exifIfd.get(0x8833);
  const isoNum = Array.isArray(isoVal) ? isoVal[0] : isoVal;
  if (typeof isoNum === 'number' && isoNum > 0) {
    out.iso = `ISO ${Math.round(isoNum)}`;
  }

  const fNumVal = exifIfd.get(0x829d);
  if (typeof fNumVal === 'number' && fNumVal > 0) {
    out.aperture = formatAperture(fNumVal);
  }

  const expTimeVal = exifIfd.get(0x829a);
  if (typeof expTimeVal === 'number' && expTimeVal > 0) {
    out.shutterSpeed = formatShutterSpeed(expTimeVal);
  }

  const focalVal = exifIfd.get(0x920a);
  if (typeof focalVal === 'number' && focalVal > 0) {
    out.focalLength = formatFocalLength(focalVal);
  }

  const lensModel = exifIfd.get(0xa434);
  const cameraModel = ifd0.get(0x0110);
  if (typeof lensModel === 'string' && lensModel.length > 0) {
    out.lens = lensModel;
  } else if (typeof cameraModel === 'string' && cameraModel.length > 0) {
    out.lens = cameraModel;
  }

  const wbVal = exifIfd.get(0xa403);
  if (typeof wbVal === 'number') {
    out.whiteBalance = wbVal === 0 ? 'Auto WB' : 'Manual WB';
  }

  return out;
}

function parseKelvinFromXmpBytes(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const match =
      text.match(/<(?:crs|exif|aux):(?:Color)?Temperature>\s*(\d{4,5})\s*<\/(?:crs|exif|aux):(?:Color)?Temperature>/i) ??
      text.match(/(?:crs|exif|aux):(?:Color)?Temperature="(\d{4,5})"/i);
    if (!match) return null;
    const kelvin = Number(match[1]);
    if (Number.isFinite(kelvin) && kelvin >= 1800 && kelvin <= 15000) {
      return `${kelvin}K`;
    }
  } catch {
    /* ignore malformed XMP */
  }
  return null;
}

export function parseExifFromArrayBuffer(buffer: ArrayBuffer): Partial<PhotoExif> {
  if (buffer.byteLength < 12) return {};
  const view = new DataView(buffer);

  // Case 1: Standard JPEG starting with SOI (0xFFD8)
  if (view.getUint16(0, false) === 0xffd8) {
    let offset = 2;
    let exifOut: Partial<PhotoExif> = {};
    let xmpKelvin: string | null = null;

    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      // SOS (0xDA) or EOI (0xD9) means image scan started, no more metadata segments
      if (marker === 0xda || marker === 0xd9) break;
      // Standalone markers without length
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
        offset += 2;
        continue;
      }

      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2) break;

      // APP1 (0xE1) with "Exif\0\0" header
      if (marker === 0xe1 && offset + 10 <= view.byteLength) {
        if (
          view.getUint32(offset + 4, false) === 0x45786966 &&
          view.getUint16(offset + 8, false) === 0x0000
        ) {
          exifOut = parseTiffExifBlock(view, offset + 10);
        } else if (offset + 33 <= view.byteLength) {
          // Check for APP1 XMP packet ("http://ns.adobe.com/xap/1.0/\0")
          const sig = readAscii(view, offset + 4, 29);
          if (sig.startsWith('http://ns.adobe.com/xap/1.0/')) {
            const xmpStart = offset + 4 + 29;
            const xmpEnd = Math.min(view.byteLength, offset + 2 + segmentLength);
            if (xmpEnd > xmpStart) {
              xmpKelvin = parseKelvinFromXmpBytes(
                new Uint8Array(buffer, xmpStart, xmpEnd - xmpStart),
              );
            }
          }
        }
      }

      offset += 2 + segmentLength;
    }

    if (xmpKelvin) {
      exifOut.whiteBalance = xmpKelvin;
    }
    return exifOut;
  }

  // Case 2: Raw TIFF header (e.g. CR2 starts directly with II*\0 / MM\0*)
  const maybeOrder = view.getUint16(0, false);
  if (maybeOrder === 0x4949 || maybeOrder === 0x4d4d) {
    return parseTiffExifBlock(view, 0);
  }

  return {};
}

export async function parseExifFromBlob(blob: Blob): Promise<PhotoExif> {
  const empty: PhotoExif = {
    iso: '—',
    aperture: '—',
    shutterSpeed: '—',
    focalLength: '—',
    lens: '—',
    whiteBalance: '—',
  };

  try {
    const slice = blob.slice(0, 262144); // First 256 KB covers APP1 EXIF & XMP cleanly
    const buffer = await slice.arrayBuffer();
    const parsed = parseExifFromArrayBuffer(buffer);
    return {
      iso: parsed.iso || empty.iso,
      aperture: parsed.aperture || empty.aperture,
      shutterSpeed: parsed.shutterSpeed || empty.shutterSpeed,
      focalLength: parsed.focalLength || empty.focalLength,
      lens: parsed.lens || empty.lens,
      whiteBalance: parsed.whiteBalance || empty.whiteBalance,
    };
  } catch {
    return empty;
  }
}
