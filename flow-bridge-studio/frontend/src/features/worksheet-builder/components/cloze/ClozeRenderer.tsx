import React from 'react';
import type { ClozeData, ClozeQuestion } from '../../services/cloze/clozeCore';
import { formatOptionLabel, parseMarkup } from '../../services/cloze/clozeCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const BLANK_SPLIT = /(\(\d+\)\s*_{2,})/g;
const BLANK_ONE = /^\((\d+)\)\s*_{2,}$/;

interface ClozeRendererProps {
  data: ClozeData;
  exerciseIndex?: number;
  onSelectQuestion?: (qId: string) => void;
  /** Ẩn tiêu đề bài (khi trang in đã tự vẽ tiêu đề + ô số) */
  hideExerciseHeading?: boolean;
  /** Chế độ sửa trực tiếp đoạn văn trên trang A4 */
  editablePassage?: { onChange: (text: string) => void };
  /** Tô nền xanh nhạt các chỗ trống (chỉ dùng khi xem trong trình soạn) */
  highlightBlanks?: boolean;
}

const PARA_GAP_MM = { compact: 1.5, normal: 3, spacious: 5 } as const;
const ROW_GAP_MM = { compact: 1.5, normal: 2.5, spacious: 4 } as const;

export const ClozeRenderer: React.FC<ClozeRendererProps> = ({
  data,
  exerciseIndex = 1,
  onSelectQuestion,
  hideExerciseHeading = false,
  editablePassage,
  highlightBlanks = false,
}) => {
  const { settings } = data;
  const lineHeight = settings.lineHeight;
  const rowGap = `${ROW_GAP_MM[lineHeight <= 1.35 ? 'compact' : lineHeight >= 1.7 ? 'spacious' : 'normal']}mm`;
  const avoidBreak: React.CSSProperties = settings.keepTogether ? { breakInside: 'avoid' } : {};
  const numberOf = (q: ClozeQuestion) => (settings.autoNumberQuestions ? `${q.number}.` : '');
  const answerStyle: React.CSSProperties = { fontSize: `${settings.answerFontSizePt}pt`, lineHeight };

  // ───── Đoạn văn: định dạng chữ + chỗ trống (+ lựa chọn ngay sau chỗ trống ở kiểu Inline) ─────
  const renderBlank = (qNum: number, key: string, withOptions: boolean) => {
    const q = data.questions.find((x) => x.number === qNum);
    return (
      <span key={key}>
        <span
          onClick={() => q && onSelectQuestion?.(q.id)}
          style={{
            fontWeight: 700,
            cursor: onSelectQuestion ? 'pointer' : undefined,
            ...(highlightBlanks ? { background: '#e3edff', borderRadius: '1mm', padding: '0 0.8mm' } : {}),
          }}
          title={q ? `Câu hỏi ${qNum}` : undefined}
        >
          {settings.showBlankNumbers ? `(${qNum}) ________` : '________'}
        </span>
        {withOptions && q && (
          <span style={{ fontSize: '0.88em', color: '#333', whiteSpace: 'nowrap' }}>
            {' '}[{q.options.map((o, i) => `${formatOptionLabel(i, settings.optionLabelStyle)} ${o.text}`).join('  ')}]
          </span>
        )}
      </span>
    );
  };

  const renderPassageNodes = (withInlineOptions: boolean) => {
    const paragraphs = (data.passage || '').split(/\n{2,}/);
    return paragraphs.map((para, pIdx) => (
      <p key={`p${pIdx}`} style={{ margin: pIdx === paragraphs.length - 1 ? 0 : `0 0 ${PARA_GAP_MM[settings.paragraphSpacing]}mm` }}>
        {renderParagraph(para, pIdx, withInlineOptions)}
      </p>
    ));
  };

  const renderParagraph = (text: string, pIdx: number, withInlineOptions: boolean) => {
    const segs = parseMarkup(text);
    return segs.map((seg, si) => {
      const pieces = seg.text.split(BLANK_SPLIT).map((piece, pi) => {
        const m = BLANK_ONE.exec(piece);
        return m ? renderBlank(Number(m[1]), `b${pIdx}_${si}_${pi}`, withInlineOptions) : <React.Fragment key={`t${pIdx}_${si}_${pi}`}>{piece}</React.Fragment>;
      });
      let node: React.ReactNode = pieces;
      if (seg.underline) node = <u>{node}</u>;
      if (seg.italic) node = <em>{node}</em>;
      if (seg.bold) node = <strong>{node}</strong>;
      return <React.Fragment key={`s${pIdx}_${si}`}>{node}</React.Fragment>;
    });
  };

  const renderPassage = (withInlineOptions = false, sizeAdjust = 0) => {
    const imgOn = settings.imagePosition !== 'none' && !!settings.imageUrl;
    const baseStyle: React.CSSProperties = {
      fontSize: `${Math.max(9, settings.passageFontSizePt + sizeAdjust)}pt`,
      lineHeight,
      textAlign: settings.passageAlign,
      whiteSpace: 'pre-line',
      color: '#111',
    };
    const floatOn = settings.wrapText && settings.imagePosition !== 'top';
    const image = imgOn ? (
      <img
        src={settings.imageUrl}
        alt=""
        style={{
          width: settings.imagePosition === 'top' ? `${Math.min(100, settings.imageWidthPercent + 20)}%` : `${settings.imageWidthPercent}%`,
          float: floatOn ? (settings.imagePosition === 'left' ? 'left' : 'right') : 'none',
          margin: floatOn
            ? (settings.imagePosition === 'left' ? '0 4mm 2mm 0' : '0 0 2mm 4mm')
            : (settings.imagePosition === 'left' ? '0 auto 3mm 0' : settings.imagePosition === 'right' ? '0 0 3mm auto' : '0 auto 3mm'),
          display: floatOn ? undefined : 'block',
          height: settings.maintainAspect ? 'auto' : '42mm',
          borderRadius: '1.5mm',
          objectFit: 'cover',
          background: '#fff',
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    ) : null;

    if (editablePassage) {
      return (
        <div style={baseStyle}>
          {image}
          <div
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => {
              const t = e.currentTarget.innerText.replace(/ /g, ' ').replace(/\n+$/, '');
              if (t !== data.passage) editablePassage.onChange(t);
            }}
            style={{ outline: '2px dashed #a78bfa', outlineOffset: '2px', borderRadius: '2px', minHeight: '20mm', background: 'rgba(167,139,250,0.06)' }}
          >
            {data.passage}
          </div>
          <div style={{ clear: 'both' }} />
        </div>
      );
    }
    return (
      <div style={baseStyle}>
        {image}
        {renderPassageNodes(withInlineOptions)}
        <div style={{ clear: 'both' }} />
      </div>
    );
  };

  // ───── Hàng lựa chọn của một câu: số + các lựa chọn xếp theo N cột ─────
  const renderOptionsRow = (q: ClozeQuestion, cols: number) => (
    <div
      key={q.id}
      style={{ display: 'grid', gridTemplateColumns: `${settings.autoNumberQuestions ? '9mm ' : ''}repeat(${cols}, minmax(0, 1fr))`, columnGap: '4mm', rowGap: '0.5mm', alignItems: 'baseline', ...avoidBreak }}
    >
      {settings.autoNumberQuestions && <span style={{ fontWeight: 700 }}>{numberOf(q)}</span>}
      {q.options.map((o, i) => (
        <span key={o.id}>
          <b style={{ fontWeight: 700 }}>{formatOptionLabel(i, settings.optionLabelStyle)}</b> {o.text}
        </span>
      ))}
    </div>
  );

  const optionsBlock = (cols: number, extra?: React.CSSProperties) => (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap, ...answerStyle, ...extra }}>
      {data.questions.map((q) => renderOptionsRow(q, cols))}
    </div>
  );

  const cols = Math.min(4, Math.max(1, settings.answerColumns || 3));

  // 1. Bố cục gốc
  const renderOriginal = () => (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: '4mm' }}>
      {renderPassage()}
      {optionsBlock(cols)}
    </div>
  );

  // 2. Lựa chọn ngay sau chỗ trống
  const renderInline = () => <div>{renderPassage(true)}</div>;

  // 3. Hai cột
  const renderTwoColumns = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', columnGap: '6mm', alignItems: 'start' }}>
      {renderPassage()}
      <div style={{ display: 'flex', flexDirection: 'column', rowGap, ...answerStyle }}>
        {data.questions.map((q) => renderOptionsRow(q, 1))}
      </div>
    </div>
  );

  // 4. Bảng lưới
  const renderGrid = () => {
    const maxOpts = Math.max(2, ...data.questions.map((q) => q.options.length));
    const cell: React.CSSProperties = { border: '0.5pt solid #333', padding: '1.2mm 2mm' };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', rowGap: '4mm' }}>
        {renderPassage()}
        <table style={{ width: '100%', borderCollapse: 'collapse', ...answerStyle }}>
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              <th style={{ ...cell, width: '12mm' }}>No.</th>
              {Array.from({ length: maxOpts }).map((_, i) => (
                <th key={i} style={cell}>{formatOptionLabel(i, settings.optionLabelStyle).replace('.', '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.questions.map((q) => (
              <tr key={q.id} style={avoidBreak}>
                <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{q.number}</td>
                {Array.from({ length: maxOpts }).map((_, i) => (
                  <td key={i} style={cell}>
                    {q.options[i] && (
                      <>
                        <span style={{ display: 'inline-block', width: '3mm', height: '3mm', border: '0.6pt solid #444', borderRadius: '0.6mm', marginRight: '1.5mm', verticalAlign: 'middle' }} />
                        {q.options[i].text}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // 5. Ô ghi chữ cái
  const renderBoxes = () => (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: '4mm' }}>
      {renderPassage()}
      {optionsBlock(cols)}
      <div>
        <div style={{ fontSize: '9pt', fontWeight: 700, marginBottom: '1.5mm' }}>Write your answers:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm' }}>
          {data.questions.map((q) => (
            <div key={q.id} style={{ width: '11mm', height: '12mm', border: '0.9pt solid #333', borderRadius: '1.2mm', padding: '0.8mm', fontSize: '8pt', fontWeight: 700, color: '#555' }}>
              {q.number}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 6. Thu gọn
  const renderCompact = () => (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: '3mm' }}>
      {renderPassage(false, -1)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '6mm', rowGap: '1mm', fontSize: `${Math.max(9, settings.answerFontSizePt - 1)}pt`, lineHeight: 1.3 }}>
        {data.questions.map((q) => (
          <div key={q.id} style={{ display: 'flex', gap: '2mm', ...avoidBreak }}>
            {settings.autoNumberQuestions && <b style={{ minWidth: '6mm' }}>{numberOf(q)}</b>}
            <span style={{ display: 'flex', flexWrap: 'wrap', columnGap: '3mm' }}>
              {q.options.map((o, i) => (
                <span key={o.id}><b>{formatOptionLabel(i, settings.optionLabelStyle)}</b> {o.text}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const body =
    settings.layout === 'inline' ? renderInline()
    : settings.layout === 'two_columns' ? renderTwoColumns()
    : settings.layout === 'answer_grid' ? renderGrid()
    : settings.layout === 'answer_boxes' ? renderBoxes()
    : settings.layout === 'compact' ? renderCompact()
    : renderOriginal();

  return (
    <div style={{ fontFamily: `${settings.fontFamily}, Arial, sans-serif`, color: '#111' }} className="cloze-worksheet-content">
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2mm', marginBottom: '2.5mm' }}>
          <span
            style={{ width: '5.2mm', height: '5.2mm', background: NAVY, color: '#fff', borderRadius: '0.9mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10.5pt', fontFamily: HEAD_FONT, lineHeight: 1 }}
          >
            {exerciseIndex}
          </span>
          <h2 style={{ margin: 0, color: NAVY, fontFamily: HEAD_FONT, fontWeight: 700, fontSize: '12.5pt', textTransform: 'uppercase', lineHeight: 1.2 }}>
            {data.exerciseTitle}
          </h2>
        </div>
      )}

      {settings.showPoints && !!data.points && (
        <div style={{ textAlign: 'right', fontSize: '9.5pt', fontWeight: 600, color: '#555', marginBottom: '1mm' }}>({data.points} pts)</div>
      )}

      {settings.showPassageTitle && data.passageTitle && (
        <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
          <span
            style={{
              fontFamily: HEAD_FONT,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              fontSize: data.passageTitleTag === 'H1' ? '15pt' : data.passageTitleTag === 'H3' ? '11pt' : '13pt',
            }}
          >
            {data.passageTitle}
          </span>
        </div>
      )}

      {body}
    </div>
  );
};
