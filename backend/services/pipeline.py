import json

import redis.asyncio as redis

from services.merger import build_timeline
from services.detector import detect_moments


async def run_pipeline(session_id: str, utterances: list[dict], r: redis.Redis):
    timeline = await build_timeline(session_id, utterances, r)

    await detect_moments(session_id, timeline, r)

    # Mark session complete
    raw = await r.get(f"session:{session_id}:meta")
    if raw:
        meta = json.loads(raw)
        meta["status"] = "complete"
        await r.set(f"session:{session_id}:meta", json.dumps(meta))
