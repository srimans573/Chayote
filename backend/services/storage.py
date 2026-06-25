import os

import httpx

BUCKET = "interview-recordings"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_warned = False
_bucket_ready = False


def _configured() -> bool:
    global _warned
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        return True
    if not _warned:
        print("[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — video recording disabled.")
        _warned = True
    return False


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }


# This project's plan caps storage objects at 50MB — asking for more makes
# the bucket create/update call itself fail with 413, so this just makes the
# existing plan limit explicit. Recordings are also bitrate-capped client-side
# so they should land well under this regardless.
BUCKET_FILE_SIZE_LIMIT = 52_428_800  # 50MB


async def ensure_bucket() -> None:
    global _bucket_ready
    if _bucket_ready or not _configured():
        return
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{SUPABASE_URL}/storage/v1/bucket",
                headers=_headers(),
                json={
                    "id": BUCKET,
                    "name": BUCKET,
                    "public": False,
                    "file_size_limit": BUCKET_FILE_SIZE_LIMIT,
                },
                timeout=10,
            )
            if resp.status_code == 409:
                # Bucket already exists from before this limit was added —
                # try to raise its limit too. Ignore failure either way.
                update_resp = await client.put(
                    f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET}",
                    headers=_headers(),
                    json={"id": BUCKET, "public": False, "file_size_limit": BUCKET_FILE_SIZE_LIMIT},
                    timeout=10,
                )
                if update_resp.status_code not in (200, 201):
                    print(f"[storage] bucket update failed: {update_resp.status_code} {update_resp.text}")
            elif resp.status_code not in (200, 201):
                print(f"[storage] bucket create failed: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"[storage] bucket create error: {e}")
    _bucket_ready = True


def _object_path(session_id: str, kind: str) -> str:
    # "camera" keeps the original path so existing recordings stay valid.
    return f"{session_id}.webm" if kind == "camera" else f"{session_id}-{kind}.webm"


async def upload_video(
    session_id: str, data: bytes, content_type: str, kind: str = "camera"
) -> bool:
    if not _configured():
        return False
    await ensure_bucket()
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{_object_path(session_id, kind)}",
                headers={
                    **_headers(),
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                content=data,
                timeout=120,
            )
            if resp.status_code not in (200, 201):
                print(f"[storage] upload failed: {resp.status_code} {resp.text}")
                return False
            return True
        except Exception as e:
            print(f"[storage] upload error: {e}")
            return False


async def get_signed_video_url(
    session_id: str, expires_in: int = 3600, kind: str = "camera"
) -> str | None:
    if not _configured():
        return None
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{_object_path(session_id, kind)}",
                headers=_headers(),
                json={"expiresIn": expires_in},
                timeout=10,
            )
            if resp.status_code != 200:
                print(f"[storage] sign url failed: {resp.status_code} {resp.text}")
                return None
            signed_path = resp.json().get("signedURL")
            if not signed_path:
                return None
            return f"{SUPABASE_URL}/storage/v1{signed_path}"
        except Exception as e:
            print(f"[storage] sign url error: {e}")
            return None
