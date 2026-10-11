import { useState, useEffect, useRef } from 'react';
import { 
  FileText, ListChecks, Edit3, KeyRound, Image as ImageIcon, 
  Printer, Check, RefreshCw, Sparkles
} from 'lucide-react';
import type { Worksheet, Exercise, ExerciseType } from './types';
import { DEFAULT_SAMPLE_WORKSHEET } from './services/sampleWorksheets';
import { worksheetStorage } from './services/storageService';
import { ActiveExerciseBar } from './components/shared/ActiveExerciseBar';
import { DocumentSettingsTab } from './components/tabs/DocumentSettingsTab';
import { ExercisesTab } from './components/tabs/ExercisesTab';
import { ContentEditorTab } from './components/tabs/ContentEditorTab';
import { AnswerKeyTab } from './components/tabs/AnswerKeyTab';
import { ImageManagerTab } from './components/tabs/ImageManagerTab';
import { PreviewExportTab } from './components/tabs/PreviewExportTab';
import { ExerciseTypePickerModal } from './components/tabs/ExerciseTypePickerModal';
import { SmartPasteModal } from './components/smart-paste/SmartPasteModal';
import { EXERCISE_REGISTRY } from './templates/registry';
import './components/toolbar/PrintStyles.css';

export type BuilderTab = 
  | 'settings' 
  | 'exercises' 
  | 'editor' 
  | 'answer_key' 
  | 'images' 
  | 'preview';

interface WorksheetBuilderAppProps {
  initialTab?: BuilderTab;
  currentWorksheet?: Worksheet;
  onWorksheetUpdated?: (worksheet: Worksheet) => void;
}

export const WorksheetBuilderApp: React.FC<WorksheetBuilderAppProps> = ({
  initialTab = 'settings',
  currentWorksheet,
  onWorksheetUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<BuilderTab>(initialTab);
  const [worksheet, setWorksheet] = useState<Worksheet>(currentWorksheet || DEFAULT_SAMPLE_WORKSHEET);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(
    (currentWorksheet || DEFAULT_SAMPLE_WORKSHEET).exercises[0]?.id || null
  );
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isTypePickerOpen, setIsTypePickerOpen] = useState<boolean>(false);
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState<boolean>(false);
  const autosaveTimerRef = useRef<any>(null);

  // Sync initialTab if changed from parent
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Sync worksheet if changed from parent
  useEffect(() => {
    if (currentWorksheet) {
      setWorksheet(currentWorksheet);
      setActiveExerciseId(currentWorksheet.exercises[0]?.id || null);
    }
  }, [currentWorksheet]);

  // Load worksheet from storage or fallback to default
  useEffect(() => {
    if (currentWorksheet) return;
    const loadSaved = async () => {
      const activeId = worksheetStorage.getActiveWorksheetId();
      if (activeId) {
        const saved = await worksheetStorage.getWorksheet(activeId);
        if (saved) {
          setWorksheet(saved);
          setActiveExerciseId(saved.exercises[0]?.id || null);
          return;
        }
      }
      await worksheetStorage.saveWorksheet(DEFAULT_SAMPLE_WORKSHEET);
    };
    loadSaved();
  }, [currentWorksheet]);

  // Debounced Autosave (800ms)
  const triggerAutosave = (updatedWorksheet: Worksheet) => {
    setSaveStatus('saving');
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(async () => {
      await worksheetStorage.saveWorksheet(updatedWorksheet);
      setSaveStatus('saved');
      if (onWorksheetUpdated) {
        onWorksheetUpdated(updatedWorksheet);
      }
    }, 800);
  };

  const updateWorksheet = (updater: (prev: Worksheet) => Worksheet) => {
    setWorksheet((prev) => {
      const next = updater(prev);
      triggerAutosave(next);
      return next;
    });
  };

  // Update metadata
  const handleUpdateMetadata = (field: keyof Worksheet, value: any) => {
    updateWorksheet((prev) => ({ ...prev, [field]: value }));
  };

  // Update print settings
  const handleUpdatePrintSettings = (key: string, value: any) => {
    updateWorksheet((prev) => ({
      ...prev,
      printSettings: { ...prev.printSettings, [key]: value },
    }));
  };

  // Add new exercise with chosen exercise type
  const handleAddExerciseWithType = (type: ExerciseType) => {
    const reg = EXERCISE_REGISTRY[type];
    const newId = `ex_${Date.now()}`;
    const newOrder = worksheet.exercises.length + 1;

    const newExercise: Exercise = {
      id: newId,
      type,
      layoutType: reg?.defaultTemplate || 'template_a',
      title: `Exercise ${newOrder}: ${reg?.label || 'New Exercise'}`,
      instructions: reg?.description || 'Answer the questions according to the instructions.',
      pointsTotal: 10,
      order: newOrder,
      imageSlots: [],
      questions: [
        {
          id: `q_${Date.now()}_1`,
          number: 1,
          text: 'Complete the sentence: English is ________ useful language.',
          options: [
            { id: 'opt_1', label: 'A', text: 'a' },
            { id: 'opt_2', label: 'B', text: 'an' },
            { id: 'opt_3', label: 'C', text: 'the' },
            { id: 'opt_4', label: 'D', text: '–' },
          ],
          correctAnswer: 'A',
          points: 1,
        },
      ],
    };

    updateWorksheet((prev) => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));
    setActiveExerciseId(newId);
    setIsTypePickerOpen(false);
    setActiveTab('editor');
  };

  // Duplicate exercise
  const handleDuplicateExercise = (id: string) => {
    const target = worksheet.exercises.find((ex) => ex.id === id);
    if (!target) return;

    const duplicatedId = `ex_${Date.now()}`;
    const duplicated: Exercise = {
      ...target,
      id: duplicatedId,
      title: `${target.title} (Copy)`,
      questions: target.questions.map((q, idx) => ({
        ...q,
        id: `q_${Date.now()}_${idx}`,
      })),
      imageSlots: target.imageSlots.map((s, idx) => ({
        ...s,
        slotId: `slot_${Date.now()}_${idx}`,
        exerciseId: duplicatedId,
      })),
    };

    updateWorksheet((prev) => ({
      ...prev,
      exercises: [...prev.exercises, duplicated],
    }));
    setActiveExerciseId(duplicatedId);
  };

  // Delete exercise
  const handleDeleteExercise = (id: string) => {
    if (worksheet.exercises.length <= 1) {
      alert('A worksheet must contain at least one exercise.');
      return;
    }
    updateWorksheet((prev) => {
      const remaining = prev.exercises.filter((ex) => ex.id !== id);
      if (activeExerciseId === id) {
        setActiveExerciseId(remaining[0]?.id || null);
      }
      return { ...prev, exercises: remaining };
    });
  };

  // Move exercise up/down
  const handleMoveExercise = (id: string, direction: 'up' | 'down') => {
    const index = worksheet.exercises.findIndex((ex) => ex.id === id);
    if (index < 0) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === worksheet.exercises.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...worksheet.exercises];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    updateWorksheet((prev) => ({ ...prev, exercises: reordered }));
  };

  // Update single exercise content
  const handleUpdateExercise = (updated: Exercise) => {
    updateWorksheet((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => (ex.id === updated.id ? updated : ex)),
    }));
  };

  // Reset to default sample
  const handleResetSample = () => {
    if (confirm('Reset worksheet to default Cambridge English sample?')) {
      setWorksheet(DEFAULT_SAMPLE_WORKSHEET);
      setActiveExerciseId(DEFAULT_SAMPLE_WORKSHEET.exercises[0].id);
      triggerAutosave(DEFAULT_SAMPLE_WORKSHEET);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(worksheet, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${worksheet.title.replace(/\s+/g, '_')}_A4.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Handle worksheet created via Smart Paste
  const handleSmartPasteCreated = (imported: Worksheet) => {
    setWorksheet(imported);
    setActiveExerciseId(imported.exercises[0]?.id || null);
    triggerAutosave(imported);
    setIsSmartPasteOpen(false);
    setActiveTab('editor');
  };

  // Resolve currently active exercise
  const activeExercise =
    worksheet.exercises.find((ex) => ex.id === activeExerciseId) ||
    worksheet.exercises[0] ||
    null;

  // Tabs configuration
  const tabList = [
    { id: 'settings' as const, label: 'Document Settings', step: '1', icon: FileText },
    { id: 'exercises' as const, label: 'Exercises', step: '2', icon: ListChecks, badge: worksheet.exercises.length },
    { id: 'editor' as const, label: 'Content Editor', step: '3', icon: Edit3 },
    { id: 'answer_key' as const, label: 'Answer Key', step: '4', icon: KeyRound },
    { id: 'images' as const, label: 'Image Manager', step: '5', icon: ImageIcon },
    { id: 'preview' as const, label: 'Preview & Export', step: '6', icon: Printer },
  ];

  // Exercises dropdown bar shown on exercise-centric tabs
  const showActiveExerciseBar = activeTab === 'editor' || activeTab === 'answer_key' || activeTab === 'images';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden select-text worksheet-builder-main">
      {/* Primary Builder Tabs Navigation Bar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
        {/* Left: Tab list */}
        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1">
          {tabList.map((t) => {
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-500/20 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {t.step}
                </span>
                <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Smart Paste Action & Autosave Status Badge */}
        <div className="flex items-center gap-3 shrink-0 pl-4 border-l border-slate-100">
          <button
            onClick={() => setIsSmartPasteOpen(true)}
            className="px-3 py-1.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
            title="Import an entire exam via Smart Paste"
          >
            <Sparkles size={13} />
            <span>Smart Paste</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-medium">
            {saveStatus === 'saved' && (
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1">
                <Check size={12} className="text-emerald-600" />
                <span className="hidden sm:inline">Autosaved</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 animate-pulse">
                <RefreshCw size={11} className="animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Header: Active Exercise Bar (Contextual for editor, answer key, images) */}
      {showActiveExerciseBar && (
        <ActiveExerciseBar
          worksheet={worksheet}
          activeExerciseId={activeExerciseId}
          onSelectExercise={setActiveExerciseId}
          onAddExercise={() => setIsTypePickerOpen(true)}
        />
      )}

      {/* Tab Panels: ONLY render the currently active tab (No simultaneous cluttered forms) */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'settings' && (
          <DocumentSettingsTab
            worksheet={worksheet}
            onUpdateMetadata={handleUpdateMetadata}
            onUpdatePrintSettings={handleUpdatePrintSettings}
            onNavigateToExercises={() => setActiveTab('exercises')}
          />
        )}

        {activeTab === 'exercises' && (
          <ExercisesTab
            worksheet={worksheet}
            activeExerciseId={activeExerciseId}
            onSelectExercise={setActiveExerciseId}
            onAddExerciseWithType={handleAddExerciseWithType}
            onDuplicateExercise={handleDuplicateExercise}
            onDeleteExercise={handleDeleteExercise}
            onMoveExercise={handleMoveExercise}
            onNavigateToContent={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'editor' && (
          <ContentEditorTab
            exercise={activeExercise}
            onUpdateExercise={handleUpdateExercise}
            onNavigateToAnswerKey={() => setActiveTab('answer_key')}
            onNavigateToImages={() => setActiveTab('images')}
          />
        )}

        {activeTab === 'answer_key' && (
          <AnswerKeyTab
            exercise={activeExercise}
            onUpdateExercise={handleUpdateExercise}
            onNavigateToImages={() => setActiveTab('images')}
            onNavigateToPreview={() => setActiveTab('preview')}
          />
        )}

        {activeTab === 'images' && (
          <ImageManagerTab
            exercise={activeExercise}
            onUpdateExercise={handleUpdateExercise}
            onNavigateToPreview={() => setActiveTab('preview')}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewExportTab
            worksheet={worksheet}
            onUpdatePrintSettings={handleUpdatePrintSettings}
            onResetSample={handleResetSample}
            onExportJson={handleExportJson}
          />
        )}
      </div>

      {/* Exercise Type Picker Modal */}
      <ExerciseTypePickerModal
        isOpen={isTypePickerOpen}
        onClose={() => setIsTypePickerOpen(false)}
        onSelectType={handleAddExerciseWithType}
      />

      {/* Smart Paste Modal */}
      <SmartPasteModal
        isOpen={isSmartPasteOpen}
        onClose={() => setIsSmartPasteOpen(false)}
        onWorksheetCreated={handleSmartPasteCreated}
      />
    </div>
  );
};
