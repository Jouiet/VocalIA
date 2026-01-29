"""
VocalIA - Official Python SDK for Voice AI Platform

Usage:
    from vocalia import VocalIA

    client = VocalIA(api_key="your-api-key")

    # Voice Widget
    response = client.voice.generate_response(
        text="Bonjour, comment puis-je vous aider?",
        persona="AGENCY",
        language="fr"
    )

    # Telephony
    call = client.telephony.initiate_call(
        to="+212600000000",
        persona="DENTAL",
        language="fr"
    )
"""

__version__ = "0.1.0"
__author__ = "VocalIA"
__email__ = "dev@vocalia.ma"

from .client import VocalIA
from .voice import VoiceClient
from .telephony import TelephonyClient
from .models import (
    VoiceResponse,
    CallSession,
    Persona,
    Language,
    ConversationMessage,
)
from .exceptions import (
    VocalIAError,
    AuthenticationError,
    RateLimitError,
    APIError,
)

__all__ = [
    "VocalIA",
    "VoiceClient",
    "TelephonyClient",
    "VoiceResponse",
    "CallSession",
    "Persona",
    "Language",
    "ConversationMessage",
    "VocalIAError",
    "AuthenticationError",
    "RateLimitError",
    "APIError",
]
