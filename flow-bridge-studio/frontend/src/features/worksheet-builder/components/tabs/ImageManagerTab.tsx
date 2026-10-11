import React, { useRef, useState } from 'react';
import { 
  Image as ImageIcon, Plus, Trash2, Upload, Sparkles, 
  Check, ArrowRight, Info
} from 'lucide-react';
import type { Exercise, ImageSlot } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface ImageManagerTabProps {
  exercise: Exercise | null;
  onUpdateExercise: (exercise: Exercise) => void;
  onNavigateToPreview: () => void;
}

export const ImageManagerTab: React.FC<ImageManagerTabProps> = ({
  exercise,
  onUpdateExercise,
  onNavigateToPreview,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotIndexRef = useRef<number | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  if (!exercise) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <ImageIcon size={48} className="stroke-1 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-600">No exercise selected</p>
        <p className="text-xs text-slate-400 mt-1">Please select an exercise to manage its images.</p>
      </div>
    );
  }

  const slots = exercise.imageSlots || [];

  const handleAddSlot = () => {
    const nextLabel = String.fromCharCode(65 + slots.length); // A, B, C...
    const newSlot: ImageSlot = {
      slotId: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: exercise.id,
      label: nextLabel,
      widthMm: 72,
      heightMm: 54,
      aspectRatio: '4:3',
      caption: '',
      status: 'empty',
      fitMode: 'contain',
    };
    onUpdateExercise({
      ...exercise,
      imageSlots: [...slots, newSlot],
    });
  };

  const handleRemoveSlot = (index: number) => {
    const updated = slots.filter((_, idx) => idx !== index);
    onUpdateExercise({ ...exercise, imageSlots: updated });
  };

  const handleUpdateSlotField = (index: number, field: keyof ImageSlot, value: any) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    onUpdateExercise({ ...exercise, imageSlots: updated });
  };

  const triggerUpload = (index: number) => {
    activeSlotIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIndex = activeSlotIndexRef.current;
    if (!file || targetIndex === null || !slots[targetIndex]) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const updated = [...slots];
        updated[targetIndex] = {
          ...updated[targetIndex],
          assetUrl: event.target.result as string,
          status: 'assigned',
          caption: updated[targetIndex].caption || file.name.replace(/\.[^/.]+$/, ''),
        };
        onUpdateExercise({ ...exercise, imageSlots: updated });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const generatePromptForSlot = (slot: ImageSlot, idx: number): string => {
    const context = exercise.title + ' — ' + (slot.caption || `Item ${slot.label || idx + 1}`);
    return `Clean, high-contrast, black and white minimalist line art illustration for an English worksheet. Subject: ${context}. White background, clear outlines, educational style, print-ready 300 DPI.`;
  };

  const handleCopyPrompt = (slot: ImageSlot, idx: number) => {
    const prompt = generatePromptForSlot(slot, idx);
    navigator.clipboard.writeText(prompt);
    setCopiedPromptId(slot.slotId);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                {exercise.layoutType.replace('_', ' ')}
              </span>
              <h1 className="text-base font-bold text-slate-800">{exercise.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage image slots, preset dimensions, and graphics for this exercise.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSlot}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            >
              <Plus size={14} /> Add Image Slot
            </button>
            <button
              onClick={onNavigateToPreview}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              Preview Worksheet <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Tip Box */}
        <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">A4 Print Standard:</span> Dimensions are preset to standard mm sizes ensuring exact placement without breaking page margins. Dotted placeholder outlines will be rendered when an image has not yet been uploaded.
          </div>
        </div>

        {/* Image Slots List */}
        {slots.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <ImageIcon size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No Image Slots Configured</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              This exercise currently has no reserved image placeholders. Add a slot to include an illustration, photo, or diagram.
            </p>
            <button
              onClick={handleAddSlot}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-200 flex items-center gap-1.5 transition-all"
            >
              <Plus size={14} /> Add First Image Slot
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {slots.map((slot, idx) => (
              <div
                key={slot.slotId}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center gap-4 transition-all hover:border-slate-300"
              >
                {/* Thumbnail / Upload Area */}
                <div
                  onClick={() => triggerUpload(idx)}
                  className="w-28 h-24 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/40 hover:border-blue-400 cursor-pointer relative group shrink-0 transition-all"
                  title="Click to upload or replace image"
                >
                  {slot.assetUrl ? (
                    <>
                      <img
                        src={slot.assetUrl}
                        alt={slot.caption || `Slot ${slot.label}`}
                        className={`w-full h-full ${slot.fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                        Replace Image
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-600 transition-colors">
                      <Upload size={18} />
                      <span className="text-[10px] font-bold mt-1">Upload File</span>
                      <span className="text-[9px] text-slate-400">PNG, JPG, SVG</span>
                    </div>
                  )}
                </div>

                {/* Slot Properties */}
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  {/* Label */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Label / Ref
                    </label>
                    <input
                      type="text"
                      value={slot.label || ''}
                      onChange={(e) => handleUpdateSlotField(idx, 'label', e.target.value)}
                      placeholder="e.g. A"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Caption */}
                  <div className="sm:col-span-6">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Caption / Description
                    </label>
                    <input
                      type="text"
                      value={slot.caption || ''}
                      onChange={(e) => handleUpdateSlotField(idx, 'caption', e.target.value)}
                      placeholder="e.g. Sally shopping in the supermarket..."
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Preset Size */}
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Print Dimensions
                    </label>
                    <select
                      onChange={(e) => {
                        const presetKey = e.target.value as keyof typeof PRINT_TOKENS.imageSlots;
                        const preset = PRINT_TOKENS.imageSlots[presetKey];
                        if (preset) {
                          const updated = [...slots];
                          updated[idx] = {
                            ...updated[idx],
                            widthMm: preset.widthMm,
                            heightMm: preset.heightMm,
                            aspectRatio: preset.aspectRatio as any,
                          };
                          onUpdateExercise({ ...exercise, imageSlots: updated });
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="matching">Matching (72x54mm)</option>
                      <option value="smallMultipleChoice">Small Choice (48x36mm)</option>
                      <option value="readingIllustration">Reading (65x48mm)</option>
                      <option value="largeIllustration">Large (175x95mm)</option>
                      <option value="wideIllustration">Wide Banner (180x100mm)</option>
                    </select>
                  </div>

                  {/* Fit Mode & AI Prompt Generator row */}
                  <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Dimensions: <strong>{slot.widthMm} × {slot.heightMm} mm</strong></span>
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-medium text-slate-400">Fit:</label>
                        <select
                          value={slot.fitMode || 'contain'}
                          onChange={(e) => handleUpdateSlotField(idx, 'fitMode', e.target.value)}
                          className="bg-slate-100 border-none rounded px-1.5 py-0.5 text-[11px] text-slate-700"
                        >
                          <option value="contain">Contain</option>
                          <option value="cover">Cover</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(slot, idx)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200/50 flex items-center gap-1 transition-all"
                        title="Copy Flow/AI prompt for this illustration"
                      >
                        {copiedPromptId === slot.slotId ? (
                          <>
                            <Check size={11} className="text-emerald-600" />
                            <span className="text-emerald-700">Copied Prompt!</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} />
                            <span>Copy AI Prompt</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove slot"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Next Bar */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-200">
          <button
            onClick={onNavigateToPreview}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
          >
            <span>Proceed to Preview & Export</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
