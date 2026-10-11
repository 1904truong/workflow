import React, { useState, useEffect } from 'react';
import { History, FileText, Printer, ArrowRight, Clock, Trash2 } from 'lucide-react';
import type { ExportHistoryItem } from '../../types';
import { folderStorage } from '../../services/folderStorageService';

interface ExportHistoryScreenProps {
  onOpenFolder: (folderId: string) => void;
}

export const ExportHistoryScreen: React.FC<ExportHistoryScreenProps> = ({
  onOpenFolder,
}) => {
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);

  useEffect(() => {
    folderStorage.listExportHistory().then(setHistory);
  }, []);

  const handleClearHistory = () => {
    if (confirm('Clear export history log?')) {
      localStorage.removeItem('flow_bridge_export_history_v1');
      setHistory([]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <History size={22} className="text-blue-600" />
              Export History
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Audit log of recently printed PDFs and downloaded Word DOCX worksheets.
            </p>
          </div>

          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} /> Clear Log
            </button>
          )}
        </div>

        {/* History List */}
        {history.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <History size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Exports Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              When you print a PDF or download an editable Word DOCX worksheet from any lesson folder, a log entry will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {history.map((item) => {
              const isTeacher = item.exportType.includes('teacher');
              const isPdf = item.exportType.startsWith('pdf');
              const formattedDate = new Date(item.exportedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isTeacher ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {isPdf ? <Printer size={18} /> : <FileText size={18} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.2 rounded-full uppercase ${
                            isTeacher
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isPdf ? 'PDF Print' : 'Word .doc'} · {isTeacher ? 'Teacher Key' : 'Student Copy'}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock size={11} /> {formattedDate}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                        {item.lessonName}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                      {item.exercisesCount} Exercises
                    </span>

                    <button
                      onClick={() => onOpenFolder(item.lessonId)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Open Folder</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
