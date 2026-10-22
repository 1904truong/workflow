// Hàm DOM dùng chung cho các ô soạn có định dạng từng từ: vẽ chữ + marks + chỗ trống vào một phần tử,
// đổi qua lại giữa vị trí ký tự và vị trí trong DOM.

import { attrsToStyle, segmentText, type TextMark } from '../../services/listening/textMarks';
import { findGaps } from '../../services/listening/docEdit';

/** Vẽ `text` (kèm marks) vào `root`. gapStyle 'page' = nhãn (a) in đậm như chữ in trên trang; 'editor' = chỗ trống màu xanh. */
export function paintInto(root: HTMLElement, text: string, marks: TextMark[] | undefined, gapStyle: 'editor' | 'page' = 'editor'): void {
  const frag = document.createDocumentFragment();
  const addText = (from: number, to: number) => {
    for (const seg of segmentText(marks, from, to)) {
      const t = text.slice(seg.start, seg.end);
      const style = attrsToStyle(seg.attrs);
      if (Object.values(style).some((v) => v !== undefined)) {
        const sp = document.createElement('span');
        for (const [k, v] of Object.entries(style)) if (v !== undefined) (sp.style as unknown as Record<string, string>)[k] = String(v);
        sp.textContent = t;
        frag.appendChild(sp);
      } else frag.appendChild(document.createTextNode(t));
    }
  };
  let last = 0;
  for (const g of findGaps(text)) {
    addText(last, g.start);
    const sp = document.createElement('span');
    sp.dataset.gap = '1';
    const marker = text.slice(g.start, g.end);
    if (gapStyle === 'page') {
      const m = /^(\([^)]*\))([\s\S]*)$/.exec(marker);
      const label = document.createElement('strong');
      label.style.fontWeight = '700';
      label.style.color = '#0f172a';
      label.textContent = m ? m[1] : marker;
      sp.appendChild(label);
      if (m && m[2]) sp.appendChild(document.createTextNode(m[2]));
    } else {
      sp.style.color = '#2563eb';
      sp.style.fontWeight = '700';
      sp.textContent = marker;
    }
    frag.appendChild(sp);
    last = g.end;
  }
  addText(last, text.length);
  if (text.endsWith('\n')) {
    const br = document.createElement('br');
    br.dataset.pad = '1';
    frag.appendChild(br);
  }
  root.replaceChildren(frag);
}

/** Vị trí DOM (nút chữ + vị trí trong nút) của ký tự thứ `offset` trong `root`. */
export function textPointAt(root: HTMLElement, offset: number): { node: Node; off: number } {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let last: Text | null = null;
  let n: Node | null;
  while ((n = w.nextNode())) {
    const len = (n as Text).data.length;
    if (offset <= acc + len) return { node: n, off: offset - acc };
    acc += len;
    last = n as Text;
  }
  return last ? { node: last, off: last.data.length } : { node: root, off: 0 };
}

/** Số ký tự từ đầu `root` đến điểm DOM (node, off). */
export function textOffsetOf(root: HTMLElement, node: Node, off: number): number {
  const rg = document.createRange();
  rg.selectNodeContents(root);
  rg.setEnd(node, off);
  return rg.toString().length;
}

/** Đọc lại chữ đang có trong DOM (khi trình duyệt tự sửa, vd. gõ IME). */
export function readTextOf(root: HTMLElement): string {
  let out = '';
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) out += (n as Text).data;
    else if (n instanceof HTMLElement) {
      if (n.dataset.pad) return;
      if (n.tagName === 'BR') { out += '\n'; return; }
      n.childNodes.forEach(walk);
    }
  };
  root.childNodes.forEach(walk);
  return out;
}
