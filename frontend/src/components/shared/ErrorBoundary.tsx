import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="h-12 w-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 mb-4 max-w-md mono-data">
            {this.state.error.message.length > 200
              ? this.state.error.message.slice(0, 200) + "..."
              : this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn btn-primary text-xs"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
