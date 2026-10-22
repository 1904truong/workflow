-- Flow Bridge: đếm số lần gọi AI mỗi ngày cho mỗi người dùng (dùng cho nút "Viết lại bằng AI" của Smart Paste).
-- Chạy trong Supabase Dashboard > SQL Editor. Idempotent: chạy lại an toàn.
-- Ngày tính theo giờ Việt Nam (Asia/Ho_Chi_Minh). Hạn mức mặc định do Edge Function quyết định (secret AI_DAILY_LIMIT, mặc định 30).

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select to authenticated using (auth.uid() = user_id);

-- Tăng lượt dùng trong ngày một cách nguyên tử; không tăng khi đã chạm hạn mức.
create or replace function public.ai_usage_bump(p_user uuid, p_limit int)
returns table(used int, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_count int;
begin
  insert into public.ai_usage(user_id, day, count) values (p_user, v_day, 0) on conflict (user_id, day) do nothing;
  update public.ai_usage set count = count + 1
    where user_id = p_user and day = v_day and count < p_limit
    returning count into v_count;
  if v_count is null then
    select count into v_count from public.ai_usage where user_id = p_user and day = v_day;
    return query select v_count, false;
  else
    return query select v_count, true;
  end if;
end;
$$;

-- Hoàn lại một lượt khi AI lỗi (không tính lượt hỏng cho người dùng)
create or replace function public.ai_usage_refund(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage set count = greatest(count - 1, 0)
  where user_id = p_user and day = (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- Xem số lượt đã dùng hôm nay (không tăng)
create or replace function public.ai_usage_peek(p_user uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce((select count from public.ai_usage where user_id = p_user and day = (now() at time zone 'Asia/Ho_Chi_Minh')::date), 0);
$$;

revoke all on function public.ai_usage_bump(uuid, int) from public, anon, authenticated;
revoke all on function public.ai_usage_refund(uuid) from public, anon, authenticated;
revoke all on function public.ai_usage_peek(uuid) from public, anon, authenticated;
grant execute on function public.ai_usage_bump(uuid, int) to service_role;
grant execute on function public.ai_usage_refund(uuid) to service_role;
grant execute on function public.ai_usage_peek(uuid) to service_role;
