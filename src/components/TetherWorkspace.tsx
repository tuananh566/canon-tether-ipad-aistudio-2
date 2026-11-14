import React, { useEffect, useState } from 'react';
import { Download, RotateCcw, Trash2 } from 'lucide-react';
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
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* Left Camera Control Rail */}
      <aside className="w-full md:w-72 lg:w-76 max-h-[42vh] md:max-h-none shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-[#101013] p-4 overflow-y-auto flex flex-col justify-between gap-4">
        {/* Upper Half: Embedded Histogram & File Info */}
        <div className="space-y-3">
          {/* Embedded Histogram above Photo Info */}
          <CanvasHistogram imageUrl={selectedPhoto?.url ?? null} embedded />

          {/* Camera File Info below Histogram */}
          <div className="rounded-xl border border-white/10 bg-[#151519] p-3.5">
            {selectedPhoto ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className="text-zinc-200 font-medium truncate" title={selectedPhoto.filename}>
                    {selectedPhoto.filename}
                  </span>
                  <span className="text-zinc-500 shrink-0">
                    {selectedPhoto.sizeLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono tabular-nums">
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

        {/* Lower Half: Download HD & Delete */}
        <div className="pt-3 border-t border-white/10 space-y-2.5">

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
            <div className="relative max-w-full max-h-full flex items-center justify-center">
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
                className="max-h-[calc(62dvh-160px)] md:max-h-[calc(100dvh-176px)] max-w-full w-auto h-auto object-contain rounded-sm pointer-events-none"
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
        </div>
      </main>
    </div>
  );
};
