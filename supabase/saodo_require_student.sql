-- saodo_require_student.sql
-- Lỗi CÁ NHÂN (đi trễ, vắng, không mang giấy kiểm tra, thiếu khăn quàng...) bắt buộc Sao đỏ CHỌN HỌC SINH;
-- lỗi CẢ LỚP (vệ sinh không sạch, lớp tự quản không tốt...) vẫn để "Cả lớp".
--
--  1) Thêm cột discipline_reason_types.is_individual (mặc định false = lỗi cả lớp) và đánh dấu sẵn các lỗi cá nhân.
--     Phần đánh dấu chỉ chạy ĐÚNG 1 LẦN (lúc thêm cột) nên chạy lại file này không ghi đè chỗ bạn đã chỉnh.
--  2) tpt_set_reason_individual(): TPT/admin bật-tắt "lỗi cá nhân" cho từng nội dung (có nút trên trang Nội dung vi phạm).
--  3) saodo_report_deduction / saodo_edit_deduction: báo lỗi nếu lỗi cá nhân mà chưa chọn học sinh.
--     Khi có chọn học sinh, bạn đó nhận THÔNG BÁO RIÊNG; các bạn còn lại trong lớp nhận thông báo lớp như cũ.
-- Dán toàn bộ vào Supabase > SQL Editor > Run. An toàn khi chạy lại.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'discipline_reason_types' and column_name = 'is_individual'
  ) then
    alter table public.discipline_reason_types add column is_individual boolean not null default false;

    update public.discipline_reason_types
       set is_individual = true
     where category = 'ne_nep'
       and (
         group_label in ('Đạo đức, tác phong', 'Sĩ số')
         or code in ('vang_co_phep', 'vang_khong_phep', 'di_tre', 'noi_tuc', 'khong_non_bao_hiem', 'khong_dep_quai_hau',
                     'khong_khan_quang', 'khong_bang_ten', 'thieu_dung_cu', 'thieu_but_chi', 'nhuom_toc', 'khong_dong_thung',
                     'thieu_vo', 'giay_kt_thieu_mot_phan', 'giay_kt_khong_mang')
       )
       -- "Phá hoại cơ sở vật chất" thường chưa biết ai làm nên để lỗi cả lớp
       and label <> 'Phá hoại cơ sở vật chất';
  end if;
end
$$;

create or replace function public.tpt_set_reason_individual(p_code text, p_individual boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_tpt_or_admin() then
    raise exception 'Chỉ TPT hoặc admin mới được sửa danh mục vi phạm';
  end if;
  update public.discipline_reason_types
     set is_individual = coalesce(p_individual, false)
   where code = p_code and category = 'ne_nep';
  if not found then
    raise exception 'Không tìm thấy nội dung này (hoặc không thuộc nhóm Nề nếp)';
  end if;
end;
$function$;

create or replace function public.saodo_report_deduction(
  p_class_id uuid, p_reason_code text, p_note text default null::text, p_student_name text default null::text,
  p_occurred_date date default null::date, p_student_id uuid default null::uuid)
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

    -- Thông báo RIÊNG cho bạn bị trừ điểm
    if p_student_id is not null then
      insert into public.notifications (student_id, title, content, xp_amount, is_read)
      values (
        p_student_id,
        '⚠️ Bạn bị Sao đỏ trừ điểm',
        v_reason.label || ' (' || v_reason.points || ' điểm)' || v_when || coalesce(' — ' || p_note, ''),
        null, false
      );
    end if;

    -- Thông báo lớp cho các bạn còn lại (như cũ)
    insert into public.notifications (student_id, title, content, xp_amount, is_read)
    select
      p.id,
      case when v_reason.category = 'ne_nep'
           then '⚠️ Lớp bị trừ điểm Nề nếp'
           else '📖 Lớp bị trừ điểm Học tập (sổ đầu bài)' end,
      v_reason.label || ' (' || v_reason.points || ' điểm)'
        || v_when
        || coalesce(' — ' || v_name, '')
        || coalesce(' — ' || p_note, ''),
      null, false
    from public.profiles p
    where p.role = 'student' and p.class_id = p_class_id
      and (p_student_id is null or p.id <> p_student_id);
  end if;
end;
$function$;

create or replace function public.saodo_edit_deduction(
  p_id uuid, p_reason_code text, p_note text default null::text, p_student_name text default null::text,
  p_student_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row record;
  v_reason record;
  v_name text := nullif(trim(coalesce(p_student_name, '')), '');
begin
  select * into v_row from public.discipline_deductions where id = p_id;
  if not found then
    raise exception 'Không tìm thấy dòng này';
  end if;
  if not public.saodo_can_report(v_row.class_id) then
    raise exception 'Bạn không có quyền với lớp này';
  end if;
  if not public.is_tpt_or_admin() then
    if v_row.reported_by is distinct from auth.uid() then
      raise exception 'Bạn chỉ được sửa báo cáo của chính mình';
    end if;
    if not public.saodo_week_is_open(v_row.occurred_date) then
      raise exception 'Chỉ sửa được báo cáo trong tuần hiện tại hoặc tuần đã được mở';
    end if;
  end if;
  if exists (select 1 from public.class_period_ratings where deduction_id = p_id) then
    raise exception 'Dòng này gắn với một tiết học — hãy đổi xếp loại A/B/C ở bảng tiết học';
  end if;

  select * into v_reason from public.discipline_reason_types where code = p_reason_code;
  if not found then
    raise exception 'Không tìm thấy loại lỗi này';
  end if;

  if coalesce(v_reason.is_individual, false) and p_student_id is null then
    raise exception 'Đây là lỗi cá nhân — hãy chọn học sinh vi phạm.';
  end if;

  if p_student_id is not null then
    select full_name into v_name from public.profiles
     where id = p_student_id and class_id = v_row.class_id and role = 'student';
    if v_name is null then
      raise exception 'Học sinh này không thuộc lớp của báo cáo';
    end if;
  end if;

  update public.discipline_deductions
     set reason_code = p_reason_code, category = v_reason.category, points = v_reason.points,
         note = p_note, student_name = v_name, student_id = p_student_id
   where id = p_id;
end;
$function$;
