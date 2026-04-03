"""
Pydantic schemas for the generation pipeline endpoints.

Hierarchy (Base → specialised):
  GenerationResponse        — common fields returned by /api/image_generation
  SVGGenerationResponse     — SVG / Manim paths (has `images`)
  ExcalidrawGenerationResponse — Mermaid / slim_json paths (has `excalidraw`)
"""

from typing import Any, Optional
from pydantic import BaseModel


class GenerationResponse(BaseModel):
    session_id:          str
    render_path:         str                    # "svg" | "manim" | "mermaid" | "slim_json"
    frame_count:         int
    intent_type:         str
    captions:            list[str]
    ui_file_type:        str                    # "images" | "json" | "python"
    suggested_followups: list[str]             = []
    notes:               str                   = ""
    conversation_id:     str
    turn_index:          int
    parent_session_id:   Optional[str]         = None
    parent_frame_index:  Optional[int]         = None


class SVGGenerationResponse(GenerationResponse):
    images: list[Optional[str]]               # list of absolute PNG paths (None if frame failed)


class ExcalidrawGenerationResponse(GenerationResponse):
    excalidraw:     dict[str, Any]
    elements_count: int
