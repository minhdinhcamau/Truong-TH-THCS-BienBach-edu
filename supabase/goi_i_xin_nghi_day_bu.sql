-- GÓI I: Giáo viên xin nghỉ, xếp dạy bù, thông báo toàn trường khi thời khóa biểu thay đổi.
-- Chạy trong Supabase SQL Editor SAU gói E, F, G. Chạy lại nhiều lần vẫn an toàn.
-- Quyền: chỉ ADMIN được ghi (nhập nghỉ, xếp/hủy dạy bù). Tổng phụ trách và admin xem được.
-- Mọi người đăng nhập xem được lịch dạy bù qua tkb_makeup_public().

-- ---------- Bảng ----------
create table if not exists public.tkb_leave (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  leave_date date not null,
  session text check (session in ('sang', 'chieu')),   -- null = nghỉ cả ngày
  reason text,
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.tkb_makeup (
  id uuid primary key default gen_random_uuid(),
  leave_id uuid references public.tkb_leave(id) on delete set null,
  kind text not null default 'leave' check (kind in ('leave', 'extra')),  -- leave: bù do nghỉ; extra: dạy bù/dạy thêm khác
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text not null,
  orig_teacher text,
  teacher text not null,
  lesson_date date not null,
  session text not null check (session in ('sang', 'chieu')),
  period smallint not null check (period between 1 and 10),
  note text,
  status text not null default 'planned' check (status in ('planned', 'cancelled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Một lớp chỉ có một tiết bù tại một thời điểm; một giáo viên cũng vậy.
create unique index if not exists tkb_makeup_class_slot
  on public.tkb_makeup (class_id, lesson_date, session, period) where status = 'planned';
create unique index if not exists tkb_makeup_teacher_slot
  on public.tkb_makeup (lower(teacher), lesson_date, session, period) where status = 'planned';
create index if not exists tkb_leave_date_idx on public.tkb_leave (leave_date);
create index if not exists tkb_makeup_date_idx on public.tkb_makeup (lesson_date);

alter table public.tkb_leave enable row level security;
alter table public.tkb_makeup enable row level security;
-- Không tạo policy: mọi truy cập đi qua các hàm SECURITY DEFINER bên dưới.

-- ---------- Hàm trợ giúp ----------
create or replace function public.tkb_teacher_has(p_cell text, p_name text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
      from unnest(regexp_split_to_array(coalesce(p_cell, ''), '\s*[,;/+&]\s*')) as x
     where trim(x) <> '' and public.tkb_norm(x) = public.tkb_norm(p_name)
  );
$$;

create or replace function public.tkb_subj_key(p text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(p, ''), '[\s.]+', '', 'g'));
$$;

create or replace function public.tkb_is_fixed_subject(p text)
returns boolean
language sql
immutable
as $$
  select public.tkb_subj_key(p) ~ '^(sh|sinhhoạt|sinhhoat|chàocờ|chaoco|họp|hộihọp|hoihop)';
$$;

-- Thứ trong tuần theo quy ước của trường: 2..7 (Thứ 2 .. Thứ 7); Chủ nhật = 8
create or replace function public.tkb_weekday_of(p date)
returns int
language sql
immutable
as $$
  select (extract(isodow from p))::int + 1;
$$;

-- Gửi thông báo cho TOÀN TRƯỜNG (mọi tài khoản). Chỉ các hàm bên dưới gọi, người dùng không gọi trực tiếp.
create or replace function public.tkb_broadcast(p_title text, p_content text)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n int;
begin
  insert into public.notifications (student_id, title, content, is_read)
  select pr.id, p_title, p_content, false
    from public.profiles pr;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.tkb_broadcast(text, text) from public, anon, authenticated;

-- ---------- Đọc dữ liệu cho màn hình xếp dạy bù (admin, Tổng phụ trách) ----------
create or replace function public.tkb_makeup_context(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rows jsonb;
  v_make jsonb;
  v_leave jsonb;
begin
  if not public.is_tpt_or_admin() then
    raise exception 'Bạn không có quyền xem dữ liệu này.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'class_id', r.class_id, 'class_name', r.class_name, 'weekday', r.weekday,
           'session', r.session, 'period', r.period, 'subject', r.subject, 'teacher', r.teacher)), '[]'::jsonb)
    into v_rows
    from public.tkb_current_rows() r;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'leave_id', m.leave_id, 'kind', m.kind, 'class_id', m.class_id, 'class_name', c.name,
           'subject', m.subject, 'orig_teacher', m.orig_teacher, 'teacher', m.teacher,
           'lesson_date', m.lesson_date, 'session', m.session, 'period', m.period, 'note', m.note)
           order by m.lesson_date, m.session, m.period), '[]'::jsonb)
    into v_make
    from public.tkb_makeup m
    join public.classes c on c.id = m.class_id
   where m.status = 'planned' and m.lesson_date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'teacher_name', l.teacher_name, 'leave_date', l.leave_date,
           'session', l.session, 'reason', l.reason,
           'made_up', (select count(*) from public.tkb_makeup m where m.leave_id = l.id and m.status = 'planned'))
           order by l.leave_date desc, l.created_at desc), '[]'::jsonb)
    into v_leave
    from public.tkb_leave l
   where l.status = 'open' and l.leave_date between p_from - 60 and p_to;

  return jsonb_build_object('rows', v_rows, 'makeups', v_make, 'leaves', v_leave);
end;
$$;

-- Lịch dạy bù công khai cho mọi người đăng nhập
create or replace function public.tkb_makeup_public(p_from date default null)
returns table (
  id uuid, lesson_date date, weekday int, session text, period smallint,
  class_name text, subject text, teacher text, orig_teacher text, note text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.id, m.lesson_date, public.tkb_weekday_of(m.lesson_date), m.session, m.period,
         c.name, m.subject, m.teacher, m.orig_teacher, m.note
    from public.tkb_makeup m
    join public.classes c on c.id = m.class_id
   where auth.uid() is not null
     and m.status = 'planned'
     and m.lesson_date >= coalesce(p_from, public.vn_today())
   order by m.lesson_date, m.session, m.period, c.name;
$$;

-- ---------- Ghi nhận giáo viên xin nghỉ (chỉ admin) ----------
create or replace function public.tkb_leave_create(p_teacher text, p_date date, p_session text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_wd int;
  v_missed int;
  v_sess text := nullif(trim(coalesce(p_session, '')), '');
begin
  if not public.tkb_is_admin() then
    raise exception 'Chỉ quản trị viên được ghi nhận giáo viên xin nghỉ.';
  end if;
  if coalesce(trim(p_teacher), '') = '' or p_date is null then
    raise exception 'Hãy chọn giáo viên và ngày nghỉ.';
  end if;
  if v_sess is not null and v_sess not in ('sang', 'chieu') then
    raise exception 'Buổi nghỉ không hợp lệ.';
  end if;
  v_wd := public.tkb_weekday_of(p_date);
  if v_wd > 7 then
    raise exception 'Ngày nghỉ rơi vào Chủ nhật, không có tiết học.';
  end if;
  if exists (
    select 1 from public.tkb_leave l
     where l.status = 'open' and public.tkb_norm(l.teacher_name) = public.tkb_norm(p_teacher)
       and l.leave_date = p_date and (l.session is null or v_sess is null or l.session = v_sess)
  ) then
    raise exception 'Giáo viên này đã được ghi nhận nghỉ vào ngày/buổi đó.';
  end if;

  select count(*) into v_missed
    from public.tkb_current_rows() r
   where r.weekday = v_wd
     and (v_sess is null or r.session = v_sess)
     and public.tkb_teacher_has(r.teacher, p_teacher)
     and not public.tkb_is_fixed_subject(r.subject);
  if v_missed = 0 and not exists (
    select 1 from public.tkb_current_rows() r where public.tkb_teacher_has(r.teacher, p_teacher)
  ) then
    raise exception 'Không tìm thấy tên giáo viên này trong thời khóa biểu hiện hành.';
  end if;

  insert into public.tkb_leave (teacher_name, leave_date, session, reason)
  values (trim(p_teacher), p_date, v_sess, nullif(trim(coalesce(p_reason, '')), ''))
  returning id into v_id;

  return jsonb_build_object('leave_id', v_id, 'missed', v_missed);
end;
$$;

create or replace function public.tkb_leave_cancel(p_leave_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.tkb_is_admin() then
    raise exception 'Chỉ quản trị viên được hủy ghi nhận nghỉ.';
  end if;
  if exists (select 1 from public.tkb_makeup m where m.leave_id = p_leave_id and m.status = 'planned') then
    raise exception 'Còn tiết dạy bù đã xếp cho đợt nghỉ này. Hãy hủy các tiết dạy bù trước.';
  end if;
  update public.tkb_leave set status = 'cancelled' where id = p_leave_id;
end;
$$;

-- ---------- Xếp dạy bù (chỉ admin). Vi phạm bất kỳ quy tắc nào thì báo lỗi, KHÔNG tự ý xếp. ----------
create or replace function public.tkb_makeup_save(
  p_leave_id uuid, p_kind text, p_class_id uuid, p_subject text, p_orig_teacher text,
  p_teacher text, p_date date, p_session text, p_period int, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_wd int;
  v_id uuid;
  v_class text;
  v_kind text := coalesce(nullif(trim(coalesce(p_kind, '')), ''), 'leave');
  v_msg text;
  v_title text;
begin
  if not public.tkb_is_admin() then
    raise exception 'Chỉ quản trị viên được xếp dạy bù.';
  end if;
  if v_kind not in ('leave', 'extra') then raise exception 'Loại dạy bù không hợp lệ.'; end if;
  if p_class_id is null or coalesce(trim(p_subject), '') = '' or coalesce(trim(p_teacher), '') = ''
     or p_date is null or p_session is null or p_period is null then
    raise exception 'Thiếu thông tin: cần lớp, môn, giáo viên, ngày, buổi và tiết.';
  end if;
  if p_session not in ('sang', 'chieu') then raise exception 'Buổi không hợp lệ.'; end if;
  if p_date < public.vn_today() then raise exception 'Không thể xếp dạy bù vào ngày đã qua.'; end if;
  v_wd := public.tkb_weekday_of(p_date);
  if v_wd > 7 then raise exception 'Không xếp dạy bù vào Chủ nhật.'; end if;

  select c.name into v_class from public.classes c where c.id = p_class_id;
  if v_class is null then raise exception 'Không tìm thấy lớp.'; end if;

  if not exists (select 1 from public.school_bell_times b where b.session = p_session and b.period = p_period and p_period >= 1) then
    raise exception 'Tiết % buổi % không có trong bảng giờ học.', p_period, case when p_session = 'sang' then 'sáng' else 'chiều' end;
  end if;

  if p_leave_id is not null and not exists (select 1 from public.tkb_leave l where l.id = p_leave_id and l.status = 'open') then
    raise exception 'Đợt nghỉ này không còn hiệu lực.';
  end if;

  -- Giáo viên phải từng được phân công dạy đúng môn này
  if not exists (
    select 1 from public.tkb_current_rows() r
     where public.tkb_subj_key(r.subject) = public.tkb_subj_key(p_subject)
       and public.tkb_teacher_has(r.teacher, p_teacher)
  ) then
    raise exception 'Giáo viên % chưa được phân công dạy môn % nên không thể dạy bù môn này.', p_teacher, p_subject;
  end if;

  -- Lớp phải trống đúng tiết đó
  if exists (
    select 1 from public.tkb_current_rows() r
     where r.class_id = p_class_id and r.weekday = v_wd and r.session = p_session and r.period = p_period
  ) then
    raise exception 'Lớp % đang có tiết học vào thời điểm này (thứ %, tiết % buổi %).', v_class, v_wd, p_period, case when p_session = 'sang' then 'sáng' else 'chiều' end;
  end if;
  if exists (
    select 1 from public.tkb_makeup m
     where m.status = 'planned' and m.class_id = p_class_id and m.lesson_date = p_date and m.session = p_session and m.period = p_period
  ) then
    raise exception 'Lớp % đã có tiết dạy bù khác vào thời điểm này.', v_class;
  end if;

  -- Giáo viên phải rảnh
  if exists (
    select 1 from public.tkb_current_rows() r
     where r.weekday = v_wd and r.session = p_session and r.period = p_period
       and public.tkb_teacher_has(r.teacher, p_teacher)
  ) then
    raise exception 'Giáo viên % đang có tiết dạy khác vào thời điểm này (trùng lịch).', p_teacher;
  end if;
  if exists (
    select 1 from public.tkb_makeup m
     where m.status = 'planned' and lower(m.teacher) = lower(trim(p_teacher))
       and m.lesson_date = p_date and m.session = p_session and m.period = p_period
  ) then
    raise exception 'Giáo viên % đã có tiết dạy bù khác vào thời điểm này.', p_teacher;
  end if;
  if exists (
    select 1 from public.tkb_leave l
     where l.status = 'open' and public.tkb_norm(l.teacher_name) = public.tkb_norm(p_teacher)
       and l.leave_date = p_date and (l.session is null or l.session = p_session)
  ) then
    raise exception 'Giáo viên % đã xin nghỉ vào ngày/buổi này.', p_teacher;
  end if;

  insert into public.tkb_makeup (leave_id, kind, class_id, subject, orig_teacher, teacher, lesson_date, session, period, note)
  values (p_leave_id, v_kind, p_class_id, trim(p_subject), nullif(trim(coalesce(p_orig_teacher, '')), ''), trim(p_teacher),
          p_date, p_session, p_period::smallint, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  v_title := '📅 Lịch dạy bù mới: lớp ' || v_class;
  v_msg := 'Lớp ' || v_class || ' học bù môn ' || trim(p_subject) || ' vào thứ ' || v_wd || ', ngày ' || to_char(p_date, 'DD/MM/YYYY')
        || ', tiết ' || p_period || ' buổi ' || case when p_session = 'sang' then 'sáng' else 'chiều' end
        || '. Giáo viên: ' || trim(p_teacher)
        || case when nullif(trim(coalesce(p_orig_teacher, '')), '') is not null and lower(trim(p_orig_teacher)) <> lower(trim(p_teacher))
                then ' (dạy thay cho ' || trim(p_orig_teacher) || ')' else '' end
        || '.' || case when nullif(trim(coalesce(p_note, '')), '') is not null then ' Ghi chú: ' || trim(p_note) else '' end;
  perform public.tkb_broadcast(v_title, v_msg);

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.tkb_makeup_cancel(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m record;
begin
  if not public.tkb_is_admin() then
    raise exception 'Chỉ quản trị viên được hủy lịch dạy bù.';
  end if;
  select mk.*, c.name as class_name into m
    from public.tkb_makeup mk join public.classes c on c.id = mk.class_id
   where mk.id = p_id and mk.status = 'planned';
  if not found then
    raise exception 'Không tìm thấy lịch dạy bù (hoặc đã hủy).';
  end if;
  update public.tkb_makeup set status = 'cancelled' where id = p_id;
  perform public.tkb_broadcast(
    '📅 Hủy lịch dạy bù: lớp ' || m.class_name,
    'Lịch học bù môn ' || m.subject || ' của lớp ' || m.class_name || ' ngày ' || to_char(m.lesson_date, 'DD/MM/YYYY')
      || ', tiết ' || m.period || ' buổi ' || case when m.session = 'sang' then 'sáng' else 'chiều' end || ' đã được hủy.'
  );
end;
$$;

-- ---------- Thông báo toàn trường khi thời khóa biểu được cập nhật (admin, Tổng phụ trách) ----------
create or replace function public.tkb_announce_update(p_effective_from date, p_note text default null)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_tpt_or_admin() then
    raise exception 'Bạn không có quyền gửi thông báo thời khóa biểu.';
  end if;
  return public.tkb_broadcast(
    '📅 Thời khóa biểu đã được cập nhật',
    'Thời khóa biểu mới áp dụng từ ngày ' || to_char(coalesce(p_effective_from, public.vn_today()), 'DD/MM/YYYY')
      || '. Học sinh vào mục Lịch học, giáo viên vào mục Thời khóa biểu để xem lại.'
      || case when nullif(trim(coalesce(p_note, '')), '') is not null then ' ' || trim(p_note) else '' end
  );
end;
$$;

-- ---------- Quyền gọi hàm ----------
revoke all on function public.tkb_makeup_context(date, date) from public, anon;
revoke all on function public.tkb_makeup_public(date) from public, anon;
revoke all on function public.tkb_leave_create(text, date, text, text) from public, anon;
revoke all on function public.tkb_leave_cancel(uuid) from public, anon;
revoke all on function public.tkb_makeup_save(uuid, text, uuid, text, text, text, date, text, int, text) from public, anon;
revoke all on function public.tkb_makeup_cancel(uuid) from public, anon;
revoke all on function public.tkb_announce_update(date, text) from public, anon;
grant execute on function public.tkb_makeup_context(date, date) to authenticated;
grant execute on function public.tkb_makeup_public(date) to authenticated;
grant execute on function public.tkb_leave_create(text, date, text, text) to authenticated;
grant execute on function public.tkb_leave_cancel(uuid) to authenticated;
grant execute on function public.tkb_makeup_save(uuid, text, uuid, text, text, text, date, text, int, text) to authenticated;
grant execute on function public.tkb_makeup_cancel(uuid) to authenticated;
grant execute on function public.tkb_announce_update(date, text) to authenticated;
