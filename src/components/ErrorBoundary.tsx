import React from 'react';
import { Button } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

interface Props {
  children: React.ReactNode;
  /** Human-readable label shown in the error card, e.g. "Pods page" */
  label?: string;
}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Catches render errors in its subtree and shows a recovery card instead of
 * crashing the entire app. Each page / panel should be wrapped in its own
 * boundary so a single bad resource doesn't black-screen the operator.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });
    console.error(`[ErrorBoundary] ${this.props.label ?? 'section'} crashed`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null, errorInfo: null });

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          textAlign: 'center',
          gap: '0.75rem',
          minHeight: 240,
        }}
      >
        <ExclamationCircleIcon style={{ fontSize: '2.5rem', color: '#E25A5A' }} />

        <p style={{ fontSize: '1rem', fontWeight: 500, color: '#F0EEE8', margin: 0 }}>
          {this.props.label ?? 'This section'} encountered an unexpected error
        </p>

        <p style={{ fontSize: '0.85rem', color: '#C8C5BB', margin: 0, maxWidth: 480 }}>
          The rest of the application is still running. You can try again or navigate away.
        </p>

        {error.message && (
          <code
            style={{
              display: 'block',
              background: 'rgba(226,90,90,0.1)',
              border: '0.5px solid rgba(226,90,90,0.3)',
              borderRadius: 6,
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              color: '#E25A5A',
              maxWidth: 560,
              wordBreak: 'break-all',
              textAlign: 'left',
            }}
          >
            {error.message}
          </code>
        )}

        {errorInfo?.componentStack && (
          <details style={{ fontSize: '0.75rem', color: '#7B7970', maxWidth: 560, textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#7B7970' }}>Component stack</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#7B7970' }}>
              {errorInfo.componentStack}
            </pre>
          </details>
        )}

        <Button variant="secondary" onClick={this.reset} style={{ marginTop: '0.5rem' }}>
          Try again
        </Button>
      </div>
    );
  }
}
