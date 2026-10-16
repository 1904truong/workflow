// Điểm nối giữa logic hàng đợi (imageJobs.ts) và ứng dụng: một store + một runner dùng chung toàn app.
import { useSyncExternalStore } from 'react';
import { createJobStore, createJobRunner, type ImageJob, type StorageLike } from './imageJobs.ts';
import { generateImageViaExtension } from './extensionBridge.ts';

const memory = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

export const imageJobStore = createJobStore(typeof localStorage !== 'undefined' ? localStorage : memory());

type AssignHandler = (job: ImageJob, result: { imageUrl: string; storagePath?: string; source: 'supabase' | 'flow' }) => boolean;
let assignHandler: AssignHandler | null = null;

/** App đăng ký hàm gắn ảnh vào ô đúng của đề (đăng ký lại mỗi lần state đề đổi) */
export function setJobAssignHandler(h: AssignHandler | null) {
  assignHandler = h;
}

export const imageJobRunner = createJobRunner({
  store: imageJobStore,
  generate: (job, references) =>
    generateImageViaExtension({ prompt: job.prompt, referenceImages: references, aspectRatio: job.aspectRatio }),
  assign: (job, result) => (assignHandler ? assignHandler(job, result) : false),
});

let runnerVersion = 0;
const runnerListeners = new Set<() => void>();
const bump = () => { runnerVersion++; runnerListeners.forEach((l) => l()); };

/** Bắt đầu/tiếp tục xử lý hàng đợi */
export async function startImageJobs() {
  bump();
  try {
    await imageJobRunner.kick();
  } finally {
    bump();
  }
}

export async function resumeImageJobs() {
  bump();
  try {
    await imageJobRunner.resume();
  } finally {
    bump();
  }
}

export function useImageJobs(worksheetId?: string): ImageJob[] {
  const all = useSyncExternalStore(imageJobStore.subscribe, imageJobStore.getAll);
  return worksheetId ? all.filter((j) => j.worksheetId === worksheetId) : all;
}

export function useRunnerState() {
  useSyncExternalStore(
    (l) => { runnerListeners.add(l); return () => runnerListeners.delete(l); },
    () => runnerVersion,
  );
  return { running: imageJobRunner.isRunning, pausedReason: imageJobRunner.pausedReason };
}
