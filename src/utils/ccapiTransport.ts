import { CapacitorHttp } from '@capacitor/core';
import type { PhotoExif } from '../types/tether';
import { parseExifFromBlob } from './exifParser';

export class CcapiHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ResolvedCameraImage {
  objectUrl: string;
  blob: Blob;
  sizeBytes: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildImageCandidateUrls(rawUrl: string): string[] {
  const candidates = [rawUrl];
  try {
    const parsed = new URL(rawUrl);
    const kind = parsed.searchParams.get('kind');
    if (kind === 'display') {
      const lowerPath = parsed.pathname.toLowerCase();
      const thumbUrl = new URL(rawUrl);
      thumbUrl.searchParams.set('kind', 'thumbnail');
      candidates.push(thumbUrl.toString());
      if (!lowerPath.endsWith('.cr2') && !lowerPath.endsWith('.cr3') && !lowerPath.endsWith('.raw')) {
        const mainUrl = new URL(rawUrl);
        mainUrl.searchParams.delete('kind');
        candidates.push(mainUrl.toString());
      }
    } else if (kind === 'main') {
      const mainUrl = new URL(rawUrl);
      mainUrl.searchParams.delete('kind');
      candidates.push(mainUrl.toString());
    }
  } catch {
    /* ignore */
  }
  return candidates;
}

function base64ToBlob(base64Data: string, contentType: string): Blob {
  const clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType || 'image/jpeg' });
}

export async function requestCcapiJson(
  targetUrl: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  timeoutMs = 10000,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const requestPromise = CapacitorHttp.request({
    url: targetUrl,
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    data: body,
    connectTimeout: Math.min(timeoutMs, 12000),
    readTimeout: timeoutMs,
  });

  const response = await new Promise<Awaited<typeof requestPromise>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Hết thời gian phản hồi từ máy ảnh Canon'));
    }, timeoutMs + 500);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    requestPromise.then(
      (res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(res);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });

  let parsedData: unknown = response.data;
  if (typeof parsedData === 'string' && parsedData.trim()) {
    try {
      parsedData = JSON.parse(parsedData);
    } catch {
      /* leave as string */
    }
  }

  if (response.status < 200 || response.status >= 300) {
    const errObj =
      parsedData && typeof parsedData === 'object' ? (parsedData as Record<string, unknown>) : null;
    const msg =
      (typeof errObj?.message === 'string' && errObj.message) ||
      (typeof errObj?.error === 'string' && errObj.error) ||
      `CCAPI trả về HTTP ${response.status}`;
    throw new CcapiHttpError(msg, response.status);
  }

  return parsedData ?? {};
}

/**
 * Fetches a photo directly from the Canon camera over iPad Wi-Fi using CapacitorHttp
 * with automatic 503/404 busy retries and kind=display fallback, returning a local blob URL and raw Blob.
 */
export async function resolveCameraImageUrl(rawCameraUrl: string): Promise<ResolvedCameraImage> {
  const candidates = buildImageCandidateUrls(rawCameraUrl);
  const retryDelays = [350, 550, 800, 1100, 1500];
  let lastError = 'Không thể tải ảnh từ máy ảnh Canon';

  for (const candidateUrl of candidates) {
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        const res = await CapacitorHttp.get({
          url: candidateUrl,
          responseType: 'blob',
          connectTimeout: 10000,
          readTimeout: 25000,
        });

        if (res.status >= 200 && res.status < 300 && res.data) {
          let blob: Blob | null = null;
          if (res.data instanceof Blob) {
            blob = res.data;
          } else if (typeof res.data === 'string' && res.data.length > 0) {
            const contentType =
              res.headers?.['Content-Type'] || res.headers?.['content-type'] || 'image/jpeg';
            blob = base64ToBlob(res.data, contentType);
          }

          if (blob) {
            return {
              objectUrl: URL.createObjectURL(blob),
              blob,
              sizeBytes: blob.size,
            };
          }
        }

        lastError = `Camera trả về HTTP ${res.status}`;
        if ((res.status === 400 || res.status === 415) && candidateUrl !== candidates[candidates.length - 1]) {
          break;
        }
        if ((res.status === 503 || res.status === 404) && attempt < retryDelays.length) {
          await sleep(retryDelays[attempt]);
          continue;
        }
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Lỗi kết nối máy ảnh Canon';
        if (attempt < retryDelays.length) {
          await sleep(retryDelays[attempt]);
          continue;
        }
      }
    }
  }

  throw new Error(lastError);
}

/**
 * Fetches CCAPI ?kind=info JSON for the exact file size stored on the camera card.
 */
export async function fetchCameraContentInfo(
  baseUrl: string,
): Promise<{ filesize?: number } | null> {
  try {
    const info = (await requestCcapiJson(`${baseUrl}?kind=info`, 'GET', undefined, 4000)) as {
      filesize?: number;
    };
    return info && typeof info === 'object' ? info : null;
  } catch {
    return null;
  }
}

/**
 * Fetches the first 64 KB of the original file via Range request (HTTP 206)
 * so real EXIF can be read even when fast-mode ?kind=display strips EXIF headers.
 */
export async function fetchCameraExifSnippet(baseUrl: string): Promise<PhotoExif | null> {
  try {
    const res = await CapacitorHttp.get({
      url: baseUrl,
      headers: { Range: 'bytes=0-65535' },
      responseType: 'blob',
      connectTimeout: 4000,
      readTimeout: 6000,
    });

    if (res.status !== 206 || !res.data) return null;

    let blob: Blob | null = null;
    if (res.data instanceof Blob) {
      blob = res.data;
    } else if (typeof res.data === 'string' && res.data.length > 0) {
      blob = base64ToBlob(res.data, 'image/jpeg');
    }
    if (!blob) return null;
    return parseExifFromBlob(blob);
  } catch {
    return null;
  }
}

export async function savePhotoToDevice(url: string, filename: string): Promise<'shared' | 'downloaded'> {
  if (typeof navigator.share === 'function') {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return 'shared';
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return 'downloaded';
}
