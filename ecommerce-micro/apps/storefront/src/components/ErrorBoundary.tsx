import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="card max-w-md text-center p-10">
            <div className="mb-4 flex justify-center text-rose-500"><AlertTriangle className="h-10 w-10" /></div>
            <h2 className="text-xl font-semibold text-slate-700">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">
              An unexpected error occurred. You can try again, or go back to the catalog.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={this.reset}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                Try again
              </button>
              <a
                href="/"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Back to catalog
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
