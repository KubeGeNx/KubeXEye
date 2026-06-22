import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import { getCurrentContextName, listContexts, resolveContextAuth } from './kubeContext.js';

const PORT = Number(process.env.KUBE_PROXY_PORT ?? 8001);

// Header the frontend sets to pick which kubeconfig context a request targets; absent, the
// kubeconfig's current-context is used (unchanged single-cluster behavior).
const CONTEXT_HEADER = 'x-kube-context';
const CONTEXTS_PATH = '/__kubexeye/contexts';

function errorBody(message: string, code: number) {
  return JSON.stringify({ kind: 'Status', apiVersion: 'v1', status: 'Failure', message, code });
}

function handleListContexts(res: ServerResponse): void {
  try {
    const body = JSON.stringify({ current: getCurrentContextName(), contexts: listContexts() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  } catch (err) {
    console.error('[kube-proxy] failed to list contexts:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(errorBody((err as Error).message, 500));
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === CONTEXTS_PATH) {
    handleListContexts(res);
    return;
  }

  const contextName = req.headers[CONTEXT_HEADER];

  let auth;
  try {
    auth = await resolveContextAuth(Array.isArray(contextName) ? contextName[0] : contextName);
  } catch (err) {
    console.error('[kube-proxy] failed to resolve cluster auth:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(errorBody((err as Error).message, 500));
    return;
  }

  const target = new URL(req.url ?? '/', auth.server);
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
    target.protocol === 'http:' ? http.request(requestOptions, onUpstreamResponse) : https.request(requestOptions, onUpstreamResponse);

  upstream.on('error', (err) => {
    console.error(`[kube-proxy] upstream error for ${req.method} ${req.url}:`, err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(errorBody(err.message, 502));
  });

  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`[kube-proxy] listening on http://localhost:${PORT} — proxying to the current kubeconfig context`);
});
