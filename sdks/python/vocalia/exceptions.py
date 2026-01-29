"""
VocalIA Exceptions
"""

from typing import Optional, Dict, Any


class VocalIAError(Exception):
    """Base exception for VocalIA SDK."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response = response

    def __str__(self) -> str:
        if self.status_code:
            return f"[{self.status_code}] {self.message}"
        return self.message


class AuthenticationError(VocalIAError):
    """Raised when authentication fails (401)."""

    def __init__(
        self,
        message: str = "Authentication failed. Check your API key.",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=401, **kwargs)


class RateLimitError(VocalIAError):
    """Raised when rate limit is exceeded (429)."""

    def __init__(
        self,
        message: str = "Rate limit exceeded. Please slow down.",
        retry_after: Optional[int] = None,
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=429, **kwargs)
        self.retry_after = retry_after


class APIError(VocalIAError):
    """Raised for general API errors (4xx, 5xx)."""

    pass


class ValidationError(VocalIAError):
    """Raised when request validation fails (400)."""

    def __init__(
        self,
        message: str = "Request validation failed.",
        errors: Optional[list] = None,
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=400, **kwargs)
        self.errors = errors or []


class NotFoundError(VocalIAError):
    """Raised when resource is not found (404)."""

    def __init__(
        self,
        message: str = "Resource not found.",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=404, **kwargs)


class CallError(VocalIAError):
    """Raised for telephony call errors."""

    def __init__(
        self,
        message: str,
        call_id: Optional[str] = None,
        **kwargs,
    ) -> None:
        super().__init__(message, **kwargs)
        self.call_id = call_id


class WebhookVerificationError(VocalIAError):
    """Raised when webhook signature verification fails."""

    def __init__(
        self,
        message: str = "Webhook signature verification failed.",
        **kwargs,
    ) -> None:
        super().__init__(message, **kwargs)
