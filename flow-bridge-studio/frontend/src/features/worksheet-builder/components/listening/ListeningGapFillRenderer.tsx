import React from 'react';
import { Headphones } from 'lucide-react';
import { segmentText, sliceMarks, attrsToStyle, attrsInRange } from '../../services/listening/textMarks';
import { A4DocHost, A4ParagraphSurface, type A4DocEditing } from './A4DocHost';
import type {
  ListeningGapFillData,
  ListeningExtra,
  ListeningParagraph,
} from '../../services/listening/listeningGapFillCore';
import {
  PASSAGE_IMAGE_PRESET,
  DIALOGUE_PRESET,
  OUTLINE_PRESET,
  SENTENCE_LIST_PRESET,
  PASSAGE_QR_PRESET,
  SPEAKER_RE,
  formatBlankLabel,
  getAudioQrCodeUrl,
} from '../../services/listening/listeningGapFillCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

interface ListeningGapFillRendererProps {
  data: ListeningGapFillData;
  isTeacherKey?: boolean;
  exerciseIndex?: number;
  onSelectBlank?: (blankId: string) => void;
  hideExerciseHeading?: boolean;
  selectedExtraId?: string | null;
  onSelectExtra?: (extraId: string) => void;
  /** Có giá trị: tiêu đề sửa trực tiếp được trên trang (Edit Mode) */
  /** Có giá trị = Edit Mode: mọi chữ trên trang (trừ header/footer) sửa trực tiếp được và ghi thẳng vào dữ liệu chung */
  editable?: {
    onTitle?: (v: string) => void;
    onPassageTitle?: (v: string) => void;
    onIntro?: (v: string) => void;
    onExerciseNumber?: (n: number) => void;
    onExtraText?: (id: string, text: string) => void;
    onExtraCell?: (id: string, row: number, col: number, value: string) => void;
    onQuestion?: (id: string, text: string) => void;
    /** Sửa chữ của một đoạn bằng hàm biến đổi (tên người nói, tiêu đề cột "## ...", từng dòng của layout điền form) */
    onParagraphText?: (paraId: string, fn: (text: string) => string) => void;
    paragraphs?: A4DocEditing;
  };
  editableParagraph?: {
    paragraphIndex: number;
    onChange: (newText: string) => void;
  };
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài để lưu, Esc để hủy. `multiline`: Enter xuống dòng; `block`: chiếm cả ô. */
const EditableSpan: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  multiline?: boolean;
  block?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}> = ({ value, onCommit, multiline = false, block = false, placeholder, style }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const read = (el: HTMLElement) => {
    // M\u1ed9t d\u00f2ng: textContent (innerText b\u1ecb CSS text-transform \u0111\u1ed5i ch\u1eef hoa/th\u01b0\u1eddng, vd. ti\u00eau \u0111\u1ec1 c\u1ed9t); nhi\u1ec1u d\u00f2ng c\u1ea7n innerText \u0111\u1ec3 c\u00f3 xu\u1ed1ng d\u00f2ng
    if (!multiline) return (el.textContent || '').replace(/\u00a0/g, ' ').replace(/\s*\n+\s*/g, ' ').trim();
    return el.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '');
  };
  // Nội dung do mình đặt (không dùng React children) để gõ nhiều dòng không làm lệch DOM; đang gõ thì không ghi đè
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !onCommit || document.activeElement === el) return;
    if (read(el) !== value || (!value && el.firstChild)) el.textContent = value;
  });
  if (!onCommit) return <>{value}</>;
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      style={{ minHeight: '1.15em', verticalAlign: 'bottom', ...(multiline ? { whiteSpace: 'pre-wrap' } : null), ...(block ? { display: 'block' } : null), ...style }}
      className={`${block ? '' : 'inline-block min-w-[3ch]'} rounded-[2px] cursor-text caret-blue-600 hover:bg-blue-50 focus:bg-blue-50/60 focus:outline focus:outline-1 focus:outline-blue-400 focus:outline-offset-2 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300`}
      onBlur={(e) => {
        const v = read(e.currentTarget);
        if (v !== value) onCommit(v);
        else e.currentTarget.textContent = value;
      }}
      onKeyDown={(e) => {
        // Ctrl+A chỉ chọn chữ của ô này (trình duyệt có thể nhảy ra chọn cả vùng soạn bao ngoài)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          e.stopPropagation();
          const r = document.createRange();
          r.selectNodeContents(e.currentTarget);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
          return;
        }
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.currentTarget.textContent = value; e.currentTarget.blur(); }
      }}
    />
  );
};

export const ListeningGapFillRenderer: React.FC<ListeningGapFillRendererProps> = ({
  data,
  isTeacherKey = false,
  exerciseIndex = 3,
  onSelectBlank,
  hideExerciseHeading = false,
  selectedExtraId,
  onSelectExtra,
  editable,
}) => {
  // Cài đặt hiệu lực:
  // - Layout "Original" mà không có ảnh nào ở các đoạn thì trình bày theo phiếu mẫu (Bài đọc + QR): QR nhỏ chạy chữ vòng quanh,
  //   chỗ trống nét đứt, chữ tròn. Có ảnh ở đoạn thì vẫn là Original (ảnh bên phải từng đoạn).
  // - Hội thoại / Bài đọc + QR còn mang cài đặt mặc định chung (chữ 12pt, giãn dòng 1.7, có tai nghe) thì tự dùng bộ cài đặt khớp mẫu.
  const rawSettings = data.settings;
  const hasParagraphImages = rawSettings.imagePosition !== 'none' && data.paragraphs.some((pp) => !!pp.imageAssetUrl);
  const formMode = rawSettings.layout === 'form_completion';
  const layoutEff = formMode ? 'passage_image' : rawSettings.layout === 'original' && !hasParagraphImages ? 'passage_qr' : rawSettings.layout;
  const preset = layoutEff === 'dialogue' ? DIALOGUE_PRESET : layoutEff === 'passage_qr' ? PASSAGE_QR_PRESET : layoutEff === 'passage_image' ? PASSAGE_IMAGE_PRESET : layoutEff === 'outline' ? OUTLINE_PRESET : layoutEff === 'sentence_list' ? SENTENCE_LIST_PRESET : null;
  const defaultTypography = rawSettings.passageFontSizePt === 12 && rawSettings.lineHeight === 1.7;
  const settings = preset && defaultTypography
    ? { ...rawSettings, ...preset, layout: layoutEff, blankWidthMm: Math.min(rawSettings.blankWidthMm, preset.blankWidthMm as number), showAudioIcon: false }
    : { ...rawSettings, layout: layoutEff };
  const showKey = isTeacherKey;

  const dialogue = settings.layout === 'dialogue';
  const passageQr = settings.layout === 'passage_qr';
  // Hai layout bám phiếu mẫu: chữ tròn Quicksand, chỗ trống nét đứt sát chân chữ, QR không kèm chú thích
  const passageImage = settings.layout === 'passage_image';
  const outline = settings.layout === 'outline';
  const sampleStyle = dialogue || passageQr || passageImage || outline;
  const qrSizeMm = passageQr || passageImage ? 15 : outline ? 18 : 20;
  // Phiếu mẫu hội thoại dùng chữ tròn (Quicksand) – chỉ khi người dùng chưa chọn font khác
  const bodyFont = sampleStyle && (!settings.fontFamily || settings.fontFamily === 'Arial')
    ? 'Quicksand, "Segoe UI", Arial, sans-serif'
    : `${settings.fontFamily || 'Arial'}, sans-serif`;
  const fontStyle: React.CSSProperties = {
    fontFamily: bodyFont,
    color: '#111',
  };

  const lineHeight = settings.lineHeight || 1.5;
  const paragraphSpacingMargin =
    settings.paragraphSpacing === 'compact'
      ? '2mm'
      : settings.paragraphSpacing === 'spacious'
      ? '5mm'
      : '5mm';

  // ── Render a single blank ──
  const renderBlankSpan = (blankKey: string, keyIdx: string) => {
    // Find blank either by label or number
    const blank = data.blanks.find(
      (b) =>
        b.label.toLowerCase() === blankKey.toLowerCase() ||
        String(b.number) === blankKey
    );

    if (!blank) {
      return <span key={keyIdx}>({blankKey}) ________</span>;
    }

    const numberingStyle =
      settings.layout === 'numbered' || settings.layout === 'sentence_list' ? 'numbers' : settings.blankNumbering;
    const labelText = formatBlankLabel(blank, numberingStyle);

    const blankWidth = `${sampleStyle ? Math.min(settings.blankWidthMm || 18, 20) : settings.blankWidthMm || 30}mm`;

    // Blank style class / styling
    let blankLineStyle: React.CSSProperties = {
      display: 'inline-block',
      width: blankWidth,
      minWidth: '12mm',
      textAlign: 'center',
      verticalAlign: 'baseline',
    };

    if (settings.blankStyle === 'box') {
      blankLineStyle = {
        ...blankLineStyle,
        border: '1pt solid #475569',
        borderRadius: '1mm',
        height: '6mm',
        lineHeight: '6mm',
        backgroundColor: '#f8fafc',
        margin: '0 1.5mm',
      };
    } else if (settings.blankStyle === 'dotted') {
      blankLineStyle = {
        ...blankLineStyle,
        borderBottom: '1.5pt dotted #334155',
        margin: '0 1mm',
      };
    } else {
      // Default: underline
      blankLineStyle = {
        ...blankLineStyle,
        borderBottom: '1pt dashed #1e293b',
        margin: sampleStyle ? '0 0.8mm 0 1.4mm' : '0 1mm',
        // Dòng kẻ nằm sát chân chữ như ký tự gạch dưới ở phiếu mẫu
        ...(sampleStyle ? { lineHeight: 1 } : {}),
      };
    }

    return (
      <span
        key={keyIdx}
        onClick={() => onSelectBlank?.(blank.id)}
        className="inline-flex items-baseline cursor-pointer select-none transition-colors group/blank"
        title={`Chỗ trống ${labelText} - Click để chỉnh sửa`}
      >
        <strong style={{ fontWeight: 700, color: '#0f172a' }}>{labelText}</strong>
        <span style={blankLineStyle}>
          {showKey && blank.correctAnswer ? (
            <span
              style={{
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: '0.95em',
                textDecoration: settings.blankStyle === 'box' ? 'none' : 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {blank.correctAnswer}
            </span>
          ) : (
            <span className="opacity-0">___</span>
          )}
        </span>
      </span>
    );
  };

  // ── Parse paragraph text and replace (a) ______ with structured blanks ──
  const renderParagraphContent = (para: ListeningParagraph, pIdx: number, inline = false, formLine = -1) => {
    const raw = para.text || '';
    // Match (a) _____ or (1) _____
    const regex = /(\(([a-zA-Z0-9]+)\)\s*_{2,})/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;
    // Chữ thường: cắt theo định dạng từng từ (para.marks); không có marks thì trả lại chuỗi như cũ
    const textParts = (from: number, to: number): React.ReactNode[] =>
      segmentText(para.marks, from, to).map((seg) => {
        const txt = raw.slice(seg.start, seg.end);
        const style = attrsToStyle(seg.attrs);
        return Object.values(style).some((v) => v !== undefined) ? <span key={`m${seg.start}`} style={style}>{txt}</span> : txt;
      });

    while ((match = regex.exec(raw)) !== null) {
      const start = match.index;
      const end = regex.lastIndex;
      const blankKey = match[2];

      if (start > lastIdx) {
        parts.push(...textParts(lastIdx, start));
      }

      const blank = renderBlankSpan(blankKey, `p${pIdx}_b${match.index}`);
      const gapStyle = para.marks?.length ? attrsToStyle(attrsInRange(para.marks, raw.length, start, start + 1)) : null;
      parts.push(gapStyle && Object.values(gapStyle).some((v) => v !== undefined) ? <span key={`gm${start}`} style={gapStyle}>{blank}</span> : blank);
      lastIdx = end;
    }

    if (lastIdx < raw.length) {
      parts.push(...textParts(lastIdx, raw.length));
    }

    // Edit Mode: đoạn văn sửa trực tiếp trên trang (theo ID đoạn). Layout nào cắt tiền tố khỏi chữ thì ô chỉ sửa phần sau tiền tố;
    // form_completion tách dòng riêng nên giữ chữ tĩnh (sửa ở cột trái).
    const pe = editable?.paragraphs;
    const fullPara = pe && !showKey && !formMode ? data.paragraphs.find((x) => x.id === para.id) : undefined;
    const prefixLen = fullPara ? fullPara.text.length - raw.length : -1;
    const formLineEdit = editable?.onParagraphText && formMode && formLine >= 0 && !showKey;
    const body: React.ReactNode = formLineEdit
      ? (
        <EditableSpan
          value={raw}
          onCommit={(v) => editable!.onParagraphText!(para.id, (t) => {
            const lines = t.split('\n');
            let k = -1;
            const at = lines.findIndex((l) => l.trim() && ++k === formLine);
            if (at < 0) return t;
            if (v.trim()) lines[at] = v; else lines.splice(at, 1);
            return lines.join('\n');
          })}
        />
      )
      : fullPara && prefixLen >= 0 && fullPara.text.endsWith(raw)
      ? <A4ParagraphSurface paraId={fullPara.id} offset={prefixLen} text={raw} marks={prefixLen ? sliceMarks(fullPara.marks, prefixLen, fullPara.text.length) : fullPara.marks} />
      : parts;

    const f = para.format || {};
    if (inline) {
      return (
        <span style={{ fontWeight: f.bold ? 700 : undefined, fontStyle: f.italic ? 'italic' : undefined, textDecoration: f.underline ? 'underline' : undefined, color: f.color, backgroundColor: f.highlight }}>
          {body}
        </span>
      );
    }
    return (
      <div
        style={{
          textAlign: f.align || 'left',
          paddingLeft: f.indentMm ? `${f.indentMm}mm` : undefined,
        }}
      >
        <span
          style={{
            fontWeight: f.bold ? 700 : undefined,
            fontStyle: f.italic ? 'italic' : undefined,
            textDecoration: f.underline ? 'underline' : undefined,
            color: f.color,
            backgroundColor: f.highlight,
          }}
        >
          {body}
        </span>
      </div>
    );
  };

  const renderMarker = (para: ListeningParagraph, idx: number) => {
    const list = para.format?.list ?? 'number';
    if (list === 'none') return null;
    return (
      <strong style={{ fontWeight: 800, minWidth: '4.5mm', color: '#0f172a' }}>
        {list === 'bullet' ? '•' : `${para.order || idx + 1}.`}
      </strong>
    );
  };

  // ── Extra elements (Text Box / Line / Shape / Table) ──
  const renderExtra = (x: ListeningExtra) => {
    const wrap: React.CSSProperties = {
      width: `${x.widthPercent}%`,
      marginLeft: x.align === 'left' ? 0 : 'auto',
      marginRight: x.align === 'right' ? 0 : 'auto',
      marginBottom: '3mm',
      cursor: onSelectExtra ? 'pointer' : undefined,
      outline: selectedExtraId === x.id ? '1.5px dashed #2563eb' : undefined,
      outlineOffset: '1mm',
      breakInside: 'avoid',
    };
    let body: React.ReactNode = null;
    if (x.type === 'text') {
      body = (
        <div style={{ border: '0.8pt solid #94a3b8', borderRadius: '1.5mm', padding: '2mm 3mm', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
          <EditableSpan value={x.text || ''} onCommit={editable?.onExtraText ? (v) => editable.onExtraText!(x.id, v) : undefined} multiline block placeholder="Text box" />
        </div>
      );
    } else if (x.type === 'line') {
      body = <div style={{ borderTop: '1.2pt solid #334155', margin: '2mm 0' }} />;
    } else if (x.type === 'shape') {
      body = (
        <div
          style={{
            minHeight: '16mm',
            border: '1.2pt solid #2563eb',
            background: '#eff6ff',
            borderRadius: x.shape === 'ellipse' ? '50%' : '2mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2mm',
            textAlign: 'center',
          }}
        >
          <EditableSpan value={x.text || ''} onCommit={editable?.onExtraText ? (v) => editable.onExtraText!(x.id, v) : undefined} multiline placeholder="Text" />
        </div>
      );
    } else if (x.type === 'table') {
      const rows = x.rows || 2;
      const cols = x.cols || 2;
      body = (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            {Array.from({ length: rows }).map((_, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }).map((__, ci) => (
                  <td key={ci} style={{ border: '0.8pt solid #64748b', padding: '1.5mm 2mm', height: '8mm', verticalAlign: 'top' }}>
                    <EditableSpan value={x.cells?.[ri]?.[ci] || ''} onCommit={editable?.onExtraCell ? (v) => editable.onExtraCell!(x.id, ri, ci, v) : undefined} multiline block />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <div key={x.id} style={wrap} onClick={() => onSelectExtra?.(x.id)}>
        {body}
      </div>
    );
  };

  const renderExtras = () => {
    const extras = data.extras || [];
    if (!extras.length) return null;
    return <div style={{ marginTop: '4mm', fontSize: `${settings.passageFontSizePt}pt` }}>{extras.map(renderExtra)}</div>;
  };

  // ── QR Code Component ──
  const shareUrl = data.audio?.shareUrl || '';
  const qrCodeUrl = shareUrl ? getAudioQrCodeUrl(shareUrl) : '';
  const qrCodeElement = settings.showQrCode ? (
    <div className="flex flex-col items-center shrink-0">
      {qrCodeUrl ? (
        <img
          src={qrCodeUrl}
          alt="Audio QR"
          style={{
            width: `${qrSizeMm}mm`,
            height: `${qrSizeMm}mm`,
            border: '1pt solid #cbd5e1',
            borderRadius: '1.5mm',
            padding: '1mm',
            background: '#fff',
          }}
        />
      ) : (
        <div
          style={{
            width: `${qrSizeMm}mm`,
            height: `${qrSizeMm}mm`,
            border: '1pt dashed #94a3b8',
            borderRadius: '1.5mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontSize: '6pt',
            color: '#94a3b8',
            padding: '1mm',
          }}
        >
          Chưa có link audio
        </div>
      )}
      {!sampleStyle && (
        <span style={{ fontSize: '6.5pt', fontWeight: 700, color: '#64748b', marginTop: '0.5mm', textTransform: 'uppercase' }}>
          Scan for Audio
        </span>
      )}
    </div>
  ) : null;

  // ── 1. Original Layout (1 column: each paragraph row has its own image on the right) ──
  const renderOriginalLayout = () => {
    const pos = settings.imagePosition;
    return (
      <div style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
        {data.paragraphs.map((para, idx) => {
          const showImg = pos !== 'none' && !!para.imageAssetUrl;
          const image = showImg ? (
            <div
              className="shrink-0 overflow-hidden"
              style={{
                width: `${settings.imageWidthPercent || 30}%`,
                borderRadius: '2mm',
                alignSelf: 'center',
              }}
            >
              <img
                src={para.imageAssetUrl}
                alt={para.imageCaption || ''}
                style={{
                  width: '100%',
                  aspectRatio: settings.maintainAspectRatio ? '4 / 3' : undefined,
                  height: settings.maintainAspectRatio ? 'auto' : '23mm',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : null;

          return (
            <div
              key={para.id || idx}
              style={{ marginBottom: paragraphSpacingMargin, breakInside: 'avoid' }}
              className={`flex gap-[3.5mm] ${pos === 'top' ? 'flex-col' : ''}`}
            >
              {pos === 'left' && image}
              {pos === 'top' && image}
              <div className="flex-1 min-w-0 flex items-start gap-[2mm]" style={{ textAlign: 'left' }}>
                {renderMarker(para, idx)}
                <div className="flex-1">{renderParagraphContent(para, idx)}</div>
              </div>
              {pos === 'right' && image}
            </div>
          );
        })}
      </div>
    );
  };

  // ── 2. Numbered Blanks Layout (Identical to 1, but blanks show 1..13) ──
  const renderNumberedLayout = () => {
    return renderOriginalLayout();
  };

  // ── 3. Two Columns Layout ──
  const renderTwoColumnsLayout = () => {
    const col1Paras = data.paragraphs.slice(0, 2);
    const col2Paras = data.paragraphs.slice(2);

    return (
      <div
        className="grid grid-cols-2 gap-[5mm] items-start"
        style={{ fontSize: `${settings.passageFontSizePt - 0.5}pt`, lineHeight: Math.min(lineHeight, 1.6) }}
      >
        {/* Column 1 */}
        <div className="space-y-[3mm] pr-[2.5mm] border-r border-slate-200">
          {col1Paras.map((para, idx) => (
            <div key={para.id || idx} className="space-y-[2mm]">
              <div className="flex items-start gap-[1.5mm] text-justify">
                {renderMarker(para, idx)}
                <div className="flex-1">{renderParagraphContent(para, idx)}</div>
              </div>
              {para.imageAssetUrl && settings.imagePosition !== 'none' && (
                <img
                  src={para.imageAssetUrl}
                  alt=""
                  style={{ width: '100%', height: '28mm', objectFit: 'cover', borderRadius: '1.5mm' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Column 2 */}
        <div className="space-y-[3mm] pl-[2.5mm]">
          {col2Paras.map((para, idx) => (
            <div key={para.id || idx + 2} className="space-y-[2mm]">
              <div className="flex items-start gap-[1.5mm] text-justify">
                {renderMarker(para, idx + 2)}
                <div className="flex-1">{renderParagraphContent(para, idx + 2)}</div>
              </div>
              {para.imageAssetUrl && idx === 0 && settings.imagePosition !== 'none' && (
                <img
                  src={para.imageAssetUrl}
                  alt=""
                  style={{ width: '100%', height: '28mm', objectFit: 'cover', borderRadius: '1.5mm' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── 4. Answer Grid Layout (Passage + YOUR ANSWERS grid below) ──
  const renderAnswerGridLayout = () => {
    const row1Blanks = data.blanks.slice(0, 7);
    const row2Blanks = data.blanks.slice(7);

    return (
      <div className="space-y-[4mm]" style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
        {/* Passage text (compact without float images) */}
        <div className="space-y-[2mm]">
          {data.paragraphs.map((para, idx) => (
            <div key={para.id || idx} className="flex items-start gap-[2mm] text-justify">
              {renderMarker(para, idx)}
              <div className="flex-1">{renderParagraphContent(para, idx)}</div>
            </div>
          ))}
        </div>

        {/* YOUR ANSWERS Grid */}
        <div className="mt-[4mm] pt-[3mm] border-t border-slate-300">
          <div style={{ fontSize: '9pt', fontWeight: 800, color: NAVY, textTransform: 'uppercase', marginBottom: '2mm', letterSpacing: '0.04em' }}>
            YOUR ANSWERS
          </div>

          {/* Row 1 */}
          <div className="grid grid-cols-7 gap-[2mm] mb-[2mm]">
            {row1Blanks.map((b) => (
              <div key={b.id} className="border border-slate-400 rounded-[1.2mm] p-[1.5mm] bg-white flex flex-col justify-between" style={{ height: '11mm' }}>
                <span style={{ fontSize: '8pt', fontWeight: 800, color: '#475569' }}>{b.label}.</span>
                <span style={{ fontSize: '8.5pt', fontWeight: 700, color: '#1d4ed8', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showKey ? b.correctAnswer : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-7 gap-[2mm]">
            {row2Blanks.map((b) => (
              <div key={b.id} className="border border-slate-400 rounded-[1.2mm] p-[1.5mm] bg-white flex flex-col justify-between" style={{ height: '11mm' }}>
                <span style={{ fontSize: '8pt', fontWeight: 800, color: '#475569' }}>{b.label}.</span>
                <span style={{ fontSize: '8.5pt', fontWeight: 700, color: '#1d4ed8', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showKey ? b.correctAnswer : ''}
                </span>
              </div>
            ))}
            {/* Empty filler cells */}
            {Array.from({ length: Math.max(0, 7 - row2Blanks.length) }).map((_, i) => (
              <div key={`empty_${i}`} className="opacity-0" />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── 5. Spaced Blocks Layout (Từng câu riêng biệt, nhiều khoảng trống) ──
  const renderSpacedBlocksLayout = () => {
    return (
      <div className="space-y-[4.5mm]" style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight: 1.7 }}>
        {data.paragraphs.map((para, idx) => (
          <div
            key={para.id || idx}
            style={{
              padding: '2.5mm 3.5mm',
              backgroundColor: '#f8fafc',
              border: '0.8pt solid #e2e8f0',
              borderRadius: '2mm',
              breakInside: 'avoid',
            }}
            className="flex items-start gap-[2.5mm] text-justify"
          >
            <span
              style={{
                width: '5.5mm',
                height: '5.5mm',
                borderRadius: '1mm',
                backgroundColor: NAVY,
                color: '#fff',
                fontSize: '9pt',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                
                marginTop: '0.5mm',
              }}
            >
              {para.order || idx + 1}
            </span>
            <div className="flex-1">
              {renderParagraphContent(para, idx)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── 6. Illustrated Layout (Mỗi đoạn văn 1 ảnh riêng bên trái) ──
  const renderIllustratedLayout = () => {
    return (
      <div className="space-y-[3.5mm]" style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
        {data.paragraphs.map((para, idx) => (
          <div
            key={para.id || idx}
            className="flex items-start gap-[3.5mm] text-justify"
            style={{ breakInside: 'avoid' }}
          >
            {para.imageAssetUrl && (
              <div className="shrink-0" style={{ width: '28mm' }}>
                <img
                  src={para.imageAssetUrl}
                  alt={para.imageCaption || ''}
                  style={{ width: '28mm', height: '20mm', objectFit: 'cover', borderRadius: '1.5mm', border: '0.8pt solid #cbd5e1' }}
                />
              </div>
            )}
            <div className="flex-1 flex items-start gap-[2mm]">
              {renderMarker(para, idx)}
              <div className="flex-1">
                {renderParagraphContent(para, idx)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── 9. Bài đọc + ảnh lớn: đoạn không đánh số (thụt dòng đầu), ảnh bên phải có QR đè góc, câu hỏi trả lời ngắn bên dưới ──
  const BODY_IMG_W_MM = 66;
  const renderPassageImageLayout = () => {
    const img = data.bodyImage || {};
    const ratio = img.ratio || 3 / 2;
    const questions = data.questions || [];
    return (
      <div style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
        <div className="flow-root">
          {(img.url || qrCodeElement) && (
            <div className="relative" style={{ float: 'right', width: `${BODY_IMG_W_MM}mm`, margin: '1mm 0 2mm 4mm', ...(img.url ? { aspectRatio: String(ratio) } : {}) }}>
              {img.url ? (
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '2mm', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: String(ratio), border: '0.75pt dashed #9ca3af', borderRadius: '2mm', background: '#f8fafc', color: '#9ca3af', fontSize: '8pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Ảnh</div>
              )}
              {qrCodeElement && settings.qrPosition === 'top_right' && (
                <div className="absolute" style={{ top: '1.2mm', right: '1.2mm' }}>{qrCodeElement}</div>
              )}
            </div>
          )}
          {(formMode
            ? data.paragraphs.flatMap((para, idx) => (para.text || '').split('\n').map((t) => t.trim()).filter(Boolean).map((t, li) => ({ para: { ...para, text: t, marks: undefined }, idx, line: li })))
            : data.paragraphs.map((para, idx) => ({ para, idx, line: -1 }))
          ).map(({ para, idx, line }, k) => (
            <div key={`${para.id || idx}_${k}`} style={formMode ? { marginBottom: paragraphSpacingMargin, textAlign: 'left', paddingLeft: /^\s*\(/.test(para.text) ? '6mm' : 0 } : { marginBottom: paragraphSpacingMargin, textAlign: 'justify', textIndent: '8mm' }}>
              {renderParagraphContent(para, idx, true, line)}
            </div>
          ))}
        </div>
        {questions.length > 0 && (
          <ol style={{ listStyle: 'none', margin: '5mm 0 0', padding: 0 }}>
            {questions.map((q, i) => (
              <li key={q.id} style={{ breakInside: 'avoid', marginBottom: '4mm' }}>
                <div className="flex items-start gap-[3mm]">
                  <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>
                  <span className="flex-1"><EditableSpan value={q.text} placeholder="Question…" onCommit={editable?.onQuestion ? (v) => editable.onQuestion!(q.id, v) : undefined} /></span>
                </div>
                <div style={{ marginLeft: '9mm', marginTop: '5mm', width: '78%', borderBottom: '1pt dashed #444', height: '1px' }} />
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  };

  // ── 13. Danh sách câu hỏi trả lời ngắn: "Conversation 1: câu hỏi" + đường kẻ trả lời bên dưới
  const renderQuestionListLayout = () => (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
      {(data.questions || []).map((q, i) => {
        const m = /^([A-Za-z][A-Za-z ]{0,24}\d*):\s*(.+)$/.exec(q.text);
        return (
          <li key={q.id} style={{ breakInside: 'avoid', marginBottom: '2mm' }}>
            <div className="flex items-baseline gap-[2mm]">
              <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>
              {m && (
                <strong style={{ fontStyle: 'italic', fontWeight: 800, minWidth: '30mm' }}>
                  <EditableSpan value={m[1]} onCommit={editable?.onQuestion ? (v) => editable.onQuestion!(q.id, v.trim() ? `${v.trim()}: ${m[2]}` : m[2]) : undefined} />:
                </strong>
              )}
              <span className="flex-1"><EditableSpan value={m ? m[2] : q.text} placeholder="Question…" onCommit={editable?.onQuestion ? (v) => editable.onQuestion!(q.id, m ? `${m[1]}: ${v}` : v) : undefined} /></span>
            </div>
            <div style={{ marginLeft: '8mm', marginTop: '5mm', marginBottom: '2mm', width: '92%', borderBottom: '1pt dashed #444', height: '1px' }} />
          </li>
        );
      })}
    </ol>
  );

  // ── 10. Dàn ý gạch đầu dòng: "•" dòng chính, "+" dòng con thụt vào; ảnh bên phải ──
  const renderOutlineLayout = () => {
    const img = data.bodyImage || {};
    const ratio = img.ratio || 3 / 4;
    return (
      <div className="flow-root" style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
        <div style={{ float: 'right', width: '44mm', margin: '2mm 0 2mm 6mm', aspectRatio: String(ratio) }}>
          {img.url ? (
            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3mm', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', border: '0.75pt dashed #9ca3af', borderRadius: '3mm', background: '#f8fafc', color: '#9ca3af', fontSize: '8pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Ảnh</div>
          )}
        </div>
        {data.paragraphs.map((para, idx) => {
          const plus = /^\+\s*/.exec(para.text || '');
          const sub = (para.format?.indentMm || 0) > 0 || !!plus;
          const shown = plus ? { ...para, text: para.text.slice(plus[0].length), marks: sliceMarks(para.marks, plus[0].length, para.text.length) } : para;
          return (
            <div key={para.id || idx} className="flex items-start gap-[2mm]" style={{ marginBottom: paragraphSpacingMargin, paddingLeft: sub ? `${para.format?.indentMm || 6}mm` : undefined, breakInside: 'avoid' }}>
              <strong style={{ fontWeight: 800, minWidth: '3mm', color: '#0f172a' }}>{sub ? '+' : '•'}</strong>
              <div className="flex-1 min-w-0">{renderParagraphContent(shown, idx, true)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── 8. Bài đọc + QR: đoạn đánh số kín chữ, QR nhỏ nổi bên phải đầu bài (chữ chạy vòng quanh), không ảnh từng đoạn ──
  const renderPassageQrLayout = () => (
    <div className="flow-root" style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
      {qrCodeElement && settings.qrPosition === 'top_right' && (
        <div style={{ float: 'right', margin: '0 0 1.5mm 3mm' }}>{qrCodeElement}</div>
      )}
      {data.paragraphs.map((para, idx) => (
        <div key={para.id || idx} className="flex items-start gap-[3mm]" style={{ marginBottom: paragraphSpacingMargin, textAlign: 'justify' }}>
          {renderMarker(para, idx)}
          <div className="flex-1 min-w-0">{renderParagraphContent(para, idx)}</div>
        </div>
      ))}
    </div>
  );

  // ── 7. Dialogue Layout (hội thoại: tên người nói in đậm, mỗi lượt là một đoạn, không đánh số) ──
  // Mỗi người nói một màu: người thứ nhất navy, thứ hai đỏ đậm, rồi xanh ngọc, xanh lá
  const SPEAKER_COLORS = [NAVY, '#b91c1c', '#0e7490', '#15803d'];
  const renderDialogueLayout = () => {
    const order: string[] = [];
    return (
      <div style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight, paddingLeft: '6mm' }}>
        {data.paragraphs.map((para, idx) => {
          const m = SPEAKER_RE.exec(para.text || '');
          const speaker = m ? m[1].toUpperCase() : '';
          if (speaker && !order.includes(speaker)) order.push(speaker);
          const color = SPEAKER_COLORS[Math.max(0, order.indexOf(speaker)) % SPEAKER_COLORS.length];
          const rest = m ? para.text.slice(m[0].length) : para.text;
          const f = para.format || {};
          return (
            <div key={para.id || idx} style={{ marginBottom: paragraphSpacingMargin, textAlign: f.align || 'justify', paddingLeft: f.indentMm ? `${f.indentMm}mm` : undefined, breakInside: 'avoid' }}>
              {speaker && (
                <strong style={{ color, fontWeight: 800, marginRight: '2.2mm' }}>
                  <EditableSpan
                    value={speaker}
                    onCommit={editable?.onParagraphText ? (v) => editable.onParagraphText!(para.id, (t) => {
                      const mm = SPEAKER_RE.exec(t);
                      const rest2 = mm ? t.slice(mm[0].length) : t;
                      const name = v.trim().replace(/:$/, '').replace(/^./, (c) => c.toUpperCase());
                      return name ? `${name}: ${rest2}` : rest2;
                    }) : undefined}
                  />:
                </strong>
              )}
              {renderParagraphContent({ ...para, text: rest, marks: sliceMarks(para.marks, para.text.length - rest.length, para.text.length) }, idx, true)}
            </div>
          );
        })}
      </div>
    );
  };

  // ── 11. Câu rời đánh số: mỗi đoạn là một câu, không có số đoạn, chỗ trống (1), (2)…
  const renderSentenceListLayout = () => (
    <div style={{ fontSize: `${settings.passageFontSizePt}pt`, lineHeight, paddingLeft: '1mm' }}>
      {data.paragraphs.map((para, idx) => (
        <div key={para.id || idx} style={{ marginBottom: paragraphSpacingMargin }}>
          {renderParagraphContent(para, idx)}
        </div>
      ))}
    </div>
  );

  // ── 12. Cột có tiêu đề: đoạn bắt đầu bằng "## " mở một cột mới; không có tiêu đề nào thì chia hai cột đều
  const renderHeadedColumnsLayout = () => {
    const cols: { heading?: string; headingParaId?: string; items: { para: ListeningParagraph; idx: number }[] }[] = [];
    data.paragraphs.forEach((para, idx) => {
      const m = /^\s*##\s*(.+)$/.exec(para.text || '');
      if (m) cols.push({ heading: m[1].trim(), headingParaId: para.id, items: [] });
      else {
        if (!cols.length) cols.push({ items: [] });
        cols[cols.length - 1].items.push({ para, idx });
      }
    });
    if (cols.length === 1 && !cols[0].heading && cols[0].items.length > 1) {
      const all = cols[0].items;
      const half = Math.ceil(all.length / 2);
      cols.splice(0, 1, { items: all.slice(0, half) }, { items: all.slice(half) });
    }
    return (
      <div className="grid items-start gap-x-[8mm]" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols.length)}, minmax(0, 1fr))`, fontSize: `${settings.passageFontSizePt}pt`, lineHeight }}>
        {cols.map((col, ci) => (
          <div key={ci}>
            {col.heading && <div style={{ fontFamily: HEAD_FONT, fontWeight: 800, textTransform: 'uppercase', marginBottom: '2.5mm', color: '#0f172a' }}><EditableSpan value={col.heading} onCommit={editable?.onParagraphText && col.headingParaId ? (v) => editable.onParagraphText!(col.headingParaId!, (t) => t.replace(/^(\s*##\s*).*$/m, `$1${v}`)) : undefined} /></div>}
            {col.items.map(({ para, idx }) => (
              <div key={para.id || idx} style={{ marginBottom: paragraphSpacingMargin, breakInside: 'avoid' }}>
                {renderParagraphContent(para, idx)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  /** Tiêu đề có nhấn màu: phần đặt trong {{ }} in nghiêng, màu đỏ */
  const richTitle = (t: string) => t.split(/(\{\{[^}]+\}\})/).filter(Boolean).map((p, i) => (/^\{\{[^}]+\}\}$/.test(p) ? <em key={i} style={{ color: '#c8102e', fontWeight: 800 }}>{p.slice(2, -2)}</em> : <span key={i}>{p}</span>));

  // Edit Mode: cả phần bài đọc là một vùng soạn liền mạch (Ctrl+A chọn mọi đoạn, kéo chọn xuyên đoạn...)
  const wrapDoc = (body: React.ReactNode) =>
    editable?.paragraphs && !showKey && !formMode
      ? <A4DocHost paragraphs={data.paragraphs} editing={editable.paragraphs}>{body}</A4DocHost>
      : body;

  return (
    <div style={fontStyle} className="listening-gap-fill-content text-[#111] flow-root">
      {/* Hội thoại: QR nổi bên phải, các lượt nói chạy ngay dưới tiêu đề và vòng quanh QR */}
      {dialogue && !hideExerciseHeading && settings.qrPosition === 'top_right' && qrCodeElement && (
        <div style={{ float: 'right', margin: '0 0 2mm 4mm' }}>{qrCodeElement}</div>
      )}
      {/* ───── Exercise Heading Bar: [3] [Headphone] LISTEN AND FILL IN THE GAP + QR Code ───── */}
      {!hideExerciseHeading && (
        <div className="flex items-start justify-between gap-[3mm] mb-[3mm]">
          <div className="flex items-center gap-[2mm] pt-[1mm]">
            {/* Blue square with exercise number */}
            <span
              style={{
                width: '5.4mm',
                height: '5.4mm',
                background: NAVY,
                color: '#fff',
                borderRadius: '1mm',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '11pt',
                fontFamily: HEAD_FONT,
                lineHeight: 1,
              }}
            >
              {editable?.onExerciseNumber ? (
                <EditableSpan value={String(exerciseIndex)} onCommit={(v) => { const n = parseInt(v, 10); if (Number.isFinite(n) && n > 0) editable.onExerciseNumber!(n); }} />
              ) : exerciseIndex}
            </span>

            {/* Audio headphone icon */}
            {settings.showAudioIcon && (
              <Headphones size={18} strokeWidth={2.5} style={{ color: NAVY }} />
            )}

            {/* Title */}
            {settings.showExerciseTitle && (
              <h2
                style={{
                  margin: 0,
                  color: NAVY,
                  fontFamily: HEAD_FONT,
                  fontWeight: 800,
                  fontSize: '12.5pt',
                  textTransform: 'uppercase',
                  letterSpacing: '0.01em',
                  lineHeight: 1.2,
                }}
              >
                {editable?.onTitle ? <EditableSpan value={data.exerciseTitle} onCommit={editable.onTitle} /> : richTitle(data.exerciseTitle)}
              </h2>
            )}
          </div>

          {/* Top Right QR Code */}
          {(data.headerImage?.url || (settings.qrPosition === 'top_right' && !dialogue && !passageQr && !passageImage && qrCodeElement)) && (
            <div className="flex items-start gap-[3mm] shrink-0">
              {data.headerImage?.url && <img src={data.headerImage.url} alt="" style={{ height: '22mm', width: 'auto', maxWidth: '34mm', objectFit: 'contain' }} />}
              {settings.qrPosition === 'top_right' && !dialogue && !passageQr && !passageImage && qrCodeElement}
            </div>
          )}
        </div>
      )}

      {(data.intro || editable?.onIntro) && !hideExerciseHeading && (
        <p style={{ margin: '0 0 3mm', fontStyle: 'italic', fontWeight: 700, fontSize: '10pt' }}>
          <EditableSpan value={data.intro || ''} onCommit={editable?.onIntro} placeholder="Intro line…" />
        </p>
      )}

      {/* ───── Passage Title: THINGS TO SEE AND DO IN LONDON ───── */}
      {settings.showPassageTitle && data.passageTitle && (
        <div style={{ textAlign: 'center', marginBottom: '3.5mm' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: HEAD_FONT,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              fontSize: `${settings.headingFontSizePt || 14}pt`,
              color: '#0f172a',
            }}
          >
            <EditableSpan value={data.passageTitle} onCommit={editable?.onPassageTitle} />
          </h3>
        </div>
      )}

      {/* ───── Main Body according to Selected Layout ───── */}
      {wrapDoc(<>
      {settings.layout === 'numbered' && renderNumberedLayout()}
      {settings.layout === 'two_columns' && renderTwoColumnsLayout()}
      {settings.layout === 'answer_grid' && renderAnswerGridLayout()}
      {settings.layout === 'spaced_blocks' && renderSpacedBlocksLayout()}
      {settings.layout === 'illustrated' && renderIllustratedLayout()}
      {settings.layout === 'dialogue' && renderDialogueLayout()}
      {settings.layout === 'passage_qr' && renderPassageQrLayout()}
      {settings.layout === 'sentence_list' && renderSentenceListLayout()}
      {settings.layout === 'headed_columns' && renderHeadedColumnsLayout()}
      {settings.layout === 'question_list' && renderQuestionListLayout()}
      {settings.layout === 'passage_image' && renderPassageImageLayout()}
      {outline && renderOutlineLayout()}
      {(settings.layout === 'original' || !settings.layout) && renderOriginalLayout()}
      </>)}

      {renderExtras()}

      {/* ───── Bottom QR Code if configured ───── */}
      {settings.qrPosition === 'bottom_right' && (
        <div className="flex justify-end mt-[4mm]">
          {qrCodeElement}
        </div>
      )}
    </div>
  );
};
