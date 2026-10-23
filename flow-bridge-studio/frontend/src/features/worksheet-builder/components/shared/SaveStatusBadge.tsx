// Chỉ báo lưu dùng chung cho các trình soạn: chỉ báo "Đã lưu" sau khi dữ liệu thật sự được lưu (bấm Save / Ctrl+S / autosave),
// còn thay đổi chưa lưu thì báo "Chưa lưu" và trình duyệt hỏi lại khi đóng tab.

import React, { useEffect } from 'react';
import { Check, CircleDot, Loader2 } from 'lucide-react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export const SaveStatusBadge: React.FC<{ status: SaveStatus }> = ({ status }) => {
  // Có thay đổi chưa lưu: cảnh báo khi đóng / tải lại trang
  useEffect(() => {
    if (status === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  if (status === 'saved') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100" title="Mọi thay đổi đã được lưu">
        <Check size={13} strokeWidth={2.5} /> Đã lưu
      </div>
    );
  }
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
        <Loader2 size={13} className="animate-spin" /> Đang lưu…
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100" title="Có thay đổi chưa lưu – bấm Save hoặc Ctrl+S">
      <CircleDot size={13} strokeWidth={2.5} /> Chưa lưu
    </div>
  );
};

/** Ctrl+S / Cmd+S lưu bài (chặn hộp thoại "Lưu trang" của trình duyệt) */
export const useSaveShortcut = (onSave: () => void) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
};
