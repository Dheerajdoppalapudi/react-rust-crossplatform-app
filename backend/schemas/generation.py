"""
Pydantic schemas for the generation pipeline endpoints.

Hierarchy (Base → specialised):
  GenerationResponse            — common fields returned by /api/image_generation
  SVGGenerationResponse         — SVG / Manim paths (has `images`)
  InteractiveGenerationResponse — Interactive mode (has `scene_ir`)
"""

from typing import Literal, Optional
from pydantic import BaseModel


class GenerationResponse(BaseModel):
    session_id:          str
    render_path:         str                    # "svg" | "manim"
    frame_count:         int
    intent_type:         str
    captions:            list[str]
    ui_file_type:        str                    # "images" | "python"
    suggested_followups: list[str]             = []
    notes:               str                   = ""
    conversation_id:     str
    turn_index:          int
    parent_session_id:   Optional[str]         = None
    parent_frame_index:  Optional[int]         = None


class SVGGenerationResponse(GenerationResponse):
    images: list[Optional[str]]               # list of PNG or MP4 paths (None if frame failed)


class InteractiveGenerationResponse(BaseModel):
    """Returned in the SSE `done` event for interactive mode sessions."""
    session_id:      str
    render_path:     Literal["interactive"] = "interactive"
    conversation_id: str
    turn_index:      int
    domain:          str
    title:           str
