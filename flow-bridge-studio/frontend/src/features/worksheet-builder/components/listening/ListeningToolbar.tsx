import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Baseline, Highlighter, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Outdent, Indent,
  ArrowDownUp, RemoveFormatting, Image as ImageIcon, Table2, SquareDashed, Undo2, Redo2, Minus, Plus, LayoutTemplate,
  Save, FilePlus2, FileDown, Printer, ArrowLeft, Scissors, Copy, TextSelect, ZoomIn, ZoomOut, Maximize2, Eye, Pencil,
  ArrowUp, ArrowDown, Sparkles, ListRestart, SlidersHorizontal, ImageUp, ImagePlus, Headphones, QrCode, FilePlus, Columns2, Type, Square, X,
} from 'lucide-react';
import type {
  ListeningExtra,
  ListeningExtraType,
  ListeningGapFillData,
  ListeningGapFillSettings,
  ListeningParagraphFormat,
} from '../../services/listening/listeningGapFillCore';
import { LISTENING_LAYOUTS, DIALOGUE_PRESET, PASSAGE_QR_PRESET, PASSAGE_IMAGE_PRESET, OUTLINE_PRESET, SENTENCE_LIST_PRESET } from '../../services/listening/listeningGapFillCore';
import type { RichSelectionInfo } from './RichParagraphInput';
import { attrsInRange, type TextMarkAttrs } from '../../services/listening/textMarks';
import { ListeningLayoutThumbnail } from './ListeningLayoutThumbnail';
import {
  RibbonRoot, Popover, TbButton, TbSep, DropdownTrigger, MenuTrigger, MenuList, ColorPalette, type RibbonEntry,
} from '../shared/toolbar/ribbonKit';

export type MoreSectionKey = 'blank' | 'image' | 'answer' | 'typography' | 'advanced';
export type ParagraphStyleKind = 'normal' | 'heading' | 'subheading';

const MORE_SETTINGS: { key: MoreSectionKey; label: string }[] = [
  { key: 'blank', label: 'Blank Settings' },
  { key: 'image', label: 'Image Settings' },
  { key: 'answer', label: 'Answer Table Settings' },
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.3, 1.4, 1.5, 1.7, 2];
const ZOOMS = [50, 75, 80, 90, 100, 110, 120, 125, 150];
const MIN_PT = 6;
const MAX_PT = 48;
const STYLE_LABEL: Record<ParagraphStyleKind, string> = { normal: 'Normal text', heading: 'Heading', subheading: 'Subheading' };

interface Props {
  data: ListeningGapFillData;
  activeParagraphIndex: number;
  selectedExtra: ListeningExtra | null;
  onSettings: (patch: Partial<ListeningGapFillSettings>) => void;
  onParaFormat: (patch: ListeningParagraphFormat) => void;
  /** Định dạng tại con trỏ/vùng chọn trong ô soạn (null = chưa chọn gì) */
  richInfo: RichSelectionInfo | null;
  /** Định dạng chữ theo từng từ (đậm/nghiêng/gạch chân/màu/tô nền/font/cỡ) */
  onMarkFormat: (patch: TextMarkAttrs) => void;
  onParagraphStyle: (kind: ParagraphStyleKind) => void;
  onEditCommand: (cmd: 'cut' | 'copy' | 'selectAll') => void;
  onClearFormat: () => void;
  onImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imageSupported: boolean;
  onAudioFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBodyImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateBodyImage: () => void;
  generatingBodyImage: boolean;
  onInsertBlank: () => void;
  nextBlankLabel: string;
  onInsertExercise: () => void;
  onSmartPaste: () => void;
  onResequence: () => void;
  onAddExtra: (type: ListeningExtraType) => void;
  onAlignExtra: (align: 'left' | 'center' | 'right') => void;
  onMoveExtra: (dir: 'up' | 'down') => void;
  onDuplicateExtra: () => void;
  renderMoreSection: (key: MoreSectionKey) => React.ReactNode;
  // File / View
  onSave: () => void;
  onExportDocx: () => void;
  onPrint: () => void;
  onBack: () => void;
  zoom: number;
  onZoom: (value: number) => void;
  onFitPage: () => void;
  previewMode: boolean;
  onPreviewMode: (preview: boolean) => void;
  undo: { onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean };
  /** Chế độ Preview: chỉ xem, mọi công cụ chỉnh sửa bị khóa */
  locked?: boolean;
}

/** Ô nhập cỡ chữ (pt): gõ số rồi Enter/blur để áp dụng */
const SizeInput: React.FC<{ value: number; disabled?: boolean; onSet: (pt: number) => void }> = ({ value, disabled, onSet }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n: number) => Math.min(MAX_PT, Math.max(MIN_PT, n));
  const commit = () => {
    const n = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(n)) onSet(clamp(Math.round(n * 2) / 2));
    else setDraft(String(value));
  };
  return (
    <div className="inline-flex items-center">
      <TbButton icon={Minus} label="Giảm cỡ chữ" disabled={disabled || value <= MIN_PT} onClick={() => onSet(clamp(Math.round(value) - 1))} className="!w-6" />
      <input
        value={draft}
        disabled={disabled}
        inputMode="decimal"
        aria-label="Cỡ chữ (pt)"
        title="Cỡ chữ (pt) – gõ số rồi Enter"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        className="h-7 w-10 rounded-md border border-slate-200 bg-white text-center text-[13px] text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/40 disabled:opacity-40"
      />
      <TbButton icon={Plus} label="Tăng cỡ chữ" disabled={disabled || value >= MAX_PT} onClick={() => onSet(clamp(Math.round(value) + 1))} className="!w-6" />
    </div>
  );
};

/** Thanh công cụ Listening Fill in the Gap: hàng 1 = menu, hàng 2 = công cụ; mọi mục đều gắn chức năng thật. */
export const ListeningToolbar: React.FC<Props> = ({
  data, activeParagraphIndex, selectedExtra, onSettings, onParaFormat, richInfo, onMarkFormat, onParagraphStyle, onEditCommand, onClearFormat,
  onImageFile, imageSupported, onAudioFile, onBodyImageFile, onGenerateBodyImage, generatingBodyImage, onInsertBlank, nextBlankLabel,
  onInsertExercise, onSmartPaste, onResequence, onAddExtra, onAlignExtra, onMoveExtra, onDuplicateExtra, renderMoreSection,
  onSave, onExportDocx, onPrint, onBack, zoom, onZoom, onFitPage, previewMode, onPreviewMode, undo, locked = false,
}) => {
  const { settings } = data;
  const para = data.paragraphs[activeParagraphIndex];
  const fmt: ListeningParagraphFormat = para?.format || {};
  const extraSelected = !!selectedExtra;
  const noPara = !para || extraSelected;
  const needPara = 'Chọn một đoạn văn để dùng chức năng này';
  const currentAlign = extraSelected ? selectedExtra!.align : fmt.align || 'left';
  const list = fmt.list ?? 'number';
  const hasFormat = !!(fmt.bold || fmt.italic || fmt.underline || fmt.color || fmt.highlight || fmt.align || fmt.list || fmt.indentMm || para?.marks?.length);
  const setAlign = (a: 'left' | 'center' | 'right') => (extraSelected ? onAlignExtra(a) : onParaFormat({ align: a }));

  // Định dạng chữ: có vùng chọn/con trỏ trong ô soạn thì theo vùng đó, chưa có thì theo cả đoạn
  const richOn = !!richInfo && !extraSelected;
  const markAttrs: TextMarkAttrs = richOn
    ? richInfo!.attrs
    : para ? attrsInRange(para.marks, para.text.length, 0, para.text.length) : {};
  const rangeSelected = richOn && !richInfo!.collapsed;
  const bold = !!(markAttrs.bold || fmt.bold);
  const italic = !!(markAttrs.italic || fmt.italic);
  const underline = !!(markAttrs.underline || fmt.underline);
  const color = markAttrs.color || fmt.color;
  const highlight = markAttrs.highlight || fmt.highlight;
  const fontFamily = (rangeSelected && markAttrs.fontFamily) || settings.fontFamily;
  const fontSize = (rangeSelected && markAttrs.fontSizePt) || settings.passageFontSizePt;
  const textOff = noPara;

  const paraAttrs = para ? attrsInRange(para.marks, para.text.length, 0, para.text.length) : {};
  const styleKind: ParagraphStyleKind = paraAttrs.bold && (paraAttrs.fontSizePt || 0) > settings.passageFontSizePt ? 'heading' : paraAttrs.bold ? 'subheading' : 'normal';

  const imageRef = useRef<HTMLInputElement>(null);
  const bodyImageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<MoreSectionKey | null>(null);
  useEffect(() => { if (locked) setPanel(null); }, [locked]);

  const item = (label: string, onClick: () => void, extra: Partial<Extract<RibbonEntry, { kind: 'item' }>> = {}): RibbonEntry => ({ kind: 'item', label, onClick, ...extra });
  const sep: RibbonEntry = { kind: 'sep' };
  const title = (label: string): RibbonEntry => ({ kind: 'title', label });

  const fileMenu: RibbonEntry[] = [
    item('Lưu', onSave, { icon: Save }),
    item('Lưu và thêm bài tập khác', onInsertExercise, { icon: FilePlus2 }),
    sep,
    item('Xuất Word (.doc)', onExportDocx, { icon: FileDown }),
    item('In / Lưu PDF', onPrint, { icon: Printer }),
    sep,
    item('Quay lại bài học', onBack, { icon: ArrowLeft }),
  ];
  const editMenu: RibbonEntry[] = [
    item('Hoàn tác', undo.onUndo, { icon: Undo2, shortcut: 'Ctrl+Z', disabled: !undo.canUndo }),
    item('Làm lại', undo.onRedo, { icon: Redo2, shortcut: 'Ctrl+Y', disabled: !undo.canRedo }),
    sep,
    item('Cắt', () => onEditCommand('cut'), { icon: Scissors, shortcut: 'Ctrl+X', disabled: !rangeSelected }),
    item('Sao chép', () => onEditCommand('copy'), { icon: Copy, shortcut: 'Ctrl+C', disabled: !rangeSelected }),
    item('Chọn tất cả (trong đoạn)', () => onEditCommand('selectAll'), { icon: TextSelect, shortcut: 'Ctrl+A', disabled: !richOn }),
  ];
  const formatMenu: RibbonEntry[] = [
    item('In đậm', () => onMarkFormat({ bold: !bold }), { icon: Bold, shortcut: 'Ctrl+B', checked: bold, disabled: textOff }),
    item('In nghiêng', () => onMarkFormat({ italic: !italic }), { icon: Italic, shortcut: 'Ctrl+I', checked: italic, disabled: textOff }),
    item('Gạch chân', () => onMarkFormat({ underline: !underline }), { icon: Underline, shortcut: 'Ctrl+U', checked: underline, disabled: textOff }),
    sep,
    item('Căn trái', () => setAlign('left'), { icon: AlignLeft, checked: currentAlign === 'left', disabled: !para && !extraSelected }),
    item('Căn giữa', () => setAlign('center'), { icon: AlignCenter, checked: currentAlign === 'center', disabled: !para && !extraSelected }),
    item('Căn phải', () => setAlign('right'), { icon: AlignRight, checked: currentAlign === 'right', disabled: !para && !extraSelected }),
    sep,
    item('Gạch đầu dòng', () => onParaFormat({ list: list === 'bullet' ? 'none' : 'bullet' }), { icon: List, checked: list === 'bullet', disabled: noPara }),
    item('Đánh số', () => onParaFormat({ list: list === 'number' ? 'none' : 'number' }), { icon: ListOrdered, checked: list === 'number', disabled: noPara }),
    item('Tăng thụt lề', () => onParaFormat({ indentMm: (fmt.indentMm || 0) + 5 }), { icon: Indent, disabled: noPara || (fmt.indentMm || 0) >= 30 }),
    item('Giảm thụt lề', () => onParaFormat({ indentMm: Math.max(0, (fmt.indentMm || 0) - 5) }), { icon: Outdent, disabled: noPara || !fmt.indentMm }),
    sep,
    title('Giãn dòng'),
    ...LINE_HEIGHTS.map((h) => item(h.toFixed(1), () => onSettings({ lineHeight: h }), { checked: settings.lineHeight === h })),
    sep,
    item('Chia 2 cột', () => onSettings({ layout: settings.layout === 'two_columns' ? 'original' : 'two_columns' }), { icon: Columns2, checked: settings.layout === 'two_columns' }),
    item('Xóa định dạng', onClearFormat, { icon: RemoveFormatting, disabled: noPara || !hasFormat }),
    sep,
    title(extraSelected ? 'Đối tượng đang chọn' : 'Đối tượng đang chọn (chọn trong preview)'),
    item('Đưa lên trên', () => onMoveExtra('up'), { icon: ArrowUp, disabled: !extraSelected }),
    item('Đưa xuống dưới', () => onMoveExtra('down'), { icon: ArrowDown, disabled: !extraSelected }),
    item('Nhân đôi', onDuplicateExtra, { icon: Copy, disabled: !extraSelected }),
  ];
  const viewMenu: RibbonEntry[] = [
    item('Phóng to', () => onZoom(Math.min(150, zoom + 10)), { icon: ZoomIn, disabled: zoom >= 150, keepOpen: true }),
    item('Thu nhỏ', () => onZoom(Math.max(50, zoom - 10)), { icon: ZoomOut, disabled: zoom <= 50, keepOpen: true }),
    item('Về 100%', () => onZoom(100), { disabled: zoom === 100 }),
    item('Phóng to trang đang soạn', onFitPage, { icon: Maximize2 }),
    sep,
    item('Chế độ soạn', () => onPreviewMode(false), { icon: Pencil, checked: !previewMode }),
    item('Xem trước', () => onPreviewMode(true), { icon: Eye, checked: previewMode }),
  ];
  const insertMenu: RibbonEntry[] = [
    item(`Chỗ trống (${nextBlankLabel})`, onInsertBlank, { icon: SquareDashed, disabled: noPara }),
    sep,
    item('Ảnh vào đoạn văn…', () => imageRef.current?.click(), { icon: ImageIcon, disabled: noPara || !imageSupported }),
    item('Ảnh lớn cạnh bài đọc…', () => bodyImageRef.current?.click(), { icon: ImageUp }),
    item(generatingBodyImage ? 'Đang tạo ảnh AI…' : 'Tạo ảnh AI cho bài đọc', onGenerateBodyImage, { icon: ImagePlus, disabled: generatingBodyImage }),
    item('Audio…', () => audioRef.current?.click(), { icon: Headphones }),
    sep,
    item('Bảng', () => onAddExtra('table'), { icon: Table2 }),
    item('Text box', () => onAddExtra('text'), { icon: Type }),
    item('Đường kẻ', () => onAddExtra('line'), { icon: Minus }),
    item('Hình', () => onAddExtra('shape'), { icon: Square }),
    sep,
    item('Mã QR trên worksheet', () => onSettings({ showQrCode: !settings.showQrCode }), { icon: QrCode, checked: settings.showQrCode }),
    item('Bắt đầu bài ở trang mới', () => onSettings({ pageBreakBefore: !settings.pageBreakBefore }), { icon: FilePlus, checked: !!settings.pageBreakBefore }),
  ];
  const toolsMenu: RibbonEntry[] = [
    item('AI Assist (Smart Paste)', onSmartPaste, { icon: Sparkles }),
    item('Sắp xếp lại nhãn chỗ trống', onResequence, { icon: ListRestart }),
    sep,
    title('Cài đặt worksheet'),
    ...MORE_SETTINGS.map((s) => item(s.label, () => setPanel(s.key), { icon: SlidersHorizontal })),
  ];
  const menus: [string, RibbonEntry[]][] = [['File', fileMenu], ['Edit', editMenu], ['Format', formatMenu], ['View', viewMenu], ['Insert', insertMenu], ['Tools', toolsMenu]];

  const pickLayout = (id: string) => onSettings(
    id === 'form_completion' ? { ...PASSAGE_IMAGE_PRESET, layout: 'form_completion' as const }
    : id === 'dialogue' ? DIALOGUE_PRESET
    : id === 'passage_qr' ? PASSAGE_QR_PRESET
    : id === 'passage_image' ? PASSAGE_IMAGE_PRESET
    : id === 'outline' ? OUTLINE_PRESET
    : id === 'sentence_list' ? SENTENCE_LIST_PRESET
    : { layout: id as ListeningGapFillSettings['layout'] },
  );
  const AlignIcon = currentAlign === 'center' ? AlignCenter : currentAlign === 'right' ? AlignRight : AlignLeft;

  return (
    <RibbonRoot locked={locked} lockedHint="Đang ở chế độ Preview – chuyển sang Edit Mode để chỉnh sửa">
      {/* Hàng 1: menu */}
      <div className="flex items-center gap-0.5 px-3 pt-1">
        {menus.map(([name, entries]) => (
          <Popover key={name} id={`menu-${name}`} hoverSwitch trigger={(p) => <MenuTrigger {...p} label={name} />}>
            {(close) => <MenuList entries={entries} close={close} />}
          </Popover>
        ))}
      </div>

      {/* Hàng 2: công cụ */}
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5 px-3 pb-1.5 pt-0.5">
        <TbButton icon={Undo2} label="Hoàn tác" shortcut="Ctrl+Z" disabled={!undo.canUndo} onClick={undo.onUndo} />
        <TbButton icon={Redo2} label="Làm lại" shortcut="Ctrl+Y" disabled={!undo.canRedo} onClick={undo.onRedo} />
        <TbSep />

        <Popover id="zoom" trigger={(p) => <DropdownTrigger {...p} label="Zoom bản xem trước A4" width="w-[4.5rem]">{zoom}%</DropdownTrigger>}>
          {(close) => <MenuList minWidth="min-w-[7rem]" close={close} entries={ZOOMS.map((z) => item(`${z}%`, () => onZoom(z), { checked: zoom === z }))} />}
        </Popover>
        <TbSep />

        <Popover id="style" trigger={(p) => <DropdownTrigger {...p} label="Kiểu đoạn" width="w-[7.5rem]" disabled={noPara}>{STYLE_LABEL[styleKind]}</DropdownTrigger>}>
          {(close) => (
            <MenuList minWidth="min-w-[10rem]" close={close} entries={(['normal', 'heading', 'subheading'] as ParagraphStyleKind[]).map((k) =>
              item(STYLE_LABEL[k], () => onParagraphStyle(k), { checked: styleKind === k }))} />
          )}
        </Popover>
        <Popover id="font" trigger={(p) => <DropdownTrigger {...p} label="Phông chữ" width="w-[8rem]" disabled={textOff}><span style={{ fontFamily }}>{fontFamily}</span></DropdownTrigger>}>
          {(close) => (
            <MenuList minWidth="min-w-[10rem]" close={close} entries={(FONTS.includes(fontFamily) ? FONTS : [fontFamily, ...FONTS]).map((f) =>
              item(f, () => (rangeSelected ? onMarkFormat({ fontFamily: f }) : onSettings({ fontFamily: f })), { checked: fontFamily === f }))} />
          )}
        </Popover>
        <SizeInput value={fontSize} disabled={textOff} onSet={(pt) => (rangeSelected ? onMarkFormat({ fontSizePt: pt }) : onSettings({ passageFontSizePt: pt }))} />
        <TbSep />

        <TbButton icon={Bold} label="Bold – in đậm" shortcut="Ctrl+B" active={bold} disabled={textOff} disabledReason={needPara} onClick={() => onMarkFormat({ bold: !bold })} />
        <TbButton icon={Italic} label="Italic – in nghiêng" shortcut="Ctrl+I" active={italic} disabled={textOff} disabledReason={needPara} onClick={() => onMarkFormat({ italic: !italic })} />
        <TbButton icon={Underline} label="Underline – gạch chân" shortcut="Ctrl+U" active={underline} disabled={textOff} disabledReason={needPara} onClick={() => onMarkFormat({ underline: !underline })} />
        <Popover id="color" trigger={(p) => (
          <DropdownTrigger {...p} label="Màu chữ" tip="Màu chữ" disabled={textOff} width="!px-1">
            <span className="flex flex-col items-center"><Baseline size={16} strokeWidth={1.9} /><span className="-mt-0.5 h-[3px] w-4 rounded-sm" style={{ background: color || '#111827' }} /></span>
          </DropdownTrigger>
        )}>
          {(close) => <ColorPalette value={color} close={close} noneLabel="Mặc định (đen)" onPick={(c) => onMarkFormat({ color: c })} />}
        </Popover>
        <Popover id="highlight" trigger={(p) => (
          <DropdownTrigger {...p} label="Tô nền chữ" tip="Tô nền chữ (highlight)" disabled={textOff} width="!px-1">
            <span className="flex flex-col items-center"><Highlighter size={16} strokeWidth={1.9} /><span className="-mt-0.5 h-[3px] w-4 rounded-sm" style={{ background: highlight || '#fde047' }} /></span>
          </DropdownTrigger>
        )}>
          {(close) => <ColorPalette highlight value={highlight} close={close} noneLabel="Không tô nền" onPick={(c) => onMarkFormat({ highlight: c })} />}
        </Popover>
        <TbSep />

        <Popover id="align" trigger={(p) => (
          <DropdownTrigger {...p} label="Căn lề" tip="Căn lề" disabled={!para && !extraSelected} width="!px-1.5"><AlignIcon size={16} strokeWidth={1.9} /></DropdownTrigger>
        )}>
          {(close) => (
            <MenuList minWidth="min-w-[9rem]" close={close} entries={[
              item('Căn trái', () => setAlign('left'), { icon: AlignLeft, checked: currentAlign === 'left' }),
              item('Căn giữa', () => setAlign('center'), { icon: AlignCenter, checked: currentAlign === 'center' }),
              item('Căn phải', () => setAlign('right'), { icon: AlignRight, checked: currentAlign === 'right' }),
            ]} />
          )}
        </Popover>
        <TbButton icon={List} label="Bulleted list – gạch đầu dòng" active={list === 'bullet'} disabled={noPara} disabledReason={needPara} onClick={() => onParaFormat({ list: list === 'bullet' ? 'none' : 'bullet' })} />
        <TbButton icon={ListOrdered} label="Numbered list – đánh số" active={list === 'number'} disabled={noPara} disabledReason={needPara} onClick={() => onParaFormat({ list: list === 'number' ? 'none' : 'number' })} />
        <TbButton icon={Outdent} label="Decrease indent – giảm thụt lề" disabled={noPara || !fmt.indentMm} disabledReason={noPara ? needPara : 'Đoạn này chưa thụt lề'} onClick={() => onParaFormat({ indentMm: Math.max(0, (fmt.indentMm || 0) - 5) })} />
        <TbButton icon={Indent} label="Increase indent – tăng thụt lề" disabled={noPara || (fmt.indentMm || 0) >= 30} disabledReason={noPara ? needPara : 'Đã thụt lề tối đa'} onClick={() => onParaFormat({ indentMm: (fmt.indentMm || 0) + 5 })} />
        <Popover id="spacing" trigger={(p) => <DropdownTrigger {...p} label="Giãn dòng" tip="Giãn dòng" width="!px-1.5"><ArrowDownUp size={16} strokeWidth={1.9} /></DropdownTrigger>}>
          {(close) => <MenuList minWidth="min-w-[7rem]" close={close} entries={LINE_HEIGHTS.map((h) => item(h.toFixed(1), () => onSettings({ lineHeight: h }), { checked: settings.lineHeight === h }))} />}
        </Popover>
        <TbButton icon={RemoveFormatting} label="Clear formatting – xóa định dạng" disabled={noPara || !hasFormat} disabledReason={noPara ? needPara : 'Chưa có định dạng nào để xóa'} onClick={onClearFormat} />
        <TbSep />

        <TbButton icon={ImageIcon} label="Insert image – chèn ảnh vào đoạn đang chọn" disabled={noPara || !imageSupported} disabledReason={!imageSupported ? 'Layout này không có ảnh – chọn Original, Hai cột hoặc Kết hợp hình ảnh' : needPara} onClick={() => imageRef.current?.click()} />
        <TbButton icon={Table2} label="Insert table – chèn bảng" onClick={() => onAddExtra('table')} />

        <div className="ml-auto flex items-center gap-1.5 pl-2">
          <Popover id="layout" trigger={(p) => <DropdownTrigger {...p} label="Layout – chọn bố cục worksheet" tip="Layout – chọn bố cục worksheet"><LayoutTemplate size={15} strokeWidth={1.9} />Layout</DropdownTrigger>}>
            {(close) => (
              <div className="grid w-[22rem] grid-cols-2 gap-2 p-2">
                {LISTENING_LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { pickLayout(l.id); close(); }}
                    className={`rounded-lg border p-1.5 text-left transition-colors ${settings.layout === l.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <ListeningLayoutThumbnail layout={l.id} className="h-14 w-full" />
                    <div className="mt-1 text-xs font-semibold text-slate-800">{l.label}</div>
                    {l.desc && <div className="text-[11px] leading-tight text-slate-500">{l.desc}</div>}
                  </button>
                ))}
              </div>
            )}
          </Popover>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onInsertBlank}
            disabled={noPara}
            title={noPara ? needPara : `Insert Blank – chèn chỗ trống (${nextBlankLabel}) tại con trỏ; đang bôi đen thì thay vùng chọn bằng chỗ trống`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SquareDashed size={15} strokeWidth={2} /> Insert Blank ({nextBlankLabel})
          </button>
        </div>
      </div>

      {/* Ô chọn file ẩn dùng cho menu Insert và nút Ảnh */}
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={onImageFile} />
      <input ref={bodyImageRef} type="file" accept="image/*" hidden onChange={onBodyImageFile} />
      <input ref={audioRef} type="file" accept="audio/*" hidden onChange={onAudioFile} />

      {/* Cài đặt worksheet (mở từ Tools) */}
      {panel && (
        <div className="absolute right-4 top-full z-40 mt-1 max-h-[70vh] w-[22rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{MORE_SETTINGS.find((s) => s.key === panel)?.label}</h3>
            <button type="button" onClick={() => setPanel(null)} aria-label="Đóng" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button>
          </div>
          {renderMoreSection(panel)}
        </div>
      )}
    </RibbonRoot>
  );
};
