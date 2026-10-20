import React from 'react';
import type { GrammarMcqData, McqQuestion, McqStyleKey } from '../../services/grammar-mcq/grammarMcqCore';
import { splitUnderline, optionLabel, resolveOptionColumns, splitBlanks } from '../../services/grammar-mcq/grammarMcqCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface McqEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onQuestion?: (id: string, v: string) => void;
  onOption?: (qid: string, oid: string, v: string) => void;
  selectedKey?: McqStyleKey;
  onSelectKey?: (k: McqStyleKey) => void;
  /** Câu đang chọn (viền nổi bật) và hàm chọn câu */
  selectedQuestionId?: string | null;
  onSelectQuestion?: (id: string) => void;
}

interface Props {
  data: GrammarMcqData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  editable?: McqEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
}> = ({ value, onCommit, css, selected, onSelect }) => {
  if (!onCommit) return <span style={css}>{splitUnderline(value).map((p, i) => (p.underline ? <u key={i} style={{ textUnderlineOffset: '1.5px' }}>{p.text}</u> : <span key={i}>{p.text}</span>))}</span>;
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

export const GrammarMcqRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, questions } = data;
  const css = (k: McqStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: McqStyleKey) => editable?.selectedKey === k;
  const pick = (k: McqStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const gap = settings.questionGapMm;
  const layout = settings.layout;

  const blankSpan = (key: string, width = 22) => (
    <span key={key} style={{ display: 'inline-block', width: `${width}mm`, borderBottom: '1pt dashed #222', margin: '0 0.6mm', lineHeight: 1, verticalAlign: 'baseline' }}>&nbsp;</span>
  );

  /** Câu hỏi: gạch dưới liên tiếp thành chỗ trống; khi sửa trực tiếp thì hiện chữ gốc */
  const renderText = (q: McqQuestion) => {
    if (editable?.onQuestion) {
      return <EditableText value={q.text} onCommit={(v) => editable.onQuestion!(q.id, v)} css={css('questions')} selected={sel('questions')} onSelect={pick('questions')} />;
    }
    return (
      <span style={css('questions')}>
        {splitBlanks(q.text).map((p, i) => (p.type === 'blank' ? blankSpan(String(i)) : <span key={i}>{p.text}</span>))}
      </span>
    );
  };

  const renderOption = (q: McqQuestion, oi: number) => {
    const o = q.options[oi];
    return (
      <span key={o.id} style={css('options')}>
        <strong style={{ fontWeight: 800 }}>{optionLabel(oi, settings.optionLabelStyle)}.</strong>{' '}
        <EditableText value={o.text} onCommit={editable?.onOption ? (v) => editable.onOption!(q.id, o.id, v) : undefined} css={css('options')} selected={sel('options')} onSelect={pick('options')} />
      </span>
    );
  };

  const optionsGrid = (q: McqQuestion, cols: number, indentMm = 7) => (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: '4mm', rowGap: '0.6mm', paddingLeft: `${indentMm}mm`, marginTop: '0.8mm' }}>
      {q.options.map((_, oi) => renderOption(q, oi))}
    </div>
  );

  const numberTag = (i: number, minMm = 7) => (settings.showNumbering ? <strong style={{ minWidth: `${minMm}mm`, fontWeight: 800 }}>{i + 1}.</strong> : null);
  const answerBox = settings.showAnswerBoxes ? (
    <span className="shrink-0" style={{ width: '7mm', height: '6mm', border: '0.75pt solid #444', borderRadius: '1mm' }} />
  ) : null;

  const wrapper = (q: McqQuestion, children: React.ReactNode, style?: React.CSSProperties) => (
    <div
      key={q.id}
      onClick={() => editable?.onSelectQuestion?.(q.id)}
      style={{ breakInside: 'avoid', marginBottom: `${gap}mm`, outline: editable?.selectedQuestionId === q.id ? '1px dashed #3b82f6' : undefined, outlineOffset: '1.5mm', ...style }}
    >
      {children}
    </div>
  );

  const head = (q: McqQuestion, i: number) => (
    <div className="flex items-start gap-[1.5mm]">
      {numberTag(i)}
      <span className="flex-1">{renderText(q)}</span>
      {answerBox}
    </div>
  );

  const body = () => {
    if (data.sentenceMode) {
      const w = { long: '100%', medium: '70%', short: '45%' }[data.answerLineLength || 'long'];
      return (
        <div>
          {questions.map((q, i) => wrapper(q, (
            <>
              <div className="flex items-start gap-[1.5mm]">
                {numberTag(i)}
                <span className="flex-1">{renderText(q)}</span>
              </div>
              {settings.showAnswerBoxes && Array.from({ length: Math.max(1, data.answerLines || 1) }).map((_, li) => (
                <div key={li} style={{ marginLeft: settings.showNumbering ? '7mm' : 0, width: settings.showNumbering ? `calc(${w} - 7mm)` : w, borderBottom: '1pt dashed #444', height: '7mm' }} />
              ))}
            </>
          ), { marginBottom: `${Math.max(gap, 3)}mm` }))}
        </div>
      );
    }
    if (data.pronunciation) {
      // Một câu một hàng: số thứ tự + các từ A / B / C / D chia đều (từ có phần gạch chân)
      return (
        <div>
          {questions.map((q, i) => {
            // Số câu đếm lại từ 1 sau mỗi tiêu đề phần (A. / B.)
            let start = 0;
            for (let k = 0; k <= i; k++) if (questions[k].heading !== undefined) start = k;
            return (
              <React.Fragment key={q.id}>
                {q.heading !== undefined && q.heading !== '' && (
                  <div style={{ fontWeight: 800, fontStyle: 'italic', margin: `${i === 0 ? 0 : 2}mm 0 3mm` }}>{q.heading}</div>
                )}
                {wrapper(q, (
                  <div className="flex items-baseline gap-[1.5mm]">
                    {numberTag(i - start)}
                    <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, q.options.length)}, minmax(0, 1fr))`, columnGap: '4mm' }}>
                      {q.options.map((_, oi) => renderOption(q, oi))}
                    </div>
                    {answerBox}
                  </div>
                ), { marginBottom: `${Math.max(gap, 4)}mm` })}
              </React.Fragment>
            );
          })}
        </div>
      );
    }
    switch (layout) {
      case 'two_columns':
        return (
          <div style={{ columnCount: 2, columnGap: '8mm' }}>
            {questions.map((q, i) => wrapper(q, <>{head(q, i)}{optionsGrid(q, resolveOptionColumns(q, settings.optionColumns) === 1 ? 1 : 2, 6)}</>))}
          </div>
        );
      case 'compact':
        return (
          <div style={{ fontSize: '0.95em' }}>
            {questions.map((q, i) =>
              wrapper(
                q,
                <>
                  {head(q, i)}
                  <div className="flex flex-wrap" style={{ gap: '0 6mm', paddingLeft: '7mm' }}>{q.options.map((_, oi) => renderOption(q, oi))}</div>
                </>,
                { marginBottom: `${Math.max(1.5, gap / 2)}mm` },
              ),
            )}
          </div>
        );
      case 'answer_grid': {
        const cols = Math.max(2, Math.max(...questions.map((q) => q.options.length), 4));
        const border = '0.75pt solid #94a3b8';
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '6%' }} /><col style={{ width: '34%' }} />{Array.from({ length: cols }).map((_, i) => <col key={i} />)}</colgroup>
            <thead>
              <tr>
                <th style={{ border, padding: '1.5mm', fontWeight: 800 }}>No.</th>
                <th style={{ border, padding: '1.5mm', fontWeight: 800, textAlign: 'left' }}>Question</th>
                {Array.from({ length: cols }).map((_, i) => <th key={i} style={{ border, padding: '1.5mm', fontWeight: 800 }}>{optionLabel(i, settings.optionLabelStyle)}</th>)}
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={q.id} style={{ breakInside: 'avoid' }} onClick={() => editable?.onSelectQuestion?.(q.id)}>
                  <td style={{ border, padding: '1.5mm', textAlign: 'center', fontWeight: 800 }}>{i + 1}</td>
                  <td style={{ border, padding: '1.5mm' }}>{renderText(q)}</td>
                  {Array.from({ length: cols }).map((_, oi) => (
                    <td key={oi} style={{ border, padding: '1.5mm', fontSize: '0.95em' }}>
                      {q.options[oi] && (
                        <EditableText value={q.options[oi].text} onCommit={editable?.onOption ? (v) => editable.onOption!(q.id, q.options[oi].id, v) : undefined} css={css('options')} selected={sel('options')} onSelect={pick('options')} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case 'question_blocks':
        return (
          <div>
            {questions.map((q, i) =>
              wrapper(
                q,
                <>{head(q, i)}{optionsGrid(q, resolveOptionColumns(q, settings.optionColumns) === 1 ? 1 : 2, 7)}</>,
                { border: '0.75pt solid #cbd5e1', borderRadius: '2mm', padding: '2.2mm 3mm', background: '#f8fafc' },
              ),
            )}
          </div>
        );
      case 'exam_style':
        return (
          <div>
            {questions.map((q, i) =>
              wrapper(
                q,
                <>
                  <div className="flex items-start gap-[2mm]">
                    <span className="shrink-0" style={{ width: '9mm', height: '6mm', border: '0.75pt solid #444', borderRadius: '1mm', marginTop: '0.4mm' }} />
                    {numberTag(i, 6)}
                    <span className="flex-1">{renderText(q)}</span>
                  </div>
                  <div className="flex justify-between gap-[4mm]" style={{ paddingLeft: '17mm', marginTop: '0.8mm' }}>
                    {q.options.map((o, oi) => (
                      <span key={o.id} style={css('options')}>
                        <strong style={{ fontWeight: 800 }}>{optionLabel(oi, 'uppercase')}.</strong>{' '}
                        <EditableText value={o.text} onCommit={editable?.onOption ? (v) => editable.onOption!(q.id, o.id, v) : undefined} css={css('options')} selected={sel('options')} onSelect={pick('options')} />
                      </span>
                    ))}
                  </div>
                </>,
              ),
            )}
          </div>
        );
      case 'original':
      default:
        return <div>{questions.map((q, i) => wrapper(q, <>{head(q, i)}{optionsGrid(q, resolveOptionColumns(q, settings.optionColumns))}</>))}</div>;
    }
  };

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-center gap-[2.5mm] mb-[3mm]">
          <span style={{ width: '5.4mm', height: '5.4mm', background: NAVY, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0 }}>
            {data.exerciseNumber || exerciseIndex}
          </span>
          <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
            <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} />
          </h2>
        </div>
      )}
      {settings.showInstruction && data.instruction && !hideExerciseHeading && (
        <p className="italic mb-[3mm]" style={{ fontSize: '10pt', ...css('instruction') }}>
          <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
        </p>
      )}
      {body()}
    </div>
  );
};
