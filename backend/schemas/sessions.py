"""Pydantic schemas for session and conversation API responses."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_serializer


def _iso(dt: datetime) -> str:
    """Serialize datetime → ISO-8601 UTC string for JSON responses."""
    return dt.isoformat()


class SessionSummary(BaseModel):
    id:                str
    prompt:            str
    created_at:        datetime
    status:            str
    intent_type:       Optional[str]  = None
    render_path:       Optional[str]  = None
    frame_count:       Optional[int]  = None
    api_call_count:    Optional[int]  = None
    prompt_tokens:     Optional[int]  = None
    completion_tokens: Optional[int]  = None
    total_tokens:      Optional[int]  = None
    model_name:        Optional[str]  = None

    @field_serializer("created_at")
    def serialize_created_at(self, v: datetime) -> str:
        return _iso(v)


class SessionTurn(BaseModel):
    id:                 str
    prompt:             str
    created_at:         datetime
    status:             str
    intent_type:        Optional[str]  = None
    render_path:        Optional[str]  = None
    frame_count:        Optional[int]  = None
    video_path:         Optional[str]  = None
    turn_index:         int
    parent_session_id:  Optional[str]  = None
    parent_frame_index: Optional[int]  = None
    stages_json:        Optional[str]  = None
    sources_json:       Optional[str]  = None
    synthesis_text:     Optional[str]  = None
    frames_meta:        Optional[dict] = None

    @field_serializer("created_at")
    def serialize_created_at(self, v: datetime) -> str:
        return _iso(v)


class ConversationSummary(BaseModel):
    id:          str
    title:       str
    created_at:  datetime
    updated_at:  datetime
    starred:     bool          = False
    turn_count:  int
    intent_type: Optional[str] = None

    @field_serializer("created_at", "updated_at")
    def serialize_timestamps(self, v: datetime) -> str:
        return _iso(v)


class ConversationDetail(BaseModel):
    id:                str
    title:             str
    created_at:        datetime
    updated_at:        datetime
    merged_video_path: Optional[str]       = None
    notes:             Optional[dict]      = None
    turns:             list[SessionTurn]

    @field_serializer("created_at", "updated_at")
    def serialize_timestamps(self, v: datetime) -> str:
        return _iso(v)


class TreeNode(BaseModel):
    id:                 str
    prompt:             str
    status:             str
    intent_type:        Optional[str] = None
    frame_count:        Optional[int] = None
    video_path:         Optional[str] = None
    turn_index:         int
    parent_session_id:  Optional[str] = None
    parent_frame_index: Optional[int] = None
    video_ready:        bool


class ConversationTree(BaseModel):
    conversation_id: str
    title:           str
    nodes:           list[TreeNode]


class MergeResponse(BaseModel):
    merged_video_url: str
    session_count:    int
    sessions:         list[dict]


class SessionOutputResponse(BaseModel):
    file_type: str   # "python" | "json"
    content:   str


class UploadedFile(BaseModel):
    original_name: str
    saved_as:      str
    size:          int
    content_type:  Optional[str] = None


class UploadResponse(BaseModel):
    files: list[UploadedFile]


class ChatWithFilesResponse(BaseModel):
    reply: str
    files: list[UploadedFile]
