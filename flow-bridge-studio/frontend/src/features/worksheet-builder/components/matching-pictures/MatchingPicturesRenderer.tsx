import React from 'react';
import type {
  MatchingPicturesData,
  MatchingPictureItem,
  TextStyleKey,
} from '../../services/matching-pictures/matchingPicturesCore';
import { textStyleToCss } from '../../services/matching-pictures/matchingPicturesCore';

const NAVY = '#16295f';
const HEAD_FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

interface MatchingPicturesRendererProps {
  data: MatchingPicturesData;
  isTeacherKey?: boolean;
  exerciseIndex?: number;
  hideExerciseHeading?: boolean;
  /** Có giá trị: các dòng chữ tương ứng sửa trực tiếp được (Edit Mode) */
  editable?: {
    onTitle?: (v: string) => void;
    onInstruction?: (v: string) => void;
    onNotes?: (v: string) => void;
    onCaption?: (imageId: string, v: string) => void;
    /** Sửa nhãn đoạn (mặc định "Paragraph N") */
    onLabel?: (paragraphId: string, v: string) => void;
    /** Thành phần đang được chọn để định dạng và hàm chọn thành phần */
    selectedKey?: TextStyleKey;
    onSelectKey?: (k: TextStyleKey) => void;
  };
}

/** Chữ sửa trực tiếp: Enter hoặc bấm ra ngoài để lưu, Esc để hủy. `css` là định dạng (đậm, nghiêng, màu...) */
const EditableText: React.FC<{
  value: string;
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
}> = ({ value, onCommit, css, selected, onSelect }) => {
  if (!onCommit) return Object.keys(css || {}).length ? <span style={css}>{value}</span> : <>{value}</>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="rounded-[2px] cursor-text caret-blue-600 hover:bg-blue-50 focus:bg-blue-50/60 focus:outline focus:outline-1 focus:outline-blue-400 focus:outline-offset-2"
      style={{
        ...css,
        display: css?.display || 'inline-block',
        minWidth: '3ch',
        outline: selected ? '1px solid #8b5cf6' : undefined,
        outlineOffset: '2px',
      }}
      onFocus={onSelect}
      onClick={onSelect}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.replace(/\u00a0/g, ' ').replace(/\s*\n+\s*/g, ' ').trim();
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

export const MatchingPicturesRenderer: React.FC<MatchingPicturesRendererProps> = ({
  data,
  isTeacherKey = false,
  exerciseIndex = 4,
  hideExerciseHeading = false,
  editable,
}) => {
  const { settings, paragraphs, images, answerMapping } = data;
  const showKey = isTeacherKey || settings.showTeacherKey;

  const fontStyle: React.CSSProperties = {
    fontFamily: `${settings.fontFamily || 'Arial'}, sans-serif`,
    lineHeight: settings.lineHeight || 1.5,
    color: '#111',
  };

  // Định dạng chữ theo từng thành phần
  const css = (k: TextStyleKey) => textStyleToCss(data.textStyles?.[k]) as React.CSSProperties;
  const sel = (k: TextStyleKey) => editable?.selectedKey === k;
  const pick = (k: TextStyleKey) => (editable?.onSelectKey ? () => editable.onSelectKey!(k) : undefined);
  const renderLabel = (order: number, withDot: boolean) => {
    const para = paragraphs.find((p) => p.order === order);
    const defaultText = settings.labelStyle === 'number_only' ? (withDot ? `${order}.` : `${order}`) : `Paragraph ${order}`;
    const custom = para?.title && para.title !== `Paragraph ${order}` ? para.title : '';
    const text = custom || defaultText;
    if (!editable) return Object.keys(css('paraLabels')).length ? <span style={css('paraLabels')}>{text}</span> : <>{text}</>;
    return (
      <EditableText
        value={text}
        onCommit={para && editable.onLabel ? (v) => editable.onLabel!(para.id, v || defaultText) : undefined}
        css={css('paraLabels')}
        selected={sel('paraLabels')}
        onSelect={pick('paraLabels')}
      />
    );
  };

  // Cài đặt hiển thị
  const imgCols = settings.imageColumns === 'auto' ? (images.length <= 4 ? 2 : 3) : (settings.imageColumns || 2);
  const paraGap = { compact: 3, normal: 4.5, spacious: 7 }[settings.paragraphSpacing || 'normal'];
  const keepTogether: React.CSSProperties = settings.keepImagesTogether ? { breakInside: 'avoid' } : {};

  // Helper to find correct answer letter for a paragraph
  const getAnswerLetter = (paraId: string): string => {
    const map = answerMapping.find((m) => m.paragraphId === paraId);
    if (!map) return '';
    const img = images.find((i) => i.id === map.imageId);
    return img ? img.label : '';
  };

  // Helper to find image matching index for draw lines
  const getImageIndexForParagraph = (paraId: string): number => {
    const map = answerMapping.find((m) => m.paragraphId === paraId);
    if (!map) return -1;
    return images.findIndex((i) => i.id === map.imageId);
  };

  // Answer box styling
  const renderAnswerBox = (paraId: string, customSize = '7mm') => {
    if (settings.showAnswerArea === false) return null;
    const answer = getAnswerLetter(paraId);
    const isCircle = settings.answerStyle === 'circle';
    const isUnderline = settings.answerStyle === 'underline';

    if (isUnderline) {
      return (
        <span
          style={{
            display: 'inline-block',
            width: '12mm',
            borderBottom: '1.5pt dashed #1e293b',
            textAlign: 'center',
            fontWeight: 800,
            color: '#1d4ed8',
            fontSize: '10pt',
            lineHeight: '14pt',
            verticalAlign: 'bottom',
          }}
        >
          {showKey ? answer : ''}
        </span>
      );
    }

    return (
      <div
        style={{
          width: customSize,
          height: customSize,
          border: '1.2pt solid #475569',
          borderRadius: isCircle ? '50%' : settings.imageShape === 'rounded' ? '1.5mm' : '1mm',
          backgroundColor: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          color: '#1d4ed8',
          fontSize: '9.5pt',
          flexShrink: 0,
        }}
      >
        {showKey ? answer : ''}
      </div>
    );
  };

  // Image card component
  const renderImageCard = (
    img: MatchingPictureItem,
    options?: {
      width?: string;
      height?: string;
      showCaption?: boolean;
    }
  ) => {
    const width = options?.width || '100%';
    const height = options?.height || '34mm';
    const isRounded = settings.imageShape === 'rounded';

    return (
      <div
        key={img.id}
        style={{ width, marginLeft: 'auto', marginRight: 'auto', ...keepTogether }}
        className="relative flex flex-col items-center group/card"
      >
        <div
          style={{
            width: '100%',
            height,
            borderRadius: isRounded ? '2mm' : '0.8mm',
            border: settings.showBorders ? '1pt solid #cbd5e1' : 'none',
            overflow: 'hidden',
            backgroundColor: '#f8fafc',
            position: 'relative',
          }}
        >
          {/* Badge Label: [A], [B]... */}
          {settings.showImageLabels && (
            <div
              style={{
                position: 'absolute',
                top: '1.5mm',
                left: '1.5mm',
                width: '5mm',
                height: '5mm',
                backgroundColor: '#ffffff',
                border: '1pt solid #1e293b',
                borderRadius: '0.8mm',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '7.5pt',
                color: '#0f172a',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                zIndex: 2,
              }}
            >
              {img.label}
            </div>
          )}

          <img
            src={img.imageUrl}
            alt={img.caption || `Image ${img.label}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: settings.imageFit || 'cover',
              display: 'block',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://placehold.co/400x300/e2e8f0/475569?text=' + img.label;
            }}
          />
        </div>

        {/* Caption (e.g. Hard Rock Café in Picture Cards) */}
        {options?.showCaption && settings.showImageCaptions !== false && img.caption && (
          <div
            style={{
              marginTop: '1.5mm',
              fontSize: '8.5pt',
              fontWeight: 700,
              color: '#334155',
              textAlign: 'center',
            }}
          >
            <EditableText value={img.caption} onCommit={editable?.onCaption ? (v) => editable.onCaption!(img.id, v) : undefined} css={css('captions')} selected={sel('captions')} onSelect={pick('captions')} />
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT 1: ORIGINAL GRID (Paragraphs on left, 2-col images on right)
  // ══════════════════════════════════════════════════════════════════
  const renderOriginalGridLayout = () => {
    const right = settings.answerPosition === 'right';
    return (
      <div className="grid grid-cols-12 gap-[6mm] items-start">
        {/* Cột đoạn văn + ô trả lời (bên trái, hoặc bên phải nếu chọn Right) */}
        <div className={`col-span-5 flex flex-col pt-[1mm] ${right ? 'order-2' : ''}`} style={{ rowGap: `${paraGap}mm` }}>
          {paragraphs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-[3mm]">
              <span
                style={{
                  fontSize: `${settings.fontSizePt}pt`,
                  fontWeight: 800,
                  color: '#0f172a',
                }}
              >
                {renderLabel(p.order, true)}
              </span>
              {renderAnswerBox(p.id, '7.5mm')}
            </div>
          ))}
        </div>

        {/* Lưới ảnh: số cột, cỡ ảnh và khoảng cách theo cài đặt */}
        <div className={`col-span-7 ${right ? 'order-1' : ''}`}>
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${imgCols}, minmax(0, 1fr))`, gap: `${settings.gapBetweenImagesMm}mm` }}
          >
            {images.map((img) => renderImageCard(img, { height: '34mm', width: `${settings.imageSizePercent || 100}%` }))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT 2: PICTURE GRID (Images on top, answer row below)
  // ══════════════════════════════════════════════════════════════════
  const renderPictureGridLayout = () => {
    return (
      <div className="space-y-[4.5mm]">
        {/* Trên: ảnh xếp theo số cột đã chọn */}
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(imgCols, 2)}, minmax(0, 1fr))`, gap: `${settings.gapBetweenImagesMm / 2 + 1}mm` }}
        >
          {images.map((img) => renderImageCard(img, { height: '30mm', width: `${settings.imageSizePercent || 100}%` }))}
        </div>

        {/* Bottom: Answer Section */}
        <div className="pt-[2mm] border-t border-slate-200">
          <p
            style={{
              fontSize: '9pt',
              fontWeight: 800,
              color: '#334155',
              marginBottom: '2.5mm',
            }}
          >
            Write the correct letter (A–E).
          </p>

          <div className="grid grid-cols-5 gap-[2mm]">
            {paragraphs.map((p) => (
              <div
                key={p.id}
                className="border border-slate-300 rounded-[1.5mm] p-[2mm] bg-white flex flex-col items-center justify-between"
                style={{ height: '15mm' }}
              >
                <span style={{ fontSize: '8pt', fontWeight: 700, color: '#475569' }}>
                  {renderLabel(p.order, false)}
                </span>
                <span
                  style={{
                    fontSize: '11pt',
                    fontWeight: 800,
                    color: '#1d4ed8',
                    minHeight: '5mm',
                  }}
                >
                  {showKey ? getAnswerLetter(p.id) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT 3: SIDE-BY-SIDE (Paragraph text with answer box & images)
  // ══════════════════════════════════════════════════════════════════
  const renderSideBySideLayout = () => {
    return (
      <div className="grid grid-cols-12 gap-[5mm] items-start">
        {/* Left column: Paragraph texts with answer checkboxes */}
        <div className="col-span-7 space-y-[3mm]">
          {paragraphs.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-[2.5mm] text-justify leading-snug"
              style={{ fontSize: `${settings.fontSizePt - 0.5}pt` }}
            >
              <strong style={{ fontWeight: 800, minWidth: '4mm', color: '#0f172a' }}>
                {p.order}.
              </strong>
              <div className="flex-1 text-slate-800">
                {p.summary || p.text}
              </div>
              <div className="pt-[0.5mm] shrink-0">
                {renderAnswerBox(p.id, '6.5mm')}
              </div>
            </div>
          ))}
        </div>

        {/* Right column: 2 columns of images */}
        <div className="col-span-5">
          <div className="grid grid-cols-2 gap-[2.5mm]">
            {images.map((img) => renderImageCard(img, { height: '28mm' }))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT 4: DRAW LINES (Dots on both sides for student line drawing)
  // ══════════════════════════════════════════════════════════════════
  const renderDrawLinesLayout = () => {
    return (
      <div className="relative">
        <div className="grid grid-cols-12 gap-[4mm] items-center">
          {/* Left Column: Paragraphs with dot */}
          <div className="col-span-4 space-y-[7mm]">
            {paragraphs.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between pr-[2mm]"
                style={{ height: '26mm' }}
              >
                <span
                  style={{
                    fontSize: `${settings.fontSizePt}pt`,
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  {renderLabel(p.order, true)}
                </span>
                {/* Connecting Dot */}
                <div
                  style={{
                    width: '3.5mm',
                    height: '3.5mm',
                    borderRadius: '50%',
                    backgroundColor: '#0f172a',
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Middle Spacer for Drawing */}
          <div className="col-span-3 text-center text-slate-300 text-[10px]">
            {/* When teacher key is enabled, SVG overlay draws the lines */}
          </div>

          {/* Right Column: Dot with Image Card */}
          <div className="col-span-5 space-y-[4mm]">
            {images.map((img) => (
              <div
                key={img.id}
                className="flex items-center gap-[3mm]"
                style={{ height: '26mm' }}
              >
                {/* Connecting Dot */}
                <div
                  style={{
                    width: '3.5mm',
                    height: '3.5mm',
                    borderRadius: '50%',
                    backgroundColor: '#0f172a',
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1">
                  {renderImageCard(img, { height: '24mm' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Teacher Key Connecting Lines SVG */}
        {showKey && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          >
            {paragraphs.map((p, pIdx) => {
              const imgIdx = getImageIndexForParagraph(p.id);
              if (imgIdx === -1) return null;

              // Approximate normalized coordinates
              const y1Percent = ((pIdx + 0.5) / paragraphs.length) * 100;
              const y2Percent = ((imgIdx + 0.5) / images.length) * 100;

              return (
                <line
                  key={`line_${p.id}`}
                  x1="32%"
                  y1={`${y1Percent}%`}
                  x2="59%"
                  y2={`${y2Percent}%`}
                  stroke="#1d4ed8"
                  strokeWidth="2.2"
                  strokeDasharray="4 2"
                />
              );
            })}
          </svg>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT 5: PICTURE CARDS (Images with captions + answer grid below)
  // ══════════════════════════════════════════════════════════════════
  const renderPictureCardsLayout = () => {
    const row1 = images.slice(0, 3);
    const row2 = images.slice(3);

    return (
      <div className="space-y-[4.5mm]">
        {/* Top: Cards with labels and captions */}
        <div className="space-y-[3mm]">
          <div className="grid grid-cols-3 gap-[3mm]">
            {row1.map((img) =>
              renderImageCard(img, { height: '27mm', showCaption: true })
            )}
          </div>
          {row2.length > 0 && (
            <div className="grid grid-cols-3 gap-[3mm]">
              {row2.map((img) =>
                renderImageCard(img, { height: '27mm', showCaption: true })
              )}
              {Array.from({ length: Math.max(0, 3 - row2.length) }).map((_, i) => (
                <div key={`spacer_${i}`} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom: Answer section */}
        <div className="pt-[2.5mm] border-t border-slate-200">
          <p
            style={{
              fontSize: '9pt',
              fontWeight: 800,
              color: '#334155',
              marginBottom: '2mm',
            }}
          >
            Write the correct letter (A–E).
          </p>

          <div className="grid grid-cols-5 gap-[2mm]">
            {paragraphs.map((p) => (
              <div
                key={p.id}
                className="border border-slate-300 rounded-[1.5mm] p-[2mm] bg-white flex flex-col items-center justify-between"
                style={{ height: '14mm' }}
              >
                <span style={{ fontSize: '8pt', fontWeight: 700, color: '#475569' }}>
                  {renderLabel(p.order, false)}
                </span>
                <span
                  style={{
                    fontSize: '11pt',
                    fontWeight: 800,
                    color: '#1d4ed8',
                    minHeight: '5mm',
                  }}
                >
                  {showKey ? getAnswerLetter(p.id) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT 6: COMPACT (5 images horizontal row + table below)
  // ══════════════════════════════════════════════════════════════════
  const renderCompactLayout = () => {
    return (
      <div className="space-y-[3.5mm]">
        {/* Top: 5 small images in single horizontal row */}
        <div className="grid grid-cols-5 gap-[2mm]">
          {images.map((img) =>
            renderImageCard(img, { height: '22mm', showCaption: false })
          )}
        </div>

        {/* Bottom: 2-column table */}
        <div className="border border-slate-300 rounded-[1.5mm] overflow-hidden">
          <table className="w-full border-collapse text-left" style={{ fontSize: '9pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1pt solid #cbd5e1' }}>
                <th
                  style={{
                    padding: '2mm 3mm',
                    fontWeight: 800,
                    color: NAVY,
                    width: '82%',
                  }}
                >
                  Paragraph
                </th>
                <th
                  style={{
                    padding: '2mm 3mm',
                    fontWeight: 800,
                    color: NAVY,
                    textAlign: 'center',
                    width: '18%',
                  }}
                >
                  Picture (A–E)
                </th>
              </tr>
            </thead>
            <tbody>
              {paragraphs.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom:
                      idx < paragraphs.length - 1 ? '0.8pt solid #e2e8f0' : 'none',
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                  }}
                >
                  <td
                    style={{
                      padding: '2.5mm 3mm',
                      verticalAlign: 'top',
                      lineHeight: 1.35,
                    }}
                  >
                    <div className="flex items-start gap-[2mm]">
                      <strong style={{ fontWeight: 800, minWidth: '3.5mm' }}>
                        {p.order}
                      </strong>
                      <span className="text-slate-800">
                        {p.summary || p.text}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '2mm',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    <div className="flex justify-center">
                      {renderAnswerBox(p.id, '6mm')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Layout switcher
  const renderLayoutContent = () => {
    switch (settings.layout) {
      case 'picture_grid':
        return renderPictureGridLayout();
      case 'side_by_side':
        return renderSideBySideLayout();
      case 'draw_lines':
        return renderDrawLinesLayout();
      case 'picture_cards':
        return renderPictureCardsLayout();
      case 'compact':
        return renderCompactLayout();
      case 'original_grid':
      default:
        return renderOriginalGridLayout();
    }
  };

  return (
    <div style={fontStyle} className="matching-pictures-content text-[#111]">
      {/* Exercise Heading */}
      {!hideExerciseHeading && settings.showExerciseTitle && (
        <div className="flex items-start justify-between gap-[3mm] mb-[3mm]">
          <div className="flex items-center gap-[2mm] pt-[1mm]">
            <span
              style={{
                width: '5.4mm',
                height: '5.4mm',
                background: NAVY,
                color: '#fff',
                borderRadius: '1mm',
                fontFamily: HEAD_FONT,
                fontWeight: 800,
                fontSize: '11pt',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {data.exerciseNumber || exerciseIndex}
            </span>
            <h2
              style={{
                fontFamily: HEAD_FONT,
                fontSize: `${settings.headingFontSizePt || 14}pt`,
                fontWeight: 800,
                color: NAVY,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}
            >
              <EditableText value={data.exerciseTitle} onCommit={editable?.onTitle} css={css('title')} selected={sel('title')} onSelect={pick('title')} />
            </h2>
          </div>

          {settings.showPoints && data.pointsTotal && (
            <div className="shrink-0 text-[10pt] font-bold text-slate-500 pt-[1mm]">
              [{data.pointsTotal} points]
            </div>
          )}
        </div>
      )}

      {/* Optional Instruction */}
      {settings.showInstruction && data.instruction && (
        <p className="text-xs text-slate-600 italic mb-[3.5mm]">
          <EditableText value={data.instruction} onCommit={editable?.onInstruction} css={css('instruction')} selected={sel('instruction')} onSelect={pick('instruction')} />
        </p>
      )}

      {data.notes && (
        <p className="text-xs text-slate-600 italic mb-[3.5mm]"><EditableText value={data.notes} onCommit={editable?.onNotes} css={css('notes')} selected={sel('notes')} onSelect={pick('notes')} /></p>
      )}

      {/* Main Layout Area */}
      {renderLayoutContent()}
    </div>
  );
};
