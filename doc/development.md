# Development Guide

## Prerequisites

- **Node.js** ≥ 20.19 (Vite 8 requires it — see the `engines` field in `package.json`)
- **npm** ≥ 10
- A running Kubernetes cluster accessible from your machine

Every `make` target that installs, builds, or runs anything (`install`, `build`, `run`, `start`,
`proxy`, `serve`, `lint`, `test`, ...) checks the Node.js/npm versions first (`make check-node`,
implemented in `scripts/check-node-version.cjs`) and fails fast with a clear message — rather than
an unhelpful crash — if they're too old. Plain `npm install`/`npm run dev` don't run this check;
use the `make` targets (or run `make check-node` yourself) if you want it enforced.

## Quick start

```bash
git clone <repo>
cd KubeXEye
npm install
```

Then pick one of the two proxy options below and start the dev server.

## Proxy options

The UI talks to the Kubernetes API via a `/k8s-api/*` path that Vite proxies to a configurable
target (`KUBE_PROXY_TARGET`, default `http://localhost:8001`).

### Option A — `kubectl proxy` (simplest)

Requires `kubectl` and a valid kubeconfig.

```bash
# Terminal 1
kubectl proxy --port=8001

# Terminal 2
npm run dev
```

### Option B — bundled proxy server (no `kubectl` needed)

Reads your kubeconfig directly via `@kubernetes/client-node` and exposes the K8s API on `:8001`.
Useful on machines where `kubectl` isn't installed or where the proxy needs to run as a background
daemon.

```bash
# Foreground (two terminals)
npm run server          # terminal 1 — bundled proxy on :8001
npm run dev             # terminal 2 — Vite dev server on :5173

# Background (single command via Make)
make start              # starts both; writes PIDs to .run/
make logs               # tail both log streams
make stop               # kill both
make restart            # stop + start
make status             # show running pids and ports
```

### Option C — custom API base URL

If you can reach the K8s API server directly (or via another proxy), open
**Cluster Connection** in the nav and enter a custom API base URL and optional bearer token.
This is stored in `localStorage` and persists across reloads.

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server on `:5173` |
| `npm run server` | Start bundled kubeconfig proxy on `:8001` |
| `npm run build` | `tsc -b` (type-check) + `vite build` (production bundle → `dist/`) |
| `npm run preview` | Serve the production build locally with `vite preview` |
| `npm run lint` | ESLint across the whole `src/` tree |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in interactive watch mode |
| `npm run coverage` | Vitest + V8 coverage report → `coverage/` |

## Make targets

Run `make help` for a formatted summary. All targets that need npm packages run `install` first,
which in turn runs `check-node` first.

| Target | What it does |
|---|---|
| `make check-node` | Verify Node.js/npm meet the minimum required versions; fails fast with a fix hint if not |
| `make start` | Start bundled proxy + Vite in the background |
| `make stop` | Stop both background processes |
| `make restart` | `stop` then `start` |
| `make status` | Show running PIDs and ports |
| `make logs` | `tail -f` both background log files |
| `make proxy` | Run bundled proxy in the foreground |
| `make proxy-stop` | Stop only the background proxy |
| `make run` / `make dev` | Run Vite dev server in the foreground |
| `make build` | `npm install` + `npm run build` |
| `make preview` | Build then `vite preview` |
| `make typecheck` | `tsc -b --noEmit` (type-check without emitting) |
| `make lint` | ESLint |
| `make test` | `vitest run` (once) |
| `make test-watch` | `vitest` (watch mode) |
| `make coverage` | `vitest run --coverage` |
| `make clean` | Remove `dist/`, `.vite/`, `.run/`, `*.tsbuildinfo` |
| `make distclean` | `clean` + `stop` + remove `node_modules/` |

### Configurable variables

```bash
make start DEV_PORT=3000 KUBE_PROXY_PORT=9000
```

| Variable | Default | Meaning |
|---|---|---|
| `DEV_PORT` | `5173` | Vite dev server port |
| `KUBE_PROXY_PORT` | `8001` | Bundled proxy server port |

## TypeScript project references

`tsconfig.json` uses project references with two sub-configs:

- `tsconfig.app.json` — `src/` (browser code, `noEmit: true`)
- `tsconfig.node.json` — `server/` (Node.js proxy, emits to `dist-server/`)

Run `tsc -b` (or `make typecheck`) to type-check both. The build step (`npm run build`) runs
`tsc -b` first and will fail fast on type errors before invoking Vite.

## ESLint

Config lives in `eslint.config.js`. Plugins in use:

- `@typescript-eslint` — TypeScript-aware rules
- `eslint-plugin-react-hooks` — exhaustive deps, rules of hooks
- `eslint-plugin-react-refresh` — ensures components are HMR-safe

Run `npm run lint` or `make lint`.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `KUBE_PROXY_TARGET` | `http://localhost:8001` | Vite proxy target for `/k8s-api/*` |
| `KUBE_PROXY_PORT` | `8001` | Port the bundled proxy listens on |

Set `KUBE_PROXY_TARGET` before starting Vite to point at a different proxy/API server without
touching the UI's Cluster Connection settings.

## Production deployment

```bash
npm run build        # output → dist/
```

Serve `dist/` as static files. Configure your server to:

1. Serve `index.html` for all paths (SPA fallback).
2. Proxy `/k8s-api/*` to your Kubernetes API server or `kubectl proxy` target, stripping the
   `/k8s-api` prefix and forwarding the `Authorization` header if using a bearer token.

Example nginx snippet:

```nginx
location /k8s-api/ {
    proxy_pass https://my-k8s-api-server/;
    proxy_set_header Authorization $http_authorization;
}

location / {
    try_files $uri $uri/ /index.html;
}
```
