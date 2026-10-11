import React, { useState } from 'react';
import { 
  Printer, FileText, Download, ZoomIn, ZoomOut, RotateCcw, 
  KeyRound, Eye, Image as ImageIcon 
} from 'lucide-react';
import type { Worksheet } from '../../types';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { exportWorksheetToDocx } from '../../services/docxExportService';

interface PreviewExportTabProps {
  worksheet: Worksheet;
  onUpdatePrintSettings: (key: string, value: any) => void;
  onResetSample: () => void;
  onExportJson: () => void;
}

export const PreviewExportTab: React.FC<PreviewExportTabProps> = ({
  worksheet,
  onUpdatePrintSettings,
  onResetSample,
  onExportJson,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const isTeacherKey = !!worksheet.printSettings?.showAnswerKey;
  const showPlaceholders = worksheet.printSettings?.showPlaceholders ?? true;

  const handlePrint = () => {
    window.print();
  };

  const handleExportDocxStudent = () => {
    exportWorksheetToDocx(worksheet, 'student');
  };

  const handleExportDocxTeacher = () => {
    exportWorksheetToDocx(worksheet, 'teacher_key');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-text">
      {/* Top Preview Controls Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-10 shadow-2xs no-print">
        {/* Left: View Modes & Settings */}
        <div className="flex items-center gap-3">
          {/* Student vs Teacher Answer Key Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            <button
              onClick={() => onUpdatePrintSettings('showAnswerKey', false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                !isTeacherKey
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Eye size={13} />
              <span>Student Copy</span>
            </button>
            <button
              onClick={() => onUpdatePrintSettings('showAnswerKey', true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isTeacherKey
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound size={13} />
              <span>Teacher Key</span>
            </button>
          </div>

          {/* Dotted Placeholders Toggle */}
          <button
            onClick={() => onUpdatePrintSettings('showPlaceholders', !showPlaceholders)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
              showPlaceholders
                ? 'bg-slate-50 border-slate-300 text-slate-700'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
            title="Toggle dotted frame for empty image slots"
          >
            <ImageIcon size={13} className={showPlaceholders ? 'text-blue-600' : 'text-slate-400'} />
            <span className="hidden sm:inline">Dotted Boxes:</span>
            <span className="font-bold">{showPlaceholders ? 'On' : 'Off'}</span>
          </button>
        </div>

        {/* Center: Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
            className="p-1 text-slate-500 hover:text-slate-800 rounded"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-xs font-mono font-bold text-slate-700 px-1.5 min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(150, prev + 10))}
            className="p-1 text-slate-500 hover:text-slate-800 rounded"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            className="text-[10px] text-slate-400 hover:text-slate-700 px-1"
            title="Reset to 100%"
          >
            Reset
          </button>
        </div>

        {/* Right: Export Actions */}
        <div className="flex items-center gap-2">
          {/* Word DOCX dropdown / buttons */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              onClick={handleExportDocxStudent}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-white rounded-lg flex items-center gap-1 transition-all"
              title="Download editable Microsoft Word docx"
            >
              <FileText size={13} className="text-blue-600" />
              <span>Word .doc</span>
            </button>
            <button
              onClick={handleExportDocxTeacher}
              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-white rounded-lg transition-all"
              title="Download Teacher Key Microsoft Word doc"
            >
              + Key
            </button>
          </div>

          {/* Print PDF Action */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            title="Open browser print dialogue (Save as PDF or print on A4 paper)"
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>

          {/* Backup JSON */}
          <button
            onClick={onExportJson}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Export JSON backup"
          >
            <Download size={14} />
          </button>

          {/* Reset sample */}
          <button
            onClick={onResetSample}
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-200 rounded-lg transition-colors"
            title="Reset to default sample"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Preview Stage (Scrollable Canvas) */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
        <div
          className="transition-transform duration-200 ease-out origin-top shadow-2xl rounded-sm my-2"
          style={{
            transform: `scale(${zoomLevel / 100})`,
          }}
        >
          <WorksheetRenderer worksheet={worksheet} />
        </div>
      </div>
    </div>
  );
};
