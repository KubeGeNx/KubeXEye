import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { Events } from './Events';
import { useEvents } from '../hooks/useK8sResources';
import type { K8sEvent } from '../types/k8s';

vi.mock('../hooks/useK8sResources', () => ({
  useEvents: vi.fn(),
}));

function event(
  uid: string,
  reason: string,
  opts: Partial<K8sEvent> & { involvedObject?: K8sEvent['involvedObject'] } = {},
): K8sEvent {
  return {
    metadata: { name: `${reason}.${uid}`, namespace: 'default', uid },
    type: 'Normal',
    reason,
    message: 'something happened',
    count: 1,
    involvedObject: { kind: 'Pod', name: 'my-pod' },
    lastTimestamp: '2024-01-01T00:00:00Z',
    ...opts,
  };
}

describe('Events page', () => {
  it('renders each event with its type, object, message, and count', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: [event('uid-1', 'Started', { message: 'Started container', count: 3 })],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Events />);

    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('Started container')).toBeInTheDocument();
    expect(screen.getByText('Pod/my-pod')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens the YAML definition when the reason is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: [event('uid-1', 'Started')],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Events />);

    await user.click(screen.getByRole('button', { name: 'Started' }));

    expect(screen.getByText('Event/uid-1')).toBeInTheDocument();
  });

  it('falls back to namespace/name as the key when uid is missing', async () => {
    const user = userEvent.setup();
    const e = event('uid-1', 'Started');
    delete e.metadata.uid;
    vi.mocked(useEvents).mockReturnValue({
      data: [e],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<Events />);

    await user.click(screen.getByRole('button', { name: 'Started' }));

    expect(screen.getByText('Event/default/Started.uid-1')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(useEvents).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

    renderWithProviders(<Events />);

    expect(screen.getByLabelText('Loading resources')).toBeInTheDocument();
  });

  it('propagates a fetch error to the table', () => {
    vi.mocked(useEvents).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as any);

    renderWithProviders(<Events />);

    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
