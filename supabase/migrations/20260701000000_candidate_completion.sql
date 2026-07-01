-- Fix 1: Add session_id to candidates so the dashboard can look up Redis
-- sessions directly without fragile name matching.
alter table public.candidates
  add column if not exists session_id text;

-- Fix 2: Prevent invite-code reuse — reject codes whose invite is already
-- started or completed. Also wire the drop/recreate so this migration is
-- idempotent if re-run.

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
  invite_status         text;
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
    -- Reject codes that have already been used
    select status into invite_status
      from public.assessment_invites where id = matched_invite_id;
    if invite_status in ('started', 'completed') then
      raise exception 'This invite link has already been used.';
    end if;

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
