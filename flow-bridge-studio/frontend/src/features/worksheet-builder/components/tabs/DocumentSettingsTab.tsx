import { 
  FileText, Clock, Award, GraduationCap, School, 
  BookOpen, CheckSquare, Settings2, FileCheck 
} from 'lucide-react';
import type { Worksheet } from '../../types';

interface DocumentSettingsTabProps {
  worksheet: Worksheet;
  onUpdateMetadata: (field: keyof Worksheet, value: any) => void;
  onUpdatePrintSettings: (field: string, value: any) => void;
  onNavigateToExercises: () => void;
}

export const DocumentSettingsTab = ({
  worksheet,
  onUpdateMetadata,
  onUpdatePrintSettings,
  onNavigateToExercises,
}: DocumentSettingsTabProps) => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            <Settings2 size={14} />
            Step 1 · Document Configuration
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Worksheet & Curriculum Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure header metadata, time limits, total points, and page formatting before adding exercises.
          </p>
        </div>

        <button
          onClick={onNavigateToExercises}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all"
        >
          <span>Continue to Exercises</span>
          <BookOpen size={14} />
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileText size={16} className="text-blue-600" />
          Primary Worksheet Information
        </h3>

        <div className="grid grid-cols-12 gap-5">
          {/* Title */}
          <div className="col-span-12">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Worksheet Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={worksheet.title}
              onChange={(e) => onUpdateMetadata('title', e.target.value)}
              placeholder="e.g. WONDERS OF THE NATURAL WORLD"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Unit / Module */}
          <div className="col-span-6">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Unit / Module Label
            </label>
            <input
              type="text"
              value={worksheet.unit}
              onChange={(e) => onUpdateMetadata('unit', e.target.value)}
              placeholder="e.g. UNIT 5: NATURE & ENVIRONMENT"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Lesson */}
          <div className="col-span-6">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Lesson / Topic Label
            </label>
            <input
              type="text"
              value={worksheet.lesson}
              onChange={(e) => onUpdateMetadata('lesson', e.target.value)}
              placeholder="e.g. LESSON 2: BIODIVERSITY AND RAINFORESTS"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Grade / Level */}
          <div className="col-span-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <GraduationCap size={13} className="text-blue-600" />
              Grade / Proficiency Level
            </label>
            <input
              type="text"
              value={worksheet.gradeLevel}
              onChange={(e) => onUpdateMetadata('gradeLevel', e.target.value)}
              placeholder="e.g. Grade 7 / B1"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* School Name */}
          <div className="col-span-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <School size={13} className="text-blue-600" />
              School / Department
            </label>
            <input
              type="text"
              value={worksheet.schoolName}
              onChange={(e) => onUpdateMetadata('schoolName', e.target.value)}
              placeholder="e.g. Pinta English"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Teacher Name */}
          <div className="col-span-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Teacher In-Charge
            </label>
            <input
              type="text"
              value={worksheet.teacherName}
              onChange={(e) => onUpdateMetadata('teacherName', e.target.value)}
              placeholder="e.g. Ms. Sarah Jenkins"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Assessment & Physical Paper Standards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Exam Scoring & Timing */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
            <Award size={16} className="text-blue-600" />
            Time & Scoring
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Clock size={13} className="text-slate-500" />
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={worksheet.totalTimeMinutes || 45}
                onChange={(e) => onUpdateMetadata('totalTimeMinutes', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Award size={13} className="text-slate-500" />
                Maximum Score
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={worksheet.totalPoints || 100}
                onChange={(e) => onUpdateMetadata('totalPoints', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Scores will be rendered on the student header line as: <code>Total Score: _____ / {worksheet.totalPoints || 100} pts</code>.
          </p>
        </div>

        {/* Paper & Print Formatting */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileCheck size={16} className="text-blue-600" />
            Physical Print Format
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-800">ISO A4 Standard (210 × 297 mm)</p>
                <p className="text-[11px] text-slate-500">15 mm margins · 180 mm printable content width</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                LOCKED
              </span>
            </div>

            {/* Student Info Toggle */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={worksheet.printSettings.showStudentInfo}
                onChange={(e) => onUpdatePrintSettings('showStudentInfo', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0"
              />
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckSquare size={13} className="text-blue-600" />
                  Include Student Information Block
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Prints name, class, date ruled lines, and score placeholder in the header.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
