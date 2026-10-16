import { useLayoutEffect, useState } from 'react';

/**
 * Lấy khe thao tác trên thanh header của app (id "app-header-actions") để trình soạn gắn nút của mình vào qua portal,
 * đồng thời ẩn breadcrumb / tên trường trong lúc trình soạn mở. Trả lại như cũ khi đóng trình soạn.
 */
export const useAppHeaderSlot = (): HTMLElement | null => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.getElementById('app-header-actions');
    setSlot(el);
    const header = el?.parentElement;
    if (!el || !header) return;
    const hidden: HTMLElement[] = [];
    Array.from(header.children).forEach((c) => {
      if (c !== el && c instanceof HTMLElement) {
        hidden.push(c);
        c.dataset.prevDisplay = c.style.display;
        c.style.display = 'none';
      }
    });
    const prev = { flex: el.style.flex, margin: el.style.marginLeft, pad: el.style.paddingLeft };
    el.style.flex = '1 1 auto';
    el.style.marginLeft = '0';
    el.style.paddingLeft = '0';
    return () => {
      hidden.forEach((c) => { c.style.display = c.dataset.prevDisplay || ''; });
      el.style.flex = prev.flex;
      el.style.marginLeft = prev.margin;
      el.style.paddingLeft = prev.pad;
    };
  }, []);
  return slot;
};
