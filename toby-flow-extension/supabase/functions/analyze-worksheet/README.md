# analyze-worksheet (Supabase Edge Function)

Nhận văn bản bài tập → gọi **Gemini `gemini-2.5-flash`** → trả về kế hoạch ảnh (JSON đã kiểm tra).
Khóa Gemini chỉ nằm trong **secrets của server**; web và extension không bao giờ thấy khóa.

## Triển khai (làm một lần)

1. Lấy khóa miễn phí tại Google AI Studio (https://aistudio.google.com/apikey).
2. Cài Supabase CLI, đăng nhập và liên kết project:
   ```
   supabase login
   supabase link --project-ref <mã project, ví dụ onculshbgfosfcagrmte>
   ```
3. Đặt khóa vào secrets (không ghi vào file nào trong repo):
   ```
   supabase secrets set GEMINI_API_KEY=<khóa của bạn>
   ```
4. Triển khai (từ thư mục `toby-flow-extension`):
   ```
   supabase functions deploy analyze-worksheet
   ```
   `verify_jwt` mặc định bật: chỉ người đã đăng nhập Supabase (qua extension) mới gọi được.

## Luồng gọi

`Web Studio` → (postMessage) → `extension (web-bridge.js → background.js)` → `POST {SUPABASE_URL}/functions/v1/analyze-worksheet`
kèm token đăng nhập Supabase của extension → Gemini → kế hoạch ảnh → về web.

## Kiểm thử logic (không cần mạng, không cần khóa)

```
cd flow-bridge-studio/frontend
node --test src/features/worksheet-builder/services/ai/__tests__/ai.test.ts
```

## Lưu ý

- `schema.ts` là bản sao của `flow-bridge-studio/frontend/src/features/worksheet-builder/services/ai/imagePlanSchema.ts`.
  Có test kiểm tra hai file giống hệt nhau: sửa một nơi thì sao chép sang nơi kia.
- Giới hạn đầu vào 30.000 ký tự. Gói miễn phí của Gemini có thể trả 429; hàm tự thử lại 2 lần rồi báo `RATE_LIMITED`.
- Khi hàm lỗi hoặc chưa triển khai, web tự dùng parser có sẵn làm phương án dự phòng.
