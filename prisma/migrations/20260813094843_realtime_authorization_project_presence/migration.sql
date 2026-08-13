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
  if topic_name ~ '^project-[0-9a-fA-F-]{36}$' then
    target_project_id := substring(topic_name from 9);
  elsif topic_name ~ '^file-[0-9a-fA-F-]{36}$' then
    target_file_id := substring(topic_name from 6);

    select "projectId" into target_project_id
    from files
    where id = target_file_id;
  else
    return false;
  end if;

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
