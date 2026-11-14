import React, { useEffect, useState } from 'react';
import { Check, Download, RotateCcw, Trash2, X } from 'lucide-react';
import { CanvasHistogram } from './CanvasHistogram';
import { usePinchPan } from '../utils/usePinchPan';
import type { TetherPhoto } from '../types/tether';

interface TetherWorkspaceProps {
  selectedPhoto: TetherPhoto | null;
  onDownloadOriginal: (photo: TetherPhoto) => void;
  onDeletePhoto: (id: string) => void;
}

export const TetherWorkspace: React.FC<TetherWorkspaceProps> = ({
  selectedPhoto,
  onDownloadOriginal,
  onDeletePhoto,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedPhoto?.id]);

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

  return (
    <div className="flex-1 min-h-0 flex flex-col wide:flex-row">
      {/* Expanded Darkroom Preview Stage */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#08080A]">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          className={`relative flex-1 min-h-0 flex items-center justify-center overflow-hidden p-2 sm:p-4 select-none touch-none ${
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {selectedPhoto ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                key={selectedPhoto.id}
                src={selectedPhoto.url}
                alt={selectedPhoto.filename}
                referrerPolicy="no-referrer"
                draggable={false}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transition: dragging ? 'none' : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-sm pointer-events-none"
              />
            </div>
          ) : (
            <div className="text-center max-w-sm">
              <p className="text-sm font-medium text-zinc-300">Chờ ảnh từ máy ảnh Canon</p>
              <p className="text-xs text-zinc-500 mt-1">
                Nhấn nút chụp trên máy ảnh Canon để tự động nhận ảnh qua Wi-Fi.
              </p>
            </div>
          )}

          {/* Reset zoom button shown only when not at 1.0x */}
          {selectedPhoto && isZoomedOrPanned && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={resetView}
              aria-label="Tải lại khung hình"
              title="Tải lại khung hình"
              className="absolute top-4 left-4 z-10 w-10 h-10 inline-flex items-center justify-center rounded-lg bg-[#101013]/90 backdrop-blur-md border border-white/15 text-zinc-100 hover:bg-[#1A1A1F] shadow-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
            </button>
          )}

          {/* Mobile & iPad Portrait: Square icon-only Download & Delete buttons at bottom-right of preview */}
          {selectedPhoto && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="wide:hidden absolute bottom-2.5 right-2.5 z-10 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => onDownloadOriginal(selectedPhoto)}
                aria-label="Tải file gốc"
                title="Tải file gốc"
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-rose-600/95 hover:bg-rose-500 text-white border border-white/15 shadow-xl transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
              </button>

              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                      onDeletePhoto(selectedPhoto.id);
                    }}
                    aria-label="Xác nhận xoá"
                    title="Xác nhận xoá"
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-white/20 shadow-xl transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    aria-label="Hủy xoá"
                    title="Hủy xoá"
                    className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-[#101013]/90 backdrop-blur-md hover:bg-[#1A1A1F] text-zinc-100 border border-white/15 shadow-xl transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 shrink-0" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Xoá ảnh này"
                  title="Xoá ảnh này"
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg bg-[#101013]/90 backdrop-blur-md hover:bg-[#1A1A1F] text-zinc-100 border border-white/15 shadow-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Right Camera Control Rail (Desktop/iPad Landscape) / Horizontal Histogram + Info Strip (Mobile Portrait & iPad Portrait) / Hidden in Mobile Landscape */}
      <aside className="mobile-landscape:hidden w-full wide:w-72 lg:w-76 shrink-0 border-t wide:border-t-0 wide:border-l border-white/10 bg-[#101013] p-2.5 wide:p-4 wide:overflow-y-auto flex flex-col justify-between gap-4">
        {/* Mobile & iPad Portrait: side-by-side Histogram & File Info; Desktop/iPad Landscape: stacked vertically */}
        <div
          className={`${
            selectedPhoto ? 'grid grid-cols-2 items-stretch gap-2 sm:gap-3' : 'block'
          } wide:flex wide:flex-col wide:gap-3`}
        >
          {selectedPhoto && (
            <div className="min-w-0">
              <CanvasHistogram imageUrl={selectedPhoto.url} embedded />
            </div>
          )}

          {/* Camera File Info */}
          <div className="min-w-0 rounded-xl border border-white/10 bg-[#151519] p-2.5 wide:p-3.5 flex flex-col justify-between">
            {selectedPhoto ? (
              <div className="space-y-1.5 wide:space-y-2">
                <div className="flex items-center justify-between gap-1.5 wide:gap-2 text-[10px] sm:text-[11px] font-mono tabular-nums">
                  <span className="text-zinc-200 font-medium truncate" title={selectedPhoto.filename}>
                    {selectedPhoto.filename}
                  </span>
                  <span className="text-zinc-500 shrink-0">
                    {selectedPhoto.sizeLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 wide:gap-y-1.5 text-[11px] sm:text-xs font-mono tabular-nums">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-zinc-500">Khẩu</span>
                    <span className="text-zinc-100">{selectedPhoto.exif.aperture}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-zinc-500">Tốc</span>
                    <span className="text-zinc-100">{selectedPhoto.exif.shutterSpeed}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-zinc-500">ISO</span>
                    <span className="text-zinc-100">
                      {selectedPhoto.exif.iso.replace(/^ISO\s+/i, '')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-zinc-500 shrink-0">Tiêu cự</span>
                    <span
                      className="text-zinc-100 truncate"
                      title={selectedPhoto.exif.focalLength}
                    >
                      {selectedPhoto.exif.focalLength}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-zinc-500">
                Chưa có ảnh được chọn
              </div>
            )}
          </div>
        </div>

        {/* Lower Half (Desktop/iPad Landscape only): Download Original & Delete */}
        <div className="hidden wide:block pt-3 border-t border-white/10 space-y-2.5">
          <button
            type="button"
            disabled={!selectedPhoto}
            onClick={() => selectedPhoto && onDownloadOriginal(selectedPhoto)}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] py-2.5 px-3 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Tải file gốc</span>
          </button>

          {selectedPhoto && (
            confirmDelete ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDeletePhoto(selectedPhoto.id);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[38px] py-2 px-2.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Xác nhận xoá</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[38px] py-2 px-2.5 text-xs font-medium rounded-lg border bg-zinc-800 border-white/25 text-white hover:bg-zinc-700/80 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 min-h-[38px] py-2 px-3 text-xs font-medium rounded-lg border bg-zinc-800 border-white/25 text-white hover:bg-zinc-700/80 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Xoá ảnh này</span>
              </button>
            )
          )}
        </div>
      </aside>
    </div>
  );
};
