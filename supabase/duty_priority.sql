-- duty_priority.sql
-- Nâng cấp "Trợ lý xếp lịch trực nhật": class_planner_data trả thêm
--   dd_week / dd_prior / dd_types : số lần bị Sao đỏ trừ điểm (discipline_deductions có student_id) tuần này,
--                                   4 tuần trước, và loại lỗi
--   is_cadre / role_label         : ban cán sự = có BẤT KỲ chức vụ nào trong lớp (kể cả tổ phó) hoặc là Sao đỏ
-- Các trường cũ giữ nguyên nên chạy file này an toàn, có thể chạy lại nhiều lần.
-- Dán toàn bộ vào Supabase > SQL Editor > Run.

create or replace function public.class_planner_data(p_class_id uuid, p_week_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.class_can(p_class_id, 'duty') then
    raise exception 'Bạn không có quyền xếp lịch trực nhật của lớp này';
  end if;
  return (
    with cur as (
      select r.student_id, coalesce(sum(r.points), 0) as net, (count(*) filter (where r.points < 0))::integer as vc
      from public.class_records r
      where r.class_id = p_class_id and r.kind <> 'cadre_ok'
        and r.occurred_date >= p_week_start and r.occurred_date < p_week_start + 7
      group by r.student_id
    ),
    pri as (
      select r.student_id, (count(*) filter (where r.points < 0))::integer as vc
      from public.class_records r
      where r.class_id = p_class_id and r.kind <> 'cadre_ok'
        and r.occurred_date >= p_week_start - 28 and r.occurred_date < p_week_start
      group by r.student_id
    ),
    typ as (
      select x.student_id, string_agg(x.label || ' ×' || x.n, ', ' order by x.n desc) as types
      from (
        select r.student_id, r.label, count(*) as n
        from public.class_records r
        where r.class_id = p_class_id and r.points < 0
          and r.occurred_date >= p_week_start - 28 and r.occurred_date < p_week_start + 7
        group by r.student_id, r.label
      ) x
      group by x.student_id
    ),
    dd_cur as (
      select d.student_id, (count(*))::integer as n
      from public.discipline_deductions d
      where d.class_id = p_class_id and d.student_id is not null and d.points < 0
        and d.occurred_date >= p_week_start and d.occurred_date < p_week_start + 7
      group by d.student_id
    ),
    dd_pri as (
      select d.student_id, (count(*))::integer as n
      from public.discipline_deductions d
      where d.class_id = p_class_id and d.student_id is not null and d.points < 0
        and d.occurred_date >= p_week_start - 28 and d.occurred_date < p_week_start
      group by d.student_id
    ),
    dd_typ as (
      select x.student_id, string_agg(x.label || ' ×' || x.n, ', ' order by x.n desc) as types
      from (
        select d.student_id, coalesce(rt.label, d.reason_code) as label, count(*) as n
        from public.discipline_deductions d
        left join public.discipline_reason_types rt on rt.code = d.reason_code
        where d.class_id = p_class_id and d.student_id is not null and d.points < 0
          and d.occurred_date >= p_week_start - 28 and d.occurred_date < p_week_start + 7
        group by d.student_id, coalesce(rt.label, d.reason_code)
      ) x
      group by x.student_id
    ),
    roles as (
      select r.student_id,
             string_agg(distinct case r.role
               when 'lop_truong' then 'Lớp trưởng'
               when 'lop_pho_hoc_tap' then 'Lớp phó học tập'
               when 'lop_pho_lao_dong' then 'Lớp phó lao động'
               when 'lop_pho_van_nghe' then 'Lớp phó văn nghệ'
               when 'to_truong' then 'Tổ trưởng'
               when 'to_pho' then 'Tổ phó'
               else r.role end, ', ') as role_label
      from public.class_roles r
      where r.class_id = p_class_id
      group by r.student_id
    )
    select jsonb_build_object(
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.full_name, 'group_no', g.group_no,
          'week_net', coalesce(c.net, 0), 'week_violations', coalesce(c.vc, 0),
          'prior_violations', coalesce(pr.vc, 0), 'types', coalesce(t.types, ''),
          'dd_week', coalesce(dc.n, 0), 'dd_prior', coalesce(dp.n, 0), 'dd_types', coalesce(dt.types, ''),
          'is_cadre', (ro.student_id is not null or coalesce(p.is_saodo, false)),
          'role_label', coalesce(ro.role_label, case when p.is_saodo then 'Đội Sao đỏ' end, '')
        ) order by regexp_replace(p.full_name, '^.*\s', ''), p.full_name)
        from public.profiles p
        left join public.class_member_groups g on g.student_id = p.id and g.class_id = p_class_id
        left join cur c on c.student_id = p.id
        left join pri pr on pr.student_id = p.id
        left join typ t on t.student_id = p.id
        left join dd_cur dc on dc.student_id = p.id
        left join dd_pri dp on dp.student_id = p.id
        left join dd_typ dt on dt.student_id = p.id
        left join roles ro on ro.student_id = p.id
        where p.class_id = p_class_id and p.role = 'student'
      ), '[]'::jsonb),
      'last_week_duty', coalesce((
        select jsonb_agg(jsonb_build_object('weekday', extract(isodow from d.duty_date)::integer, 'student_id', d.student_id, 'group_no', d.group_no))
        from public.class_duty d
        where d.class_id = p_class_id and d.duty_date >= p_week_start - 7 and d.duty_date < p_week_start
      ), '[]'::jsonb),
      'group_count', coalesce((select l.group_count from public.class_seat_layout l where l.class_id = p_class_id), 4)
    )
  );
end;
$function$;
