"""
VocalIA Data Models
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


class Language(BaseModel):
    """Supported language."""

    code: str = Field(..., description="ISO language code")
    name: str = Field(..., description="Language name")
    native_name: str = Field(..., description="Native language name")
    supported_features: List[str] = Field(
        default_factory=list,
        description="Supported features (voice, telephony, darija, etc.)",
    )


class Persona(BaseModel):
    """Voice AI persona configuration."""

    key: str = Field(..., description="Persona key (AGENCY, DENTAL, etc.)")
    name: str = Field(..., description="Display name")
    description: str = Field(..., description="Persona description")
    industry: str = Field(..., description="Target industry")
    languages: List[str] = Field(
        default_factory=list,
        description="Supported language codes",
    )
    voice_style: Optional[str] = Field(
        None,
        description="Voice style (friendly, professional, etc.)",
    )


class ConversationMessage(BaseModel):
    """A message in a conversation."""

    role: str = Field(..., description="Message role (user, assistant, system)")
    content: str = Field(..., description="Message content")
    timestamp: Optional[datetime] = Field(None, description="Message timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class VoiceResponse(BaseModel):
    """Response from voice generation."""

    text: str = Field(..., description="Generated text response")
    audio_url: Optional[str] = Field(None, description="URL to audio file")
    audio_base64: Optional[str] = Field(None, description="Base64 encoded audio")
    duration_ms: Optional[int] = Field(None, description="Audio duration in ms")
    persona: str = Field(..., description="Persona used")
    language: str = Field(..., description="Language code")
    confidence: Optional[float] = Field(None, description="Response confidence 0-1")
    sources: Optional[List[str]] = Field(
        None,
        description="Knowledge base sources used",
    )


class CallStatus(str, Enum):
    """Call session status."""

    QUEUED = "queued"
    RINGING = "ringing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no_answer"
    CANCELED = "canceled"


class CallSession(BaseModel):
    """Telephony call session."""

    id: str = Field(..., description="Unique call ID")
    status: CallStatus = Field(..., description="Current call status")
    to: str = Field(..., description="Destination number")
    from_number: Optional[str] = Field(None, alias="from", description="Caller ID")
    persona: str = Field(..., description="Persona used")
    language: str = Field(..., description="Language code")
    started_at: Optional[datetime] = Field(None, description="Call start time")
    ended_at: Optional[datetime] = Field(None, description="Call end time")
    duration_seconds: Optional[int] = Field(None, description="Call duration")
    direction: str = Field("outbound", description="Call direction")
    recording_url: Optional[str] = Field(None, description="Recording URL")
    transcript_url: Optional[str] = Field(None, description="Transcript URL")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Custom metadata")
    cost: Optional[float] = Field(None, description="Call cost in USD")

    class Config:
        populate_by_name = True


class CallEvent(BaseModel):
    """Webhook call event."""

    event_type: str = Field(..., description="Event type")
    call_id: str = Field(..., description="Call session ID")
    timestamp: datetime = Field(..., description="Event timestamp")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event data")


class QualificationResult(BaseModel):
    """Lead qualification result from BANT scoring."""

    score: int = Field(..., ge=0, le=100, description="BANT score 0-100")
    budget: Optional[str] = Field(None, description="Budget indication")
    authority: Optional[str] = Field(None, description="Decision authority")
    need: Optional[str] = Field(None, description="Identified need")
    timeline: Optional[str] = Field(None, description="Purchase timeline")
    is_qualified: bool = Field(..., description="Meets qualification threshold")
    recommended_action: Optional[str] = Field(None, description="Next action")


class UsageStats(BaseModel):
    """API usage statistics."""

    period_start: datetime
    period_end: datetime
    voice_requests: int = 0
    telephony_minutes: float = 0.0
    total_cost: float = 0.0
    calls_completed: int = 0
    calls_failed: int = 0
    average_call_duration: float = 0.0
