-- XÓA TOÀN BỘ GAME: mọi hàm và bảng có tên bắt đầu bằng game_ (mất hết nhân vật, nhà, đồ của học sinh, KHÔNG lấy lại được).
-- Sau khi chạy: xóa thư mục app/game, components/game, lib/game (và public/game nếu có),
-- rồi xóa mục GAME_TAB trong app/student/layout.jsx.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'game\_%'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
  for r in
    select t.tablename from pg_tables t
    where t.schemaname = 'public' and t.tablename like 'game\_%'
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end $$;
