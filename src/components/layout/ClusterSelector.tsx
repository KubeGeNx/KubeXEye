import React, { useState } from 'react';
import { Select, SelectOption, SelectList, MenuToggle, type MenuToggleElement } from '@patternfly/react-core';
import { useConnection } from '../../context/ConnectionContext';
import { useNamespace, ALL_NAMESPACES } from '../../context/NamespaceContext';
import { useKubeContexts } from '../../hooks/useK8sResources';

/** Switches which kubeconfig context the kube-proxy targets, by setting `config.context` and
 * letting the X-Kube-Context header (sent from src/api/client.ts) pick the cluster per request.
 * Resets the namespace filter to "all namespaces" on switch so views don't silently show empty
 * results when the previously selected namespace doesn't exist on the new cluster. */
export const ClusterSelector: React.FC = () => {
  const { config, setConfig } = useConnection();
  const { setNamespace } = useNamespace();
  const { data, isLoading, error } = useKubeContexts();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading || error || !data || data.contexts.length <= 1) return null;

  const selected = config.context || data.current;

  return (
    <Select
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      selected={selected}
      onSelect={(_e, value) => {
        setConfig({ ...config, context: String(value) });
        setNamespace(ALL_NAMESPACES);
        setIsOpen(false);
      }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle ref={toggleRef} onClick={() => setIsOpen((open) => !open)} isExpanded={isOpen}>
          {selected}
        </MenuToggle>
      )}
    >
      <SelectList>
        {data.contexts.map((name) => (
          <SelectOption key={name} value={name}>
            {name}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
