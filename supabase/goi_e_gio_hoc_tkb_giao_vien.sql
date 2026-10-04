-- =====================================================================
-- GÓI E: giờ vào / giờ ra từng tiết (cho thời khóa biểu học sinh và giáo viên)
--        + thời khóa biểu RIÊNG của từng giáo viên (khớp theo tên ghi trong thời khóa biểu)
--        + xóa tiết "Hội họp" (họp chiều thứ 6...) khỏi thời khóa biểu đã lưu của học sinh
-- Chạy trong Supabase > SQL Editor, chạy TRƯỚC khi dán file giao diện lên GitHub.
-- Không phụ thuộc gói C, D. File chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- 1) Giờ học các tiết (dùng chung toàn trường) --------------------------
create table if not exists public.school_bell_times (
  session    text     not null check (session in ('sang', 'chieu')),
  period     smallint not null check (period between 0 and 10), -- 0 = sinh hoạt đầu giờ
  label      text,
  start_time time     not null,
  end_time   time     not null,
  primary key (session, period)
);

alter table public.school_bell_times enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'school_bell_times' and policyname = 'bell_times_select') then
    create policy bell_times_select on public.school_bell_times for select using (true);
  end if;
end
$$;

-- Giờ hiện tại của trường (theo bảng giờ cô Tổng phụ trách cung cấp). Không ghi đè nếu đã có.
insert into public.school_bell_times (session, period, label, start_time, end_time) values
  ('sang', 0, 'Sinh hoạt đầu giờ', '06:45', '07:00'),
  ('sang', 1, null, '07:00', '07:45'),
  ('sang', 2, null, '07:45', '08:30'),
  ('sang', 3, null, '08:50', '09:35'),
  ('sang', 4, null, '09:35', '10:20'),
  ('sang', 5, null, '10:25', '11:10'),
  ('chieu', 0, 'Sinh hoạt đầu giờ', '12:50', '13:00'),
  ('chieu', 1, null, '13:00', '13:45'),
  ('chieu', 2, null, '13:50', '14:35'),
  ('chieu', 3, null, '14:50', '15:35'),
  ('chieu', 4, null, '15:40', '16:25')
on conflict (session, period) do nothing;

-- Lưu lại toàn bộ bảng giờ (chỉ Tổng phụ trách hoặc admin)
-- p_rows: [{ "session": "sang", "period": 1, "label": null, "start_time": "07:00", "end_time": "07:45" }, ...]
create or replace function public.tpt_save_bell_times(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if not public.is_tpt_or_admin() then
    raise exception 'Chỉ Tổng phụ trách hoặc admin mới được sửa giờ học';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Chưa có dữ liệu giờ học';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
     where (r->>'session') not in ('sang', 'chieu')
        or (r->>'start_time') is null or (r->>'end_time') is null
        or (r->>'end_time')::time <= (r->>'start_time')::time
  ) then
    raise exception 'Mỗi tiết cần có buổi, giờ vào và giờ ra (giờ ra phải sau giờ vào)';
  end if;

  delete from public.school_bell_times where true; -- Supabase chặn DELETE không có WHERE
  insert into public.school_bell_times (session, period, label, start_time, end_time)
  select r->>'session', (r->>'period')::smallint, nullif(trim(coalesce(r->>'label', '')), ''),
         (r->>'start_time')::time, (r->>'end_time')::time
    from jsonb_array_elements(p_rows) r
  on conflict (session, period) do update
    set label = excluded.label, start_time = excluded.start_time, end_time = excluded.end_time;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- 2) Tên giáo viên trên thời khóa biểu <-> tài khoản giáo viên --------------
-- Thời khóa biểu ghi tên gọi ngắn (ví dụ "Đỉnh", "Việt Anh"), tài khoản ghi họ tên đầy đủ.
-- Mặc định: khớp khi họ tên KẾT THÚC bằng tên trên thời khóa biểu ("Phan Nguyễn Minh Đỉnh" khớp "Đỉnh").
-- Nếu trùng tên hoặc khớp sai, giáo viên (hoặc TPT/admin) khai báo "tên trên thời khóa biểu" riêng
-- ở bảng dưới; khi đã khai báo thì chỉ khớp đúng các tên đó và các tài khoản khác không tự khớp tên ấy nữa.
create table if not exists public.teacher_tkb_alias (
  profile_id uuid not null,
  alias      text not null,
  primary key (profile_id, alias)
);
alter table public.teacher_tkb_alias enable row level security;

-- Chuẩn hóa tên để so sánh: bỏ khoảng trắng thừa, chữ thường
create or replace function public.tkb_norm(p text)
returns text
language sql
immutable
as $function$
  select regexp_replace(lower(trim(coalesce(p, ''))), '\s+', ' ', 'g');
$function$;

-- Người gọi có phải giáo viên / TPT / admin không
create or replace function public.tkb_is_staff_caller()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and (p.role in ('teacher', 'admin') or coalesce(p.is_tpt, false))
  );
$function$;

-- Hồ sơ ứng với p_profile_id (null = chính mình); xem người khác chỉ TPT/admin
create or replace function public.tkb_resolve_profile(p_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := coalesce(p_profile_id, auth.uid());
begin
  if auth.uid() is null or not public.tkb_is_staff_caller() then
    raise exception 'Chỉ giáo viên mới xem được thời khóa biểu giáo viên';
  end if;
  if v_id <> auth.uid() and not public.is_tpt_or_admin() then
    raise exception 'Bạn chỉ xem được thời khóa biểu của chính mình';
  end if;
  return v_id;
end;
$function$;

-- Bản thời khóa biểu đang áp dụng của mỗi lớp (gần nhất không vượt quá hôm nay; chưa có thì lấy bản sớm nhất)
create or replace function public.tkb_current_rows()
returns table(
  class_id uuid, class_name text, weekday smallint, session text, period smallint,
  subject text, teacher text, effective_from date)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with cur as (
    select t.class_id as cid,
           coalesce(max(t.effective_from) filter (where t.effective_from <= public.vn_today()), min(t.effective_from)) as ef
      from public.class_timetable t
     group by t.class_id
  )
  select t.class_id, c.name, t.weekday, t.session, t.period, t.subject, t.teacher, t.effective_from
    from public.class_timetable t
    join cur on cur.cid = t.class_id and cur.ef = t.effective_from
    join public.classes c on c.id = t.class_id;
$function$;

-- Các "tên trên thời khóa biểu" của 1 giáo viên (đã khai báo, hoặc tự khớp theo họ tên)
create or replace function public.teacher_tkb_names(p_profile_id uuid default null)
returns table(name text, manual boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := public.tkb_resolve_profile(p_profile_id);
  v_full text;
  v_has boolean;
begin
  select public.tkb_norm(p.full_name) into v_full from public.profiles p where p.id = v_id;
  select exists (select 1 from public.teacher_tkb_alias a where a.profile_id = v_id) into v_has;

  if v_has then
    return query
      select a.alias, true from public.teacher_tkb_alias a where a.profile_id = v_id order by a.alias;
  else
    return query
      select distinct tok.t, false
        from (
          select public.tkb_norm(x) as t, x as raw
            from public.tkb_current_rows() r,
                 lateral regexp_split_to_table(coalesce(r.teacher, ''), '\s*[,;/+&]\s*') x
           where trim(x) <> ''
        ) tok
       where (v_full = tok.t or v_full like '% ' || tok.t)
         and not exists (select 1 from public.teacher_tkb_alias a2
                          where public.tkb_norm(a2.alias) = tok.t and a2.profile_id <> v_id)
       order by 1;
  end if;
end;
$function$;

-- Thời khóa biểu riêng của giáo viên: mọi tiết mà tên giáo viên khớp
create or replace function public.teacher_timetable(p_profile_id uuid default null)
returns table(
  class_id uuid, class_name text, weekday smallint, session text, period smallint,
  subject text, teacher text, effective_from date)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := public.tkb_resolve_profile(p_profile_id);
  v_full text;
  v_has boolean;
begin
  select public.tkb_norm(p.full_name) into v_full from public.profiles p where p.id = v_id;
  select exists (select 1 from public.teacher_tkb_alias a where a.profile_id = v_id) into v_has;

  return query
    select r.class_id, r.class_name, r.weekday, r.session, r.period, r.subject, r.teacher, r.effective_from
      from public.tkb_current_rows() r
     where exists (
       select 1
         from regexp_split_to_table(coalesce(r.teacher, ''), '\s*[,;/+&]\s*') x
        where trim(x) <> ''
          and (
            case when v_has then
              exists (select 1 from public.teacher_tkb_alias a
                       where a.profile_id = v_id and public.tkb_norm(a.alias) = public.tkb_norm(x))
            else
              (v_full = public.tkb_norm(x) or v_full like '% ' || public.tkb_norm(x))
              and not exists (select 1 from public.teacher_tkb_alias a2
                               where public.tkb_norm(a2.alias) = public.tkb_norm(x) and a2.profile_id <> v_id)
            end
          )
     )
     order by r.weekday, case r.session when 'sang' then 1 else 2 end, r.period, r.class_name;
end;
$function$;

-- Khai báo "tên trên thời khóa biểu" (nhiều tên cách nhau bằng dấu phẩy; để trống = quay lại tự khớp theo họ tên)
create or replace function public.teacher_set_tkb_alias(p_aliases text, p_profile_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := public.tkb_resolve_profile(p_profile_id);
  v_n integer := 0;
begin
  delete from public.teacher_tkb_alias where profile_id = v_id;
  insert into public.teacher_tkb_alias (profile_id, alias)
  select v_id, a
    from (
      select distinct trim(x) as a
        from regexp_split_to_table(coalesce(p_aliases, ''), '\s*[,;]\s*') x
       where trim(x) <> ''
    ) q
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- Danh sách giáo viên cho TPT / admin chọn xem thời khóa biểu của từng người
create or replace function public.tkb_list_teachers()
returns table(id uuid, full_name text, is_tpt boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_tpt_or_admin() then
    raise exception 'Chỉ Tổng phụ trách hoặc admin mới xem được danh sách này';
  end if;
  return query
    select p.id, p.full_name, coalesce(p.is_tpt, false)
      from public.profiles p
     where p.role = 'teacher' or coalesce(p.is_tpt, false)
     order by regexp_replace(p.full_name, '^.*\s', ''), p.full_name;
end;
$function$;

-- Tên giáo viên trong thời khóa biểu mà CHƯA khớp tài khoản giáo viên nào (để TPT/admin kiểm tra)
create or replace function public.tkb_unmatched_teachers()
returns table(name text, periods bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_tpt_or_admin() then
    raise exception 'Chỉ Tổng phụ trách hoặc admin mới xem được danh sách này';
  end if;
  return query
    select min(trim(x)) as name, count(*) as periods
      from public.tkb_current_rows() r,
           lateral regexp_split_to_table(coalesce(r.teacher, ''), '\s*[,;/+&]\s*') x
     where trim(x) <> ''
       and not exists (
         select 1 from public.profiles p
          where (p.role = 'teacher' or coalesce(p.is_tpt, false))
            and (
              exists (select 1 from public.teacher_tkb_alias a
                       where a.profile_id = p.id and public.tkb_norm(a.alias) = public.tkb_norm(x))
              or (
                not exists (select 1 from public.teacher_tkb_alias a3 where a3.profile_id = p.id)
                and (public.tkb_norm(p.full_name) = public.tkb_norm(x)
                     or public.tkb_norm(p.full_name) like '% ' || public.tkb_norm(x))
                and not exists (select 1 from public.teacher_tkb_alias a2
                                 where public.tkb_norm(a2.alias) = public.tkb_norm(x) and a2.profile_id <> p.id)
              )
            )
       )
     group by public.tkb_norm(x)
     order by 2 desc, 1;
end;
$function$;

-- 3) Bỏ tiết "Hội họp" khỏi thời khóa biểu đã lưu --------------------------
-- Họp là việc của giáo viên, không phải tiết học của học sinh (file Excel ghi "HỘI HỌP" ở chiều thứ 6, ô gộp cả hàng).
-- Giao diện mới đã tự bỏ qua khi nhập file và tự ẩn khi hiển thị; lệnh dưới dọn luôn dữ liệu cũ. Chạy lại nhiều lần vẫn an toàn.
delete from public.class_timetable
 where regexp_replace(lower(trim(coalesce(subject, ''))), '\s+', ' ', 'g')
       in ('hội họp', 'họp', 'hội họp hđ', 'họp hội đồng', 'họp chuyên môn', 'họp tổ');

grant execute on function public.tpt_save_bell_times(jsonb) to authenticated;
grant execute on function public.teacher_tkb_names(uuid) to authenticated;
grant execute on function public.teacher_timetable(uuid) to authenticated;
grant execute on function public.teacher_set_tkb_alias(text, uuid) to authenticated;
grant execute on function public.tkb_list_teachers() to authenticated;
grant execute on function public.tkb_unmatched_teachers() to authenticated;
