do $$
begin
  create type public.assessment_technology as enum (
    'react_javascript',
    'python'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.generate_candidate_access_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

alter table public.assessment_codebase_templates
add column if not exists technologies public.assessment_technology[] not null
default array['react_javascript', 'python']::public.assessment_technology[];

alter table public.assessments
add column if not exists technologies public.assessment_technology[] not null
default array['react_javascript', 'python']::public.assessment_technology[];

alter table public.assessments
add column if not exists candidate_access_code text;

update public.assessments
set candidate_access_code = public.generate_candidate_access_code()
where candidate_access_code is null;

alter table public.assessments
alter column candidate_access_code set default public.generate_candidate_access_code();

alter table public.assessments
alter column candidate_access_code set not null;

create unique index if not exists assessments_candidate_access_code_key
on public.assessments (candidate_access_code);

alter table public.assessments
drop constraint if exists assessments_time_limit_minutes_check;

alter table public.assessments
add constraint assessments_time_limit_minutes_check
check (
  time_limit_minutes >= 20
  and time_limit_minutes <= 60
);

update public.assessment_codebase_templates
set technologies = array['react_javascript', 'python']::public.assessment_technology[]
where slug = 'employee-directory-dashboard';
