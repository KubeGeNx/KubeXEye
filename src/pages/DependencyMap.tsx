import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PageSection,
  Card,
  CardTitle,
  CardBody,
  Grid,
  GridItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  type MenuToggleElement,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  List,
  ListItem,
  Bullseye,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Split,
  SplitItem,
  ToggleGroup,
  ToggleGroupItem,
  Alert,
  Label,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useNamespaces, useClusterTopology } from '../hooks/useK8sResources';
import { buildResourceGraph } from '../graph/buildResourceGraph';
import { getForwardDependencies, getReverseDependencies, getNeighborhood } from '../graph/neighborhood';
import { refId, type ResourceKind, type ResourceRef } from '../graph/types';
import { StatusLabel } from '../components/StatusLabel';
import { DependencyGraphChart } from '../components/charts/DependencyGraphChart';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';

const KIND_OPTIONS: ResourceKind[] = [
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Service',
  'Ingress',
  'ConfigMap',
  'Secret',
  'ServiceAccount',
  'PersistentVolumeClaim',
  'StorageClass',
];

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

  const [kindOpen, setKindOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nsOpen, setNsOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<ResourceKind>(centerRef?.kind ?? 'Pod');

  const topology = useClusterTopology(namespace || '__none__');
  const graph = useMemo(() => buildResourceGraph(topology), [topology]);

  const namesForKind = useMemo(() => {
    switch (pickerKind) {
      case 'Pod':
        return topology.pods.map((r) => r.metadata.name);
      case 'Deployment':
        return topology.deployments.map((r) => r.metadata.name);
      case 'StatefulSet':
        return topology.statefulSets.map((r) => r.metadata.name);
      case 'DaemonSet':
        return topology.daemonSets.map((r) => r.metadata.name);
      case 'Service':
        return topology.services.map((r) => r.metadata.name);
      case 'Ingress':
        return topology.ingresses.map((r) => r.metadata.name);
      case 'ConfigMap':
        return topology.configMaps.map((r) => r.metadata.name);
      case 'Secret':
        return topology.secrets.map((r) => r.metadata.name);
      case 'ServiceAccount':
        return topology.serviceAccounts.map((r) => r.metadata.name);
      case 'PersistentVolumeClaim':
        return topology.pvcs.map((r) => r.metadata.name);
      case 'StorageClass':
        return topology.storageClasses.map((r) => r.metadata.name);
      default:
        return [];
    }
  }, [pickerKind, topology]);

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
              <Select
                isOpen={nsOpen}
                onOpenChange={setNsOpen}
                selected={namespace}
                onSelect={(_e, v) => {
                  // Switching namespace invalidates whatever was centered before — reset to a clean slate
                  // rather than leaving a stale breadcrumb trail pointing at the old namespace's resources.
                  setNamespaceOverride(String(v));
                  setHistory([]);
                  setCenterRef(undefined);
                  setSearchParams({});
                  setNsOpen(false);
                }}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setNsOpen((o) => !o)} isExpanded={nsOpen}>
                    {namespace || 'Select namespace'}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {(namespaces.data ?? []).map((ns) => (
                    <SelectOption key={ns.metadata.name} value={ns.metadata.name}>
                      {ns.metadata.name}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </SplitItem>
            <SplitItem>
              <Select
                isOpen={kindOpen}
                onOpenChange={setKindOpen}
                selected={pickerKind}
                onSelect={(_e, v) => {
                  setPickerKind(v as ResourceKind);
                  setKindOpen(false);
                }}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setKindOpen((o) => !o)} isExpanded={kindOpen}>
                    {pickerKind}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {KIND_OPTIONS.map((k) => (
                    <SelectOption key={k} value={k}>
                      {k}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </SplitItem>
            <SplitItem isFilled>
              <Select
                isOpen={nameOpen}
                onOpenChange={setNameOpen}
                selected={undefined}
                onSelect={(_e, v) => {
                  selectNewRoot({
                    kind: pickerKind,
                    name: String(v),
                    namespace: pickerKind === 'StorageClass' ? undefined : namespace,
                  });
                  setNameOpen(false);
                }}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setNameOpen((o) => !o)} isExpanded={nameOpen} style={{ minWidth: 240 }}>
                    Browse {pickerKind} instances...
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {namesForKind.length === 0 ? (
                    <SelectOption isDisabled value="">
                      No {pickerKind} resources in this namespace
                    </SelectOption>
                  ) : (
                    namesForKind.map((n) => (
                      <SelectOption key={n} value={n}>
                        {n}
                      </SelectOption>
                    ))
                  )}
                </SelectList>
              </Select>
            </SplitItem>
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
              <Card>
                <CardTitle>
                  <Split hasGutter>
                    <SplitItem isFilled>Graph</SplitItem>
                    <SplitItem>
                      <ToggleGroup aria-label="Expand hops">
                        {[1, 2, 3].map((h) => (
                          <ToggleGroupItem key={h} text={`${h} hop${h > 1 ? 's' : ''}`} isSelected={hops === h} onChange={() => setHops(h)} />
                        ))}
                      </ToggleGroup>
                    </SplitItem>
                  </Split>
                </CardTitle>
                <CardBody>
                  {neighborhood && centerRef && (
                    <DependencyGraphChart
                      nodes={neighborhood.nodes}
                      edges={neighborhood.edges}
                      centerRef={centerRef}
                      onNodeClick={(ref) => goTo(ref, true)}
                    />
                  )}
                </CardBody>
              </Card>
            </GridItem>

            <GridItem span={4}>
              <Card style={{ marginBottom: '1rem' }}>
                <CardTitle>Forward dependencies (what it uses)</CardTitle>
                <CardBody>
                  {forward.length === 0 ? (
                    <em>None detected.</em>
                  ) : (
                    <List isPlain>
                      {forward.map((e, i) => (
                        <ListItem key={i}>
                          <Button variant="link" isInline onClick={() => goTo(e.to, true)} style={{ color: e.broken ? '#c9190b' : undefined }}>
                            {e.to.kind}/{e.to.name}
                          </Button>{' '}
                          <small>({e.relation})</small>
                          {e.broken && (
                            <Label color="red" isCompact icon={<ExclamationCircleIcon />} style={{ marginLeft: 6 }}>
                              Missing
                            </Label>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardTitle>Reverse dependencies (what depends on it)</CardTitle>
                <CardBody>
                  {reverse.length === 0 ? (
                    <em>Nothing references this resource.</em>
                  ) : (
                    <List isPlain>
                      {reverse.map((e, i) => (
                        <ListItem key={i}>
                          <Button variant="link" isInline onClick={() => goTo(e.from, true)}>
                            {e.from.kind}/{e.from.name}
                          </Button>{' '}
                          <small>({e.relation})</small>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </>
      )}
    </PageSection>
  );
};
