# TobyFlow - Auto Flow & Auto Creative ⚡🤖

Tiện ích mở rộng Chrome chuyên nghiệp tự động hóa toàn bộ quy trình tạo ảnh, video và quản lý tác vụ hàng loạt trên **Google Flow** (`flow.google.com/project/...`).

---

## 🌟 Tính năng nổi bật (Giống 100% giao diện TobyFlow)

### 1. Chrome Side Panel độc lập:
- **Giao diện Dark Theme cao cấp**: Thiết kế chuẩn màu xanh chuối neon `#a3e635` và nền đen sang trọng.
- **Quản lý Multi-Prompt**: Hỗ trợ chuyển đổi giữa Prompt đơn và Multi-Prompt (mỗi dòng một câu nhắc để tạo hàng loạt).
- **Bộ lọc phong cách & nhân vật**: Tự động chèn từ khóa thẩm mỹ (Anime, Realistic, Line Art, 3D Render, Cyberpunk...) và duy trì tính nhất quán của nhân vật.
- **Tùy chỉnh thông số**: Tỉ lệ khung hình (9:16, 16:9, 1:1, 4:3, 3:4), số lượng ảnh tạo đồng thời (- 1 +), Model (Nano Banana 2.1, Veo 3.1, Imagen 3, Gemini).
- **Đính kèm ảnh mẫu (Reference Image)**: Kéo thả tải ảnh tham chiếu trực tiếp từ Side Panel.
- **Tự động tải xuống (Auto Download)**: Lưu ảnh tự động về thư mục máy tính (`tobyflow-01/...`) với độ phân giải tùy chọn (1K, 2K, 4K).

### 2. Floating Task Monitor Widget (Thanh theo dõi nổi trên trang Google Flow):
- Tự động gắn thẻ theo dõi nổi ở góc dưới bên trái của tab Google Flow.
- Hiển thị tiến trình trực tiếp: Thời gian chạy `Auto Gen 00:00:26`, phần trăm thanh tiến trình xanh neon, số lượng tác vụ hoàn thành.
- Danh sách thẻ công việc kèm **ảnh thumbnail thu nhỏ** của ảnh vừa sinh ra từ AI.
- Nút bấm tải xuống nhanh từng ảnh hoặc mở rộng/thu nhỏ cửa sổ nổi.

---

## 🚀 Hướng dẫn cài đặt vào Google Chrome

1. Mở trình duyệt Google Chrome, truy cập: `chrome://extensions/`
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Nhấp vào nút **Tải tiện ích đã giải nén (Load unpacked)**.
4. Chọn thư mục:
   ```
   C:\Users\Truong\WorkFlow\toby-flow-extension
   ```
5. Tiện ích **TobyFlow** sẽ xuất hiện trên thanh công cụ của Chrome.

---

## 🎯 Hướng dẫn sử dụng

1. Mở tab **Google Flow**: Truy cập vào một dự án cụ thể tại `https://flow.google.com/project/...`.
2. Bấm vào biểu tượng **TobyFlow** trên thanh công cụ Chrome: Cửa sổ Side Panel sẽ mở ra ngay bên cạnh màn hình.
3. Đèn trạng thái trên Side Panel sẽ sáng xanh (Live), hiển thị tên dự án Google Flow đang mở.
4. Nhập prompt (hoặc bật Multi-Prompt để dán danh sách nhiều prompt).
5. Chọn phong cách, model và bấm nút **✨ Tạo**:
   - Extension sẽ tự động điền prompt vào ô chat của Google Flow.
   - Tự động bấm nút Tạo (mũi tên).
   - Thanh Floating Widget trên trang Flow sẽ đếm thời gian và cập nhật ảnh thumbnail ngay khi hoàn thành!
