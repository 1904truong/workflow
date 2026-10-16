import React from 'react';
import type { TfngData, TfngStyleKey } from '../../services/tfng/tfngCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';

const NAVY = '#16295f';
const RED = '#c81e1e';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const OPTIONS = ['T', 'F', 'NG'] as const;

export interface TfngEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onStatement?: (id: string, v: string) => void;
  selectedKey?: TfngStyleKey;
  onSelectKey?: (k: TfngStyleKey) => void;
}

interface Props {
  data: TfngData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: chữ sửa trực tiếp được trên trang (Edit Mode) */
  editable?: TfngEditable;
}

/** [[chữ]] -> đỏ đậm (TRUE / FALSE / NOT GIVEN); **chữ** -> đậm */
const RichText = ({ text }: { text: string }) => (
  <>
    {text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('[[') && part.endsWith(']]')) return <span key={i} style={{ color: RED }}>{part.slice(2, -2)}</span>;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    })}
  </>
);

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  /** Hiển thị có tô màu khi không sửa */
  rich?: boolean;
}> = ({ value, onCommit, css, selected, onSelect, rich }) => {
  if (!onCommit) return <span style={css}>{rich ? <RichText text={value} /> : value}</span>;
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

type Kind = 'plain' | 'checkbox' | 'circle' | 'underline';

/** Nhóm lựa chọn T / F / NG theo kiểu của layout. `labels` = hiện chữ dưới ô (checkbox ở layout 5/6 dùng chữ ở tiêu đề). */
const AnswerOptions: React.FC<{ kind: Kind; labels?: boolean }> = ({ kind, labels = true }) => (
  <span className="shrink-0 flex items-end" style={{ gap: kind === 'circle' ? '2mm' : kind === 'plain' ? '5mm' : '4mm' }}>
    {OPTIONS.map((o) => {
      if (kind === 'plain') {
        return <span key={o} style={{ minWidth: o === 'NG' ? '7mm' : '4mm', textAlign: 'center', fontWeight: 700, fontSize: '10pt', lineHeight: 1 }}>{o}</span>;
      }
      if (kind === 'circle') {
        return (
          <span key={o} style={{ width: '7.4mm', height: '7.4mm', boxSizing: 'border-box', flexShrink: 0, border: '1pt solid #111', color: '#111', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: o === 'NG' ? '8pt' : '10pt', lineHeight: 1, letterSpacing: o === 'NG' ? '-0.02em' : 0 }}>{o}</span>
        );
      }
      if (kind === 'checkbox') {
        return (
          <span key={o} className="inline-flex flex-col items-center" style={{ gap: '0.6mm', minWidth: '7mm' }}>
            <span style={{ width: '4.4mm', height: '4.4mm', border: '0.9pt solid #1d4ed8', borderRadius: '0.6mm', display: 'block' }} />
            {labels && <span style={{ fontWeight: 700, fontSize: '8.5pt', lineHeight: 1 }}>{o}</span>}
          </span>
        );
      }
      return (
        <span key={o} className="inline-flex items-end" style={{ gap: '1mm' }}>
          <span className="inline-flex flex-col items-center" style={{ minWidth: o === 'NG' ? '9mm' : '7mm' }}>
            <span style={{ fontWeight: 700, fontSize: '9.5pt', lineHeight: 1.2, borderBottom: '0.9pt solid #1f2937', width: '100%', textAlign: 'center' }}>{o}</span>
          </span>
          {o !== 'NG' && <span style={{ fontWeight: 700 }}>/</span>}
        </span>
      );
    })}
  </span>
);

export const TfngRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, statements, image } = data;
  const css = (k: TfngStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: TfngStyleKey) => editable?.selectedKey === k;
  const pick = (k: TfngStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const mascotH = settings.imageHeightMm || 22;

  const mascot = settings.showImage ? (
    image.url ? (
      <img src={image.url} alt="" style={{ height: `${mascotH}mm`, width: 'auto', maxWidth: '36mm', objectFit: 'contain', display: 'block' }} />
    ) : editable ? (
      <div style={{ height: `${mascotH}mm`, width: `${mascotH * 0.85}mm`, border: '0.75pt dashed #9ca3af', borderRadius: '2mm', background: '#f8fafc', color: '#9ca3af', fontSize: '7pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Mascot</div>
    ) : null
  ) : null;

  const layout = settings.layout;
  const rowGap = `${settings.rowGapMm}mm`;
  const num = (i: number) => settings.showNumbering && <strong style={{ minWidth: '6mm', fontWeight: 800 }}>{i + 1}.</strong>;
  const text = (st: TfngData['statements'][number]) => (
    <EditableText value={st.text} onCommit={editable?.onStatement ? (v) => editable.onStatement!(st.id, v) : undefined} css={css('statements')} selected={sel('statements')} onSelect={pick('statements')} />
  );

  const renderBody = () => {
    // 6. Answer Grid: bảng No. / Statement / T / F / NG
    if (layout === 'answer_grid') {
      const cell: React.CSSProperties = { border: '0.75pt solid #94a3b8', padding: '1.6mm 2mm' };
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#e8f0fb' }}>
              <th style={{ ...cell, width: '11mm', textAlign: 'center' }}>No.</th>
              <th style={{ ...cell, textAlign: 'center' }}>Statement</th>
              {OPTIONS.map((o) => <th key={o} style={{ ...cell, width: '13mm', textAlign: 'center' }}>{o}</th>)}
            </tr>
          </thead>
          <tbody>
            {statements.map((st, i) => (
              <tr key={st.id} style={{ breakInside: 'avoid' }}>
                <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{i + 1}.</td>
                <td style={{ ...cell, ...css('statements') }}>{text(st)}</td>
                {OPTIONS.map((o) => (
                  <td key={o} style={{ ...cell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', width: '4.2mm', height: '4.2mm', border: '0.9pt solid #1d4ed8', borderRadius: '0.6mm', verticalAlign: 'middle' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    // 5. Two-Column Compact: hai cột, lựa chọn nằm dưới mỗi câu
    if (layout === 'two_columns') {
      return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, columnCount: 2, columnGap: '10mm', columnRule: '0.75pt dotted #94a3b8' }}>
          {statements.map((st, i) => (
            <li key={st.id} style={{ breakInside: 'avoid', marginBottom: rowGap }}>
              <div className="flex items-start gap-[2mm]">{num(i)}<span className="flex-1" style={css('statements')}>{text(st)}</span></div>
              <div style={{ marginLeft: settings.showNumbering ? '8mm' : 0, marginTop: '1.5mm', display: 'flex', gap: '6mm', fontWeight: 700, fontSize: '10pt' }}>
                {OPTIONS.map((o) => <span key={o}>{o}</span>)}
              </div>
            </li>
          ))}
        </ol>
      );
    }
    // 1–4: một cột, lựa chọn ở cuối dòng
    const kind: Kind = layout === 'checkbox' ? 'checkbox' : layout === 'circle' ? 'circle' : layout === 'underline' ? 'underline' : 'plain';
    return (
      <div>
        {layout === 'checkbox' && (
          <div className="flex justify-end" style={{ marginBottom: '1.5mm' }}>
            <span className="flex" style={{ gap: '4mm' }}>
              {OPTIONS.map((o) => <span key={o} style={{ minWidth: '7mm', textAlign: 'center', fontWeight: 700, fontSize: '9pt' }}>{o}</span>)}
            </span>
          </div>
        )}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {statements.map((st, i) => (
            <li key={st.id} className="flex items-center gap-[3mm]" style={{ breakInside: 'avoid', marginBottom: rowGap }}>
              {num(i)}
              <span className="flex-1" style={css('statements')}>{text(st)}</span>
              <AnswerOptions kind={kind} labels={layout !== 'checkbox'} />
            </li>
          ))}
        </ol>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start justify-between gap-[5mm] mb-[6mm]">
          <div className="flex items-start gap-[3mm] min-w-0 flex-1">
            <span
              style={{ width: '5.6mm', height: '5.6mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0, marginTop: '0.5mm' }}
            >
              {data.exerciseNumber || exerciseIndex}
            </span>
            <div className="min-w-0">
              <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontStyle: 'italic', fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
                <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} rich />
              </h2>
              {data.instruction && (
                <p className="italic mt-[1.5mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
                  <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
                </p>
              )}
            </div>
          </div>
          {mascot}
        </div>
      )}
      {hideExerciseHeading && mascot && <div className="flex justify-end mb-[4mm]">{mascot}</div>}

      {renderBody()}
    </div>
  );
};
