"""
Scene IR — Pydantic models for the Interactive Mode intermediate representation.

A SceneIR is a sequence of blocks, alternating between text and entity blocks.
This allows explanation text and interactive widgets to interleave naturally
(intro text → diagram → explanation of diagram → code → etc.).

Adding a new entity type:
  1. Add its component to the frontend registry (registry.js)
  2. Add its prop schema to component_catalog.md
  3. Add one entry to the `required` dict in SceneBlock.validate_block
  No other backend changes needed.
"""

from pydantic import BaseModel, model_validator
from typing import Literal, Optional


class SceneBlock(BaseModel):
    id: str
    type: Literal["text", "entity"]

    # text blocks
    content: Optional[str] = None

    # entity blocks
    entity_type: Optional[str] = None
    props: dict = {}
    html: Optional[str] = None   # filled by codegen for freeform_html only

    @model_validator(mode="before")
    @classmethod
    def normalize_type(cls, data: dict) -> dict:
        # LLMs sometimes output the entity type name directly as the `type` field
        # (e.g. "type": "mermaid_viewer") instead of "type": "entity" + "entity_type": "mermaid_viewer".
        # Normalize silently so the rest of validation can proceed normally.
        if isinstance(data, dict):
            t = data.get("type", "")
            if t not in ("text", "entity"):
                data = dict(data)
                data["entity_type"] = t
                data["type"] = "entity"
        return data

    @model_validator(mode="after")
    def validate_block(self):
        if self.type == "text":
            if not self.content:
                raise ValueError("text block missing content")
        elif self.type == "entity":
            required: dict[str, list[str]] = {
                "mermaid_viewer":   ["diagram"],
                "code_walkthrough": ["code", "steps"],
                "step_controls":    ["steps", "targetEntityId"],
                "freeform_html":    ["spec"],
            }
            missing = [
                k for k in required.get(self.entity_type or "", [])
                if k not in self.props
            ]
            if missing:
                raise ValueError(f"{self.entity_type} missing required props: {missing}")
        return self


class SceneIR(BaseModel):
    title: str
    domain: str
    intent: str
    follow_ups: list[str] = []
    blocks: list[SceneBlock]
