import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Nodes } from './Nodes';
import { useNodes, useNodeMetrics } from '../hooks/useK8sResources';
import type { K8sNode, NodeMetrics } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useNodes: vi.fn(),
  useNodeMetrics: vi.fn(),
}));

function node(name: string, labels: Record<string, string> = {}): K8sNode {
  return {
    metadata: { name, labels },
    status: {
      conditions: [{ type: 'Ready', status: 'True' }],
      allocatable: { cpu: '2', memory: '4096Mi', pods: '110' },
      nodeInfo: { kubeletVersion: 'v1.29.0' },
    },
  };
}

function nodeMetrics(name: string, cpu: string, memory: string): NodeMetrics {
  return { metadata: { name }, timestamp: '2024-01-01T00:00:00Z', window: '10s', usage: { cpu, memory } };
}

describe('Nodes page', () => {
  it('renders a node row with computed CPU/Memory usage and a Roles column', () => {
    vi.mocked(useNodes).mockReturnValue({
      data: [node('node-1', { 'node-role.kubernetes.io/control-plane': '' })],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useNodeMetrics).mockReturnValue({
      data: [nodeMetrics('node-1', '1', '2048Mi')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Nodes />);

    expect(screen.getByText('node-1')).toBeInTheDocument();
    expect(screen.getByText('control-plane')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    // CPU: used 1 core / alloc 2 cores -> "1.00 / 2.00 (50%)"
    expect(screen.getByText('1.00 / 2.00 (50%)')).toBeInTheDocument();
    // Memory: used 2048Mi / alloc 4096Mi -> "2.0 GiB / 4.0 GiB (50%)"
    expect(screen.getByText('2.0 GiB / 4.0 GiB (50%)')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('v1.29.0')).toBeInTheDocument();
  });

  it('defaults Roles to "worker" when there are no node-role labels', () => {
    vi.mocked(useNodes).mockReturnValue({
      data: [node('node-2')],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useNodeMetrics).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    renderWithProviders(<Nodes />);

    expect(screen.getByText('worker')).toBeInTheDocument();
  });

  it('opens the definition when the node name is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useNodes).mockReturnValue({
      data: [node('node-1')],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useNodeMetrics).mockReturnValue({ data: [], isLoading: false, error: null } as any);

    renderWithProviders(<Nodes />);

    await user.click(screen.getByRole('button', { name: 'node-1' }));

    expect(screen.getByText('Node/node-1')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useNodes).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);
    vi.mocked(useNodeMetrics).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<Nodes />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useNodes).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);
    vi.mocked(useNodeMetrics).mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

    renderWithProviders(<Nodes />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
