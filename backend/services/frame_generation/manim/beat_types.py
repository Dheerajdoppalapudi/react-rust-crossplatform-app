"""
Beat pipeline data structures.

A BeatScript is the output of plan_beats() — the Sonnet planner call.
It replaces GenerationPlan for math intent in the new pipeline.

Each BeatPlan has a rich `description` field written by the Sonnet planner:
  a shot-by-shot animation script using semantic layout + math values.
  No screen coordinates — the code-gen LLM resolves those using Manim's
  relative positioning API (next_to, to_edge, VGroup.arrange, axes.c2p).
"""

from typing import Literal, Optional

from pydantic import BaseModel, field_validator

# Template sub-types the planner sometimes writes directly into beat_class by mistake.
_STRUCTURAL_ALIASES = frozenset({"concept_reveal", "comparison_split"})


class BeatPlan(BaseModel):
    index: int
    beat_class: Literal["structural", "visualization"]

    @field_validator("beat_class", mode="before")
    @classmethod
    def coerce_beat_class(cls, v: str) -> str:
        if v in _STRUCTURAL_ALIASES:
            return "structural"
        return v
    # Only set when beat_class == "structural":
    template_type: str = ""   # "concept_reveal" | "comparison_split"
    title: str                # 2-4 words shown in the loading label
    duration_s: int = 8       # target scene length in seconds (6-12)

    # THE KEY FIELD — used by both beat classes:
    # Structural: brief prose description (planner fills content{} for template)
    # Visualization: 150-300 word shot-by-shot animation script,
    #                semantic layout + math values, NO screen coordinates
    description: str

    # Structural beats carry structured content for template slot-filling:
    content: dict = {}        # {heading, bullets[], accent_color} or
                              # {left_title, right_title, left_points[], right_points[], conclusion}

    keywords: list[str] = []  # 2-4 key terms that appear on screen at end of beat
    narration: str = ""       # 2-3 sentences for WebVTT captions


class BeatScript(BaseModel):
    topic: str
    beat_count: int            # planner decides: 4-12 based on topic complexity
    beats: list[BeatPlan]      # len(beats) == beat_count
    suggested_followups: list[str] = []
    notes: list[str] = []


class BeatResult(BaseModel):
    beat_index: int
    mp4_path: Optional[str] = None   # None if render failed
    caption: str                     # = beat.title
    keywords: list[str] = []
    narration: str = ""
    duration_s: int = 8
    render_method: str = "codegen"   # "template" | "codegen" | "cached"
    cache_hit: bool = False
