-- Apply after schema.sql on Supabase. These service schemas are supplied by Supabase.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pcb-assets','pcb-assets',false,2000000,array['application/pdf','image/png','image/jpeg','application/json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy pcb_asset_read on storage.objects for select to authenticated using(bucket_id='pcb-assets' and pcb_private.role_for((storage.foldername(name))[1]::uuid) is not null);
create policy pcb_asset_insert on storage.objects for insert to authenticated with check(bucket_id='pcb-assets' and pcb_private.can_edit((storage.foldername(name))[1]::uuid));
create policy pcb_asset_update on storage.objects for update to authenticated using(bucket_id='pcb-assets' and pcb_private.can_edit((storage.foldername(name))[1]::uuid)) with check(bucket_id='pcb-assets' and pcb_private.can_edit((storage.foldername(name))[1]::uuid));
create policy pcb_asset_delete on storage.objects for delete to authenticated using(bucket_id='pcb-assets' and pcb_private.can_edit((storage.foldername(name))[1]::uuid));
-- Private channels only. Realtime topic is project:<uuid>.
create policy pcb_realtime_read on realtime.messages for select to authenticated using(extension in ('broadcast','presence') and realtime.topic() ~ '^project:[0-9a-f-]{36}$' and pcb_private.role_for(substring(realtime.topic() from 9)::uuid) is not null);
create policy pcb_realtime_write on realtime.messages for insert to authenticated with check(extension in ('broadcast','presence') and realtime.topic() ~ '^project:[0-9a-f-]{36}$' and pcb_private.role_for(substring(realtime.topic() from 9)::uuid) is not null);
do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pcb_projects') then alter publication supabase_realtime add table public.pcb_projects;end if;end$$;
commit;
