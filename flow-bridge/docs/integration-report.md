# BÁO CÁO KHẢO SÁT VÀ ĐÁNH GIÁ MÃ NGUỒN THAM KHẢO (PHASE 1 AUDIT REPORT)

**Dự án tham khảo:** [Google-Flow-Automation-Extension](https://github.com/kumarsumit2000/Google-Flow-Automation-Extension)  
**Tác giả:** Sumit Kumar (`kumarsumit2000`)  
**Giấy phép:** MIT License  
**Thời điểm khảo sát:** Tháng 10/2026  

---

## 1. TỔNG QUAN KIẾN TRÚC MÃ NGUỒN THAM KHẢO

Repository tham khảo là một Chrome Extension (Manifest V3) được thiết kế để tự động hóa hàng loạt prompt vào Google Flow (`https://labs.google/fx/tools/flow*`), thực hiện tuần tự và tự động tải ảnh kết quả về máy.

### Cấu trúc tệp tham khảo:
- `manifest.json`: Khai báo quyền, background worker, sidepanel, content script.
- `background.js`: Service worker điều phối hàng đợi (run loop), quản lý Chrome Debugger Protocol (CDP), tải tệp và đổi tên tệp tải về.
- `flow-adapter.js`: Content script tiêm trực tiếp vào tab Google Flow, chứa toàn bộ selector DOM để tìm ô nhập prompt, nút settings, nút submit, trạng thái đang tạo ảnh và menu tải ảnh.
- `sidepanel.{html,css,js}`: Giao diện bảng điều khiển bên hông (Side Panel) để người dùng dán danh sách prompt và bấm "Start".

---

## 2. PHÂN TÍCH CHI TIẾT CÁC CƠ CHẾ CỐT LÕI

### 2.1. Nhận diện tab Google Flow
- **Cách thức:** `chrome.tabs.query({ url: "https://labs.google/fx/tools/flow*" })`.
- **Nhận diện Project:** Kiểm tra URL thông qua regex `/\/project\//.test(location.href)`.
- **Đánh giá:** Phương pháp chuẩn và tối giản của Chrome Tabs API. Cần xử lý thêm trường hợp người dùng mở tab nhưng chưa đăng nhập hoặc đang ở trang chủ `tools/flow` mà chưa bấm vào một Project cụ thể.

### 2.2. Tìm kiếm phần tử DOM (Flow Adapter)
- **Ô nhập Prompt:** Tìm thẻ có `contenteditable="true"` hoặc `[role="textbox"]`, lọc theo thuộc tính placeholder hoặc text chứa chuỗi `"what do you want to create"`. Dự phòng (fallback) tìm `textarea` hoặc `input[type=text]`, hoặc phần tử contenteditable nằm thấp nhất trên trang.
- **Nút Cài đặt (Agent Settings):** Tìm button chứa icon ligature Material Symbols `"tune"`.
- **Nút Submit:** Tìm button có icon Material Symbols `"arrow_forward"`.
- **Nút Menu & Download:** Rà soát các thẻ `<img>` kết quả (src chứa `getMediaUrlRedirect` hoặc `labs.google/fx/api`), tìm nút ⋮ (`more_vert`), bấm mở menu và tìm mục có text `"Download"`.

### 2.3. Cơ chế nhập Prompt & Chrome Debugger Protocol (CDP)
- **Vấn đề phát hiện:** Bộ soạn thảo Composer của Google Flow là một contenteditable phức tạp (Lexical/Slate hoặc custom React editor). Trình duyệt bỏ qua các sự kiện bàn phím giả lập không tin cậy (untrusted synthetic events như `dispatchEvent(new KeyboardEvent(...))` hoặc `document.execCommand`).
- **Giải pháp của mã nguồn tham khảo:** Sử dụng quyền `"debugger"` (`chrome.debugger`) để gửi lệnh CDP:
  - `Input.dispatchMouseEvent` để click chuột tin cậy vào tọa độ (x, y) của ô nhập.
  - `Input.insertText` để gõ ký tự thật (trusted keystrokes) vào ô prompt.
  - `Input.dispatchKeyEvent` cho phím Enter.
- **Rủi ro & Đánh giá bảo mật:**
  - Chrome sẽ hiển thị thanh cảnh báo màu vàng phía trên màn hình: *"Flow Batch Automation is debugging this browser"*.
  - Chỉ duy nhất 1 phiên Debugger có thể gắn vào 1 tab tại một thời điểm: nếu người dùng đang mở Chrome DevTools (F12) trên tab Flow, lệnh `dbgAttach` sẽ thất bại hoàn toàn.
  - Quyền `debugger` là quyền nhạy cảm cao, cần thông báo minh bạch cho người dùng và chỉ kích hoạt khi thực sự cần thiết, đồng thời cung cấp giải pháp dự phòng cho người dùng nhập thủ công.

### 2.4. Phát hiện hoàn tất tạo ảnh (Generation Completion)
- Trạng thái bận (busy): Flow hiển thị badge phần trăm tiến độ (`^\d{1,3}%$`), thanh tiến trình `[role="progressbar"]`, hoặc nút đổi thành `"stop"`.
- Hoàn tất: Khi tổng số lượng ảnh kết quả (`genImgs()`) và video (`genVideos()`) tăng lên so với trước khi submit VÀ cờ bận không còn nữa.
- Tên ảnh: Trích xuất từ caption text Flow gán cho ảnh (leaf element gần thẻ `img`).

### 2.5. Tải ảnh kết quả
- **Chiến lược 1:** Gọi trực tiếp `chrome.downloads.download` với URL ảnh (`img.src`). Bắt sự kiện `chrome.downloads.onDeterminingFilename` để đặt tên theo cấu trúc thư mục quy định.
- **Chiến lược 2 (Fallback):** Dùng CDP hover vào thẻ ảnh -> click icon ⋮ -> click chữ "Download".

---

## 3. BẢNG ĐÁNH GIÁ TÍNH NĂNG & QUYẾT ĐỊNH TÁI SỬ DỤNG (FEATURE EVALUATION MATRIX)

| Tính năng | Tệp nguồn | Hành vi hiện tại | Đã kiểm chứng? | Quyết định tái sử dụng / Cải tiến trong Flow Bridge |
|---|---|---|---|---|
| **Tab Detection** | `background.js` | Dùng `chrome.tabs.query` với match pattern `https://labs.google/fx/tools/flow*` | Có thể kiểm chứng qua Tab API | **Tái sử dụng & Mở rộng**: Bổ sung kiểm tra tab state (`loading`, `complete`), trạng thái Project (`/project/`) và báo cáo mã trạng thái chuẩn hóa (`FLOW_TAB_NOT_FOUND`, `PROJECT_NOT_OPEN`). |
| **Adapter Injection** | `background.js` | Tự động inject qua `chrome.scripting.executeScript` khi tab đã mở trước khi cài extension | Chuẩn Manifest V3 | **Tái sử dụng**: Giữ cơ chế self-inject để người dùng không bắt buộc phải F5 lại tab Flow sau khi cài. |
| **Prompt Box Detection** | `flow-adapter.js` | Tìm theo placeholder text `"what do you want to create"` hoặc phần tử contenteditable thấp nhất | Nhận dạng DOM tốt trên Flow UI tháng 6/2026 | **Cải tiến**: Đóng gói thành `FlowAdapter.findPromptInput()`. Bổ sung fallback kiểm tra aria-label đa ngôn ngữ (tiếng Việt, tiếng Anh) và kiểm tra tọa độ hiển thị. Không phụ thuộc cứng vào duy nhất 1 chuỗi tiếng Anh. |
| **Trusted Typing (CDP)** | `background.js` | Dùng `chrome.debugger` (`Input.insertText`) | Hoạt động được trên các editor chặn synthetic event | **Cải tiến kiến trúc**: Tách riêng module `DebuggerManager`. Gắn cờ xin phép rõ ràng, phát hiện nếu tab đang mở DevTools để báo lỗi hướng dẫn người dùng tắt F12. Không kích hoạt debugger trong pha khởi tạo và kiểm tra kết nối ban đầu (Phase 2 MVP). |
| **Auto-Generate Enforce** | `flow-adapter.js` | Tự động click Tune -> radio "Confirm before generating: Never" | Dễ vỡ nếu giao diện Google thay đổi | **LOẠI BỎ / CẢI TIẾN AN TOÀN**: Tuân thủ tuyệt đối quy tắc của dự án mới: Không tự ý thay đổi cấu hình tài khoản của người dùng ngoài ý muốn. Yêu cầu người dùng tự chọn chế độ hoặc hiển thị hướng dẫn trực quan. |
| **Submit Detection** | `flow-adapter.js` | Tìm button chứa text ligature `"arrow_forward"` | Dễ vỡ nếu Google Flow dùng inline SVG thay vì Material ligature text | **Cải tiến**: Hỗ trợ đa selector: tìm theo text ligature, aria-label (`Create`, `Generate`, `Submit`, `Send`), SVG icon path, hoặc vị trí góc phải bên trong prompt bar. |
| **Image Result Detection** | `flow-adapter.js` | Lọc `img` có src chứa `getMediaUrlRedirect` hoặc `labs.google/fx/api` | Logic hợp lý để loại trừ avatar Google | **Tái sử dụng**: Đóng gói vào adapter, bổ sung kiểm tra kích thước tối thiểu để không nhầm thumbnail giao diện. |
| **Download Interception** | `background.js` | Dùng `onDeterminingFilename` để ép đường dẫn thư mục | Đạt hiệu quả cao trên Chrome | **Tái sử dụng có kiểm soát**: Dùng cho chức năng export khi người dùng chủ động tải ảnh từ Flow Bridge Web. |
| **Communication Bridge** | `background.js` / `sidepanel.js` | Giao tiếp nội bộ Extension qua `chrome.runtime.sendMessage` | Hoạt động tốt nội bộ | **MỞ RỘNG TOÀN DIỆN**: Xây dựng Web-to-Extension Bridge qua `window.postMessage` / `chrome.runtime.sendMessage` có kiểm tra chặt chẽ `origin`, requestId, timeout, schema typing TypeScript, chống giả mạo thông điệp. |

---

## 4. CÁC RỦI RO PHỤ THUỘC & GIẢ ĐỊNH DỄ VỠ (BRITTLE SELECTORS & RISKS)

1. **Rủi ro bộ gõ & Ngôn ngữ giao diện (i18n):**
   - Mã nguồn tham khảo phụ thuộc vào văn bản tiếng Anh: `"What do you want to create?"`, `"Agent settings"`, `"Download"`, `"always"`, `"never"`.
   - Nếu tài khoản Google của người dùng đặt giao diện tiếng Việt ("Bạn muốn tạo gì?"), toàn bộ logic text-matching sẽ thất bại nếu không có selector cấu trúc hoặc danh sách từ khóa đa ngữ.
2. **Rủi ro xung đột Debugger:**
   - Chrome chỉ cho phép 1 debugger gắn vào 1 tab. Nếu developer bật F12 để kiểm tra, extension sẽ báo lỗi và dừng toàn bộ tiến trình. Cần cơ chế phát hiện và hướng dẫn khắc phục cụ thể.
3. **Rủi ro tài khoản & Credits:**
   - Mã nguồn tham khảo ép buộc tắt xác nhận trước khi generate (`Confirm: Never`). Trong Flow Bridge, ta phải tôn trọng credits của người dùng, không bao giờ tự ý spam hay chạy lệnh generate ngoài ý muốn.

---

## 5. KẾT LUẬN & ĐỊNH HƯỚNG PHASE 2

- Mã nguồn tham khảo cung cấp hiểu biết quý giá về cách Google Flow xử lý DOM và việc Flow chặn synthetic keystrokes.
- Ở **Phase 2 (Extension Connection MVP)**, chúng ta sẽ xây dựng kiến trúc mới sạch sẽ theo TypeScript, tập trung 100% vào:
  1. Phát hiện chính xác tab Google Flow và trang Project.
  2. Báo cáo trạng thái chuẩn hóa (`CONNECTED`, `NOT_CONNECTED`, `FLOW_TAB_NOT_FOUND`, `PROJECT_NOT_OPEN`, `PROMPT_INPUT_NOT_FOUND`, `ERROR`).
  3. Kiểm tra và định vị phần tử prompt input mà **KHÔNG** kích hoạt generate hoặc can thiệp trái phép vào phiên Google của người dùng.
  4. Hỗ trợ Mock Flow page để test tự động mà không tiêu tốn tài nguyên.
