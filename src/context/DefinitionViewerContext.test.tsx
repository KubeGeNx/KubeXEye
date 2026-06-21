import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DefinitionViewerProvider } from './DefinitionViewerContext';
import { ResourceDefinitionButton } from '../components/ResourceDefinitionButton';

// Regression coverage for a real bug: each row used to own its own Modal + open state inside
// ResourceDefinitionButton, so a poll-driven table refetch that remounted a row silently closed
// whatever the user had open. The fix moved the Modal to a single app-level provider and snapshots
// `resource` at click time instead of re-reading it reactively.

// PatternFly's Modal marks everything outside it aria-hidden while open (its focus trap), so
// background controls — like the "simulate a refetch/unmount" buttons used below to stand in for
// what the underlying table does — need `{ hidden: true }` to remain queryable by role.
const bg = { hidden: true } as const;

function getYamlCodeText(): string {
  return document.querySelector('.pf-v6-c-code-block__code')?.textContent ?? '';
}

function UnmountableRow({ resource }: { resource: unknown }) {
  const [mounted, setMounted] = useState(true);
  return (
    <div>
      <button onClick={() => setMounted(false)}>simulate-row-unmount</button>
      {mounted && <ResourceDefinitionButton resource={resource} title="Pod/default/app-1" />}
    </div>
  );
}

function MutableResourceRow() {
  const [resource, setResource] = useState({ value: 'first' });
  return (
    <div>
      <button onClick={() => setResource({ value: 'second' })}>simulate-poll-refetch</button>
      <ResourceDefinitionButton resource={resource} title="Pod/default/app-1" />
    </div>
  );
}

describe('DefinitionViewerProvider + ResourceDefinitionButton', () => {
  it('keeps the modal open even after the triggering row unmounts', async () => {
    const user = userEvent.setup();
    render(
      <DefinitionViewerProvider>
        <UnmountableRow resource={{ kind: 'Pod' }} />
      </DefinitionViewerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'YAML' }));
    expect(screen.getByText('Pod/default/app-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'simulate-row-unmount', ...bg }));

    // The trigger is gone, but the modal (owned by the provider, not the row) must still be open.
    expect(screen.getByText('Pod/default/app-1')).toBeInTheDocument();
  });

  it('snapshots the resource at click time and does not pick up later prop changes while open', async () => {
    const user = userEvent.setup();
    render(
      <DefinitionViewerProvider>
        <MutableResourceRow />
      </DefinitionViewerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'YAML' }));
    expect(getYamlCodeText()).toContain('first');

    // Simulate a background poll updating the underlying data while the modal is open.
    await user.click(screen.getByRole('button', { name: 'simulate-poll-refetch', ...bg }));

    expect(getYamlCodeText()).toContain('first');
    expect(getYamlCodeText()).not.toContain('second');
  });

  it('refreshes to the latest data on the next click after closing', async () => {
    const user = userEvent.setup();
    render(
      <DefinitionViewerProvider>
        <MutableResourceRow />
      </DefinitionViewerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'YAML' }));
    expect(getYamlCodeText()).toContain('first');

    await user.click(screen.getByRole('button', { name: /close/i }));
    await user.click(screen.getByRole('button', { name: 'simulate-poll-refetch' }));
    await user.click(screen.getByRole('button', { name: 'YAML' }));

    expect(getYamlCodeText()).toContain('second');
  });

  it('shows the warning banner when one is provided', async () => {
    const user = userEvent.setup();
    render(
      <DefinitionViewerProvider>
        <ResourceDefinitionButton resource={{ kind: 'Pod' }} title="Pod/default/app-1" warning="No resource limits defined." />
      </DefinitionViewerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'YAML' }));
    expect(screen.getByText('No resource limits defined.')).toBeInTheDocument();
  });
});
