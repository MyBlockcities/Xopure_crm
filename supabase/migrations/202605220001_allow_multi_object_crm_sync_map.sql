-- Allow one Supabase source row to map to multiple Twenty records.
--
-- Example: public.affiliates.id should map to both:
--   - Twenty person
--   - Twenty ambassador

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'crm_sync_map_source_unique'
      and conrelid = 'public.crm_sync_map'::regclass
  ) then
    alter table public.crm_sync_map
      drop constraint crm_sync_map_source_unique;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_sync_map_source_object_unique'
      and conrelid = 'public.crm_sync_map'::regclass
  ) then
    alter table public.crm_sync_map
      add constraint crm_sync_map_source_object_unique
      unique (source_system, source_schema, source_table, source_id, twenty_object);
  end if;
end $$;

