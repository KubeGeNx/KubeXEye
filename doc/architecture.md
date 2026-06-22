# Architecture

## Stack

| Layer | Library | Version | Role |
|---|---|---|---|
| UI framework | React | 19 | Component model, concurrent rendering |
| Language | TypeScript | 6 | Types across the whole codebase |
| Design system | PatternFly | 6 | Layout, nav, forms, tables, dark theme tokens |
| Data fetching | TanStack Query | v5 | Caching, polling, background refresh, retry |
| Table logic | TanStack Table | v8 | Sort, filter, pagination — decoupled from rendering |
| Charts | ECharts + echarts-for-react | 6 / 3 | Gauges, pie, bar, force-layout dependency graph |
| Routing | React Router | 7 | Client-side routes with lazy-loaded pages |
| Build | Vite | 8 | Dev server, HMR, production bundle |
| Proxy | tsx + @kubernetes/client-node | — | Optional bundled kubeconfig proxy (`server/proxyServer.ts`) |

## How the browser talks to Kubernetes

There is no application backend. The browser calls the Kubernetes API server directly via a
`/k8s-api/*` Vite proxy that rewrites the path and forwards to a configurable target:

```
Browser → Vite dev server (/k8s-api/*) → KUBE_PROXY_TARGET (default http://localhost:8001)
                                              ↑
                               kubectl proxy  OR  bundled proxyServer.ts
```

`KUBE_PROXY_TARGET` can be overridden at startup, or changed at runtime via the **Cluster
Connection** page which writes the URL and optional bearer token into React context
(`src/context/ConnectionContext.tsx`).

In production builds (`npm run build` → `vite preview`), the same `/k8s-api/*` rewrite must be
configured on whatever reverse proxy serves the static assets (nginx `proxy_pass`, etc.).

## Data flow

```
useK8sResources.ts  ──TanStack Query──►  api/client.ts  ──fetch──►  /k8s-api/*  ──►  K8s API
       │                                                                               │
       │  (cached, auto-refreshed every 10s per hook)                                 │
       ▼                                                                               │
  React components / pages                                                             │
       │                                                                               │
       ├── ResourceTable (TanStack Table: sort, filter, paginate, CSV export)         │
       ├── ECharts wrappers (gauge, pie, bar, force graph)                            │
       ├── ResourceYamlView (YAML/JSON syntax-highlighted definition modal)           │
       └── PodLogsPanel (ANSI-colored log stream with auto-sync interval)            ◄┘
                                                                          (log API)
```

### QueryClient defaults

```typescript
{
  retry: (count, err) => count < 2 && err?.status !== 404,  // never retry 4xx
  refetchOnWindowFocus: false,
  staleTime: 0,          // always re-fetch on remount
  gcTime: 5 * 60_000,   // keep cache 5 min for instant back-navigation
  networkMode: 'always', // works behind a local kubectl-proxy
}
```

## Project structure

```
src/
  api/
    client.ts              Generic k8s REST GET helper; API group path constants
  context/
    ConnectionContext.tsx  API base URL + bearer token (persisted to localStorage)
    NamespaceContext.tsx   Selected namespace; "all namespaces" mode
    DefinitionViewerContext.tsx  App-level modal state for resource YAML/JSON viewer
    PodDetailContext.tsx   App-level drawer state for pod detail / logs panel
  hooks/
    useK8sResources.ts     One TanStack Query hook per resource type
  components/
    ErrorBoundary.tsx      Class-based error boundary; wraps every route in App.tsx
    GlobalSearch.tsx        ⌘K command palette — page navigation + live cache search
    PodLogsPanel.tsx        Log viewer with ANSI SGR color parser + auto-sync interval
    ResourceYamlView.tsx    YAML/JSON tabs with syntax highlighting
    table/
      ResourceTable.tsx    TanStack Table + PatternFly: search (/), sort, paginate, CSV export
    charts/
      DependencyGraphChart.tsx   ECharts force-layout graph for the dependency map
      DistributionPieChart.tsx   Pod phase / status pie
      TopUsageBarChart.tsx       Top-N nodes by CPU/memory bar chart
      UsageGaugeChart.tsx        Cluster CPU/memory gauge (color-coded at 65%/85%)
    layout/
      AppLayout.tsx        Page shell: resizable sidebar, masthead with refresh indicator + ⌘K
      NamespaceSelector.tsx
      ClusterSelector.tsx
      Logo.tsx
      navIcons.tsx
  graph/
    types.ts               ResourceRef / NormalizedResource / GraphEdge
    normalize.ts           Per-kind health-status normalization (→ Healthy/Warning/Error/Pending/Unknown)
    buildResourceGraph.ts  Relationship extraction; the dependency rules live here
    neighborhood.ts        Forward/reverse lookups + BFS hop expansion for the graph view
  pages/
    Dashboard.tsx          Cluster overview
    Nodes.tsx              Node list with CPU/memory coloring
    Pods.tsx               Pod list with resource-limit warnings
    Workloads.tsx          Deployments / StatefulSets / DaemonSets
    Images.tsx             Running container images
    Namespaces.tsx
    Events.tsx
    ConfigMaps.tsx
    Secrets.tsx
    ServiceAccounts.tsx
    RBAC.tsx               Roles, RoleBindings, ClusterRoles, ClusterRoleBindings
    Services.tsx
    Ingress.tsx
    NetworkPolicies.tsx
    PersistentVolumeClaims.tsx
    StorageClasses.tsx
    CustomResources.tsx    Generic CRD browser (any CRD, no code change needed)
    HelmReleases.tsx
    DependencyMap.tsx
    PanicPage.tsx
    ResourceAnalyser.tsx
    Settings.tsx
  types/
    k8s.ts                 Minimal hand-rolled k8s object types (no generated client)
  utils/
    resourceUnits.ts       CPU/memory quantity parsing (e.g. "500m", "2Gi") & formatting
    yamlHighlight.ts       YAML and JSON line-by-line syntax tokenizers
    podResourceChecks.ts   Detects containers missing resources.requests / limits
    helmDecoder.ts         Decodes Helm release secrets (base64 → gzip → JSON)
  theme.css                Dark theme: --kx-color-* palette + PatternFly token overrides
  App.tsx                  Route tree; React.lazy imports; QueryClient; ErrorBoundary wrapping
  main.tsx                 React DOM entry point
server/
  proxyServer.ts           Optional bundled proxy: reads kubeconfig via @kubernetes/client-node,
                           exposes the K8s API on :8001, no kubectl binary needed
```

## Theming

All colors are defined as CSS custom properties in `src/theme.css` applied under `.pf-v6-theme-dark`:

| Variable | Value | Use |
|---|---|---|
| `--kx-color-text-primary` | `#F0EEE8` | Body text, headings |
| `--kx-color-text-secondary` | `#C8C5BB` | Labels, subtitles |
| `--kx-color-text-muted` | `#7B7970` | Timestamps, metadata |
| `--kx-color-link` | `#7EB6F0` | Links, info highlights |
| `--kx-color-status-healthy` | `#3ABE82` | Running / Healthy |
| `--kx-color-status-warning` | `#F0A028` | Degraded / Warning |
| `--kx-color-status-error` | `#E25A5A` | Failed / Error / Critical |

These are also applied directly in ECharts chart options and inline styles that can't be reached by CSS.

## Key design decisions

**No generated K8s client** — `src/types/k8s.ts` has hand-rolled minimal types. The Kubernetes
TypeScript client generates ~50 MB of types; we only need a small subset and prefer explicit control.

**Single definition viewer modal** — `DefinitionViewerContext` mounts one modal at the app root.
Per-row modals were silently closing when background query refetches remounted the table row that
owned them. The context-level modal also stores a frozen snapshot of the resource at click time, so
the content doesn't change while the user is reading it.

**Route-level error boundaries** — each `<Route>` is wrapped in its own `<ErrorBoundary>`. A render
crash caused by a malformed CRD or unexpected API shape on one page shows a recovery card without
taking down the whole app. The "Try again" button resets the boundary state without a page reload.

**Sidebar CSS variable placement** — PatternFly 6 reads `--pf-v6-c-page__sidebar--Width` from the
`.pf-v6-c-page` root element to compute the main-content `margin-left`. The variable must be set
on `<Page>`, not `<PageSidebar>`, for the main content to reflow when the sidebar is resized.
