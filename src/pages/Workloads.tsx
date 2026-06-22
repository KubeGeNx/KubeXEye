import React, { useState } from 'react';
import { PageSection, Tabs, Tab, TabTitleText, Tooltip } from '@patternfly/react-core';
import { createColumnHelper } from '@tanstack/react-table';
import { WorkloadTable, type WorkloadRow } from '../components/table/WorkloadTable';
import { StatusLabel } from '../components/StatusLabel';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useDeployments, useStatefulSets, useDaemonSets } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import { normalizeDeployment, normalizeStatefulSet, normalizeDaemonSet } from '../graph/normalize';
import type { HealthStatus } from '../graph/types';
import type { K8sDeployment, K8sStatefulSet, K8sDaemonSet } from '../types/k8s';

interface DeploymentRow extends WorkloadRow<K8sDeployment> {
  status: HealthStatus;
  statusReason?: string;
  ready: string;
  upToDate: number;
  available: number;
}

interface StatefulSetRow extends WorkloadRow<K8sStatefulSet> {
  status: HealthStatus;
  statusReason?: string;
  ready: string;
  updated: number;
}

interface DaemonSetRow extends WorkloadRow<K8sDaemonSet> {
  status: HealthStatus;
  statusReason?: string;
  desired: number;
  ready: number;
  available: number;
}

const deploymentColumns = createColumnHelper<DeploymentRow>();
const statefulSetColumns = createColumnHelper<StatefulSetRow>();
const daemonSetColumns = createColumnHelper<DaemonSetRow>();

function StatusCell({ status, reason }: { status: HealthStatus; reason?: string }) {
  const label = <StatusLabel status={status} />;
  return reason ? <Tooltip content={reason}><span>{label}</span></Tooltip> : label;
}

function DeploymentsTable() {
  const { namespace } = useNamespace();
  return (
    <WorkloadTable
      query={useDeployments(namespace)}
      kind="Deployment"
      toRow={(d: K8sDeployment): DeploymentRow => {
        const { status, statusReason } = normalizeDeployment(d);
        return {
          name: d.metadata.name,
          namespace: d.metadata.namespace ?? '',
          status,
          statusReason,
          ready: `${d.status?.readyReplicas ?? 0}/${d.spec?.replicas ?? 0}`,
          upToDate: d.status?.updatedReplicas ?? 0,
          available: d.status?.availableReplicas ?? 0,
          raw: d,
        };
      }}
      extraColumns={[
        deploymentColumns.accessor('status', {
          header: 'Status',
          cell: (c) => <StatusCell status={c.getValue()} reason={c.row.original.statusReason} />,
        }),
        deploymentColumns.accessor('ready', { header: 'Ready' }),
        deploymentColumns.accessor('upToDate', { header: 'Up-to-date' }),
        deploymentColumns.accessor('available', { header: 'Available' }),
      ]}
    />
  );
}

function StatefulSetsTable() {
  const { namespace } = useNamespace();
  return (
    <WorkloadTable
      query={useStatefulSets(namespace)}
      kind="StatefulSet"
      toRow={(s: K8sStatefulSet): StatefulSetRow => {
        const { status, statusReason } = normalizeStatefulSet(s);
        return {
          name: s.metadata.name,
          namespace: s.metadata.namespace ?? '',
          status,
          statusReason,
          ready: `${s.status?.readyReplicas ?? 0}/${s.spec?.replicas ?? 0}`,
          updated: s.status?.updatedReplicas ?? 0,
          raw: s,
        };
      }}
      extraColumns={[
        statefulSetColumns.accessor('status', {
          header: 'Status',
          cell: (c) => <StatusCell status={c.getValue()} reason={c.row.original.statusReason} />,
        }),
        statefulSetColumns.accessor('ready', { header: 'Ready' }),
        statefulSetColumns.accessor('updated', { header: 'Updated' }),
      ]}
    />
  );
}

function DaemonSetsTable() {
  const { namespace } = useNamespace();
  return (
    <WorkloadTable
      query={useDaemonSets(namespace)}
      kind="DaemonSet"
      toRow={(d: K8sDaemonSet): DaemonSetRow => {
        const { status, statusReason } = normalizeDaemonSet(d);
        return {
          name: d.metadata.name,
          namespace: d.metadata.namespace ?? '',
          status,
          statusReason,
          desired: d.status?.desiredNumberScheduled ?? 0,
          ready: d.status?.numberReady ?? 0,
          available: d.status?.numberAvailable ?? 0,
          raw: d,
        };
      }}
      extraColumns={[
        daemonSetColumns.accessor('status', {
          header: 'Status',
          cell: (c) => <StatusCell status={c.getValue()} reason={c.row.original.statusReason} />,
        }),
        daemonSetColumns.accessor('desired', { header: 'Desired' }),
        daemonSetColumns.accessor('ready', { header: 'Ready' }),
        daemonSetColumns.accessor('available', { header: 'Available' }),
      ]}
    />
  );
}

export const Workloads: React.FC = () => {
  const [activeKey, setActiveKey] = useState<string | number>(0);

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.workloads}>Workloads</PageTitle>
      <Tabs activeKey={activeKey} onSelect={(_e, key) => setActiveKey(key)}>
        <Tab eventKey={0} title={<TabTitleText>Deployments</TabTitleText>}>
          <DeploymentsTable />
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>StatefulSets</TabTitleText>}>
          <StatefulSetsTable />
        </Tab>
        <Tab eventKey={2} title={<TabTitleText>DaemonSets</TabTitleText>}>
          <DaemonSetsTable />
        </Tab>
      </Tabs>
    </PageSection>
  );
};
