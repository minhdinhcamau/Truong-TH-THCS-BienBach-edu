-- =====================================================================
-- GÓI C: lịch trực có khu vực (trong lớp / ngoài sân) + nút xóa lịch,
--        kiểm tra lao động tự lấy người được phân công,
--        tổ trưởng / tổ phó ghi điểm cộng, chống trùng điểm cộng theo tiết.
-- Chạy trong Supabase > SQL Editor, chạy TRƯỚC khi dán file giao diện lên GitHub.
-- File này chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- 1) Lịch trực có khu vực: trong lớp hoặc ngoài sân ---------------------
alter table public.class_duty add column if not exists area text not null default 'trong_lop';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'class_duty_area_check') then
    alter table public.class_duty
      add constraint class_duty_area_check check (area in ('trong_lop', 'ngoai_san'));
  end if;
end
$$;

-- 2) Quyền: tổ trưởng, tổ phó được ghi điểm cộng (perm 'academic') -----
create or replace function public.class_can(p_class_id uuid, p_perm text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
begin
  if public.is_tpt_or_admin() or public.is_homeroom(p_class_id) then
    return true;
  end if;
  v_role := public.class_role_of(p_class_id);
  if v_role is null then
    return false;
  end if;
  return case p_perm
    when 'view'      then true
    when 'seat'      then v_role = 'lop_truong'
    when 'duty'      then v_role in ('lop_truong', 'lop_pho_lao_dong')
    when 'duty_log'  then v_role in ('lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe', 'to_truong', 'to_pho')
    when 'violation' then v_role in ('lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe', 'to_truong', 'to_pho')
    when 'singing'   then v_role in ('lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe')
    when 'academic'  then v_role in ('lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe', 'to_truong', 'to_pho')
    when 'cadre'     then v_role in ('lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe')
    else false
  end;
end;
$function$;

-- 3) Điểm cộng cũng chỉ ghi 1 lần cho mỗi tiết (nhiều ban cán sự không ghi trùng)
update public.class_record_types
   set dedupe_scope = 'period'
 where code in ('phat_bieu', 'diem_9', 'diem_10', 'cong_khac');

-- 4) class_add_record: tổ trưởng / tổ phó ghi điểm cộng cho tổ mình hoặc tổ đang giám sát
create or replace function public.class_add_record(
  p_class_id uuid, p_student_id uuid, p_type_code text,
  p_custom_label text default null, p_note text default null, p_date date default null,
  p_session text default null, p_period integer default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type record;
  v_date date := coalesce(p_date, public.vn_today());
  v_kind text; v_perm text; v_label text; v_points numeric; v_code text;
  v_role text; v_is_staff boolean; v_sgroup smallint; v_watchgroup integer; v_mygroup smallint;
  v_scope text := 'none';
  v_key text;
  v_sess text; v_per smallint; v_subject text;
  v_tt record; v_has_tt boolean;
  v_ex record;
  v_sname text;
begin
  if p_type_code is null or p_type_code = 'khac' then
    v_kind := 'violation'; v_perm := 'violation'; v_points := -1; v_code := 'khac';
    v_label := nullif(trim(coalesce(p_custom_label, '')), '');
    if v_label is null then
      raise exception 'Hãy nhập tên loại vi phạm khác';
    end if;
  else
    select * into v_type from public.class_record_types where code = p_type_code;
    if not found then
      raise exception 'Không tìm thấy loại ghi nhận này';
    end if;
    v_kind := v_type.kind; v_perm := v_type.perm; v_points := v_type.points; v_label := v_type.label; v_code := v_type.code;
    v_scope := coalesce(v_type.dedupe_scope, 'none');
  end if;

  if not public.class_can(p_class_id, v_perm) then
    raise exception 'Bạn không có quyền ghi nhận mục này';
  end if;
  select full_name into v_sname from public.profiles where id = p_student_id and class_id = p_class_id and role = 'student';
  if v_sname is null then
    raise exception 'Học sinh không thuộc lớp này';
  end if;
  if v_date > public.vn_today() then
    raise exception 'Không thể ghi nhận cho ngày trong tương lai';
  end if;

  v_is_staff := public.is_tpt_or_admin() or public.is_homeroom(p_class_id);
  if not v_is_staff and v_date < public.vn_week_start() then
    raise exception 'Chỉ được ghi nhận trong tuần hiện tại';
  end if;

  v_role := public.class_role_of(p_class_id);
  if not v_is_staff and v_role in ('to_truong', 'to_pho') then
    select g.group_no into v_sgroup from public.class_member_groups g
     where g.student_id = p_student_id and g.class_id = p_class_id;
    v_watchgroup := public.class_my_watch_group(p_class_id, v_date);
    if v_kind = 'plus' then
      -- Điểm cộng: tổ của mình hoặc tổ đang được phân công giám sát
      select r.group_no into v_mygroup from public.class_roles r
       where r.class_id = p_class_id and r.student_id = auth.uid() limit 1;
      if v_sgroup is distinct from v_mygroup and v_sgroup is distinct from v_watchgroup then
        raise exception 'Bạn chỉ ghi điểm cộng cho các bạn trong tổ của mình hoặc tổ được phân công giám sát (Tổ %)', coalesce(v_watchgroup::text, '?');
      end if;
    elsif v_sgroup is distinct from v_watchgroup then
      raise exception 'Tuần này bạn chỉ ghi nhận được cho Tổ % (tổ được phân công giám sát trực chéo)', coalesce(v_watchgroup::text, '?');
    end if;
  end if;

  -- Chống ghi trùng
  if v_scope = 'period' then
    select exists (select 1 from public.class_timetable_rows(p_class_id, v_date)) into v_has_tt;
    if v_has_tt then
      if p_session is null or p_period is null then
        raise exception 'Hãy chọn tiết học xảy ra việc này (mục "%" chỉ ghi 1 lần cho mỗi tiết).', v_label;
      end if;
      select * into v_tt from public.class_timetable_rows(p_class_id, v_date) t
       where t.session = p_session and t.period = p_period;
      if not found then
        raise exception 'Tiết đã chọn không có trong thời khóa biểu của ngày này.';
      end if;
      v_sess := p_session; v_per := p_period; v_subject := v_tt.subject;
      v_key := p_student_id::text || ':' || v_code || ':' || v_date::text || ':' || v_sess || ':' || v_per::text;
    else
      -- Lớp chưa có thời khóa biểu: tạm tính 1 lần / ngày
      v_key := p_student_id::text || ':' || v_code || ':' || v_date::text || ':day';
    end if;
  elsif v_scope = 'day' then
    v_key := p_student_id::text || ':' || v_code || ':' || v_date::text || ':day';
  end if;

  if v_key is not null then
    select r.created_at, r.period_no, r.period_session, rb.full_name as by_name, r.recorded_role into v_ex
      from public.class_records r left join public.profiles rb on rb.id = r.recorded_by
     where r.dedupe_key = v_key;
    if found then
      raise exception 'Đã có người ghi trước: % — % % (do % ghi lúc %). Không cần ghi lại.',
        v_sname, v_label,
        case when v_ex.period_no is not null then '(tiết ' || v_ex.period_no || ' ' || case v_ex.period_session when 'sang' then 'sáng' else 'chiều' end || ')'
             else '(trong ngày ' || to_char(v_date, 'DD/MM') || ')' end,
        coalesce(v_ex.by_name, '—') || ' - ' || public.class_role_label(v_ex.recorded_role),
        to_char(v_ex.created_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM');
    end if;
  end if;

  begin
    insert into public.class_records
      (class_id, student_id, kind, type_code, label, points, note, occurred_date, recorded_by, recorded_role,
       period_session, period_no, period_subject, dedupe_key)
    values
      (p_class_id, p_student_id, v_kind, v_code, v_label, v_points, nullif(trim(coalesce(p_note, '')), ''),
       v_date, auth.uid(), case when v_is_staff then 'gvcn' else v_role end,
       v_sess, v_per, v_subject, v_key);
  exception when unique_violation then
    raise exception 'Vừa có người khác ghi nhận mục này cho % ngay trước bạn. Không cần ghi lại.', v_sname;
  end;
end;
$function$;

-- 5) Đọc lịch trực: thêm cột khu vực -----------------------------------
drop function if exists public.class_get_duty(uuid, date, date);

create function public.class_get_duty(p_class_id uuid, p_from date, p_to date)
returns table(id uuid, duty_date date, student_id uuid, full_name text, group_no integer,
              source text, reason text, area text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select d.id, d.duty_date, d.student_id, p.full_name, d.group_no::integer, d.source, d.reason, d.area
  from public.class_duty d
  join public.profiles p on p.id = d.student_id
  where d.class_id = p_class_id and d.duty_date between p_from and p_to
    and (public.class_can(p_class_id, 'view')
         or exists (select 1 from public.profiles me where me.id = auth.uid() and me.class_id = p_class_id))
  order by d.duty_date, d.area, d.group_no, p.full_name;
$function$;

-- 6) Lưu lịch trực: có khu vực; chỉ cho phép "ngoài sân" khi lớp đã được phân khu vực tuần đó
create or replace function public.class_save_duty(p_class_id uuid, p_week_start date, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_bad text;
  v_count integer;
begin
  if not public.class_can(p_class_id, 'duty') then
    raise exception 'Bạn không có quyền xếp lịch trực nhật của lớp này';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Dữ liệu lịch trực không hợp lệ';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r
              where extract(isodow from (r->>'date')::date) >= 6) then
    raise exception 'Lịch trực nhật chỉ xếp từ Thứ 2 đến Thứ 6 (không có Thứ 7, Chủ nhật)';
  end if;

  if exists (select 1 from jsonb_array_elements(p_rows) r where r->>'area' = 'ngoai_san')
     and not exists (select 1 from public.class_yard_areas y
                      where y.class_id = p_class_id and y.week_start = p_week_start
                        and nullif(trim(coalesce(y.area_name, '')), '') is not null) then
    raise exception 'Lớp chưa được Tổng phụ trách phân khu vực ngoài sân cho tuần này nên chưa xếp được bạn trực ngoài sân';
  end if;

  select string_agg(distinct p.full_name, ', ') into v_bad
  from (
    select (r->>'student_id')::uuid as sid
    from jsonb_array_elements(p_rows) r
    where (r->>'date')::date >= p_week_start and (r->>'date')::date < p_week_start + 7
    group by (r->>'student_id')::uuid
    having count(*) >= 2
       and bool_or(nullif(trim(coalesce(r->>'reason', '')), '') is null)
  ) d
  join public.profiles p on p.id = d.sid;
  if v_bad is not null then
    raise exception 'Các bạn trực từ 2 lần trong tuần phải có lý do sắp xếp: %', v_bad;
  end if;

  delete from public.class_duty
   where class_id = p_class_id and duty_date >= p_week_start and duty_date < p_week_start + 7;

  insert into public.class_duty (class_id, duty_date, student_id, group_no, source, reason, created_by, area)
  select p_class_id, (r->>'date')::date, (r->>'student_id')::uuid, nullif(r->>'group_no', '')::smallint,
         case when r->>'source' in ('manual', 'ai_group', 'ai_violators', 'rotation') then r->>'source' else 'manual' end,
         nullif(trim(coalesce(r->>'reason', '')), ''), auth.uid(),
         case when r->>'area' = 'ngoai_san' then 'ngoai_san' else 'trong_lop' end
  from jsonb_array_elements(p_rows) r
  where (r->>'date')::date >= p_week_start and (r->>'date')::date < p_week_start + 7
    and exists (select 1 from public.profiles p
                 where p.id = (r->>'student_id')::uuid and p.class_id = p_class_id and p.role = 'student')
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- 7) Xóa lịch trực: 1 bạn, cả 1 ngày hoặc cả tuần ------------------------
create or replace function public.class_delete_duty(
  p_class_id uuid,
  p_duty_id uuid default null,
  p_date date default null,
  p_week_start date default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_staff boolean;
  v_date date;
  v_n integer := 0;
begin
  if not public.class_can(p_class_id, 'duty') then
    raise exception 'Bạn không có quyền xóa lịch trực nhật của lớp này';
  end if;
  v_staff := public.is_tpt_or_admin() or public.is_homeroom(p_class_id);

  if p_duty_id is not null then
    select d.duty_date into v_date from public.class_duty d
     where d.id = p_duty_id and d.class_id = p_class_id;
    if v_date is null then
      raise exception 'Không tìm thấy lượt trực này';
    end if;
    if not v_staff and v_date < public.vn_week_start() then
      raise exception 'Chỉ được xóa lịch trực của tuần hiện tại hoặc các tuần sau';
    end if;
    delete from public.class_duty where id = p_duty_id and class_id = p_class_id;
    get diagnostics v_n = row_count;
  elsif p_date is not null then
    if not v_staff and p_date < public.vn_week_start() then
      raise exception 'Chỉ được xóa lịch trực của tuần hiện tại hoặc các tuần sau';
    end if;
    delete from public.class_duty where class_id = p_class_id and duty_date = p_date;
    get diagnostics v_n = row_count;
  elsif p_week_start is not null then
    if not v_staff and p_week_start < public.vn_week_start() then
      raise exception 'Chỉ được xóa lịch trực của tuần hiện tại hoặc các tuần sau';
    end if;
    delete from public.class_duty
     where class_id = p_class_id and duty_date >= p_week_start and duty_date < p_week_start + 7;
    get diagnostics v_n = row_count;
  else
    raise exception 'Thiếu thông tin cần xóa';
  end if;
  return v_n;
end;
$function$;

-- 8) Khu vực ngoài sân của lớp trong 1 tuần (để trợ lý xếp lịch biết có phải chia người ra sân) ----
create or replace function public.class_yard_week(p_class_id uuid, p_week_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_week date := p_week_start - (extract(isodow from p_week_start)::int - 1);
  v_area text;
  v_note text;
begin
  if not public.class_can(p_class_id, 'view') then
    raise exception 'Bạn không có quyền xem thông tin này';
  end if;
  select y.area_name, y.note into v_area, v_note
    from public.class_yard_areas y
   where y.class_id = p_class_id and y.week_start = v_week;
  return jsonb_build_object('area_name', nullif(trim(coalesce(v_area, '')), ''), 'note', v_note);
end;
$function$;

-- 9) Kiểm tra lao động: trả thêm khu vực của từng người được phân công trực ----
create or replace function public.class_labor_get(p_class_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_week date := p_date - (extract(isodow from p_date)::int - 1);
  v_area text;
  v_ynote text;
  v_days jsonb;
  v_members jsonb;
  v_duty jsonb;
begin
  if not public.class_can(p_class_id, 'duty_log') then
    raise exception 'Bạn không có quyền xem mục kiểm tra lao động';
  end if;

  select y.area_name, y.note into v_area, v_ynote
    from public.class_yard_areas y
   where y.class_id = p_class_id and y.week_start = v_week;

  select coalesce(jsonb_agg(jsonb_build_object(
           'area', d.area, 'status', d.status, 'note', d.note,
           'by_name', p.full_name, 'updated_at', d.updated_at)), '[]'::jsonb)
    into v_days
    from public.class_labor_day d
    left join public.profiles p on p.id = d.recorded_by
   where d.class_id = p_class_id and d.labor_date = p_date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'area', m.area, 'student_id', m.student_id, 'full_name', s.full_name,
           'group_no', g.group_no, 'status', m.status, 'note', m.note,
           'by_name', pb.full_name, 'by_role', public.class_role_label(m.recorded_role),
           'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
    into v_members
    from public.class_labor_member m
    join public.profiles s on s.id = m.student_id
    left join public.class_member_groups g on g.student_id = m.student_id and g.class_id = p_class_id
    left join public.profiles pb on pb.id = m.recorded_by
   where m.class_id = p_class_id and m.labor_date = p_date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', du.student_id, 'full_name', sp.full_name, 'group_no', du.group_no,
           'area', du.area)
           order by du.area, du.group_no, sp.full_name), '[]'::jsonb)
    into v_duty
    from public.class_duty du
    join public.profiles sp on sp.id = du.student_id
   where du.class_id = p_class_id and du.duty_date = p_date;

  return jsonb_build_object(
    'week_start', v_week,
    'yard_area', v_area,
    'yard_note', v_ynote,
    'can_set_yard', public.is_tpt_or_admin(),
    'days', v_days,
    'members', v_members,
    'on_duty', v_duty
  );
end;
$function$;

grant execute on function public.class_delete_duty(uuid, uuid, date, date) to authenticated;
grant execute on function public.class_yard_week(uuid, date) to authenticated;
grant execute on function public.class_get_duty(uuid, date, date) to authenticated;
