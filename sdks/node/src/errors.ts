/**
 * VocalIA Error Classes
 */

export class VocalIAError extends Error {
  readonly statusCode?: number;
  readonly response?: Record<string, unknown>;

  constructor(message: string, statusCode?: number, response?: Record<string, unknown>) {
    super(message);
    this.name = 'VocalIAError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class AuthenticationError extends VocalIAError {
  constructor(message = 'Authentication failed. Check your API key.') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends VocalIAError {
  readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded. Please slow down.', retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class APIError extends VocalIAError {
  constructor(message: string, statusCode?: number, response?: Record<string, unknown>) {
    super(message, statusCode, response);
    this.name = 'APIError';
  }
}

export class ValidationError extends VocalIAError {
  readonly errors: unknown[];

  constructor(message = 'Request validation failed.', errors: unknown[] = []) {
    super(message, 400);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class NotFoundError extends VocalIAError {
  constructor(message = 'Resource not found.') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class CallError extends VocalIAError {
  readonly callId?: string;

  constructor(message: string, callId?: string, statusCode?: number) {
    super(message, statusCode);
    this.name = 'CallError';
    this.callId = callId;
  }
}

/**
 * Handle API error responses.
 * @internal
 */
export function handleAPIError(
  statusCode: number,
  response: Record<string, unknown>
): VocalIAError {
  const message = (response.message as string) || (response.error as string) || 'Unknown error';

  switch (statusCode) {
    case 401:
      return new AuthenticationError(message);

    case 429:
      const retryAfter = response.retry_after as number | undefined;
      return new RateLimitError(message, retryAfter);

    case 400:
      const errors = (response.errors as unknown[]) || [];
      return new ValidationError(message, errors);

    case 404:
      return new NotFoundError(message);

    default:
      return new APIError(message, statusCode, response);
  }
}
