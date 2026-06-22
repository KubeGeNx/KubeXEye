import React, { useState } from 'react';
import { Select, SelectOption, SelectList, MenuToggle, type MenuToggleElement } from '@patternfly/react-core';
import type { K8sNamespace } from '../../types/k8s';

interface NamespaceSelectProps {
  namespaces: K8sNamespace[];
  selected: string;
  onSelect: (namespace: string) => void;
}

export const NamespaceSelect: React.FC<NamespaceSelectProps> = ({ namespaces, selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Select
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      selected={selected}
      onSelect={(_e, v) => {
        onSelect(String(v));
        setIsOpen(false);
      }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle ref={toggleRef} onClick={() => setIsOpen((o) => !o)} isExpanded={isOpen}>
          {selected || 'Select namespace'}
        </MenuToggle>
      )}
    >
      <SelectList>
        {namespaces.map((ns) => (
          <SelectOption key={ns.metadata.name} value={ns.metadata.name}>
            {ns.metadata.name}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
