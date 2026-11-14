import { Capacitor, CapacitorHttp } from '@capacitor/core';
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

function shouldUseWebProxy(): boolean {
  return !Capacitor.isNativePlatform();
}

function buildProxyUrl(targetUrl: string, timeoutMs: number): string {
  return `/api/ccapi-proxy?target=${encodeURIComponent(targetUrl)}&timeoutMs=${Math.round(timeoutMs)}`;
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

async function fetchViaWebProxy(
  targetUrl: string,
  init: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<Response> {
  if (init.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, init.timeoutMs);

  const onExternalAbort = () => controller.abort();
  init.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(buildProxyUrl(targetUrl, init.timeoutMs), {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (timedOut) {
      throw new Error('Hết thời gian phản hồi từ máy ảnh Canon');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onExternalAbort);
  }
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

  if (shouldUseWebProxy()) {
    const res = await fetchViaWebProxy(targetUrl, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      timeoutMs,
      signal,
    });

    const text = await res.text();
    let parsedData: unknown = text;
    if (text.trim()) {
      try {
        parsedData = JSON.parse(text);
      } catch {
        /* leave as string */
      }
    }

    if (!res.ok) {
      const errObj =
        parsedData && typeof parsedData === 'object' ? (parsedData as Record<string, unknown>) : null;
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (typeof errObj?.error === 'string' && errObj.error) ||
        `CCAPI trả về HTTP ${res.status}`;
      throw new CcapiHttpError(msg, res.status);
    }

    return parsedData && typeof parsedData === 'object' ? parsedData : {};
  }

  const requestPromise = CapacitorHttp.request({
    url: targetUrl,
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    data: body,
    connectTimeout: Math.min(timeoutMs, 5000),
    readTimeout: timeoutMs,
  });

  const response = await new Promise<Awaited<typeof requestPromise>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Hết thời gian phản hồi từ máy ảnh Canon'));
    }, timeoutMs);

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
 * Fetches a photo from the Canon camera:
 * - Native iPadOS (.ipa): directly via CapacitorHttp over Wi-Fi
 * - Web Browser (Chrome/Safari on localhost): via same-origin /api/ccapi-proxy
 * Includes automatic 503/404 busy retries and kind=display fallback.
 */
export async function resolveCameraImageUrl(rawCameraUrl: string): Promise<ResolvedCameraImage> {
  const candidates = buildImageCandidateUrls(rawCameraUrl);
  const retryDelays = [350, 550, 800, 1100, 1500];
  let lastError = 'Không thể tải ảnh từ máy ảnh Canon';
  const useProxy = shouldUseWebProxy();

  for (const candidateUrl of candidates) {
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        if (useProxy) {
          const res = await fetchViaWebProxy(candidateUrl, {
            method: 'GET',
            timeoutMs: 25000,
          });
          if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 0) {
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
        }

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
    if (shouldUseWebProxy()) {
      const res = await fetchViaWebProxy(baseUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-65535' },
        timeoutMs: 6000,
      });
      if (res.status !== 206) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      return parseExifFromBlob(blob);
    }

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
  let fetchedBlob: Blob | null = null;
  const getBlob = async (): Promise<Blob | null> => {
    if (fetchedBlob) return fetchedBlob;
    try {
      const response = await fetch(url);
      fetchedBlob = await response.blob();
      return fetchedBlob;
    } catch {
      return null;
    }
  };

  if (typeof navigator.share === 'function') {
    try {
      const blob = await getBlob();
      if (blob) {
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
          });
          return 'shared';
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  let downloadHref = url;
  let tempObjectUrl: string | null = null;
  if (!url.startsWith('blob:') && !url.startsWith('data:')) {
    const blob = await getBlob();
    if (blob) {
      tempObjectUrl = URL.createObjectURL(blob);
      downloadHref = tempObjectUrl;
    }
  }

  const link = document.createElement('a');
  link.href = downloadHref;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (tempObjectUrl) {
    setTimeout(() => URL.revokeObjectURL(tempObjectUrl!), 15000);
  }
  return 'downloaded';
}
