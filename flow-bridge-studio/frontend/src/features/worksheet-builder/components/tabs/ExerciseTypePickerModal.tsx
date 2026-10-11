import React, { useState, useMemo } from 'react';
import { X, Search, Headphones, BookOpen, PenTool, CheckCircle, Sparkles } from 'lucide-react';
import type { ExerciseType } from '../../types';
import { EXERCISE_REGISTRY, TEMPLATE_METADATA } from '../../templates/registry';

interface ExerciseTypePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: ExerciseType) => void;
}

export const ExerciseTypePickerModal: React.FC<ExerciseTypePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All (15)' },
    { id: 'Listening', label: 'Listening (4)', icon: Headphones },
    { id: 'Reading', label: 'Reading (5)', icon: BookOpen },
    { id: 'Grammar & Vocab', label: 'Grammar & Vocab (4)', icon: Sparkles },
    { id: 'Writing', label: 'Writing (2)', icon: PenTool },
  ];

  const filteredTypes = useMemo(() => {
    return Object.values(EXERCISE_REGISTRY).filter((meta) => {
      const matchCategory = selectedCategory === 'all' || meta.category === selectedCategory;
      const matchSearch =
        search.trim() === '' ||
        meta.label.toLowerCase().includes(search.toLowerCase()) ||
        meta.description.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [search, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={18} className="text-blue-600" />
              Choose Exercise Type
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select one of the 15 standard English exercise types to add to your worksheet.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercise types (e.g. gap fill, matching, reading)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              autoFocus
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {filteredTypes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No exercise types match your filter &ldquo;{search}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTypes.map((meta) => {
                const layoutInfo = TEMPLATE_METADATA[meta.defaultTemplate];
                return (
                  <button
                    key={meta.type}
                    onClick={() => onSelectType(meta.type)}
                    className="group text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            meta.category === 'Listening'
                              ? 'bg-purple-100 text-purple-700'
                              : meta.category === 'Reading'
                              ? 'bg-emerald-100 text-emerald-700'
                              : meta.category === 'Writing'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {meta.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {layoutInfo?.name.split('—')[1] || meta.defaultTemplate}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {meta.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {meta.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Default slots: {meta.defaultSlotsCount}</span>
                      <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Select <CheckCircle size={11} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
