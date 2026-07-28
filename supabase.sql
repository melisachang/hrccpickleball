-- Run this in Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  number_of_courts integer not null check (number_of_courts >= 1),
  min_players integer not null check (min_players >= 2),
  status text not null default 'planned' check (status in ('planned', 'court_booked', 'cancelled', 'closed', 'done')),
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists title text;

update public.events
set title = coalesce(title, 'Untitled Event')
where title is null;

alter table public.events
  alter column title set not null;

alter table public.events
  add column if not exists event_date date;

update public.events
set event_date = coalesce(event_date, current_date)
where event_date is null;

alter table public.events
  alter column event_date set not null;

alter table public.events
  add column if not exists start_time time;

update public.events
set start_time = '18:00:00'::time
where start_time is null or start_time::text = '';

alter table public.events
  alter column start_time type time using nullif(start_time::text, '')::time;

alter table public.events
  alter column start_time set default '18:00:00'::time;

alter table public.events
  alter column start_time set not null;

alter table public.events
  add column if not exists end_time time;

update public.events
set end_time = '19:00:00'::time
where end_time is null or end_time::text = '';

alter table public.events
  alter column end_time type time using nullif(end_time::text, '')::time;

alter table public.events
  alter column end_time set default '19:00:00'::time;

alter table public.events
  alter column end_time set not null;

alter table public.events
  add column if not exists number_of_courts integer;

update public.events
set number_of_courts =
  case
    when number_of_courts is not null then number_of_courts
    when venue ~ '^\s*[0-9]+\s*$' then trim(venue)::integer
    else 1
  end;

alter table public.events
  alter column number_of_courts set default 1;

update public.events
set number_of_courts = coalesce(number_of_courts, 1)
where number_of_courts is null;

alter table public.events
  alter column number_of_courts set not null;

alter table public.events
  drop constraint if exists events_number_of_courts_check;

alter table public.events
  add constraint events_number_of_courts_check check (number_of_courts >= 1);

-- If legacy venue exists, remove strict requirement so number_of_courts is authoritative.
alter table public.events
  alter column venue drop not null;

alter table public.events
  add column if not exists min_players integer;

update public.events
set min_players = coalesce(min_players, 4)
where min_players is null;

alter table public.events
  alter column min_players set default 4;

alter table public.events
  alter column min_players set not null;

alter table public.events
  drop constraint if exists events_min_players_check;

alter table public.events
  add constraint events_min_players_check check (min_players >= 2);

alter table public.events
  add column if not exists status text;

update public.events
set status = coalesce(status, 'planned')
where status is null;

alter table public.events
  alter column status set default 'planned';

alter table public.events
  alter column status set not null;

alter table public.events
  drop constraint if exists events_status_check;

alter table public.events
  add constraint events_status_check check (status in ('planned', 'court_booked', 'cancelled'));

create table if not exists public.event_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_name text not null,
  is_available boolean not null,
  created_at timestamptz not null default now(),
  unique (event_id, player_name)
);

create unique index if not exists event_votes_event_id_player_name_key
  on public.event_votes (event_id, player_name);

alter table public.events enable row level security;
alter table public.event_votes enable row level security;

-- Public policies for quick MVP use. For production, lock this down with auth.
drop policy if exists "public can read events" on public.events;
create policy "public can read events" on public.events for select using (true);

drop policy if exists "public can insert events" on public.events;
create policy "public can insert events" on public.events for insert with check (true);

drop policy if exists "public can update events" on public.events;
create policy "public can update events" on public.events for update using (true);

drop policy if exists "public can delete events" on public.events;
create policy "public can delete events" on public.events for delete using (true);

drop policy if exists "public can read votes" on public.event_votes;
create policy "public can read votes" on public.event_votes for select using (true);

drop policy if exists "public can insert votes" on public.event_votes;
create policy "public can insert votes" on public.event_votes for insert with check (true);

drop policy if exists "public can update votes" on public.event_votes;
create policy "public can update votes" on public.event_votes for update using (true);

drop policy if exists "public can delete votes" on public.event_votes;
create policy "public can delete votes" on public.event_votes for delete using (true);
