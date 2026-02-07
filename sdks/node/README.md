# VocalIA Node.js SDK

Official Node.js SDK for the VocalIA Voice AI Platform.

## Installation

```bash
npm install vocalia
# or
yarn add vocalia
# or
pnpm add vocalia
```

## Quick Start

```typescript
import { VocalIA } from 'vocalia';

// Initialize client
const client = new VocalIA({ apiKey: 'your-api-key' });

// Generate a voice response
const response = await client.voice.generateResponse({
  text: 'Bonjour, comment puis-je vous aider?',
  persona: 'AGENCY',
  language: 'fr'
});
console.log(response.text);

// Initiate a phone call
const call = await client.telephony.initiateCall({
  to: '+212600000000',
  persona: 'DENTAL',
  language: 'fr'
});
console.log(`Call ID: ${call.id}`);
```

## Features

### Voice Widget

```typescript
// Generate AI response
const response = await client.voice.generateResponse({
  text: 'Quels sont vos services?',
  persona: 'PROPERTY',
  language: 'fr',
  knowledgeBaseId: 'kb_123'
});

// Text-to-speech
const audio = await client.voice.synthesize({
  text: 'Bienvenue chez VocalIA',
  language: 'fr'
});

// Speech-to-text
const text = await client.voice.transcribe({
  audioData: audioBuffer,
  language: 'fr'
});

// List available personas
const personas = await client.voice.listPersonas();
personas.forEach(p => console.log(`${p.key}: ${p.name}`));
```

### Telephony (PSTN)

```typescript
// Make an outbound call
const call = await client.telephony.initiateCall({
  to: '+212600000000',
  persona: 'DENTAL',
  language: 'fr',
  webhookUrl: 'https://yourapp.com/webhooks/vocalia',
  metadata: { customerId: 'cust_123' }
});

// Get call status
const callStatus = await client.telephony.getCall(call.id);
console.log(`Status: ${callStatus.status}`);

// Get transcript
const transcript = await client.telephony.getTranscript(call.id);
transcript.forEach(segment => {
  console.log(`${segment.speaker}: ${segment.text}`);
});

// Transfer call to human
await client.telephony.transferCall(call.id, {
  to: '+212600000001',
  announce: 'Transferring you to a specialist'
});
```

## Personas

VocalIA supports 40 industry-specific personas:

| Tier | Personas |
|------|----------|
| Core | AGENCY, DENTAL, PROPERTY, CONTRACTOR |
| Expansion | HEALER, COUNSELOR, CONCIERGE, STYLIST, RECRUITER... |
| Universal | UNIVERSAL_ECOMMERCE, UNIVERSAL_SME |
| Economy | RETAILER, BUILDER, RESTAURATEUR, CONSULTANT, DOCTOR, NOTARY... |

## Languages

| Code | Language | Features |
|------|----------|----------|
| `fr` | Français | Voice, Telephony |
| `en` | English | Voice, Telephony |
| `es` | Español | Voice, Telephony |
| `ar` | العربية | Voice, Telephony |
| `ary` | Darija | Voice, Telephony (Atlas-Chat-9B) |

## Environment Variables

```bash
export VOCALIA_API_KEY="your-api-key"
```

## Error Handling

```typescript
import { VocalIA, AuthenticationError, RateLimitError, CallError } from 'vocalia';

try {
  const client = new VocalIA();
  const response = await client.voice.generateResponse({ text: 'Hello' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof CallError) {
    console.log(`Call failed: ${error.callId}`);
  }
}
```

## TypeScript Support

This SDK is written in TypeScript and includes full type definitions.

```typescript
import type {
  VoiceResponse,
  CallSession,
  Persona,
  Language,
  GenerateResponseParams
} from 'vocalia';
```

## Links

- [Documentation](https://vocalia.ma/docs)
- [API Reference](https://vocalia.ma/docs/api)
- [GitHub](https://github.com/Jouiet/VoicalAI)

## License

MIT License - see LICENSE file.
