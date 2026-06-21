import React, { useState } from 'react';
import { Select, SelectOption, SelectList, MenuToggle, type MenuToggleElement } from '@patternfly/react-core';
import { useNamespace, ALL_NAMESPACES } from '../../context/NamespaceContext';
import { useNamespaces } from '../../hooks/useK8sResources';

export const NamespaceSelector: React.FC = () => {
  const { namespace, setNamespace } = useNamespace();
  const { data: namespaces } = useNamespaces();
  const [isOpen, setIsOpen] = useState(false);

  const selected = namespace === ALL_NAMESPACES ? 'All Namespaces' : namespace;

  return (
    <Select
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      selected={namespace}
      onSelect={(_e, value) => {
        setNamespace(String(value));
        setIsOpen(false);
      }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle ref={toggleRef} onClick={() => setIsOpen((open) => !open)} isExpanded={isOpen}>
          {selected}
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value={ALL_NAMESPACES}>All Namespaces</SelectOption>
        {(namespaces ?? []).map((ns) => (
          <SelectOption key={ns.metadata.name} value={ns.metadata.name}>
            {ns.metadata.name}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
