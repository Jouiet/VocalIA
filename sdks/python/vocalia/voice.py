"""
VocalIA Voice Client - Widget & Web Speech API
"""

from __future__ import annotations

from typing import Optional, List, Dict, Any

import httpx

from .models import VoiceResponse, ConversationMessage, Persona, Language


class VoiceClient:
    """
    Client for VocalIA Voice Widget functionality.

    Handles text-to-speech, speech-to-text, and conversational AI
    for web-based voice interactions.
    """

    def __init__(self, http_client: httpx.Client) -> None:
        self._client = http_client

    def generate_response(
        self,
        text: str,
        persona: str = "AGENCY",
        language: str = "fr",
        context: Optional[List[ConversationMessage]] = None,
        knowledge_base_id: Optional[str] = None,
        stream: bool = False,
    ) -> VoiceResponse:
        """
        Generate an AI voice response.

        Args:
            text: User input text
            persona: Persona key (AGENCY, DENTAL, PROPERTY, etc.)
            language: Language code (fr, en, es, ar, ary)
            context: Previous conversation messages for context
            knowledge_base_id: Optional KB ID for RAG
            stream: Whether to stream the response

        Returns:
            VoiceResponse with text and optional audio

        Example:
            response = client.voice.generate_response(
                text="Quels sont vos horaires?",
                persona="DENTAL",
                language="fr"
            )
            print(response.text)
        """
        payload: Dict[str, Any] = {
            "text": text,
            "persona": persona,
            "language": language,
            "stream": stream,
        }

        if context:
            payload["context"] = [msg.model_dump() for msg in context]
        if knowledge_base_id:
            payload["knowledge_base_id"] = knowledge_base_id

        response = self._client.post("/v1/voice/generate", json=payload)
        response.raise_for_status()

        data = response.json()
        return VoiceResponse(**data)

    def transcribe(
        self,
        audio_data: bytes,
        language: str = "fr",
        format: str = "webm",
    ) -> str:
        """
        Transcribe audio to text using Web Speech API backend.

        Args:
            audio_data: Raw audio bytes
            language: Expected language code
            format: Audio format (webm, wav, mp3)

        Returns:
            Transcribed text
        """
        files = {"audio": ("audio." + format, audio_data, f"audio/{format}")}
        params = {"language": language}

        response = self._client.post(
            "/v1/voice/transcribe",
            files=files,
            params=params,
        )
        response.raise_for_status()

        return response.json()["text"]

    def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "fr",
        speed: float = 1.0,
    ) -> bytes:
        """
        Convert text to speech audio.

        Args:
            text: Text to synthesize
            voice_id: Optional specific voice ID
            language: Language code
            speed: Speech speed (0.5 to 2.0)

        Returns:
            Audio bytes (MP3 format)
        """
        payload = {
            "text": text,
            "language": language,
            "speed": speed,
        }
        if voice_id:
            payload["voice_id"] = voice_id

        response = self._client.post("/v1/voice/synthesize", json=payload)
        response.raise_for_status()

        return response.content

    def list_personas(self) -> List[Persona]:
        """
        List available voice personas.

        Returns:
            List of Persona objects
        """
        response = self._client.get("/v1/voice/personas")
        response.raise_for_status()

        return [Persona(**p) for p in response.json()["personas"]]

    def list_languages(self) -> List[Language]:
        """
        List supported languages.

        Returns:
            List of Language objects
        """
        response = self._client.get("/v1/voice/languages")
        response.raise_for_status()

        return [Language(**lang) for lang in response.json()["languages"]]

    def create_widget_token(
        self,
        domain: str,
        persona: str = "AGENCY",
        expires_in: int = 3600,
    ) -> str:
        """
        Create a temporary token for widget embedding.

        Args:
            domain: Allowed domain for the widget
            persona: Default persona for the widget
            expires_in: Token expiration in seconds

        Returns:
            Widget embed token
        """
        payload = {
            "domain": domain,
            "persona": persona,
            "expires_in": expires_in,
        }

        response = self._client.post("/v1/voice/widget-token", json=payload)
        response.raise_for_status()

        return response.json()["token"]
