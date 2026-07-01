-- Per-candidate invite system.
-- Replaces the shared per-assessment candidate_access_code with individual
-- invite codes tracked per email address, enabling status tracking and
-- per-candidate email sending.

-- 1. Invite table
create table if not exists public.assessment_invites (
  id              uuid        primary key default gen_random_uuid(),
  assessment_id   uuid        not null references public.assessments(id) on delete cascade,
  email           text        not null,
  name            text,
  invite_code     text        not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  status          text        not null default 'pending'
    check (status in ('pending', 'started', 'completed')),
  candidate_id    uuid        references public.candidates(id),
  invited_at      timestamptz not null default now(),
  email_sent_at   timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  reminder_sent_at timestamptz
);

create index if not exists assessment_invites_code_idx
  on public.assessment_invites (upper(invite_code));
create index if not exists assessment_invites_assessment_idx
  on public.assessment_invites (assessment_id);

alter table public.assessment_invites enable row level security;

drop policy if exists "Recruiters manage invites for their org assessments" on public.assessment_invites;
create policy "Recruiters manage invites for their org assessments"
on public.assessment_invites
for all
to authenticated
using (
  exists (
    select 1
    from public.assessments a
    join public.recruiter_profiles rp
      on rp.id = auth.uid()
     and rp.organization_id = a.organization_id
     and rp.status = 'active'
    where a.id = assessment_invites.assessment_id
  )
);

grant insert, select, update, delete on public.assessment_invites to authenticated;

-- 2. Link candidates back to their invite
alter table public.candidates
  add column if not exists invite_id uuid references public.assessment_invites(id);

-- 3. Mark invite completed when the candidate gets a score
create or replace function public.sync_invite_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.score is not null and (old.score is null) and new.invite_id is not null then
    update public.assessment_invites
    set status = 'completed', completed_at = now()
    where id = new.invite_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_invite_completion on public.candidates;
create trigger trg_sync_invite_completion
  after update on public.candidates
  for each row execute function public.sync_invite_completion();

-- 4. Updated RPC: try invite code first, fall back to legacy assessment code
drop function if exists public.register_candidate_for_assessment(text, text);

create function public.register_candidate_for_assessment(
  p_access_code text,
  p_full_name   text
)
returns table (
  candidate_id      uuid,
  assessment_id     uuid,
  assessment_title  text,
  candidate_name    text,
  time_limit_minutes integer,
  expires_at        timestamptz,
  technologies      public.assessment_technology[],
  code_files        jsonb,
  rubric_text       text,
  rubric_topics     jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_assessment    public.assessments%rowtype;
  matched_invite_id     uuid := null;
  new_candidate_id      uuid;
  normalized_code       text;
  normalized_name       text;
  resolved_rubric_text  text;
begin
  normalized_code := upper(
    regexp_replace(trim(coalesce(p_access_code, '')), '[[:space:]]+', '', 'g')
  );
  normalized_name := trim(coalesce(p_full_name, ''));

  if char_length(normalized_code) < 4 then
    raise exception 'Enter a valid assessment code.';
  end if;

  if char_length(normalized_name) < 2 then
    raise exception 'Enter your full name.';
  end if;

  -- Try invite code first
  select ai.id
  into matched_invite_id
  from public.assessment_invites ai
  where upper(ai.invite_code) = normalized_code
  limit 1;

  if matched_invite_id is not null then
    select a.*
    into matched_assessment
    from public.assessments a
    join public.assessment_invites ai on ai.id = matched_invite_id
    where a.id = ai.assessment_id
      and (a.due_at is null or a.due_at >= now())
    limit 1;

    if matched_assessment.id is null then
      raise exception 'That assessment code is invalid or expired.';
    end if;
  else
    -- Fall back to legacy assessment-level access code
    select *
    into matched_assessment
    from public.assessments
    where upper(candidate_access_code) = normalized_code
      and (due_at is null or due_at >= now())
    limit 1;

    if matched_assessment.id is null then
      raise exception 'That assessment code is invalid or expired.';
    end if;
  end if;

  insert into public.candidates (
    organization_id,
    assessment_id,
    full_name,
    role_name,
    stage,
    risk,
    last_activity_at,
    invite_id
  )
  values (
    matched_assessment.organization_id,
    matched_assessment.id,
    normalized_name,
    matched_assessment.role_name,
    'assessment',
    'low',
    now(),
    matched_invite_id
  )
  returning id into new_candidate_id;

  if matched_invite_id is not null then
    update public.assessment_invites
    set
      status       = 'started',
      started_at   = now(),
      candidate_id = new_candidate_id
    where id = matched_invite_id;
  end if;

  candidate_id       := new_candidate_id;
  assessment_id      := matched_assessment.id;
  assessment_title   := matched_assessment.title;
  candidate_name     := normalized_name;
  time_limit_minutes := matched_assessment.time_limit_minutes;
  expires_at := least(
    now() + (matched_assessment.time_limit_minutes || ' minutes')::interval,
    coalesce(matched_assessment.due_at, 'infinity'::timestamptz)
  );
  technologies := matched_assessment.technologies;

  if matched_assessment.rubric_text <> '' then
    resolved_rubric_text := matched_assessment.rubric_text;
  else
    select art.content
    into resolved_rubric_text
    from public.assessment_rubric_templates art
    where art.codebase_template_id = matched_assessment.codebase_template_id
    limit 1;
  end if;
  rubric_text   := coalesce(resolved_rubric_text, '');
  rubric_topics := coalesce(matched_assessment.rubric_topics, '[]'::jsonb);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'path',      assessment_codebase_files.path,
        'language',  assessment_codebase_files.language,
        'content',   assessment_codebase_files.content,
        'lineCount', array_length(
          string_to_array(assessment_codebase_files.content, E'\n'), 1
        )
      )
      order by assessment_codebase_files.sort_order asc
    ),
    '[]'::jsonb
  )
  into code_files
  from public.assessment_codebase_files
  where assessment_codebase_files.codebase_template_id = matched_assessment.codebase_template_id;

  return next;
end;
$$;

revoke all on function public.register_candidate_for_assessment(text, text) from public;
grant execute on function public.register_candidate_for_assessment(text, text) to anon, authenticated;
