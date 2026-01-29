# VocalIA MCP Server

Model Context Protocol server for the VocalIA Voice AI Platform.

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "node",
      "args": ["/path/to/VocalIA/mcp-server/dist/index.js"],
      "env": {
        "VOCALIA_API_URL": "http://localhost:3004",
        "VOCALIA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

### Voice Tools
| Tool | Description |
|:-----|:------------|
| `voice_generate_response` | Generate AI voice response with persona |
| `voice_synthesize` | Text-to-speech conversion |
| `voice_transcribe` | Speech-to-text transcription |

### Telephony Tools
| Tool | Description |
|:-----|:------------|
| `telephony_initiate_call` | Start outbound AI phone call |
| `telephony_get_call` | Get call status and details |
| `telephony_get_transcript` | Get conversation transcript |
| `telephony_transfer_call` | Transfer to human agent |

### Persona & Knowledge Base
| Tool | Description |
|:-----|:------------|
| `personas_list` | List all 28 industry personas |
| `knowledge_base_search` | RAG search in knowledge base |
| `qualify_lead` | BANT lead qualification |
| `schedule_callback` | Schedule follow-up callback |

## Languages Supported

| Code | Language |
|:-----|:---------|
| `fr` | Francais |
| `en` | English |
| `es` | Espanol |
| `ar` | Arabic MSA |
| `ary` | Darija (Moroccan Arabic) |

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build
npm start      # Run server
npm run inspector  # MCP Inspector debug
```

## Requirements

- Node.js >= 18.0.0
- VocalIA API running (localhost:3004 or api.vocalia.ma)

## License

MIT
