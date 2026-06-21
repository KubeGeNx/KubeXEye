import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusLabel } from './StatusLabel';

describe('StatusLabel', () => {
  it('renders the status text', () => {
    render(<StatusLabel status="Running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('falls back to "Unknown" when no status is given', () => {
    render(<StatusLabel />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders an unrecognized status as-is rather than dropping it', () => {
    render(<StatusLabel status="SomeFutureK8sPhase" />);
    expect(screen.getByText('SomeFutureK8sPhase')).toBeInTheDocument();
  });
});
