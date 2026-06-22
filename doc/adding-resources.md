# Adding a New Resource Type

This guide explains how to add a new Kubernetes resource type to KubeXEye — from the API hook all
the way through to showing up in the table, definition viewer, global search, and optionally the
dependency map.

## 1. Add a TypeScript type

In `src/types/k8s.ts`, add a minimal interface that covers only the fields the UI will display.
You don't need to replicate the full Kubernetes schema.

```typescript
export interface K8sMyResource {
  apiVersion: string;
  kind: string;
  metadata: K8sObjectMeta;
  spec?: {
    someField?: string;
  };
  status?: {
    phase?: string;
  };
}
```

## 2. Add a data-fetching hook

In `src/hooks/useK8sResources.ts`, add a hook that calls the appropriate REST path.
Namespace-scoped resources use `namespacedPath`; cluster-scoped resources use `clusterPath`.

```typescript
export function useMyResources() {
  const { namespace } = useNamespace();
  return useQuery<{ items: K8sMyResource[] }>({
    queryKey: ['myresources', namespace],
    queryFn: () => get(namespacedPath('myresources', namespace)),
    refetchInterval: 10_000,
  });
}
```

The `queryKey` prefix (`'myresources'`) is what GlobalSearch uses to find cached items — use it
consistently.

## 3. Add a page

Create `src/pages/MyResources.tsx`. Use `ResourceTable` with a `ColumnDef[]` array:

```typescript
import { createColumnHelper } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { useMyResources } from '../hooks/useK8sResources';
import type { K8sMyResource } from '../types/k8s';

const col = createColumnHelper<K8sMyResource>();

const columns = [
  col.accessor((r) => r.metadata.name, { header: 'Name' }),
  col.accessor((r) => r.metadata.namespace, { header: 'Namespace' }),
  col.accessor((r) => r.status?.phase, { header: 'Phase' }),
  col.display({
    id: 'actions',
    header: '',
    cell: (c) => <ResourceDefinitionButton resource={c.row.original} />,
  }),
];

export function MyResources() {
  const { data, isLoading, error } = useMyResources();
  return (
    <ResourceTable
      data={data?.items}
      columns={columns}
      isLoading={isLoading}
      error={error}
      searchPlaceholder="Search my resources..."
      exportFilename="my-resources"   // enables the CSV export button
    />
  );
}
```

## 4. Add a route

In `src/App.tsx`, add a lazy import and a `<Route>`:

```typescript
const MyResources = lazy(() => import('./pages/MyResources').then(m => ({ default: m.MyResources })));

// inside the <Route element={<AppLayout />}> block:
<Route
  path="/my-resources"
  element={
    <ErrorBoundary label="My Resources">
      <Suspense fallback={<PageSpinner />}>
        <MyResources />
      </Suspense>
    </ErrorBoundary>
  }
/>
```

## 5. Add a nav entry

In `src/components/layout/AppLayout.tsx`, add to the appropriate section of `navSections`:

```typescript
{ to: '/my-resources', label: 'My Resources', icon: NAV_ICONS.someIcon },
```

And add an icon key to `src/components/layout/navIcons.tsx` if needed.

## 6. Add to GlobalSearch

In `src/components/GlobalSearch.tsx`, add the page to the `PAGES` array:

```typescript
{ kind: 'page', label: 'My Resources', path: '/my-resources', description: 'Brief description' },
```

To also make individual resource instances searchable by name (so ⌘K shows them when the user types
a resource name), add an entry to the `RESOURCE_MAP` array:

```typescript
{
  prefix: 'myresources',          // must match the queryKey prefix from step 2
  path: '/my-resources',
  icon: <CubeIcon style={{ color: '#7EB6F0' }} />,
  getName: (i) => (i as K8sMyResource)?.metadata?.name ?? null,
  getSub: (i) => (i as K8sMyResource)?.metadata?.namespace ?? '',
},
```

When the user selects a resource from ⌘K, they're navigated to `/my-resources?search=<name>` and
the table filter is pre-filled. `ResourceTable` reads this param via the URL if you add:

```typescript
// At the top of the page component
const [searchParams] = useSearchParams();
const initialSearch = searchParams.get('search') ?? '';
```

and pass `initialSearch` as the initial value for `globalFilter` in the table.

---

## Adding to the Dependency Map

The dependency map is opt-in and requires a few extra steps.

### a. Add to `ClusterTopologyInput`

In `src/graph/buildResourceGraph.ts`, add your resource list to the input type and destructure it:

```typescript
export interface ClusterTopologyInput {
  // ...existing fields...
  myResources: K8sMyResource[];
}

export function buildResourceGraph({ ..., myResources }: ClusterTopologyInput) {
  // ...
}
```

### b. Write a `normalizeX` function

In `src/graph/normalize.ts`, add a function that converts your resource into a `NormalizedResource`:

```typescript
export function normalizeMyResource(r: K8sMyResource): NormalizedResource {
  return {
    uid: r.metadata.uid!,
    kind: 'MyResource',
    name: r.metadata.name,
    namespace: r.metadata.namespace,
    status: r.status?.phase === 'Ready' ? 'Healthy' : 'Unknown',
    raw: r,
  };
}
```

### c. Add relationship rules

Back in `buildResourceGraph.ts`, call `link(from, to, relation)` to declare edges. An edge to a
`uid` that doesn't exist in the node map is automatically flagged `broken: true` and highlighted
red in the graph.

```typescript
for (const r of myResources) {
  const node = normalizeMyResource(r);
  addNode(node);

  // Example: MyResource references a ConfigMap by name
  if (r.spec?.configMapRef) {
    const cmUid = findConfigMapUid(r.metadata.namespace, r.spec.configMapRef.name);
    link(node.uid, cmUid, 'uses-config');
  }
}
```

### d. Wire up data in `DependencyMap.tsx`

Pass the new hook data into `buildResourceGraph`:

```typescript
const myResources = useMyResources();
const graph = useMemo(() =>
  buildResourceGraph({ ..., myResources: myResources.data?.items ?? [] }),
  [..., myResources.data]
);
```

---

## Custom Resources (CRDs)

CRDs don't need any of the above steps. The **Custom Resources** page already handles them
generically: it lists installed CRDs grouped by API group, then fetches and browses instances of
whichever CRD the user selects, with a raw YAML/JSON definition view. This works for any CRD
without code changes.

If you want a CRD to appear in the dependency map (e.g. an Argo Rollout referencing Services),
follow the steps above treating it like a standard resource type.
