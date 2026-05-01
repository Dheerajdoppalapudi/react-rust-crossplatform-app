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
                "chart":            ["type", "data"],   # series/xKey checked below per chart type
                "graph_canvas":     ["nodes", "edges"],
                "molecule_viewer":  ["format", "data"],
                "map_viewer":       ["center"],
                "timeline":         ["events"],
            }
            missing = [
                k for k in required.get(self.entity_type or "", [])
                if k not in self.props
            ]
            if missing:
                raise ValueError(f"{self.entity_type} missing required props: {missing}")

            # math_formula needs either 'latex' or 'steps'
            if self.entity_type == "math_formula":
                if "latex" not in self.props and "steps" not in self.props:
                    raise ValueError("math_formula requires either 'latex' or 'steps' prop")

            # pie / donut / radar don't use series or xKey
            if self.entity_type == "chart":
                chart_type = self.props.get("type", "")
                if chart_type not in ("pie", "donut", "radar"):
                    extra_missing = [k for k in ("series", "xKey") if k not in self.props]
                    if extra_missing:
                        raise ValueError(f"chart missing required props: {extra_missing}")
        return self


class SceneIR(BaseModel):
    title: str
    domain: str
    intent: str
    follow_ups: list[str] = []
    blocks: list[SceneBlock]
