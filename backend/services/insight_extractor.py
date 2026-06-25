import json
import time

import redis.asyncio as redis
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


async def extract_insights(session_id: str, r: redis.Redis):
    """
    Runs after the pipeline completes. Reads all session data from Redis,
    makes one LLM call to generate structured insights + an intent map,
    and stores the result at session:{id}:insights.
    """
    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return
    meta = json.loads(meta_raw)

    history_raw = await r.lrange(f"session:{session_id}:conversation_history", 0, -1)
    history = [json.loads(h) for h in history_raw]

    events_raw = await r.lrange(f"session:{session_id}:events", 0, -1)
    events = [json.loads(e) for e in events_raw]

    stage_val = await r.get(f"session:{session_id}:current_stage")
    final_stage = int(stage_val) if stage_val else 0

    code_raw = await r.get(f"session:{session_id}:latest_code")
    final_code = code_raw or "(no code written)"

    challenge_grade_raw = await r.get(f"session:{session_id}:challenge_grade")
    challenge_grade = json.loads(challenge_grade_raw) if challenge_grade_raw else None

    stuck_count = sum(1 for e in events if e.get("type") == "stuck")
    hint_count = sum(1 for e in events if e.get("type") == "hint_request")

    conversation_text = "\n".join(
        f"{'Interviewer' if t['role'] == 'agent' else 'Candidate'}: {t['text']}"
        for t in history
    )

    rubric = meta.get("question_guidelines", "").strip()
    has_rubric = bool(rubric)
    rubric_section = rubric if has_rubric else "(no rubric was configured for this assessment)"
    problem = meta.get("problem_title", "Unknown problem")
    candidate = meta.get("candidate_name", "Candidate")

    challenge_section = ""
    if challenge_grade:
        challenge_section = f"""

Mid-interview coding challenge: {challenge_grade.get("title", "Coding challenge")}
- LLM-graded score (0-4): {challenge_grade.get("score")}
- Correct: {challenge_grade.get("correct")}
- Estimated time complexity: {challenge_grade.get("time_complexity")}
- Grading notes: {challenge_grade.get("feedback")}"""

    prompt = f"""You are analyzing a technical coding interview for HR. Produce a structured JSON assessment.

Ground every claim in this report — including the summary, strengths, and gaps, not just rubric_scores — in
something that actually appears in "Full conversation" below. If the candidate barely spoke or the conversation
is mostly the interviewer talking, say so plainly (e.g. "the candidate did not engage with the codebase discussion
before ending the session") rather than inferring a plausible-sounding performance from the task description or
codebase alone.

Candidate: {candidate}
Problem: {problem}

Rubric:
{rubric_section}

Final code:
{final_code}

Full conversation:
{conversation_text or "(no conversation recorded)"}

Session stats:
- Times stuck: {stuck_count}
- Hints requested: {hint_count}
- Rubric stages reached: {final_stage}{challenge_section}

Return a JSON object with exactly these fields:
{{
  "summary": "4-6 sentence narrative for HR covering technical depth, communication clarity, and problem-solving approach as distinct angles",
  "strengths": ["short phrase", ...],
  "gaps": ["short phrase", ...],
  "advance_recommend": true or false,
  "advance_reason": "one sentence explaining the recommendation",
  "rubric_scores": [
    {{
      "question": "short question title matching the rubric heading, e.g. Q1: API Layer",
      "score": <integer 0-4, where 0 = not reached/no evidence, 1 = far below expectations, 2 = partial understanding, 3 = meets expectations (equivalent to old "pass"), 4 = exceeds expectations with exceptional depth/clarity>,
      "reason": "1-3 sentences citing specific evidence or direct quotes from the conversation that justify this score"
    }},
    ...
  ],
  "intent_map": [
    {{
      "ts_ms": <timestamp in ms from conversation history, use 0 if unknown>,
      "actor": "candidate" or "agent",
      "category": one of "explaining"|"stuck"|"decision"|"question"|"answer"|"coding"|"correction",
      "label": "short past-tense description of what happened, max 8 words",
      "quote": "exact words said"
    }},
    ...
  ]
}}

For rubric_scores: {(
        "score every question in the rubric on the 0-4 scale, mapping the rubric's Pass/Partial/Fail criteria onto it "
        "(Pass ≈ 3-4, Partial ≈ 2, Fail ≈ 0-1). Use ONLY the questions explicitly listed in the Rubric section above — "
        "never invent additional questions from the README, the code, or the candidate task description, even if they "
        "suggest plausible categories. Every score above 0 must be justified by something the CANDIDATE actually said "
        "in the conversation above — not by what a good candidate would likely have said, and not by inference from the "
        "codebase or task description alone. If a rubric question was never reached or the candidate never addressed "
        "it, score it 0 with reason \"not reached in session\"."
    ) if has_rubric else (
        "this assessment has no rubric configured (see the Rubric section above), so you MUST return an empty array "
        "for rubric_scores. Do not invent rubric questions from the README, the code, or the candidate task "
        "description — there is no rubric to score against."
    )}
Do NOT include the mid-interview coding challenge in rubric_scores — it is scored separately and will be appended automatically.
For intent_map: include every meaningful candidate turn and key agent turns. Skip pure filler. Labels must be concise past-tense phrases like "explained the filter logic" or "got stuck on edge case". Do not copy these examples directly."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        insights = json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"[insights] LLM call failed: {e}")
        insights = {
            "summary": "Insight extraction failed.",
            "strengths": [],
            "gaps": [],
            "advance_recommend": False,
            "advance_reason": "Could not generate insights.",
            "rubric_scores": [],
            "intent_map": [],
        }

    if not has_rubric:
        # Hard guard, independent of whether the model followed instructions:
        # with no real rubric, any rubric_scores would necessarily be invented.
        insights["rubric_scores"] = []

    if challenge_grade:
        insights.setdefault("rubric_scores", []).append(
            {
                "question": f"Coding challenge: {challenge_grade.get('title', 'Untitled')}",
                "score": challenge_grade.get("score", 0),
                "reason": challenge_grade.get("feedback", "No grading notes available."),
            }
        )

    insights["stuck_count"] = stuck_count
    insights["hint_count"] = hint_count
    insights["final_stage"] = final_stage
    insights["generated_at"] = int(time.time() * 1000)

    await r.set(f"session:{session_id}:insights", json.dumps(insights))
    print(f"[insights] stored for session {session_id}")
