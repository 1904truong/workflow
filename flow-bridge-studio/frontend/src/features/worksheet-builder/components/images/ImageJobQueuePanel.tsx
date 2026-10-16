import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, Ban, Play, Upload } from 'lucide-react';
import {
  imageJobStore, resumeImageJobs, startImageJobs, useImageJobs, useRunnerState,
} from '../../services/ai/imageJobService';
import type { ImageJob, JobStatus } from '../../services/ai/imageJobs';

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'Đang chờ',
  needs_reference: 'Cần ảnh tham chiếu',
  running: 'Đang tạo...',
  done: 'Xong',
  failed: 'Lỗi',
  cancelled: 'Đã hủy',
};

const STATUS_STYLE: Record<JobStatus, string> = {
  queued: 'bg-slate-100 text-slate-600',
  needs_reference: 'bg-amber-100 text-amber-800',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const ImageJobQueuePanel: React.FC<{ worksheetId: string }> = ({ worksheetId }) => {
  const jobs = useImageJobs(worksheetId);
  const { running, pausedReason } = useRunnerState();
  if (jobs.length === 0) return null;

  const done = jobs.filter((j) => j.status === 'done').length;
  const pending = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const hasWork = jobs.some((j) => j.status === 'queued');

  const addRefs = async (job: ImageJob, files: FileList | null) => {
    if (!files) return;
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 3)) if (f.type.startsWith('image/')) urls.push(await fileToDataUrl(f));
    if (urls.length) {
      imageJobStore.setReferences(job.jobId, [...imageJobStore.getReferences(job.jobId), ...urls].slice(0, 3));
      void startImageJobs();
    }
  };

  return (
    <section className="bg-white border border-violet-200 rounded-3xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            Hàng đợi tạo ảnh AI
            {running && <Loader2 size={14} className="animate-spin text-violet-600" />}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {done}/{jobs.length} xong · {pending} đang chờ/chạy{failed ? ` · ${failed} lỗi` : ''}. Trạng thái được lưu: tải lại trang vẫn tiếp tục.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pausedReason ? (
            <button onClick={() => void resumeImageJobs()} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              <Play size={12} /> Tiếp tục
            </button>
          ) : (
            hasWork && !running && (
              <button onClick={() => void startImageJobs()} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                <Play size={12} /> Chạy hàng đợi
              </button>
            )
          )}
          <button onClick={() => imageJobStore.clearFinished(worksheetId)} className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
            Dọn mục đã xong
          </button>
        </div>
      </div>

      {pausedReason && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Hàng đợi đang tạm dừng: {pausedReason} — hãy khắc phục (mở tab Google Flow, bật extension, đăng nhập Supabase...) rồi bấm “Tiếp tục”.</span>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {jobs.map((j) => (
          <li key={j.jobId} className="py-2.5 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-800 w-20 shrink-0">Picture {j.label}</span>
            <span className="flex-1 min-w-[10rem] text-slate-600 truncate" title={j.prompt}>{j.subject}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${STATUS_STYLE[j.status]}`}>
              {j.status === 'running' && <Loader2 size={10} className="animate-spin" />}
              {j.status === 'done' && <CheckCircle2 size={10} />}
              {STATUS_LABEL[j.status]}{j.attempts > 1 && j.status !== 'done' ? ` (lần ${j.attempts})` : ''}
            </span>
            {j.status === 'done' && j.source && (
              <span className={`text-[10px] font-bold ${j.source === 'supabase' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {j.source === 'supabase' ? '☁ Supabase' : 'Flow (chưa lưu Supabase)'}
              </span>
            )}
            {j.status === 'needs_reference' && (
              <label className="inline-flex items-center gap-1 font-bold text-violet-700 cursor-pointer px-2 py-1 rounded-lg border border-violet-200 bg-white hover:bg-violet-50">
                <Upload size={11} /> Thêm ảnh tham chiếu
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addRefs(j, e.target.files); e.currentTarget.value = ''; }} />
              </label>
            )}
            {(j.status === 'failed' || j.status === 'cancelled') && (
              <button onClick={() => { imageJobStore.retry(j.jobId); void startImageJobs(); }} className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700">
                <RotateCcw size={11} /> Thử lại
              </button>
            )}
            {(j.status === 'queued' || j.status === 'needs_reference') && (
              <button onClick={() => imageJobStore.cancel(j.jobId)} className="flex items-center gap-1 font-bold text-slate-400 hover:text-rose-600">
                <Ban size={11} /> Hủy
              </button>
            )}
            {j.error && j.status !== 'done' && <span className="basis-full text-[10px] text-rose-600 pl-[5.75rem]">{j.error}</span>}
            {j.error && j.status === 'done' && <span className="basis-full text-[10px] text-amber-600 pl-[5.75rem]">{j.error}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
};
