import React from 'react';
import { RibbonToolbar } from '../shared/toolbar/RibbonToolbar';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoom: (value: number) => void;
  onPrint: () => void;
  onExportDocx: () => void;
  onBack: () => void;
}

/**
 * Thanh công cụ chỉnh sửa của Preview & Export: cùng kiểu Ribbon (menu File / Edit / View + hàng công cụ) với các trình soạn.
 * Chỉ có các nút chạy thật: Undo/Redo, Zoom, In / Lưu PDF, Xuất Word, Quay lại.
 * Trang xem trước chỉ lưu chữ thuần (không lưu định dạng đậm / nghiêng / phông), nên chưa có nút định dạng chữ.
 */
export const EditToolbar: React.FC<Props> = ({ canUndo, canRedo, onUndo, onRedo, zoom, onZoom, onPrint, onExportDocx, onBack }) => (
  <div className="no-print shrink-0 px-4 pt-2 relative z-20">
    <RibbonToolbar
      groups={[]}
      shell={{
        onPrint,
        onExportDocx,
        onBack,
        zoom,
        onZoom,
        undo: { onUndo, onRedo, canUndo, canRedo },
      }}
    />
  </div>
);
