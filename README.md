# KubeXEye

[![CI](https://github.com/KubeGeNx/KubeXEye/actions/workflows/ci.yml/badge.svg)](https://github.com/KubeGeNx/KubeXEye/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

A single-page Kubernetes monitoring UI that talks directly to the cluster's REST API — dark-themed,
browser-only, read-only, with no in-cluster agents, CRDs, or operators to install. The browser
issues `GET`s against the discovery and resource endpoints (`/api`, `/apis/<group>/<version>`,
`/api/v1/namespaces/{ns}/...`) and TanStack Query handles polling, caching, and request
deduplication; resource discovery means new CRDs surface generically without code changes.

A bundled Node proxy (`server/proxyServer.ts`) terminates browser requests on `/k8s-api`, resolves
auth from your kubeconfig via `@kubernetes/client-node` — including client-cert and exec/OIDC
credential plugins, so no `kubectl proxy` or long-lived bearer token is required — and forwards to
the selected API server. Multi-cluster switching is per-request: the UI tags each call with an
`X-Kube-Context` header and the proxy re-resolves the target context, so changing clusters needs no
restart. The footprint is strictly read-only — the sole non-`GET` call is a `dryRun=All`
server-side apply (`PATCH`) used to validate manifests, which the API server admits and validates
but never persists.

Built with **React 19**, **PatternFly 6**, **TanStack Query v5**, **TanStack Table v8**, and
**ECharts**.

---

## Quick start

The fastest path uses the **bundled proxy** — it reads your kubeconfig directly, so no `kubectl`
binary or `kubectl proxy` is required:

```bash
make start        # builds deps, then starts the bundled proxy + Vite dev server (background)
make logs         # tail the logs
make stop         # stop everything
```

Then open **http://localhost:5173**.

Prefer to run the steps yourself:

```bash
npm install
npm run server    # bundled kube-proxy on :8001 (reads kubeconfig)
npm run dev       # Vite dev server on :5173 (proxies /k8s-api → :8001)
```

Whichever you choose, use the **cluster switcher** in the nav bar to point at any context in your
kubeconfig, and the **namespace selector** to scope resource views (or pick *All namespaces*).

> Already have `kubectl proxy --port=8001` running? That works too — the dev server forwards
> `/k8s-api` to `http://localhost:8001` by default. Override the target with the
> `KUBE_PROXY_TARGET` environment variable.

To connect straight to an API server instead of going through the proxy, open the **Cluster
Connection** page and set a custom API base URL (e.g. `https://your-api-server:6443`) plus an
optional bearer token with read access. The page live-checks the connection and reports the node
count once connected.

---

## Run & build options

Every workflow is available as a `make` target (run `make help` to list them) and as the
underlying npm script. Ports are overridable via environment variables.

| Command | What it does |
|---|---|
| `make start` / `make stop` | Bundled proxy **+** Vite dev server in the background; `make logs` / `make status` / `make restart` manage them |
| `make run` (alias `make dev`) | Vite dev server in the foreground (expects a proxy already running) |
| `make proxy` / `make proxy-stop` | Bundled kube-proxy only (foreground / stop background) — reads kubeconfig, no `kubectl` needed |
| `make serve` | **Production unified server**: builds the app and serves the frontend **and** kube-proxy from a single process on `:8080` — no Vite, no `kubectl` |
| `make serve-start` / `make serve-stop` | The unified server in the background |
| `make build` | Type-check and bundle to `dist/` (`npm run build`) |
| `make preview` | Serve the production build via Vite preview (dev verification only) |
| `make lint` / `make typecheck` | ESLint / `tsc -b --noEmit` |
| `make test` / `make test-watch` / `make coverage` | Vitest run / watch / V8 coverage report |
| `make clean` / `make distclean` | Remove build output & run artifacts / also stop processes and drop `node_modules` |

**Ports** (override on the command line, e.g. `make serve SERVE_PORT=9090`):
`DEV_PORT` (dev server, default `5173`), `KUBE_PROXY_PORT` (proxy, default `8001`),
`SERVE_PORT` (unified server, default `8080`).

---

## Features

### Multi-cluster & namespace scope

The masthead carries two selectors that apply across every page:

- **Cluster switcher** — lists the contexts in your kubeconfig and forwards the chosen one to the
  proxy via the `X-Kube-Context` header, so switching clusters needs no restart. Switching resets
  the namespace filter to *All namespaces* so views don't silently show empty results for a
  namespace that doesn't exist on the new cluster.
- **Namespace selector** — scope namespaced resource pages to one namespace or *All namespaces*.

### Resource views

All resource pages share a common table with live search, sortable columns, pagination, and a
**CSV export** button. Press **`/`** anywhere on a page to jump to the table's search box.

| Page | What you see |
|---|---|
| **Dashboard** | Node / pod / namespace / deployment counts, CPU & memory gauges, pod phase distribution pie chart, top nodes by resource usage |
| **Nodes** | Status, roles, CPU and memory usage vs. allocatable — cells turn amber at ≥ 65% and red at ≥ 85% |
| **Pods** | Status, readiness, restart count, CPU/memory, node assignment, age — warns on containers missing resource limits |
| **Workloads** | Deployments, StatefulSets, DaemonSets, Jobs in one view |
| **Running Images** | Every unique container image across all pods with pod counts and active namespaces |
| **Namespaces** | Status and age |
| **Events** | Sorted by most recent; Warning events highlighted |
| **ConfigMaps** | Name, namespace, key count, age |
| **Secrets** | Name, type, key names only — values are never fetched or displayed |
| **Service Accounts** | Name, namespace, age |
| **RBAC** | Roles, RoleBindings, ClusterRoles, ClusterRoleBindings in tabbed tables |
| **Services** | Type, cluster IP, ports, age |
| **Ingress** | Class, hosts, backends |
| **Network Policies** | Pod selector, policy types |
| **Persistent Volume Claims** | Status, storage class, capacity, access modes |
| **Storage Classes** | Provisioner, reclaim policy, binding mode |
| **Custom Resources** | Lists all installed CRDs grouped by API group; browse instances of any CRD generically — no code changes needed for new CRDs |
| **Helm Releases** | Name, chart, version, status, last deployed — decoded from Helm's own Secrets |
| **Resource Analyser** | Author a manifest (or pick a discovered kind), validate it against the live API server with a dry run, and get best-practice feedback before applying it for real |
| **Security Analyzer** | Score a Pod/Deployment/StatefulSet/DaemonSet/Job/CronJob (pasted, or picked live from the cluster) against Pod Security Standards, the CIS Benchmark, and the OWASP Kubernetes Top 10 — see [below](#security-analyzer) |
| **Cluster Connection** | Configure API base URL and bearer token |

### Dependency Map

Interactive force-layout graph of resource relationships — workloads → ConfigMaps, Secrets,
ServiceAccounts, PVCs → StorageClasses, Services → Pods (via label selectors), Ingress → Services.

- Broken references (e.g. a Pod mounting a ConfigMap that no longer exists) are highlighted red.
- Forward and reverse dependency lists alongside the graph.
- 1 / 2 / 3 hop expand/collapse to control how much of the graph you see at once.
- Click any node to re-center; breadcrumb trail for navigating back.
- Reachable from the nav or from the "Map" action on individual rows in Pods, Workloads, Services,
  Ingress, ConfigMaps, Secrets, ServiceAccounts, and PVCs.

### Panic Dashboard

Cluster-wide (not namespace-scoped) scan for issues requiring attention:

- NotReady nodes
- Unhealthy pods, Deployments, StatefulSets, DaemonSets
- Unbound or lost PVCs
- Broken dependency edges from the graph

Issues are ranked **Critical / High / Medium** with an estimated blast radius (how many resources
are affected), and link directly into the Dependency Map for the affected resource.

### Security Analyzer

A deterministic, rule-based static security assessment for a single workload manifest — entirely
client-side, nothing is sent anywhere. Either select a running pod from the cluster (via the
namespace-scoped pod picker) or paste/author a Pod, Deployment, StatefulSet, DaemonSet, Job,
CronJob, Role/ClusterRole, or ServiceAccount manifest.

- **0–100 score** with a letter grade (A+ to F) and a Low/Moderate/High/Critical risk level,
  computed by deducting points per finding (Critical −10, High −7, Medium −4, Low −2,
  Informational 0).
- **43 checks** across Identity & Privileges, Runtime Security, Filesystem, Networking, Image
  Security, Secrets & Identity, Resource Management, and Operational Best Practices — see
  `src/utils/securityAnalysis.ts` for the full rule catalogue.
- **Pod Security Standards compliance** (Restricted / Baseline / Privileged), with the specific
  violations listed per standard.
- **CIS Kubernetes Benchmark** and **OWASP Kubernetes Top 10** mappings for every finding.
- Severity-grouped **remediation order** with an estimated post-fix score, and an overall
  production-readiness / admission verdict.

Missing configuration is always treated as "not configured," never assumed safe.

### Pod logs

The log panel in the pod detail drawer renders ANSI SGR escape codes — colors from your
application's own logging library appear in the browser exactly as they would in a terminal.
Auto-sync polls on a configurable interval; refresh manually at any time.

### Definition viewer (YAML / JSON)

Every resource table has a **Definition** action that opens the full Kubernetes object in a modal
with YAML and JSON tabs — both syntax-highlighted. Copy-to-clipboard is built in. Secrets are
redacted (values replaced with `<redacted>`) before being shown.

### Global search — ⌘K

Press **⌘K** (or **Ctrl+K**) anywhere in the app to open a command palette that searches:

- All page names and descriptions (always available, no network needed).
- Resource names across pods, nodes, services, ingress, and secrets already loaded in the cache.

Arrow keys to navigate, Enter to open. Selecting a resource pre-fills the table filter on the
target page.

### Quality-of-life

- **Background refresh indicator** — a spinner appears in the masthead while any background
  API fetch is in flight.
- **Per-route error isolation** — a render crash on one page shows an inline recovery card.
  The rest of the app keeps running. "Try again" resets the boundary without a page reload.
- **Resizable sidebar** — drag the right edge of the nav panel; main content reflows instantly.
- **Dark theme** — consistent color palette with semantic status colors: healthy green, warning
  amber, error red, info blue.

---

## Building for production

The simplest deployment is the **unified server** — one Node process that builds the app, serves
the static frontend, and proxies the Kubernetes API (with multi-cluster switching) on a single
port. No Vite and no `kubectl` are involved:

```bash
make serve                  # build + serve on http://localhost:8080 (foreground)
make serve-start            # same, in the background (make serve-stop to stop)
make serve SERVE_PORT=9090  # custom port
```

Prefer to host the static bundle yourself? Build it and serve `dist/` from any static web server,
proxying `/k8s-api/*` to your Kubernetes API server:

```bash
npm run build      # type-check + bundle → dist/
npm run preview    # serve dist/ locally to verify
```

See [doc/development.md](doc/development.md) for a full nginx example.

---

## Documentation

| Doc | Contents |
|---|---|
| [doc/architecture.md](doc/architecture.md) | Stack, project structure, data flow, theming, key design decisions |
| [doc/development.md](doc/development.md) | All npm scripts and Make targets, proxy options, production deployment |
| [doc/adding-resources.md](doc/adding-resources.md) | Step-by-step guide for adding new resource types, dependency map wiring, global search |
| [doc/testing.md](doc/testing.md) | Test setup, what's covered, real bugs caught during development |
| [doc/rbac.md](doc/rbac.md) | Minimum RBAC permissions, example ClusterRole manifest |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, coding conventions, PR checklist |
| [SECURITY.md](SECURITY.md) | Reporting a vulnerability |
