do $$
begin
  create type public.assessment_status as enum (
    'draft',
    'live',
    'reviewing',
    'complete'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.candidate_stage as enum (
    'applied',
    'assessment',
    'interview',
    'offer'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.candidate_risk as enum (
    'low',
    'medium',
    'high'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  role_name text not null check (char_length(trim(role_name)) >= 2),
  status public.assessment_status not null default 'draft',
  due_at timestamptz,
  completion_percent integer not null default 0 check (
    completion_percent >= 0
    and completion_percent <= 100
  ),
  median_score integer check (
    median_score is null
    or (
      median_score >= 0
      and median_score <= 100
    )
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessments_organization_id_idx
on public.assessments (organization_id);

create index if not exists assessments_updated_at_idx
on public.assessments (updated_at desc);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  role_name text not null check (char_length(trim(role_name)) >= 2),
  stage public.candidate_stage not null default 'applied',
  score integer check (
    score is null
    or (
      score >= 0
      and score <= 100
    )
  ),
  risk public.candidate_risk not null default 'low',
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidates_organization_id_idx
on public.candidates (organization_id);

create index if not exists candidates_assessment_id_idx
on public.candidates (assessment_id);

create index if not exists candidates_updated_at_idx
on public.candidates (updated_at desc);

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
before update on public.assessments
for each row
execute function public.set_updated_at();

drop trigger if exists candidates_set_updated_at on public.candidates;
create trigger candidates_set_updated_at
before update on public.candidates
for each row
execute function public.set_updated_at();

alter table public.assessments enable row level security;
alter table public.candidates enable row level security;

revoke all on public.assessments from anon, authenticated;
revoke all on public.candidates from anon, authenticated;

grant select on public.assessments to authenticated;
grant select on public.candidates to authenticated;

drop policy if exists "Recruiters can read organization assessments" on public.assessments;
create policy "Recruiters can read organization assessments"
on public.assessments
for select
to authenticated
using (
  exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.organization_id = assessments.organization_id
      and recruiter_profiles.status = 'active'
  )
);

drop policy if exists "Recruiters can read organization candidates" on public.candidates;
create policy "Recruiters can read organization candidates"
on public.candidates
for select
to authenticated
using (
  exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.organization_id = candidates.organization_id
      and recruiter_profiles.status = 'active'
  )
);
