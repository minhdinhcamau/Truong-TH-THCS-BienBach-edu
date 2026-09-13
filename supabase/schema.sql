-- ============================================================
-- LMS Truong TH-THCS Bien Bach — Giai doan 1: bang profiles
-- Chay toan bo file nay trong Supabase Dashboard > SQL Editor > Run
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','teacher','student')),
  full_name text,
  student_code text unique,
  class_name text,
  expires_at timestamptz,
  is_retained boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Moi nguoi chi tu doc duoc ho so cua chinh minh.
-- Cac thao tac admin (tao, xoa, doi mat khau, gia han...) deu di qua
-- API route dung SUPABASE_SERVICE_ROLE_KEY (secret key), key nay bo qua RLS
-- nen khong can policy rieng cho admin o day.
create policy "Xem ho so cua chinh minh"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Tu cap nhat ho so cua chinh minh"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- Tu dong xoa tai khoan hoc sinh sau 5 nam, tru hoc sinh o lai lop
-- (is_retained = true) da duoc gia han thu cong qua API extend-student.
-- Yeu cau: bat extension pg_cron trong Database > Extensions truoc khi
-- chay lenh cron.schedule ben duoi. Neu project khong ho tro pg_cron,
-- co the bo qua 2 lenh cuoi va goi ham nay bang mot cron job ben ngoai
-- (vi du Vercel Cron goi mot API route chay ham nay dinh ky).
-- ============================================================
create or replace function public.delete_expired_students()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users
  where id in (
    select id from public.profiles
    where role = 'student'
      and is_retained = false
      and expires_at is not null
      and expires_at < now()
  );
end;
$$;

-- Bat extension pg_cron (chi can chay 1 lan)
-- create extension if not exists pg_cron;

-- Len lich chay moi ngay luc 3h sang
-- select cron.schedule('delete-expired-students', '0 3 * * *', 'select public.delete_expired_students();');
