export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';

/** Nội dung header/footer của phiếu bài tập. Ảnh lưu dạng data URL (đã thu nhỏ). */
export interface WorksheetBranding {
  enabled: boolean;
  /** 'first': header chỉ ở trang 1; 'all': mọi trang */
  headerPages: 'first' | 'all';
  /** 'alternate': trang lẻ = QR + website, trang chẵn = giáo viên; hoặc ép một kiểu */
  footerMode: 'alternate' | 'info' | 'teacher';

  docTitle: string;       // DAILY WORKSHEET
  level: string;          // 1
  worksheetNo: string;    // WS-Imp-1-1-1
  cefrActive: CefrLevel;  // B1
  showStickers: boolean;  // OK / GOOD / WOW
  showScoreBox: boolean;

  website: string;        // pintaenglish.edu.vn
  unitLabel: string;      // Unit 1
  lessonLabel: string;    // Lesson 1
  progress: string;       // nhập tay (khi tắt tự động)
  /** true: % = số trang hiện tại / tổng số trang của đề (đổi theo độ dài đề) */
  autoProgress: boolean;
  teacherName: string;    // MAI LINH
  teacherPhone: string;   // 086 8686 003

  logoUrl?: string;
  qrUrl?: string;
  avatarUrl?: string;
}

export const DEFAULT_BRANDING: WorksheetBranding = {
  enabled: true,
  headerPages: 'first',
  footerMode: 'alternate',
  docTitle: 'DAILY WORKSHEET',
  level: '1',
  worksheetNo: 'WS-Imp-1-1-1',
  cefrActive: 'B1',
  showStickers: true,
  showScoreBox: true,
  website: 'pintaenglish.edu.vn',
  unitLabel: 'Unit 1',
  lessonLabel: 'Lesson 1',
  progress: '1',
  autoProgress: true,
  teacherName: 'MAI LINH',
  teacherPhone: '086 8686 003',
};

const DEFAULT_KEY = 'flow_bridge_branding_default_v1';

export const loadDefaultBranding = (): Partial<WorksheetBranding> => {
  try {
    const raw = localStorage.getItem(DEFAULT_KEY);
    return raw ? (JSON.parse(raw) as Partial<WorksheetBranding>) : {};
  } catch { return {}; }
};

/** Trả false nếu trình duyệt từ chối lưu (ví dụ ảnh quá lớn) */
export const saveDefaultBranding = (b: WorksheetBranding): boolean => {
  try { localStorage.setItem(DEFAULT_KEY, JSON.stringify(b)); return true; } catch { return false; }
};

export const progressFor = (b: WorksheetBranding, pageNumber: number, totalPages: number): string => {
  if (!b.autoProgress) return b.progress;
  const pct = totalPages > 0 ? (pageNumber / totalPages) * 100 : 0;
  return String(Math.min(100, Math.max(0, Math.round(pct))));
};

/** Mặc định của app < mặc định người dùng đã lưu < riêng đề này */
export const resolveBranding = (own?: Partial<WorksheetBranding>): WorksheetBranding => ({
  ...DEFAULT_BRANDING,
  ...loadDefaultBranding(),
  ...(own || {}),
});

/** Thu nhỏ ảnh tải lên (logo/QR/avatar) để không làm đầy localStorage */
export const fileToSmallDataUrl = (file: File, maxSide = 400, mime: 'image/png' | 'image/jpeg' = 'image/png'): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không đọc được ảnh'));
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        const ctx = c.getContext('2d')!;
        if (mime === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); } // ảnh PNG trong suốt không bị nền đen
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(mime, 0.88));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
