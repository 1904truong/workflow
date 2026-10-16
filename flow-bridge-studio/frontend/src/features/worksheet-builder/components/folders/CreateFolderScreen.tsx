import React, { useState } from 'react';
import {
  Folder, FolderPlus, ChevronDown, ChevronUp, ArrowLeft, GraduationCap, BookOpen, Tag,
  Headphones, PenLine, BarChart3, Layers, MessageCircle, Settings, FileText, User, Check,
  type LucideIcon,
} from 'lucide-react';
import type { LessonFolder } from '../../types';
import { DEFAULT_SAMPLE_WORKSHEET } from '../../services/sampleWorksheets';

interface CreateFolderScreenProps {
  initialFolder?: LessonFolder | null;
  onSave: (folderData: Partial<LessonFolder>) => void;
  onCancel: () => void;
}

const SKILLS: { id: string; icon: LucideIcon }[] = [
  { id: 'Reading', icon: BookOpen },
  { id: 'Listening', icon: Headphones },
  { id: 'Writing', icon: PenLine },
  { id: 'Grammar', icon: BarChart3 },
  { id: 'Vocabulary', icon: Layers },
  { id: 'Speaking', icon: MessageCircle },
];

const GRADES = [
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'Level A1', 'Level A2', 'Level B1', 'Level B2', 'Level C1',
];
const SUBJECTS = ['English', 'Mathematics', 'Science', 'Literature', 'Other'];

const inputWrap =
  'flex items-center gap-3 w-full px-3.5 h-10 bg-white border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all';
const inputCls = 'flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-900 placeholder:text-slate-400';
const labelCls = 'block text-[13px] font-semibold text-slate-900 mb-2';

export const CreateFolderScreen: React.FC<CreateFolderScreenProps> = ({
  initialFolder,
  onSave,
  onCancel,
}) => {
  const isEditing = !!initialFolder;

  const [name, setName] = useState(initialFolder?.name || '');
  const [gradeLevel, setGradeLevel] = useState(initialFolder?.gradeLevel || 'Grade 7');
  const [subject, setSubject] = useState(initialFolder?.subject || 'English');
  const [unitTopic, setUnitTopic] = useState(initialFolder?.unitTopic || '');
  const [targetSkills, setTargetSkills] = useState<string[]>(initialFolder?.targetSkills || ['Reading', 'Vocabulary']);

  const [showAdvanced, setShowAdvanced] = useState(true);
  const [lessonTitle, setLessonTitle] = useState(initialFolder?.lessonTitle || '');
  const [description, setDescription] = useState(initialFolder?.description || '');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(initialFolder?.estimatedDuration || 45);
  const [schoolName, setSchoolName] = useState(initialFolder?.schoolName || 'Cambridge International Academy');
  const [teacherName, setTeacherName] = useState(initialFolder?.teacherName || 'Sarah Jenkins');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subjectOptions = SUBJECTS.includes(subject) ? SUBJECTS : [subject, ...SUBJECTS];
  const gradeOptions = GRADES.includes(gradeLevel) ? GRADES : [gradeLevel, ...GRADES];

  const toggleSkill = (skill: string) =>
    setTargetSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a folder name (e.g. "Unit 5 – Nature & Environment").');
      return;
    }
    onSave({
      name: name.trim(),
      gradeLevel,
      subject,
      unitTopic: unitTopic.trim() || undefined,
      lessonTitle: lessonTitle.trim() || undefined,
      description: description.trim() || undefined,
      estimatedDuration,
      targetSkills,
      schoolName: schoolName.trim(),
      teacherName: teacherName.trim(),
      printSettings: initialFolder?.printSettings || DEFAULT_SAMPLE_WORKSHEET.printSettings,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-4xl w-full mx-auto space-y-4">
        <button
          onClick={onCancel}
          className="text-[13px] text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Lesson Folders
        </button>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Folder size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[22px] leading-tight font-bold text-slate-900">
                {isEditing ? 'Edit Lesson Folder' : 'Create New Lesson Folder'}
              </h1>
              <p className="text-[13px] text-slate-500 mt-0.5">Organize your exercises into a printable worksheet.</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{errorMsg}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Folder name */}
            <div>
              <label className={labelCls}>Folder Name <span className="text-rose-500">*</span></label>
              <div className={inputWrap}>
                <Folder size={17} className="text-slate-500 shrink-0" strokeWidth={1.6} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrorMsg(null); }}
                  placeholder="e.g. Unit 5 – Nature & Environment"
                  className={inputCls}
                  autoFocus
                />
              </div>
            </div>

            {/* Grade + Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Grade Level <span className="text-rose-500">*</span></label>
                <div className={inputWrap}>
                  <GraduationCap size={17} className="text-slate-500 shrink-0" strokeWidth={1.6} />
                  <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
                    {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronDown size={15} className="text-slate-500 shrink-0 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Subject <span className="text-rose-500">*</span></label>
                <div className={inputWrap}>
                  <BookOpen size={17} className="text-slate-500 shrink-0" strokeWidth={1.6} />
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
                    {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={15} className="text-slate-500 shrink-0 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Unit / Topic */}
            <div>
              <label className={labelCls}>Unit / Topic</label>
              <div className={inputWrap}>
                <Tag size={17} className="text-slate-500 shrink-0" strokeWidth={1.6} />
                <input
                  type="text"
                  value={unitTopic}
                  onChange={(e) => setUnitTopic(e.target.value)}
                  placeholder="e.g. Biodiversity & Habitats"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Target skills */}
            <div>
              <label className={labelCls}>Target Skills</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {SKILLS.map(({ id, icon: Icon }) => {
                  const on = targetSkills.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => toggleSkill(id)}
                      aria-pressed={on}
                      className={`h-10 px-3 rounded-lg border flex items-center gap-2.5 text-[13px] transition-all ${
                        on
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.7} className="shrink-0" />
                      <span className="flex-1 text-left">{id}</span>
                      {on && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional details */}
            <div className="border-t border-slate-200 pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center gap-3 py-4 text-left"
                aria-expanded={showAdvanced}
              >
                <Settings size={17} className="text-slate-600" strokeWidth={1.6} />
                <span className="text-[12px] font-semibold text-slate-900">
                  Additional Details <span className="font-normal text-slate-500 text-[12px]">(Optional)</span>
                </span>
                <span className="ml-auto text-slate-600">
                  {showAdvanced ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </span>
              </button>

              {showAdvanced && (
                <div className="bg-slate-50 rounded-2xl p-5 space-y-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-900 mb-1.5">Description / Learning Objectives</label>
                    <div className="flex items-start gap-3 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
                      <FileText size={17} className="text-slate-500 shrink-0 mt-0.5" strokeWidth={1.6} />
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary of what this worksheet assesses or teaches..."
                        className={`${inputCls} resize-y`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-900 mb-1.5">Teacher Name</label>
                    <div className={inputWrap}>
                      <User size={17} className="text-slate-500 shrink-0" strokeWidth={1.6} />
                      <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Lesson Title</label>
                      <div className={inputWrap}>
                        <input type="text" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="e.g. Endangered Animals" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">School Name</label>
                      <div className={inputWrap}>
                        <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Duration (minutes)</label>
                      <div className={inputWrap}>
                        <input type="number" value={estimatedDuration} onChange={(e) => setEstimatedDuration(parseInt(e.target.value, 10) || 45)} className={inputCls} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200">
              <button
                type="button"
                onClick={onCancel}
                className="h-10 px-5 text-[13px] font-medium text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-semibold flex items-center gap-2.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
              >
                <FolderPlus size={17} strokeWidth={1.7} />
                <span>{isEditing ? 'Save Changes' : 'Create Folder'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
