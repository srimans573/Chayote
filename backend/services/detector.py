import json
import os
import time

import redis.asyncio as redis
from openai import AsyncOpenAI

try:
    from thetokencompany.openai import with_compression
except ImportError:  # SDK optional — fall back to a plain client
    with_compression = None

_openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_ttc_key = os.environ.get("TTC_API_KEY", "")

# Auto-compress prompts via The Token Company when TTC_API_KEY is configured.
client = (
    with_compression(_openai_client, compression_api_key=_ttc_key)
    if _ttc_key and with_compression
    else _openai_client
)

# Moment type phrase lists
STUCK_PHRASES = ["i'm stuck", "im stuck", "i don't know", "i dont know", "not sure how", "don't know how", "no idea how"]
HINT_PHRASES = ["can i get a hint", "give me a hint", "is this the right direction", "what should i look at", "am i on the right track"]
DECISION_PHRASES = ["i'll go with", "i'll use", "i'm going to use", "i'm choosing", "i'll choose"]

# Self-correction cue words (type 3)
CORRECTION_CUES = ["wait", "actually", "oh wait", "no wait", "hmm", "oh", "never mind"]


def _first_match(text: str, phrases: list[str]) -> str | None:
    lower = text.lower()
    return next((p for p in phrases if p in lower), None)


async def detect_moments(session_id: str, timeline: list[dict], r: redis.Redis):
    """Scan the merged timeline and write detected moment events to Redis."""

    speech_events = [e for e in timeline if e["type"] == "speech"]

    for i, event in enumerate(speech_events):
        text = event["text"]
        lower = text.lower()

        # Type 1 — Stuck statement (phrase match only)
        if _first_match(text, STUCK_PHRASES):
            await _store_event(session_id, r, {
                "type": "stuck",
                "t_start": event["start_ms"] / 1000,
                "t_end": event["end_ms"] / 1000,
                "quote": text,
                "label": "Candidate expressed being stuck.",
            })

        # Type 2 — Hint request (phrase match only)
        elif _first_match(text, HINT_PHRASES):
            await _store_event(session_id, r, {
                "type": "hint_request",
                "t_start": event["start_ms"] / 1000,
                "t_end": event["end_ms"] / 1000,
                "quote": text,
                "label": "Candidate requested a hint.",
            })

        # Type 5 — Decision statement (phrase match only)
        elif _first_match(text, DECISION_PHRASES):
            await _store_event(session_id, r, {
                "type": "decision",
                "t_start": event["start_ms"] / 1000,
                "t_end": event["end_ms"] / 1000,
                "quote": text,
                "label": "Candidate stated a decision.",
            })

        # Type 3 — Self-correction: cue phrase + code change follows
        elif _first_match(text, CORRECTION_CUES):
            # Find the next code event after this speech event
            next_code = next(
                (e for e in timeline if e["type"] == "code" and e["start_ms"] > event["start_ms"]),
                None,
            )
            if next_code:
                label = await _label_self_correction(text, next_code["text"])
                await _store_event(session_id, r, {
                    "type": "self_correction",
                    "t_start": event["start_ms"] / 1000,
                    "t_end": next_code["end_ms"] / 1000,
                    "quote": text,
                    "label": label,
                })


async def _label_self_correction(speech: str, code_after: str) -> str:
    prompt = (
        f'During a coding interview the candidate said: "{speech}"\n'
        f"Then they changed their code to:\n{code_after}\n\n"
        f"In one sentence, what did they notice and fix? Quote a key phrase from what they said."
    )
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=80,
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


async def _store_event(session_id: str, r: redis.Redis, event: dict):
    await r.rpush(f"session:{session_id}:events", json.dumps(event))
