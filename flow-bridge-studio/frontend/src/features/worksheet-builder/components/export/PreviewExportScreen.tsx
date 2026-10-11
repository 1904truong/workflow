import React, { useState } from 'react';
import { 
  ArrowLeft, Printer, FileText, Download, ZoomIn, ZoomOut, Eye, 
  KeyRound, Image as ImageIcon
} from 'lucide-react';
import type { LessonFolder } from '../../types';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { folderToWorksheet } from '../../types';
import { folderStorage } from '../../services/folderStorageService';

interface PreviewExportScreenProps {
  folder: LessonFolder;
  onBackToFolder: () => void;
  onUpdatePrintSettings: (key: string, value: any) => void;
}

export const PreviewExportScreen: React.FC<PreviewExportScreenProps> = ({
  folder,
  onBackToFolder,
  onUpdatePrintSettings,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const isTeacherKey = !!folder.printSettings?.showAnswerKey;
  const showPlaceholders = folder.printSettings?.showPlaceholders ?? true;

  const worksheet = folderToWorksheet(folder);

  const handlePrint = () => {
    folderStorage.addExportHistory({
      lessonId: folder.id,
      lessonName: folder.name,
      exportType: isTeacherKey ? 'pdf_teacher' : 'pdf_student',
      exercisesCount: folder.exercises.length,
    });
    window.print();
  };

  const handleExportDocxStudent = () => {
    folderStorage.addExportHistory({
      lessonId: folder.id,
      lessonName: folder.name,
      exportType: 'docx_student',
      exercisesCount: folder.exercises.length,
    });
    exportWorksheetToDocx(worksheet, 'student');
  };

  const handleExportDocxTeacher = () => {
    folderStorage.addExportHistory({
      lessonId: folder.id,
      lessonName: folder.name,
      exportType: 'docx_teacher',
      exercisesCount: folder.exercises.length,
    });
    exportWorksheetToDocx(worksheet, 'teacher_key');
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(folder, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${folder.name.replace(/\s+/g, '_')}_Folder.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-text">
      
      {/* Top Preview Controls Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-10 shadow-2xs no-print">
        {/* Left: Back & Modes */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToFolder}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors mr-2"
          >
            <ArrowLeft size={13} /> Back to Folder
          </button>

          <span className="text-slate-300">|</span>

          {/* Student Copy vs Teacher Answer Key Toggle */}
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
            title="Toggle dotted frame for empty image placeholders"
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
              title="Download editable Microsoft Word DOCX"
            >
              <FileText size={13} className="text-blue-600" />
              <span>Word .doc</span>
            </button>
            <button
              onClick={handleExportDocxTeacher}
              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-white rounded-lg transition-all"
              title="Download Teacher Key Microsoft Word DOCX"
            >
              + Key
            </button>
          </div>

          {/* Print PDF Action */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            title="Open print dialogue (Save as PDF or print on A4 paper)"
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Export JSON backup"
          >
            <Download size={14} />
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
