import React from 'react';
import { Card, CardTitle, CardBody, Split, SplitItem, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import type { Neighborhood } from '../../graph/neighborhood';
import type { ResourceRef } from '../../graph/types';
import { DependencyGraphChart } from '../charts/DependencyGraphChart';

const HOP_OPTIONS = [1, 2, 3];

interface DependencyGraphPanelProps {
  neighborhood: Neighborhood | null;
  centerRef: ResourceRef;
  hops: number;
  onHopsChange: (hops: number) => void;
  onNodeClick: (ref: ResourceRef) => void;
}

export const DependencyGraphPanel: React.FC<DependencyGraphPanelProps> = ({ neighborhood, centerRef, hops, onHopsChange, onNodeClick }) => (
  <Card>
    <CardTitle>
      <Split hasGutter>
        <SplitItem isFilled>Graph</SplitItem>
        <SplitItem>
          <ToggleGroup aria-label="Expand hops">
            {HOP_OPTIONS.map((h) => (
              <ToggleGroupItem key={h} text={`${h} hop${h > 1 ? 's' : ''}`} isSelected={hops === h} onChange={() => onHopsChange(h)} />
            ))}
          </ToggleGroup>
        </SplitItem>
      </Split>
    </CardTitle>
    <CardBody>
      {neighborhood && (
        <DependencyGraphChart nodes={neighborhood.nodes} edges={neighborhood.edges} centerRef={centerRef} onNodeClick={onNodeClick} />
      )}
    </CardBody>
  </Card>
);
