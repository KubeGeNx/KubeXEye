import React from 'react';
import { Title } from '@patternfly/react-core';
import { K8S_BLUE, type NavIcon } from './layout/navIcons';

interface PageTitleProps {
  icon: NavIcon;
  children: React.ReactNode;
}

export const PageTitle: React.FC<PageTitleProps> = ({ icon: Icon, children }) => (
  <Title headingLevel="h1" style={{ marginBottom: '1rem' }}>
    <Icon style={{ color: K8S_BLUE, marginRight: 10, verticalAlign: 'middle' }} />
    {children}
  </Title>
);
