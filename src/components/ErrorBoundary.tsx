import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 40, opacity: 0.4 }}>:(</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0, maxWidth: 280 }}>
            The app encountered an unexpected error. Try restarting the application.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 18px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
          <details style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 320, opacity: 0.7 }}>
            <summary style={{ cursor: 'pointer' }}>Error details</summary>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error?.message ?? 'Unknown error'}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
