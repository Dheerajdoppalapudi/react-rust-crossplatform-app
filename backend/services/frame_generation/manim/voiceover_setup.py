"""
Speech-service boilerplate for manim-voiceover scenes.

Both the visualization-beat codegen prompt and the structural-beat templates emit
a `VoiceoverScene` whose narration audio is generated *during render* and embedded,
perfectly synced, in the output MP4. This module centralises the import + init
lines so the choice of TTS backend lives in one place (BEAT_TTS_BACKEND).

Why this matters: with manim-voiceover the animation timeline is derived FROM the
narration audio (`with self.voiceover(...) as tracker: self.play(..., run_time=tracker.duration)`),
so narration can never be cut off and animations are paced to the speech — there is
no separate TTS step, no duration guessing, and no audio/video mismatch to reconcile.

Render-time requirements (the manim subprocess inherits the parent env):
  - openai backend → OPENAI_API_KEY must be present (loaded from .env by core.config)
  - gtts backend   → no key, but needs network at render time
  - SoX is optional; without it manim-voiceover simply skips silence-trimming.
"""

from core.config import BEAT_TTS_BACKEND

# Voice/model are tuned for educational narration. tts-1-hd is the higher-quality
# OpenAI model; switch BEAT_TTS_BACKEND=gtts for a free (lower-quality) fallback.
_OPENAI_MODEL = "tts-1-hd"
_OPENAI_VOICE = "nova"


def _is_openai() -> bool:
    return BEAT_TTS_BACKEND == "openai"


def speech_service_import() -> str:
    if _is_openai():
        return "from manim_voiceover.services.openai import OpenAIService"
    return "from manim_voiceover.services.gtts import GTTSService"


def speech_service_init() -> str:
    if _is_openai():
        # transcription_model=None is CRITICAL: OpenAIService defaults it to "base",
        # which makes manim-voiceover try to load Whisper (the `transcribe` extra).
        # That extra isn't installed, so it falls back to an interactive install
        # prompt — and in the headless render subprocess `input()` hangs until the
        # render times out, silently failing every beat. We only need TTS, not
        # transcription (no <bookmark> features), so disable it outright.
        return (
            f'self.set_speech_service(OpenAIService('
            f'model="{_OPENAI_MODEL}", voice="{_OPENAI_VOICE}", transcription_model=None))'
        )
    return "self.set_speech_service(GTTSService())"


# Multi-line import block emitted at the top of every generated/templated scene.
VOICEOVER_IMPORTS: str = "from manim_voiceover import VoiceoverScene\n" + speech_service_import()

# The single line placed first inside construct() — before any self.voiceover() call.
SPEECH_SERVICE_INIT: str = speech_service_init()
