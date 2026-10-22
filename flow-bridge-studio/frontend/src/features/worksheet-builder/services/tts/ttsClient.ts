// Gọi dịch vụ đọc văn bản chạy trên máy (flow-bridge-studio/tts-server, dùng edge-tts).

const BASE = 'http://127.0.0.1:8765';

export interface TtsVoice { id: string; label: string; lang: string }

/** Danh sách dự phòng khi chưa gọi được dịch vụ */
export const FALLBACK_VOICES: TtsVoice[] = [
  { id: 'en-US-JennyNeural', label: 'Jenny (US, nữ)', lang: 'en-US' },
  { id: 'en-US-GuyNeural', label: 'Guy (US, nam)', lang: 'en-US' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (UK, nữ)', lang: 'en-GB' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK, nam)', lang: 'en-GB' },
  { id: 'vi-VN-HoaiMyNeural', label: 'Hoài My (VN, nữ)', lang: 'vi-VN' },
  { id: 'vi-VN-NamMinhNeural', label: 'Nam Minh (VN, nam)', lang: 'vi-VN' },
];

export const TTS_OFFLINE_HINT = 'Chưa kết nối được dịch vụ tạo audio. Hãy chạy file flow-bridge-studio/tts-server/start-tts.bat rồi thử lại.';

export const listVoices = async (): Promise<TtsVoice[]> => {
  try {
    const res = await fetch(`${BASE}/voices`);
    if (!res.ok) return FALLBACK_VOICES;
    const data = await res.json();
    return Array.isArray(data.voices) && data.voices.length ? data.voices : FALLBACK_VOICES;
  } catch {
    return FALLBACK_VOICES;
  }
};

/** Đọc văn bản; mỗi dòng "A: ..." / "B: ..." dùng giọng của người đó. Ném Error có thông báo tiếng Việt. */
export const generateSpeech = async (opts: { text: string; voices: Record<string, string>; rate: string }): Promise<Blob> => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
  } catch {
    throw new Error(TTS_OFFLINE_HINT);
  }
  if (!res.ok) {
    let msg = `Tạo audio thất bại (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* giữ nguyên */ }
    throw new Error(msg);
  }
  return res.blob();
};
