import React from 'react';
import { Button } from '@patternfly/react-core';
import { useDefinitionViewer } from '../context/DefinitionViewerContext';

interface ResourceDefinitionButtonProps {
  resource: unknown;
  title: string;
  /** Button label; defaults to "YAML". */
  label?: string;
  /** Shown as an inline warning inside the modal, e.g. for content that may carry sensitive data
   * or for resources missing commonly-expected fields. */
  warning?: string;
}

export const ResourceDefinitionButton: React.FC<ResourceDefinitionButtonProps> = ({
  resource,
  title,
  label = 'YAML',
  warning,
}) => {
  const { openDefinition } = useDefinitionViewer();

  return (
    <Button variant="link" isInline onClick={() => openDefinition({ resource, title, warning })}>
      {label}
    </Button>
  );
};
