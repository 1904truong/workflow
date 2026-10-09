# BẢN DỰ THẢO KẾ HOẠCH DỰ ÁN

## FLOW BRIDGE — AI IMAGE AUTOMATION SYSTEM

**Phiên bản:** Draft 1.0  
**Định hướng:** Phát triển ứng dụng chỉnh sửa ảnh bằng AI thông qua Prompt, tích hợp Chrome Extension với Google Flow.  
**Kiến trúc:** React + TypeScript + Chrome Extension (Manifest V3) + Supabase (giai đoạn mở rộng).

---

## I. MỤC TIÊU DỰ ÁN

### 1. Mục tiêu tổng quát

Xây dựng một ứng dụng cho phép người dùng tải ảnh, nhập yêu cầu chỉnh sửa bằng ngôn ngữ tự nhiên và nhận ảnh kết quả thông qua Google Flow.

Chrome Extension sẽ đóng vai trò cầu nối giữa website và giao diện Google Flow, nhằm giảm nhu cầu tích hợp API tạo ảnh trực tiếp.

### 2. Mục tiêu cụ thể

- Xây dựng website AI Image Studio có giao diện hiện đại, dễ sử dụng.
- Phát triển Chrome Extension hoạt động trên trình duyệt của từng người dùng.
- Cho phép nhập Prompt tiếng Việt hoặc tiếng Anh.
- Hỗ trợ truyền Prompt và ảnh đầu vào tới Google Flow khi cơ chế tích hợp cho phép.
- Theo dõi trạng thái tác vụ và hiển thị kết quả.
- Hỗ trợ tải ảnh đầu ra và xem lịch sử chỉnh sửa.
- Đảm bảo mỗi người dùng sử dụng phiên Google của chính mình.
- Không yêu cầu cấu hình ComfyUI, Node Workflow hoặc vẽ Mask thủ công.

## II. PHẠM VI VÀ NGUYÊN TẮC

Hệ thống không tự vận hành mô hình AI xử lý ảnh. Google Flow đảm nhiệm việc tạo/chỉnh sửa ảnh; ứng dụng đảm nhiệm giao diện và điều phối.

Các tính năng tương tác tự động với Flow chỉ triển khai sau khi kiểm tra tính khả thi, quyền sử dụng và điều khoản dịch vụ. Không sử dụng cookie, token riêng tư, API nội bộ không được hỗ trợ hoặc cơ chế vượt giới hạn credits.

MVP không cam kết quy trình tạo ảnh hoàn toàn tự động trước khi hoàn thành giai đoạn khảo sát.

## III. KIẾN TRÚC HỆ THỐNG

### 1. Frontend — AI Image Studio

**Công nghệ:** React, TypeScript, Tailwind CSS.

Chức năng:

- Upload ảnh PNG/JPG.
- Nhập và chỉnh sửa Prompt.
- Lựa chọn phong cách ảnh.
- Gửi yêu cầu sang Chrome Extension.
- Theo dõi trạng thái xử lý.
- Hiển thị ảnh trước và sau chỉnh sửa.
- Xem lịch sử các phiên bản.
- Tải ảnh kết quả về máy.

### 2. Chrome Extension — Flow Bridge

**Công nghệ:** JavaScript/TypeScript, Chrome Manifest V3.

Các module:

- Background Service Worker: điều phối tác vụ và quản lý tab.
- Content Script: nhận diện giao diện Google Flow và thực hiện các thao tác được hỗ trợ.
- Message Bridge: giao tiếp giữa website và extension.
- Storage Manager: quản lý cấu hình và trạng thái trên máy.
- Flow Adapter: tách riêng logic tương tác với Google Flow.
- Error Handler: phát hiện lỗi và yêu cầu người dùng xử lý.

Extension chỉ hoạt động trên các website đã khai báo và được người dùng cấp quyền.

### 3. Google Flow

Vai trò:

- Tiếp nhận ảnh và yêu cầu chỉnh sửa.
- Thực hiện xử lý AI.
- Cung cấp ảnh kết quả thông qua các chức năng của dịch vụ.

Các giới hạn cần khảo sát:

- Khả năng tự động điền Prompt.
- Cách tải ảnh nguồn.
- Cách xác nhận thao tác Generate.
- Cách nhận biết xử lý hoàn tất.
- Cách tải ảnh kết quả.
- Chính sách credits và quyền tự động hóa.

### 4. Lưu trữ dữ liệu

**MVP:** Chrome Storage, IndexedDB và tệp cục bộ.

**Giai đoạn mở rộng:** Supabase Database, Authentication và Storage.

Dữ liệu dự kiến:

- Người dùng.
- Ảnh nguồn.
- Prompt.
- Tác vụ chỉnh sửa.
- Ảnh kết quả.
- Lịch sử phiên bản.
- Nhật ký lỗi.

Không lưu mật khẩu hoặc phiên đăng nhập Google.

---

## IV. QUY TRÌNH HOẠT ĐỘNG

**Bước 1:** Người dùng truy cập AI Image Studio.

**Bước 2:** Hệ thống kiểm tra Chrome Extension đã được cài đặt và kết nối hay chưa.

**Bước 3:** Người dùng tải ảnh và nhập Prompt.

**Bước 4:** Website tạo một Job ID và chuyển yêu cầu tới Extension.

**Bước 5:** Extension kiểm tra tab Google Flow, trạng thái đăng nhập và tính sẵn sàng.

**Bước 6:** Extension hỗ trợ truyền dữ liệu vào giao diện Flow theo những phương thức hợp lệ đã được xác minh.

**Bước 7:** Người dùng xác nhận Generate trong bản MVP. Tự động hóa bước này chỉ được xem xét nếu dịch vụ cho phép.

**Bước 8:** Hệ thống theo dõi trạng thái hoặc yêu cầu người dùng xác nhận ảnh hoàn tất.

**Bước 9:** Người dùng xuất ảnh từ Flow. Nếu cơ chế xuất ảnh hỗ trợ tích hợp, Extension tiếp nhận kết quả và trả về website.

**Bước 10:** Website lưu kết quả, hiển thị ảnh và cho phép chỉnh sửa tiếp.

---

## V. KẾ HOẠCH TRIỂN KHAI

### PHASE 1 — Khảo sát và chứng minh tính khả thi

**Thời gian dự kiến:** 2–3 ngày

Công việc:

- Khảo sát cấu trúc giao diện Google Flow.
- Xác định trường Prompt và cơ chế upload.
- Kiểm tra chức năng Generate và tải ảnh.
- Kiểm tra điều khoản sử dụng liên quan đến automation.
- Xác nhận chức năng nào có thể tích hợp.
- Xác định các giới hạn credits.

**Kết quả:** Báo cáo khả thi và danh sách thao tác được phép triển khai.

### PHASE 2 — Phát triển Chrome Extension MVP

**Thời gian dự kiến:** 3–5 ngày

Công việc:

- Khởi tạo dự án Manifest V3.
- Xây dựng Background Service Worker.
- Xây dựng Content Script.
- Thiết lập quyền truy cập tối thiểu.
- Phát triển Message Bridge.
- Tạo giao diện Extension kiểm thử.
- Kết nối tab Google Flow.
- Thử điền Prompt vào trường được xác định.
- Lưu lịch sử tác vụ cục bộ.
- Xử lý trường hợp tab bị đóng hoặc đăng xuất.

**Kết quả:** Chrome Extension cài đặt và chạy được trên Chrome, hỗ trợ kết nối Flow và nhập Prompt.

### PHASE 3 — Xây dựng website AI Image Studio

**Thời gian dự kiến:** 4–6 ngày

Công việc:

- Thiết kế giao diện React.
- Xây dựng khu vực Upload Image.
- Xây dựng Prompt Editor.
- Tạo danh sách Style Presets.
- Thiết kế vùng hiển thị ảnh kết quả.
- Tạo thanh Before/After Slider.
- Xây dựng Gallery và History.
- Hiển thị trạng thái kết nối Extension.
- Kết nối Website với Extension qua cơ chế messaging có kiểm soát nguồn gửi.

**Kết quả:** Website hoạt động với Extension trên trình duyệt.

### PHASE 4 — Tích hợp xử lý ảnh và kết quả

**Thời gian dự kiến:** 3–5 ngày, phụ thuộc kết quả Phase 1.

Công việc:

- Tích hợp upload ảnh theo phương thức được hỗ trợ.
- Đồng bộ Prompt và lựa chọn chỉnh sửa.
- Xây dựng trạng thái tác vụ.
- Theo dõi quá trình Generate khi có tín hiệu đáng tin cậy.
- Xử lý tải ảnh kết quả.
- Hiển thị ảnh trước và sau.
- Tạo chức năng tiếp tục chỉnh sửa từ ảnh kết quả.
- Phát hiện lỗi hết credits, timeout hoặc mất kết nối.

**Kết quả:** Luồng chỉnh sửa ảnh hoạt động ở mức tự động hóa được Google Flow cho phép.

### PHASE 5 — Tích hợp Supabase

**Thời gian dự kiến:** 3–4 ngày

Công việc:

- Thiết kế bảng Users, Jobs, Assets, Job Events.
- Tích hợp Supabase Authentication.
- Xây dựng Storage Bucket.
- Thiết lập Row Level Security.
- Đồng bộ lịch sử chỉnh sửa.
- Quản lý trạng thái công việc.
- Kiểm tra phân quyền và giới hạn dung lượng.
- Không chuyển phiên đăng nhập Google lên máy chủ.

**Kết quả:** Dữ liệu người dùng được đồng bộ và quản lý bảo mật.

### PHASE 6 — Kiểm thử và hoàn thiện

**Thời gian dự kiến:** 3–5 ngày

Công việc:

- Kiểm thử chức năng Website.
- Kiểm thử giao tiếp Extension.
- Kiểm thử lỗi mạng và mất phiên Google.
- Kiểm thử các thay đổi trên giao diện Flow.
- Kiểm thử nhiều tác vụ liên tiếp.
- Kiểm thử chống tạo trùng, tiêu tốn credits ngoài ý muốn.
- Kiểm thử quyền truy cập và rò rỉ dữ liệu.
- Viết hướng dẫn cài đặt và sử dụng.

**Kết quả:** Bản MVP sẵn sàng để thử nghiệm nội bộ.

---

## VI. QUẢN LÝ TRẠNG THÁI CÔNG VIỆC

Mỗi công việc có ID riêng và trạng thái:

- `pending`: Chờ xử lý.
- `preparing`: Đang chuẩn bị dữ liệu.
- `ready`: Sẵn sàng thao tác trên Flow.
- `needs_confirmation`: Đang chờ người dùng xác nhận.
- `generating`: Đang tạo ảnh.
- `downloading`: Đang lấy kết quả.
- `completed`: Hoàn tất.
- `failed`: Thất bại.
- `cancelled`: Đã hủy.

Không tự động gửi lại lệnh Generate nếu chưa xác định trạng thái thực tế của tác vụ trước đó.

## VII. TIÊU CHÍ NGHIỆM THU MVP

1. Extension cài đặt thành công qua Chrome Developer Mode.
2. Website nhận biết được Extension.
3. Người dùng nhập và lưu được Prompt.
4. Website gửi được tác vụ cho Extension.
5. Extension nhận biết được tab Google Flow.
6. Prompt được điền đúng ở giao diện đã kiểm thử.
7. Không có hành vi gửi yêu cầu Generate ngoài ý muốn.
8. Có thông báo lỗi khi Extension mất kết nối.
9. Có thể lưu và xem lịch sử Prompt.
10. Không thu thập thông tin đăng nhập Google.

Những tính năng upload tự động, Generate tự động và tải ảnh tự động là tiêu chí nghiệm thu mở rộng, chỉ áp dụng sau khi xác nhận có phương thức tích hợp được hỗ trợ.

## VIII. TIẾN ĐỘ VÀ KẾT QUẢ MONG ĐỢI

**Tổng thời gian dự kiến:** 18–28 ngày công, chưa bao gồm việc xử lý các hạn chế từ nền tảng bên thứ ba.

Sản phẩm dự kiến:

- Một Chrome Extension Flow Bridge.
- Một Website AI Image Studio.
- Một hệ thống quản lý tác vụ và lịch sử chỉnh sửa.
- Một bộ kiểm thử chức năng.
- Tài liệu cài đặt, bảo mật và vận hành.

## IX. HƯỚNG PHÁT TRIỂN

Sau khi MVP chứng minh được tính khả thi, hệ thống có thể tiếp tục mở rộng:

- Nhiều phong cách chỉnh sửa ảnh.
- Tạo nhiều phiên bản từ một ảnh nguồn.
- Quản lý thư viện Prompt.
- Chức năng so sánh ảnh trước và sau.
- Xử lý tác vụ theo hàng đợi.
- Tích hợp AI Agent để gợi ý Prompt.
- Hỗ trợ các nhà cung cấp AI khác có API hoặc cơ chế tích hợp chính thức.
- Phát triển thành sản phẩm phục vụ nhiều người dùng.

**Nguyên tắc triển khai:** Ưu tiên hệ thống ổn định, an toàn và có thể bảo trì; không đánh đổi tính bền vững để có một luồng automation ngắn hạn.
