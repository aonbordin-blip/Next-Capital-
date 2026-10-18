import React, { Component, ErrorInfo, ReactNode } from 'react';
import { NextCapitalLogo } from './NextCapitalLogo';
import { RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-slate-200 text-center space-y-4">
            <div className="flex justify-center">
              <NextCapitalLogo size={48} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Next Capital MotoLease
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                เกิดข้อผิดพลาดในการแสดงผลชั่วคราว
              </p>
            </div>

            {this.state.error && (
              <div className="bg-rose-50 text-rose-800 text-[11px] p-3 rounded-xl border border-rose-200 text-left overflow-x-auto font-mono">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                รีเฟรชหน้าเว็บ
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ล้างข้อมูลชั่วคราวแล้วโหลดใหม่
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
