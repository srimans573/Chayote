import json

from fastapi import APIRouter, HTTPException

from services import storage
from services.redis_client import get_redis

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/sessions")
async def list_sessions():
    r = get_redis()
    session_ids = await r.lrange("sessions:all", 0, -1)

    sessions = []
    for sid in session_ids:
        raw = await r.get(f"session:{sid}:meta")
        if raw:
            sessions.append(json.loads(raw))

    return {"sessions": sessions}


@router.get("/session/{session_id}/transcript")
async def get_transcript(session_id: str):
    r = get_redis()

    if not await r.exists(f"session:{session_id}:meta"):
        raise HTTPException(status_code=404, detail="Session not found")

    raw = await r.lrange(f"session:{session_id}:conversation_history", 0, -1)
    transcript = [json.loads(item) for item in raw]

    return {"session_id": session_id, "transcript": transcript}


@router.get("/session/{session_id}/insights")
async def get_insights(session_id: str):
    r = get_redis()

    if not await r.exists(f"session:{session_id}:meta"):
        raise HTTPException(status_code=404, detail="Session not found")

    raw = await r.get(f"session:{session_id}:insights")
    if not raw:
        raise HTTPException(status_code=404, detail="Insights not ready yet")

    return {"session_id": session_id, "insights": json.loads(raw)}


@router.get("/session/{session_id}/video")
async def get_video(session_id: str):
    url = await storage.get_signed_video_url(session_id)
    return {"video_url": url}
