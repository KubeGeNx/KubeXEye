# Contributing to KubeXEye

Thanks for considering a contribution. KubeXEye is a browser-only Kubernetes dashboard with no
backend of its own (see [doc/architecture.md](doc/architecture.md)), so most changes touch only
`src/` (and occasionally `server/proxyServer.ts`, the optional bundled kubeconfig proxy).

## Before you start

- **Bug fixes / small improvements** — feel free to open a PR directly.
- **New features or anything that changes existing behavior** — open an issue first describing
  the problem and your proposed approach. This avoids wasted work if the direction needs
  adjusting.
- **Security issues** — do not open a public issue. See [SECURITY.md](SECURITY.md).

## Getting started

```bash
git clone <your-fork-url>
cd KubeXEye
npm install
make start        # bundled kube-proxy + Vite dev server, http://localhost:5173
```

You'll need a Kubernetes cluster to develop against (a local `kind`/`minikube`/`k3d` cluster works
fine — the app is read-only apart from a single `dryRun=All` server-side apply used by the
Resource Analyser page, so nothing you do in the UI can mutate a real cluster). Full setup options,
proxy modes, and every `npm`/`make` command are documented in
[doc/development.md](doc/development.md).

**Requirements:** Node.js ≥ 20.19 (Vite 8 requires it), npm ≥ 10.

## Project orientation

Read [doc/architecture.md](doc/architecture.md) first — it covers the stack, the data flow from
`useK8sResources.ts` hooks through to pages, the project structure, and the key design decisions
(no generated k8s client, single definition-viewer modal, route-level error boundaries) along with
the reasoning behind them. Understanding *why* those decisions were made will save you from
re-litigating them in review.

## Making changes

### Adding a new resource-type page (e.g. a Kubernetes resource this app doesn't show yet)

Follow [doc/adding-resources.md](doc/adding-resources.md) step by step — it covers the type, the
data hook, the page, routing, nav, global search, and (optionally) the dependency map, with working
code snippets for each step.

### Adding a new standalone feature page (not tied to one resource type)

Follow the pattern used by existing feature pages (`PanicPage.tsx`, `ResourceAnalyser.tsx`,
`SecurityAnalyzer.tsx`):

1. Put any non-trivial analysis/scoring logic in a pure, framework-free module under `src/utils/`
   (or a dedicated folder like `src/panic/` if the logic set is large) — this keeps it independently
   unit-testable and keeps the page component focused on layout.
2. Add the page component in `src/pages/<Name>.tsx`, following the standard page skeleton:
   `<PageSection><PageTitle icon={NAV_ICONS.x}>Title</PageTitle>...</PageSection>`, content organized
   in PatternFly `Card`/`CardBody` blocks inside a `Grid`.
3. Wire it up in exactly these places:
   - `src/components/layout/navIcons.tsx` — add an icon key (pick something distinct from what's
     already in use).
   - `src/components/layout/AppLayout.tsx` — add a `NavItem` to the appropriate `navSections` entry
     (or a new section).
   - `src/App.tsx` — add a `React.lazy` import and a `<Route>` wrapped in `<ErrorBoundary>` +
     `<Suspense fallback={<PageSpinner />}>`, matching the existing routes.
4. Add a `*.test.ts(x)` file next to any new logic module (see [doc/testing.md](doc/testing.md) for
   what this codebase tends to test and why).

### General code style

- **No gratuitous abstractions.** Three similar lines beat a premature helper; don't design for
  hypothetical future requirements.
- **Comments explain *why*, not *what.*** Well-named identifiers should make the "what" obvious.
  Only comment on a non-obvious constraint, invariant, or workaround.
- **Missing config is never "safe" by default** — this matters especially in
  `src/utils/securityAnalysis.ts` and `src/panic/collectIssues.ts`, where an absent field must be
  treated as "not configured" and surfaced, not silently assumed fine.
- **Don't introduce new UI or data-fetching libraries** without discussing it first in an issue —
  the stack (PatternFly 6, TanStack Query/Table, ECharts) is deliberate; see
  [doc/architecture.md](doc/architecture.md#key-design-decisions).
- Match existing formatting; there's no separate formatter config (Prettier, etc.) — ESLint is the
  source of truth.

### SOLID principles

Code in this repo is expected to follow SOLID principles. This is a hooks-based functional React
codebase, not a classic OOP one, so apply them practically rather than by the textbook:

- **Single Responsibility** — a page component's job is layout and wiring, not business logic.
  Non-trivial analysis/scoring/parsing logic belongs in a pure module under `src/utils/` (or
  `src/graph/`, `src/panic/`), independently testable and free of React imports. See
  `src/utils/securityAnalysis.ts` (rule engine) vs. `src/pages/SecurityAnalyzer.tsx` (rendering) for
  the pattern.
- **Open/Closed** — prefer a lookup table/map over a growing `if (kind === 'X') ... else if
  (kind === 'Y')` chain when the same kind-dispatch shows up more than once (e.g. `NAV_ICONS`,
  the `RULES` catalogue in `securityAnalysis.ts`). Adding a new case should mean adding a new entry,
  not editing existing branches.
- **Liskov Substitution** — every `useXResources` hook in `useK8sResources.ts` must return the same
  shape (`UseQueryResult<T[]>`, errors surfaced via `.error`, never thrown past the hook). A caller
  swapping one resource hook for another shouldn't have to special-case it.
- **Interface Segregation** — pass components/functions only the fields they use. Don't force a
  caller to construct an unrelated object just to satisfy a prop type; split large prop objects if
  a component only reads a couple of fields from them.
- **Dependency Inversion** — UI code talks to the cluster through `src/api/client.ts` +
  `src/hooks/useK8sResources.ts`, never `fetch()` or `@kubernetes/client-node` directly from a page
  or component. This is what makes the Cluster Connection page's custom API base URL and the
  multi-cluster context switch (`X-Kube-Context`) work transparently everywhere.

If you spot an existing violation, raise it in your PR description rather than fixing it inline
unless it's directly in the code you're already touching — see "keep PRs focused" below.

## Before opening a PR

Run the full local validation suite — the same checks CI runs:

```bash
npm run lint        # ESLint — must be zero errors (pre-existing warnings are OK to leave)
npm run build       # tsc -b (type-check) + vite build — must succeed
npm test            # vitest run — must pass
```

Or `make lint && make typecheck && make test && make build`.

For UI changes, actually exercise the feature against a real (or local) cluster before opening the
PR — type-checking and tests verify correctness, not that a feature works end-to-end in the
browser.

### PR checklist

- [ ] `npm run lint`, `npm run build`, and `npm test` all pass locally.
- [ ] New logic (especially in `src/utils/`, `src/graph/`, `src/panic/`) has test coverage.
- [ ] Docs updated if you added a page, changed a documented command, or changed behavior described
  in `README.md` / `doc/*.md`.
- [ ] PR description explains *why*, not just what changed, and how you tested it.

Keep PRs focused — a bug fix doesn't need accompanying refactors, and a new feature doesn't need to
also "clean up" unrelated code. Split unrelated changes into separate PRs.

## Commit messages

Write imperative, present-tense messages that explain the reason for the change, not a restatement
of the diff (e.g. `Fix dependency graph missing second broken edge to a target` rather than
`Update buildResourceGraph.ts`).

## License

By contributing, you agree that your contributions will be licensed under the project's
[Apache License 2.0](LICENSE).
