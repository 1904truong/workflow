# Flow Bridge Workspace 🌉

Bộ công cụ tích hợp giúp giáo viên **soạn đề tiếng Anh** và **tự động tạo ảnh/video AI** trên Google Flow — tất cả hoạt động liền mạch qua cầu nối giữa web app và Chrome extension.

```
workflow/
├── flow-bridge-studio/        # Web app soạn đề + AI Image Studio
│   ├── frontend/              #   React + TypeScript (Vite)
│   └── tts-server/            #   Python server tạo audio (edge-tts)
└── toby-flow-extension/       # Chrome Extension tự động hoá Google Flow
```

---

## 🧩 Các thành phần

### 1. Flow Bridge Studio — Web App (`flow-bridge-studio/frontend`)

Ứng dụng web React dành cho giáo viên soạn đề trắc nghiệm, điền từ và bài nghe tiếng Anh chuẩn in ấn.

**Tính năng chính:**

| Tính năng | Mô tả |
|---|---|
| 📁 **Lesson Folders** | Tổ chức đề theo thư mục (khối lớp, chủ đề, tiết học) |
| ✨ **Smart Paste** | Dán văn bản thô → AI tự tách thành các dạng bài chuẩn |
| ✏️ **Exercise Builder** | Soạn thủ công: Multiple Choice, Gap Fill, Matching, True/False, Cloze, Listening... |
| 🖼️ **AI Image Studio** | Tạo ảnh minh hoạ bằng AI, gắn trực tiếp vào đề |
| 🖨️ **Preview & Export** | Xem trước và xuất đề dưới dạng **PDF** / **DOCX** (A4, tuỳ chỉnh lề, font) |
| 🎧 **TTS (Text-to-Speech)** | Tạo file audio bài nghe qua server edge-tts cục bộ |
| 🖼️ **My Gallery** | Thư viện ảnh AI đã tạo, dùng lại cho nhiều đề |
| 📜 **Export History** | Lịch sử xuất đề, mở lại thư mục bất kỳ |

**Dạng bài hỗ trợ:**
- Grammar / Vocab Multiple Choice
- Gap Filling (điền vào chỗ trống)
- Cloze Test
- Matching (nối cột)
- Matching Pictures, Matching Vocabulary, Matching Headings
- Sentence Completion
- Table Sentences
- True / False / Not Given (TFNG)
- Reading MCQ
- Listening MCQ, True/False, Table, Matching

---

### 2. TTS Server — Audio Generator (`flow-bridge-studio/tts-server`)

Server Python cục bộ (http://127.0.0.1:8765) nhận văn bản và trả về file MP3 thông qua [edge-tts](https://github.com/rany2/edge-tts).

**API:**
```
GET  /health   → {"ok": true}
GET  /voices   → danh sách giọng gợi ý
POST /tts      → audio/mpeg
```

**Định dạng hội thoại:**
```
A: Good morning! How are you today?
B: I'm fine, thank you. And you?
A: Pretty good! Have you done your homework?
```

**Giọng hỗ trợ sẵn:** Jenny, Aria, Guy, Davis (US) · Sonia, Libby, Ryan, Thomas (UK) · Hoài My, Nam Minh (VN)

---

### 3. TobyFlow Chrome Extension (`toby-flow-extension`)

Tiện ích Chrome tự động hoá toàn bộ quy trình tạo ảnh/video hàng loạt trên **Google Flow** (`flow.google.com`).

**Tính năng chính:**
- **Side Panel** dark theme với bảng màu xanh neon (`#a3e635`)
- **Multi-Prompt**: dán danh sách prompt, tạo hàng loạt tự động
- **Bộ lọc phong cách**: Anime, Realistic, Line Art, 3D Render, Cyberpunk...
- **Thông số tuỳ chỉnh**: tỉ lệ (9:16, 16:9, 1:1...), số lượng, model (Imagen 3, Veo 3.1, Gemini...)
- **Reference Image**: kéo thả ảnh tham chiếu trực tiếp
- **Auto Download**: tự lưu ảnh (1K/2K/4K) vào thư mục `tobyflow-01/`
- **Floating Task Monitor**: widget nổi theo dõi tiến trình realtime, hiển thị thumbnail từng ảnh

**Kết nối với Studio:** Extension giao tiếp với Flow Bridge Studio qua `postMessage` để cập nhật trạng thái (`GET_FLOW_STATUS`, `EXTENSION_DETECTED`), giúp AI Image Studio biết Google Flow đang mở tab nào.

---

## 🚀 Cài đặt & Chạy

### Yêu cầu hệ thống
- **Node.js** ≥ 22.12.0 (khuyến nghị) · hiện tại: 22.11.0 (chạy được với cảnh báo nhỏ)
- **Python** ≥ 3.9 (chỉ cần nếu dùng TTS)
- **Google Chrome** (để cài extension)

---

### A. Chạy Web App (Flow Bridge Studio)

```bash
# 1. Cài dependencies
cd flow-bridge-studio/frontend
npm install

# 2. Chạy dev server
npm run dev
# → http://localhost:5173
```

Hoặc từ thư mục gốc workspace:
```bash
npm run dev
```

**Build production:**
```bash
npm run build
```

---

### B. Chạy TTS Server (tuỳ chọn — chỉ cần khi tạo audio)

**Windows:**
```bat
# Cài lần đầu
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt

# Chạy
start-tts.bat
```

**macOS / Linux:**
```bash
cd flow-bridge-studio/tts-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
# → http://127.0.0.1:8765
```

> **Lưu ý:** edge-tts dùng dịch vụ đọc không chính thức của Microsoft Edge, có thể bị thay đổi/chặn mà không báo trước.

---

### C. Cài Chrome Extension (TobyFlow)

1. Mở Chrome → truy cập `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Nhấn **"Load unpacked"**
4. Chọn thư mục `toby-flow-extension/`
5. Icon **Flow Bridge** xuất hiện trên thanh công cụ Chrome ✅

**Sử dụng:**
1. Mở tab `https://flow.google.com/project/...`
2. Bấm icon extension → Side Panel mở ra
3. Đèn trạng thái sáng xanh (Live) = đã kết nối
4. Nhập prompt → chọn phong cách / model → nhấn **✨ Tạo**

---

## 🏗️ Kiến trúc kỹ thuật

```
┌─────────────────────────────────────┐
│        Flow Bridge Studio           │
│     React + TypeScript (Vite)       │
│                                     │
│  ┌──────────┐   ┌────────────────┐  │
│  │  Sidebar  │   │  Screen Views  │  │
│  │  Nav      │   │  (8 screens)   │  │
│  └──────────┘   └────────────────┘  │
│                                     │
│  localStorage (folders, exercises)  │
└──────────────┬──────────────────────┘
               │ postMessage
               │ (window.postMessage)
               ▼
┌─────────────────────────────────────┐
│      TobyFlow Chrome Extension      │
│  background.js · content.js         │
│  sidepanel.js · web-bridge.js       │
└──────────────┬──────────────────────┘
               │ CDP / scripting API
               ▼
        flow.google.com
```

**Stack:**
- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS 4
- **Export:** DOCX (docx.js), Print-to-PDF
- **Storage:** localStorage (IndexedDB-ready)
- **AI Images:** Google Flow (qua extension) + AI Image Job Queue
- **Audio:** edge-tts (Python), served tại `127.0.0.1:8765`
- **Extension:** Manifest V3, Service Worker, Chrome Side Panel API

---

## 📁 Cấu trúc thư mục chi tiết

```
workflow/
├── package.json                        # Root workspace scripts
│
├── flow-bridge-studio/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx                 # Root app + screen routing
│   │   │   └── features/
│   │   │       └── worksheet-builder/
│   │   │           ├── components/     # 29 component groups
│   │   │           ├── services/       # Storage, Smart Paste, AI Jobs, DOCX export
│   │   │           ├── types/          # TypeScript types
│   │   │           ├── templates/      # Print templates
│   │   │           └── tokens/         # Design tokens
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── tts-server/
│       ├── server.py                   # HTTP server (edge-tts)
│       ├── requirements.txt
│       └── start-tts.bat
│
└── toby-flow-extension/
    ├── manifest.json                   # Chrome Extension Manifest V3
    ├── background.js                   # Service worker
    ├── content.js                      # Injected vào flow.google.com
    ├── sidepanel.html / .js / .css     # Giao diện Side Panel
    ├── web-bridge.js                   # Cầu nối web ↔ extension
    ├── flow-config.js                  # Cấu hình tự động hoá
    ├── style-presets.js                # Preset phong cách ảnh
    └── cloud-sync.js                   # Đồng bộ Supabase
```

---

## 🛠️ Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy web app dev server (http://localhost:5173) |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview bản build |
| `npm run lint` | Lint với Oxlint |

---

## 📝 Ghi chú phát triển

- **Autosave:** Dữ liệu đề được tự động lưu vào `localStorage` sau 600ms mỗi lần thay đổi.
- **Screen persistence:** F5 vẫn quay lại đúng màn hình đang mở (lưu trong `localStorage`).
- **AI Image Queue:** Job tạo ảnh được xếp hàng và chạy ngầm; tải lại trang vẫn tiếp tục job dở.
- **Extension bridge:** Web app ping extension mỗi 4 giây để cập nhật trạng thái Google Flow.
- **Node version:** Vite 8 yêu cầu Node ≥ 22.12.0 hoặc ≥ 20.19.0. Node 22.11.0 vẫn chạy được nhưng có cảnh báo.
