-- ============================================================
-- LMS Truong TH-THCS Bien Bach — Tu dong luu tru & xoa bai Hoi bai
--
-- QUY TAC:
--   Ngay 0 - 5   : bai hien thi binh thuong cho tat ca hoc sinh dang nhap.
--   Ngay 5 - 7   : bai vao "kho luu tru" — AN voi hoc sinh, CHI admin/giao
--                   vien xem duoc (ca bai + binh luan).
--   Sau ngay 7   : xoa VINH VIEN bai + toan bo binh luan + anh dinh kem
--                   trong Storage.
--
-- Khong them cot moi (khong can status/archived_at) — trang thai duoc tinh
-- truc tiep tu created_at, tranh du lieu bi lech neu quen cap nhat cot.
--
-- FILE NAY AN TOAN CHAY NHIEU LAN.
-- ============================================================

-- ---------- 1. Cap nhat lai quyen xem qa_posts ----------
-- Hoc sinh: chi xem bai con trong 5 ngay dau.
-- Admin/giao vien: xem duoc CA bai dang hoat dong lan bai dang luu tru (5-7 ngay).
-- Sau 7 ngay bai bi xoa hang loat nen se khong con ai thay duoc nua.
drop policy if exists "Ai dang nhap cung xem duoc cau hoi" on public.qa_posts;
create policy "Xem bai hoi con hieu luc hoac admin/giao vien xem ca luu tru"
  on public.qa_posts for select
  using (
    created_at >= now() - interval '5 days'
    or exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role in ('admin', 'teacher')
    )
  );

-- ---------- 2. Cap nhat lai quyen xem qa_replies ----------
-- Binh luan an theo dung trang thai cua BAI GOC (khong tinh theo ngay tao
-- rieng cua tung binh luan), vi ca bai + binh luan phai "di theo" nhau.
drop policy if exists "Ai dang nhap cung xem duoc cau tra loi" on public.qa_replies;
create policy "Xem binh luan theo trang thai cua bai goc"
  on public.qa_replies for select
  using (
    exists (
      select 1 from public.qa_posts p
      where p.id = qa_replies.post_id
        and (
          p.created_at >= now() - interval '5 days'
          or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role in ('admin', 'teacher')
          )
        )
    )
  );

-- ---------- 3. Ham don dep: xoa bai qua 7 ngay (ca anh trong Storage) ----------
create or replace function public.cleanup_expired_qa_posts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_path text;
begin
  -- Xoa anh trong Storage truoc, tung bai mot (photo_url dang luu URL day
  -- du dang .../object/public/qa-photos/<path>, chi can lay phan <path>).
  for v_rec in
    select id, photo_url
    from public.qa_posts
    where created_at < now() - interval '7 days'
      and photo_url is not null
  loop
    v_path := regexp_replace(v_rec.photo_url, '^.*qa-photos/', '');
    if v_path is not null and v_path <> '' then
      delete from storage.objects
      where bucket_id = 'qa-photos' and name = v_path;
    end if;
  end loop;

  -- Xoa bai qua han. qa_replies co "on delete cascade" theo post_id trong
  -- gamification_schema.sql nen se tu dong xoa het binh luan di kem.
  delete from public.qa_posts
  where created_at < now() - interval '7 days';
end;
$$;

revoke execute on function public.cleanup_expired_qa_posts() from public;

-- ---------- 4. Lich chay tu dong moi ngay (can bat pg_cron truoc) ----------
-- Vao Supabase Dashboard > Database > Extensions > bat "pg_cron", roi chay
-- 2 dong duoi day MOT LAN (khong nam trong file nay de tranh chay nham
-- nhieu lan gay trung lich):
--
--   create extension if not exists pg_cron;
--   select cron.schedule('cleanup-expired-qa', '30 3 * * *', 'select public.cleanup_expired_qa_posts();');
--
-- Sau khi bat, moi ngay luc 3:30 sang he thong se tu dong quet va xoa cac
-- bai qua 7 ngay — khong ton phi rieng, chi la 1 cau lenh SQL chay dinh ky.

-- ---------- LUU Y VE DUNG LUONG STORAGE ----------
-- Tren Supabase (ban Cloud), xoa dong trong storage.objects thuong se keo
-- theo xoa file that trong bucket. Neu sau vai ngay chay thu ban thay dung
-- luong Storage khong giam, hay bao lai — luc do can them 1 Edge Function
-- chay theo lich, dung Storage API (remove()) de dam bao xoa file vat ly,
-- vi mot so cau hinh khong tu dong don dep file khi xoa truc tiep bang SQL.
