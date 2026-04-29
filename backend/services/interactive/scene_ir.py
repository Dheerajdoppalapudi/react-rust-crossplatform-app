"""
Scene IR — Pydantic models for the Interactive Mode intermediate representation.

One generic SceneEntity handles all entity types (no per-type subclasses).
Adding a new entity type = add one line to the `required` dict in check_bare_minimum.
"""

from pydantic import BaseModel, model_validator
from typing import Optional


class SceneEntity(BaseModel):
    id: str
    type: str                    # free string — registry lookup happens client-side
    props: dict = {}             # all entity-specific data lives here
    html: Optional[str] = None   # filled by codegen for freeform_html only

    @model_validator(mode="after")
    def check_bare_minimum(self):
        """
        Catch obvious LLM omissions early (presence check only, not type).
        When adding a new entity type, add one entry here with its required prop keys.
        """
        required: dict[str, list[str]] = {
            "mermaid_viewer":   ["diagram"],
            "code_walkthrough": ["code", "steps"],
            "step_controls":    ["steps", "targetEntityId"],
            "freeform_html":    ["spec"],
        }
        missing = [k for k in required.get(self.type, []) if k not in self.props]
        if missing:
            raise ValueError(f"{self.type} missing required props: {missing}")
        return self


class SceneIR(BaseModel):
    title: str
    domain: str
    intent: str
    explanation: str
    follow_ups: list[str] = []
    entities: list[SceneEntity]
