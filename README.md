# KubeXEye

A Kubernetes resource monitoring UI built with React, TypeScript, PatternFly, TanStack Query, TanStack Table, and ECharts.

## Stack

- **React 19 + TypeScript** — UI and types
- **PatternFly 6** — layout, navigation, forms, tables shell
- **TanStack Query** — data fetching/caching/polling against the Kubernetes API
- **TanStack Table** — sorting, filtering, pagination logic for resource lists
- **ECharts** (via `echarts-for-react`) — cluster usage gauges, pod status distribution, top-node usage charts
- **Vite** — dev server / build
- **React Router 7** — client-side routing

## How it talks to Kubernetes

The browser calls the Kubernetes API server directly (no custom backend). In dev, Vite proxies
`/k8s-api/*` to a target you control via `KUBE_PROXY_TARGET` (defaults to `http://localhost:8001`,
i.e. `kubectl proxy`). This avoids CORS and reuses your kubeconfig's credentials.

```bash
# Terminal 1
kubectl proxy --port=8001

# Terminal 2
npm install
npm run dev
```

Open http://localhost:5173.

To point at a different proxy/API server, set `KUBE_PROXY_TARGET` before starting Vite, or use the
**Cluster Connection** page in the app to set a custom API base URL / bearer token (for environments
where you're hitting an API server directly instead of `kubectl proxy`).

## Resources covered

- Cluster dashboard (node/pod/namespace/deployment counts, CPU & memory gauges, pod phase
  distribution, top nodes by CPU) — usage gauges require `metrics-server` to be installed
- Nodes (status, roles, CPU/memory usage vs. allocatable)
- Pods (status, readiness, restarts, CPU/memory, node, age) — namespace-scoped via the namespace
  selector in the masthead
- Deployments / StatefulSets / DaemonSets
- Namespaces
- Events (sorted by most recent, color-coded by type)
- ConfigMaps
- Secrets (names, types, and key names only — values are never fetched/decoded/rendered)
- ServiceAccounts
- RBAC: Roles, RoleBindings, ClusterRoles, ClusterRoleBindings
- NetworkPolicies
- Custom Resources — lists installed CRDs grouped by API group, then browses instances of the
  selected CRD generically (works for any CRD without code changes) with a raw-JSON detail view
- Services, Ingress, Persistent Volume Claims, Storage Classes
- **Dependency Map** — normalizes resources into a consistent shape with a computed health status,
  extracts relationships (workload → ConfigMap/Secret/ServiceAccount/PVC, PVC → StorageClass,
  Service/workload → Pods via label selectors, Ingress → Service), and renders them as an
  interactive ECharts force graph. Supports forward/reverse dependency lists, 1–3 hop
  expand/collapse, click-to-recenter navigation with a back/breadcrumb trail, and highlights
  broken references (e.g. a Pod mounting a ConfigMap that doesn't exist) in red. Reach it from the
  nav, or via the "Map" action on rows in Pods/Workloads/Services/Ingress/ConfigMaps/Secrets/
  ServiceAccounts/PVCs. Graph zoom uses a fixed step on scroll/trackpad (not the raw wheel delta),
  since trackpads otherwise make ECharts' default zoom feel wildly oversensitive.
- **Panic Dashboard** — scans the whole cluster (not namespace-scoped) for NotReady nodes,
  unhealthy pods/Deployments/StatefulSets/DaemonSets, unbound/lost PVCs, and broken dependency
  edges from the graph above; ranks them by severity (Critical/High/Medium) and an estimated blast
  radius (e.g. how many pods sit on a dead node, how many resources reference a missing
  ConfigMap), with a one-click link from each issue into the Dependency Map. Also surfaces the most
  recent Warning events as a raw signal (deliberately not correlated into the ranked issues yet).
- **Helm Releases** — detected by reading Helm's own `helm.sh/release.v1` Secrets and decoding chart/
  status metadata (name, chart, version, appVersion, revision, status, last deployed) plus a
  **Values** action showing the values supplied at install/upgrade time (`release.config`) — flagged
  with a warning since charts sometimes accept credentials directly as values. `release.manifest` is
  never parsed, since the rendered manifest can embed other resources' literal data (e.g. a
  chart-created Secret's contents). One row per release, showing its highest revision (mirrors
  `helm list`).
- **View definition (YAML/JSON)** — every resource table has a "Definition" action that opens the
  full object in a single, app-level modal (`src/context/DefinitionViewerContext.tsx`, mounted once
  in `App.tsx`) with YAML/JSON tabs and a copy-to-clipboard action. `ResourceDefinitionButton` is
  just a trigger that snapshots `resource` at click time into that shared viewer — deliberately not
  a per-row Modal, since a poll-driven table refetch was remounting per-row modals and silently
  closing whatever the user had open. The snapshot also means the displayed content doesn't change
  while it's open; closing and reopening re-snapshots the latest data. Secrets are redacted before
  being shown (data values replaced with `<redacted>`, same boundary as the Secrets list). The Pods
  page additionally flags containers with no `resources.requests`/`limits` defined, both as a
  warning icon in the table and as a warning banner inside the definition modal
  (`src/utils/podResourceChecks.ts`).

## Project structure

```
src/
  api/client.ts            generic k8s REST GET helper + API group path constants
  context/                 connection (API base/token) and namespace-selector contexts
  hooks/useK8sResources.ts one TanStack Query hook per resource type
  components/
    table/ResourceTable.tsx  generic TanStack Table + PatternFly table (search/sort/paginate)
    charts/                  ECharts gauge/pie/bar/graph wrappers
    layout/                  masthead, nav, namespace selector
  graph/
    types.ts                 ResourceRef/NormalizedResource/GraphEdge types
    normalize.ts              per-kind health-status normalization
    buildResourceGraph.ts     relationship extraction (the dependency rules live here)
    neighborhood.ts           forward/reverse lookups + BFS hop expansion for the graph view
  pages/                    one page per resource area
  types/k8s.ts              minimal hand-rolled k8s object types
  utils/resourceUnits.ts    cpu/memory quantity parsing & formatting
  test/setup.ts             Vitest setup (jest-dom matchers, RTL cleanup)
```

Tests are colocated next to the code they cover as `*.test.ts(x)`, not in a separate `__tests__/` tree.

## Adding a new resource type

1. Add a minimal type to `src/types/k8s.ts`.
2. Add a `useList<T>(...)` hook in `src/hooks/useK8sResources.ts` pointing at its REST path.
3. Add a page under `src/pages/` using `<ResourceTable />` with a `ColumnDef[]`.
4. Add a route in `src/App.tsx` and a nav entry in `src/components/layout/AppLayout.tsx`.

Custom resources (CRDs) don't need any of this — they're already handled generically by the
**Custom Resources** page.

To make a new resource type show up in the **Dependency Map**, add it to `ClusterTopologyInput` in
`src/graph/buildResourceGraph.ts`, write a `normalizeX` function in `src/graph/normalize.ts`, and add
whatever relationship rules apply (look at the existing Pod/PVC/Service rules for the pattern: every
`link(from, to, relation)` call is one edge, and an edge to a nonexistent resource is automatically
flagged `broken`).

## Scripts

```bash
npm run dev         # start dev server (with k8s-api proxy)
npm run build       # type-check + production build
npm run preview     # preview the production build
npm run lint        # eslint
npm test            # run the test suite once (Vitest)
npm run test:watch  # run the test suite in watch mode
```

Or via `make test` / `make test-watch` (see the Makefile's `make help`).

## Testing

Vitest + React Testing Library, configured in `vitest.config.ts` (jsdom environment, setup file at
`src/test/setup.ts` for `@testing-library/jest-dom` matchers and automatic DOM cleanup between
tests — RTL's auto-cleanup needs either `globals: true` or an explicit `afterEach(cleanup)`, and we
use the latter to keep `describe`/`it`/`expect` as explicit imports).

Coverage is concentrated on the parts with real logic, not page-by-page UI snapshots:

- `src/graph/buildResourceGraph.test.ts`, `neighborhood.test.ts`, `normalize.test.ts` — the
  dependency-mapping engine: relationship extraction, broken-reference detection, hop expansion,
  per-kind health status.
- `src/panic/collectIssues.test.ts` — Panic Dashboard severity/blast-radius logic.
- `src/utils/*.test.ts` — resource-quantity parsing, secret redaction, missing resource-limit
  detection, and the Helm release secret decoder (round-tripped through a real `pako.gzip` +
  double-base64 fixture, the same encoding Helm itself uses).
- `src/context/DefinitionViewerContext.test.tsx` — regression coverage for a real bug: the
  definition modal used to live inside each table row and would silently close when the row
  refetched/remounted. These tests assert the modal survives its trigger unmounting, and that its
  content is a frozen snapshot rather than reactively tied to live data.
- `src/components/table/ResourceTable.test.tsx` — search filtering, sorting, loading/empty/error
  states for the table every resource page is built on.

Two real bugs were caught and fixed while writing this suite (not staged — these were genuine
issues until the tests found them):
1. `buildResourceGraph`'s `link()` marked only the *first* edge to a given missing resource as
   `broken`; later edges to that same missing target were incorrectly `broken: false` because the
   check only tested "does a node exist," not "is it a real resource or a synthetic missing one."
2. PatternFly v6's `Modal` no longer renders a visible heading from a `title` string prop (that
   prop is now just the native HTML tooltip attribute) — it requires a `<ModalHeader title="...">`
   child. TypeScript didn't catch this because `title` is still accepted as a generic HTML
   attribute, so every definition-viewer modal was silently missing its visible title until a test
   asserted on it.

## Required RBAC

The credentials behind `kubectl proxy` (or the bearer token you configure) need read (`get`/`list`)
access to whichever resources you want to view — nodes, pods, namespaces, events, configmaps,
secrets, serviceaccounts, deployments/statefulsets/daemonsets, roles/rolebindings/clusterroles/
clusterrolebindings, networkpolicies, customresourcedefinitions, and any CRD instances, plus
`metrics.k8s.io` (nodes/pods) if `metrics-server` is installed and you want usage charts.
