import React, { useState } from 'react';
import { AiRewriteBox } from '../shared/AiRewriteBox';
import { 
  Sparkles, ClipboardPaste, RotateCcw, ArrowRight, ArrowLeft, 
  CheckCircle2, AlertCircle, Layers, HelpCircle, Image as ImageIcon, 
  Check, Code, Edit3, Trash2, Plus, BookOpen, AlertTriangle
} from 'lucide-react';
import type { LessonFolder, Exercise, QuestionItem, ExerciseType, TemplateLayoutType } from '../../types';
import { 
  parseWorksheetText, 
  SAMPLE_SMART_PASTE_TEXT, 
  type ParseResult 
} from '../../services/smartPasteParser';
import { EXERCISE_REGISTRY } from '../../templates/registry';
import { TypeChooser } from './TypeChooser';
import { enrichExercise, stripSpecialized } from '../../services/smartPasteEnrich';
import { PRINT_TOKENS } from '../../tokens/printTokens';
import { AiImagePlanPanel, type AiPlanEditorState } from './AiImagePlanPanel';
import { analyzeWorksheetWithAI } from '../../services/ai/aiAnalyzer';
import {
  compareWithParser, planFromParser, applyPlanToExercises, DEFAULT_STYLE_SUFFIX,
} from '../../services/ai/imagePlanCompare';
import { planToJobs } from '../../services/ai/imageJobs';
import { imageJobStore, startImageJobs } from '../../services/ai/imageJobService';

interface SmartPasteScreenProps {
  folder: LessonFolder;
  onCancel: () => void;
  onConfirmImport: (newExercises: Exercise[]) => void;
}

export const SmartPasteScreen: React.FC<SmartPasteScreenProps> = ({
  folder,
  onCancel,
  onConfirmImport,
}) => {
  const [step, setStep] = useState<'input' | 'choose' | 'review'>('input');
  const [pasteText, setPasteText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI image plan (Gemini). Không thay thế luồng parser: chỉ bổ sung kế hoạch ảnh.
  const [aiState, setAiState] = useState<AiPlanEditorState | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [approved, setApproved] = useState<{
    plan: AiPlanEditorState['plan'];
    slotMap: Record<string, { exerciseId: string; slotId: string }>;
    excluded: Set<string>;
    referenceBySlot: Record<string, string[]>;
    style: string;
  } | null>(null);

  // Review state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [detectedExercises, setDetectedExercises] = useState<Exercise[]>([]);
  const [comparisonTab, setComparisonTab] = useState<'extracted' | 'source'>('extracted');
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(0);

  // 1. Paste from clipboard action
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPasteText(text);
          setErrorMsg(null);
        }
      } else {
        alert('Clipboard access not supported by browser. Please paste manually using Ctrl+V or Cmd+V.');
      }
    } catch {
      alert('Clipboard permission denied. Please paste directly into the box.');
    }
  };

  // 2. Insert sample text action
  const handleInsertSample = () => {
    setPasteText(SAMPLE_SMART_PASTE_TEXT);
    setErrorMsg(null);
  };

  // 3. Clear text action
  const handleClear = () => {
    setPasteText('');
    setErrorMsg(null);
  };

  // 4. Analyze & Build action
  const handleAnalyzeAndBuild = () => {
    if (!pasteText.trim()) {
      setErrorMsg('Please enter or paste English worksheet text to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    setTimeout(() => {
      try {
        const result = parseWorksheetText(pasteText);
        setParseResult(result);
        setDetectedExercises(result.worksheet.exercises);
        setActiveExerciseIndex(0);
        // Một bài: cho chọn dạng giống nhất trong menu Add Exercise rồi chuyển tới trình soạn. Nhiều bài: xem lại từng bài như cũ.
        setStep(result.worksheet.exercises.length <= 1 ? 'choose' : 'review');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to analyze worksheet content. Please check formatting.');
      } finally {
        setIsAnalyzing(false);
      }
    }, 400);
  };

  // 4b. Analyze with AI: Gemini -> kế hoạch ảnh; lỗi/không có Gemini -> dùng parser làm dự phòng
  const handleAnalyzeWithAI = async () => {
    if (!pasteText.trim()) {
      setErrorMsg('Please enter or paste English worksheet text to analyze.');
      return;
    }
    setIsAiAnalyzing(true);
    setErrorMsg(null);
    try {
      let parsed: ParseResult | null = null;
      try { parsed = parseWorksheetText(pasteText); } catch { /* parser lỗi: AI vẫn có thể phân tích */ }

      const outcome = await analyzeWorksheetWithAI(pasteText);
      if (outcome.ok && outcome.plan) {
        setAiState({
          plan: outcome.plan,
          diffs: parsed ? compareWithParser(outcome.plan, parsed.worksheet.exercises) : [],
          warnings: outcome.warnings,
          fromFallback: false,
          excluded: new Set(),
          referenceBySlot: {},
          style: DEFAULT_STYLE_SUFFIX,
        });
      } else if (parsed) {
        setAiState({
          plan: planFromParser(parsed.worksheet.exercises),
          diffs: [],
          warnings: [],
          fromFallback: true,
          fallbackReason: outcome.errorMessage || outcome.errorCode,
          excluded: new Set(),
          referenceBySlot: {},
          style: DEFAULT_STYLE_SUFFIX,
        });
      } else {
        setErrorMsg(`AI không dùng được (${outcome.errorMessage || outcome.errorCode}) và parser cũng không đọc được nội dung này.`);
      }
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // 4c. Giáo viên duyệt kế hoạch -> dựng đề bằng parser, áp kế hoạch lên ô ảnh
  const handleApprovePlan = () => {
    if (!aiState) return;
    try {
      const result = parseWorksheetText(pasteText);
      const namespace = `${folder.id.slice(-6)}${Date.now().toString(36)}`;
      const { exercises, slotMap } = applyPlanToExercises(aiState.plan, result.worksheet.exercises, namespace);
      setParseResult(result);
      setDetectedExercises(exercises);
      setActiveExerciseIndex(0);
      setApproved({
        plan: aiState.plan,
        slotMap,
        excluded: new Set(aiState.excluded),
        referenceBySlot: aiState.referenceBySlot,
        style: aiState.style,
      });
      setStep('review');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không dựng được đề từ kế hoạch này.');
    }
  };

  // Handlers for modifying detected exercises in review step
  const handleUpdateExercise = (exIdx: number, updated: Exercise) => {
    const updatedList = [...detectedExercises];
    updatedList[exIdx] = updated;
    setDetectedExercises(updatedList);
  };

  const handleUpdateQuestion = (exIdx: number, qIdx: number, updatedQ: QuestionItem) => {
    const ex = detectedExercises[exIdx];
    const newQuestions = [...ex.questions];
    newQuestions[qIdx] = updatedQ;
    handleUpdateExercise(exIdx, { ...ex, questions: newQuestions });
  };

  const handleAddImageSlot = (exIdx: number) => {
    const ex = detectedExercises[exIdx];
    const nextChar = String.fromCharCode(65 + ex.imageSlots.length);
    const newSlot = {
      slotId: `slot_${Date.now()}_${nextChar}`,
      exerciseId: ex.id,
      label: nextChar,
      widthMm: PRINT_TOKENS.imageSlots.matching.widthMm,
      heightMm: PRINT_TOKENS.imageSlots.matching.heightMm,
      aspectRatio: '4:3' as const,
      status: 'empty' as const,
      caption: `Picture ${nextChar}`,
    };
    handleUpdateExercise(exIdx, {
      ...ex,
      imageSlots: [...ex.imageSlots, newSlot],
      layoutType: ex.imageSlots.length === 0 ? 'template_c' : 'template_b',
    });
  };

  const handleRemoveImageSlot = (exIdx: number, slotIdx: number) => {
    const ex = detectedExercises[exIdx];
    const newSlots = ex.imageSlots.filter((_, idx) => idx !== slotIdx);
    handleUpdateExercise(exIdx, {
      ...ex,
      imageSlots: newSlots,
      layoutType: newSlots.length === 0 ? 'template_a' : ex.layoutType,
    });
  };

  // Confirm and Add to Folder
  const handleConfirmAndAdd = () => {
    // Number exercises starting after existing folder exercises count
    const baseOrder = folder.exercises.length;
    const reordered = detectedExercises.map((ex, idx) => ({
      ...ex,
      order: baseOrder + idx + 1,
    }));
    onConfirmImport(reordered);

    // Có kế hoạch AI đã duyệt: đổi thành job (chỉ cho các ô còn tồn tại sau bước review), chạy tuần tự, chống trùng
    if (approved) {
      const liveSlotIds = new Set(reordered.flatMap((ex) => ex.imageSlots.map((s) => s.slotId)));
      const slotMap = Object.fromEntries(Object.entries(approved.slotMap).filter(([, v]) => liveSlotIds.has(v.slotId)));
      const jobs = planToJobs({
        plan: approved.plan,
        worksheetId: folder.id,
        slotMap,
        referenceBySlot: approved.referenceBySlot,
        excluded: approved.excluded,
        style: approved.style,
      });
      if (jobs.length) {
        imageJobStore.addJobs(jobs);
        void startImageJobs();
      }
    }
  };

  // Metrics
  const charCount = pasteText.length;
  const wordCount = pasteText.trim() ? pasteText.trim().split(/\s+/).length : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 select-text">
      
      {/* Top Breadcrumb & Action Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={step !== 'input' ? () => setStep('input') : onCancel}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors mr-2"
          >
            <ArrowLeft size={13} /> {step !== 'input' ? 'Back to Paste Input' : `Back to ${folder.name}`}
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles size={14} className="text-blue-600" />
            Smart Paste into: <strong>{folder.name}</strong>
          </span>
        </div>

        {step === 'choose' && (
        <TypeChooser
          text={pasteText}
          detectedCount={detectedExercises.length}
          onReviewAll={() => setStep('review')}
          onPick={(type) => {
            const base = detectedExercises[0];
            if (!base) return;
            const ex = enrichExercise({ ...stripSpecialized(base), type }, pasteText);
            onConfirmImport([{ ...ex, type, order: folder.exercises.length + 1 }]);
          }}
        />
      )}

      {step === 'review' && (
          <button
            onClick={handleConfirmAndAdd}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Check size={14} />
            Confirm & Add {detectedExercises.length} Exercises to Folder
          </button>
        )}
      </div>

      {/* STEP 1: INPUT SCREEN */}
      {step === 'input' && (
        <div className="flex-1 flex flex-col p-6 overflow-hidden max-w-5xl w-full mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Smart Paste — Multi-Exercise Import
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Copy and paste your complete worksheet text. Exercise boundaries, 15 types and choices are detected automatically.
              </p>
            </div>

            <div className="text-xs text-slate-400 font-medium flex items-center gap-3">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePasteFromClipboard}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <ClipboardPaste size={14} className="text-blue-600" />
                Paste from Clipboard
              </button>

              <button
                onClick={handleInsertSample}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <BookOpen size={13} className="text-slate-500" />
                Insert Sample Test
              </button>

              <button
                onClick={handleClear}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:text-rose-600 text-slate-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <RotateCcw size={13} />
                Clear
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {aiState ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AiImagePlanPanel
                state={aiState}
                onChange={setAiState}
                onApprove={handleApprovePlan}
                onDiscard={() => { setAiState(null); setApproved(null); }}
              />
            </div>
          ) : (
            <>
          {/* Paste Textarea */}
          <div className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your entire English worksheet or exam here...

Example format:
• Exercise 1: Choose the correct answer A, B, C or D
• Exercise 2: Reading passage with True / False / Not Given
• Exercise 3: Matching sentences with pictures A–E
• Exercise 4: Gap filling with Word Bank [word1, word2...]
• Explicit ANSWER KEY at the bottom..."
              className="w-full flex-1 p-6 text-sm text-slate-800 leading-relaxed font-mono resize-none focus:outline-none overflow-y-auto"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
          <AiRewriteBox kind="Cả đề nhiều bài (Smart Paste)" hint="Cả đề gồm nhiều bài. Mỗi bài bắt đầu bằng dòng 'Exercise N: <hướng dẫn của bài>' rồi đến nội dung (câu hỏi đánh số, lựa chọn a./b./c., chỗ trống ______, khung từ). Đáp án nếu có để cuối đề dưới dòng ANSWER KEY. Có thể có phần đầu đề: trường, Unit, thời gian, tổng điểm." example={'Unit 2 – London   Time: 45 min   Total: 20 points\n\nExercise 1: Choose the correct answer A, B or C.\n1. What is the capital of England?\nA. Paris  B. London  C. Rome\n\nExercise 2: Complete the sentences with the words from the box.\nbig   red   fast\n1. The bus is ______.\n\nANSWER KEY\n1. B'} text={pasteText} onText={setPasteText} />

            </>
          )}

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-2 shrink-0">
            <p className="text-[11px] text-slate-400">
              Pasted text is preserved intact. Analysis converts exercises into print-ready A4 formats without losing questions.
            </p>

            <div className="flex items-center gap-2">
            <button
              onClick={handleAnalyzeWithAI}
              disabled={isAiAnalyzing || isAnalyzing || !pasteText.trim()}
              className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all active:scale-95 ${
                pasteText.trim() && !isAiAnalyzing
                  ? 'bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Gemini đọc cả đề, đề xuất số ảnh và prompt cho từng ảnh (bạn duyệt trước khi tạo)"
            >
              {isAiAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span>AI đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Analyze with AI</span>
                </>
              )}
            </button>
            <button
              onClick={handleAnalyzeAndBuild}
              disabled={isAnalyzing || !pasteText.trim()}
              className={`px-6 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                pasteText.trim() && !isAnalyzing
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing & Detecting Exercises...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Analyze & Build Worksheet</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: TEACHER REVIEW SCREEN */}
      {step === 'review' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          
          {/* Review Header Stats Bar */}
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700">
                <Layers size={13} />
                <span>{detectedExercises.length} Exercises Detected</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                <HelpCircle size={13} />
                <span>
                  {detectedExercises.reduce((s, e) => s + e.questions.length, 0)} Questions
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-700">
                <ImageIcon size={13} />
                <span>
                  {detectedExercises.reduce((s, e) => s + e.imageSlots.length, 0)} Image Slots
                </span>
              </div>

              {parseResult?.warnings && parseResult.warnings.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                  <AlertTriangle size={13} />
                  <span>{parseResult.warnings.length} Note(s)</span>
                </div>
              )}
            </div>

            {/* Toggle Structured Review vs Original Source */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setComparisonTab('extracted')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  comparisonTab === 'extracted'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 size={13} />
                Structured Review
              </button>
              <button
                onClick={() => setComparisonTab('source')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  comparisonTab === 'source'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Code size={13} />
                Original Source Text
              </button>
            </div>
          </div>

          {/* TAB: Extracted Structured Review */}
          {comparisonTab === 'extracted' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Exercise Navigation List */}
              <div className="w-72 border-r border-slate-200 bg-white p-4 overflow-y-auto space-y-2 shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Detected Exercises ({detectedExercises.length})
                </p>

                {detectedExercises.map((ex, idx) => {
                  const isSelected = activeExerciseIndex === idx;
                  const meta = EXERCISE_REGISTRY[ex.type];
                  return (
                    <div
                      key={ex.id}
                      onClick={() => setActiveExerciseIndex(idx)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 shadow-2xs ring-1 ring-blue-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-600 uppercase">
                          #{idx + 1} · {meta?.category || 'General'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {ex.questions.length} Qs
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                        {ex.title || `Exercise ${idx + 1}`}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {meta?.label || ex.type}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right: Active Exercise Review Card */}
              <div className="flex-1 p-6 overflow-y-auto space-y-5">
                {detectedExercises[activeExerciseIndex] && (() => {
                  const currentEx = detectedExercises[activeExerciseIndex];
                  return (
                    <div className="space-y-5 max-w-4xl">
                      {/* Title, Type, and Layout row */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Edit3 size={14} className="text-blue-600" />
                            Exercise #{activeExerciseIndex + 1} Configuration
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {currentEx.questions.length} Questions · {currentEx.imageSlots.length} Image Slots
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                          {/* Title */}
                          <div className="col-span-8">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Exercise Title
                            </label>
                            <input
                              type="text"
                              value={currentEx.title}
                              onChange={(e) =>
                                handleUpdateExercise(activeExerciseIndex, {
                                  ...currentEx,
                                  title: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                            />
                          </div>

                          {/* Exercise Format */}
                          <div className="col-span-4">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Exercise Format
                            </label>
                            <select
                              value={currentEx.type}
                              onChange={(e) =>
                                handleUpdateExercise(activeExerciseIndex, {
                                  ...currentEx,
                                  type: e.target.value as ExerciseType,
                                })
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                            >
                              {Object.entries(EXERCISE_REGISTRY).map(([typeKey, meta]) => (
                                <option key={typeKey} value={typeKey}>
                                  {meta.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Student Instructions */}
                          <div className="col-span-12">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Student Instructions
                            </label>
                            <input
                              type="text"
                              value={currentEx.instructions}
                              onChange={(e) =>
                                handleUpdateExercise(activeExerciseIndex, {
                                  ...currentEx,
                                  instructions: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs italic text-slate-800"
                            />
                          </div>

                          {/* Proposed A4 Print Layout */}
                          <div className="col-span-12">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Proposed A4 Print Layout Template
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                              {(
                                [
                                  { id: 'template_a', label: 'Text Only' },
                                  { id: 'template_b', label: 'Text + Images' },
                                  { id: 'template_c', label: 'Single Image' },
                                  { id: 'template_d', label: 'Two Columns' },
                                  { id: 'template_e', label: 'Image + Table' },
                                ] as Array<{ id: TemplateLayoutType; label: string }>
                              ).map((tmpl) => (
                                <button
                                  key={tmpl.id}
                                  onClick={() =>
                                    handleUpdateExercise(activeExerciseIndex, {
                                      ...currentEx,
                                      layoutType: tmpl.id,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all ${
                                    currentEx.layoutType === tmpl.id
                                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-2xs'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {tmpl.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reading Passage if detected */}
                      {currentEx.passage && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                          <label className="block text-[11px] font-bold text-slate-600 uppercase">
                            Reading Passage ({currentEx.passage.length} characters)
                          </label>
                          <textarea
                            rows={5}
                            value={currentEx.passage}
                            onChange={(e) =>
                              handleUpdateExercise(activeExerciseIndex, {
                                ...currentEx,
                                passage: e.target.value,
                              })
                            }
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800 font-sans"
                          />
                        </div>
                      )}

                      {/* Inferred Image Slots */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                            <ImageIcon size={14} className="text-blue-600" />
                            Image Placeholders ({currentEx.imageSlots.length})
                          </span>
                          <button
                            onClick={() => handleAddImageSlot(activeExerciseIndex)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1"
                          >
                            <Plus size={12} /> Add Slot
                          </button>
                        </div>

                        {currentEx.imageSlots.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No image slots inferred for this exercise.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {currentEx.imageSlots.map((slot, sIdx) => (
                              <div
                                key={slot.slotId}
                                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-800">
                                    Picture {slot.label || sIdx + 1}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {slot.widthMm} × {slot.heightMm} mm
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleRemoveImageSlot(activeExerciseIndex, sIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Questions */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                            <HelpCircle size={14} className="text-blue-600" />
                            Extracted Questions ({currentEx.questions.length})
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Verify extracted text
                          </span>
                        </div>

                        <div className="space-y-3">
                          {currentEx.questions.map((q, qIdx) => (
                            <div
                              key={q.id}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {q.number || qIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={q.text}
                                  onChange={(e) =>
                                    handleUpdateQuestion(activeExerciseIndex, qIdx, {
                                      ...q,
                                      text: e.target.value,
                                    })
                                  }
                                  className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                                />
                              </div>

                              {/* Choices if present */}
                              {q.options && q.options.length > 0 && (
                                <div className="pl-7 grid grid-cols-2 gap-2">
                                  {q.options.map((opt, optIdx) => (
                                    <div key={opt.id} className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500 w-4">
                                        {opt.label}.
                                      </span>
                                      <input
                                        type="text"
                                        value={opt.text}
                                        onChange={(e) => {
                                          const newOpts = [...(q.options || [])];
                                          newOpts[optIdx] = { ...newOpts[optIdx], text: e.target.value };
                                          handleUpdateQuestion(activeExerciseIndex, qIdx, {
                                            ...q,
                                            options: newOpts,
                                          });
                                        }}
                                        className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB: Original Source Comparison */}
          {comparisonTab === 'source' && (
            <div className="flex-1 p-6 overflow-hidden flex flex-col bg-white">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Raw Pasted Content (Preserved for recovery)
                </span>
                <span className="text-xs text-slate-400">
                  Read-only original copy
                </span>
              </div>
              <div className="flex-1 min-h-0 pt-3">
                <pre className="w-full h-full p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-auto leading-relaxed whitespace-pre-wrap">
                  {pasteText}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
