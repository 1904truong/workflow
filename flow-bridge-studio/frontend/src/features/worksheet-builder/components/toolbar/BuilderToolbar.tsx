import { 
  Printer, Download, CheckCircle2, 
  Eye, RefreshCw, ZoomIn, ZoomOut, Check 
} from 'lucide-react';
import type { Worksheet } from '../../types';

interface BuilderToolbarProps {
  worksheet: Worksheet;
  zoom: number;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  onUpdatePrintSettings: (key: string, value: any) => void;
  onSetZoom: (zoom: number) => void;
  onPrintPdf: () => void;
  onExportJson: () => void;
  onResetSample: () => void;
}

export const BuilderToolbar: React.FC<BuilderToolbarProps> = ({
  worksheet,
  zoom,
  saveStatus,
  onUpdatePrintSettings,
  onSetZoom,
  onPrintPdf,
  onExportJson,
  onResetSample,
}) => {
  const isTeacherKey = worksheet.printSettings.mode === 'teacher_key';

  return (
    <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 builder-toolbar shrink-0 select-none z-10 shadow-xs">
      {/* Left: View Mode Toggle (Student vs Teacher Key) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => onUpdatePrintSettings('mode', 'student')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              !isTeacherKey
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Eye size={13} className={!isTeacherKey ? 'text-blue-600' : ''} />
            Student Copy
          </button>

          <button
            onClick={() => onUpdatePrintSettings('mode', 'teacher_key')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              isTeacherKey
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 size={13} />
            Teacher Answer Key
          </button>
        </div>

        {/* Empty placeholder borders toggle */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={worksheet.printSettings.showEmptyImagePlaceholders}
            onChange={(e) => onUpdatePrintSettings('showEmptyImagePlaceholders', e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0"
          />
          <span className="text-[11px] font-medium">Show placeholder boxes in print</span>
        </label>
      </div>

      {/* Middle: Save Status & Reset */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {saveStatus === 'saved' && (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1">
              <Check size={12} className="text-emerald-600" />
              Autosaved to Storage
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              Saving...
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button
            onClick={() => onSetZoom(Math.max(50, zoom - 10))}
            className="p-1 hover:bg-white rounded text-slate-600"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-[11px] font-bold px-1.5 text-slate-700">{zoom}%</span>
          <button
            onClick={() => onSetZoom(Math.min(150, zoom + 10))}
            className="p-1 hover:bg-white rounded text-slate-600"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>

      {/* Right: Export & Print Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onResetSample}
          className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5"
          title="Reload sample English worksheet"
        >
          <RefreshCw size={12} />
          Sample Data
        </button>

        <button
          onClick={onExportJson}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-1.5"
        >
          <Download size={13} />
          Export JSON / Backup
        </button>

        {/* Primary Action: Print / Save to PDF */}
        <button
          onClick={onPrintPdf}
          className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Printer size={14} />
          Print / Export A4 PDF
        </button>
      </div>
    </div>
  );
};
