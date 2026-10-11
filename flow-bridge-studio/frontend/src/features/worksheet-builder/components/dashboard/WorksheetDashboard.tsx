import { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, Plus, Sparkles, Printer, FileText, 
  Clock, CheckCircle2, BookOpen, Layers, ArrowRight,
  RefreshCw, Check, School, Award, ChevronDown
} from 'lucide-react';
import type { Worksheet } from '../../types';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { SmartPasteModal } from '../smart-paste/SmartPasteModal';

interface WorksheetDashboardProps {
  worksheet: Worksheet;
  onNavigateToBuilder: (initialTab?: 'settings' | 'exercises' | 'editor' | 'answer_key' | 'images' | 'preview') => void;
  onResetSample: () => void;
  onNewBlankWorksheet: () => void;
  onImportedWorksheet: (imported: Worksheet) => void;
}

export const WorksheetDashboard: React.FC<WorksheetDashboardProps> = ({
  worksheet,
  onNavigateToBuilder,
  onResetSample,
  onNewBlankWorksheet,
  onImportedWorksheet,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState<boolean>(false);
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalQuestions = worksheet.exercises.reduce(
    (acc, ex) => acc + (ex.questions?.length || 0),
    0
  );

  const handleExportDocx = (mode: 'student' | 'teacher_key') => {
    exportWorksheetToDocx(worksheet, mode);
    setDownloadSuccess(`Downloaded ${mode === 'teacher_key' ? 'Teacher Answer Key' : 'Student Copy'} DOCX`);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header with Prominent Create Worksheet Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                Teacher Workspace
              </span>
              <span className="text-xs text-slate-400">· ISO A4 Print Ready</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Worksheet Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create, organize, and export high-quality printable English worksheets and tests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Reload Cambridge Sample */}
            <button
              onClick={onResetSample}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Reload sample Cambridge English test"
            >
              <RefreshCw size={13} className="text-slate-500" />
              Reset Sample
            </button>

            {/* Prominent Create Worksheet Dropdown Action */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm shadow-blue-500/25 transition-all active:scale-95"
              >
                <Plus size={15} />
                <span>Create Worksheet</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCreateMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {/* Option 1: Smart Paste (Recommended) */}
                  <button
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      setIsSmartPasteOpen(true);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50/60 flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                          Smart Paste
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Paste full exam text. Automatically detects 15 exercise formats, questions, choices & images.
                      </p>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  {/* Option 2: Manual Builder */}
                  <button
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      onNewBlankWorksheet();
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-slate-700">
                        Manual Builder
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Start with a blank sheet or configure exercises manually step-by-step.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Direct Open Worksheet Builder */}
            <button
              onClick={() => onNavigateToBuilder('settings')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <span>Open Builder</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <Check size={14} className="text-emerald-600" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Exercises</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{worksheet.exercises.length}</p>
              <p className="text-[11px] text-slate-500">Across 15 supported formats</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <BookOpen size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Questions</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalQuestions}</p>
              <p className="text-[11px] text-slate-500">With answer keys & scoring</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Duration</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{worksheet.totalTimeMinutes || 45}m</p>
              <p className="text-[11px] text-slate-500">Suggested test time</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Award size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Max Points</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{worksheet.totalPoints || 10} pts</p>
              <p className="text-[11px] text-slate-500">Grading scale total</p>
            </div>
          </div>
        </div>

        {/* Current Active Worksheet Spotlight Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Current Active Project
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                {worksheet.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <School size={13} className="text-slate-400" />
                  {worksheet.schoolName || 'English Academy'}
                </span>
                <span>•</span>
                <span>{worksheet.unit || 'Unit 1'} · {worksheet.lesson || 'Lesson 1'}</span>
                <span>•</span>
                <span>Level: <strong className="text-slate-700">{worksheet.gradeLevel || 'Level B1'}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 size={13} />
                  Autosaved
                </span>
                {worksheet.importMetadata && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Imported via Smart Paste
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportDocx('student')}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                title="Download Student Word document"
              >
                <FileText size={13} className="text-blue-600" />
                Student DOCX
              </button>

              <button
                onClick={() => handleExportDocx('teacher_key')}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                title="Download Teacher Key Word document"
              >
                <CheckCircle2 size={13} className="text-rose-600" />
                Teacher Key DOCX
              </button>

              <button
                onClick={() => onNavigateToBuilder('preview')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Printer size={13} />
                Preview & Print
              </button>
            </div>
          </div>

          {/* Builder Steps Navigation Shortcuts */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Direct Tab Shortcuts
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { tab: 'settings' as const, label: '1. Doc Settings', desc: 'Title, school, time' },
                { tab: 'exercises' as const, label: '2. Exercises', desc: `${worksheet.exercises.length} added` },
                { tab: 'editor' as const, label: '3. Content Editor', desc: 'Questions & choices' },
                { tab: 'answer_key' as const, label: '4. Answer Key', desc: 'Teacher grading keys' },
                { tab: 'images' as const, label: '5. Image Manager', desc: 'Google Flow slots' },
                { tab: 'preview' as const, label: '6. Preview & Export', desc: 'A4 & PDF export' },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => onNavigateToBuilder(item.tab)}
                  className="p-3 text-left bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Overview list inside current active worksheet */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Worksheet Exercises List
              </h3>
              <button
                onClick={() => onNavigateToBuilder('exercises')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Manage all exercises →
              </button>
            </div>

            <div className="space-y-2">
              {worksheet.exercises.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {ex.title || `Exercise ${idx + 1}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Type: <span className="capitalize">{ex.type.replace(/_/g, ' ')}</span> · {ex.questions.length} questions · {ex.pointsTotal || 0} pts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onNavigateToBuilder('editor')}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Edit Questions
                    </button>
                    <button
                      onClick={() => onNavigateToBuilder('answer_key')}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      Answer Key
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Smart Paste Promotional / Workflow Card */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-yellow-300" />
              <h3 className="font-bold text-base">New: Smart Paste Worksheet Import</h3>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed">
              Have an existing exam in Word or Google Docs? Copy and paste the whole document. Smart Paste detects 15 exercise formats, reading passages, multiple choice options, tables, and image cues in one click.
            </p>
          </div>

          <button
            onClick={() => setIsSmartPasteOpen(true)}
            className="px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl shadow transition-all active:scale-95 shrink-0 flex items-center gap-2"
          >
            <Sparkles size={14} className="text-blue-600" />
            <span>Launch Smart Paste</span>
          </button>
        </div>

      </div>

      {/* Smart Paste Modal */}
      <SmartPasteModal
        isOpen={isSmartPasteOpen}
        onClose={() => setIsSmartPasteOpen(false)}
        onWorksheetCreated={(imported) => {
          onImportedWorksheet(imported);
          setIsSmartPasteOpen(false);
        }}
      />
    </div>
  );
};
