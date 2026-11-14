import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Download,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { TetherPhoto } from '../types/tether';

interface GalleryModalProps {
  photos: TetherPhoto[];
  selectedId: string | null;
  onSelectPhoto: (photo: TetherPhoto) => void;
  onBatchDeletePhotos: (ids: string[]) => void;
  onBatchDownloadOriginals: (photos: TetherPhoto[]) => Promise<void>;
  onImportPhotos: (files: FileList) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  photos,
  selectedId,
  onSelectPhoto,
  onBatchDeletePhotos,
  onBatchDownloadOriginals,
  onImportPhotos,
}) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [downloadingBatch, setDownloadingBatch] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  };

  useEffect(() => clearLongPress, []);

  const startLongPress = (e: React.PointerEvent, photoId: string) => {
    if (selectionMode || selectedIds.size > 0) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressOriginRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressOriginRef.current = null;
      longPressTriggeredRef.current = true;
      setSelectionMode(true);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(photoId);
        return next;
      });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(10);
        } catch {
          /* ignore */
        }
      }
    }, 420);
  };

  const moveLongPress = (e: React.PointerEvent) => {
    const origin = longPressOriginRef.current;
    if (!origin) return;
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 8) {
      clearLongPress();
    }
  };

  const filtered = photos;
  const isSelectionActive = selectionMode || selectedIds.size > 0;

  const selectedPhotos = useMemo(
    () => photos.filter((p) => selectedIds.has(p.id)),
    [photos, selectedIds],
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const toggleSelect = (id: string) => {
    setConfirmBatchDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (filtered.length === 0) return;
    setConfirmBatchDelete(false);
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of filtered) next.delete(p.id);
        return next;
      });
    } else {
      setSelectionMode(true);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of filtered) next.add(p.id);
        return next;
      });
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
  };

  const handleBatchDownload = async () => {
    if (selectedPhotos.length === 0 || downloadingBatch) return;
    setDownloadingBatch(true);
    try {
      await onBatchDownloadOriginals(selectedPhotos);
    } finally {
      setDownloadingBatch(false);
    }
  };

  const handleConfirmDelete = () => {
    if (selectedIds.size === 0) return;
    onBatchDeletePhotos(Array.from(selectedIds));
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
    setSelectionMode(false);
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-[#0A0A0B]">
      {/* Bulk Action Bar (shown after long-pressing a photo to enter selection mode) */}
      {isSelectionActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-white/10 bg-[#15151A]">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium text-white tabular-nums">
              Đã chọn {selectedIds.size} ảnh
            </span>
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
            </button>
            {selectedIds.size > 0 && !allFilteredSelected && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setConfirmBatchDelete(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 transition-colors cursor-pointer"
              >
                Bỏ chọn
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedIds.size === 0 || downloadingBatch}
              onClick={handleBatchDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloadingBatch
                  ? 'Đang tải file gốc...'
                  : `Tải file gốc (${selectedIds.size})`}
              </span>
            </button>

            {confirmBatchDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xác nhận xoá {selectedIds.size} ảnh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBatchDelete(false)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setConfirmBatchDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xoá đã chọn ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={exitSelectionMode}
              aria-label="Đóng thanh chọn"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-24">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl">
            <p className="text-sm text-zinc-300 font-medium">Chưa có ảnh nào</p>
            <p className="text-xs text-zinc-500 mt-1">
              Chụp ảnh mới trên máy ảnh Canon hoặc bấm nút + để thêm ảnh từ thiết bị.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((photo) => {
              const isCurrent = photo.id === selectedId;
              const isChecked = selectedIds.has(photo.id);

              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-[3/2] rounded-xl bg-black border overflow-hidden transition-colors select-none ${
                    isChecked
                      ? 'border-rose-500 ring-1 ring-rose-500/50'
                      : isCurrent
                        ? 'border-white/40'
                        : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => startLongPress(e, photo.id)}
                    onPointerMove={moveLongPress}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={(e) => {
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      if (isSelectionActive) {
                        toggleSelect(photo.id);
                      } else {
                        onSelectPhoto(photo);
                      }
                    }}
                    className="relative block w-full h-full bg-black overflow-hidden cursor-pointer select-none"
                  >
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02] pointer-events-none"
                    />
                  </button>

                  {/* Individual selection checkbox (hidden initially; revealed after long-press) */}
                  {isSelectionActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectionMode) setSelectionMode(true);
                        toggleSelect(photo.id);
                      }}
                      aria-label={isChecked ? `Bỏ chọn ${photo.filename}` : `Chọn ${photo.filename}`}
                      className={`absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-md border backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-black/55 border-white/25 text-transparent hover:border-white/70'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Overlaid dark translucent filename badge inside photo frame */}
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex items-end justify-start">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto max-w-full overflow-hidden rounded-lg bg-black/65 backdrop-blur-md border border-white/15 px-2.5 py-1 shadow-lg"
                    >
                      <div className="text-[11px] font-mono font-medium text-zinc-100 truncate leading-tight">
                        {photo.filename}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating + button at bottom-right of photo area */}
      <label
        aria-label="Thêm ảnh từ thiết bị"
        title="Thêm ảnh từ thiết bị"
        className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 w-12 h-12 rounded-full bg-[#101013]/90 backdrop-blur-md hover:bg-zinc-800 active:scale-95 text-zinc-100 border border-white/25 shadow-2xl flex items-center justify-center transition-all cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportPhotos(e.target.files);
            }
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
};
