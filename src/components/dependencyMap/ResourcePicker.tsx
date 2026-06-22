import React, { useState } from 'react';
import { Select, SelectOption, SelectList, MenuToggle, type MenuToggleElement, SplitItem } from '@patternfly/react-core';
import type { ClusterTopologyInput } from '../../graph/buildResourceGraph';
import type { ResourceKind, ResourceRef } from '../../graph/types';
import { namesForKind } from './resourceNameRegistry';

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
  'Role',
  'RoleBinding',
  'ClusterRole',
  'ClusterRoleBinding',
];

const CLUSTER_SCOPED_KINDS: ResourceKind[] = ['StorageClass', 'ClusterRole', 'ClusterRoleBinding'];

interface ResourcePickerProps {
  topology: ClusterTopologyInput;
  namespace: string;
  kind: ResourceKind;
  onKindChange: (kind: ResourceKind) => void;
  onPick: (ref: ResourceRef) => void;
}

/** Lets the user pick a resource kind, then browse and select one of its instances. */
export const ResourcePicker: React.FC<ResourcePickerProps> = ({ topology, namespace, kind, onKindChange, onPick }) => {
  const [kindOpen, setKindOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const names = namesForKind(kind, topology);

  return (
    <>
      <SplitItem>
        <Select
          isOpen={kindOpen}
          onOpenChange={setKindOpen}
          selected={kind}
          onSelect={(_e, v) => {
            onKindChange(v as ResourceKind);
            setKindOpen(false);
          }}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle ref={toggleRef} onClick={() => setKindOpen((o) => !o)} isExpanded={kindOpen}>
              {kind}
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
            onPick({ kind, name: String(v), namespace: CLUSTER_SCOPED_KINDS.includes(kind) ? undefined : namespace });
            setNameOpen(false);
          }}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle ref={toggleRef} onClick={() => setNameOpen((o) => !o)} isExpanded={nameOpen} style={{ minWidth: 240 }}>
              Browse {kind} instances...
            </MenuToggle>
          )}
        >
          <SelectList>
            {names.length === 0 ? (
              <SelectOption isDisabled value="">
                No {kind} resources in this namespace
              </SelectOption>
            ) : (
              names.map((n) => (
                <SelectOption key={n} value={n}>
                  {n}
                </SelectOption>
              ))
            )}
          </SelectList>
        </Select>
      </SplitItem>
    </>
  );
};
