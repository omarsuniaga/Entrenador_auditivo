import React, { ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070A] text-slate-200 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#0A0D14] border border-red-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-mono text-white uppercase tracking-tight">
                Estado de Recuperación
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Se detectó una discrepancia en el renderizado de la interfaz. Puedes reiniciar la sesión con el botón inferior.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/60 border border-white/5 text-left overflow-x-auto text-[11px] font-mono text-red-300/80">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>REINICIAR APLICACIÓN</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

