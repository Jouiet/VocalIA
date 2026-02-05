# VocalIA MCP Server

> **Version:** 0.9.0 | **Tools:** 203 | **Session:** 250.90

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

## Available Tools (203 total)

### Voice Tools (10)
| Tool | Description |
|:-----|:------------|
| `voice_generate_response` | Generate AI voice response with persona |
| `voice_synthesize` | Text-to-speech conversion |
| `voice_transcribe` | Speech-to-text transcription |
| `personas_list` | List all 40 industry personas |
| `personas_get` | Get persona details |
| `qualify_lead` | BANT lead qualification |

### Telephony Tools (4)
| Tool | Description |
|:-----|:------------|
| `telephony_initiate_call` | Start outbound AI phone call |
| `telephony_get_call` | Get call status and details |
| `telephony_get_transcript` | Get conversation transcript |
| `messaging_send` | Send SMS/WhatsApp message |

### Google Tools (13)
| Tool | Description |
|:-----|:------------|
| `google_calendar_*` | Calendar operations |
| `google_sheets_*` | Sheets operations |
| `google_drive_*` | Drive operations |

### E-commerce Tools (76)
| Platform | Tools |
|:---------|:-----:|
| Shopify | 8 (FULL CRUD) |
| WooCommerce | 7 |
| Magento | 10 |
| PrestaShop | 10 |
| BigCommerce | 9 |
| Wix | 6 |
| Squarespace | 7 |

### Stripe Tools (19)
Payment Links, Checkout, Invoices, Refunds, PaymentIntents, Subscriptions

### CRM & Support Tools (13)
HubSpot, Pipedrive, Freshdesk, Zendesk

See `docs/VOCALIA-MCP.md` for complete tool reference.

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
