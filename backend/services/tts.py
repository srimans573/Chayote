import base64
import os

import httpx

DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"
TTS_MODEL = "aura-orion-en"  # male senior-engineer voice


async def synthesize(text: str) -> str | None:
    """Returns base64-encoded MP3 audio, or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                DEEPGRAM_TTS_URL,
                params={"model": TTS_MODEL},
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"text": text},
            )
            response.raise_for_status()
            return base64.b64encode(response.content).decode("utf-8")
    except Exception as e:
        print(f"[tts] error: {e}")
        return None
