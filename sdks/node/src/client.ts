/**
 * VocalIA Main Client
 */

import { request } from 'undici';
import { VoiceClient } from './voice';
import { TelephonyClient } from './telephony';
import { AuthenticationError } from './errors';
import type { VocalIAConfig } from './types';

const DEFAULT_BASE_URL = 'https://api.vocalia.ma';
const DEFAULT_TIMEOUT = 30000;

export class VocalIA {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  private _voice?: VoiceClient;
  private _telephony?: TelephonyClient;

  /**
   * Create a new VocalIA client.
   *
   * @param config - Client configuration
   *
   * @example
   * ```typescript
   * const client = new VocalIA({ apiKey: 'your-api-key' });
   * ```
   */
  constructor(config: VocalIAConfig = {}) {
    this.apiKey = config.apiKey || process.env.VOCALIA_API_KEY || '';

    if (!this.apiKey) {
      throw new AuthenticationError(
        'API key is required. Pass apiKey option or set VOCALIA_API_KEY environment variable.'
      );
    }

    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Access voice/widget functionality.
   */
  get voice(): VoiceClient {
    if (!this._voice) {
      this._voice = new VoiceClient(this);
    }
    return this._voice;
  }

  /**
   * Access telephony/PSTN functionality.
   */
  get telephony(): TelephonyClient {
    if (!this._telephony) {
      this._telephony = new TelephonyClient(this);
    }
    return this._telephony;
  }

  /**
   * Make an API request.
   * @internal
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const { body, statusCode } = await request(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vocalia-node/0.1.0',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout,
    });

    const responseText = await body.text();
    const data = responseText ? JSON.parse(responseText) : {};

    if (statusCode >= 400) {
      const { handleAPIError } = await import('./errors');
      throw handleAPIError(statusCode, data);
    }

    return data as T;
  }

  /**
   * Upload a file.
   * @internal
   */
  async upload<T>(
    path: string,
    file: Buffer,
    filename: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const boundary = '----VocalIABoundary' + Math.random().toString(36).slice(2);
    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="audio"; filename="${filename}"\r\n`,
      `Content-Type: application/octet-stream\r\n\r\n`,
    ];

    const bodyBuffer = Buffer.concat([
      Buffer.from(bodyParts.join('')),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const { body, statusCode } = await request(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'vocalia-node/0.1.0',
      },
      body: bodyBuffer,
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout,
    });

    const responseText = await body.text();
    const data = responseText ? JSON.parse(responseText) : {};

    if (statusCode >= 400) {
      const { handleAPIError } = await import('./errors');
      throw handleAPIError(statusCode, data);
    }

    return data as T;
  }

  /**
   * Download binary data.
   * @internal
   */
  async download(path: string): Promise<Buffer> {
    const url = new URL(path, this.baseUrl);

    const { body, statusCode } = await request(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'User-Agent': 'vocalia-node/0.1.0',
      },
      bodyTimeout: this.timeout,
      headersTimeout: this.timeout,
    });

    if (statusCode >= 400) {
      const text = await body.text();
      const data = text ? JSON.parse(text) : {};
      const { handleAPIError } = await import('./errors');
      throw handleAPIError(statusCode, data);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
