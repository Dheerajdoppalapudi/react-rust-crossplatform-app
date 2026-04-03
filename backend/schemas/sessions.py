"""Pydantic schemas for session and conversation API responses."""

from typing import Optional
from pydantic import BaseModel


class SessionSummary(BaseModel):
    id:                str
    prompt:            str
    created_at:        str
    status:            str
    intent_type:       Optional[str]  = None
    render_path:       Optional[str]  = None
    frame_count:       Optional[int]  = None
    api_call_count:    Optional[int]  = None
    prompt_tokens:     Optional[int]  = None
    completion_tokens: Optional[int]  = None
    total_tokens:      Optional[int]  = None
    model_name:        Optional[str]  = None


class SessionTurn(BaseModel):
    id:                 str
    prompt:             str
    created_at:         str
    status:             str
    intent_type:        Optional[str] = None
    render_path:        Optional[str] = None
    frame_count:        Optional[int] = None
    video_path:         Optional[str] = None
    turn_index:         int
    parent_session_id:  Optional[str] = None
    parent_frame_index: Optional[int] = None


class ConversationSummary(BaseModel):
    id:          str
    title:       str
    created_at:  str
    updated_at:  str
    turn_count:  int
    intent_type: Optional[str] = None


class ConversationDetail(BaseModel):
    id:                str
    title:             str
    created_at:        str
    updated_at:        str
    merged_video_path: Optional[str]       = None
    turns:             list[SessionTurn]


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
