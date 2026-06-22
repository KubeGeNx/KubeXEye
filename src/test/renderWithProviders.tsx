import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NamespaceProvider } from '../context/NamespaceContext';
import { DefinitionViewerProvider } from '../context/DefinitionViewerContext';
import { PodDetailProvider } from '../context/PodDetailContext';

/** Wraps a page/component with every provider a page might reach for (namespace selection,
 * the YAML/JSON definition modal, the pod detail modal) plus a router, so page tests don't each
 * have to assemble this themselves. Pages that don't use one of these just ignore it. */
export function renderWithProviders(ui: React.ReactElement, { route = '/' }: { route?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <NamespaceProvider>
        <DefinitionViewerProvider>
          <PodDetailProvider>{ui}</PodDetailProvider>
        </DefinitionViewerProvider>
      </NamespaceProvider>
    </MemoryRouter>,
  );
}
