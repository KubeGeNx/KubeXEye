import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCurrentContextName, listContexts, resolveContextAuth } from './kubeContext.js';

const PORT = Number(process.env.KUBE_PROXY_PORT ?? 8001);

// Header the frontend sets to pick which kubeconfig context a request targets; absent, the
// kubeconfig's current-context is used (unchanged single-cluster behavior).
const CONTEXT_HEADER = 'x-kube-context';

// Internal endpoint that returns all available kubeconfig contexts.
const CONTEXTS_PATH = '/__kubexeye/contexts';

// Prefix the browser uses when talking to the unified server (mirrors the Vite dev proxy rewrite).
const K8S_PREFIX = '/k8s-api';

// Bare Kubernetes API path prefixes — recognised when running as a standalone proxy (dev mode,
// where Vite already strips the /k8s-api prefix before forwarding here).
// Note: single-segment paths (e.g. '/version') are matched exactly; trailing-slash entries use
// startsWith so that any sub-path under them is also proxied.
const K8S_BARE_PREFIXES = ['/api/', '/apis/', '/openapi/', '/healthz', '/readyz', '/livez', '/metrics'];
const K8S_BARE_EXACT    = new Set(['/version', '/healthz', '/readyz', '/livez', '/metrics']);

// ---------------------------------------------------------------------------
// Static file serving — active only when dist/index.html exists (production).
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const STATIC_ENABLED = fs.existsSync(path.join(DIST_DIR, 'index.html'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
};

/** Attempt to send a single file. Returns false if the path doesn't exist or is a directory. */
function sendFile(res: ServerResponse, filePath: string): boolean {
  if (!filePath.startsWith(DIST_DIR)) return false; // path-traversal guard
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

/** Serve a static asset, falling back to index.html for SPA client-side routes. */
function serveSPA(req: IncomingMessage, res: ServerResponse, urlPathname: string): void {
  const filePath = path.join(DIST_DIR, urlPathname);
  if (sendFile(res, filePath)) return;
  // SPA fallback — let the React router handle the path
  if (sendFile(res, path.join(DIST_DIR, 'index.html'))) return;
  res.writeHead(404);
  res.end('Not found');
}

// ---------------------------------------------------------------------------
// Kubernetes API proxy
// ---------------------------------------------------------------------------
function errorBody(message: string, code: number): string {
  return JSON.stringify({ kind: 'Status', apiVersion: 'v1', status: 'Failure', message, code });
}

function handleListContexts(res: ServerResponse): void {
  try {
    const body = JSON.stringify({ current: getCurrentContextName(), contexts: listContexts() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  } catch (err) {
    console.error('[kubexeye] failed to list contexts:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(errorBody((err as Error).message, 500));
  }
}

async function proxyToK8s(req: IncomingMessage, res: ServerResponse, k8sPath: string): Promise<void> {
  const contextName = req.headers[CONTEXT_HEADER];

  let auth;
  try {
    auth = await resolveContextAuth(Array.isArray(contextName) ? contextName[0] : contextName);
  } catch (err) {
    console.error('[kubexeye] failed to resolve cluster auth:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(errorBody((err as Error).message, 500));
    return;
  }

  const target = new URL(k8sPath, auth.server);
  const forwardedHeaders = { ...req.headers };
  delete forwardedHeaders.host;
  delete forwardedHeaders[CONTEXT_HEADER];

  const requestOptions: https.RequestOptions = {
    ...auth.httpsOptions,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'http:' ? 80 : 443),
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...forwardedHeaders, ...auth.httpsOptions.headers, host: target.host },
  };

  const onUpstreamResponse = (upstreamRes: IncomingMessage) => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  };

  const upstream =
    target.protocol === 'http:'
      ? http.request(requestOptions, onUpstreamResponse)
      : https.request(requestOptions, onUpstreamResponse);

  upstream.on('error', (err) => {
    console.error(`[kubexeye] upstream error for ${req.method} ${req.url}:`, err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(errorBody(err.message, 502));
  });

  req.pipe(upstream);
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let { pathname } = url;

  // Strip /k8s-api prefix when present — this is the unified-server path where the browser
  // sends requests directly to us (no Vite proxy in between).
  let hadK8sPrefix = false;
  if (pathname === K8S_PREFIX || pathname.startsWith(K8S_PREFIX + '/')) {
    pathname = pathname.slice(K8S_PREFIX.length) || '/';
    hadK8sPrefix = true;
  }

  // Internal endpoint — list kubeconfig contexts for the cluster switcher.
  if (pathname === CONTEXTS_PATH) {
    handleListContexts(res);
    return;
  }

  // Kubernetes API proxy — either we stripped the prefix (unified mode) or the path itself
  // is a bare k8s path (standalone proxy mode, e.g. when Vite strips /k8s-api for us).
  const isBareK8sPath =
    K8S_BARE_EXACT.has(pathname) ||
    K8S_BARE_PREFIXES.some((p) => pathname.startsWith(p));
  if (hadK8sPrefix || isBareK8sPath) {
    await proxyToK8s(req, res, pathname + url.search);
    return;
  }

  // Static file serving — only when dist/ exists (production / `make serve`).
  if (STATIC_ENABLED) {
    serveSPA(req, res, pathname);
    return;
  }

  // Standalone proxy mode with an unrecognised path — return a helpful 404.
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(errorBody(`${pathname} not found on proxy`, 404));
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  void handleRequest(req, res);
});

server.listen(PORT, () => {
  if (STATIC_ENABLED) {
    console.log(`[kubexeye] unified server running at http://localhost:${PORT}`);
    console.log(`[kubexeye]   frontend : http://localhost:${PORT}`);
    console.log(`[kubexeye]   kube API : http://localhost:${PORT}/k8s-api  (multi-cluster via X-Kube-Context header)`);
    console.log(`[kubexeye]   contexts : http://localhost:${PORT}/__kubexeye/contexts`);
  } else {
    console.log(`[kubexeye] kube-proxy listening on http://localhost:${PORT}`);
    console.log(`[kubexeye]   proxy target switches per X-${CONTEXT_HEADER} request header`);
    console.log(`[kubexeye]   contexts : http://localhost:${PORT}/__kubexeye/contexts`);
  }
});
