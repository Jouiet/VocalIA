# VocalIA MCP Server

[![npm version](https://img.shields.io/npm/v/@vocalia/mcp-server.svg)](https://www.npmjs.com/package/@vocalia/mcp-server)
![MCP Tools](https://img.shields.io/badge/MCP_tools-203-blue)
![MCP Resources](https://img.shields.io/badge/resources-6-green)
![MCP Prompts](https://img.shields.io/badge/prompts-8-orange)

> **Version:** 1.0.0 | **Tools:** 203 | **Resources:** 6 | **Prompts:** 8 | **Transports:** stdio + Streamable HTTP

Model Context Protocol server for the [VocalIA Voice AI Platform](https://vocalia.ma). 203 tools across voice AI, telephony, e-commerce (7 platforms), CRM, billing, exports, and iPaaS integrations.

## Important: Transport Modes

| Mode | Use case | Standalone? |
|:-----|:---------|:------------|
| **HTTP remote** | Connect to the hosted VocalIA API at `https://api.vocalia.ma/mcp` | Yes |
| **stdio (npx)** | Local development with the full VocalIA repository cloned | No — requires the complete project tree |

**For standalone usage, HTTP remote mode is recommended.** The stdio mode resolves internal modules (`../core/`, `../personas/`) that are only present in the full VocalIA installation.

## Quick Start

```bash
npx @vocalia/mcp-server
```

## Remote Server (Recommended for Standalone)

Connect directly to the hosted VocalIA MCP server — no local installation needed:

```json
{
  "mcpServers": {
    "vocalia": {
      "type": "url",
      "url": "https://api.vocalia.ma/mcp"
    }
  }
}
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

## Architectural Overview

VocalIA MCP operates as a high-density integration layer. Unlike traditional MCP servers that provide 5-10 utility tools, VocalIA exposes **203 specialized tools** that interface directly with the core VocalIA Voice Engine and external ecosystem (7 e-commerce platforms, 4 CRMs, 3 iPaaS).

### High-Density Tooling

- **Dynamic Personas:** Toggle between 38 industry-trained AI personalities.
- **Unified E-commerce API:** A single set of tools (`orders_*`, `products_*`, `customers_*`) that works transparently across Shopify, Magento, WooCommerce, etc.
- **Contextual Telemetry:** Tools provide rich metadata back to the LLM to improve reasoning accuracy during voice dialogues.

## Prompt Examples for LLMs

To get the most out of VocalIA tools in Claude, Cursor, or Cline, use specific prompts:

### Example 1: Lead Qualification Setup
>
> "Check my current tenant configuration using `vocalia://config`. Then, identify the `SAAS` persona and set up a BANT qualification flow for my website visitors."

### Example 2: Multi-Platform Inventory Audit
>
> "List all out-of-stock products across my Shopify and WooCommerce stores using the e-commerce tools, and generate a consolidated PDF report using the `exports` tools."

### Example 3: Voice Response Tuning
>
> "Analyze the last 5 voice transcripts from `vocalia://tenant/{id}/analytics` and propose a refined system prompt for the `HEALTHCARE` persona to improve empathy scores."

## Security & Compliance

VocalIA MCP is built for enterprise-grade security, implementing the latest RFCs and best practices:

### Authorization (OAuth 2.1)

When running in HTTP mode with `MCP_OAUTH=true`, the server implements:

- **RFC 6749/6750:** Standardized Bearer token usage.
- **RFC 7636 (PKCE):** Proof Key for Code Exchange with S256 for secure client-side auth.
- **RFC 7591:** Dynamic Client Registration for automated onboarding of MCP clients.
- **RFC 8414:** Authorization Server Metadata discovery.

### Operational Security

- **Session Isolation:** Each MCP session is isolated with its own memory space for tool context.
- **Rate Limiting:** Defaults to 100 requests/minute per session to prevent API abuse.
- **DNS Rebinding Protection:** Built-in safeguards against local network exploration via the MCP client.
- **CVE-2026-25536 Safe:** Uses the recommended session-per-request pattern to avoid cross-session contamination.

## Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `MCP_TRANSPORT` | `stdio` | `stdio` (local pipe) or `http` (SSE). |
| `MCP_PORT` | `3015` | Listener port for HTTP mode. |
| `MCP_OAUTH` | `false` | Enable/Disable OAuth 2.1 layer. |
| `MCP_CORS_ORIGINS` | `*` | Authorized origins for cross-site requests. |
| `MCP_RATE_LIMIT` | `100` | Max requests per minute per identifier. |
| `VOCALIA_API_URL` | `https://api.vocalia.ma` | Root URL for the VocalIA ecosystem. |

## Development & Extension

The server is written in TypeScript and uses a modular tool registration pattern.

```bash
npm run build       # Compile TS to JS in dist/
npm run inspector   # Launch the MCP Inspector tool
```

### Adding New Tools

Tools are located in `dist/tools/`. To add a new integration, follow the pattern in `dist/tools/shopify.js` ensuring full type-safety for arguments.

## Enterprise & White-Label

VocalIA provides managed MCP instances for enterprise clients. This includes:

- **Private Registries:** Host your own MCP tools securely.
- **Custom Adapters:** Build proprietary connectors to internal legacy systems.
- **Guaranteed SLIs:** 99.99% availability for the Hosted MCP layer.

Contact [dev@vocalia.ma](mailto:dev@vocalia.ma) for API keys and integration support.

## License

MIT © [Jouiet/VocalIA](https://github.com/Jouiet/VocalIA)
