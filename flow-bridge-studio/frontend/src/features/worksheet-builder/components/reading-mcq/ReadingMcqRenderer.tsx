import React from 'react';
import type { McqQuestion } from '../../services/grammar-mcq/grammarMcqCore';
import { optionLabel, splitBlanks } from '../../services/grammar-mcq/grammarMcqCore';
import type { ReadingMcqData, ReadingStyleKey } from '../../services/reading-mcq/readingMcqCore';
import { splitParagraphs } from '../../services/reading-mcq/readingMcqCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';
import { RichEditable } from '../shared/rich/RichEditable';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export interface ReadingMcqEditable {
  onTitle?: (v: string) => void;
  onInstruction?: (v: string) => void;
  onPassageTitle?: (v: string) => void;
  onPassageAuthor?: (v: string) => void;
  /** Sửa một đoạn văn theo vị trí */
  /** Bấm khung ảnh trống để tải ảnh bài báo */
  onPickImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onParagraph?: (index: number, v: string) => void;
  onQuestion?: (id: string, v: string) => void;
  onOption?: (qid: string, oid: string, v: string) => void;
  selectedKey?: ReadingStyleKey;
  onSelectKey?: (k: ReadingStyleKey) => void;
  selectedQuestionId?: string | null;
  onSelectQuestion?: (id: string) => void;
}

interface Props {
  data: ReadingMcqData;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  editable?: ReadingMcqEditable;
}

/** Chữ sửa trực tiếp như Word: bấm là có con trỏ; bấm ra ngoài hoặc Enter để lưu, Esc để hủy */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  block?: boolean;
  /** [[chữ]] -> nghiêng, đỏ, đậm (TRUE (T) / FALSE (F) trong tiêu đề) */
  rich?: boolean;
}> = ({ value, onCommit, css, selected, onSelect, block, rich }) => (
  <RichEditable value={value} onCommit={onCommit} css={css} selected={selected} onSelect={onSelect} display={block ? 'inline' : 'inline-block'} fallback={rich ? value.split(/(\[\[[^\]]+\]\]|\b(?:TRUE|FALSE)\s*\([TF]\))/g).map((part, i) => (/^(\[\[.*\]\]|(?:TRUE|FALSE)\s*\([TF]\))$/.test(part)
      ? <em key={i} style={{ color: '#c81e1e', fontWeight: 800 }}>{part.startsWith('[[') ? part.slice(2, -2) : part}</em>
      : <span key={i}>{part}</span>)) : undefined} />
);

export const ReadingMcqRenderer: React.FC<Props> = ({ data, exerciseIndex = 1, hideExerciseHeading = false, editable }) => {
  const { settings, questions } = data;
  const css = (k: ReadingStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: ReadingStyleKey) => editable?.selectedKey === k;
  const pick = (k: ReadingStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const paragraphs = splitParagraphs(data.passage);
  const showImage = settings.showPassageImage && !!data.imageUrl;
  const showFrame = settings.showPassageImage && !data.imageUrl;
  const isComic = settings.layout === 'comic_story';
  const isOrange = settings.themeColor === 'orange' || (isComic && settings.themeColor !== 'navy');
  const themeColor = isOrange ? '#e66428' : NAVY;

  const blankSpan = (key: string) => (
    <span key={key} style={{ display: 'inline-block', width: '22mm', borderBottom: '1pt dashed #222', margin: '0 0.6mm', lineHeight: 1, verticalAlign: 'baseline' }}>&nbsp;</span>
  );

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
      <div key={o.id} style={css('options')}>
        <strong style={{ fontWeight: 800 }}>{optionLabel(oi, settings.optionLabelStyle)}.</strong>{' '}
        <EditableText value={o.text} onCommit={editable?.onOption ? (v) => editable.onOption!(q.id, o.id, v) : undefined} css={css('options')} selected={sel('options')} onSelect={pick('options')} />
      </div>
    );
  };

  const passageBlock = (data.passageTitle || data.passageAuthor || paragraphs.length > 0) && (
    <div style={{ marginBottom: '4mm', overflow: 'hidden' }}>
      {(data.passageTitle || editable?.onPassageTitle) && (
        <h3 style={{ margin: '0 0 1mm', textAlign: 'center', fontWeight: 800, textTransform: 'uppercase', fontSize: '1.05em', ...css('passageTitle') }}>
          <EditableText value={data.passageTitle} onCommit={editable?.onPassageTitle} selected={sel('passageTitle')} onSelect={pick('passageTitle')} />
        </h3>
      )}
      {(data.passageAuthor || editable?.onPassageAuthor) && (
        <p style={{ margin: '0 0 3mm', textAlign: 'center', fontStyle: 'italic', fontWeight: 700, ...css('passageAuthor') }}>
          <EditableText value={data.passageAuthor} onCommit={editable?.onPassageAuthor} selected={sel('passageAuthor')} onSelect={pick('passageAuthor')} />
        </p>
      )}
      {showImage && (
        <div style={{ float: 'right', width: `${settings.imageWidthMm}mm`, margin: '1mm 0 2mm 4mm', display: 'flex', flexDirection: 'column', gap: '2mm', textIndent: 0 }}>
          {[data.imageUrl!, ...(data.extraImages || [])].filter(Boolean).map((src, i) => (
            <img key={i} src={src} alt="" style={{ width: '100%', borderRadius: '2mm', border: '0.75pt solid #cbd5e1', objectFit: 'cover', display: 'block' }} />
          ))}
        </div>
      )}
      {showFrame && (
        <label
          className={editable?.onPickImage ? 'cursor-pointer hover:border-blue-400 hover:text-blue-600' : ''}
          style={{ float: 'right', width: `${settings.imageWidthMm}mm`, aspectRatio: '4 / 3', margin: '1mm 0 2mm 4mm', border: '0.75pt dashed #9ca3af', borderRadius: '2mm', background: '#f8fafc', color: '#9ca3af', fontSize: '9pt', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', textIndent: 0 }}
        >
          {editable?.onPickImage ? 'Bấm để thêm ảnh bài báo' : 'Ảnh bài báo'}
          {editable?.onPickImage && <input type="file" accept="image/*" hidden onChange={editable.onPickImage} />}
        </label>
      )}
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: '0 0 2.2mm', textIndent: '8mm', textAlign: settings.justifyPassage ? 'justify' : 'left', ...css('passage') }}>
          <EditableText block value={p} onCommit={editable?.onParagraph ? (v) => editable.onParagraph!(i, v) : undefined} css={css('passage')} selected={sel('passage')} onSelect={pick('passage')} />
        </p>
      ))}
    </div>
  );

  if (isComic) {
    const colRatio = settings.columnRatio === '50_50' ? '1fr 1fr' : settings.columnRatio === '60_40' ? '1.5fr 1fr' : '1.2fr 1fr';
    return (
      <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
        {!hideExerciseHeading && settings.showExerciseTitle && (
          <div className="flex items-center gap-[2.5mm] mb-[3mm]">
            <span style={{ width: '5.4mm', height: '5.4mm', background: themeColor, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0 }}>
              {data.exerciseNumber || exerciseIndex}
            </span>
            <h2 style={{ margin: 0, color: themeColor, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
              <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} rich />
            </h2>
          </div>
        )}
        {settings.showInstruction && data.instruction && !hideExerciseHeading && (
          <p className="italic mb-[3mm]" style={{ fontSize: '10pt', fontWeight: 700, ...css('instruction') }}>
            <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: colRatio, columnGap: '6mm', alignItems: 'start' }}>
          {/* Cột trái: Tranh truyện Comic / Minh họa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5mm' }}>
            {data.imageUrl ? (
              <div style={{ position: 'relative', width: '100%' }}>
                <img
                  src={data.imageUrl}
                  alt="Comic Story"
                  style={{ width: '100%', borderRadius: '2mm', border: '0.75pt solid #cbd5e1', objectFit: 'contain', display: 'block' }}
                />
                {editable?.onPickImage && (
                  <label
                    className="cursor-pointer absolute top-2 right-2 px-2 py-1 bg-white/90 hover:bg-white text-slate-700 text-[10px] font-bold rounded shadow border border-slate-200 transition-opacity"
                    title="Đổi ảnh truyện tranh"
                  >
                    Đổi ảnh
                    <input type="file" accept="image/*" hidden onChange={editable.onPickImage} />
                  </label>
                )}
              </div>
            ) : (
              <label
                className={`w-full flex flex-col items-center justify-center border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-xl p-8 text-center transition-all ${
                  editable?.onPickImage ? 'cursor-pointer hover:bg-amber-50 hover:border-amber-400' : ''
                }`}
                style={{ minHeight: '80mm' }}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                </div>
                <div className="text-xs font-bold text-amber-800">Ảnh truyện tranh (Comic Strip)</div>
                <div className="text-[11px] text-amber-600/80 mt-1">
                  {editable?.onPickImage ? 'Bấm để tải ảnh 4 khung truyện tranh' : 'Chưa có ảnh truyện tranh'}
                </div>
                {editable?.onPickImage && <input type="file" accept="image/*" hidden onChange={editable.onPickImage} />}
              </label>
            )}

            {/* Ảnh phụ nếu có */}
            {data.extraImages?.filter(Boolean).map((src, i) => (
              <img key={i} src={src} alt="" style={{ width: '100%', borderRadius: '2mm', border: '0.75pt solid #cbd5e1', objectFit: 'cover' }} />
            ))}

            {/* Đoạn văn đi kèm nếu có */}
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: '0 0 2mm', textAlign: settings.justifyPassage ? 'justify' : 'left', ...css('passage') }}>
                <EditableText block value={p} onCommit={editable?.onParagraph ? (v) => editable.onParagraph!(i, v) : undefined} css={css('passage')} selected={sel('passage')} onSelect={pick('passage')} />
              </p>
            ))}
          </div>

          {/* Cột phải: Danh sách câu hỏi kèm dòng kẻ ngang chấm bên dưới */}
          <div>
            {questions.map((q, i) => (
              <div
                key={q.id}
                onClick={() => editable?.onSelectQuestion?.(q.id)}
                style={{ breakInside: 'avoid', marginBottom: `${settings.questionGapMm || 5.5}mm`, outline: editable?.selectedQuestionId === q.id ? '1px dashed #3b82f6' : undefined, outlineOffset: '1.5mm' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', marginBottom: '2.5mm' }}>
                  {settings.showNumbering && (
                    <strong style={{ fontWeight: 800, minWidth: '4.5mm', color: '#111' }}>
                      {i + 1}.
                    </strong>
                  )}
                  <div style={{ flex: 1, ...css('questions') }}>
                    {renderText(q)}
                  </div>
                </div>

                {data.shortAnswer ? (
                  <div style={{ width: '100%' }}>
                    {Array.from({ length: settings.answerLineCount || 1 }).map((_, lineIdx) => (
                      <div
                        key={lineIdx}
                        style={{
                          width: '100%',
                          height: '6.5mm',
                          borderBottom: '1.1pt dashed #71717a',
                          marginTop: lineIdx > 0 ? '4mm' : 0,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  q.options.length > 0 && (
                    <div style={{ paddingLeft: '5mm', marginTop: '1mm' }}>
                      {q.options.map((_, oi) => renderOption(q, oi))}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`, fontSize: `${settings.fontSizePt}pt`, lineHeight: settings.lineHeight, color: '#111' }}>
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-center gap-[2.5mm] mb-[3mm]">
          <span style={{ width: '5.4mm', height: '5.4mm', background: themeColor, color: '#fff', borderRadius: '1mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11pt', fontFamily: HEAD_FONT, lineHeight: 1, flexShrink: 0 }}>
            {data.exerciseNumber || exerciseIndex}
          </span>
          <h2 style={{ margin: 0, color: themeColor, fontFamily: HEAD_FONT, fontWeight: 800, fontSize: `${settings.headingFontSizePt}pt`, textTransform: 'uppercase', lineHeight: 1.3, ...css('title') }}>
            <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} selected={sel('title')} onSelect={pick('title')} rich />
          </h2>
        </div>
      )}
      {settings.showInstruction && data.instruction && !hideExerciseHeading && (
        <p className="italic mb-[3mm]" style={{ fontSize: '10pt', fontWeight: 700, ...css('instruction') }}>
          <EditableText value={data.instruction} onCommit={editable?.onInstruction} selected={sel('instruction')} onSelect={pick('instruction')} />
        </p>
      )}
      {passageBlock}
      <div>
        {questions.map((q, i) => (
          <div
            key={q.id}
            onClick={() => editable?.onSelectQuestion?.(q.id)}
            style={{ breakInside: 'avoid', marginBottom: `${settings.questionGapMm}mm`, outline: editable?.selectedQuestionId === q.id ? '1px dashed #3b82f6' : undefined, outlineOffset: '1.5mm' }}
          >
            {(() => {
              const hasBlank = splitBlanks(q.text).some((p) => p.type === 'blank');
              const showLine = !!data.shortAnswer && settings.answerLineWidthMm !== 0 && !hasBlank;
              const cols = [
                ...(settings.showNumbering ? ['7mm'] : []),
                'minmax(0, 1fr)',
                ...(showLine ? [`${settings.answerLineWidthMm ?? 68}mm`] : []),
                ...(settings.showAnswerBoxes ? ['7mm'] : []),
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: cols.join(' '), columnGap: '1.5mm', alignItems: 'start' }}>
                  {settings.showNumbering && <strong style={{ fontWeight: 800 }}>{i + 1}.</strong>}
                  <span>{renderText(q)}</span>
                  {showLine && <span style={{ borderBottom: '1pt dashed #444', alignSelf: 'end', height: '1em' }} />}
                  {settings.showAnswerBoxes && <span style={{ width: '7mm', height: '6mm', border: '0.75pt solid #444', borderRadius: '1mm' }} />}
                </div>
              );
            })()}
            {!data.shortAnswer && <div style={{ paddingLeft: '7mm', marginTop: '0.8mm' }}>{q.options.map((_, oi) => renderOption(q, oi))}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
