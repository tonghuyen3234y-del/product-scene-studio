begin;
create table if not exists public.studio_works (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 ratio text not null check (ratio in ('1:1','3:4','4:3','2:3','3:2','16:9','9:16')),
 scene text not null check (scene in ('两种都要','纯商品展示场景','人机交互场景')),
 requested_count integer not null check (requested_count between 1 and 4),
 original_path text not null,
 result_paths text[] not null default '{}',
 status text not null default 'pending' check (status in ('pending','generating','complete')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check (cardinality(result_paths) between 0 and 4),
 check (status <> 'complete' or (cardinality(result_paths) > 0 and completed_at is not null))
);
create index if not exists studio_works_owner_time on public.studio_works(user_id, completed_at desc, id desc) where status='complete';
alter table public.studio_works enable row level security;
alter table public.studio_works force row level security;
revoke all on public.studio_works from anon, public;
grant select, insert, update on public.studio_works to authenticated;
drop policy if exists studio_works_owner_guard on public.studio_works;
create policy studio_works_owner_guard on public.studio_works as restrictive for all to public
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists studio_works_select on public.studio_works;
create policy studio_works_select on public.studio_works for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists studio_works_insert on public.studio_works;
create policy studio_works_insert on public.studio_works for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists studio_works_update on public.studio_works;
create policy studio_works_update on public.studio_works for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('studio-works','studio-works',false,20971520,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
-- Restrictive guard also prevents another broad Storage policy granting cross-user access.
drop policy if exists studio_works_storage_guard on storage.objects;
create policy studio_works_storage_guard on storage.objects as restrictive for all to public
 using (bucket_id <> 'studio-works' or (storage.foldername(name))[1] = (select auth.uid())::text)
 with check (bucket_id <> 'studio-works' or (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists studio_works_storage_read on storage.objects;
create policy studio_works_storage_read on storage.objects for select to authenticated
 using (bucket_id='studio-works' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists studio_works_storage_insert on storage.objects;
create policy studio_works_storage_insert on storage.objects for insert to authenticated
 with check (bucket_id='studio-works' and (storage.foldername(name))[1]=(select auth.uid())::text);
notify pgrst, 'reload schema';
commit;
