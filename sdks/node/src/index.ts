/**
 * VocalIA - Official Node.js SDK for Voice AI Platform
 *
 * @example
 * ```typescript
 * import { VocalIA } from 'vocalia';
 *
 * const client = new VocalIA({ apiKey: 'your-api-key' });
 *
 * // Voice Widget
 * const response = await client.voice.generateResponse({
 *   text: 'Bonjour, comment puis-je vous aider?',
 *   persona: 'AGENCY',
 *   language: 'fr'
 * });
 *
 * // Telephony
 * const call = await client.telephony.initiateCall({
 *   to: '+212600000000',
 *   persona: 'DENTAL',
 *   language: 'fr'
 * });
 * ```
 */

export { VocalIA } from './client';
export { VoiceClient } from './voice';
export { TelephonyClient } from './telephony';

export type {
  VocalIAConfig,
  VoiceResponse,
  CallSession,
  CallStatus,
  Persona,
  Language,
  ConversationMessage,
  GenerateResponseParams,
  InitiateCallParams,
  TranscribeParams,
  SynthesizeParams,
} from './types';

export {
  VocalIAError,
  AuthenticationError,
  RateLimitError,
  APIError,
  ValidationError,
  NotFoundError,
  CallError,
} from './errors';
