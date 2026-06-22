import React, { useMemo } from 'react';
import { PageSection, Label } from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { usePods } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';

interface ImageRow {
  image: string;
  namespace: string;
  podCount: number;
  containerCount: number;
  runningPods: number;
  podNames: string;
}

const columnHelper = createColumnHelper<ImageRow>();

export const Images: React.FC = () => {
  const { namespace } = useNamespace();
  const pods = usePods(namespace);

  const rows = useMemo<ImageRow[]>(() => {
    const byKey = new Map<
      string,
      { image: string; namespace: string; podNames: Set<string>; containerCount: number; runningPods: Set<string> }
    >();

    for (const pod of pods.data ?? []) {
      const ns = pod.metadata.namespace ?? '—';
      const isRunning = pod.status?.phase === 'Running';
      for (const container of pod.spec?.containers ?? []) {
        const key = `${ns}__${container.image}`;
        let entry = byKey.get(key);
        if (!entry) {
          entry = { image: container.image, namespace: ns, podNames: new Set(), containerCount: 0, runningPods: new Set() };
          byKey.set(key, entry);
        }
        entry.podNames.add(pod.metadata.name);
        entry.containerCount += 1;
        if (isRunning) entry.runningPods.add(pod.metadata.name);
      }
    }

    return Array.from(byKey.values()).map((e) => ({
      image: e.image,
      namespace: e.namespace,
      podCount: e.podNames.size,
      containerCount: e.containerCount,
      runningPods: e.runningPods.size,
      podNames: Array.from(e.podNames).join(', '),
    }));
  }, [pods.data]);

  const columns: ColumnDef<ImageRow, any>[] = [
    columnHelper.accessor('image', { header: 'Image', cell: (c) => <span style={{ wordBreak: 'break-all' }}>{c.getValue()}</span> }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('podCount', { header: 'Pods' }),
    columnHelper.accessor('containerCount', { header: 'Containers' }),
    columnHelper.display({
      id: 'running',
      header: 'Running',
      cell: (c) => {
        const { runningPods, podCount } = c.row.original;
        return (
          <Label color={runningPods === podCount ? 'green' : runningPods === 0 ? 'red' : 'orange'}>
            {runningPods}/{podCount} Running
          </Label>
        );
      },
    }),
    columnHelper.accessor('podNames', { header: 'Pod Names', cell: (c) => <span style={{ wordBreak: 'break-word' }}>{c.getValue()}</span> }),
  ];

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.images}>Running Images</PageTitle>
      <ResourceTable
        data={rows}
        columns={columns}
        isLoading={pods.isLoading}
        error={pods.error as Error | null}
        searchPlaceholder="Find by image, namespace, or pod name..."
        emptyMessage="No running images found."
        getRowId={(row) => `${row.namespace}__${row.image}`}
      />
    </PageSection>
  );
};
