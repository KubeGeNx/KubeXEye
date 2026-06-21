import React from 'react';
import { Label } from '@patternfly/react-core';
import type { IssueSeverity } from '../panic/types';

const SEVERITY_COLOR: Record<IssueSeverity, 'red' | 'orange' | 'yellow' | 'grey'> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'yellow',
  Low: 'grey',
};

export const SeverityLabel: React.FC<{ severity: IssueSeverity }> = ({ severity }) => (
  <Label color={SEVERITY_COLOR[severity]} isCompact>
    {severity}
  </Label>
);
