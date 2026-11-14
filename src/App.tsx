import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronUp, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { CameraConnectionPopup } from './components/CameraConnectionPopup';
import { CompareStage } from './components/CompareStage';
import { ConnectView } from './components/ConnectView';
import { GalleryModal } from './components/GalleryModal';
import { TetherWorkspace } from './components/TetherWorkspace';
import { INITIAL_STUDIO_SHOTS, SIMULATOR_ROTATION } from './data/sampleShots';
import type {
  ActiveTab,
  CcapiDeviceInfo,
  ConnectionMode,
  ConnectionStatus,
  PhotoExif,
  TetherPhoto,
} from './types/tether';

import {
  CcapiHttpError,
  fetchCameraExifSnippet,
  requestCcapiJson,
  resolveCameraImageUrl,
  savePhotoToDevice,
} from './utils/ccapiTransport';
import { formatFileSize, parseExifFromBlob } from './utils/exifParser';

interface CcapiEndpoints {
  deviceInfo: string;
  polling: string;
  pollingSupportsContinue: boolean;
  shutter: string;
  shutterManual: string;
  storage: string;
  contents: string;
  wb: string;
  colorTemp: string;
}

const DEFAULT_ENDPOINTS: CcapiEndpoints = {
  deviceInfo: '/ccapi/ver100/deviceinformation',
  polling: '/ccapi/ver100/event/polling',
  pollingSupportsContinue: false,
  shutter: '/ccapi/ver100/shooting/control/shutterbutton',
  shutterManual: '/ccapi/ver100/shooting/control/shutterbutton/manual',
  storage: '/ccapi/ver100/devicestatus/storage',
  contents: '/ccapi/ver100/contents',
  wb: '/ccapi/ver100/shooting/settings/wb',
  colorTemp: '/ccapi/ver100/shooting/settings/colortemperature',
};

function normalizeCcapiPathKey(rawPath: string): string {
  try {
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      return new URL(rawPath).pathname;
    }
  } catch {
    /* ignore */
  }
  const idx = rawPath.indexOf('?');
  const withoutQuery = idx >= 0 ? rawPath.slice(0, idx) : rawPath;
  const ccapiIdx = withoutQuery.indexOf('/ccapi/');
  if (ccapiIdx >= 0) return withoutQuery.slice(ccapiIdx);
  return withoutQuery;
}

function formatConnectionErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message.trim()) return fallback;
  const msg = err.message.trim();
  if (
    /(failed to fetch|load failed|networkerror|request timed out|timed out|aborted|hết thời gian phản hồi|could not connect|connection was lost|appears to be offline|hostname could not be found|nsurlerrordomain|econnrefused|etimedout|ehostunreach|network request failed)/i.test(
      msg,
    )
  ) {
    return fallback;
  }
  return msg;
}

function parseCcapiManifest(manifest: Record<string, unknown>): CcapiEndpoints {
  const versionOrder = ['ver130', 'ver120', 'ver110', 'ver100'];
  const allEntries: Array<{ ver: string; path: string; get?: boolean; post?: boolean }> = [];

  for (const ver of versionOrder) {
    const list = manifest[ver];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'string') {
        allEntries.push({ ver, path: item });
      } else if (item && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
        const entry = item as { path: string; get?: boolean; post?: boolean };
        allEntries.push({ ver, path: entry.path, get: entry.get, post: entry.post });
      }
    }
  }

  // Fallback: inspect any other ver* keys
  for (const [ver, list] of Object.entries(manifest)) {
    if (versionOrder.includes(ver) || !Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'string') {
        allEntries.push({ ver, path: item });
      } else if (item && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
        const entry = item as { path: string; get?: boolean; post?: boolean };
        allEntries.push({ ver, path: entry.path, get: entry.get, post: entry.post });
      }
    }
  }

  const findPath = (suffix: string, fallback: string) =>
    allEntries.find((e) => e.path.endsWith(suffix))?.path ?? fallback;

  const pollingEntry = allEntries.find((e) => e.path.endsWith('/event/polling'));

  return {
    deviceInfo: findPath('/deviceinformation', DEFAULT_ENDPOINTS.deviceInfo),
    polling: pollingEntry?.path ?? DEFAULT_ENDPOINTS.polling,
    pollingSupportsContinue: pollingEntry ? pollingEntry.ver !== 'ver100' : false,
    shutter: findPath('/shooting/control/shutterbutton', DEFAULT_ENDPOINTS.shutter),
    shutterManual: findPath('/shooting/control/shutterbutton/manual', DEFAULT_ENDPOINTS.shutterManual),
    storage: findPath('/devicestatus/storage', DEFAULT_ENDPOINTS.storage),
    contents: findPath('/contents', DEFAULT_ENDPOINTS.contents),
    wb: findPath('/shooting/settings/wb', DEFAULT_ENDPOINTS.wb),
    colorTemp: findPath('/shooting/settings/colortemperature', DEFAULT_ENDPOINTS.colorTemp),
  };
}

const TAB_ORDER: Record<ActiveTab, number> = {
  connect: -1,
  tether: 0,
  compare: 1,
  gallery: 2,
};

const TAB_PANEL_VARIANTS = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 32 : -32,
    scale: 0.99,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -32 : 32,
    scale: 0.99,
  }),
};

const TAB_TRANSITION = {
  duration: 0.24,
  ease: [0.32, 0.72, 0, 1] as const,
};

export default function App() {
  const [{ activeTab, tabDirection }, setTabState] = useState<{
    activeTab: ActiveTab;
    tabDirection: number;
  }>({ activeTab: 'connect', tabDirection: 1 });
  const setActiveTab = useCallback(
    (nextOrUpdater: ActiveTab | ((prev: ActiveTab) => ActiveTab)) => {
      setTabState((prev) => {
        const nextTab =
          typeof nextOrUpdater === 'function' ? nextOrUpdater(prev.activeTab) : nextOrUpdater;
        if (nextTab === prev.activeTab) return prev;
        const dir = TAB_ORDER[nextTab] >= TAB_ORDER[prev.activeTab] ? 1 : -1;
        return { activeTab: nextTab, tabDirection: dir };
      });
    },
    [],
  );
  const [mode, setMode] = useState<ConnectionMode>('ccapi');

  // Canon CCAPI connection state
  const [hasUnlockedSession, setHasUnlockedSession] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected');
  const [cameraIp, setCameraIp] = useState('192.168.1.2');
  const [cameraPort, setCameraPort] = useState('8080');
  const [ccapiEndpoints, setCcapiEndpoints] = useState<CcapiEndpoints>(DEFAULT_ENDPOINTS);
  const [deviceInfo, setDeviceInfo] = useState<CcapiDeviceInfo | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const [photos, setPhotos] = useState<TetherPhoto[]>(INITIAL_STUDIO_SHOTS);
  const [selectedPhoto, setSelectedPhoto] = useState<TetherPhoto | null>(
    INITIAL_STUDIO_SHOTS[INITIAL_STUDIO_SHOTS.length - 1] ?? null,
  );
  const [compareA, setCompareA] = useState<TetherPhoto | null>(
    INITIAL_STUDIO_SHOTS[INITIAL_STUDIO_SHOTS.length - 1] ?? null,
  );
  const [compareB, setCompareB] = useState<TetherPhoto | null>(
    INITIAL_STUDIO_SHOTS[INITIAL_STUDIO_SHOTS.length - 2] ?? null,
  );
  const [activeCompareSlot, setActiveCompareSlot] = useState<'A' | 'B'>('A');
  const [lockedSlot, setLockedSlot] = useState<'A' | 'B' | null>('B');

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(false);
  const filmstripDragStartYRef = useRef<number | null>(null);
  const filmstripDraggedRef = useRef(false);
  const [showCameraPopup, setShowCameraPopup] = useState(false);

  const seenCcapiUrlsRef = useRef(new Set<string>());
  const heartbeatFailuresRef = useRef(0);
  const isCheckingConnectionRef = useRef(false);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const cameraPopupContainerRef = useRef<HTMLDivElement | null>(null);
  const prevPhotoCountRef = useRef(INITIAL_STUDIO_SHOTS.length);
  const simShotCountRef = useRef(0);

  // Refs synced to latest UI toggles so polling loop never restarts/duplicates
  const lockedSlotRef = useRef(lockedSlot);
  const endpointsRef = useRef(ccapiEndpoints);

  useEffect(() => {
    lockedSlotRef.current = lockedSlot;
  }, [lockedSlot]);
  useEffect(() => {
    endpointsRef.current = ccapiEndpoints;
  }, [ccapiEndpoints]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3400);
  }, []);

  // ── CCAPI Proxy Helpers ──────────────────────────────────────────
  const buildCameraUrl = useCallback(
    (pathOrUrl: string) => {
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        return pathOrUrl;
      }
      const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
      return `http://${cameraIp.trim()}:${cameraPort.trim() || '8080'}${normalized}`;
    },
    [cameraIp, cameraPort],
  );

  const callCcapiPath = useCallback(
    async (
      pathOrUrl: string,
      method: 'GET' | 'POST' = 'GET',
      body?: unknown,
      timeoutMs = 10000,
      signal?: AbortSignal,
    ) => {
      const targetUrl = buildCameraUrl(pathOrUrl);
      return requestCcapiJson(targetUrl, method, body, timeoutMs, signal);
    },
    [buildCameraUrl],
  );

  const ingestCameraContentPaths = useCallback(
    (rawPaths: string[], _forceIngest = false) => {
      if (!rawPaths || rawPaths.length === 0) return 0;

      // Group JPEG and RAW with the same stem so RAW+JPEG doesn't create duplicate entries
      const jpegStems = new Set<string>();
      for (const p of rawPaths) {
        const clean = normalizeCcapiPathKey(p);
        const lower = clean.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          jpegStems.add(clean.replace(/\.[^.]+$/, '').toLowerCase());
        }
      }

      let addedCount = 0;
      const currentLockedSlot = lockedSlotRef.current;
      const contentsPrefix = endpointsRef.current.contents;

      for (const rawPath of rawPaths) {
        const key = normalizeCcapiPathKey(rawPath);
        const lower = key.toLowerCase();
        const isJpeg = lower.endsWith('.jpg') || lower.endsWith('.jpeg');
        const isRaw = lower.endsWith('.cr3') || lower.endsWith('.cr2');

        if (!isJpeg && !isRaw) continue;
        if (seenCcapiUrlsRef.current.has(key)) continue;

        const stem = key.replace(/\.[^.]+$/, '').toLowerCase();
        if (isRaw && jpegStems.has(stem)) {
          seenCcapiUrlsRef.current.add(key);
          continue;
        }

        seenCcapiUrlsRef.current.add(key);
        const filename = key.split('/').pop() || `IMG_${Date.now()}.JPG`;

        const resolvedPath =
          rawPath.startsWith('http') || rawPath.startsWith('/')
            ? rawPath
            : `${contentsPrefix}/${rawPath}`;
        const baseUrl = buildCameraUrl(resolvedPath);
        const fetchUrl = `${baseUrl}?kind=display`;

        addedCount += 1;

        void (async () => {
          try {
            const resolvedImg = await resolveCameraImageUrl(fetchUrl);

            let exif = await parseExifFromBlob(resolvedImg.blob);
            if (exif.iso === '—' && exif.aperture === '—') {
              const snippetExif = await fetchCameraExifSnippet(baseUrl);
              if (snippetExif) {
                exif = {
                  iso: snippetExif.iso !== '—' ? snippetExif.iso : exif.iso,
                  aperture: snippetExif.aperture !== '—' ? snippetExif.aperture : exif.aperture,
                  shutterSpeed:
                    snippetExif.shutterSpeed !== '—' ? snippetExif.shutterSpeed : exif.shutterSpeed,
                  focalLength:
                    snippetExif.focalLength !== '—' ? snippetExif.focalLength : exif.focalLength,
                  lens: snippetExif.lens !== '—' ? snippetExif.lens : exif.lens,
                  whiteBalance:
                    snippetExif.whiteBalance !== '—' ? snippetExif.whiteBalance : exif.whiteBalance,
                };
              }
            }

            if (!/\d+K/i.test(exif.whiteBalance)) {
              try {
                const [wbRes, ctRes] = await Promise.allSettled([
                  callCcapiPath(endpointsRef.current.wb, 'GET', undefined, 2500),
                  callCcapiPath(endpointsRef.current.colorTemp, 'GET', undefined, 2500),
                ]);
                const wbVal =
                  wbRes.status === 'fulfilled' &&
                  wbRes.value &&
                  typeof (wbRes.value as { value?: unknown }).value === 'string'
                    ? (wbRes.value as { value: string }).value.toLowerCase()
                    : null;
                const ctVal =
                  ctRes.status === 'fulfilled' &&
                  ctRes.value &&
                  typeof (ctRes.value as { value?: unknown }).value === 'number'
                    ? (ctRes.value as { value: number }).value
                    : null;

                const wbPresetKelvin: Record<string, string> = {
                  daylight: '5200K',
                  shade: '7000K',
                  cloudy: '6000K',
                  tungsten: '3200K',
                  whitefluorescent: '4000K',
                  flash: '6000K',
                  auto: 'Auto WB',
                  awbwhite: 'Auto WB',
                  custom: 'Custom WB',
                  custom1: 'Custom WB',
                  custom2: 'Custom WB',
                  custom3: 'Custom WB',
                };

                if (wbVal === 'colortemp' && ctVal) {
                  exif = { ...exif, whiteBalance: `${Math.round(ctVal)}K` };
                } else if (wbVal && wbPresetKelvin[wbVal]) {
                  exif = { ...exif, whiteBalance: wbPresetKelvin[wbVal] };
                } else if (ctVal && exif.whiteBalance === '—') {
                  exif = { ...exif, whiteBalance: `${Math.round(ctVal)}K` };
                }
              } catch {
                /* ignore if camera does not expose wb/colortemperature */
              }
            }

            const sizeLabel = isRaw
              ? `RAW · ${formatFileSize(resolvedImg.sizeBytes)}`
              : formatFileSize(resolvedImg.sizeBytes);

            const newPhoto: TetherPhoto = {
              id: `ccapi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${filename}`,
              filename,
              url: resolvedImg.objectUrl,
              fullUrl: isRaw ? baseUrl : `${baseUrl}?kind=main`,
              timestamp: Date.now(),
              exif,
              isFastPreview: true,
              isOriginal: false,
              source: 'ccapi',
              sizeLabel,
            };

            setPhotos((prev) => [...prev, newPhoto]);
            setSelectedPhoto(newPhoto);
            if (currentLockedSlot === 'A') {
              setCompareB(newPhoto);
            } else if (currentLockedSlot === 'B') {
              setCompareA(newPhoto);
            } else {
              setCompareA(newPhoto);
              setCompareB(newPhoto);
            }
            showToast(`Đã nhận ${filename} từ máy ảnh Canon`);
          } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : `Không thể tải ${filename} từ máy ảnh`);
          }
        })();
      }

      return addedCount;
    },
    [buildCameraUrl, callCcapiPath, showToast],
  );

  // Query camera storage to baseline existing files OR catch newest captured shot
  const syncNewestFromStorage = useCallback(
    async (baselineOnly: boolean, endpointsOverride?: CcapiEndpoints): Promise<number> => {
      const ep = endpointsOverride ?? endpointsRef.current;
      let storagePaths: string[] = [];

      try {
        const stRes = (await callCcapiPath(ep.storage, 'GET', undefined, 5000)) as {
          storagelist?: Array<{ path?: string }>;
        };
        if (Array.isArray(stRes?.storagelist)) {
          storagePaths = stRes.storagelist
            .map((s) => s.path)
            .filter((p): p is string => typeof p === 'string' && p.length > 0);
        }
      } catch {
        /* fallback to contents root */
      }

      if (storagePaths.length === 0) {
        try {
          const rootRes = (await callCcapiPath(ep.contents, 'GET', undefined, 5000)) as {
            path?: string[];
          };
          if (Array.isArray(rootRes?.path)) {
            storagePaths = rootRes.path;
          }
        } catch {
          return 0;
        }
      }

      let totalIngested = 0;
      for (const storagePath of storagePaths) {
        try {
          const level1 = (await callCcapiPath(storagePath, 'GET', undefined, 5000)) as {
            path?: string[];
          };
          let folders = Array.isArray(level1?.path) ? level1.path : [];
          const dcimEntry = folders.find((f) => f.toUpperCase().endsWith('/DCIM'));
          if (dcimEntry) {
            const dcimRes = (await callCcapiPath(dcimEntry, 'GET', undefined, 5000)) as {
              path?: string[];
            };
            folders = Array.isArray(dcimRes?.path) ? dcimRes.path : [];
          }

          if (folders.length === 0) continue;
          const sortedFolders = [...folders].sort();
          const latestFolder = sortedFolders[sortedFolders.length - 1];

          let targetPageUrl = latestFolder;
          try {
            const numRes = (await callCcapiPath(`${latestFolder}?kind=number`, 'GET', undefined, 4000)) as {
              pagenumber?: number;
            };
            if (typeof numRes?.pagenumber === 'number' && numRes.pagenumber > 1) {
              targetPageUrl = `${latestFolder}?page=${numRes.pagenumber}`;
            }
          } catch {
            /* camera may not support kind=number; page 1 will still be checked */
          }

          const filesRes = (await callCcapiPath(targetPageUrl, 'GET', undefined, 6000)) as {
            path?: string[];
          };
          const files = Array.isArray(filesRes?.path) ? filesRes.path : [];

          if (baselineOnly) {
            for (const f of files) {
              seenCcapiUrlsRef.current.add(normalizeCcapiPathKey(f));
            }
          } else if (files.length > 0) {
            const unseen = files.filter((f) => !seenCcapiUrlsRef.current.has(normalizeCcapiPathKey(f)));
            if (unseen.length > 0) {
              // Ingest the newest unseen files (last 2 max in case RAW+JPEG)
              totalIngested += ingestCameraContentPaths(unseen.slice(-2), true);
            }
          }
        } catch {
          /* continue checking other storage cards if dual-slot */
        }
      }

      return totalIngested;
    },
    [callCcapiPath, ingestCameraContentPaths],
  );

  const isAppUnlocked = hasUnlockedSession;

  const probeAndConnect = useCallback(
    async (isReconnect: boolean) => {
      const normalizedIp = cameraIp.trim();
      const normalizedPort = cameraPort.trim() || '8080';
      if (normalizedIp === '0.0.0.0' && normalizedPort === '8080') {
        setMode('simulator');
        setConnError(null);
        heartbeatFailuresRef.current = 0;
        setDeviceInfo({
          manufacturer: 'Canon Inc.',
          productname: 'Canon EOS R5 (Test)',
          firmwareversion: '2.0.0',
        });
        setConnStatus('connected');
        setHasUnlockedSession(true);
        setLastCheckedAt(Date.now());
        if (!isReconnect) {
          setActiveTab('tether');
          showToast('Đã kết nối máy ảnh Test (0.0.0.0:8080)');
        } else {
          showToast('Đã kết nối lại máy ảnh Test (0.0.0.0:8080)');
        }
        return;
      }

      setMode('ccapi');
      setConnStatus('connecting');
      setConnError(null);
      heartbeatFailuresRef.current = 0;

      if (!isReconnect) {
        seenCcapiUrlsRef.current.clear();
      }

      const TOTAL_TIMEOUT_MS = 5000;
      const deadlineAt = Date.now() + TOTAL_TIMEOUT_MS;
      const probeAbort = new AbortController();
      const deadlineTimer = setTimeout(() => probeAbort.abort(), TOTAL_TIMEOUT_MS);

      try {
        // Step 1: Try discovering exact CCAPI endpoints from /ccapi manifest (max 2.5s of 5s budget)
        let discoveredEndpoints: CcapiEndpoints | null = null;
        try {
          const manifestTimeout = Math.max(300, Math.min(2500, deadlineAt - Date.now()));
          const manifest = (await callCcapiPath(
            '/ccapi',
            'GET',
            undefined,
            manifestTimeout,
            probeAbort.signal,
          )) as Record<string, unknown>;
          if (manifest && typeof manifest === 'object') {
            discoveredEndpoints = parseCcapiManifest(manifest);
          }
        } catch {
          /* fallback to parallel version probing within remaining 5s budget */
        }

        if (probeAbort.signal.aborted) {
          throw new Error('Hết thời gian phản hồi từ máy ảnh Canon');
        }

        const candidates: CcapiEndpoints[] = discoveredEndpoints
          ? [discoveredEndpoints]
          : (['ver100', 'ver110', 'ver120'] as const).map((ver) => ({
              deviceInfo: `/ccapi/${ver}/deviceinformation`,
              polling: `/ccapi/${ver}/event/polling`,
              pollingSupportsContinue: ver !== 'ver100',
              shutter: `/ccapi/${ver}/shooting/control/shutterbutton`,
              shutterManual: `/ccapi/${ver}/shooting/control/shutterbutton/manual`,
              storage: `/ccapi/${ver}/devicestatus/storage`,
              contents: `/ccapi/${ver}/contents`,
              wb: `/ccapi/${ver}/shooting/settings/wb`,
              colorTemp: `/ccapi/${ver}/shooting/settings/colortemperature`,
            }));

        const remainingMs = Math.max(250, deadlineAt - Date.now());
        const { ep, info } = await Promise.any(
          candidates.map(async (candidate) => {
            const devInfo = (await callCcapiPath(
              candidate.deviceInfo,
              'GET',
              undefined,
              remainingMs,
              probeAbort.signal,
            )) as CcapiDeviceInfo;
            return { ep: candidate, info: devInfo };
          }),
        );

        endpointsRef.current = ep;
        setCcapiEndpoints(ep);
        setDeviceInfo(info);
        setConnStatus('connected');
        setHasUnlockedSession(true);
        setLastCheckedAt(Date.now());
        if (!isReconnect) {
          setActiveTab('tether');
          showToast(`Đã kết nối ${info.productname || 'máy ảnh Canon'}`);
          // Baseline existing card files in background so sync only grabs new shots
          void syncNewestFromStorage(true, ep);
        } else {
          showToast(`Đã kết nối lại ${info.productname || 'máy ảnh Canon'}`);
          void syncNewestFromStorage(false, ep);
        }
        return;
      } catch (err: unknown) {
        const primaryErr =
          err instanceof AggregateError ? (err.errors?.[0] ?? err) : err;
        setConnStatus('error');
        const baseErr = probeAbort.signal.aborted
          ? ''
          : formatConnectionErrorMessage(primaryErr, '');
        const errMsg = baseErr
          ? `${baseErr}. Hãy đảm bảo máy ảnh Canon đã bật Camera Control API và dùng chung mạng Wi-Fi.`
          : 'Hãy đảm bảo máy ảnh Canon đã bật Camera Control API và dùng chung mạng Wi-Fi.';
        setConnError(errMsg);
        if (isReconnect) {
          showToast('Không thể kết nối lại máy ảnh Canon');
        }
      } finally {
        clearTimeout(deadlineTimer);
      }
    },
    [callCcapiPath, cameraIp, cameraPort, showToast, syncNewestFromStorage],
  );

  const handleConnectCcapi = useCallback(() => {
    void probeAndConnect(false);
  }, [probeAndConnect]);

  const handleReconnectCcapi = useCallback(() => {
    if (connStatus === 'connecting') return;
    void probeAndConnect(true);
  }, [connStatus, probeAndConnect]);

  const handleDisconnectCcapi = useCallback(() => {
    heartbeatFailuresRef.current = 0;
    setShowCameraPopup(false);
    setHasUnlockedSession(false);
    setConnStatus('disconnected');
    setDeviceInfo(null);
    setConnError(null);
    setLastCheckedAt(null);
    setActiveTab('connect');
    showToast('Đã ngắt kết nối máy ảnh');
  }, [showToast]);

  const handleCheckConnection = useCallback(async () => {
    if (isCheckingConnectionRef.current) return;
    if (mode === 'simulator') {
      setLastCheckedAt(Date.now());
      showToast('Kết nối máy ảnh Test (0.0.0.0:8080) ổn định');
      return;
    }
    if (mode !== 'ccapi') return;
    isCheckingConnectionRef.current = true;
    setCheckingConnection(true);
    try {
      const info = (await callCcapiPath(
        endpointsRef.current.deviceInfo,
        'GET',
        undefined,
        4500,
      )) as CcapiDeviceInfo;
      heartbeatFailuresRef.current = 0;
      setDeviceInfo(info);
      setConnError(null);
      setConnStatus('connected');
      setLastCheckedAt(Date.now());
      showToast('Kết nối với máy ảnh Canon ổn định');
    } catch (err: unknown) {
      setConnStatus('error');
      const detail = formatConnectionErrorMessage(err, '');
      setConnError(detail ? `${detail}. Máy ảnh không phản hồi.` : 'Máy ảnh không phản hồi.');
      showToast('Mất kết nối với máy ảnh Canon');
    } finally {
      isCheckingConnectionRef.current = false;
      setCheckingConnection(false);
    }
  }, [callCcapiPath, mode, showToast]);

  // ── Periodic Camera Connection Heartbeat (every 5s while connected) ──
  useEffect(() => {
    if (!hasUnlockedSession || mode !== 'ccapi' || connStatus !== 'connected') return;

    let active = true;
    const runHeartbeat = async () => {
      if (!active || isCheckingConnectionRef.current) return;
      isCheckingConnectionRef.current = true;
      try {
        await callCcapiPath(endpointsRef.current.deviceInfo, 'GET', undefined, 4000);
        if (!active) return;
        heartbeatFailuresRef.current = 0;
        setLastCheckedAt(Date.now());
      } catch (err: unknown) {
        if (!active) return;
        heartbeatFailuresRef.current += 1;
        if (heartbeatFailuresRef.current >= 2) {
          setConnStatus('error');
          const detail = formatConnectionErrorMessage(err, '');
          setConnError(
            detail ? `${detail}. Mất kết nối với máy ảnh Canon.` : 'Mất kết nối Wi-Fi với máy ảnh Canon',
          );
          showToast('Mất kết nối với máy ảnh Canon');
        }
      } finally {
        isCheckingConnectionRef.current = false;
      }
    };

    const intervalId = setInterval(() => {
      void runHeartbeat();
    }, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [hasUnlockedSession, mode, connStatus, callCcapiPath, showToast]);

  // ── CCAPI Event Polling Loop (single clean abortable loop) ───────
  useEffect(() => {
    if (mode !== 'ccapi' || connStatus !== 'connected') return;

    let active = true;
    let useContinueParam = ccapiEndpoints.pollingSupportsContinue;
    const abortController = new AbortController();

    const loop = async () => {
      while (active) {
        const startedAt = Date.now();
        try {
          const pollUrl = useContinueParam
            ? `${ccapiEndpoints.polling}?continue=on`
            : ccapiEndpoints.polling;

          const evt = (await callCcapiPath(
            pollUrl,
            'GET',
            undefined,
            62000,
            abortController.signal,
          )) as {
            addedcontents?: string[];
            updatedcontents?: string[];
          };

          if (!active) break;
          heartbeatFailuresRef.current = 0;
          const incoming = [
            ...(Array.isArray(evt?.addedcontents) ? evt.addedcontents : []),
            ...(Array.isArray(evt?.updatedcontents) ? evt.updatedcontents : []),
          ];

          if (incoming.length > 0) {
            ingestCameraContentPaths(incoming);
          }

          // If camera answered immediately with no events, avoid tight spin
          const elapsed = Date.now() - startedAt;
          if (incoming.length === 0 && elapsed < 350) {
            await new Promise((r) => setTimeout(r, 400));
          }
        } catch (err: unknown) {
          if (!active || abortController.signal.aborted) break;
          if (err instanceof Error && err.name === 'AbortError') break;
          if (useContinueParam && err instanceof CcapiHttpError && err.status === 400) {
            useContinueParam = false;
            continue;
          }
          // Verify immediately if camera is still reachable
          if (!isCheckingConnectionRef.current) {
            isCheckingConnectionRef.current = true;
            try {
              await callCcapiPath(
                endpointsRef.current.deviceInfo,
                'GET',
                undefined,
                3500,
                abortController.signal,
              );
              if (active) {
                setLastCheckedAt(Date.now());
              }
            } catch (pingErr: unknown) {
              if (!active || abortController.signal.aborted) break;
              setConnStatus('error');
              const detail = formatConnectionErrorMessage(pingErr, '');
              setConnError(
                detail ? `${detail}. Mất kết nối với máy ảnh Canon.` : 'Mất kết nối Wi-Fi với máy ảnh Canon',
              );
              showToast('Mất kết nối với máy ảnh Canon');
              break;
            } finally {
              isCheckingConnectionRef.current = false;
            }
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    };

    void loop();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [mode, connStatus, ccapiEndpoints, callCcapiPath, ingestCameraContentPaths, showToast]);

  const simulateCameraCapture = useCallback(() => {
    const idx = simShotCountRef.current;
    simShotCountRef.current += 1;
    const template = SIMULATOR_ROTATION[idx % SIMULATOR_ROTATION.length];
    const shotNum = String(43 + idx).padStart(4, '0');
    const filename = `IMG_${shotNum}.JPG`;
    const isos = ['ISO 100', 'ISO 160', 'ISO 200', 'ISO 400'];
    const apertures = ['f/2.0', 'f/2.8', 'f/4.0', 'f/5.6'];
    const shutters = ['1/200s', '1/250s', '1/160s', '1/320s'];
    const wbs = ['5400K Studio', '5200K Daylight', '5600K Flash', '5500K Studio'];

    const newPhoto: TetherPhoto = {
      id: `sim-${Date.now()}-${idx}-${filename}`,
      filename,
      url: template.url,
      fullUrl: template.url,
      timestamp: Date.now(),
      exif: {
        iso: isos[idx % isos.length],
        aperture: apertures[idx % apertures.length],
        shutterSpeed: shutters[idx % shutters.length],
        focalLength: template.focalLength,
        lens: template.lens,
        whiteBalance: wbs[idx % wbs.length],
      },
      isFastPreview: false,
      isOriginal: true,
      source: 'simulator',
      sizeLabel: template.sizeLabel,
    };

    const currentLockedSlot = lockedSlotRef.current;
    setPhotos((prev) => [...prev, newPhoto]);
    setSelectedPhoto(newPhoto);
    if (currentLockedSlot === 'A') {
      setCompareB(newPhoto);
    } else if (currentLockedSlot === 'B') {
      setCompareA(newPhoto);
    } else {
      setCompareA(newPhoto);
      setCompareB(newPhoto);
    }
    showToast(`Đã nhận ${filename} từ máy ảnh Canon`);
  }, [showToast]);

  // ── Keyboard Shortcuts (= = Simulate Capture in Test Mode, C = Compare, G = Gallery, ` = Simulate Disconnect in Test Mode) ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAppUnlocked) return;
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        return;
      }

      const isTestMode =
        mode === 'simulator' &&
        cameraIp.trim() === '0.0.0.0' &&
        (cameraPort.trim() || '8080') === '8080';

      if ((e.key === '=' || (e.code === 'Equal' && !e.shiftKey)) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!isTestMode) return;
        e.preventDefault();
        simulateCameraCapture();
      } else if ((e.key === '`' || e.code === 'Backquote') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!isTestMode) return;
        e.preventDefault();
        heartbeatFailuresRef.current = 0;
        setConnStatus('error');
        setConnError('Mất kết nối Wi-Fi với máy ảnh Canon');
        showToast('Mất kết nối với máy ảnh Canon');
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (photos.length === 0) return;
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const currentPhoto =
          activeTab === 'compare'
            ? activeCompareSlot === 'A'
              ? compareA
              : compareB
            : selectedPhoto;
        const currentIdx = currentPhoto
          ? photos.findIndex((p) => p.id === currentPhoto.id)
          : -1;
        const nextIdx =
          currentIdx === -1
            ? delta > 0
              ? 0
              : photos.length - 1
            : Math.max(0, Math.min(photos.length - 1, currentIdx + delta));
        const nextPhoto = photos[nextIdx];
        if (!nextPhoto) return;

        if (activeTab === 'compare') {
          if (activeCompareSlot === 'A') setCompareA(nextPhoto);
          else setCompareB(nextPhoto);
        } else {
          setSelectedPhoto(nextPhoto);
        }

        requestAnimationFrame(() => {
          const thumbEl = filmstripRef.current?.querySelector(
            `[data-photo-id="${CSS.escape(nextPhoto.id)}"]`,
          );
          if (thumbEl instanceof HTMLElement) {
            thumbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        });
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        setActiveTab((t) => (t === 'compare' ? 'tether' : 'compare'));
      } else if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
        setActiveTab((t) => (t === 'gallery' ? 'tether' : 'gallery'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isAppUnlocked,
    mode,
    cameraIp,
    cameraPort,
    activeTab,
    activeCompareSlot,
    photos,
    selectedPhoto,
    compareA,
    compareB,
    showToast,
    simulateCameraCapture,
  ]);

  const upgradePhotoToOriginal = useCallback(
    async (photo: TetherPhoto): Promise<string> => {
      const rawTarget = photo.fullUrl || photo.url;
      const isRawFile = /\.(cr2|cr3|raw)$/i.test(photo.filename);

      if (photo.source === 'simulator' && !photo.isOriginal && rawTarget && rawTarget !== photo.url) {
        let nextSize = photo.sizeLabel;
        try {
          const resp = await fetch(rawTarget);
          const blob = await resp.blob();
          nextSize = formatFileSize(blob.size);
        } catch {
          /* keep existing sizeLabel */
        }
        const applyUpgrade = (p: TetherPhoto): TetherPhoto => ({
          ...p,
          url: rawTarget,
          fullUrl: rawTarget,
          sizeLabel: nextSize,
          isFastPreview: false,
          isOriginal: true,
        });
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? applyUpgrade(p) : p)));
        setSelectedPhoto((curr) => (curr?.id === photo.id ? applyUpgrade(curr) : curr));
        setCompareA((curr) => (curr?.id === photo.id ? applyUpgrade(curr) : curr));
        setCompareB((curr) => (curr?.id === photo.id ? applyUpgrade(curr) : curr));
        return rawTarget;
      }

      if (!rawTarget.startsWith('http')) return rawTarget;

      showToast(`Đang tải file gốc từ máy ảnh cho ${photo.filename}...`);
      const resolved = await resolveCameraImageUrl(rawTarget);
      const upgradedSize = isRawFile
        ? `RAW · ${formatFileSize(resolved.sizeBytes)}`
        : formatFileSize(resolved.sizeBytes);
      const upgradedExif = isRawFile ? null : await parseExifFromBlob(resolved.blob);
      const nextExif =
        upgradedExif && upgradedExif.iso !== '—' ? upgradedExif : photo.exif;

      const applyUpgrade = (p: TetherPhoto): TetherPhoto => ({
        ...p,
        // Keep JPEG preview in p.url for RAW files since <img> cannot render raw CR2/CR3 bytes
        url: isRawFile ? p.url : resolved.objectUrl,
        fullUrl: resolved.objectUrl,
        exif: nextExif,
        sizeLabel: upgradedSize,
        isFastPreview: isRawFile ? p.isFastPreview : false,
        isOriginal: true,
      });

      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? applyUpgrade(p) : p)));
      setSelectedPhoto((curr) => (curr?.id === photo.id ? applyUpgrade(curr) : curr));
      setCompareA((curr) => (curr?.id === photo.id ? applyUpgrade(curr) : curr));
      setCompareB((curr) => (curr?.id === photo.id ? applyUpgrade(curr) : curr));
      return resolved.objectUrl;
    },
    [showToast],
  );

  const handleDownloadOriginal = async (photo: TetherPhoto) => {
    const rawTarget = photo.fullUrl || photo.url;
    try {
      let resolvedUrl = rawTarget;
      if (!photo.isOriginal && (rawTarget.startsWith('http') || photo.source === 'simulator')) {
        resolvedUrl = await upgradePhotoToOriginal(photo);
      } else if (rawTarget.startsWith('http')) {
        showToast(`Đang tải file gốc từ máy ảnh cho ${photo.filename}...`);
        const resolved = await resolveCameraImageUrl(rawTarget);
        resolvedUrl = resolved.objectUrl;
      }

      await savePhotoToDevice(resolvedUrl, photo.filename);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : `Không thể tải ${photo.filename}`);
    }
  };

  const handleBatchDownloadOriginals = async (targetPhotos: TetherPhoto[]) => {
    if (targetPhotos.length === 0) return;

    try {
      const hasCameraOriginals = targetPhotos.some(
        (p) => (p.fullUrl || p.url).startsWith('http') || (!p.isOriginal && p.source === 'simulator'),
      );
      if (hasCameraOriginals) {
        showToast(`Đang tải file gốc từ máy ảnh cho ${targetPhotos.length} ảnh...`);
      }

      const upgradeMap = new Map<
        string,
        { url: string; fullUrl: string; exif?: PhotoExif; sizeLabel?: string; isRaw: boolean }
      >();
      const resolvedItems: Array<{ photo: TetherPhoto; url: string }> = [];

      for (const photo of targetPhotos) {
        const isRawFile = /\.(cr2|cr3|raw)$/i.test(photo.filename);
        let originalUrl = photo.fullUrl || photo.url;
        let nextExif: PhotoExif | undefined;
        let nextSize: string | undefined;

        if (originalUrl.startsWith('http')) {
          const resolved = await resolveCameraImageUrl(originalUrl);
          originalUrl = resolved.objectUrl;
          nextExif = isRawFile ? undefined : await parseExifFromBlob(resolved.blob);
          nextSize = isRawFile
            ? `RAW · ${formatFileSize(resolved.sizeBytes)}`
            : formatFileSize(resolved.sizeBytes);
        } else if (!photo.isOriginal && photo.source === 'simulator' && originalUrl !== photo.url) {
          try {
            const resp = await fetch(originalUrl);
            const blob = await resp.blob();
            nextSize = formatFileSize(blob.size);
          } catch {
            /* keep existing sizeLabel */
          }
        }

        if (!photo.isOriginal) {
          upgradeMap.set(photo.id, {
            url: isRawFile ? photo.url : originalUrl,
            fullUrl: originalUrl,
            exif: nextExif,
            sizeLabel: nextSize,
            isRaw: isRawFile,
          });
        }
        resolvedItems.push({ photo, url: originalUrl });
      }

      if (upgradeMap.size > 0) {
        const applyMap = (p: TetherPhoto): TetherPhoto => {
          const upgraded = upgradeMap.get(p.id);
          return upgraded
            ? {
                ...p,
                url: upgraded.url,
                fullUrl: upgraded.fullUrl,
                exif: upgraded.exif && upgraded.exif.iso !== '—' ? upgraded.exif : p.exif,
                sizeLabel: upgraded.sizeLabel || p.sizeLabel,
                isFastPreview: upgraded.isRaw ? p.isFastPreview : false,
                isOriginal: true,
              }
            : p;
        };
        setPhotos((prev) => prev.map(applyMap));
        setSelectedPhoto((curr) => (curr ? applyMap(curr) : curr));
        setCompareA((curr) => (curr ? applyMap(curr) : curr));
        setCompareB((curr) => (curr ? applyMap(curr) : curr));
      }

      if (typeof navigator.share === 'function' && resolvedItems.length > 1) {
        try {
          const files = await Promise.all(
            resolvedItems.map(async ({ photo, url }) => {
              const resp = await fetch(url);
              const blob = await resp.blob();
              return new File([blob], photo.filename, { type: blob.type || 'image/jpeg' });
            }),
          );
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
            await navigator.share({ files, title: `${files.length} ảnh Canon Tether` });
            showToast(`Đã chuẩn bị ${files.length} ảnh gốc từ máy ảnh để lưu`);
            return;
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
        }
      }

      for (let i = 0; i < resolvedItems.length; i++) {
        const { photo, url } = resolvedItems[i];
        await savePhotoToDevice(url, photo.filename);
        if (i < resolvedItems.length - 1) {
          await new Promise((r) => setTimeout(r, 220));
        }
      }

      showToast(`Đã tải file gốc cho ${targetPhotos.length} ảnh đã chọn`);
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Không thể tải file gốc từ máy ảnh Canon',
      );
    }
  };

  const handleDeletePhoto = (id: string) => {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedPhoto?.id === id) setSelectedPhoto(next[next.length - 1] ?? null);
      if (compareA?.id === id) setCompareA(next[next.length - 1] ?? null);
      if (compareB?.id === id) setCompareB(next[next.length - 2] ?? next[next.length - 1] ?? null);
      return next;
    });
  };

  const handleBatchDeletePhotos = (ids: string[]) => {
    const idSet = new Set(ids);
    setPhotos((prev) => {
      const next = prev.filter((p) => !idSet.has(p.id));
      if (selectedPhoto && idSet.has(selectedPhoto.id)) {
        setSelectedPhoto(next[next.length - 1] ?? null);
      }
      if (compareA && idSet.has(compareA.id)) setCompareA(next[next.length - 1] ?? null);
      if (compareB && idSet.has(compareB.id)) {
        setCompareB(next[next.length - 2] ?? next[next.length - 1] ?? null);
      }
      return next;
    });
    showToast(`Đã xoá ${ids.length} ảnh`);
  };

  const handleImportExternal = async (slot: 'A' | 'B', file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const exif = await parseExifFromBlob(file);
    const imported: TetherPhoto = {
      id: `local-${Date.now()}-${file.name}`,
      filename: file.name,
      url: objectUrl,
      fullUrl: objectUrl,
      timestamp: Date.now(),
      exif,
      isFastPreview: false,
      isOriginal: true,
      source: 'local',
      sizeLabel: formatFileSize(file.size),
    };

    setPhotos((prev) => [...prev, imported]);
    if (slot === 'A') setCompareA(imported);
    else setCompareB(imported);
    showToast(`Đã nạp ${file.name} vào khung ${slot}`);
  };

  const handleImportGalleryFiles = async (fileList: FileList) => {
    const items: TetherPhoto[] = await Promise.all(
      Array.from(fileList).map(async (file, idx) => {
        const url = URL.createObjectURL(file);
        const exif = await parseExifFromBlob(file);
        return {
          id: `local-${Date.now()}-${idx}-${file.name}`,
          filename: file.name,
          url,
          fullUrl: url,
          timestamp: Date.now() + idx,
          exif,
          isFastPreview: false,
          isOriginal: true,
          source: 'local',
          sizeLabel: formatFileSize(file.size),
        };
      }),
    );
    setPhotos((prev) => [...prev, ...items]);
    if (items[items.length - 1]) setSelectedPhoto(items[items.length - 1]);
    showToast(`Đã thêm ${items.length} ảnh vào thư viện`);
  };

  const handleSelectFilmstrip = (photo: TetherPhoto) => {
    if (activeTab === 'compare') {
      if (activeCompareSlot === 'A') setCompareA(photo);
      else setCompareB(photo);
    } else {
      setSelectedPhoto(photo);
      if (activeTab === 'gallery') {
        setActiveTab('tether');
      }
    }
  };

  useEffect(() => {
    if (photos.length > prevPhotoCountRef.current && filmstripRef.current) {
      filmstripRef.current.scrollTo({
        left: filmstripRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
    prevPhotoCountRef.current = photos.length;
  }, [photos.length]);

  useEffect(() => {
    if (!showCameraPopup) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        cameraPopupContainerRef.current &&
        !cameraPopupContainerRef.current.contains(e.target as Node)
      ) {
        setShowCameraPopup(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCameraPopup(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCameraPopup]);

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#0A0A0B] text-zinc-100 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Top Bar Contract: 3 clean zones separated by symmetric grid so Zone 2 never shifts */}
      <header className="relative z-30 h-12 mobile-landscape:h-10 wide:h-14 shrink-0 px-4 sm:px-6 border-b border-white/10 bg-[#0E0E11] flex items-center justify-between wide:grid wide:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 wide:gap-8">
        {/* Zone 1: Brand Wordmark Button + Static Camera Name + Camera Info Popup */}
        <div ref={cameraPopupContainerRef} className="relative justify-self-start flex items-center gap-2 wide:gap-2.5 min-w-0 flex-1 wide:flex-initial max-w-full">
          <button
            type="button"
            aria-expanded={isAppUnlocked ? showCameraPopup : undefined}
            aria-haspopup={isAppUnlocked ? 'dialog' : undefined}
            onClick={() => {
              if (isAppUnlocked) {
                setShowCameraPopup((prev) => !prev);
              } else {
                setActiveTab('connect');
              }
            }}
            className="text-sm sm:text-base font-display font-bold tracking-tight text-white hover:text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Canon Tether Studio
          </button>

          {isAppUnlocked && (
            <motion.div
              aria-hidden={showCameraPopup}
              initial={false}
              animate={{
                opacity: showCameraPopup ? 0 : 1,
                x: showCameraPopup ? -6 : 0,
              }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className={`flex items-center gap-2 wide:gap-2.5 min-w-0 will-change-[transform,opacity] ${
                showCameraPopup ? 'pointer-events-none select-none' : ''
              }`}
            >
              <span
                className={`${
                  activeTab === 'tether' ? 'hidden md:inline-block' : 'hidden wide:inline-block'
                } h-4 w-px bg-white/15 shrink-0`}
                aria-hidden="true"
              />
              <div
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 min-w-0"
                title={deviceInfo?.productname || 'Canon Camera'}
              >
                {connStatus === 'connected' ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : connStatus === 'connecting' ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span
                  className={`${
                    activeTab === 'tether' ? 'hidden md:inline' : 'hidden wide:inline'
                  } truncate max-w-[200px]`}
                >
                  {deviceInfo?.productname || 'Canon Camera'}
                </span>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {isAppUnlocked && showCameraPopup && (
              <CameraConnectionPopup
                mode={mode}
                connStatus={connStatus}
                connError={connError}
                cameraIp={cameraIp}
                cameraPort={cameraPort}
                checkingConnection={checkingConnection}
                lastCheckedAt={lastCheckedAt}
                deviceInfo={deviceInfo}
                onCheckConnection={handleCheckConnection}
                onReconnectCcapi={handleReconnectCcapi}
                onDisconnectCcapi={handleDisconnectCcapi}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Zone 2: Concise single-line navigation links (Desktop & iPad Landscape) */}
        <nav className="hidden wide:flex justify-self-center h-full items-center gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            isAppUnlocked
              ? ([
                  { id: 'tether', label: 'Tether Studio' },
                  { id: 'compare', label: 'So sánh' },
                  { id: 'gallery', label: 'Thư viện' },
                ] as const)
              : ([] as const)
          ).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative h-full inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="header-tab-underline"
                    transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }}
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-rose-500 pointer-events-none"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="justify-self-end shrink-0">
          {isAppUnlocked && connStatus !== 'connected' && (
            <button
              type="button"
              onClick={handleReconnectCcapi}
              disabled={connStatus === 'connecting'}
              className="inline-flex items-center gap-1.5 wide:gap-2 px-3 wide:px-4 py-1.5 wide:py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connStatus === 'connecting' ? 'animate-spin' : ''}`} />
              <span>{connStatus === 'connecting' ? 'Đang Reconnect...' : 'Reconnect'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={tabDirection}>
            {(!isAppUnlocked || activeTab === 'connect') && (
              <motion.div
                key="tab-connect"
                custom={tabDirection}
                variants={TAB_PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={TAB_TRANSITION}
                className="flex-1 min-h-0 w-full h-full flex flex-col will-change-[transform,opacity]"
              >
                <ConnectView
                  mode={mode}
                  connStatus={connStatus}
                  cameraIp={cameraIp}
                  cameraPort={cameraPort}
                  onChangeIp={setCameraIp}
                  onChangePort={setCameraPort}
                  onConnectCcapi={handleConnectCcapi}
                  onDisconnect={handleDisconnectCcapi}
                  onEnterStudio={() => setActiveTab('tether')}
                  deviceInfo={deviceInfo}
                  connError={connError}
                />
              </motion.div>
            )}

            {isAppUnlocked && activeTab === 'tether' && (
              <motion.div
                key="tab-tether"
                custom={tabDirection}
                variants={TAB_PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={TAB_TRANSITION}
                className="flex-1 min-h-0 w-full h-full flex flex-col will-change-[transform,opacity]"
              >
                <TetherWorkspace
                  selectedPhoto={selectedPhoto}
                  onDownloadOriginal={handleDownloadOriginal}
                  onDeletePhoto={handleDeletePhoto}
                />
              </motion.div>
            )}

            {isAppUnlocked && activeTab === 'compare' && (
              <motion.div
                key="tab-compare"
                custom={tabDirection}
                variants={TAB_PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={TAB_TRANSITION}
                className="flex-1 min-h-0 w-full h-full flex flex-col will-change-[transform,opacity]"
              >
                <CompareStage
                  photoA={compareA}
                  photoB={compareB}
                  activeSlot={activeCompareSlot}
                  onSelectSlot={setActiveCompareSlot}
                  lockedSlot={lockedSlot}
                  onToggleLockSlot={(slot) =>
                    setLockedSlot((curr) => (curr === slot ? null : slot))
                  }
                  onSwap={() => {
                    setCompareA(compareB);
                    setCompareB(compareA);
                  }}
                  onImportExternal={handleImportExternal}
                  onDownloadOriginal={handleDownloadOriginal}
                />
              </motion.div>
            )}

            {isAppUnlocked && activeTab === 'gallery' && (
              <motion.div
                key="tab-gallery"
                custom={tabDirection}
                variants={TAB_PANEL_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={TAB_TRANSITION}
                className="flex-1 min-h-0 w-full h-full flex flex-col will-change-[transform,opacity]"
              >
                <GalleryModal
                  photos={photos}
                  selectedId={selectedPhoto?.id ?? null}
                  onSelectPhoto={(photo) => {
                    setSelectedPhoto(photo);
                    setActiveTab('tether');
                  }}
                  onBatchDeletePhotos={handleBatchDeletePhotos}
                  onBatchDownloadOriginals={handleBatchDownloadOriginals}
                  onImportPhotos={handleImportGalleryFiles}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pull/Toggle Arrow Handle for Recent Photos Filmstrip (All Modes) */}
        {isAppUnlocked && (activeTab === 'tether' || activeTab === 'compare') && (
          <div className="relative z-20 shrink-0 h-6 mobile-landscape:h-0 border-t mobile-landscape:border-t-0 border-white/10 bg-[#0E0E11] mobile-landscape:bg-transparent flex items-center justify-center">
            <button
              type="button"
              onPointerDown={(e) => {
                filmstripDragStartYRef.current = e.clientY;
                filmstripDraggedRef.current = false;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
              }}
              onPointerMove={(e) => {
                if (filmstripDragStartYRef.current === null) return;
                const dy = e.clientY - filmstripDragStartYRef.current;
                if (dy < -14 && !isFilmstripOpen) {
                  setIsFilmstripOpen(true);
                  filmstripDraggedRef.current = true;
                  filmstripDragStartYRef.current = null;
                } else if (dy > 14 && isFilmstripOpen) {
                  setIsFilmstripOpen(false);
                  filmstripDraggedRef.current = true;
                  filmstripDragStartYRef.current = null;
                }
              }}
              onPointerUp={(e) => {
                if (filmstripDragStartYRef.current !== null && !filmstripDraggedRef.current) {
                  setIsFilmstripOpen((v) => !v);
                }
                filmstripDragStartYRef.current = null;
                try {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                } catch {
                  /* ignore */
                }
              }}
              onPointerCancel={() => {
                filmstripDragStartYRef.current = null;
              }}
              onClick={(e) => {
                if (e.detail === 0) {
                  setIsFilmstripOpen((v) => !v);
                }
              }}
              aria-expanded={isFilmstripOpen}
              aria-label={isFilmstripOpen ? 'Thu gọn ảnh gần đây' : 'Mở ảnh gần đây'}
              title={isFilmstripOpen ? 'Thu gọn ảnh gần đây' : 'Mở ảnh gần đây'}
              className="w-full h-full mobile-landscape:w-auto mobile-landscape:h-6 mobile-landscape:-translate-y-full mobile-landscape:px-4 mobile-landscape:rounded-t-lg mobile-landscape:bg-[#141418]/92 mobile-landscape:backdrop-blur-md mobile-landscape:border mobile-landscape:border-b-0 mobile-landscape:border-white/15 mobile-landscape:shadow-lg text-zinc-400 hover:text-white hover:bg-white/[0.03] mobile-landscape:hover:bg-[#141418] flex items-center justify-center transition-colors touch-none select-none cursor-pointer"
            >
              <ChevronUp
                className={`w-4 h-4 transition-transform duration-200 ${
                  isFilmstripOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        )}

        {/* Bottom Filmstrip (visible on Tether Studio & Compare tabs when expanded via bottom arrow) */}
        <AnimatePresence initial={false}>
          {isAppUnlocked &&
            (activeTab === 'tether' || activeTab === 'compare') &&
            isFilmstripOpen && (
              <motion.div
                key="bottom-filmstrip"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="relative shrink-0 border-t border-white/10 bg-[#0E0E11] overflow-hidden"
              >
                <div className="absolute top-1.5 right-3 z-10 px-2 py-0.5 rounded bg-[#0E0E11]/90 backdrop-blur-sm border border-white/10 text-[11px] font-mono font-medium text-zinc-200 tabular-nums pointer-events-none">
                  {photos.length} ảnh
                </div>
              <div
                ref={filmstripRef}
                className="h-20 mobile-landscape:h-16 sm:h-24 wide:h-26 px-3 wide:px-4 pr-18 wide:pr-20 py-1.5 wide:py-2 flex items-center gap-2.5 wide:gap-3 overflow-x-auto"
              >
                {photos.map((photo, index) => {
                  const isSelected = activeTab === 'tether' && selectedPhoto?.id === photo.id;
                  const isA = activeTab === 'compare' && compareA?.id === photo.id;
                  const isB = activeTab === 'compare' && compareB?.id === photo.id;

                  const borderClass = isSelected
                    ? 'border-rose-500'
                    : isA
                      ? 'border-emerald-500'
                      : isB
                        ? 'border-amber-500'
                        : 'border-white/10 hover:border-white/30';

                  return (
                    <button
                      key={photo.id}
                      data-photo-id={photo.id}
                      type="button"
                      onClick={() => handleSelectFilmstrip(photo)}
                      className={`relative w-24 h-16 mobile-landscape:w-20 mobile-landscape:h-13 sm:w-28 sm:h-20 shrink-0 rounded-lg overflow-hidden border-2 bg-black transition-colors cursor-pointer ${borderClass}`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 border border-white/15 text-[10px] font-mono font-semibold text-white tabular-nums">
                        {index + 1}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 py-0.5 flex items-center justify-between text-[10px] font-mono text-zinc-200">
                        <span className="truncate">{photo.filename}</span>
                        <span>{photo.isOriginal ? 'HD' : '⚡'}</span>
                      </div>
                      {(isA || isB) && (
                        <span
                          className={`absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold rounded text-black ${
                            isA ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        >
                          {isA && isB ? 'A/B' : isA ? 'A' : 'B'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Tab Bar (Mobile & iPad Portrait): 3 title buttons anchored at the bottom of the screen */}
      {isAppUnlocked && (
        <nav
          aria-label="Điều hướng chính"
          className="wide:hidden shrink-0 h-12 mobile-landscape:h-10 sm:h-13 border-t border-white/10 bg-[#0E0E11] grid grid-cols-3 items-stretch z-20"
        >
          {(
            [
              { id: 'tether', label: 'Tether Studio' },
              { id: 'compare', label: 'So sánh' },
              { id: 'gallery', label: 'Thư viện' },
            ] as const
          ).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative h-full inline-flex items-center justify-center px-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-white' : 'text-zinc-400 active:text-zinc-200'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="mobile-tab-underline"
                    transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }}
                    className="absolute inset-x-4 top-0 h-0.5 bg-rose-500 rounded-b-full pointer-events-none"
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Subtle Toast Feedback */}
      {toastMsg && (
        <div
          className={`fixed ${
            isFilmstripOpen
              ? 'bottom-36 wide:bottom-32'
              : 'bottom-20 wide:bottom-12'
          } mobile-landscape:bottom-14 right-4 wide:right-6 z-50 px-4 py-2.5 rounded-lg bg-[#18181D] border border-white/15 text-xs font-medium text-zinc-100 shadow-2xl`}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
