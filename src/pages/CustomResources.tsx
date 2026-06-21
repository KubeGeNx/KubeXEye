import React, { useMemo, useState } from 'react';
import {
  PageSection,
  Select,
  SelectOption,
  SelectList,
  SelectGroup,
  Divider,
  MenuToggle,
  type MenuToggleElement,
  Bullseye,
  Spinner,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ResourceTable } from '../components/table/ResourceTable';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';
import { useCustomResourceDefinitions, useCustomResources } from '../hooks/useK8sResources';
import { useNamespace } from '../context/NamespaceContext';
import type { CustomResource, K8sCustomResourceDefinition } from '../types/k8s';

interface Row {
  name: string;
  namespace: string;
  created: string;
  raw: CustomResource;
}

const columnHelper = createColumnHelper<Row>();

export const CustomResources: React.FC = () => {
  const { namespace } = useNamespace();
  const crds = useCustomResourceDefinitions();
  const [selectedUid, setSelectedUid] = useState<string | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const selectedCrd = useMemo(
    () => crds.data?.find((c) => c.metadata.uid === selectedUid),
    [crds.data, selectedUid],
  );

  const instances = useCustomResources(selectedCrd, namespace);

  const groupedByApiGroup = useMemo(() => {
    const groups = new Map<string, K8sCustomResourceDefinition[]>();
    for (const crd of crds.data ?? []) {
      const list = groups.get(crd.spec.group) ?? [];
      list.push(crd);
      groups.set(crd.spec.group, list);
    }
    return Array.from(groups.entries());
  }, [crds.data]);

  const rows = useMemo<Row[]>(
    () =>
      (instances.data ?? []).map((cr) => ({
        name: cr.metadata.name,
        namespace: cr.metadata.namespace ?? '—',
        created: cr.metadata.creationTimestamp ?? '—',
        raw: cr,
      })),
    [instances.data],
  );

  const columns: ColumnDef<Row, any>[] = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('namespace', { header: 'Namespace' }),
    columnHelper.accessor('created', { header: 'Created' }),
    columnHelper.display({
      id: 'definition',
      header: 'Definition',
      cell: (c) => (
        <ResourceDefinitionButton
          resource={c.row.original.raw}
          title={`${selectedCrd?.spec.names.kind ?? 'Resource'}/${c.row.original.namespace}/${c.row.original.name}`}
        />
      ),
    }),
  ];

  if (crds.isLoading) {
    return (
      <Bullseye>
        <Spinner size="lg" aria-label="Loading CRDs" />
      </Bullseye>
    );
  }

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.customResources}>Custom Resources</PageTitle>

      {(crds.data?.length ?? 0) === 0 ? (
        <EmptyState>
          <EmptyStateBody>No CustomResourceDefinitions found in this cluster.</EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          <Select
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            selected={selectedUid}
            onSelect={(_e, value) => {
              setSelectedUid(String(value));
              setIsOpen(false);
            }}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle ref={toggleRef} onClick={() => setIsOpen((o) => !o)} isExpanded={isOpen} style={{ minWidth: 320 }}>
                {selectedCrd ? selectedCrd.spec.names.kind : 'Select a custom resource type...'}
              </MenuToggle>
            )}
          >
            {groupedByApiGroup.map(([group, items], i) => (
              <React.Fragment key={group}>
                {i > 0 && <Divider />}
                <SelectGroup label={group} key={group}>
                  <SelectList>
                    {items.map((crd) => (
                      <SelectOption key={crd.metadata.uid} value={crd.metadata.uid}>
                        {crd.spec.names.kind} ({crd.spec.scope})
                      </SelectOption>
                    ))}
                  </SelectList>
                </SelectGroup>
              </React.Fragment>
            ))}
          </Select>

          <div style={{ marginTop: '1rem' }}>
            {selectedCrd ? (
              <ResourceTable
                data={rows}
                columns={columns}
                isLoading={instances.isLoading}
                error={instances.error as Error | null}
                searchPlaceholder="Find by name..."
                emptyMessage={`No ${selectedCrd.spec.names.kind} resources found.`}
                getRowId={(row) => `${row.namespace}/${row.name}`}
              />
            ) : (
              <EmptyState>
                <EmptyStateBody>Choose a custom resource type above to browse its instances.</EmptyStateBody>
              </EmptyState>
            )}
          </div>
        </>
      )}
    </PageSection>
  );
};
