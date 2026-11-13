import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  CheckSquare,
  Columns2,
  Download,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { TetherPhoto } from '../types/tether';

interface GalleryModalProps {
  photos: TetherPhoto[];
  selectedId: string | null;
  onSelectPhoto: (photo: TetherPhoto) => void;
  onAssignCompare: (slot: 'A' | 'B', photo: TetherPhoto) => void;
  onDeletePhoto: (id: string) => void;
  onBatchDeletePhotos: (ids: string[]) => void;
  onDownloadPhoto: (photo: TetherPhoto) => void;
  onBatchDownloadOriginals: (photos: TetherPhoto[]) => Promise<void>;
  onImportPhotos: (files: FileList) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  photos,
  selectedId,
  onSelectPhoto,
  onAssignCompare,
  onDeletePhoto,
  onBatchDeletePhotos,
  onDownloadPhoto,
  onBatchDownloadOriginals,
  onImportPhotos,
}) => {
  const [query, setQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'ccapi' | 'local'>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloadingBatch, setDownloadingBatch] = useState(false);

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (filterSource !== 'all' && p.source !== filterSource) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return (
          p.filename.toLowerCase().includes(q) ||
          p.exif.lens.toLowerCase().includes(q) ||
          p.exif.iso.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [photos, query, filterSource]);

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
    <div className="flex-1 min-h-0 flex flex-col bg-[#0A0A0B]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[#101013]">
        <div>
          <h2 className="text-lg font-semibold text-white">Thư viện ảnh Tether</h2>
          <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
            {photos.length} ảnh trong phiên chụp · Bấm chọn từng ảnh hoặc bật Chọn nhiều để tải file gốc / xoá hàng loạt
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên file, lens, ISO..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#18181D] border border-white/10 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 w-52"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#18181D] border border-white/10">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'ccapi', label: 'Từ máy ảnh' },
                { id: 'local', label: 'Từ thiết bị' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterSource(tab.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filterSource === tab.id
                    ? 'bg-zinc-700 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectionMode) exitSelectionMode();
              else setSelectionMode(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              selectionMode
                ? 'bg-rose-600/20 border-rose-500/40 text-rose-200'
                : 'bg-[#18181D] border-white/10 text-zinc-200 hover:bg-white/10'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{selectionMode ? 'Thoát chọn nhiều' : 'Chọn nhiều'}</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            <span>Thêm ảnh từ iPad</span>
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
      </div>

      {/* Bulk Action Bar */}
      {(selectionMode || selectedIds.size > 0) && (
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
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setConfirmBatchDelete(false);
                }}
                className="text-zinc-400 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Bỏ chọn
              </button>
            )}
            <span className="text-zinc-500 hidden sm:inline">
              · Nhấn vào từng ảnh để chọn hoặc bỏ chọn
            </span>
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
              aria-label="Đóng thanh chọn nhiều"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl">
            <p className="text-sm text-zinc-300 font-medium">Chưa có ảnh phù hợp</p>
            <p className="text-xs text-zinc-500 mt-1">
              Chụp ảnh mới trên máy ảnh Canon hoặc tải ảnh tham chiếu từ máy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((photo) => {
              const isCurrent = photo.id === selectedId;
              const isChecked = selectedIds.has(photo.id);

              return (
                <div
                  key={photo.id}
                  className={`group relative rounded-xl bg-[#121216] border overflow-hidden transition-colors ${
                    isChecked
                      ? 'border-rose-500 ring-1 ring-rose-500/50'
                      : isCurrent
                        ? 'border-white/35'
                        : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectionMode || selectedIds.size > 0) {
                          toggleSelect(photo.id);
                        } else {
                          onSelectPhoto(photo);
                        }
                      }}
                      className="relative block w-full aspect-[3/2] bg-black overflow-hidden cursor-pointer"
                    >
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    </button>

                    {/* Individual selection checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectionMode) setSelectionMode(true);
                        toggleSelect(photo.id);
                      }}
                      aria-label={isChecked ? `Bỏ chọn ${photo.filename}` : `Chọn ${photo.filename}`}
                      className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-black/60 border-white/30 text-transparent hover:border-white/70'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-medium text-zinc-100 truncate">
                        {photo.filename}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0 tabular-nums">
                        {photo.isOriginal ? 'HD' : 'Fast'} · {photo.sizeLabel}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 tabular-nums truncate">
                      <span>{photo.exif.iso}</span>
                      <span aria-hidden="true">·</span>
                      <span>{photo.exif.aperture}</span>
                      <span aria-hidden="true">·</span>
                      <span>{photo.exif.shutterSpeed}</span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                      {confirmDeleteId === photo.id ? (
                        <div className="w-full flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              onDeletePhoto(photo.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Xác nhận xoá</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-[11px] rounded border border-white/15 text-zinc-300 hover:text-white cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onAssignCompare('A', photo)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 cursor-pointer"
                            >
                              <Columns2 className="w-3 h-3" />
                              <span>Gán A</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onAssignCompare('B', photo)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 cursor-pointer"
                            >
                              <Columns2 className="w-3 h-3" />
                              <span>Gán B</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onDownloadPhoto(photo)}
                              aria-label={`Tải file gốc ${photo.filename}`}
                              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(photo.id)}
                              aria-label={`Xoá ${photo.filename}`}
                              className="p-1.5 text-zinc-400 hover:text-rose-400 rounded hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
