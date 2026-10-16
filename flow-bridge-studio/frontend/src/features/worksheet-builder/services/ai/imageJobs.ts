// Hàng đợi tạo ảnh: job có trạng thái lưu bền (localStorage), chạy tuần tự, thử lại, tiếp tục sau khi bị ngắt, chống tạo trùng.
import type { AiImagePlan, AiAspectRatio } from './imagePlanSchema.ts';
import { buildFinalPrompt, DEFAULT_STYLE_SUFFIX } from './imagePlanCompare.ts';

export type JobStatus = 'queued' | 'needs_reference' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ImageJob {
  jobId: string;
  worksheetId: string;
  exerciseId: string;
  slotId: string;
  label: string;
  subject: string;
  /** Prompt cuối cùng đã gồm phần phong cách chung */
  prompt: string;
  /** Ảnh tham chiếu (data URL). Chỉ giữ trong bộ nhớ, không lưu bền vì quá nặng */
  referenceImages: string[];
  needsReference: boolean;
  referenceNote: string;
  generationMode: 'text_to_image' | 'reference_guided';
  aspectRatio: AiAspectRatio;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  imageUrl?: string;
  storagePath?: string;
  source?: 'supabase' | 'flow';
  dedupeKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const STORAGE_KEY = 'flow_bridge_image_jobs_v1';

export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const makeDedupeKey = (worksheetId: string, slotId: string, prompt: string) =>
  `${worksheetId}|${slotId}|${hashString(prompt)}`;

// ───────────── Store ─────────────
export function createJobStore(storage: StorageLike) {
  let jobs: ImageJob[] = [];
  const listeners = new Set<() => void>();
  const memRefs = new Map<string, string[]>(); // jobId -> ảnh tham chiếu (chỉ trong bộ nhớ)

  const persist = () => {
    try {
      // Không lưu ảnh tham chiếu (data URL nặng) vào localStorage
      storage.setItem(STORAGE_KEY, JSON.stringify(jobs.map((j) => ({ ...j, referenceImages: [] }))));
    } catch {
      /* hết quota: bỏ qua, trạng thái vẫn còn trong bộ nhớ */
    }
  };
  const emit = () => { persist(); listeners.forEach((l) => l()); };

  const load = () => {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      jobs = raw ? (JSON.parse(raw) as ImageJob[]) : [];
    } catch {
      jobs = [];
    }
    // Hồi phục sau khi bị ngắt: job đang chạy dở quay lại hàng đợi; job cần ảnh tham chiếu mà mất ảnh -> chờ bổ sung
    let changed = false;
    jobs = jobs.map((j) => {
      if (j.status === 'running') { changed = true; return { ...j, status: 'queued' as const, error: 'Bị ngắt giữa chừng, tự xếp lại hàng đợi', updatedAt: Date.now() }; }
      if (j.status === 'queued' && j.needsReference && !(memRefs.get(j.jobId)?.length)) {
        changed = true;
        return { ...j, status: 'needs_reference' as const, error: 'Cần bổ sung lại ảnh tham chiếu', updatedAt: Date.now() };
      }
      return j;
    });
    if (changed) persist();
  };
  load();

  return {
    getAll: () => jobs,
    subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
    getReferences: (jobId: string) => memRefs.get(jobId) || [],

    /** Thêm job; bỏ qua job trùng (cùng worksheet+slot+prompt) đang chờ/chạy/đã xong */
    addJobs(newJobs: ImageJob[]): { added: ImageJob[]; skipped: ImageJob[] } {
      const added: ImageJob[] = [];
      const skipped: ImageJob[] = [];
      for (const j of newJobs) {
        const dup = jobs.find((x) => x.dedupeKey === j.dedupeKey && x.status !== 'failed' && x.status !== 'cancelled');
        if (dup) { skipped.push(j); continue; }
        if (j.referenceImages.length) memRefs.set(j.jobId, j.referenceImages);
        jobs = [...jobs, { ...j, referenceImages: [] }];
        added.push(j);
      }
      if (added.length) emit();
      return { added, skipped };
    },

    update(jobId: string, patch: Partial<ImageJob>) {
      jobs = jobs.map((j) => (j.jobId === jobId ? { ...j, ...patch, updatedAt: Date.now() } : j));
      emit();
    },
    setReferences(jobId: string, refs: string[]) {
      memRefs.set(jobId, refs);
      jobs = jobs.map((j) =>
        j.jobId === jobId
          ? { ...j, status: j.status === 'needs_reference' && refs.length ? 'queued' : j.status, error: j.status === 'needs_reference' && refs.length ? undefined : j.error, updatedAt: Date.now() }
          : j,
      );
      emit();
    },
    retry(jobId: string) {
      jobs = jobs.map((j) => (j.jobId === jobId && (j.status === 'failed' || j.status === 'cancelled') ? { ...j, status: 'queued' as const, attempts: 0, error: undefined, updatedAt: Date.now() } : j));
      emit();
    },
    cancel(jobId: string) {
      jobs = jobs.map((j) => (j.jobId === jobId && (j.status === 'queued' || j.status === 'needs_reference') ? { ...j, status: 'cancelled' as const, updatedAt: Date.now() } : j));
      emit();
    },
    clearFinished(worksheetId?: string) {
      jobs = jobs.filter((j) => !(['done', 'cancelled'].includes(j.status) && (!worksheetId || j.worksheetId === worksheetId)));
      emit();
    },
  };
}

export type JobStore = ReturnType<typeof createJobStore>;

// ───────────── Kế hoạch ảnh -> job ─────────────
export interface PlanToJobsInput {
  plan: AiImagePlan;
  worksheetId: string;
  /** slotId của AI -> ô thật (từ applyPlanToExercises) */
  slotMap: Record<string, { exerciseId: string; slotId: string }>;
  /** Ảnh tham chiếu giáo viên cung cấp theo slotId của AI */
  referenceBySlot?: Record<string, string[]>;
  /** Các slotId (của AI) giáo viên đã bỏ chọn */
  excluded?: Set<string>;
  style?: string;
  newId?: () => string;
}

export function planToJobs(input: PlanToJobsInput): ImageJob[] {
  const { plan, worksheetId, slotMap, referenceBySlot = {}, excluded = new Set(), style = DEFAULT_STYLE_SUFFIX } = input;
  const newId = input.newId || (() => `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  const now = Date.now();
  const jobs: ImageJob[] = [];

  for (const im of plan.images) {
    if (excluded.has(im.slotId)) continue;
    const target = slotMap[im.slotId];
    if (!target) continue; // không có ô thật để gắn -> không tạo job mồ côi
    const refs = referenceBySlot[im.slotId] || [];
    const prompt = buildFinalPrompt(im.prompt, style);
    jobs.push({
      jobId: newId(),
      worksheetId,
      exerciseId: target.exerciseId,
      slotId: target.slotId,
      label: im.label,
      subject: im.subject,
      prompt,
      referenceImages: refs,
      needsReference: im.needsReference,
      referenceNote: im.referenceNote,
      generationMode: im.needsReference ? 'reference_guided' : 'text_to_image',
      aspectRatio: im.aspectRatio,
      status: im.needsReference && refs.length === 0 ? 'needs_reference' : 'queued',
      attempts: 0,
      maxAttempts: 3,
      dedupeKey: makeDedupeKey(worksheetId, target.slotId, prompt),
      createdAt: now,
      updatedAt: now,
    });
  }
  return jobs;
}

// ───────────── Runner ─────────────
export interface RunnerDeps {
  store: JobStore;
  generate: (job: ImageJob, references: string[]) => Promise<{ imageUrl: string; storagePath?: string; source: 'supabase' | 'flow' }>;
  /** Gắn ảnh vào ô trong đề. Trả false nếu không tìm thấy ô (đề đã bị xóa/sửa) */
  assign: (job: ImageJob, result: { imageUrl: string; storagePath?: string; source: 'supabase' | 'flow' }) => boolean;
  sleep?: (ms: number) => Promise<void>;
  backoffMs?: (attempt: number) => number;
}

/** Lỗi môi trường: dừng cả hàng đợi (không đốt số lần thử), chờ người dùng sửa rồi bấm Tiếp tục */
const PAUSE_CODES = new Set(['EXTENSION_UNAVAILABLE', 'FLOW_TAB_NOT_FOUND', 'NOT_SIGNED_IN', 'NOT_CONFIGURED']);
/** Lỗi tạm thời: thử lại sau một lúc */
const RETRY_CODES = new Set(['BUSY', 'TIMEOUT', 'GENERATE_FAILED', 'GENERATE_START_UNCONFIRMED', 'PREPARATION_FAILED', 'GENERATE_BUTTON_NOT_FOUND', 'FAILED']);

export function createJobRunner(deps: RunnerDeps) {
  const sleep = deps.sleep || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const backoff = deps.backoffMs || ((n: number) => Math.min(60000, 5000 * 2 ** (n - 1)));
  let running = false;
  let pausedReason: string | null = null;

  async function processOne(jobId: string): Promise<void> {
    const job = deps.store.getAll().find((j) => j.jobId === jobId);
    if (!job || job.status !== 'queued') return;

    deps.store.update(jobId, { status: 'running', attempts: job.attempts + 1, error: undefined });
    const current = deps.store.getAll().find((j) => j.jobId === jobId)!;
    try {
      const result = await deps.generate(current, deps.store.getReferences(jobId));
      const placed = deps.assign(current, result);
      deps.store.update(jobId, {
        status: 'done',
        imageUrl: result.imageUrl,
        storagePath: result.storagePath,
        source: result.source,
        error: placed ? undefined : 'Ảnh đã tạo nhưng không tìm thấy ô ảnh để gắn (đề đã bị xóa/sửa?)',
      });
    } catch (e: any) {
      const code: string = e?.code || 'FAILED';
      const msg: string = e?.message || 'Lỗi không rõ';
      if (code === 'STOPPED') {
        deps.store.update(jobId, { status: 'cancelled', error: 'Đã dừng' });
      } else if (PAUSE_CODES.has(code)) {
        deps.store.update(jobId, { status: 'queued', attempts: Math.max(0, current.attempts - 1), error: msg });
        pausedReason = msg;
      } else if ((RETRY_CODES.has(code) || !code) && current.attempts < current.maxAttempts) {
        deps.store.update(jobId, { status: 'queued', error: `Lần ${current.attempts}/${current.maxAttempts} lỗi: ${msg}` });
        await sleep(backoff(current.attempts));
      } else {
        deps.store.update(jobId, { status: 'failed', error: msg });
      }
    }
  }

  return {
    get isRunning() { return running; },
    get pausedReason() { return pausedReason; },
    resume() { pausedReason = null; return this.kick(); },
    /** Chạy tuần tự các job 'queued' cho tới khi hết hoặc gặp lỗi môi trường. An toàn khi gọi nhiều lần. */
    async kick(): Promise<void> {
      if (running || pausedReason) return;
      running = true;
      try {
        for (;;) {
          const next = deps.store.getAll().find((j) => j.status === 'queued');
          if (!next || pausedReason) break;
          await processOne(next.jobId);
        }
      } finally {
        running = false;
      }
    },
  };
}
