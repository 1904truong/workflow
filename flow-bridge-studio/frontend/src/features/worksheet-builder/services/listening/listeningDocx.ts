// HTML (định dạng Word .doc) cho phần bài đọc của Listening Fill in the Gap, mang theo định dạng từng từ (marks)
// và định dạng cả đoạn (căn lề, danh sách, thụt lề) giống bản xem trước A4.

import type { ListeningGapFillData, ListeningParagraph } from './listeningGapFillCore.ts';
import { attrsToStyle, segmentText } from './textMarks.ts';

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const css = (style: Record<string, string | number | undefined>) =>
  Object.entries(style).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${kebab(k)}:${v}`).join(';');

const GAP_RE = /\(([A-Za-z0-9_]+)\)\s*(_{2,})/g;

function paragraphHtml(p: ListeningParagraph, esc: (s: string) => string): string {
  const raw = p.text || '';
  const f = p.format || {};
  const lineHtml = (s: string) => esc(s).replace(/\n/g, '<br/>');

  const textRun = (from: number, to: number) =>
    segmentText(p.marks, from, to).map((seg) => {
      const style = css(attrsToStyle(seg.attrs));
      const html = lineHtml(raw.slice(seg.start, seg.end));
      return style ? `<span style="${style}">${html}</span>` : html;
    }).join('');

  let out = '';
  let last = 0;
  GAP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GAP_RE.exec(raw)) !== null) {
    out += textRun(last, m.index);
    out += `<b>(${esc(m[1])})</b> ${'_'.repeat(Math.max(10, m[2].length))}`;
    last = m.index + m[0].length;
  }
  out += textRun(last, raw.length);

  // Định dạng cả đoạn kiểu cũ (bài chưa được chuyển sang marks)
  const legacy = css({
    fontWeight: f.bold ? 700 : undefined,
    fontStyle: f.italic ? 'italic' : undefined,
    textDecoration: f.underline ? 'underline' : undefined,
    color: f.color,
    backgroundColor: f.highlight,
  });
  if (legacy) out = `<span style="${legacy}">${out}</span>`;

  const list = f.list ?? 'number';
  const prefix = list === 'bullet' ? '•&nbsp;&nbsp;' : list === 'none' ? '' : `<b>${p.order}.</b>&nbsp;&nbsp;`;
  const indent = f.indentMm ? `margin-left:${f.indentMm}mm;` : '';
  return `<p style="margin:0 0 6pt 0;text-align:${f.align || 'left'};${indent}">${prefix}${out}</p>`;
}

export function listeningPassageHtml(data: ListeningGapFillData, esc: (s: string) => string): string {
  const s = data.settings;
  const base = `font-family:${s.fontFamily};font-size:${s.passageFontSizePt}pt;line-height:${Math.round(s.lineHeight * 100)}%;`;
  const title = data.passageTitle ? `<p style="text-align:center;margin:0 0 6pt 0;${base}"><b>${esc(data.passageTitle)}</b></p>` : '';
  return `<div style="${base}">${title}${data.paragraphs.map((p) => paragraphHtml(p, esc)).join('')}</div>`;
}
