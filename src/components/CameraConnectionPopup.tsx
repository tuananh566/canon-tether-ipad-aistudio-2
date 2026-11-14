import React from 'react';
import { motion } from 'motion/react';
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { CcapiDeviceInfo, ConnectionMode, ConnectionStatus } from '../types/tether';

interface CameraConnectionPopupProps {
  mode: ConnectionMode;
  connStatus: ConnectionStatus;
  connError: string | null;
  cameraIp: string;
  cameraPort: string;
  checkingConnection: boolean;
  lastCheckedAt: number | null;
  deviceInfo: CcapiDeviceInfo | null;
  onCheckConnection: () => void;
  onReconnectCcapi: () => void;
  onDisconnectCcapi: () => void;
}

export const CameraConnectionPopup: React.FC<CameraConnectionPopupProps> = ({
  mode,
  connStatus,
  connError,
  cameraIp,
  cameraPort,
  checkingConnection,
  lastCheckedAt,
  deviceInfo,
  onCheckConnection,
  onReconnectCcapi,
  onDisconnectCcapi,
}) => {
  const isConnected = connStatus === 'connected';
  const isReconnecting = connStatus === 'connecting';
  const lastCheckedLabel = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <motion.div
      layoutId="camera-popup-morph"
      transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
      role="dialog"
      aria-label="Thông tin kết nối máy ảnh"
      className={`absolute left-0 top-full mt-2 z-50 w-[min(320px,calc(100vw-2rem))] rounded-xl border p-3.5 space-y-3 shadow-2xl overflow-hidden ${
        isConnected
          ? 'bg-[#151519] border-white/15'
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
    </motion.div>
  );
};
