import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { Button } from '@patternfly/react-core';
import { ResourceTable } from './ResourceTable';
import { ResourceDefinitionButton } from '../ResourceDefinitionButton';
import type { ResourceKind } from '../../graph/types';

export interface WorkloadRow<T> {
  name: string;
  namespace: string;
  raw: T;
}

const columnHelper = createColumnHelper<any>();

interface WorkloadTableProps<T, R extends WorkloadRow<T>> {
  query: UseQueryResult<T[]>;
  kind: ResourceKind;
  toRow: (item: T) => R;
  /** Columns specific to this workload kind, rendered between Namespace and the status columns. */
  extraColumns: ColumnDef<R, any>[];
}

/** Generic resource table for Deployments/StatefulSets/DaemonSets — every workload kind shares the
 * name/namespace columns, differing only in their status columns. */
export function WorkloadTable<T, R extends WorkloadRow<T>>({ query, kind, toRow, extraColumns }: WorkloadTableProps<T, R>) {
  const rows = useMemo(() => (query.data ?? []).map(toRow), [query.data, toRow]);

  const columns: ColumnDef<any, any>[] = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        // The name drills down to this workload's pods on the Pods page, rather than a separate
        // "Pods" column/modal — the Pods page already has the full pod toolset (multi-container
        // logs, metrics, restarts) that a standalone pod-list modal would otherwise duplicate.
        // The YAML link alongside it covers the workload's own definition, now that there's no
        // separate Definition column.
        cell: (c) => {
          const params = new URLSearchParams({ kind, name: c.getValue(), namespace: c.row.original.namespace });
          return (
            <>
              <Button variant="link" isInline component={(props) => <Link {...props} to={`/pods?${params.toString()}`} />}>
                {c.getValue()}
              </Button>{' '}
              <ResourceDefinitionButton
                resource={c.row.original.raw}
                title={`${kind}/${c.row.original.namespace}/${c.row.original.name}`}
              />
            </>
          );
        },
      }),
      columnHelper.accessor('namespace', { header: 'Namespace' }),
      ...extraColumns,
    ],
    [kind, extraColumns],
  );

  return (
    <ResourceTable
      data={rows}
      columns={columns}
      isLoading={query.isLoading}
      error={query.error as Error | null}
      getRowId={(r) => `${r.namespace}/${r.name}`}
    />
  );
}
