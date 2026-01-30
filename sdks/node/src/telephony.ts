/**
 * VocalIA Telephony Client - PSTN Voice AI
 */

import type { VocalIA } from './client.js';
import type {
  CallSession,
  InitiateCallParams,
  ListCallsParams,
  TransferCallParams,
  WebhookConfig,
  TranscriptSegment,
} from './types.js';

export class TelephonyClient {
  constructor(private readonly client: VocalIA) {}

  /**
   * Initiate an outbound voice AI call.
   *
   * @example
   * ```typescript
   * const call = await client.telephony.initiateCall({
   *   to: '+212600000000',
   *   persona: 'DENTAL',
   *   language: 'fr',
   *   webhookUrl: 'https://myapp.com/webhooks/vocalia'
   * });
   * console.log(`Call started: ${call.id}`);
   * ```
   */
  async initiateCall(params: InitiateCallParams): Promise<CallSession> {
    const {
      to,
      persona = 'AGENCY',
      language = 'fr',
      from,
      webhookUrl,
      metadata,
      knowledgeBaseId,
      maxDuration = 600,
    } = params;

    const body: Record<string, unknown> = {
      to,
      persona,
      language,
      max_duration: maxDuration,
    };

    if (from) body.from = from;
    if (webhookUrl) body.webhook_url = webhookUrl;
    if (metadata) body.metadata = metadata;
    if (knowledgeBaseId) body.knowledge_base_id = knowledgeBaseId;

    return this.client.request<CallSession>('POST', '/v1/telephony/calls', { body });
  }

  /**
   * Get details of a specific call.
   */
  async getCall(callId: string): Promise<CallSession> {
    return this.client.request<CallSession>('GET', `/v1/telephony/calls/${callId}`);
  }

  /**
   * List call sessions with optional filters.
   *
   * @example
   * ```typescript
   * const calls = await client.telephony.listCalls({
   *   status: 'completed',
   *   limit: 10
   * });
   * ```
   */
  async listCalls(params: ListCallsParams = {}): Promise<CallSession[]> {
    const { limit = 20, offset = 0, status, fromDate, toDate } = params;

    const queryParams: Record<string, string | number | undefined> = {
      limit,
      offset,
    };

    if (status) queryParams.status = status;
    if (fromDate) queryParams.from_date = fromDate.toISOString();
    if (toDate) queryParams.to_date = toDate.toISOString();

    const result = await this.client.request<{ calls: CallSession[] }>('GET', '/v1/telephony/calls', {
      params: queryParams,
    });

    return result.calls;
  }

  /**
   * End an active call.
   */
  async endCall(callId: string): Promise<CallSession> {
    return this.client.request<CallSession>('POST', `/v1/telephony/calls/${callId}/end`);
  }

  /**
   * Transfer an active call to another number.
   *
   * @example
   * ```typescript
   * await client.telephony.transferCall(callId, {
   *   to: '+212600000001',
   *   announce: 'Transferring you to a specialist'
   * });
   * ```
   */
  async transferCall(callId: string, params: TransferCallParams): Promise<CallSession> {
    const { to, announce } = params;

    const body: Record<string, unknown> = { to };
    if (announce) body.announce = announce;

    return this.client.request<CallSession>('POST', `/v1/telephony/calls/${callId}/transfer`, { body });
  }

  /**
   * Get the conversation transcript for a call.
   */
  async getTranscript(callId: string): Promise<TranscriptSegment[]> {
    const result = await this.client.request<{ transcript: TranscriptSegment[] }>(
      'GET',
      `/v1/telephony/calls/${callId}/transcript`
    );
    return result.transcript;
  }

  /**
   * Download the call recording.
   */
  async getRecording(callId: string): Promise<Buffer> {
    return this.client.download(`/v1/telephony/calls/${callId}/recording`);
  }

  /**
   * Get call analytics and metrics.
   */
  async getAnalytics(params: {
    callId?: string;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<Record<string, unknown>> {
    const queryParams: Record<string, string | undefined> = {};

    if (params.callId) queryParams.call_id = params.callId;
    if (params.fromDate) queryParams.from_date = params.fromDate.toISOString();
    if (params.toDate) queryParams.to_date = params.toDate.toISOString();

    return this.client.request<Record<string, unknown>>('GET', '/v1/telephony/analytics', {
      params: queryParams,
    });
  }

  /**
   * Configure webhook for call events.
   *
   * @example
   * ```typescript
   * await client.telephony.configureWebhook({
   *   url: 'https://myapp.com/webhooks/vocalia',
   *   events: ['call.started', 'call.completed', 'call.failed']
   * });
   * ```
   */
  async configureWebhook(config: WebhookConfig): Promise<WebhookConfig> {
    const body: Record<string, unknown> = {
      url: config.url,
      events: config.events,
    };

    if (config.secret) body.secret = config.secret;

    return this.client.request<WebhookConfig>('POST', '/v1/telephony/webhooks', { body });
  }
}
