import React, { useEffect, useState } from 'react';
import {
  Download,
  BarChart3,
  Wifi,
  WifiOff,
  RotateCcw,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { CanvasHistogram } from './CanvasHistogram';
import { usePinchPan } from '../utils/usePinchPan';
import type {
  CcapiDeviceInfo,
  ConnectionMode,
  ConnectionStatus,
  TetherPhoto,
} from '../types/tether';

interface TetherWorkspaceProps {
  mode: ConnectionMode;
  connStatus: ConnectionStatus;
  connError: string | null;
  cameraIp: string;
  cameraPort: string;
  checkingConnection: boolean;
  lastCheckedAt: number | null;
  onCheckConnection: () => void;
  onReconnectCcapi: () => void;
  onDisconnectCcapi: () => void;
  deviceInfo: CcapiDeviceInfo | null;
  selectedPhoto: TetherPhoto | null;
  selectedPhotoIndex: number;
  totalPhotos: number;
  onDownloadOriginal: (photo: TetherPhoto) => void;
  onDeletePhoto: (id: string) => void;
}

export const TetherWorkspace: React.FC<TetherWorkspaceProps> = ({
  mode,
  connStatus,
  connError,
  cameraIp,
  cameraPort,
  checkingConnection,
  lastCheckedAt,
  onCheckConnection,
  onReconnectCcapi,
  onDisconnectCcapi,
  deviceInfo,
  selectedPhoto,
  selectedPhotoIndex,
  totalPhotos,
  onDownloadOriginal,
  onDeletePhoto,
}) => {
  const [showHistogram, setShowHistogram] = useState(true);
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
  } = usePinchPan(1, 4);

  const isConnected = connStatus === 'connected';
  const isReconnecting = connStatus === 'connecting';
  const isZoomedOrPanned = zoom > 1 || pan.x !== 0 || pan.y !== 0;
  const lastCheckedLabel = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* Left Camera Control Rail */}
      <aside className="w-full md:w-72 lg:w-76 max-h-[42vh] md:max-h-none shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-[#101013] p-4 overflow-y-auto flex flex-col justify-between gap-4">
        {/* Upper Half: Connection Summary & Photo Count */}
        <div className="space-y-3">
          <div
            className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
              isConnected
                ? 'bg-[#151519] border-white/10'
                : isReconnecting
                  ? 'bg-[#18161B] border-amber-500/35'
                  : 'bg-[#1A1215] border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white min-w-0">
                {isConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isReconnecting ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span className="truncate">
                  {deviceInfo?.productname || 'Canon Camera'}
                </span>
              </div>
              <span
                className={`text-[11px] font-mono shrink-0 ${
                  isConnected
                    ? 'text-emerald-400'
                    : isReconnecting
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {isConnected
                  ? mode === 'ccapi'
                    ? 'CCAPI OK'
                    : 'Test OK'
                  : isReconnecting
                    ? 'Đang kết nối...'
                    : 'Mất kết nối'}
              </span>
            </div>

            {isConnected ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 tabular-nums">
                  <span>{`${cameraIp.trim() || '0.0.0.0'}:${cameraPort.trim() || '8080'}`}</span>
                  <span aria-hidden="true">·</span>
                  <span>FW {deviceInfo?.firmwareversion || '2.0.0'}</span>
                </div>
                {lastCheckedLabel && (
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    Kiểm tra gần nhất: {lastCheckedLabel}
                  </div>
                )}
              </div>
            ) : isReconnecting ? (
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Đang kết nối lại tới {cameraIp}:{cameraPort}...
              </p>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] font-mono text-rose-300 tabular-nums">
                  Mất kết nối tới {cameraIp}:{cameraPort}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {(connError && !/timed out/i.test(connError) ? connError : null) ||
                    'Kiểm tra Wi-Fi hoặc nguồn máy ảnh rồi bấm Reconnect.'}
                </p>
              </div>
            )}

            {isConnected ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onCheckConnection}
                  disabled={checkingConnection}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingConnection ? 'animate-spin' : ''}`} />
                  <span>{checkingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectCcapi}
                  className="w-full py-1.5 text-xs font-medium rounded-lg border border-white/15 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Ngắt kết nối / Đổi IP
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onReconnectCcapi}
                  disabled={isReconnecting}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isReconnecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang Reconnect...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reconnect</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onDisconnectCcapi}
                  className="w-full py-1.5 text-xs font-medium rounded-lg border border-white/15 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Ngắt kết nối / Đổi IP
                </button>
              </div>
            )}
          </div>

          {/* Photo Count & Camera File Info in Upper Half */}
          <div className="rounded-xl border border-white/10 bg-[#151519] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-400">Số ảnh</span>
              <span className="text-sm font-mono font-semibold text-white tabular-nums">
                {selectedPhoto && selectedPhotoIndex >= 0
                  ? `${selectedPhotoIndex + 1} / ${totalPhotos}`
                  : `${totalPhotos} ảnh`}
              </span>
            </div>

            {selectedPhoto ? (
              <div className="pt-2.5 border-t border-white/10 space-y-2">
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
                    <span className="text-zinc-500 shrink-0">Độ K</span>
                    <span
                      className="text-zinc-100 truncate"
                      title={selectedPhoto.exif.whiteBalance}
                    >
                      {selectedPhoto.exif.whiteBalance}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-white/10 text-[11px] text-zinc-500">
                Chưa có ảnh được chọn
              </div>
            )}
          </div>
        </div>

        {/* Lower Half: Histogram, Download HD */}
        <div className="pt-3 border-t border-white/10 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowHistogram((v) => !v)}
            className={`w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] py-2 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              showHistogram
                ? 'bg-zinc-800 border-white/25 text-white'
                : 'bg-[#18181D] border-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>Histogram</span>
          </button>

          <button
            type="button"
            disabled={!selectedPhoto}
            onClick={() => selectedPhoto && onDownloadOriginal(selectedPhoto)}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] py-2.5 px-3 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Tải ảnh HD</span>
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
                  className="min-h-[38px] py-2 px-2.5 text-xs font-medium rounded-lg border border-white/15 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 min-h-[38px] py-2 px-3 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors whitespace-nowrap cursor-pointer"
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
              className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-medium rounded-lg bg-[#101013]/90 backdrop-blur-md border border-white/15 text-zinc-100 hover:bg-[#1A1A1F] shadow-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Tải lại</span>
            </button>
          )}

          {/* Floating Real Pixel Histogram */}
          {showHistogram && selectedPhoto && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-4 z-10"
            >
              <CanvasHistogram
                imageUrl={selectedPhoto.url}
                onClose={() => setShowHistogram(false)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
