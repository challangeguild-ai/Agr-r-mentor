do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.import_plant_protection_catalog(text,text,text,jsonb,text)'::regprocedure)
    into v_def;

  if position('order by created_at nulls last, id limit 1;' in v_def) = 0 then
    raise exception 'A javítandó created_at rendezés nem található az import_plant_protection_catalog függvényben.';
  end if;

  v_def := replace(
    v_def,
    'order by created_at nulls last, id limit 1;',
    'order by source_checked_at nulls last, id limit 1;'
  );

  execute v_def;
end
$$;
