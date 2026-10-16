-- Flow Bridge: bỏ thư mục <user_id> ngoài cùng, lưu theo <Nền tảng>/<ngày>/<ảnh>.
-- Chạy trong Supabase Dashboard > SQL Editor SAU 001_flow_images.sql. Idempotent: chạy lại an toàn.
-- Quyền sở hữu không còn dựa vào tên thư mục mà dựa vào chủ sở hữu file (owner_id do Supabase Storage tự gán khi upload).
-- Ảnh cũ nằm trong thư mục <user_id>/... vẫn đọc/xóa được (giữ điều kiện theo thư mục).

-- Storage: mỗi user chỉ đọc/xóa file của chính mình; upload vào bất kỳ đường dẫn nào trong bucket flow-images
drop policy if exists "flow_images_select_own" on storage.objects;
drop policy if exists "flow_images_insert_own" on storage.objects;
drop policy if exists "flow_images_delete_own" on storage.objects;

create policy "flow_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'flow-images' and (
    owner_id = auth.uid()::text or owner = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text
  ));
create policy "flow_images_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'flow-images');
create policy "flow_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'flow-images' and (
    owner_id = auth.uid()::text or owner = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text
  ));
-- Vẫn không có policy UPDATE => không ai ghi đè được ảnh đã upload.

-- Bảng metadata: bỏ điều kiện đường dẫn phải bắt đầu bằng <user_id>/
drop policy if exists "images_insert_own" on public.generated_images;
create policy "images_insert_own" on public.generated_images for insert
  with check (user_id = auth.uid());
