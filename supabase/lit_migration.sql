-- =====================================================================
-- MODULE NGỮ VĂN: giao bài văn, AI chấm theo barem, giáo viên duyệt
-- Chạy toàn bộ file này 1 lần trong Supabase → SQL Editor.
-- =====================================================================

-- 1. BẢNG ---------------------------------------------------------------

create table if not exists public.lit_assignments (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id),
  class_id    uuid not null references public.classes(id) on delete cascade,
  title       text not null,
  prompt      text not null default '',
  genre       text not null default 'nghi_luan_xh',
  min_words   integer not null default 0 check (min_words >= 0),
  max_words   integer check (max_words is null or max_words >= min_words),
  max_score   numeric not null default 10 check (max_score > 0 and max_score <= 100),
  due_date    timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.lit_criteria (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.lit_assignments(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  max_points    numeric not null check (max_points > 0),
  sort_order    integer not null default 0
);

create table if not exists public.lit_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.lit_assignments(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  content       text not null default '',
  word_count    integer not null default 0,
  status        text not null default 'draft'
                check (status in ('draft', 'submitted', 'ai_graded', 'published')),
  submitted_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- Điểm + nhận xét tách riêng để học sinh KHÔNG đọc được khi chưa công bố
create table if not exists public.lit_grades (
  submission_id uuid primary key references public.lit_submissions(id) on delete cascade,
  ai_result     jsonb,                 -- bản gốc AI chấm (không sửa)
  final_result  jsonb,                 -- bản giáo viên đã chỉnh (học sinh đọc bản này)
  total         numeric,
  published     boolean not null default false,
  published_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists lit_assignments_class_idx  on public.lit_assignments (class_id, created_at desc);
create index if not exists lit_assignments_teacher_idx on public.lit_assignments (teacher_id);
create index if not exists lit_criteria_assignment_idx on public.lit_criteria (assignment_id, sort_order);
create index if not exists lit_submissions_student_idx on public.lit_submissions (student_id);

-- 2. HÀM TRỢ GIÚP -------------------------------------------------------

create or replace function public.lit_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('teacher', 'admin') from public.profiles where id = auth.uid()), false);
$$;

-- 3. RLS ----------------------------------------------------------------

alter table public.lit_assignments enable row level security;
alter table public.lit_criteria    enable row level security;
alter table public.lit_submissions enable row level security;
alter table public.lit_grades      enable row level security;

-- lit_assignments
drop policy if exists lit_assign_teacher on public.lit_assignments;
create policy lit_assign_teacher on public.lit_assignments for all to authenticated
  using (public.lit_is_teacher() and (teacher_id = auth.uid() or public.is_tpt_or_admin()))
  with check (public.lit_is_teacher() and (teacher_id = auth.uid() or public.is_tpt_or_admin()));

drop policy if exists lit_assign_student on public.lit_assignments;
create policy lit_assign_student on public.lit_assignments for select to authenticated
  using (class_id = (select p.class_id from public.profiles p where p.id = auth.uid()));

-- lit_criteria
drop policy if exists lit_criteria_teacher on public.lit_criteria;
create policy lit_criteria_teacher on public.lit_criteria for all to authenticated
  using (public.lit_is_teacher() and exists (
    select 1 from public.lit_assignments a
    where a.id = assignment_id and (a.teacher_id = auth.uid() or public.is_tpt_or_admin())))
  with check (public.lit_is_teacher() and exists (
    select 1 from public.lit_assignments a
    where a.id = assignment_id and (a.teacher_id = auth.uid() or public.is_tpt_or_admin())));

drop policy if exists lit_criteria_student on public.lit_criteria;
create policy lit_criteria_student on public.lit_criteria for select to authenticated
  using (exists (select 1 from public.lit_assignments a where a.id = assignment_id));

-- lit_submissions
drop policy if exists lit_sub_teacher_select on public.lit_submissions;
create policy lit_sub_teacher_select on public.lit_submissions for select to authenticated
  using (public.lit_is_teacher() and exists (
    select 1 from public.lit_assignments a
    where a.id = assignment_id and (a.teacher_id = auth.uid() or public.is_tpt_or_admin())));

drop policy if exists lit_sub_student_select on public.lit_submissions;
create policy lit_sub_student_select on public.lit_submissions for select to authenticated
  using (student_id = auth.uid());

drop policy if exists lit_sub_student_insert on public.lit_submissions;
create policy lit_sub_student_insert on public.lit_submissions for insert to authenticated
  with check (
    student_id = auth.uid() and status = 'draft'
    and exists (select 1 from public.lit_assignments a where a.id = assignment_id));

-- Học sinh chỉ sửa được khi còn là bản nháp. Nộp bài đi qua API server (service role).
drop policy if exists lit_sub_student_update on public.lit_submissions;
create policy lit_sub_student_update on public.lit_submissions for update to authenticated
  using (student_id = auth.uid() and status = 'draft')
  with check (student_id = auth.uid() and status = 'draft');

-- lit_grades
drop policy if exists lit_grades_teacher on public.lit_grades;
create policy lit_grades_teacher on public.lit_grades for all to authenticated
  using (public.lit_is_teacher() and exists (
    select 1 from public.lit_submissions s
    join public.lit_assignments a on a.id = s.assignment_id
    where s.id = submission_id and (a.teacher_id = auth.uid() or public.is_tpt_or_admin())))
  with check (public.lit_is_teacher() and exists (
    select 1 from public.lit_submissions s
    join public.lit_assignments a on a.id = s.assignment_id
    where s.id = submission_id and (a.teacher_id = auth.uid() or public.is_tpt_or_admin())));

drop policy if exists lit_grades_student on public.lit_grades;
create policy lit_grades_student on public.lit_grades for select to authenticated
  using (published and exists (
    select 1 from public.lit_submissions s where s.id = submission_id and s.student_id = auth.uid()));

-- 4. CÔNG BỐ ĐIỂM + CỘNG KINH NGHIỆM + THÔNG BÁO ------------------------

-- Cho phép nguồn XP mới 'lit_essay'
alter table public.xp_events drop constraint if exists xp_events_source_type_check;
alter table public.xp_events add constraint xp_events_source_type_check
  check (source_type = any (array['assignment', 'qa_post', 'qa_reply_useful', 'contest', 'manual', 'lit_essay']));

create or replace function public.lit_publish(p_submission_id uuid, p_publish boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub     record;
  v_a       record;
  v_g       record;
  v_first   boolean;
  v_xp      integer;
  v_subject uuid;
begin
  select * into v_sub from public.lit_submissions where id = p_submission_id;
  if not found then raise exception 'Không tìm thấy bài làm này'; end if;

  select * into v_a from public.lit_assignments where id = v_sub.assignment_id;
  if not (public.lit_is_teacher() and (v_a.teacher_id = auth.uid() or public.is_tpt_or_admin())) then
    raise exception 'Bạn không có quyền công bố điểm bài này';
  end if;

  select * into v_g from public.lit_grades where submission_id = p_submission_id;
  if not found or v_g.final_result is null then
    raise exception 'Bài này chưa có điểm để công bố';
  end if;

  if not p_publish then
    update public.lit_grades set published = false, updated_at = now() where submission_id = p_submission_id;
    update public.lit_submissions set status = 'ai_graded' where id = p_submission_id;
    return;
  end if;

  v_first := v_g.published_at is null;

  update public.lit_grades
     set published = true, published_at = coalesce(published_at, now()), updated_at = now()
   where submission_id = p_submission_id;
  update public.lit_submissions set status = 'published' where id = p_submission_id;

  -- XP tối đa 30 theo tỉ lệ điểm (giống bài trắc nghiệm). grant_xp tự chống cộng trùng.
  v_xp := greatest(0, least(30, round(coalesce(v_g.total, 0) / v_a.max_score * 30)));
  select id into v_subject from public.subjects where name ilike '%văn%' limit 1;
  perform public.grant_xp(v_sub.student_id, v_subject, 'lit_essay', p_submission_id::text, v_xp);

  if v_first then
    insert into public.notifications (student_id, title, content, xp_amount, is_read)
    values (v_sub.student_id,
            '📝 Bài văn đã có điểm',
            v_a.title || ' — ' || coalesce(v_g.total::text, '?') || '/' || v_a.max_score::text || ' điểm. Vào mục Ngữ văn để đọc nhận xét chi tiết.',
            v_xp, false);
  end if;
end;
$$;

revoke all on function public.lit_publish(uuid, boolean) from public, anon;
grant execute on function public.lit_publish(uuid, boolean) to authenticated;
revoke all on function public.lit_is_teacher() from public, anon;
grant execute on function public.lit_is_teacher() to authenticated;
