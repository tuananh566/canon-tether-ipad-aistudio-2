import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

function resolvePort(): number {
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && process.argv[idx + 1]) {
    const parsed = Number(process.argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const eqArg = process.argv.find((a) => a.startsWith('--port='));
  if (eqArg) {
    const parsed = Number(eqArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

const PORT = resolvePort();

function isBlockedMetadataHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === '169.254.169.254' ||
    lower === 'metadata.google.internal' ||
    lower === 'metadata.goog'
  );
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'canon-tether-studio-ipad' });
  });

  // Same-origin CCAPI proxy for desktop/mobile browsers (e.g. Chrome on http://localhost:3000)
  // Native iPadOS (.ipa) uses CapacitorHttp directly and does not call this route.
  app.all('/api/ccapi-proxy', express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
    const rawTarget = typeof req.query.target === 'string' ? req.query.target : '';
    if (!rawTarget) {
      res.status(400).json({ error: 'Thiếu tham số target URL' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawTarget);
    } catch {
      res.status(400).json({ error: 'URL máy ảnh không hợp lệ' });
      return;
    }

    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      isBlockedMetadataHost(parsed.hostname) ||
      !parsed.pathname.startsWith('/ccapi')
    ) {
      res.status(403).json({ error: 'Chỉ cho phép proxy tới đường dẫn Canon /ccapi/*' });
      return;
    }

    const rawTimeout = Number(req.query.timeoutMs);
    const timeoutMs =
      Number.isFinite(rawTimeout) && rawTimeout >= 1000 && rawTimeout <= 70000
        ? rawTimeout
        : 15000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onClientClose = () => controller.abort();
    req.on('close', onClientClose);

    try {
      const forwardHeaders: Record<string, string> = {};
      const contentType = req.header('content-type');
      if (contentType) forwardHeaders['Content-Type'] = contentType;
      const rangeHeader = req.header('range');
      if (rangeHeader) forwardHeaders['Range'] = rangeHeader;

      const method = req.method.toUpperCase();
      const hasBody =
        method !== 'GET' &&
        method !== 'HEAD' &&
        Buffer.isBuffer(req.body) &&
        req.body.length > 0;

      const upstream = await fetch(parsed.toString(), {
        method,
        headers: Object.keys(forwardHeaders).length > 0 ? forwardHeaders : undefined,
        body: hasBody ? new Uint8Array(req.body) : undefined,
        signal: controller.signal,
      });

      const arrayBuf = await upstream.arrayBuffer();
      const respBuf = Buffer.from(arrayBuf);

      const upstreamType = upstream.headers.get('content-type');
      if (upstreamType) res.setHeader('Content-Type', upstreamType);
      const upstreamRange = upstream.headers.get('content-range');
      if (upstreamRange) res.setHeader('Content-Range', upstreamRange);
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      res.status(upstream.status).send(respBuf);
    } catch (err: unknown) {
      if (res.headersSent) return;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (req.destroyed || req.socket.destroyed) return;
      res.status(isAbort ? 504 : 502).json({
        error: isAbort
          ? 'Hết thời gian phản hồi từ máy ảnh Canon'
          : err instanceof Error
            ? err.message
            : 'Không thể kết nối tới máy ảnh Canon qua proxy',
      });
    } finally {
      clearTimeout(timer);
      req.off('close', onClientClose);
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Canon Tether Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Canon Tether Studio server:', err);
  process.exit(1);
});
