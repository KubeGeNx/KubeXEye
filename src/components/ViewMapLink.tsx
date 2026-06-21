import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@patternfly/react-core';
import type { ResourceKind } from '../graph/types';

interface ViewMapLinkProps {
  kind: ResourceKind;
  name: string;
  namespace?: string;
}

export const ViewMapLink: React.FC<ViewMapLinkProps> = ({ kind, name, namespace }) => {
  const params = new URLSearchParams({ kind, name, ...(namespace ? { namespace } : {}) });
  return (
    <Button variant="link" isInline component={(props) => <Link {...props} to={`/dependency-map?${params.toString()}`} />}>
      Map
    </Button>
  );
};
