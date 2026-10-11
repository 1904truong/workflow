import React, { useState } from 'react';
import { 
  FolderPlus, ChevronDown, ChevronUp, ArrowLeft, Check
} from 'lucide-react';
import type { LessonFolder } from '../../types';
import { DEFAULT_SAMPLE_WORKSHEET } from '../../services/sampleWorksheets';

interface CreateFolderScreenProps {
  initialFolder?: LessonFolder | null;
  onSave: (folderData: Partial<LessonFolder>) => void;
  onCancel: () => void;
}

export const CreateFolderScreen: React.FC<CreateFolderScreenProps> = ({
  initialFolder,
  onSave,
  onCancel,
}) => {
  const isEditing = !!initialFolder;

  // Form State
  const [name, setName] = useState(initialFolder?.name || '');
  const [gradeLevel, setGradeLevel] = useState(initialFolder?.gradeLevel || 'Grade 7');
  const [subject, setSubject] = useState(initialFolder?.subject || 'English');

  // Optional Advanced Fields
  const [showAdvanced, setShowAdvanced] = useState(!!initialFolder?.unitTopic || !!initialFolder?.description);
  const [unitTopic, setUnitTopic] = useState(initialFolder?.unitTopic || '');
  const [lessonTitle, setLessonTitle] = useState(initialFolder?.lessonTitle || '');
  const [description, setDescription] = useState(initialFolder?.description || '');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(initialFolder?.estimatedDuration || 45);
  const [targetSkills, setTargetSkills] = useState<string[]>(initialFolder?.targetSkills || ['Reading', 'Vocabulary']);
  const [schoolName, setSchoolName] = useState(initialFolder?.schoolName || 'Cambridge International Academy');
  const [teacherName, setTeacherName] = useState(initialFolder?.teacherName || 'Sarah Jenkins');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableSkills = ['Reading', 'Listening', 'Writing', 'Grammar', 'Vocabulary', 'Speaking'];
  const gradeOptions = [
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    'Level A1', 'Level A2', 'Level B1', 'Level B2', 'Level C1'
  ];

  const toggleSkill = (skill: string) => {
    setTargetSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a folder name (e.g. "Unit 5: Nature & Environment").');
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
      <div className="max-w-2xl w-full mx-auto space-y-6">
        
        {/* Back navigation */}
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Lesson Folders
        </button>

        {/* Card Container */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FolderPlus size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Lesson Folder Details' : 'Create New Lesson Folder'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Each folder organizes an ordered sequence of exercises into a unified printable worksheet.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Folder Name (Required) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Folder Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="e.g. Unit 5: Nature & Environment"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                autoFocus
              />
            </div>

            {/* Grade Level & Subject (Required) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Grade Level <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {gradeOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Expandable Advanced Details */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 py-1"
              >
                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                <span>{showAdvanced ? 'Hide Optional Details' : 'Show Optional Details (Topic, Duration, Skills...)'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Unit / Topic
                      </label>
                      <input
                        type="text"
                        value={unitTopic}
                        onChange={(e) => setUnitTopic(e.target.value)}
                        placeholder="e.g. Biodiversity & Habitats"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Lesson Title
                      </label>
                      <input
                        type="text"
                        value={lessonTitle}
                        onChange={(e) => setLessonTitle(e.target.value)}
                        placeholder="e.g. Endangered Animals"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Description / Learning Objectives
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief summary of what this worksheet assesses or teaches..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none"
                    />
                  </div>

                  {/* Duration & Skills */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        value={estimatedDuration}
                        onChange={(e) => setEstimatedDuration(parseInt(e.target.value, 10) || 45)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Target Skills
                      </label>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {availableSkills.map((sk) => {
                          const isSelected = targetSkills.includes(sk);
                          return (
                            <button
                              type="button"
                              key={sk}
                              onClick={() => toggleSkill(sk)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {sk}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* School & Teacher */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        School Name
                      </label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Teacher Name
                      </label>
                      <input
                        type="text"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
              >
                <Check size={14} />
                <span>{isEditing ? 'Save Changes' : 'Create Folder'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
