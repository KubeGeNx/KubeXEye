# Testing

## Stack

- **Vitest** — test runner (fast, native ESM, compatible with Jest's API)
- **React Testing Library** — component rendering and user-event simulation
- **@testing-library/jest-dom** — extended matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)
- **jsdom** — browser environment for Vitest

Configuration lives in `vitest.config.ts`. The jsdom environment is set globally, so no per-file
pragma is needed. Setup file at `src/test/setup.ts` imports `@testing-library/jest-dom` and calls
`afterEach(cleanup)` explicitly (we import `describe`/`it`/`expect` explicitly rather than using
`globals: true`, so the automatic cleanup hook from RTL's setup entry point doesn't fire).

## Running tests

```bash
npm test                # run once
npm run test:watch      # interactive watch mode
npm run coverage        # run once + V8 coverage report → coverage/

make test               # same as npm test
make test-watch         # same as npm run test:watch
make coverage           # same as npm run coverage
```

## What's covered

Tests are colocated with the code they cover as `*.test.ts(x)` files. Coverage is concentrated on
the parts with real algorithmic logic rather than page-level UI snapshots.

### Dependency graph engine

`src/graph/buildResourceGraph.test.ts` — relationship extraction: workload→ConfigMap/Secret/PVC,
Service→Pod label-selector matching, Ingress→Service, PVC→StorageClass. Covers both the happy
path (edges exist and are `broken: false`) and broken references (target doesn't exist →
`broken: true`, node still added to the graph as a synthetic "missing" node).

`src/graph/neighborhood.test.ts` — forward and reverse dependency lookups; BFS hop expansion
(1-hop, 2-hop, 3-hop) returning the correct subgraph each time.

`src/graph/normalize.test.ts` — per-kind health-status normalization: a Running pod is `Healthy`,
a CrashLoopBackOff pod is `Error`, a Pending pod is `Pending`, and so on for each supported kind.

### Panic Dashboard

`src/panic/collectIssues.test.ts` — severity ranking (`Critical` / `High` / `Medium`) and
blast-radius estimation (e.g. how many pods sit on a NotReady node, how many resources reference a
missing ConfigMap). Verifies that issues are sorted by severity descending and de-duplicated.

### Utilities

`src/utils/resourceUnits.test.ts` — CPU quantity parsing (`"500m"` → `0.5`, `"2"` → `2.0`) and
memory parsing (`"512Mi"` → `536870912`, `"1Gi"` → `1073741824`); formatting back to human-readable.

`src/utils/secretRedaction.test.ts` — verifies that `data` values in K8s Secret objects are
replaced with `<redacted>` before being shown in the definition viewer, and that `metadata` and
`type` fields pass through unchanged.

`src/utils/podResourceChecks.test.ts` — detects containers with missing `resources.requests` and/or
`resources.limits`; verifies that the warning is per-container, not per-pod, and that pods with all
containers fully specified produce no warnings.

`src/utils/helmDecoder.test.ts` — decodes a Helm release secret end-to-end: base64 → gunzip →
base64 → JSON. The fixture is produced by a real `pako.gzip` call (the same encoding Helm itself
uses), so this test would catch any change to the decoding pipeline.

### Context

`src/context/DefinitionViewerContext.test.tsx` — regression coverage for a real bug: the definition
modal used to live inside each table row and would silently close when the row refetched and
remounted. Tests assert that:

1. The modal remains open after its trigger (the `ResourceDefinitionButton`) unmounts.
2. The modal content is a frozen snapshot of the resource at click time — it does not update if the
   underlying data changes while the modal is open.
3. Closing and reopening re-snapshots to the latest data.

### ResourceTable

`src/components/table/ResourceTable.test.tsx` — the generic table component used by every resource
page:

- Search/filter: typing in the search box filters visible rows; clearing restores all rows.
- Sorting: clicking a column header sorts ascending, clicking again sorts descending.
- Pagination: rows beyond `perPage` are hidden; changing the page shows the next batch.
- Loading state: spinner is shown when `isLoading` is true and `data` is undefined.
- Empty state: "No resources found" message when data is an empty array.
- Error state: `Alert` with the error message when `error` is set.

## Real bugs caught during test development

Two genuine bugs were found (and fixed) while writing the test suite — neither was caught by the
TypeScript compiler:

**Bug 1 — broken-reference detection in `buildResourceGraph`**

`link()` marked only the *first* edge to a given missing resource as `broken: true`. Subsequent
edges to the same missing target were `broken: false` because the check only tested "does a node
with this uid exist" — and after the first broken edge, a synthetic "missing" node *was* added to
the map, so the check passed for all later references. Fixed by tagging synthetic nodes and checking
the tag, not just node existence.

**Bug 2 — invisible modal title in PatternFly v6**

PatternFly v6's `Modal` no longer renders a visible heading from the `title` string prop — that
prop is now the native HTML `title` attribute (tooltip text). A `<ModalHeader title="...">` child
element is required for a visible heading. TypeScript did not catch this because `title` is a
valid HTML attribute on any element. Every definition-viewer modal was silently missing its visible
title in production until a test asserted `getByRole('heading', { name: /definition/i })`.
