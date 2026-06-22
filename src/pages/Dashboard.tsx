import React, { useMemo } from 'react';
import {
  PageSection,
  Title,
  Grid,
  GridItem,
  Card,
  CardTitle,
  CardBody,
  Alert,
} from '@patternfly/react-core';
import { useNodes, usePods, useNamespaces, useDeployments, useNodeMetrics } from '../hooks/useK8sResources';
import { ALL_NAMESPACES } from '../context/NamespaceContext';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { UsageGaugeChart } from '../components/charts/UsageGaugeChart';
import { DistributionPieChart } from '../components/charts/DistributionPieChart';
import { TopUsageBarChart } from '../components/charts/TopUsageBarChart';
import { cpuToCores, memoryToBytes, formatBytes, formatCores, percent } from '../utils/resourceUnits';

const SummaryCard: React.FC<{ title: string; value: number | string }> = ({ title, value }) => (
  <Card>
    <CardTitle>{title}</CardTitle>
    <CardBody>
      <Title headingLevel="h2" size="2xl">
        {value}
      </Title>
    </CardBody>
  </Card>
);

export const Dashboard: React.FC = () => {
  const nodes = useNodes();
  const pods = usePods(ALL_NAMESPACES);
  const namespaces = useNamespaces();
  const deployments = useDeployments(ALL_NAMESPACES);
  const nodeMetrics = useNodeMetrics();

  const capacity = useMemo(() => {
    let cpu = 0;
    let memory = 0;
    for (const node of nodes.data ?? []) {
      cpu += cpuToCores(node.status?.allocatable?.cpu);
      memory += memoryToBytes(node.status?.allocatable?.memory);
    }
    return { cpu, memory };
  }, [nodes.data]);

  const usage = useMemo(() => {
    let cpu = 0;
    let memory = 0;
    for (const m of nodeMetrics.data ?? []) {
      cpu += cpuToCores(m.usage.cpu);
      memory += memoryToBytes(m.usage.memory);
    }
    return { cpu, memory };
  }, [nodeMetrics.data]);

  const podPhases = useMemo(() => {
    const PHASE_COLOR: Record<string, string> = {
      Running: '#3ABE82',
      Succeeded: '#C8C5BB',
      Pending: '#7EB6F0',
      Failed: '#E25A5A',
      Terminating: '#F0A028',
      Unknown: '#7B7970',
    };
    const counts: Record<string, number> = {};
    for (const pod of pods.data ?? []) {
      const phase = pod.status?.phase ?? 'Unknown';
      counts[phase] = (counts[phase] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: PHASE_COLOR[name] }));
  }, [pods.data]);

  const topNodesByCpu = useMemo(() => {
    const sorted = [...(nodeMetrics.data ?? [])]
      .sort((a, b) => cpuToCores(b.usage.cpu) - cpuToCores(a.usage.cpu))
      .slice(0, 8);
    return {
      categories: sorted.map((m) => m.metadata.name),
      values: sorted.map((m) => cpuToCores(m.usage.cpu)),
    };
  }, [nodeMetrics.data]);

  const metricsUnavailable = !nodeMetrics.isLoading && (nodeMetrics.data?.length ?? 0) === 0;

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.dashboard}>Cluster Overview</PageTitle>

      <Grid hasGutter style={{ marginBottom: '1rem' }}>
        <GridItem span={3}>
          <SummaryCard title="Nodes" value={nodes.data?.length ?? '—'} />
        </GridItem>
        <GridItem span={3}>
          <SummaryCard title="Namespaces" value={namespaces.data?.length ?? '—'} />
        </GridItem>
        <GridItem span={3}>
          <SummaryCard title="Pods" value={pods.data?.length ?? '—'} />
        </GridItem>
        <GridItem span={3}>
          <SummaryCard title="Deployments" value={deployments.data?.length ?? '—'} />
        </GridItem>
      </Grid>

      {metricsUnavailable && (
        <Alert
          variant="info"
          isInline
          title="metrics-server not detected"
          style={{ marginBottom: '1rem' }}
        >
          CPU/Memory usage gauges require the Kubernetes metrics-server to be installed in the cluster.
        </Alert>
      )}

      <Grid hasGutter style={{ marginBottom: '1rem' }}>
        <GridItem span={4}>
          <Card>
            <CardTitle>CPU Usage</CardTitle>
            <CardBody>
              <UsageGaugeChart
                title="CPU"
                percentUsed={percent(usage.cpu, capacity.cpu)}
                detailLabel={`${formatCores(usage.cpu)} / ${formatCores(capacity.cpu)} cores`}
              />
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={4}>
          <Card>
            <CardTitle>Memory Usage</CardTitle>
            <CardBody>
              <UsageGaugeChart
                title="Memory"
                percentUsed={percent(usage.memory, capacity.memory)}
                detailLabel={`${formatBytes(usage.memory)} / ${formatBytes(capacity.memory)}`}
              />
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={4}>
          <Card>
            <CardTitle>Pod Status</CardTitle>
            <CardBody>
              <DistributionPieChart title="Pod Phase" data={podPhases} />
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      {topNodesByCpu.categories.length > 0 && (
        <Card>
          <CardTitle>Top Nodes by CPU Usage</CardTitle>
          <CardBody>
            <TopUsageBarChart
              title=""
              categories={topNodesByCpu.categories}
              values={topNodesByCpu.values}
              valueLabel="cores"
              formatter={(v) => formatCores(v)}
            />
          </CardBody>
        </Card>
      )}
    </PageSection>
  );
};
