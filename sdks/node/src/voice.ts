/**
 * VocalIA Voice Client - Widget & Web Speech API
 */

import type { VocalIA } from './client';
import type {
  VoiceResponse,
  Persona,
  Language,
  GenerateResponseParams,
  TranscribeParams,
  SynthesizeParams,
} from './types';

export class VoiceClient {
  constructor(private readonly client: VocalIA) {}

  /**
   * Generate an AI voice response.
   *
   * @example
   * ```typescript
   * const response = await client.voice.generateResponse({
   *   text: 'Quels sont vos horaires?',
   *   persona: 'DENTAL',
   *   language: 'fr'
   * });
   * console.log(response.text);
   * ```
   */
  async generateResponse(params: GenerateResponseParams): Promise<VoiceResponse> {
    const { text, persona = 'AGENCY', language = 'fr', context, knowledgeBaseId, stream = false } = params;

    const body: Record<string, unknown> = {
      text,
      persona,
      language,
      stream,
    };

    if (context) body.context = context;
    if (knowledgeBaseId) body.knowledge_base_id = knowledgeBaseId;

    return this.client.request<VoiceResponse>('POST', '/v1/voice/generate', { body });
  }

  /**
   * Transcribe audio to text.
   *
   * @example
   * ```typescript
   * const text = await client.voice.transcribe({
   *   audioData: audioBuffer,
   *   language: 'fr'
   * });
   * ```
   */
  async transcribe(params: TranscribeParams): Promise<string> {
    const { audioData, language = 'fr', format = 'webm' } = params;

    const result = await this.client.upload<{ text: string }>(
      '/v1/voice/transcribe',
      audioData,
      `audio.${format}`,
      { language }
    );

    return result.text;
  }

  /**
   * Convert text to speech audio.
   *
   * @example
   * ```typescript
   * const audioBuffer = await client.voice.synthesize({
   *   text: 'Bienvenue chez VocalIA',
   *   language: 'fr'
   * });
   * ```
   */
  async synthesize(params: SynthesizeParams): Promise<Buffer> {
    const { text, voiceId, language = 'fr', speed = 1.0 } = params;

    const body: Record<string, unknown> = {
      text,
      language,
      speed,
    };

    if (voiceId) body.voice_id = voiceId;

    // Request returns binary audio
    return this.client.download('/v1/voice/synthesize');
  }

  /**
   * List available voice personas.
   *
   * @example
   * ```typescript
   * const personas = await client.voice.listPersonas();
   * personas.forEach(p => console.log(p.key, p.name));
   * ```
   */
  async listPersonas(): Promise<Persona[]> {
    const result = await this.client.request<{ personas: Persona[] }>('GET', '/v1/voice/personas');
    return result.personas;
  }

  /**
   * List supported languages.
   */
  async listLanguages(): Promise<Language[]> {
    const result = await this.client.request<{ languages: Language[] }>('GET', '/v1/voice/languages');
    return result.languages;
  }

  /**
   * Create a temporary token for widget embedding.
   *
   * @example
   * ```typescript
   * const token = await client.voice.createWidgetToken({
   *   domain: 'mysite.com',
   *   persona: 'AGENCY'
   * });
   * ```
   */
  async createWidgetToken(params: {
    domain: string;
    persona?: string;
    expiresIn?: number;
  }): Promise<string> {
    const { domain, persona = 'AGENCY', expiresIn = 3600 } = params;

    const result = await this.client.request<{ token: string }>('POST', '/v1/voice/widget-token', {
      body: {
        domain,
        persona,
        expires_in: expiresIn,
      },
    });

    return result.token;
  }
}
