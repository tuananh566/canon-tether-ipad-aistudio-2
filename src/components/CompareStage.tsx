import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Unlock, Upload, RotateCcw, ArrowLeftRight, Download } from 'lucide-react';
import { usePinchPan } from '../utils/usePinchPan';
import type { TetherPhoto } from '../types/tether';

interface CompareStageProps {
  photoA: TetherPhoto | null;
  photoB: TetherPhoto | null;
  activeSlot: 'A' | 'B';
  onSelectSlot: (slot: 'A' | 'B') => void;
  lockB: boolean;
  onToggleLockB: () => void;
  onSwap: () => void;
  onImportExternal: (slot: 'A' | 'B', file: File) => void;
  onDownloadOriginal: (photo: TetherPhoto) => void;
}

export const CompareStage: React.FC<CompareStageProps> = ({
  photoA,
  photoB,
  activeSlot,
  onSelectSlot,
  lockB,
  onToggleLockB,
  onSwap,
  onImportExternal,
  onDownloadOriginal,
}) => {
  const {
    zoom,
    pan,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onDoubleClick,
    resetView,
  } = usePinchPan(1, 20);

  const isZoomedOrPanned = zoom > 1 || pan.x !== 0 || pan.y !== 0;

  const [swapCount, setSwapCount] = useState(0);
  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);

  const canAnimateSwap = photoA?.id !== photoB?.id;

  const handleSwapClick = () => {
    setSwapCount((c) => c + 1);
    onSwap();
  };

  const renderPane = (slot: 'A' | 'B', photo: TetherPhoto | null) => {
    const isActive = activeSlot === slot;
    const borderClass =
      slot === 'A'
        ? isActive
          ? 'border-emerald-500/70'
          : 'border-white/10'
        : isActive
          ? 'border-amber-500/70'
          : 'border-white/10';

    return (
      <div
        onClick={() => onSelectSlot(slot)}
        className={`relative flex-1 min-w-0 flex flex-col rounded-xl bg-[#111114] border ${borderClass} overflow-hidden transition-colors`}
      >
        {/* Top bar inside pane */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#151519]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                slot === 'A' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {slot === 'A' ? 'Ảnh A · Ảnh mới chụp' : 'Ảnh B · Tham chiếu'}
            </span>
            {photo && (
              <span className="text-xs font-mono text-zinc-400 truncate">
                {photo.filename}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {slot === 'B' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLockB();
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  lockB
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                }`}
              >
                {lockB ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                <span>{lockB ? 'Đã khóa B' : 'Mở khóa B'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (slot === 'A') fileInputARef.current?.click();
                else fileInputBRef.current?.click();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Chọn từ máy</span>
            </button>

            {photo && !photo.isOriginal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadOriginal(photo);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-rose-600/20 border border-rose-500/40 text-rose-200 hover:bg-rose-600/30 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Tải file gốc</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewport (pinch-to-zoom + pan touch-none for iPad) */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          className={`relative flex-1 min-h-0 flex items-center justify-center bg-[#08080A] overflow-hidden select-none touch-none ${
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          {photo ? (
            <motion.div
              key={canAnimateSwap ? `swap-${photo.id}` : `slot-${slot}-${photo.id}`}
              layoutId={canAnimateSwap ? `compare-photo-${photo.id}` : undefined}
              transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.9 }}
              className="w-full h-full flex items-center justify-center pointer-events-none"
            >
              <img
                src={photo.url}
                alt={photo.filename}
                referrerPolicy="no-referrer"
                draggable={false}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transition: dragging ? 'none' : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="max-w-full max-h-full object-contain pointer-events-none"
              />
            </motion.div>
          ) : (
            <div className="text-center px-6 py-8">
              <p className="text-sm text-zinc-400">Chưa có ảnh ở khung {slot}</p>
              <p className="text-xs text-zinc-500 mt-1">
                Chọn ảnh từ dải filmstrip bên dưới hoặc tải ảnh tham chiếu từ thiết bị.
              </p>
            </div>
          )}
        </div>

        {/* Unboxed EXIF Footer */}
        <div className="px-3 py-2 border-t border-white/10 bg-[#121216] flex items-center justify-between gap-3 text-xs font-mono text-zinc-400 tabular-nums">
          {photo ? (
            <>
              <div className="flex items-center gap-2 truncate">
                <span>{photo.exif.iso}</span>
                <span aria-hidden="true">·</span>
                <span>{photo.exif.aperture}</span>
                <span aria-hidden="true">·</span>
                <span>{photo.exif.shutterSpeed}</span>
                <span aria-hidden="true">·</span>
                <span>{photo.exif.focalLength}</span>
              </div>
              <span className="text-zinc-500 shrink-0">
                {photo.isOriginal ? 'HD Gốc' : 'Preview Nhanh'} · {photo.sizeLabel}
              </span>
            </>
          ) : (
            <span>Chờ dữ liệu EXIF</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-3">
      <input
        ref={fileInputARef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportExternal('A', f);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputBRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportExternal('B', f);
          e.target.value = '';
        }}
      />

      {/* Expanded Dual Panes with Centered Two-Way Swap & Reset */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2.5 items-stretch">
        {renderPane('A', photoA)}

        <div className="shrink-0 flex flex-row md:flex-col items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleSwapClick}
            aria-label="Đảo ảnh A và B"
            title="Đảo A / B"
            className="w-10 h-10 rounded-full bg-[#18181D] border border-white/15 text-zinc-200 hover:text-white hover:bg-[#222229] hover:border-white/30 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          >
            <motion.span
              animate={{ rotate: swapCount * 180 }}
              transition={{ type: 'spring', stiffness: 360, damping: 24 }}
              className="inline-flex items-center justify-center"
            >
              <ArrowLeftRight className="w-4 h-4 rotate-90 md:rotate-0 transition-transform" />
            </motion.span>
          </button>

          <button
            type="button"
            onClick={resetView}
            disabled={!isZoomedOrPanned}
            aria-label="Đặt lại"
            title="Đặt lại"
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
              isZoomedOrPanned
                ? 'bg-white border-white text-zinc-950 hover:bg-zinc-200 shadow-lg cursor-pointer'
                : 'bg-[#18181D] border-white/10 text-zinc-500 opacity-50 cursor-default'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {renderPane('B', photoB)}
      </div>
    </div>
  );
};
