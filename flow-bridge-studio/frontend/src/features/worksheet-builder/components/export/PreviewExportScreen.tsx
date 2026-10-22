import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Printer, FileText, Download, ZoomIn, ZoomOut,  Image as ImageIcon, PanelTop, Pencil, Combine, AlertTriangle
} from 'lucide-react';
import type { LessonFolder } from '../../types';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { folderToWorksheet } from '../../types';
import { folderStorage } from '../../services/folderStorageService';
import { BrandingEditor } from './BrandingEditor';
import { EditToolbar } from './EditToolbar';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
import { EditProvider } from '../preview/EditContext';
import type { EditApi } from '../preview/EditContext';
import type { Exercise } from '../../types';

interface PreviewExportScreenProps {
  folder: LessonFolder;
  onBackToFolder: () => void;
  onUpdatePrintSettings: (key: string, value: any) => void;
  /** Ghi danh sách bài tập mới (sau khi sửa trực tiếp trên trang xem trước) */
  onUpdateExercises: (exercises: Exercise[]) => void;
}

export const PreviewExportScreen: React.FC<PreviewExportScreenProps> = ({
  folder,
  onBackToFolder,
  onUpdatePrintSettings,
  onUpdateExercises,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [editingBrand, setEditingBrand] = useState(false);

  // ───── Chế độ sửa trực tiếp + Undo/Redo ─────
  const [editMode, setEditMode] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const mergeRef = useRef<HTMLDivElement>(null);
  const [pag, setPag] = useState<{ pages: number[][]; overflow: boolean[] } | null>(null);
  const [past, setPast] = useState<Exercise[][]>([]);
  const [future, setFuture] = useState<Exercise[][]>([]);
  const exercisesRef = useRef<Exercise[]>(folder.exercises);
  exercisesRef.current = folder.exercises;

  /** Mọi thay đổi đi qua đây để được ghi vào lịch sử (tối đa 100 bước) */
  const commit = useCallback((next: Exercise[]) => {
    setPast((p) => [...p.slice(-99), exercisesRef.current]);
    setFuture([]);
    onUpdateExercises(next);
  }, [onUpdateExercises]);

  // Không gọi hàm có tác dụng phụ bên trong setState (StrictMode chạy updater 2 lần)
  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture((f) => [exercisesRef.current, ...f]);
    setPast(past.slice(0, -1));
    onUpdateExercises(past[past.length - 1]);
  }, [past, onUpdateExercises]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast((p) => [...p, exercisesRef.current]);
    setFuture(future.slice(1));
    onUpdateExercises(future[0]);
  }, [future, onUpdateExercises]);

  // Đổi sang đề khác -> xóa lịch sử
  useEffect(() => { setPast([]); setFuture([]); }, [folder.id]);

  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return; // đang gõ chữ: để trình duyệt tự undo
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, undo, redo]);

  useEffect(() => {
    if (!mergeOpen) return;
    const onDown = (e: MouseEvent) => { if (!mergeRef.current?.contains(e.target as Node)) setMergeOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMergeOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [mergeOpen]);

  /** Bật/tắt "dồn với bài trước" (bật thì bỏ ngắt trang bắt buộc của bài đó vì hai thứ này mâu thuẫn nhau) */
  const toggleMerge = (exerciseId: string) =>
    commit(exercisesRef.current.map((ex) => (ex.id === exerciseId
      ? { ...ex, mergeWithPrevious: !ex.mergeWithPrevious, pageBreakBefore: ex.mergeWithPrevious ? ex.pageBreakBefore : false }
      : ex)));

  const mapEx = (fn: (ex: Exercise) => Exercise) => commit(exercisesRef.current.map(fn));

  const editApi: EditApi = {
    editing: editMode,
    setExerciseField: (id, field, value) => mapEx((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
    setQuestionText: (qid, value) =>
      mapEx((ex) => (ex.questions.some((q) => q.id === qid)
        ? { ...ex, questions: ex.questions.map((q) => (q.id === qid ? { ...q, text: value } : q)) }
        : ex)),
    deleteQuestion: (qid) =>
      mapEx((ex) => (ex.questions.some((q) => q.id === qid)
        ? { ...ex, questions: ex.questions.filter((q) => q.id !== qid).map((q, i) => ({ ...q, number: i + 1 })) }
        : ex)),
    deleteExercise: (id) => commit(exercisesRef.current.filter((ex) => ex.id !== id).map((ex, i) => ({ ...ex, order: i }))),
    moveExercise: (id, dir) => {
      const list = [...exercisesRef.current];
      const i = list.findIndex((ex) => ex.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      commit(list.map((ex, k) => ({ ...ex, order: k })));
    },
    togglePageBreak: (id) => mapEx((ex) => (ex.id === id ? { ...ex, pageBreakBefore: !ex.pageBreakBefore } : ex)),
    replaceImage: (slotId, file) => {
      void fileToSmallDataUrl(file, 1400, 'image/jpeg').then((url) =>
        mapEx((ex) => (ex.imageSlots.some((s) => s.slotId === slotId)
          ? { ...ex, imageSlots: ex.imageSlots.map((s) => (s.slotId === slotId ? { ...s, assetUrl: url, assetStoragePath: undefined, status: 'assigned' as const, needsReview: false } : s)) }
          : ex)),
      ).catch(() => window.alert('Không đọc được ảnh này.'));
    },
    clearImage: (slotId) =>
      mapEx((ex) => (ex.imageSlots.some((s) => s.slotId === slotId)
        ? { ...ex, imageSlots: ex.imageSlots.map((s) => (s.slotId === slotId ? { ...s, assetUrl: undefined, assetStoragePath: undefined, status: 'empty' as const, needsReview: false } : s)) }
        : ex)),
  };
  const showPlaceholders = folder.printSettings?.showPlaceholders ?? true;

  const worksheet = folderToWorksheet(folder);

  // Ảnh AI chưa được giáo viên duyệt
  const unreviewed = folder.exercises.reduce((n, ex) => n + ex.imageSlots.filter((s) => s.needsReview).length, 0);
  const confirmUnreviewed = () =>
    unreviewed === 0 ||
    window.confirm(`Còn ${unreviewed} ảnh do AI tạo chưa được duyệt (xem ở AI Image Studio).\nVẫn tiếp tục xuất/in?`);

  const handlePrint = () => {
    if (!confirmUnreviewed()) return;
    folderStorage.addExportHistory({
      lessonId: folder.id,
      lessonName: folder.name,
      exportType: 'pdf_student',
      exercisesCount: folder.exercises.length,
    });
    window.print();
  };

  const handleExportDocxStudent = () => {
    if (!confirmUnreviewed()) return;
    folderStorage.addExportHistory({
      lessonId: folder.id,
      lessonName: folder.name,
      exportType: 'docx_student',
      exercisesCount: folder.exercises.length,
    });
    exportWorksheetToDocx(worksheet, 'student');
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(folder, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${folder.name.replace(/\s+/g, '_')}_Folder.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-text">
      {unreviewed > 0 && (
        <div className="no-print shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-900 font-semibold">
          ⚠ Còn {unreviewed} ảnh do AI tạo chưa được duyệt. Hãy kiểm tra trong AI Image Studio (nút “✓ Duyệt ảnh”) trước khi in hoặc xuất file.
        </div>
      )}
      
      {/* Top Preview Controls Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-10 shadow-2xs no-print">
        {/* Left: Back & Modes */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToFolder}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors mr-2"
          >
            <ArrowLeft size={13} /> Back to Folder
          </button>

          <span className="text-slate-300">|</span>

          <button
            onClick={() => setEditMode((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
              editMode ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Bật chế độ sửa trực tiếp trên trang xem trước"
          >
            <Pencil size={13} />
            <span className="hidden sm:inline">Chỉnh sửa: {editMode ? 'Bật' : 'Tắt'}</span>
          </button>

          <div className="relative" ref={mergeRef}>
            <button
              onClick={() => setMergeOpen((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                mergeOpen || folder.exercises.some((e) => e.mergeWithPrevious) ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Chọn bài nào được dồn chung một trang với bài nào"
              aria-expanded={mergeOpen}
            >
              <Combine size={13} />
              <span className="hidden sm:inline">Dồn trang</span>
            </button>
            {mergeOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-3 space-y-2 no-print">
                <div className="text-sm font-bold text-slate-900">Dồn bài vào chung một trang</div>
                <p className="text-[11px] text-slate-500 leading-snug">Tích “Dồn với bài trên” để bài đó luôn nằm cùng trang với bài ngay phía trên. Bài không tích sẽ tự xếp theo chỗ trống còn lại.</p>
                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {folder.exercises.map((ex, i) => {
                    const pageNo = pag ? pag.pages.findIndex((idxs) => idxs.includes(i)) + 1 : 0;
                    const over = pag && pageNo > 0 ? pag.overflow[pageNo - 1] : false;
                    return (
                      <div key={ex.id} className={`flex items-center gap-2 p-2 rounded-xl border ${ex.mergeWithPrevious ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200'}`}>
                        <span className="w-6 h-6 rounded-md bg-[#16295f] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate" title={ex.title}>{ex.title.replace(/^\s*(exercise|bài|part|task)\s*\d+\s*[:.\-–—]\s*/i, '') || ex.title}</div>
                          <div className="text-[10.5px] text-slate-400">{pageNo ? `Trang ${pageNo}` : 'Đang đo...'}</div>
                        </div>
                        {i > 0 ? (
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer shrink-0">
                            <input type="checkbox" checked={!!ex.mergeWithPrevious} onChange={() => toggleMerge(ex.id)} />
                            Dồn với bài trên
                          </label>
                        ) : (
                          <span className="text-[10.5px] text-slate-300 shrink-0">bài đầu</span>
                        )}
                        {over && <span title="Các bài dồn chung trang này cao hơn trang A4: nội dung sẽ tràn. Hãy thu nhỏ bớt hoặc bỏ dồn." className="text-amber-600 shrink-0"><AlertTriangle size={14} /></span>}
                      </div>
                    );
                  })}
                </div>
                {pag && pag.overflow.some(Boolean) && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-snug">⚠ Có trang bị tràn vì các bài dồn chung cộng lại cao hơn một trang A4. Giảm cỡ chữ/khoảng dòng của các bài đó hoặc bỏ tích dồn.</p>
                )}
                {folder.exercises.some((e) => e.mergeWithPrevious) && (
                  <button
                    onClick={() => commit(exercisesRef.current.map((ex) => ({ ...ex, mergeWithPrevious: false })))}
                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600"
                  >
                    Bỏ hết dồn
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setEditingBrand((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
              editingBrand ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Chỉnh logo, QR, mức độ, giáo viên... ở header và footer"
          >
            <PanelTop size={13} />
            <span className="hidden sm:inline">Header &amp; Footer</span>
          </button>

          {/* Dotted Placeholders Toggle */}
          <button
            onClick={() => onUpdatePrintSettings('showPlaceholders', !showPlaceholders)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
              showPlaceholders
                ? 'bg-slate-50 border-slate-300 text-slate-700'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
            title="Toggle dotted frame for empty image placeholders"
          >
            <ImageIcon size={13} className={showPlaceholders ? 'text-blue-600' : 'text-slate-400'} />
            <span className="hidden sm:inline">Dotted Boxes:</span>
            <span className="font-bold">{showPlaceholders ? 'On' : 'Off'}</span>
          </button>
        </div>

        {/* Center: Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
            className="p-1 text-slate-500 hover:text-slate-800 rounded"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-xs font-mono font-bold text-slate-700 px-1.5 min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(150, prev + 10))}
            className="p-1 text-slate-500 hover:text-slate-800 rounded"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            className="text-[10px] text-slate-400 hover:text-slate-700 px-1"
            title="Reset to 100%"
          >
            Reset
          </button>
        </div>

        {/* Right: Export Actions */}
        <div className="flex items-center gap-2">
          {/* Word DOCX dropdown / buttons */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              onClick={handleExportDocxStudent}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-white rounded-lg flex items-center gap-1 transition-all"
              title="Download editable Microsoft Word DOCX"
            >
              <FileText size={13} className="text-blue-600" />
              <span>Word .doc</span>
            </button>
          </div>

          {/* Print PDF Action */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            title="Open print dialogue (Save as PDF or print on A4 paper)"
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Export JSON backup"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {editMode && (
        <EditToolbar
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={undo}
          onRedo={redo}
          zoom={zoomLevel}
          onZoom={setZoomLevel}
          onPrint={handlePrint}
          onExportDocx={handleExportDocxStudent}
          onBack={onBackToFolder}
        />
      )}

      {/* Preview Stage (Scrollable Canvas) */}
      <div className="flex-1 flex min-h-0">
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
        <div
          className="transition-transform duration-200 ease-out origin-top shadow-2xl rounded-sm my-2"
          style={{
            transform: `scale(${zoomLevel / 100})`,
          }}
        >
          <EditProvider value={editApi}>
          <WorksheetRenderer
            worksheet={worksheet}
            onEditBranding={() => setEditingBrand(true)}
            onPaginate={setPag}
            minPages={editingBrand && resolveBranding(folder.printSettings?.branding).footerMode === 'alternate' ? 2 : 0}
          />
          </EditProvider>
        </div>
      </div>
      {editingBrand && (
        <BrandingEditor
          value={resolveBranding(folder.printSettings?.branding)}
          onChange={(next) => onUpdatePrintSettings('branding', next)}
          onClose={() => setEditingBrand(false)}
        />
      )}
      </div>
    </div>
  );
};
