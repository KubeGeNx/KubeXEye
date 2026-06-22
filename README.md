# KubeXEye

A Kubernetes resource monitoring UI — dark-themed, browser-only, no cluster-side components
required beyond a running API server.

Built with **React 19**, **PatternFly 6**, **TanStack Query v5**, **TanStack Table v8**, and
**ECharts**.

---

## Quick start

**Step 1 — start a proxy to your cluster**

```bash
kubectl proxy --port=8001
```

Or use the bundled proxy (no `kubectl` binary needed — reads kubeconfig directly):

```bash
make start        # starts proxy + dev server in the background
make logs         # tail logs
make stop         # stop both
```

**Step 2 — install and run**

```bash
npm install
npm run dev
```

Open **http://localhost:5173**.

To connect to a different cluster or API server, use the **Cluster Connection** page in the nav
to set a custom API base URL and optional bearer token.

---

## Features

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
| **Resource Analyser** | Per-namespace CPU and memory breakdown with usage charts |
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

```bash
npm run build      # type-check + bundle → dist/
npm run preview    # serve dist/ locally to verify
```

Serve `dist/` as static files and proxy `/k8s-api/*` to your Kubernetes API server.
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
