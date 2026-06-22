import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { CustomResources } from './CustomResources';
import { useCustomResourceDefinitions, useCustomResources } from '../hooks/useK8sResources';
import type { CustomResource, K8sCustomResourceDefinition } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useCustomResourceDefinitions: vi.fn(),
  useCustomResources: vi.fn(),
}));

function crd(
  uid: string,
  group: string,
  kind: string,
  plural: string,
  scope: 'Namespaced' | 'Cluster' = 'Namespaced',
): K8sCustomResourceDefinition {
  return {
    metadata: { name: `${plural}.${group}`, uid },
    spec: {
      group,
      scope,
      names: { plural, kind, singular: kind.toLowerCase() },
      versions: [{ name: 'v1', served: true, storage: true }],
    },
  };
}

function customResource(name: string, namespace: string): CustomResource {
  return { metadata: { name, namespace, creationTimestamp: '2024-01-01T00:00:00Z' } };
}

describe('CustomResources page', () => {
  it('shows the empty state when no CRDs are found', () => {
    vi.mocked(useCustomResourceDefinitions).mockReturnValue({ data: [], isLoading: false, error: null } as any);
    vi.mocked(useCustomResources).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    renderWithProviders(<CustomResources />);

    expect(screen.getByText('No CustomResourceDefinitions found in this cluster.')).toBeInTheDocument();
  });

  it('shows a spinner while CRDs are loading', () => {
    vi.mocked(useCustomResourceDefinitions).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);
    vi.mocked(useCustomResources).mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

    renderWithProviders(<CustomResources />);

    expect(screen.getByLabelText('Loading CRDs')).toBeInTheDocument();
  });

  it('prompts to choose a custom resource type when none is selected yet', () => {
    vi.mocked(useCustomResourceDefinitions).mockReturnValue({
      data: [crd('uid-1', 'example.com', 'Widget', 'widgets')],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useCustomResources).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    renderWithProviders(<CustomResources />);

    expect(screen.getByText('Select a custom resource type...')).toBeInTheDocument();
    expect(screen.getByText('Choose a custom resource type above to browse its instances.')).toBeInTheDocument();
  });

  it('shows custom resource instances after selecting a CRD from the dropdown', async () => {
    const user = userEvent.setup();
    const widgetCrd = crd('uid-1', 'example.com', 'Widget', 'widgets');
    vi.mocked(useCustomResourceDefinitions).mockReturnValue({
      data: [widgetCrd],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useCustomResources).mockReturnValue({
      data: [customResource('my-widget', 'default')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<CustomResources />);

    await user.click(screen.getByRole('button', { name: 'Select a custom resource type...' }));
    await user.click(screen.getByText('Widget (Namespaced)'));

    expect(screen.getByText('my-widget')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('groups CRDs by API group and lets the user pick across groups', async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomResourceDefinitions).mockReturnValue({
      data: [
        crd('uid-1', 'example.com', 'Widget', 'widgets'),
        crd('uid-2', 'other.io', 'Gadget', 'gadgets', 'Cluster'),
      ],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useCustomResources).mockReturnValue({
      data: [customResource('my-gadget', '—')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<CustomResources />);

    await user.click(screen.getByRole('button', { name: 'Select a custom resource type...' }));

    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('other.io')).toBeInTheDocument();

    await user.click(screen.getByText('Gadget (Cluster)'));

    expect(screen.getByRole('button', { name: 'Gadget' })).toBeInTheDocument();
    expect(screen.getByText('my-gadget')).toBeInTheDocument();
  });

  it('propagates a fetch error for the selected CRD instances to the table', async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomResourceDefinitions).mockReturnValue({
      data: [crd('uid-1', 'example.com', 'Widget', 'widgets')],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useCustomResources).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as any);

    renderWithProviders(<CustomResources />);

    await user.click(screen.getByRole('button', { name: 'Select a custom resource type...' }));
    await user.click(screen.getByText('Widget (Namespaced)'));

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
