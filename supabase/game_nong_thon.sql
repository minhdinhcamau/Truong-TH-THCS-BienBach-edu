-- GAME: làng quê NÔNG THÔN dùng chung. Chạy file này một lần trong Supabase SQL Editor.
-- Mỗi học sinh được chia ngẫu nhiên 1 mảnh đất (15 mảnh mỗi khu, đầy thì mở khu mới) và có nhà riêng.
-- Tên bảng/hàm bắt đầu bằng game_ nên xoa_game.sql vẫn xóa được hết.

create table if not exists public.game_land (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shard int not null,
  plot int not null check (plot between 0 and 14),
  level int not null default 0 check (level between 0 and 2),
  nick text,
  created_at timestamptz not null default now(),
  unique (shard, plot)
);
alter table public.game_land enable row level security;
-- không tạo policy: mọi truy cập đi qua các hàm bên dưới

create or replace function public.game_join_world(p_nick text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.game_land%rowtype;
  v_shard int;
  v_plot int;
  v_nick text := nullif(left(btrim(coalesce(p_nick, '')), 18), '');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into r from public.game_land where user_id = uid;
  if found then
    if v_nick is not null then
      update public.game_land set nick = v_nick where user_id = uid returning * into r;
    end if;
    return jsonb_build_object('shard', r.shard, 'plot', r.plot, 'level', r.level, 'nick', coalesce(r.nick, ''));
  end if;

  perform pg_advisory_xact_lock(884201);
  select s into v_shard
  from generate_series(1, coalesce((select max(shard) from public.game_land), 0) + 1) s
  where (select count(*) from public.game_land where shard = s) < 15
  order by s limit 1;

  select p into v_plot
  from generate_series(0, 14) p
  where not exists (select 1 from public.game_land where shard = v_shard and plot = p)
  order by random() limit 1;

  insert into public.game_land (user_id, shard, plot, nick) values (uid, v_shard, v_plot, v_nick)
  returning * into r;
  return jsonb_build_object('shard', r.shard, 'plot', r.plot, 'level', r.level, 'nick', coalesce(r.nick, ''));
end $$;

create or replace function public.game_set_nick(p_nick text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.game_land%rowtype;
  v_nick text := nullif(left(btrim(coalesce(p_nick, '')), 18), '');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if v_nick is null or char_length(v_nick) < 2 then raise exception 'ten khong hop le'; end if;
  update public.game_land set nick = v_nick where user_id = uid returning * into r;
  if not found then raise exception 'chua co dat'; end if;
  return jsonb_build_object('shard', r.shard, 'plot', r.plot, 'level', r.level, 'nick', coalesce(r.nick, ''));
end $$;

-- danh sách nhà trong một khu (để vẽ nhà của mọi người)
create or replace function public.game_world_state(p_shard int)
returns jsonb
language sql security definer set search_path = public stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('plot', plot, 'level', level, 'nick', coalesce(nick, 'Bạn nhỏ')) order by plot), '[]'::jsonb)
  from public.game_land
  where shard = p_shard and auth.uid() is not null;
$$;

-- nâng cấp nhà lên một cấp (bản thử nghiệm: miễn phí; sau này sẽ trừ vật liệu/tiền)
create or replace function public.game_upgrade_house()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.game_land%rowtype;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update public.game_land set level = least(level + 1, 2) where user_id = uid returning * into r;
  if not found then raise exception 'chua co dat'; end if;
  return jsonb_build_object('shard', r.shard, 'plot', r.plot, 'level', r.level, 'nick', coalesce(r.nick, ''));
end $$;

revoke all on function public.game_join_world(text), public.game_set_nick(text), public.game_world_state(int), public.game_upgrade_house() from public, anon;
grant execute on function public.game_join_world(text), public.game_set_nick(text), public.game_world_state(int), public.game_upgrade_house() to authenticated;
