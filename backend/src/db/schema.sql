create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  gmail_thread_id text not null,
  subject text not null,
  content_hash text,
  last_synced_at timestamptz not null default now()
);

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references threads(id) on delete cascade,
  summary text not null,
  priority_level text not null,
  priority_score integer not null,
  priority_reasons jsonb not null default '[]'::jsonb
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references threads(id) on delete cascade,
  description text not null,
  deadline timestamptz,
  status text not null default 'pending',
  calendar_event_id text
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references threads(id) on delete cascade,
  body text not null,
  tone text not null,
  status text not null default 'draft'
);

create table if not exists conflicts (
  id uuid primary key default gen_random_uuid(),
  task_id_a uuid references tasks(id) on delete cascade,
  task_id_b uuid references tasks(id) on delete cascade,
  reason text not null,
  resolved boolean not null default false
);