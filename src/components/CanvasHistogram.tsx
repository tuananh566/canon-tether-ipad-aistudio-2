import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Minimize2, Maximize2, X } from 'lucide-react';

type ChannelMode = 'RGB' | 'LUMA' | 'R' | 'G' | 'B';

interface HistogramBuckets {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
  highlightClipPct: number;
  shadowCrushPct: number;
}

interface CanvasHistogramProps {
  imageUrl: string | null;
  onClose?: () => void;
  embedded?: boolean;
}

const BINS = 48;

export const CanvasHistogram: React.FC<CanvasHistogramProps> = ({
  imageUrl,
  onClose,
  embedded = false,
}) => {
  const [channel, setChannel] = useState<ChannelMode>('LUMA');
  const [minimized, setMinimized] = useState(false);
  const [data, setData] = useState<HistogramBuckets | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setData(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const targetW = 160;
        const targetH = Math.max(1, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * targetW));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const pixels = ctx.getImageData(0, 0, targetW, targetH).data;

        const rBins = new Array<number>(BINS).fill(0);
        const gBins = new Array<number>(BINS).fill(0);
        const bBins = new Array<number>(BINS).fill(0);
        const lBins = new Array<number>(BINS).fill(0);

        let highlightCount = 0;
        let shadowCount = 0;
        const totalPixels = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

          rBins[Math.min(BINS - 1, Math.floor((r / 256) * BINS))]++;
          gBins[Math.min(BINS - 1, Math.floor((g / 256) * BINS))]++;
          bBins[Math.min(BINS - 1, Math.floor((b / 256) * BINS))]++;
          lBins[Math.min(BINS - 1, Math.floor((l / 256) * BINS))]++;

          if (l >= 248) highlightCount++;
          if (l <= 6) shadowCount++;
        }

        const maxVal = Math.max(
          1,
          ...rBins.slice(1, BINS - 1),
          ...gBins.slice(1, BINS - 1),
          ...bBins.slice(1, BINS - 1),
          ...lBins.slice(1, BINS - 1),
        );

        const norm = (arr: number[]) => arr.map((v) => Math.min(1, v / maxVal));

        if (!cancelled) {
          setData({
            r: norm(rBins),
            g: norm(gBins),
            b: norm(bBins),
            luma: norm(lBins),
            highlightClipPct: Math.round((highlightCount / Math.max(1, totalPixels)) * 1000) / 10,
            shadowCrushPct: Math.round((shadowCount / Math.max(1, totalPixels)) * 1000) / 10,
          });
        }
      } catch {
        if (!cancelled) setData(null);
      }
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full rounded-xl border border-white/10 bg-[#151519] p-2.5 wide:p-3.5 select-none flex flex-col justify-between'
          : 'w-64 rounded-lg border border-white/10 bg-[#101013]/92 backdrop-blur-md p-2.5 shadow-xl select-none'
      }
    >
      <div className="flex items-center justify-between gap-1.5 wide:gap-2 mb-1.5 wide:mb-2">
        <div
          title="Histogram"
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-200 min-w-0"
        >
          <BarChart3 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className={embedded ? 'hidden sm:inline truncate' : ''}>Histogram</span>
        </div>

        {!minimized && (
          <div className="flex items-center gap-0.5 bg-white/5 rounded p-0.5 shrink-0">
            {(['LUMA', 'RGB', 'R', 'G', 'B'] as ChannelMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChannel(mode)}
                className={`px-1 wide:px-1.5 py-0.5 text-[9px] wide:text-[10px] font-mono rounded transition-colors cursor-pointer ${
                  channel === mode
                    ? 'bg-zinc-700 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode === 'LUMA' ? 'L' : mode}
              </button>
            ))}
          </div>
        )}

        {!embedded && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimized((v) => !v)}
              aria-label={minimized ? 'Mở rộng histogram' : 'Thu gọn histogram'}
              className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
            >
              {minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng histogram"
                className="p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {!minimized && (
        <>
          <div
            className={
              embedded
                ? 'relative h-14 sm:h-16 wide:h-20 w-full rounded bg-black/60 border border-white/5 overflow-hidden px-1 pt-1.5 wide:pt-2 flex items-end gap-[1px]'
                : 'relative h-20 w-full rounded bg-black/60 border border-white/5 overflow-hidden px-1 pt-2 flex items-end gap-[1px]'
            }
          >
            <div className="absolute inset-y-0 left-1/4 w-px bg-white/5 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
            <div className="absolute inset-y-0 left-3/4 w-px bg-white/5 pointer-events-none" />

            {data ? (
              <motion.div
                initial={{ opacity: 0, scaleY: 0.25 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full flex items-end gap-[1px] origin-bottom"
              >
                {data.luma.map((_, idx) => {
                  const rH = Math.round(data.r[idx] * 100);
                  const gH = Math.round(data.g[idx] * 100);
                  const bH = Math.round(data.b[idx] * 100);
                  const lH = Math.round(data.luma[idx] * 100);
                  const delayMs = idx * 4;

                  if (channel === 'RGB') {
                    return (
                      <div key={idx} className="relative flex-1 h-full flex items-end">
                        <div
                          className="absolute bottom-0 inset-x-0 bg-red-500/45 transition-[height] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ height: `${rH}%`, transitionDelay: `${delayMs}ms` }}
                        />
                        <div
                          className="absolute bottom-0 inset-x-0 bg-emerald-500/40 transition-[height] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ height: `${gH}%`, transitionDelay: `${delayMs}ms` }}
                        />
                        <div
                          className="absolute bottom-0 inset-x-0 bg-sky-500/45 transition-[height] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ height: `${bH}%`, transitionDelay: `${delayMs}ms` }}
                        />
                        <div
                          className="absolute bottom-0 inset-x-0 border-t border-white/75 bg-white/15 transition-[height] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ height: `${lH}%`, transitionDelay: `${delayMs}ms` }}
                        />
                      </div>
                    );
                  }

                  const pct =
                    channel === 'R' ? rH : channel === 'G' ? gH : channel === 'B' ? bH : lH;
                  const colorClass =
                    channel === 'R'
                      ? 'bg-red-500/80'
                      : channel === 'G'
                        ? 'bg-emerald-500/80'
                        : channel === 'B'
                          ? 'bg-sky-500/80'
                          : 'bg-zinc-200/80';

                  return (
                    <div key={idx} className="flex-1 h-full flex items-end">
                      <div
                        className={`w-full rounded-t-[1px] ${colorClass} transition-[height] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]`}
                        style={{ height: `${pct}%`, transitionDelay: `${delayMs}ms` }}
                      />
                    </div>
                  );
                })}
              </motion.div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-500">
                Đang phân tích pixel...
              </div>
            )}
          </div>

          <div
            className={
              embedded
                ? 'mt-1.5 flex items-center justify-between gap-1 text-[10px] wide:text-[11px] font-mono text-zinc-400 tabular-nums'
                : 'mt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums'
            }
          >
            <span className="truncate">Tối: {data ? `${data.shadowCrushPct}%` : '—'}</span>
            <span className="truncate">Sáng gắt: {data ? `${data.highlightClipPct}%` : '—'}</span>
          </div>
        </>
      )}
    </div>
  );
};
