import React, { useMemo } from 'react';
import {
  PageSection,
  Title,
  Grid,
  GridItem,
  Card,
  CardTitle,
  CardBody,
  List,
  ListItem,
  EmptyState,
  EmptyStateBody,
  Bullseye,
  Spinner,
} from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { SeverityLabel } from '../components/SeverityLabel';
import { ViewMapLink } from '../components/ViewMapLink';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useNodes, useClusterTopology, useEvents } from '../hooks/useK8sResources';
import { ALL_NAMESPACES } from '../context/NamespaceContext';
import { buildResourceGraph } from '../graph/buildResourceGraph';
import {
  collectDependencyIssues,
  collectNodeIssues,
  collectPodIssues,
  collectStorageIssues,
  collectWorkloadIssues,
} from '../panic/collectIssues';
import { SEVERITY_WEIGHT, type PanicIssue } from '../panic/types';

const columnHelper = createColumnHelper<PanicIssue>();

const SummaryCard: React.FC<{ title: string; value: number; color?: string }> = ({ title, value, color }) => (
  <Card>
    <CardTitle>{title}</CardTitle>
    <CardBody>
      <Title headingLevel="h2" size="2xl" style={color ? { color } : undefined}>
        {value}
      </Title>
    </CardBody>
  </Card>
);

export const PanicPage: React.FC = () => {
  const nodes = useNodes();
  const topology = useClusterTopology(ALL_NAMESPACES);
  const events = useEvents(ALL_NAMESPACES);

  const graph = useMemo(() => buildResourceGraph(topology), [topology]);

  const issues = useMemo(() => {
    const all: PanicIssue[] = [
      ...collectNodeIssues(nodes.data ?? [], topology.pods),
      ...collectPodIssues(topology.pods, graph),
      ...collectWorkloadIssues(topology.deployments, topology.statefulSets, topology.daemonSets, graph),
      ...collectStorageIssues(topology.pvcs, graph),
      ...collectDependencyIssues(graph),
    ];
    return all.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.blastRadius - a.blastRadius);
  }, [nodes.data, topology, graph]);

  const counts = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const issue of issues) c[issue.severity]++;
    return c;
  }, [issues]);

  const recentWarnings = useMemo(
    () =>
      [...(events.data ?? [])]
        .filter((e) => e.type === 'Warning')
        .sort((a, b) => new Date(b.lastTimestamp ?? 0).getTime() - new Date(a.lastTimestamp ?? 0).getTime())
        .slice(0, 8),
    [events.data],
  );

  const columns: ColumnDef<PanicIssue, any>[] = [
    columnHelper.accessor('severity', { header: 'Severity', cell: (c) => <SeverityLabel severity={c.getValue()} /> }),
    columnHelper.accessor('category', { header: 'Category' }),
    columnHelper.accessor('title', { header: 'Issue' }),
    columnHelper.accessor('detail', { header: 'Detail', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.accessor('blastRadius', { header: 'Blast Radius' }),
    columnHelper.display({
      id: 'action',
      header: 'Root Cause',
      cell: (c) => {
        const ref = c.row.original.ref;
        if (!ref) return '—';
        return <ViewMapLink kind={ref.kind} name={ref.name} namespace={ref.namespace} />;
      },
    }),
  ];

  const isLoading = nodes.isLoading || topology.isLoading;

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.panic}>Panic Dashboard</PageTitle>

      <Grid hasGutter style={{ marginBottom: '1rem' }}>
        <GridItem span={3}>
          <SummaryCard title="Critical" value={counts.Critical} color="#c9190b" />
        </GridItem>
        <GridItem span={3}>
          <SummaryCard title="High" value={counts.High} color="#f0ab00" />
        </GridItem>
        <GridItem span={3}>
          <SummaryCard title="Medium" value={counts.Medium} color="#795600" />
        </GridItem>
        <GridItem span={3}>
          <SummaryCard title="Total Issues" value={issues.length} />
        </GridItem>
      </Grid>

      {isLoading ? (
        <Bullseye>
          <Spinner size="lg" aria-label="Scanning cluster" />
        </Bullseye>
      ) : issues.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No active issues detected. Everything looks healthy.</EmptyStateBody>
        </EmptyState>
      ) : (
        <Card style={{ marginBottom: '1rem' }}>
          <CardTitle>Issues (ranked by severity, then blast radius)</CardTitle>
          <CardBody>
            <ResourceTable
              data={issues}
              columns={columns}
              searchPlaceholder="Find by resource or issue text..."
              getRowId={(row) => row.id}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardTitle>Recent warning events (signal, not yet correlated)</CardTitle>
        <CardBody>
          {recentWarnings.length === 0 ? (
            <em>No recent warning events.</em>
          ) : (
            <List isPlain>
              {recentWarnings.map((e) => (
                <ListItem key={e.metadata.uid ?? `${e.metadata.namespace}/${e.metadata.name}`}>
                  <strong>{e.reason}</strong> — {e.involvedObject?.kind}/{e.involvedObject?.name} ({e.involvedObject?.namespace}):{' '}
                  {e.message}
                </ListItem>
              ))}
            </List>
          )}
        </CardBody>
      </Card>
    </PageSection>
  );
};
