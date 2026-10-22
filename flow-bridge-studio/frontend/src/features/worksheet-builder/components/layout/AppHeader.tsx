import React from 'react';
import { ChevronRight, Check, RefreshCw, AlertCircle, School } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface AppHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  schoolName?: string;
  /** Ẩn nhãn Saved của thanh này (màn đang tự hiện trạng thái lưu riêng ở khe thao tác) */
  hideSaveStatus?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  breadcrumbs,
  saveStatus = 'saved',
  schoolName = 'Pinta English',
  hideSaveStatus = false,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-2xs">
      {/* Left: Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs overflow-x-auto py-1">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <ChevronRight size={13} className="text-slate-300 shrink-0" />
              )}
              {crumb.onClick && !isLast ? (
                <button
                  onClick={crumb.onClick}
                  className="font-semibold text-slate-500 hover:text-blue-600 transition-colors whitespace-nowrap"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={`whitespace-nowrap ${
                    isLast
                      ? 'font-bold text-slate-900'
                      : 'font-semibold text-slate-500'
                  }`}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Khe thao tác: các màn (ví dụ trình soạn Cloze) gắn nút của mình vào đây qua portal */}
      <div id="app-header-actions" className="flex items-center gap-2 ml-auto pl-4 shrink-0" />

      {/* Right: Autosave Status & School Badge */}
      <div className="flex items-center gap-3 shrink-0 pl-4">
        {/* Autosave Status Badge */}
        <div className={`flex items-center gap-1.5 text-xs font-medium ${hideSaveStatus ? 'hidden' : ''}`}>
          {saveStatus === 'saved' && (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 font-semibold">
              <Check size={12} className="text-emerald-600" />
              <span className="hidden sm:inline">Saved</span>
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 font-semibold animate-pulse">
              <RefreshCw size={11} className="animate-spin text-blue-600" />
              <span className="hidden sm:inline">Saving...</span>
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 font-semibold">
              <AlertCircle size={11} className="text-amber-600" />
              <span className="hidden sm:inline">Unsaved Changes</span>
            </span>
          )}
        </div>

        {/* School Name Badge */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 pl-3 border-l border-slate-100">
          <School size={13} className="text-slate-400" />
          <span className="truncate max-w-[180px] font-medium">{schoolName}</span>
        </div>
      </div>
    </header>
  );
};
