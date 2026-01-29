"""
VocalIA Telephony Client - PSTN Voice AI
"""

from __future__ import annotations

from typing import Optional, List, Dict, Any
from datetime import datetime

import httpx

from .models import CallSession, CallStatus, CallEvent


class TelephonyClient:
    """
    Client for VocalIA Telephony/PSTN functionality.

    Handles outbound calls, inbound webhooks, and real-time
    voice AI conversations over phone lines.
    """

    def __init__(self, http_client: httpx.Client) -> None:
        self._client = http_client

    def initiate_call(
        self,
        to: str,
        persona: str = "AGENCY",
        language: str = "fr",
        from_number: Optional[str] = None,
        webhook_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        knowledge_base_id: Optional[str] = None,
        max_duration: int = 600,
    ) -> CallSession:
        """
        Initiate an outbound voice AI call.

        Args:
            to: Destination phone number (E.164 format)
            persona: Persona key for the AI agent
            language: Language code (fr, en, es, ar, ary)
            from_number: Caller ID (must be verified)
            webhook_url: URL for call events
            metadata: Custom metadata to attach
            knowledge_base_id: KB for RAG retrieval
            max_duration: Max call duration in seconds

        Returns:
            CallSession with call details

        Example:
            call = client.telephony.initiate_call(
                to="+212600000000",
                persona="DENTAL",
                language="fr",
                webhook_url="https://myapp.com/webhooks/vocalia"
            )
            print(f"Call started: {call.id}")
        """
        payload: Dict[str, Any] = {
            "to": to,
            "persona": persona,
            "language": language,
            "max_duration": max_duration,
        }

        if from_number:
            payload["from"] = from_number
        if webhook_url:
            payload["webhook_url"] = webhook_url
        if metadata:
            payload["metadata"] = metadata
        if knowledge_base_id:
            payload["knowledge_base_id"] = knowledge_base_id

        response = self._client.post("/v1/telephony/calls", json=payload)
        response.raise_for_status()

        return CallSession(**response.json())

    def get_call(self, call_id: str) -> CallSession:
        """
        Get details of a specific call.

        Args:
            call_id: The call session ID

        Returns:
            CallSession with current status
        """
        response = self._client.get(f"/v1/telephony/calls/{call_id}")
        response.raise_for_status()

        return CallSession(**response.json())

    def list_calls(
        self,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> List[CallSession]:
        """
        List call sessions with optional filters.

        Args:
            limit: Max results (1-100)
            offset: Pagination offset
            status: Filter by status (active, completed, failed)
            from_date: Filter calls after this date
            to_date: Filter calls before this date

        Returns:
            List of CallSession objects
        """
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
        }

        if status:
            params["status"] = status
        if from_date:
            params["from_date"] = from_date.isoformat()
        if to_date:
            params["to_date"] = to_date.isoformat()

        response = self._client.get("/v1/telephony/calls", params=params)
        response.raise_for_status()

        return [CallSession(**c) for c in response.json()["calls"]]

    def end_call(self, call_id: str) -> CallSession:
        """
        End an active call.

        Args:
            call_id: The call session ID

        Returns:
            Updated CallSession
        """
        response = self._client.post(f"/v1/telephony/calls/{call_id}/end")
        response.raise_for_status()

        return CallSession(**response.json())

    def transfer_call(
        self,
        call_id: str,
        to: str,
        announce: Optional[str] = None,
    ) -> CallSession:
        """
        Transfer an active call to another number.

        Args:
            call_id: The call session ID
            to: Destination number for transfer
            announce: Optional announcement before transfer

        Returns:
            Updated CallSession
        """
        payload: Dict[str, Any] = {"to": to}
        if announce:
            payload["announce"] = announce

        response = self._client.post(
            f"/v1/telephony/calls/{call_id}/transfer",
            json=payload,
        )
        response.raise_for_status()

        return CallSession(**response.json())

    def get_transcript(self, call_id: str) -> List[Dict[str, Any]]:
        """
        Get the conversation transcript for a call.

        Args:
            call_id: The call session ID

        Returns:
            List of transcript segments with speaker and text
        """
        response = self._client.get(f"/v1/telephony/calls/{call_id}/transcript")
        response.raise_for_status()

        return response.json()["transcript"]

    def get_recording(self, call_id: str) -> bytes:
        """
        Download the call recording.

        Args:
            call_id: The call session ID

        Returns:
            Audio bytes (MP3 format)
        """
        response = self._client.get(f"/v1/telephony/calls/{call_id}/recording")
        response.raise_for_status()

        return response.content

    def get_analytics(
        self,
        call_id: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get call analytics and metrics.

        Args:
            call_id: Specific call ID, or None for aggregate
            from_date: Start of date range
            to_date: End of date range

        Returns:
            Analytics data including duration, sentiment, etc.
        """
        params: Dict[str, Any] = {}

        if call_id:
            params["call_id"] = call_id
        if from_date:
            params["from_date"] = from_date.isoformat()
        if to_date:
            params["to_date"] = to_date.isoformat()

        response = self._client.get("/v1/telephony/analytics", params=params)
        response.raise_for_status()

        return response.json()

    def configure_webhook(
        self,
        url: str,
        events: List[str],
        secret: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Configure webhook for call events.

        Args:
            url: Webhook endpoint URL
            events: List of event types to receive
            secret: Optional signing secret

        Returns:
            Webhook configuration
        """
        payload: Dict[str, Any] = {
            "url": url,
            "events": events,
        }
        if secret:
            payload["secret"] = secret

        response = self._client.post("/v1/telephony/webhooks", json=payload)
        response.raise_for_status()

        return response.json()
