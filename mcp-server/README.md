# VocalIA MCP Server

> **Version:** 1.0.0 | **Tools:** 203 | **Resources:** 6 | **Prompts:** 8 | **Transports:** stdio + Streamable HTTP

Model Context Protocol server for the [VocalIA Voice AI Platform](https://vocalia.ma). 203 tools across voice AI, telephony, e-commerce (7 platforms), CRM, billing, exports, and iPaaS integrations.

## Quick Start

```bash
npx @vocalia/mcp-server
```

## Installation

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "npx",
      "args": ["-y", "@vocalia/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add vocalia -- npx -y @vocalia/mcp-server
```

### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "vocalia": {
      "command": "npx",
      "args": ["-y", "@vocalia/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "npx",
      "args": ["-y", "@vocalia/mcp-server"]
    }
  }
}
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "vocalia": {
      "command": "npx",
      "args": ["-y", "@vocalia/mcp-server"]
    }
  }
}
```

## HTTP Transport

For remote access (ChatGPT, n8n, Make.com):

```bash
# Without auth
npx @vocalia/mcp-server --http

# With OAuth 2.1
MCP_OAUTH=true npx @vocalia/mcp-server --http
```

Environment variables:

| Variable | Default | Description |
|:---------|:--------|:------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | `3015` | HTTP server port |
| `MCP_OAUTH` | `false` | Enable OAuth 2.1 authorization |
| `MCP_CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `MCP_RATE_LIMIT` | `100` | Requests per minute per session |

### Endpoints (HTTP mode)

| Method | Path | Description |
|:-------|:-----|:------------|
| POST | `/mcp` | MCP JSON-RPC (initialize, tools/call, etc.) |
| GET | `/mcp` | SSE stream (server-to-client notifications) |
| DELETE | `/mcp` | Terminate session |
| GET | `/health` | Health check |

### OAuth 2.1 Endpoints (when `MCP_OAUTH=true`)

| Method | Path | Description |
|:-------|:-----|:------------|
| GET | `/.well-known/oauth-authorization-server` | Server metadata (RFC 8414) |
| POST | `/register` | Dynamic client registration (RFC 7591) |
| GET | `/authorize` | Authorization endpoint |
| POST | `/token` | Token endpoint (PKCE S256) |
| POST | `/revoke` | Token revocation (RFC 7009) |

## Tools (203)

| Category | Count | Examples |
|:---------|:-----:|:--------|
| Voice AI | 10 | `voice_generate_response`, `personas_list`, `qualify_lead` |
| Telephony | 4 | `telephony_initiate_call`, `messaging_send` |
| Google Workspace | 13 | `sheets_*`, `calendar_*`, `drive_*`, `docs_*`, `gmail_*` |
| E-commerce | 76 | Shopify, WooCommerce, Magento, PrestaShop, BigCommerce, Wix, Squarespace |
| Stripe | 19 | Payment Links, Checkout, Invoices, Refunds |
| CRM & Support | 13 | HubSpot, Pipedrive, Freshdesk, Zendesk |
| Booking | 8 | Calendly, internal calendar |
| iPaaS | 12 | Zapier, Make.com, n8n |
| Exports | 6 | CSV, XLSX, PDF, PDF tables |
| Email | 6 | SMTP, Gmail |
| System | 36 | Knowledge base, UCP, recommendations, Klaviyo, Twilio |

## Resources (6)

| URI | Description |
|:----|:------------|
| `vocalia://config` | Current server configuration |
| `vocalia://personas` | All 38 voice personas |
| `vocalia://platforms` | Supported e-commerce platforms |
| `vocalia://languages` | Supported languages (fr, en, es, ar, ary) |
| `vocalia://tenant/{tenantId}/config` | Tenant-specific configuration |
| `vocalia://tenant/{tenantId}/analytics` | Tenant analytics dashboard |

## Prompts (8)

| Name | Description |
|:-----|:------------|
| `voice-response` | Generate AI voice response |
| `qualify-lead` | BANT lead qualification |
| `book-appointment` | Schedule discovery call |
| `check-order` | Multi-platform order status |
| `create-invoice` | Stripe invoice creation |
| `export-report` | CSV/XLSX/PDF export |
| `onboard-tenant` | New client setup |
| `troubleshoot` | System diagnostics |

## Languages

| Code | Language |
|:-----|:---------|
| `fr` | Francais |
| `en` | English |
| `es` | Espanol |
| `ar` | Arabic MSA |
| `ary` | Darija (Moroccan Arabic) |

## Development

```bash
npm run build       # Build TypeScript
npm run dev         # Watch mode
npm start           # Run stdio
npm run start:http  # Run HTTP
npm run inspector   # MCP Inspector
```

## Requirements

- Node.js >= 18.0.0
- MCP SDK >= 1.26.0

## Security

- SDK v1.26.0 — CVE-2026-25536 safe (session-per-request pattern)
- OAuth 2.1 with PKCE (S256), dynamic client registration
- DNS rebinding protection (SDK built-in)
- Configurable CORS and rate limiting

## License

MIT
