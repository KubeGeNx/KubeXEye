import React from 'react';
import { Label } from '@patternfly/react-core';

const STATUS_COLOR: Record<string, 'green' | 'red' | 'orange' | 'grey' | 'blue'> = {
  Running: 'green',
  Active: 'green',
  Ready: 'green',
  Healthy: 'green',
  Succeeded: 'blue',
  True: 'green',
  Pending: 'orange',
  Terminating: 'orange',
  Unknown: 'grey',
  Failed: 'red',
  Error: 'red',
  False: 'red',
  Warning: 'orange',
  Normal: 'blue',
  // Helm release statuses
  deployed: 'green',
  failed: 'red',
  superseded: 'grey',
  uninstalled: 'grey',
  uninstalling: 'orange',
  'pending-install': 'orange',
  'pending-upgrade': 'orange',
  'pending-rollback': 'orange',
  unknown: 'grey',
};

export const StatusLabel: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return <Label color="grey">Unknown</Label>;
  return <Label color={STATUS_COLOR[status] ?? 'grey'}>{status}</Label>;
};
