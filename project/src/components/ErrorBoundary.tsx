import { Component, type ReactNode, type ErrorInfo } from 'react';

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
    console.error('Application error:', error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('brigade189_auth_user_id');
    } catch {
      // Storage blocked — ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <span className="text-2xl">!</span>
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">שגיאת מערכת</h1>
            <p className="text-sm text-slate-400 mb-6">
              אירעה שגיאה בטעינת המערכת. נא לרענן את הדף או לנסות שנית.
            </p>
            {this.state.error && (
              <p className="text-[11px] text-slate-600 mb-4 font-mono truncate">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="btn-primary px-6 py-2.5"
            >
              רענן דף
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
