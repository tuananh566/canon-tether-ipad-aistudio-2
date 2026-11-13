import React from 'react';
import { ArrowRight, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';
import { SUPPORTED_CANON_CAMERAS } from '../data/canonCameras';
import type { CcapiDeviceInfo, ConnectionMode, ConnectionStatus } from '../types/tether';

interface ConnectViewProps {
  mode: ConnectionMode;
  connStatus: ConnectionStatus;
  cameraIp: string;
  cameraPort: string;
  onChangeIp: (ip: string) => void;
  onChangePort: (port: string) => void;
  onConnectCcapi: () => void;
  onDisconnect: () => void;
  onEnterStudio: () => void;
  deviceInfo: CcapiDeviceInfo | null;
  connError: string | null;
}

export const ConnectView: React.FC<ConnectViewProps> = ({
  mode,
  connStatus,
  cameraIp,
  cameraPort,
  onChangeIp,
  onChangePort,
  onConnectCcapi,
  onDisconnect,
  onEnterStudio,
  deviceInfo,
  connError,
}) => {
  const isConnected = connStatus === 'connected';
  const isConnecting = connStatus === 'connecting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnectCcapi();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0A0A0B] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Primary CCAPI Connection Panel */}
        <div className="lg:col-span-7 rounded-xl bg-[#121215] border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-mono text-rose-400">
                Canon Camera Control API (CCAPI)
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-mono ${
                  isConnected
                    ? 'text-emerald-400'
                    : connStatus === 'error'
                      ? 'text-rose-400'
                      : 'text-zinc-500'
                }`}
              >
                {isConnected ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5" />
                )}
                <span>
                  {isConnected
                    ? mode === 'ccapi'
                      ? 'Đã kết nối CCAPI'
                      : 'Đã kết nối Test'
                    : isConnecting
                      ? 'Đang kết nối...'
                      : 'Chưa kết nối'}
                </span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
              Kết nối Wi-Fi với máy ảnh Canon
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mt-2">
              Hỗ trợ toàn bộ các dòng Canon EOS R, EOS M, DSLR và PowerShot có CCAPI.
            </p>

            {isConnected ? (
              <div className="mt-6 rounded-xl bg-[#18181D] border border-emerald-500/30 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {deviceInfo?.productname || 'Canon EOS'}
                    </div>
                    <div className="text-xs font-mono text-zinc-400 mt-1 tabular-nums">
                      {`IP ${cameraIp}:${cameraPort} · Firmware ${deviceInfo?.firmwareversion || '1.x'}`}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onEnterStudio}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                  >
                    <span>Mở Tether Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg border border-white/15 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Ngắt kết nối
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="ccapi-ip"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Địa chỉ IP máy ảnh
                    </label>
                    <input
                      id="ccapi-ip"
                      type="text"
                      value={cameraIp}
                      onChange={(e) => onChangeIp(e.target.value)}
                      placeholder="192.168.1.2"
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg bg-[#1A1A1F] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ccapi-port"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Cổng (Port)
                    </label>
                    <input
                      id="ccapi-port"
                      type="text"
                      value={cameraPort}
                      onChange={(e) => onChangePort(e.target.value)}
                      placeholder="8080"
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg bg-[#1A1A1F] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {connError && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300 leading-relaxed">
                    {connError.replace(/^failed to fetch\.?\s*/i, '') ||
                      'Hãy đảm bảo máy ảnh Canon đã bật Camera Control API và dùng chung mạng Wi-Fi.'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isConnecting || !cameraIp.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang kiểm tra kết nối CCAPI...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      <span>Kết nối máy ảnh Canon</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right: Setup Guide + Supported Canon Models */}
        <div className="lg:col-span-5 rounded-xl bg-[#121215] border border-white/10 p-6 flex flex-col justify-start">
          <h2 className="text-sm font-semibold text-white">
            Thiết bị Canon hỗ trợ CCAPI
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Bật <strong className="text-zinc-200">Menu → Wireless communication → Camera Control API</strong> và kết nối cùng mạng Wi-Fi trước khi bấm kết nối.
          </p>

          <div className="mt-4 space-y-3.5">
            {SUPPORTED_CANON_CAMERAS.map((group) => (
              <div key={group.series} className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0">
                <div className="text-xs font-mono text-rose-400 mb-1">
                  {group.series}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {group.models.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
