-- AI-Powered Interview Preparation System (PrepPilot) — Supabase Schema
-- Run this in the Supabase SQL editor on a fresh project, or use migrations.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Extends auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  target_role text,
  resume_text text,
  resume_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- ------------------------------------------------------------------------------
-- 2. PROGRAMMES TABLE (Structured training & placement preparation)
-- ------------------------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  domain text,
  category text,
  difficulty_level text not null default 'Intermediate' 
    check (difficulty_level in ('Foundational', 'Intermediate', 'Advanced', 'All Levels')),
  duration text default '8 Weeks',
  thumbnail_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_status_idx on public.programs (status);
create index if not exists programs_category_idx on public.programs (category);
create index if not exists programs_difficulty_idx on public.programs (difficulty_level);

-- ------------------------------------------------------------------------------
-- 3. LEARNING PATHS TABLE (Roadmaps belonging to a programme)
-- ------------------------------------------------------------------------------
create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null,
  description text,
  domain text,
  difficulty_level text not null default 'Intermediate' 
    check (difficulty_level in ('Foundational', 'Intermediate', 'Advanced', 'All Levels')),
  duration text default '4 Weeks',
  status text not null default 'active' check (status in ('active', 'inactive', 'draft')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_paths_program_id_idx on public.learning_paths (program_id);
create index if not exists learning_paths_status_idx on public.learning_paths (status);
create index if not exists learning_paths_display_order_idx on public.learning_paths (display_order);

-- ------------------------------------------------------------------------------
-- 4. LEARNING MODULES TABLE (Granular modules belonging to a learning path)
-- ------------------------------------------------------------------------------
create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths (id) on delete cascade,
  title text not null,
  description text,
  learning_objectives text[] default '{}',
  content text,
  resource_url text,
  estimated_duration text default '45 mins',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_modules_learning_path_id_idx on public.learning_modules (learning_path_id);
create index if not exists learning_modules_display_order_idx on public.learning_modules (display_order);

-- ------------------------------------------------------------------------------
-- 5. PROGRAM ENROLLMENTS TABLE (Candidate enrolled in a programme)
-- ------------------------------------------------------------------------------
create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  progress numeric(5,2) not null default 0.00,
  status text not null default 'enrolled' check (status in ('enrolled', 'in_progress', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  unique(user_id, program_id)
);

create index if not exists program_enrollments_user_id_idx on public.program_enrollments (user_id);
create index if not exists program_enrollments_program_id_idx on public.program_enrollments (program_id);

-- ------------------------------------------------------------------------------
-- 6. MODULE PROGRESS TABLE (Candidate progress per module)
-- ------------------------------------------------------------------------------
create table if not exists public.module_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.learning_modules (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completion_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, module_id)
);

create index if not exists module_progress_user_id_idx on public.module_progress (user_id);
create index if not exists module_progress_module_id_idx on public.module_progress (module_id);
create index if not exists module_progress_status_idx on public.module_progress (status);

-- ------------------------------------------------------------------------------
-- 7. SESSIONS TABLE (Mock interview sessions)
-- ------------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  domain text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  overall_score numeric(5,2),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

-- ------------------------------------------------------------------------------
-- 8. QUESTIONS & ANSWERS TABLES
-- ------------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  order_index int not null,
  prompt text not null,
  category text,
  created_at timestamptz not null default now()
);

create index if not exists questions_session_id_idx on public.questions (session_id);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  answer_text text not null,
  score numeric(5,2),
  strengths text[],
  weaknesses text[],
  feedback text,
  created_at timestamptz not null default now()
);

create index if not exists answers_session_id_idx on public.answers (session_id);

-- ------------------------------------------------------------------------------
-- 9. RESUME ANALYSIS & INTERVIEW REPORTS TABLES
-- ------------------------------------------------------------------------------
create table if not exists public.resume_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_name text not null,
  file_url text,
  parsed_text text not null,
  summary text,
  skills text[] default '{}',
  technologies text[] default '{}',
  projects jsonb default '[]'::jsonb,
  experience jsonb default '[]'::jsonb,
  certifications text[] default '{}',
  interview_topics text[] default '{}',
  potential_weaknesses text[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists resume_analysis_user_id_idx on public.resume_analysis (user_id);

create table if not exists public.interview_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  overall_score numeric(5,2) not null,
  technical_score numeric(5,2),
  communication_score numeric(5,2),
  depth_score numeric(5,2),
  resume_knowledge_score numeric(5,2),
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  recommended_topics text[] default '{}',
  summary_narrative text,
  created_at timestamptz not null default now()
);

create index if not exists interview_reports_session_id_idx on public.interview_reports (session_id);
create index if not exists interview_reports_user_id_idx on public.interview_reports (user_id);

-- ------------------------------------------------------------------------------
-- 10. ADMIN AUDIT LOGS & NOTIFICATIONS
-- ------------------------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'system' check (category in ('system', 'announcement', 'assessment', 'security')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_modules enable row level security;
alter table public.module_progress enable row level security;
alter table public.sessions enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.resume_analysis enable row level security;
alter table public.interview_reports enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_notifications enable row level security;

-- Profiles: Owner read/write, Admin read
create policy "profiles: owner read/write" on public.profiles
  for all using (auth.uid() = id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )) with check (auth.uid() = id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Programs: Public/Active read, Admin write
create policy "programs: read active" on public.programs
  for select using (status = 'active' or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "programs: admin write" on public.programs
  for all using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Learning Paths: Active read, Admin write
create policy "learning_paths: read active" on public.learning_paths
  for select using (status = 'active' or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "learning_paths: admin write" on public.learning_paths
  for all using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Learning Modules: Read if path active, Admin write
create policy "learning_modules: read active" on public.learning_modules
  for select using (exists (
    select 1 from public.learning_paths lp 
    where lp.id = learning_path_id 
      and (lp.status = 'active' or exists (
        select 1 from public.profiles where id = auth.uid() and role = 'admin'
      ))
  ));

create policy "learning_modules: admin write" on public.learning_modules
  for all using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Program Enrollments: Owner read/write, Admin oversight
create policy "program_enrollments: owner read/write" on public.program_enrollments
  for all using (user_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Module Progress: Owner read/write, Admin oversight
create policy "module_progress: student and admin access" on public.module_progress
  for all using (user_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )) with check (user_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Sessions & Assessment policies
create policy "sessions: owner read/write" on public.sessions
  for all using (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )) with check (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "questions: owner via session" on public.questions
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and (s.user_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )))
  ) with check (
    exists (select 1 from public.sessions s where s.id = session_id and (s.user_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )))
  );

create policy "answers: owner via session" on public.answers
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and (s.user_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )))
  ) with check (
    exists (select 1 from public.sessions s where s.id = session_id and (s.user_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )))
  );

-- Resume Analysis & Reports
create policy "resume_analysis: owner read/write" on public.resume_analysis
  for all using (user_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "interview_reports: owner read/write" on public.interview_reports
  for all using (user_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Admin system tables
create policy "admin_audit_logs: admin read" on public.admin_audit_logs
  for select using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "admin_notifications: admin read/write" on public.admin_notifications
  for all using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));
