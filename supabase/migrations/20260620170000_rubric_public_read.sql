alter table public.assessment_rubric_templates disable row level security;
grant select on public.assessment_rubric_templates to anon, authenticated;
