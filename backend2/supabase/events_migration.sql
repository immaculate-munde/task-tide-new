-- Events table for shared calendar
create table if not exists events (
  id            bigint generated always as identity primary key,
  course_server_id bigint references course_servers(id) on delete cascade not null,
  unit_id       bigint references units(id) on delete set null,
  created_by    uuid   references profiles(id) on delete set null,
  title         text   not null,
  description   text,
  event_type    text   not null check (event_type in ('lecture','cat','exam','assignment_due','other')),
  venue         text,
  start_time    timestamptz not null,
  end_time      timestamptz,
  all_day       boolean default false,
  created_at    timestamptz default now()
);

-- RLS
alter table events enable row level security;

-- Members of the course server can read events
create policy "members can view events"
  on events for select
  using (
    exists (
      select 1 from user_course_servers
      where user_course_servers.course_server_id = events.course_server_id
        and user_course_servers.user_id = auth.uid()
    )
    or
    exists (
      select 1 from course_servers
      where course_servers.id = events.course_server_id
        and course_servers.class_rep_id = auth.uid()
    )
  );

-- Only class_rep of that server can insert
create policy "class_rep can insert events"
  on events for insert
  with check (
    exists (
      select 1 from course_servers
      where course_servers.id = events.course_server_id
        and course_servers.class_rep_id = auth.uid()
    )
  );

-- Only class_rep of that server can update
create policy "class_rep can update events"
  on events for update
  using (
    exists (
      select 1 from course_servers
      where course_servers.id = events.course_server_id
        and course_servers.class_rep_id = auth.uid()
    )
  );

-- Only class_rep of that server can delete
create policy "class_rep can delete events"
  on events for delete
  using (
    exists (
      select 1 from course_servers
      where course_servers.id = events.course_server_id
        and course_servers.class_rep_id = auth.uid()
    )
  );
