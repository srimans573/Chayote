import json
from datetime import datetime, timezone

from deepgram import DeepgramClient, PrerecordedOptions
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
import httpx
import os

from services.redis_client import get_redis

router = APIRouter(tags=["session"])

DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")


@router.post("/session/{session_id}/end")
async def end_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
):
    r = get_redis()

    raw = await r.get(f"session:{session_id}:meta")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")

    meta = json.loads(raw)
    meta["status"] = "processing"
    meta["ended_at"] = datetime.now(timezone.utc).isoformat()
    await r.set(f"session:{session_id}:meta", json.dumps(meta))

    audio_bytes = await audio.read()

    # Kick off batch pipeline in background so the response returns immediately
    background_tasks.add_task(run_batch_pipeline, session_id, audio_bytes, audio.content_type or "audio/webm")

    return {"status": "processing", "session_id": session_id}


async def run_batch_pipeline(session_id: str, audio_bytes: bytes, mimetype: str):
    r = get_redis()

    try:
        # Step 1 — Deepgram batch transcription
        deepgram = DeepgramClient(DEEPGRAM_API_KEY)
        response = await deepgram.listen.asyncrest.v("1").transcribe_file(
            {"buffer": audio_bytes, "mimetype": mimetype},
            PrerecordedOptions(
                model="nova-2",
                language="en-US",
                punctuate=True,
                utterances=True,
                smart_format=True,
            ),
        )

        # Store full transcript JSON for debugging / re-processing
        await r.set(
            f"session:{session_id}:transcript",
            response.to_json(),
        )

        # Extract utterances as [{text, start_ms, end_ms}]
        utterances = []
        if response.results and response.results.utterances:
            for u in response.results.utterances:
                utterances.append({
                    "text": u.transcript,
                    "start_ms": int(u.start * 1000),
                    "end_ms": int(u.end * 1000),
                    "type": "speech",
                })

        # Step 2 — merge + detect
        from services.pipeline import run_pipeline
        await run_pipeline(session_id, utterances, r)

        # Step 3 — generate HR insights + intent map
        from services.insight_extractor import extract_insights
        await extract_insights(session_id, r)

        # Step 4 — write score + session_id back to Supabase candidates row
        await _mark_candidate_complete(session_id, r)

    except Exception as e:
        # Mark session as failed so the HR dashboard can surface it
        raw = await r.get(f"session:{session_id}:meta")
        if raw:
            meta = json.loads(raw)
            meta["status"] = f"error: {str(e)}"
            await r.set(f"session:{session_id}:meta", json.dumps(meta))


async def _mark_candidate_complete(session_id: str, r):
    """Write score and session_id back to the Supabase candidates row.

    This triggers the sync_invite_completion DB trigger which flips the
    assessment_invites.status from 'started' to 'completed', making the
    candidate show as done on the recruiter dashboard sidebar.
    """
    from services.storage import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[completion] Supabase env vars not set — skipping candidate update.")
        return

    meta_raw = await r.get(f"session:{session_id}:meta")
    if not meta_raw:
        return
    meta = json.loads(meta_raw)
    candidate_id = meta.get("candidate_id", "")
    if not candidate_id:
        print(f"[completion] no candidate_id in session meta for {session_id}")
        return

    # Compute normalized score (0–4 avg) from rubric scores
    score = 0.0
    insights_raw = await r.get(f"session:{session_id}:insights")
    if insights_raw:
        insights = json.loads(insights_raw)
        rubric_scores = insights.get("rubric_scores", [])
        if rubric_scores:
            total = sum(item.get("score", 0) for item in rubric_scores)
            score = round(total / len(rubric_scores), 2)

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/candidates?id=eq.{candidate_id}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={
                    "score": score,
                    "session_id": session_id,
                    "last_activity_at": datetime.now(timezone.utc).isoformat(),
                },
                timeout=10,
            )
            if resp.status_code in (200, 204):
                print(f"[completion] updated candidate {candidate_id} score={score}")
            else:
                print(f"[completion] supabase update failed: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"[completion] supabase update error: {e}")
