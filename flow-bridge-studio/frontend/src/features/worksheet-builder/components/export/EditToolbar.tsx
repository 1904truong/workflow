import React from 'react';
import {
  MousePointer2, Pencil, Image as ImageIcon, Square, ChevronDown, Undo2, Redo2,
  Trash2, Copy, Layers, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List,
} from 'lucide-react';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const base = 'h-7 px-2 rounded-md border text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors select-none';
const idle = 'bg-white/80 border-slate-200 text-slate-800 hover:bg-white';

const Sep = () => <span className="w-px h-5 bg-blue-200/70 mx-1 shrink-0" />;

/** Thanh công cụ chỉnh sửa. HIỆN TẠI mới chỉ Undo/Redo chạy thật; các nút còn lại là giao diện (chức năng làm sau). */
export const EditToolbar: React.FC<Props> = ({ canUndo, canRedo, onUndo, onRedo }) => {
  const soon = 'Chức năng này sẽ có sau';
  return (
    <div className="no-print shrink-0 px-4 pt-2">
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-blue-200/80 bg-blue-50/80 p-1 [scrollbar-width:none] shadow-sm">
        <button type="button" className={`${base} bg-blue-600 border-blue-600 text-white shadow`} title="Chọn">
          <MousePointer2 size={12} /> Select
        </button>
        <button type="button" className={`${base} ${idle}`} title={soon}><Pencil size={12} /> Edit Text</button>
        <button type="button" className={`${base} ${idle}`} title={soon}><ImageIcon size={12} /> Image</button>
        <button type="button" className={`${base} ${idle}`} title={soon}>
          <Square size={12} /> Add Element <ChevronDown size={10} />
        </button>

        <Sep />

        <button type="button" onClick={onUndo} disabled={!canUndo} className={`${base} ${canUndo ? idle : 'bg-transparent border-transparent text-slate-400'}`} title="Hoàn tác (Ctrl+Z)">
          <Undo2 size={12} /> Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className={`${base} ${canRedo ? idle : 'bg-transparent border-transparent text-slate-400'}`} title="Làm lại (Ctrl+Y)">
          <Redo2 size={12} /> Redo
        </button>

        <Sep />

        <button type="button" className={`${base} ${idle}`} title={soon}><Trash2 size={12} /> Delete</button>
        <button type="button" className={`${base} ${idle}`} title={soon}><Copy size={12} /> Duplicate</button>
        <button type="button" className={`${base} ${idle}`} title={soon}>
          <Layers size={12} /> Align <ChevronDown size={10} />
        </button>

        <Sep />

        <button type="button" className={`${base} ${idle} w-24 justify-between`} title={soon}>
          Arial <ChevronDown size={10} />
        </button>
        <button type="button" className={`${base} ${idle} w-14 justify-between`} title={soon}>
          14 <ChevronDown size={10} />
        </button>

        <div className={`${base} ${idle} px-1 gap-0`}>
          <button type="button" className="w-6 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100" title="In đậm"><Bold size={13} strokeWidth={2.6} /></button>
          <button type="button" className="w-6 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100" title="In nghiêng"><Italic size={13} /></button>
          <button type="button" className="w-6 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100" title="Gạch chân"><Underline size={13} /></button>
          <button type="button" className="h-5 px-1 flex items-center gap-1 rounded-lg hover:bg-slate-100" title="Màu chữ">
            <span className="flex flex-col items-center leading-none">
              <span className="text-[11px] font-extrabold">A</span>
              <span className="block w-3 h-[2px] mt-0.5 rounded bg-blue-600" />
            </span>
            <ChevronDown size={10} />
          </button>
        </div>

        <div className={`${base} ${idle} px-1 gap-0`}>
          <button type="button" className="w-7 h-5 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700" title="Căn trái"><AlignLeft size={13} /></button>
          <button type="button" className="w-7 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100" title="Căn giữa"><AlignCenter size={13} /></button>
          <button type="button" className="w-7 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100" title="Căn phải"><AlignRight size={13} /></button>
          <button type="button" className="w-7 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100" title="Danh sách"><List size={13} /></button>
        </div>

        <Sep />

        <button type="button" className={`${base} ${idle} w-16 justify-between`} title="Giãn dòng">
          1.5 <ChevronDown size={10} />
        </button>
      </div>
    </div>
  );
};
