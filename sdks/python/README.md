# VocalIA Python SDK

Official Python SDK for the VocalIA Voice AI Platform.

## Installation

```bash
pip install vocalia
```

## Quick Start

```python
from vocalia import VocalIA

# Initialize client
client = VocalIA(api_key="your-api-key")

# Generate a voice response
response = client.voice.generate_response(
    text="Bonjour, comment puis-je vous aider?",
    persona="AGENCY",
    language="fr"
)
print(response.text)

# Initiate a phone call
call = client.telephony.initiate_call(
    to="+212600000000",
    persona="DENTAL",
    language="fr"
)
print(f"Call ID: {call.id}")
```

## Features

### Voice Widget

```python
# Generate AI response
response = client.voice.generate_response(
    text="Quels sont vos services?",
    persona="PROPERTY",
    language="fr",
    knowledge_base_id="kb_123"
)

# Text-to-speech
audio = client.voice.synthesize(
    text="Bienvenue chez VocalIA",
    language="fr"
)

# Speech-to-text
text = client.voice.transcribe(
    audio_data=audio_bytes,
    language="fr"
)

# List available personas
personas = client.voice.list_personas()
for p in personas:
    print(f"{p.key}: {p.name}")
```

### Telephony (PSTN)

```python
# Make an outbound call
call = client.telephony.initiate_call(
    to="+212600000000",
    persona="DENTAL",
    language="fr",
    webhook_url="https://yourapp.com/webhooks/vocalia",
    metadata={"customer_id": "cust_123"}
)

# Get call status
call = client.telephony.get_call(call.id)
print(f"Status: {call.status}")

# Get transcript
transcript = client.telephony.get_transcript(call.id)
for segment in transcript:
    print(f"{segment['speaker']}: {segment['text']}")

# Transfer call to human
client.telephony.transfer_call(
    call_id=call.id,
    to="+212600000001",
    announce="Transferring you to a specialist"
)
```

### Async Support

```python
from vocalia import AsyncVocalIA

async with AsyncVocalIA(api_key="your-api-key") as client:
    response = await client.voice.generate_response("Hello")
```

## Personas

VocalIA supports 40 industry-specific personas:

| Tier | Personas |
|------|----------|
| Core | AGENCY, DENTAL, PROPERTY, CONTRACTOR, FUNERAL |
| Expansion | HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST, RECRUITER... |
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

```python
from vocalia import VocalIA
from vocalia.exceptions import (
    AuthenticationError,
    RateLimitError,
    CallError,
)

try:
    client = VocalIA()
    response = client.voice.generate_response("Hello")
except AuthenticationError:
    print("Invalid API key")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except CallError as e:
    print(f"Call failed: {e.call_id}")
```

## Links

- [Documentation](https://vocalia.ma/docs)
- [API Reference](https://vocalia.ma/docs/api)
- [GitHub](https://github.com/Jouiet/VoicalAI)

## License

MIT License - see LICENSE file.
