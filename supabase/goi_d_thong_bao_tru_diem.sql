-- =====================================================================
-- GÓI D: thông báo khi bị trừ điểm
--  1) Bị ban cán sự trừ điểm trong lớp: gửi thông báo RIÊNG cho bạn đó (hiện popup + chuông).
--  2) Bị Sao đỏ trừ điểm: thông báo gửi cả lớp KHÔNG còn ghi tên bạn bị trừ (bạn đó vẫn nhận thông báo riêng có tên).
-- Chạy SAU goi_c_truc_nhat_lao_dong_diem_cong.sql. Chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- 1) class_add_record (bản của gói C, thêm thông báo riêng)
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
  v_by text;
  v_when text;
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

  -- Bị trừ điểm trong lớp: thông báo RIÊNG cho bạn đó (popup + chuông). Không gửi tên cho cả lớp.
  if v_points < 0 then
    select coalesce(p.full_name, 'giáo viên') into v_by from public.profiles p where p.id = auth.uid();
    v_when := case when v_date <> public.vn_today() then ' — ngày ' || to_char(v_date, 'DD/MM') else '' end;
    insert into public.notifications (student_id, title, content, xp_amount, is_read)
    values (
      p_student_id,
      '⚠️ Bạn bị trừ điểm trong lớp',
      v_label || ' (' || v_points::text || ' điểm)'
        || case when v_per is not null
                then ' — tiết ' || v_per || case v_sess when 'sang' then ' sáng' else ' chiều' end
                     || coalesce(' môn ' || v_subject, '')
                else '' end
        || v_when
        || ' — do ' || v_by || case when v_is_staff then '' else ' (' || public.class_role_label(v_role) || ')' end || ' ghi nhận'
        || coalesce(' — ' || nullif(trim(coalesce(p_note, '')), ''), ''),
      null, false
    );
  end if;
end;
$function$;

-- 2) Sao đỏ báo cáo trừ điểm: thông báo cả lớp bỏ tên bạn bị trừ
create or replace function public.saodo_report_deduction(
  p_class_id uuid, p_reason_code text, p_note text default null, p_student_name text default null,
  p_occurred_date date default null, p_student_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_date date := coalesce(p_occurred_date, public.vn_today());
  v_reason record;
  v_name text := nullif(trim(coalesce(p_student_name, '')), '');
  v_when text;
begin
  if not public.saodo_can_report(p_class_id) then
    raise exception 'Bạn không có quyền báo cáo cho lớp này';
  end if;

  perform public.saodo_validate_report_date(v_date);

  if p_student_id is not null then
    select full_name into v_name from public.profiles
     where id = p_student_id and class_id = p_class_id and role = 'student';
    if v_name is null then
      raise exception 'Học sinh này không thuộc lớp đã chọn';
    end if;
  end if;

  select * into v_reason from public.discipline_reason_types where code = p_reason_code;
  if not found then
    raise exception 'Không tìm thấy loại lỗi này';
  end if;

  if coalesce(v_reason.is_individual, false) and p_student_id is null then
    raise exception 'Đây là lỗi cá nhân — hãy chọn học sinh vi phạm.';
  end if;

  insert into public.discipline_deductions
    (class_id, category, reason_code, points, note, reported_by, occurred_date, student_name, student_id)
  values
    (p_class_id, v_reason.category, p_reason_code, v_reason.points, p_note, auth.uid(), v_date, v_name, p_student_id);

  if v_reason.points <> 0 then
    v_when := case when v_date <> public.vn_today() then ' — ngày ' || to_char(v_date, 'DD/MM') else '' end;

    -- Thông báo RIÊNG cho bạn bị trừ điểm (có tên lỗi, điểm, ghi chú)
    if p_student_id is not null then
      insert into public.notifications (student_id, title, content, xp_amount, is_read)
      values (
        p_student_id,
        '⚠️ Bạn bị Sao đỏ trừ điểm',
        v_reason.label || ' (' || v_reason.points || ' điểm)' || v_when || coalesce(' — ' || p_note, ''),
        null, false
      );
    end if;

    -- Thông báo cho các bạn còn lại trong lớp: KHÔNG ghi tên bạn bị trừ điểm, không chép ghi chú
    -- (ghi chú của Sao đỏ có thể nhắc tên bạn)
    insert into public.notifications (student_id, title, content, xp_amount, is_read)
    select
      p.id,
      case when v_reason.category = 'ne_nep'
           then '⚠️ Lớp bị trừ điểm Nề nếp'
           else '📖 Lớp bị trừ điểm Học tập (sổ đầu bài)' end,
      v_reason.label || ' (' || v_reason.points || ' điểm)' || v_when,
      null, false
    from public.profiles p
    where p.role = 'student' and p.class_id = p_class_id
      and (p_student_id is null or p.id <> p_student_id);
  end if;
end;
$function$;
