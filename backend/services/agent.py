import json
import logging
import os
import random
import time

import redis.asyncio as redis
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# File logger — tail -f backend/agent_debug.log while testing
_log_path = os.path.join(os.path.dirname(__file__), "..", "agent_debug.log")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(_log_path, mode="a", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("agent")

UNCLEAR_RESPONSES = [
    "Sorry, I didn't quite catch that — could you say that again?",
    "I'm not sure I followed. What were you thinking about there?",
    "Can you walk me through that again? I lost the thread.",
]

SHARED_SYSTEM = """You are a senior software engineer conducting a technical interview.
You are sitting next to the candidate as they code — not hosting a show, not teaching a class.

Rules:
- 1-2 sentences. Never more than 3.
- Never use: "Great!", "Excellent!", "That's a good point", "Interesting!", or any filler affirmation.
- Never lecture. Never give the answer directly.
- Vary your phrasing every response — do not repeat the same sentence structure twice.
- If you have nothing useful to add, respond with exactly: NONE"""


# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------

async def log_agent_turn(session_id: str, r: redis.Redis, text: str):
    entry = {"role": "agent", "text": text, "ts": int(time.time() * 1000)}
    await r.rpush(f"session:{session_id}:conversation_history", json.dumps(entry))


async def log_candidate_turn(session_id: str, r: redis.Redis, text: str, intent: str):
    entry = {"role": "candidate", "text": text, "intent": intent, "ts": int(time.time() * 1000)}
    await r.rpush(f"session:{session_id}:conversation_history", json.dumps(entry))


async def get_conversation_history(session_id: str, r: redis.Redis, n: int = 8) -> list[dict]:
    raw = await r.lrange(f"session:{session_id}:conversation_history", -n, -1)
    return [json.loads(item) for item in raw]


def _format_history(history: list[dict]) -> str:
    lines = []
    for turn in history:
        speaker = "Interviewer" if turn["role"] == "agent" else "Candidate"
        lines.append(f"{speaker}: {turn['text']}")
    return "\n".join(lines) if lines else "(no prior conversation)"


def _last_agent_turn(history: list[dict]) -> str | None:
    for turn in reversed(history):
        if turn["role"] == "agent":
            return turn["text"]
    return None


# ---------------------------------------------------------------------------
# Stage helpers (unchanged)
# ---------------------------------------------------------------------------

async def get_stage(session_id: str, r: redis.Redis) -> int:
    val = await r.get(f"session:{session_id}:current_stage")
    return int(val) if val else 0


async def advance_stage(session_id: str, r: redis.Redis):
    await r.incr(f"session:{session_id}:current_stage")


# ---------------------------------------------------------------------------
# Intent classifier
# ---------------------------------------------------------------------------

async def classify_intent(utterance: str, last_agent: str | None, history: list[dict]) -> str:
    history_snippet = _format_history(history[-3:]) if history else "(no prior conversation)"
    last_agent_line = f'Interviewer just said: "{last_agent}"' if last_agent else "No prior interviewer turn."

    system = """You classify what a coding interview candidate just said into exactly one of these intents:

question   — candidate asked the interviewer something directly
answer     — candidate is responding to the interviewer's last question
claim      — candidate made a technical assertion about their code or approach
stuck      — candidate expressed confusion, being lost, or asked for a hint
decision   — candidate announced a direction or choice ("I'll use X", "I'm going to try Y")
filler     — utterance is pure filler with no semantic content ("um", "uh", "like", "yeah so")
unclear    — utterance is incoherent, too fragmented to classify, or semantically empty
off_topic  — clearly unrelated to the interview (personal remarks, ambient noise, non-technical chatter)

Instructions:
- First mentally strip filler words ("um", "like", "you know", "so yeah") and identify the semantic core.
- If the semantic core is empty after stripping, return: filler
- Use the interviewer's last turn to determine if the candidate is answering a question.
- Return ONLY the single intent word. No explanation, no punctuation.

Examples:
Candidate: "um yeah so" → filler
Candidate: "should I use BFS or DFS here?" → question
Candidate: "I think this is O(n log n)" → claim
Candidate: "wait I'm totally lost on this" → stuck
Candidate: "I'll go with a hash map" → decision
Candidate: "yeah so like the recursion handles the base case" [after interviewer asked about base case] → answer
Candidate: "my phone just buzzed sorry" → off_topic
Candidate: "uh I mean the thing with the... yeah" → unclear"""

    user = f"""{last_agent_line}

Recent conversation:
{history_snippet}

Candidate just said: "{utterance}"

Intent:"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=10,
        temperature=0.1,
    )
    result = response.choices[0].message.content.strip().lower()
    valid = {"question", "answer", "claim", "stuck", "decision", "filler", "unclear", "off_topic"}
    return result if result in valid else "unclear"


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def maybe_respond(session_id: str, r: redis.Redis) -> str | None:
    raw_chunks = await r.lrange(f"session:{session_id}:transcript_chunks", -1, -1)
    if not raw_chunks:
        return None
    utterance = json.loads(raw_chunks[0])["text"].strip()
    if not utterance:
        return None

    history = await get_conversation_history(session_id, r)
    last_agent = _last_agent_turn(history)

    intent = await classify_intent(utterance, last_agent, history)
    log.info(f"[classifier] {utterance!r} → {intent}")

    await log_candidate_turn(session_id, r, utterance, intent)

    if intent == "filler":
        return None

    if intent == "unclear":
        return random.choice(UNCLEAR_RESPONSES)

    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return None
    meta = json.loads(meta_raw)

    code_raw = await r.get(f"session:{session_id}:latest_code")
    code = code_raw or "(no code written yet)"
    stage = await get_stage(session_id, r)
    guidelines = meta.get("question_guidelines", "")
    history_text = _format_history(history)

    if intent == "answer":
        response = await _validate_and_followup(meta, code, utterance, last_agent, history_text, stage, guidelines)
    elif intent == "claim":
        response = await _validate_claim(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "question":
        response = await _answer_candidate_question(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "stuck":
        response = await _guide_response(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "decision":
        response = await _affirm_decision(meta, code, utterance, history_text, stage, guidelines)
    elif intent == "off_topic":
        response = await _redirect_offtopic(meta, last_agent)
    else:
        return None

    log.info(f"[agent] response: {response!r}")

    if not response or "NONE" in response.upper():
        return None

    await log_agent_turn(session_id, r, response)

    event = {
        "type": "agent_response",
        "t_start": time.time(),
        "t_end": time.time(),
        "quote": utterance[-200:],
        "label": response,
        "trigger": intent,
        "stage": stage,
    }
    await r.rpush(f"session:{session_id}:events", json.dumps(event))

    return response


# ---------------------------------------------------------------------------
# Response handlers
# ---------------------------------------------------------------------------

async def _validate_and_followup(
    meta: dict, code: str, utterance: str, last_agent: str | None,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Your last question: "{last_agent or '(none)'}"
Candidate just answered: "{utterance}"
Current rubric stage: {stage}

The candidate answered your last question. Do two things in 2-3 sentences:
1. Briefly affirm if correct, or point at the specific thing to reconsider if wrong — never say "that's wrong" outright.
2. Ask the next natural question from the rubric.

These show the correct length and register ONLY — vary your phrasing, do not copy these:
- "Right, because the recursion hits every node once. What about space complexity?"
- "Not quite — think about what happens when the input's already sorted. What changes?"
- "Yep. Now walk me through what happens at the boundary condition." """

    return await _call_openai(SHARED_SYSTEM, user)


async def _validate_claim(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate just claimed: "{utterance}"
Current rubric stage: {stage}

The candidate made a technical assertion. Confirm or correct it in 1-2 sentences.
If correct, you may probe depth with a follow-up question.
If wrong, point at the specific thing to reconsider — don't say it's wrong outright.

Style illustrations ONLY — vary your phrasing, do not copy these:
- "Yeah, that holds for the average case. What about worst case?"
- "Take another look at the loop bounds — what's the actual iteration count?"
- "That's right. Does that change if the input has duplicates?" """

    return await _call_openai(SHARED_SYSTEM, user)


async def _answer_candidate_question(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate asked: "{utterance}"
Current rubric stage: {stage}

Answer directly and practically in 1-2 sentences.
If answering would give away the solution, redirect instead with something like "What do you think?" or "Try it and see what happens."
Don't over-explain."""

    return await _call_openai(SHARED_SYSTEM, user)


async def _guide_response(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate is stuck: "{utterance}"
Current rubric stage: {stage}

Give them ONE brief nudge — 1-2 sentences. Point at something concrete in the code or problem without giving the answer away.

Style illustrations ONLY — vary your phrasing, do not copy these:
- "Look at what happens in the loop when the list is empty."
- "Think about what data structure would let you look that up in O(1)." """

    return await _call_openai(SHARED_SYSTEM, user)


async def _affirm_decision(
    meta: dict, code: str, utterance: str,
    history: str, stage: int, guidelines: str
) -> str:
    user = f"""Interview rubric:
{guidelines or "(no rubric provided)"}

Candidate's current code:
{code}

Conversation so far:
{history}

Candidate announced a decision: "{utterance}"
Current rubric stage: {stage}

Acknowledge their decision briefly, then probe a tradeoff or edge case from the rubric. 1-2 sentences. Don't just say "sounds good" — push on something specific.

Style illustrations ONLY — vary your phrasing, do not copy these:
- "Go for it. What's the memory cost of that approach?"
- "That works. How does that hold up if the input has duplicates?" """

    return await _call_openai(SHARED_SYSTEM, user)


async def _redirect_offtopic(meta: dict, last_agent: str | None) -> str:
    last_line = f'You had just asked: "{last_agent}"' if last_agent else "There was no prior question."
    user = f"""The candidate said something unrelated to the interview.
{last_line}

Redirect them back to the problem in 1 sentence. If you had just asked a question, gently repeat or rephrase it."""

    return await _call_openai(SHARED_SYSTEM, user)


# ---------------------------------------------------------------------------
# OpenAI call
# ---------------------------------------------------------------------------

async def _call_openai(system: str, user: str) -> str:
    log.debug("[openai] calling gpt-4o-mini")
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=120,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()
