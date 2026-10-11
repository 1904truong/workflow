import React, { useState, useMemo } from 'react';
import { 
  Folder, Plus, Search, Grid, List, MoreVertical, Clock, 
  Award, Layers, Copy, Trash2, Edit3, ArrowRight, FileText
} from 'lucide-react';
import type { LessonFolder } from '../../types';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { folderToWorksheet } from '../../types';

interface LessonFoldersScreenProps {
  folders: LessonFolder[];
  onOpenFolder: (folderId: string) => void;
  onCreateNewFolder: () => void;
  onDuplicateFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onEditFolderInfo: (folder: LessonFolder) => void;
}

export const LessonFoldersScreen: React.FC<LessonFoldersScreenProps> = ({
  folders,
  onOpenFolder,
  onCreateNewFolder,
  onDuplicateFolder,
  onDeleteFolder,
  onEditFolderInfo,
}) => {
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filter & Sort
  const filteredFolders = useMemo(() => {
    return folders
      .filter((f) => {
        const matchesSearch =
          search.trim() === '' ||
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          (f.unitTopic && f.unitTopic.toLowerCase().includes(search.toLowerCase())) ||
          (f.lessonTitle && f.lessonTitle.toLowerCase().includes(search.toLowerCase())) ||
          (f.description && f.description.toLowerCase().includes(search.toLowerCase()));

        const matchesGrade =
          selectedGrade === 'All' ||
          f.gradeLevel.toLowerCase().includes(selectedGrade.toLowerCase());

        return matchesSearch && matchesGrade;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.updatedAt - a.updatedAt;
        if (sortBy === 'oldest') return a.updatedAt - b.updatedAt;
        return a.name.localeCompare(b.name);
      });
  }, [folders, search, selectedGrade, sortBy]);

  const grades = ['All', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

  const handleExportQuick = (folder: LessonFolder, mode: 'student' | 'teacher_key') => {
    const ws = folderToWorksheet(folder);
    exportWorksheetToDocx(ws, mode);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Folder size={22} className="text-blue-600" />
              Lesson Folders
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Organize multi-exercise lesson units, tests, and print-ready A4 worksheets.
            </p>
          </div>

          <button
            onClick={onCreateNewFolder}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus size={15} />
            <span>Create New Folder</span>
          </button>
        </div>

        {/* Filter & Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by folder name, topic, or lesson..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
            />
          </div>

          {/* Grade Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {grades.map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedGrade === grade
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>

          {/* Sort & Grid/List view toggle */}
          <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="az">Alphabetical (A–Z)</option>
            </select>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Grid view"
              >
                <Grid size={13} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="List view"
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {filteredFolders.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Folder size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Lesson Folders Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
              {search || selectedGrade !== 'All'
                ? `No folders match your current filter criteria.`
                : `Create your first lesson folder to begin building or importing worksheets.`}
            </p>
            <button
              onClick={onCreateNewFolder}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
            >
              <Plus size={14} /> Create First Folder
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map((folder) => {
              const exercisesCount = folder.exercises.length;
              const totalQuestions = folder.exercises.reduce((s, e) => s + e.questions.length, 0);

              return (
                <div
                  key={folder.id}
                  className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/5 rounded-2xl p-5 transition-all flex flex-col justify-between group relative"
                >
                  <div>
                    {/* Top Meta & Overflow Action */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Folder size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                            {folder.gradeLevel}
                          </span>
                          {folder.unitTopic && (
                            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                              {folder.unitTopic}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Overflow Menu */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {activeMenuId === folder.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 text-xs font-semibold"
                          >
                            <button
                              onClick={() => {
                                onOpenFolder(folder.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <ArrowRight size={13} className="text-blue-600" /> Open Folder
                            </button>
                            <button
                              onClick={() => {
                                onEditFolderInfo(folder);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Edit3 size={13} className="text-slate-400" /> Edit Details
                            </button>
                            <button
                              onClick={() => {
                                onDuplicateFolder(folder.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Copy size={13} className="text-slate-400" /> Duplicate
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => {
                                handleExportQuick(folder, 'student');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <FileText size={13} className="text-blue-600" /> Export Student DOCX
                            </button>
                            <button
                              onClick={() => {
                                handleExportQuick(folder, 'teacher_key');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Award size={13} className="text-rose-600" /> Export Teacher Key
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => {
                                onDeleteFolder(folder.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                            >
                              <Trash2 size={13} /> Delete Folder
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Folder Title & Description */}
                    <h3
                      onClick={() => onOpenFolder(folder.id)}
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer line-clamp-1"
                    >
                      {folder.name}
                    </h3>
                    {folder.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {folder.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Stats & Open Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Layers size={13} className="text-blue-500" />
                        {exercisesCount} Ex ({totalQuestions} Qs)
                      </span>
                      {folder.estimatedDuration && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock size={12} className="text-slate-400" />
                          {folder.estimatedDuration}m
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onOpenFolder(folder.id)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      Open <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {filteredFolders.map((folder) => {
              const exercisesCount = folder.exercises.length;
              const totalQuestions = folder.exercises.reduce((s, e) => s + e.questions.length, 0);

              return (
                <div
                  key={folder.id}
                  onClick={() => onOpenFolder(folder.id)}
                  className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Folder size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 uppercase">
                          {folder.gradeLevel}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate">{folder.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {folder.unitTopic || folder.lessonTitle || 'Standard English Unit'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Layers size={13} className="text-blue-500" />
                      {exercisesCount} Exercises ({totalQuestions} Questions)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFolder(folder.id);
                      }}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                      Open <ArrowRight size={12} />
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
