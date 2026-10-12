-- Flow Bridge: lưu ảnh tạo từ Google Flow lên Supabase (cloud-only)
-- Chạy trong Supabase Dashboard > SQL Editor. Idempotent: có thể chạy lại an toàn.

create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────
create table if not exists public.generation_jobs (
  id              uuid primary key,                       -- client sinh (crypto.randomUUID) để retry idempotent
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prompt          text not null,
  model           text,
  aspect_ratio    text,
  expected_count  int  not null default 1 check (expected_count between 1 and 4),
  saved_count     int  not null default 0,
  status          text not null default 'running' check (status in ('running','completed','partial','failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.generated_images (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.generation_jobs(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path  text not null,
  sha256        text not null,                            -- chống upload trùng
  mime_type     text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
  width         int,
  height        int,
  size_bytes    bigint not null check (size_bytes > 0),
  prompt        text not null,                            -- denormalize để tìm kiếm không cần join
  model         text,
  aspect_ratio  text,
  image_index   int not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, sha256),
  unique (storage_path)
);

create index if not exists generated_images_user_created_idx on public.generated_images (user_id, created_at desc);
create index if not exists generated_images_job_idx on public.generated_images (job_id);

-- ───────────── Row Level Security ─────────────
alter table public.generation_jobs  enable row level security;
alter table public.generated_images enable row level security;

drop policy if exists "jobs_select_own"  on public.generation_jobs;
drop policy if exists "jobs_insert_own"  on public.generation_jobs;
drop policy if exists "jobs_update_own"  on public.generation_jobs;
drop policy if exists "jobs_delete_own"  on public.generation_jobs;
create policy "jobs_select_own" on public.generation_jobs for select using (user_id = auth.uid());
create policy "jobs_insert_own" on public.generation_jobs for insert with check (user_id = auth.uid());
create policy "jobs_update_own" on public.generation_jobs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "jobs_delete_own" on public.generation_jobs for delete using (user_id = auth.uid());

drop policy if exists "images_select_own" on public.generated_images;
drop policy if exists "images_insert_own" on public.generated_images;
drop policy if exists "images_delete_own" on public.generated_images;
create policy "images_select_own" on public.generated_images for select using (user_id = auth.uid());
create policy "images_insert_own" on public.generated_images for insert
  with check (user_id = auth.uid() and storage_path like auth.uid()::text || '/%');
create policy "images_delete_own" on public.generated_images for delete using (user_id = auth.uid());

-- ───────────── Storage bucket (private) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flow-images', 'flow-images', false, 26214400, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Mỗi user chỉ thao tác trong thư mục <user_id>/...
drop policy if exists "flow_images_select_own" on storage.objects;
drop policy if exists "flow_images_insert_own" on storage.objects;
drop policy if exists "flow_images_delete_own" on storage.objects;
create policy "flow_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'flow-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "flow_images_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'flow-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "flow_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'flow-images' and (storage.foldername(name))[1] = auth.uid()::text);
-- Không có policy UPDATE => không ai ghi đè được ảnh đã upload.
