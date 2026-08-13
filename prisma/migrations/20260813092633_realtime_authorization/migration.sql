create or replace function public.user_can_access_file_channel(topic_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_file_id text;
  target_project_id text;
begin
  if topic_name !~ '^file-[0-9a-fA-F-]{36}$' then
    return false;
  end if;

  target_file_id := substring(topic_name from 6);

  select "projectId" into target_project_id
  from files
  where id = target_file_id;

  if target_project_id is null then
    return false;
  end if;

  return exists (
    select 1 from projects
    where id = target_project_id and "ownerId" = auth.uid()::text
  ) or exists (
    select 1 from project_members
    where "projectId" = target_project_id and "userId" = auth.uid()::text
  );
end;
$$;

drop policy if exists "file channel select" on realtime.messages;
create policy "file channel select"
on realtime.messages
for select
to authenticated
using (public.user_can_access_file_channel(topic));

drop policy if exists "file channel insert" on realtime.messages;
create policy "file channel insert"
on realtime.messages
for insert
to authenticated
with check (public.user_can_access_file_channel(topic));
