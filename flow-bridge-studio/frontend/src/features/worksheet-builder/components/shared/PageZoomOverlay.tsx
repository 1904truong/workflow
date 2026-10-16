import React from 'react';
import { Minimize } from 'lucide-react';
import type { Worksheet } from '../../types';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';

interface Props {
  /** Worksheet chỉ gồm bài đang soạn (buildWorksheet(true)) */
  worksheet: Worksheet;
  onClose: () => void;
}

/** Khung phóng to riêng trang đang soạn; bấm ra ngoài hoặc nút thu nhỏ để đóng */
export const PageZoomOverlay: React.FC<Props> = ({ worksheet, onClose }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-8" onClick={onClose}>
    <div className="bg-white rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="h-12 px-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        <span className="text-sm font-bold text-slate-900">Trang đang soạn · A4</span>
        <button type="button" onClick={onClose} title="Thu nhỏ về 100%" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"><Minimize size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto bg-slate-200/70 p-6 flex justify-center"><div style={{ zoom: 1.25 }}><WorksheetRenderer worksheet={worksheet} /></div></div>
    </div>
  </div>
);
