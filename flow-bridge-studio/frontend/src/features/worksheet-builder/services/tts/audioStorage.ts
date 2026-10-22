// Lưu audio lên Supabase Storage (bucket công khai) và dựng link công khai.
// Địa chỉ + khóa Supabase lấy từ màn hình Cài đặt; bài chỉ lưu đường dẫn trong bucket (storagePath), không lưu link đầy đủ,
// nên chuyển sang Supabase của công ty chỉ cần đổi cấu hình và chép file sang bucket cùng tên.

const BUCKET_KEY = 'fb_audio_bucket';
const DEFAULT_BUCKET = 'audio';

const read = (k: string): string => { try { return (localStorage.getItem(k) || '').trim(); } catch { return ''; } };

export const getAudioBucket = (): string => read(BUCKET_KEY) || DEFAULT_BUCKET;

// Chỉ nhận địa chỉ dạng https://...; giá trị lạ (vd email do trình duyệt tự điền) coi như chưa cấu hình
const baseUrl = (): string => {
  const v = read('fb_supabase_url').replace(/\/+$/, '');
  return /^https?:\/\/[^\s/@]+\.[^\s/@]+/i.test(v) ? v : '';
};

/** Link công khai của một file trong bucket audio theo cấu hình hiện tại; '' nếu chưa cấu hình */
export const publicAudioUrl = (storagePath: string): string => {
  const base = baseUrl();
  if (!base || !storagePath) return '';
  return `${base}/storage/v1/object/public/${getAudioBucket()}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
};

export interface StoredAudio { storagePath: string; publicUrl: string }

/** Tải file lên bucket audio. Ném Error có thông báo tiếng Việt. */
export const uploadAudioFile = async (file: Blob, ext = 'mp3'): Promise<StoredAudio> => {
  const base = baseUrl();
  const key = read('fb_supabase_key');
  if (!base || !key) throw new Error('Địa chỉ hoặc khóa Supabase trong Cài đặt chưa có hoặc không hợp lệ. Địa chỉ phải dạng https://xxxx.supabase.co.');
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storagePath = `tts/${month}/${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  let res: Response;
  try {
    res = await fetch(`${base}/storage/v1/object/${getAudioBucket()}/${storagePath}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': file.type || 'audio/mpeg', 'x-upsert': 'false' },
      body: file,
    });
  } catch {
    throw new Error('Không kết nối được Supabase. Kiểm tra mạng và địa chỉ trong Cài đặt.');
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.message || j.error || ''; } catch { /* bỏ qua */ }
    if (res.status === 404 || /bucket/i.test(detail)) throw new Error(`Không tìm thấy bucket "${getAudioBucket()}" trên dự án ${base} (mã ${res.status}${detail ? `: ${detail}` : ''}). Kiểm tra tên bucket và dự án Supabase trong Cài đặt.`);
    if (res.status === 401 || res.status === 403 || /row-level|policy|unauthorized/i.test(detail)) throw new Error('Supabase từ chối tải lên: cần policy cho phép insert vào bucket audio.');
    throw new Error(`Tải audio lên Supabase thất bại (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return { storagePath, publicUrl: publicAudioUrl(storagePath) };
};
