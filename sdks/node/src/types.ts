/**
 * VocalIA TypeScript Types
 */

export interface VocalIAConfig {
  /** Your VocalIA API key */
  apiKey?: string;
  /** API base URL (default: https://api.vocalia.ma) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  supportedFeatures: string[];
}

export interface Persona {
  key: string;
  name: string;
  description: string;
  industry: string;
  languages: string[];
  voiceStyle?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  audioBase64?: string;
  durationMs?: number;
  persona: string;
  language: string;
  confidence?: number;
  sources?: string[];
}

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'canceled';

export interface CallSession {
  id: string;
  status: CallStatus;
  to: string;
  from?: string;
  persona: string;
  language: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  direction: 'inbound' | 'outbound';
  recordingUrl?: string;
  transcriptUrl?: string;
  metadata?: Record<string, unknown>;
  cost?: number;
}

export interface CallEvent {
  eventType: string;
  callId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface GenerateResponseParams {
  /** User input text */
  text: string;
  /** Persona key (AGENCY, DENTAL, etc.) */
  persona?: string;
  /** Language code (fr, en, es, ar, ary) */
  language?: string;
  /** Previous conversation context */
  context?: ConversationMessage[];
  /** Knowledge base ID for RAG */
  knowledgeBaseId?: string;
  /** Whether to stream the response */
  stream?: boolean;
}

export interface TranscribeParams {
  /** Audio data as Buffer */
  audioData: Buffer;
  /** Expected language */
  language?: string;
  /** Audio format (webm, wav, mp3) */
  format?: string;
}

export interface SynthesizeParams {
  /** Text to synthesize */
  text: string;
  /** Voice ID */
  voiceId?: string;
  /** Language code */
  language?: string;
  /** Speech speed (0.5 to 2.0) */
  speed?: number;
}

export interface InitiateCallParams {
  /** Destination phone number (E.164) */
  to: string;
  /** Persona key */
  persona?: string;
  /** Language code */
  language?: string;
  /** Caller ID (must be verified) */
  from?: string;
  /** Webhook URL for call events */
  webhookUrl?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Knowledge base ID for RAG */
  knowledgeBaseId?: string;
  /** Max duration in seconds */
  maxDuration?: number;
}

export interface ListCallsParams {
  limit?: number;
  offset?: number;
  status?: CallStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface TransferCallParams {
  /** Destination number */
  to: string;
  /** Announcement before transfer */
  announce?: string;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
}

export interface TranscriptSegment {
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: string;
  confidence?: number;
}

export interface QualificationResult {
  score: number;
  budget?: string;
  authority?: string;
  need?: string;
  timeline?: string;
  isQualified: boolean;
  recommendedAction?: string;
}

export interface UsageStats {
  periodStart: string;
  periodEnd: string;
  voiceRequests: number;
  telephonyMinutes: number;
  totalCost: number;
  callsCompleted: number;
  callsFailed: number;
  averageCallDuration: number;
}
