import { useEffect, useRef, useState } from 'react';
import type React from 'react';

/**
 * Chia hai cột có thể kéo (kiểu cửa sổ Windows): lưu tỉ lệ cột trái trong trình duyệt.
 * Gắn `mainRef` vào khung chứa hai cột và `handlers` vào thanh kéo.
 */
export const useSplitPane = (storageKey: string, defaultPct = 42, min = 25, max = 70) => {
  const mainRef = useRef<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPct, setLeftPct] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(storageKey));
      return v >= min && v <= max ? v : defaultPct;
    } catch {
      return defaultPct;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, String(leftPct)); } catch { /* bỏ qua */ }
  }, [leftPct, storageKey]);

  useEffect(() => {
    if (!isDragging) return;
    const prevSel = document.body.style.userSelect;
    const prevCur = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => { document.body.style.userSelect = prevSel; document.body.style.cursor = prevCur; };
  }, [isDragging]);

  const handlers = {
    onPointerDown: (ev: React.PointerEvent<HTMLDivElement>) => {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      setIsDragging(true);
    },
    onPointerMove: (ev: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const cs = getComputedStyle(mainRef.current);
      const pl = parseFloat(cs.paddingLeft);
      const inner = rect.width - pl - parseFloat(cs.paddingRight);
      const pct = ((ev.clientX - rect.left - pl) / inner) * 100;
      setLeftPct(Math.round(Math.min(max, Math.max(min, pct)) * 10) / 10);
    },
    onPointerUp: (ev: React.PointerEvent<HTMLDivElement>) => {
      if (ev.currentTarget.hasPointerCapture(ev.pointerId)) ev.currentTarget.releasePointerCapture(ev.pointerId);
      setIsDragging(false);
    },
    onPointerCancel: () => setIsDragging(false),
    onDoubleClick: () => setLeftPct(defaultPct),
  };

  return { mainRef, leftPct, isDragging, handlers };
};
