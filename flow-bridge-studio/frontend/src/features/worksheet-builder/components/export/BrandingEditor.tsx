import React, { useState } from 'react';
import { X, Upload, Trash2, Save } from 'lucide-react';
import type { CefrLevel, WorksheetBranding } from '../../types/branding';
import { DEFAULT_BRANDING, fileToSmallDataUrl, saveDefaultBranding } from '../../types/branding';

interface Props {
  value: WorksheetBranding;
  onChange: (next: WorksheetBranding) => void;
  onClose: () => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block text-[11px] font-bold text-slate-600">
    {label}
    <div className="mt-1 font-normal">{children}</div>
  </label>
);

const inputCls = 'w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:border-violet-400';

type ImageKey = 'logoUrl' | 'qrUrl' | 'avatarUrl';

export const BrandingEditor: React.FC<Props> = ({ value, onChange, onClose }) => {
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof WorksheetBranding>(k: K, v: WorksheetBranding[K]) => onChange({ ...value, [k]: v });

  const upload = async (key: ImageKey, files: FileList | null) => {
    const f = files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    try {
      set(key, await fileToSmallDataUrl(f));
      setMsg(null);
    } catch (e: any) {
      setMsg(e?.message || 'Không đọc được ảnh');
    }
  };

  const ImagePick = ({ label, k, hint }: { label: string; k: ImageKey; hint: string }) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 bg-slate-50">
      <div className="w-12 h-12 shrink-0 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden text-[9px] text-slate-400">
        {value[k] ? <img src={value[k]} alt="" className="w-full h-full object-contain" /> : 'trống'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-slate-700">{label}</div>
        <div className="text-[10px] text-slate-400 truncate">{hint}</div>
      </div>
      <label className="cursor-pointer text-[11px] font-bold text-violet-700 px-2 py-1 rounded-lg border border-violet-200 bg-white hover:bg-violet-50 flex items-center gap-1">
        <Upload size={11} /> Tải
        <input type="file" accept="image/*" hidden onChange={(e) => { void upload(k, e.target.files); e.currentTarget.value = ''; }} />
      </label>
      {value[k] && (
        <button onClick={() => set(k, undefined)} className="text-slate-400 hover:text-rose-600" aria-label={`Xóa ${label}`}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );

  const saveAsDefault = () =>
    setMsg(saveDefaultBranding(value)
      ? 'Đã lưu làm mặc định: các đề khác sẽ dùng thông tin này (trừ phần bạn đã sửa riêng).'
      : 'Không lưu được (ảnh quá lớn hoặc trình duyệt chặn lưu).');

  return (
    <aside className="no-print w-80 shrink-0 bg-white border-l border-slate-200 overflow-y-auto overflow-x-hidden h-full">
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
        <h3 className="text-sm font-bold text-slate-900">Header &amp; Footer</h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800" aria-label="Đóng"><X size={15} /></button>
      </div>

      <div className="p-4 space-y-4">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={value.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Dùng header/footer kiểu phiếu bài tập
        </label>

        <p className="text-[11px] text-slate-400 leading-snug">
          Bấm thẳng vào header hoặc footer trong bản xem trước cũng mở bảng này. Thay đổi hiện ngay và được lưu theo từng đề.
        </p>

        <div className="space-y-2">
          <ImagePick label="Logo" k="logoUrl" hint="Góc trái header" />
          <ImagePick label="Mã QR" k="qrUrl" hint="Footer trang lẻ" />
          <ImagePick label="Ảnh đại diện giáo viên" k="avatarUrl" hint="Footer trang chẵn" />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Header</legend>
          <Field label="Tiêu đề"><input className={inputCls} value={value.docTitle} onChange={(e) => set('docTitle', e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Level"><input className={inputCls} value={value.level} onChange={(e) => set('level', e.target.value)} /></Field>
            <div className="col-span-2">
              <Field label="Mã số (No.)"><input className={inputCls} value={value.worksheetNo} onChange={(e) => set('worksheetNo', e.target.value)} /></Field>
            </div>
          </div>
          <Field label="Mức CEFR đánh dấu">
            <select className={inputCls} value={value.cefrActive} onChange={(e) => set('cefrActive', e.target.value as CefrLevel)}>
              {(['A1', 'A2', 'B1', 'B2'] as CefrLevel[]).map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Hiện header ở">
            <select className={inputCls} value={value.headerPages} onChange={(e) => set('headerPages', e.target.value as WorksheetBranding['headerPages'])}>
              <option value="first">Chỉ trang đầu</option>
              <option value="all">Mọi trang</option>
            </select>
          </Field>
          <div className="flex gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={value.showScoreBox} onChange={(e) => set('showScoreBox', e.target.checked)} /> Ô Score</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={value.showStickers} onChange={(e) => set('showStickers', e.target.checked)} /> OK / GOOD / WOW</label>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Footer</legend>
          <Field label="Kiểu footer">
            <select className={inputCls} value={value.footerMode} onChange={(e) => set('footerMode', e.target.value as WorksheetBranding['footerMode'])}>
              <option value="alternate">Xen kẽ: trang lẻ QR + web, trang chẵn giáo viên</option>
              <option value="info">Luôn QR + website</option>
              <option value="teacher">Luôn giáo viên</option>
            </select>
          </Field>
          {value.footerMode === 'alternate' && (
            <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-lg p-2 leading-snug">
              Đang xem thử: màn hình bên trái hiện 2 trang demo (trang 1 lẻ, trang 2 chẵn) để bạn kiểm tra footer xen kẽ.
            </p>
          )}
          <Field label="Website"><input className={inputCls} value={value.website} onChange={(e) => set('website', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Unit"><input className={inputCls} value={value.unitLabel} onChange={(e) => set('unitLabel', e.target.value)} /></Field>
            <Field label="Lesson"><input className={inputCls} value={value.lessonLabel} onChange={(e) => set('lessonLabel', e.target.value)} /></Field>
          </div>
          <div className="rounded-xl border border-slate-200 p-2 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={value.autoProgress} onChange={(e) => set('autoProgress', e.target.checked)} />
              Tiến độ % tự tính theo số trang của đề
            </label>
            {value.autoProgress ? (
              <p className="text-[11px] text-slate-500 leading-snug">% = trang hiện tại / tổng số trang của đề, nên đề dài hay ngắn thì số % tự thay đổi theo.</p>
            ) : (
              <Field label="Tiến độ % (nhập tay)"><input className={inputCls} value={value.progress} onChange={(e) => set('progress', e.target.value)} /></Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Giáo viên"><input className={inputCls} value={value.teacherName} onChange={(e) => set('teacherName', e.target.value)} /></Field>
            <Field label="Số điện thoại"><input className={inputCls} value={value.teacherPhone} onChange={(e) => set('teacherPhone', e.target.value)} /></Field>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 pt-1">
          <button onClick={saveAsDefault} className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
            <Save size={13} /> Dùng làm mặc định cho mọi đề
          </button>
          <button
            onClick={() => onChange({ ...DEFAULT_BRANDING, logoUrl: value.logoUrl, qrUrl: value.qrUrl, avatarUrl: value.avatarUrl })}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Đặt lại chữ về mẫu ban đầu
          </button>
          {msg && <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">{msg}</p>}
        </div>
      </div>
    </aside>
  );
};
