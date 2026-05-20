import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
          <div className="w-full max-w-xl text-center space-y-6 p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 dark:bg-red-950/50 rounded-2xl animate-pulse">
                <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight">Ops! Algo deu errado.</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                Ocorreu uma falha inesperada durante a renderização deste componente ou módulo. Não se preocupe, seus dados estão seguros.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="gap-2 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                Recarregar Página
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-all"
              >
                <Home className="h-4 w-4" />
                Voltar ao Início
              </Button>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-left">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mx-auto"
              >
                {this.state.showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {this.state.showDetails ? 'Ocultar detalhes técnicos' : 'Exibir detalhes técnicos'}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-red-400 overflow-x-auto shadow-inner animate-in slide-in-from-top-2 duration-200 max-h-48 overflow-y-auto">
                  <p className="font-bold mb-1">{this.state.error?.toString()}</p>
                  <p className="text-slate-500 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Se este problema persistir, entre em contato com o suporte do Diário Digital informando os detalhes técnicos acima.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
