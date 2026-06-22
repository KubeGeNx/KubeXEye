import React from 'react';
import { Button } from '@patternfly/react-core';
import { usePodDetail } from '../context/PodDetailContext';
import type { K8sPod } from '../types/k8s';

interface PodDetailButtonProps {
  pod: K8sPod;
  /** Button label; defaults to "Details". */
  label?: string;
  /** Shown as an inline warning inside the modal, e.g. for pods missing resource requests/limits. */
  warning?: string;
}

/** Opens the global pod detail view (Definition + Logs tabs) — see PodDetailContext. */
export const PodDetailButton: React.FC<PodDetailButtonProps> = ({ pod, label = 'Details', warning }) => {
  const { openPodDetail } = usePodDetail();
  return (
    <Button variant="link" isInline onClick={() => openPodDetail(pod, warning)}>
      {label}
    </Button>
  );
};
