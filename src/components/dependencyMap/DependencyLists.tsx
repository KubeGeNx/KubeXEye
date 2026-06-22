import React from 'react';
import { Card, CardTitle, CardBody, List, ListItem, Button, Label } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import type { GraphEdge, ResourceRef } from '../../graph/types';

interface DependencyListsProps {
  forward: GraphEdge[];
  reverse: GraphEdge[];
  onNavigate: (ref: ResourceRef) => void;
}

export const DependencyLists: React.FC<DependencyListsProps> = ({ forward, reverse, onNavigate }) => (
  <>
    <Card style={{ marginBottom: '1rem' }}>
      <CardTitle>Forward dependencies (what it uses)</CardTitle>
      <CardBody>
        {forward.length === 0 ? (
          <em>None detected.</em>
        ) : (
          <List isPlain>
            {forward.map((e, i) => (
              <ListItem key={i}>
                <Button variant="link" isInline onClick={() => onNavigate(e.to)} style={{ color: e.broken ? '#E25A5A' : undefined }}>
                  {e.to.kind}/{e.to.name}
                </Button>{' '}
                <small>({e.relation})</small>
                {e.broken && (
                  <Label color="red" isCompact icon={<ExclamationCircleIcon />} style={{ marginLeft: 6 }}>
                    Missing
                  </Label>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </CardBody>
    </Card>

    <Card>
      <CardTitle>Reverse dependencies (what depends on it)</CardTitle>
      <CardBody>
        {reverse.length === 0 ? (
          <em>Nothing references this resource.</em>
        ) : (
          <List isPlain>
            {reverse.map((e, i) => (
              <ListItem key={i}>
                <Button variant="link" isInline onClick={() => onNavigate(e.from)}>
                  {e.from.kind}/{e.from.name}
                </Button>{' '}
                <small>({e.relation})</small>
              </ListItem>
            ))}
          </List>
        )}
      </CardBody>
    </Card>
  </>
);
