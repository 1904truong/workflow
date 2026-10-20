import React from 'react';
import { Headphones } from 'lucide-react';
import type { ListeningTableData, TableStyleKey } from '../../services/listening-table/listeningTableCore';
import { splitCellLine } from '../../services/listening-table/listeningTableCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { getAudioQrCodeUrl } from '../../services/listening/listeningGapFillCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const DEFAULT_RATIO = 16 / 10;

export interface TableEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onQuestion?: (id: string, v: string) => void;
  selectedKey?: TableStyleKey;
  onSelectKey?: (k: TableStyleKey) => void;
}

interface Props {
  data: ListeningTableData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  editable?: TableEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
}> = ({ value, onCommit, css, selected, onSelect }) => {
  if (!onCommit) return <span style={css}>{value}</span>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="rounded-[2px] cursor-text caret-blue-600 hover:bg-blue-50 focus:bg-blue-50/60 focus:outline focus:outline-1 focus:outline-blue-400 focus:outline-offset-2"
      style={{ ...css, display: 'inline-block', minWidth: '3ch', outline: selected ? '1px solid #8b5cf6' : undefined, outlineOffset: '2px' }}
      onFocus={onSelect}
      onClick={onSelect}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.replace(/ /g, ' ').replace(/\s*\n+\s*/g, ' ').trim();
        if (v !== value) onCommit(v);
        else e.currentTarget.innerText = value;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.currentTarget.innerText = value; e.currentTarget.blur(); }
      }}
    >
      {value}
    </span>
  );
};

export const ListeningTableRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, audio, image, table, questions } = data;
  const css = (k: TableStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: TableStyleKey) => editable?.selectedKey === k;
  const pick = (k: TableStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const qrUrl = audio.shareUrl ? getAudioQrCodeUrl(audio.shareUrl) : '';
  const border = `0.75pt solid ${settings.tableBorderColor}`;
  const imageOnly = settings.layout === 'image_only';
  const ratio = image.ratio || DEFAULT_RATIO;
  const colWidths = table.columns.map((_, i) => (i === 0 ? '17%' : `${(83 / Math.max(1, table.columns.length - 1)).toFixed(2)}%`));

  const qr = settings.showQrCode ? (
    qrUrl ? (
      <img src={qrUrl} alt="Audio QR" style={{ width: '20mm', height: '20mm', background: '#fff', padding: '0.8mm', border: '0.75pt solid #cbd5e1', borderRadius: '1.2mm' }} />
    ) : (
      <div style={{ width: '20mm', height: '20mm', border: '0.75pt dashed #94a3b8', borderRadius: '1.2mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6pt', color: '#94a3b8', textAlign: 'center', padding: '1mm' }}>
        Chưa có link audio
      </div>
    )
  ) : null;

  const renderCell = (text: string) =>
    text.split('\n').map((line, li) => (
      <div key={li} style={{ minHeight: line ? undefined : '1em' }}>
        {splitCellLine(line).map((part, pi) =>
          part.type === 'blank' ? (
            <span key={pi}>
              <strong>({part.label})</strong>
              <span style={{ display: 'inline-block', width: `${settings.blankWidthMm}mm`, borderBottom: '1pt dashed #1e293b', margin: '0 0.8mm 0 1.4mm', lineHeight: 1 }}>&nbsp;</span>
            </span>
          ) : (
            <span key={pi}>{part.text}</span>
          )
        )}
      </div>
    ));

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start justify-between gap-[4mm] mb-[3mm]">
          <div className="flex items-start gap-[2.5mm] min-w-0 flex-1">
            <span style={{ width: '5.4mm', height: '5.4mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0, marginTop: '0.5mm' }}>
              {data.exerciseNumber || exerciseIndex}
            </span>
            {settings.showAudioIcon && <Headphones size={18} strokeWidth={2.5} style={{ color: NAVY, marginTop: '0.4mm', flexShrink: 0 }} />}
            <div className="min-w-0">
              <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
                <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} />
              </h2>
              {data.instruction && (
                <p className={imageOnly ? 'mt-[1.5mm] font-bold' : 'italic mt-[1.5mm]'} style={{ fontSize: '10pt', ...css('instruction') }}>
                  <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
                </p>
              )}
            </div>
          </div>
          {qr}
        </div>
      )}
      {hideExerciseHeading && qr && <div className="flex justify-end mb-[3mm]">{qr}</div>}

      {settings.showImage && (
        <div className="mx-auto mb-[4mm] flex gap-[3mm]" style={{ width: `${settings.imageWidthPercent}%` }}>
          {Array.from({ length: Math.min(4, Math.max(1, settings.imageCount ?? 1)) }).map((_, i) => {
            const slot = i === 0 ? image : image.extra?.[i - 1];
            const slotRatio = (slot?.ratio || (i === 0 ? ratio : DEFAULT_RATIO));
            return (
              <div key={i} className="flex-1 min-w-0" style={{ aspectRatio: String(slotRatio) }}>
                {slot?.url ? (
                  <img src={slot.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3mm', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', border: '0.75pt dashed #9ca3af', borderRadius: '3mm', background: '#f8fafc', color: '#9ca3af', fontSize: '9pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Ảnh / bản đồ
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!imageOnly && <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: '4mm', ...css('table') }}>
        <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={i} style={{ border, padding: '2.2mm 2mm', textAlign: 'center', fontWeight: settings.headerBold ? 800 : 400 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.id} style={{ breakInside: 'avoid' }}>
              {r.cells.map((cell, ci) => (
                <td key={ci} style={{ border, padding: '2mm 2.2mm', verticalAlign: ci === 0 ? 'middle' : 'top', fontWeight: ci === 0 && settings.firstColumnBold ? 800 : 400 }}>
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>}

      {!imageOnly && <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-end gap-[3mm]" style={{ breakInside: 'avoid', marginBottom: `${settings.questionGapMm}mm` }}>
            {settings.showQuestionNumbers && <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>}
            <span style={css('questions')}>
              <EditableText value={q.text} onCommit={editable?.onQuestion ? (v) => editable.onQuestion!(q.id, v) : undefined} css={css('questions')} selected={sel('questions')} onSelect={pick('questions')} />
            </span>
            {settings.showAnswerLines && <span className="flex-1" style={{ borderBottom: '1pt dashed #444', height: '1.1em', minWidth: '30mm' }} />}
          </li>
        ))}
      </ol>}
    </div>
  );
};
