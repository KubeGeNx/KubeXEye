import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PageSection,
  Card,
  CardBody,
  Grid,
  GridItem,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  Bullseye,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Split,
  SplitItem,
  Alert,
} from '@patternfly/react-core';
import { useNamespaces, useClusterTopology } from '../hooks/useK8sResources';
import { buildResourceGraph } from '../graph/buildResourceGraph';
import { getForwardDependencies, getReverseDependencies, getNeighborhood } from '../graph/neighborhood';
import { refId, type ResourceKind, type ResourceRef } from '../graph/types';
import { StatusLabel } from '../components/StatusLabel';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { NamespaceSelect } from '../components/dependencyMap/NamespaceSelect';
import { ResourcePicker } from '../components/dependencyMap/ResourcePicker';
import { DependencyGraphPanel } from '../components/dependencyMap/DependencyGraphPanel';
import { DependencyLists } from '../components/dependencyMap/DependencyLists';

export const DependencyMap: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const namespaces = useNamespaces();

  const [namespaceOverride, setNamespaceOverride] = useState<string | undefined>(searchParams.get('namespace') ?? undefined);
  const namespace = namespaceOverride ?? namespaces.data?.[0]?.metadata.name ?? '';
  const [hops, setHops] = useState(1);
  const [history, setHistory] = useState<ResourceRef[]>([]);
  const [centerRef, setCenterRef] = useState<ResourceRef | undefined>(() => {
    const kind = searchParams.get('kind') as ResourceKind | null;
    const name = searchParams.get('name');
    const ns = searchParams.get('namespace');
    if (kind && name) return { kind, name, namespace: ns ?? undefined };
    return undefined;
  });

  const [pickerKind, setPickerKind] = useState<ResourceKind>(centerRef?.kind ?? 'Pod');

  const topology = useClusterTopology(namespace || '__none__');
  const graph = useMemo(() => buildResourceGraph(topology), [topology]);

  function goTo(ref: ResourceRef, pushHistory: boolean) {
    if (pushHistory && centerRef) setHistory((h) => [...h, centerRef]);
    // Keep the fetched topology scoped to wherever we're actually centered, so the graph/forward/reverse
    // lists never go stale relative to the breadcrumb (e.g. clicking into a different namespace's resource).
    if (ref.namespace && ref.namespace !== namespace) setNamespaceOverride(ref.namespace);
    setCenterRef(ref);
    setSearchParams({
      kind: ref.kind,
      name: ref.name,
      ...(ref.namespace ? { namespace: ref.namespace } : {}),
    });
  }

  /** Used when the user explicitly picks a new starting point from the controls above — unlike goTo,
   * this clears the breadcrumb trail instead of appending to it, since it's a fresh lookup, not a hop. */
  function selectNewRoot(ref: ResourceRef) {
    setHistory([]);
    goTo(ref, false);
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCenterRef(prev);
    setSearchParams({ kind: prev.kind, name: prev.name, ...(prev.namespace ? { namespace: prev.namespace } : {}) });
  }

  const forward = useMemo(() => {
    const deps = centerRef ? getForwardDependencies(graph, centerRef) : [];
    // Surface missing references first — they're the most actionable thing to notice here.
    return [...deps].sort((a, b) => Number(b.broken) - Number(a.broken));
  }, [graph, centerRef]);
  const reverse = centerRef ? getReverseDependencies(graph, centerRef) : [];
  const neighborhood = centerRef ? getNeighborhood(graph, centerRef, hops) : null;
  const centerNode = centerRef ? graph.nodes.get(refId(centerRef)) : undefined;
  const brokenCount = forward.filter((e) => e.broken).length;

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.dependencyMap}>Dependency Map</PageTitle>

      <Card style={{ marginBottom: '1rem' }}>
        <CardBody>
          <Split hasGutter>
            <SplitItem>
              <NamespaceSelect
                namespaces={namespaces.data ?? []}
                selected={namespace}
                onSelect={(ns) => {
                  // Switching namespace invalidates whatever was centered before — reset to a clean slate
                  // rather than leaving a stale breadcrumb trail pointing at the old namespace's resources.
                  setNamespaceOverride(ns);
                  setHistory([]);
                  setCenterRef(undefined);
                  setSearchParams({});
                }}
              />
            </SplitItem>
            <ResourcePicker topology={topology} namespace={namespace} kind={pickerKind} onKindChange={setPickerKind} onPick={selectNewRoot} />
          </Split>
        </CardBody>
      </Card>

      {topology.isLoading ? (
        <Bullseye>
          <Spinner size="lg" aria-label="Loading topology" />
        </Bullseye>
      ) : !centerRef ? (
        <EmptyState>
          <EmptyStateBody>Pick a resource above to view its dependency map.</EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          <Breadcrumb style={{ marginBottom: '0.5rem' }}>
            {history.map((h, i) => (
              <BreadcrumbItem key={`${refId(h)}-${i}`}>
                <Button variant="link" isInline onClick={() => goTo(h, false)}>
                  {h.kind}/{h.name}
                </Button>
              </BreadcrumbItem>
            ))}
            <BreadcrumbItem isActive>
              {centerRef.kind}/{centerRef.name}
              {centerNode && (
                <span style={{ marginLeft: 8 }}>
                  <StatusLabel status={centerNode.status} />
                </span>
              )}
            </BreadcrumbItem>
          </Breadcrumb>

          {history.length > 0 && (
            <Button variant="secondary" size="sm" onClick={goBack} style={{ marginBottom: '0.5rem' }}>
              Back
            </Button>
          )}

          {brokenCount > 0 && (
            <Alert
              variant="danger"
              isInline
              title={`${brokenCount} reference${brokenCount > 1 ? 's' : ''} to a resource not defined in the cluster`}
              style={{ marginBottom: '1rem' }}
            >
              {centerRef.kind}/{centerRef.name} points at {brokenCount > 1 ? 'objects' : 'an object'} that don't exist — see the
              red entries in "Forward dependencies" below.
            </Alert>
          )}

          <Grid hasGutter>
            <GridItem span={8}>
              <DependencyGraphPanel
                neighborhood={neighborhood}
                centerRef={centerRef}
                hops={hops}
                onHopsChange={setHops}
                onNodeClick={(ref) => goTo(ref, true)}
              />
            </GridItem>

            <GridItem span={4}>
              <DependencyLists forward={forward} reverse={reverse} onNavigate={(ref) => goTo(ref, true)} />
            </GridItem>
          </Grid>
        </>
      )}
    </PageSection>
  );
};
