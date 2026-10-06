-- XÓA TOÀN BỘ DỮ LIỆU GAME: mọi hàm và bảng có tên bắt đầu bằng game_
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'game\_%' loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
  for r in select tablename from pg_tables
           where schemaname = 'public' and tablename like 'game\_%' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end $$;
