"""
VocalIA Main Client
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

from .voice import VoiceClient
from .telephony import TelephonyClient
from .exceptions import AuthenticationError


class VocalIA:
    """
    Main client for VocalIA Voice AI Platform.

    Usage:
        client = VocalIA(api_key="your-api-key")

        # Access voice functionality
        response = client.voice.generate_response("Hello")

        # Access telephony functionality
        call = client.telephony.initiate_call("+212600000000")

    Args:
        api_key: Your VocalIA API key. If not provided, reads from
                 VOCALIA_API_KEY environment variable.
        base_url: API base URL. Defaults to https://api.vocalia.ma
        timeout: Request timeout in seconds. Defaults to 30.
    """

    DEFAULT_BASE_URL = "https://api.vocalia.ma"
    DEFAULT_TIMEOUT = 30.0

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key = api_key or os.environ.get("VOCALIA_API_KEY")
        if not self.api_key:
            raise AuthenticationError(
                "API key is required. Pass api_key parameter or set "
                "VOCALIA_API_KEY environment variable."
            )

        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout

        # Initialize HTTP client
        self._http_client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": f"vocalia-python/0.1.0",
            },
            timeout=timeout,
        )

        # Initialize sub-clients
        self._voice: Optional[VoiceClient] = None
        self._telephony: Optional[TelephonyClient] = None

    @property
    def voice(self) -> VoiceClient:
        """Access voice/widget functionality."""
        if self._voice is None:
            self._voice = VoiceClient(self._http_client)
        return self._voice

    @property
    def telephony(self) -> TelephonyClient:
        """Access telephony/PSTN functionality."""
        if self._telephony is None:
            self._telephony = TelephonyClient(self._http_client)
        return self._telephony

    def close(self) -> None:
        """Close the HTTP client."""
        self._http_client.close()

    def __enter__(self) -> "VocalIA":
        return self

    def __exit__(self, *args) -> None:
        self.close()


class AsyncVocalIA:
    """
    Async client for VocalIA Voice AI Platform.

    Usage:
        async with AsyncVocalIA(api_key="your-api-key") as client:
            response = await client.voice.generate_response("Hello")
    """

    DEFAULT_BASE_URL = "https://api.vocalia.ma"
    DEFAULT_TIMEOUT = 30.0

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key = api_key or os.environ.get("VOCALIA_API_KEY")
        if not self.api_key:
            raise AuthenticationError(
                "API key is required. Pass api_key parameter or set "
                "VOCALIA_API_KEY environment variable."
            )

        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout

        # Initialize async HTTP client
        self._http_client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": f"vocalia-python/0.1.0",
            },
            timeout=timeout,
        )

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._http_client.aclose()

    async def __aenter__(self) -> "AsyncVocalIA":
        return self

    async def __aexit__(self, *args) -> None:
        await self.close()
