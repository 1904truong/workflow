// Thanh "chọn layout + đọc từ ảnh" đặt trong hộp Smart Paste của mọi dạng bài có nhiều layout.
// - Ô Layout: đổi layout của bài ngay (có thể Hoàn tác bằng undo của trình soạn).
// - "Đọc từ ảnh bằng AI": AI nhìn ảnh đề, chọn layout khớp nhất trong danh sách của dạng bài, chép đề đúng định dạng ô dán bên dưới.

import React from 'react';
import { AiImageReader } from './AiImageReader';

interface LayoutMeta {
  id: string;
  label: string;
  desc?: string;
}

interface Props {
  /** Tên dạng bài, gửi cho AI */
  kind: string;
  layouts: LayoutMeta[];
  /** Layout đang dùng của bài */
  current: string;
  onLayout: (id: string) => void;
  /** Mô tả định dạng và ví dụ của ô dán (cùng nội dung với nút "Viết lại bằng AI") */
  hint: string;
  example: string;
  text: string;
  onText: (value: string) => void;
}

export const SmartLayoutBar: React.FC<Props> = ({ kind, layouts, current, onLayout, hint, example, text, onText }) => {
  if (layouts.length === 0) return null;
  const label = (id: string) => layouts.find((l) => l.id === id)?.label || id;
  const currentDesc = layouts.find((l) => l.id === current)?.desc;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">Layout
        <select value={current} onChange={(e) => onLayout(e.target.value)} className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          {layouts.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      {currentDesc && <p className="text-[10.5px] text-slate-400 -mt-1">{currentDesc}</p>}
      <AiImageReader
        kind={kind}
        layouts={layouts.map((l) => ({ id: l.id, label: l.label, desc: l.desc || l.label, hint, example }))}
        layoutLabel={label}
        currentText={text}
        onResult={(r) => { onLayout(r.layout); onText(r.text); }}
      />
    </div>
  );
};
