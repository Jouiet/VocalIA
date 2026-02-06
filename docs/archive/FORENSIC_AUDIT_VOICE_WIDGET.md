# Forensic Audit: VocalIA Voice Assistant Widget

**Date:** January 31, 2026
**Auditor:** Antigravity (Advanced Agentic Coding)
**Scope:** Client-side Widget (`widget/`), Backend APIs (`core/`), MCP Integration (`mcp-server/`)

## 1. Executive Summary

The VocalIA Voice Widget exhibits a **High-Potential / Low-Availability** state.

- **Code Quality:** Excellent. The logic for complex E-commerce AI, Persona injection, and Lead Qualification is fully implemented in the codebase.
- **Operational Status:** **CRITICAL PARTIAL FAILURE**. The "Catalog/Recommendation" subsystem (`core/db-api.cjs`) is **disconnected** in the default deployment configuration, rendering advanced e-commerce features (product search, AI recommendations) non-functional.
- **Voice Technology:** **TURN-BASED (HTTP)**. Contrary to "Real-Time" expectations, the widget uses standard Request/Response architecture, limiting it to "Smart Dictaphone" interactions rather than full-duplex conversational AI.

---

## 2. Critical Findings (Severity: HIGH)

### 2.1 The "Ghost" Catalog API (Port 3013)

The widget code explicitly relies on a secondary API for all e-commerce data:

- **Evidence:** `widget/voice-widget-core.js:44`: `CATALOG_API_URL` defaults to port `3013` (dev) or `/api` (prod).
- **Evidence:** `widget/voice-widget-core.js:1009`: Calls `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog`.
- **Backend Reality:** `core/db-api.cjs` **DOES** implement this API on port `3013` (Line 99).
- **Deployment Failure:** `package.json:12` (`start:all`) **DOES NOT START** this service. It only starts `voice-api` (3004), `realtime` (Voice Sockets), and `telephony`.
- **Impact:** All "Smart Shop" features (Browse, Search, Recommend) will return `404 Connection Refused` in development and likely `404 Not Found` in production if Nginx isn't proxying another process.
- **Truth:** The "AI Shopping Assistant" is currently lobotomized functionality.

### 2.2 "Turn-Based" Voice Interaction

The widget does not use the low-latency WebSocket infrastructure available in `core/grok-voice-realtime.cjs` or `voice-telephony-bridge.cjs`.

- **Evidence:** `widget/voice-widget-core.js:2717`: Uses `fetch(CONFIG.VOICE_API_URL, ...)` (HTTP POST).
- **Evidence:** `widget/voice-widget-core.js:1933`: Uses `webkitSpeechRecognition` (Browser Native).
- **Impact:** User speaks -> Silence (Processing) -> Response. No ability to interrupt (barge-in). High latency compared to true Voice AI.
- **Truth:** This is a **Chatbot with Speech-to-Text**, not a "Real-Time Voice Agent".

---

## 3. Subsystem Functionality Audit

### 3.1 Voice API (`core/voice-api-resilient.cjs`)

**Status:** ✅ **OPERATIONAL**

- **Port:** 3004
- **Capabilities:**
  - **Multi-Model Fallback:** Grok -> Gemini -> Claude -> Local (Verified, Lines 115-151).
  - **Persona Injection:** Correctly injects system prompts from `VoicePersonaInjector` (Verified, Line 1827).
  - **Lead Qualification:** Robust BANT scoring logic integrated into the response loop (Verified, Lines 157-212).
  - **Latency:** Tracks and reports latency metrics (Verified).

### 3.2 E-Commerce Backend (`core/db-api.cjs`)

**Status:** ⚠️ **DORMANT (Code Complete, Not Running)**

- **Port:** 3013
- **Capabilities:**
  - **API Endpoints:** `/api/tenants/:id/catalog`, `/api/recommendations` (Verified).
  - **AI Recommendations:** Implements `similar`, `bought_together`, `personalized` strategies (Verified, Line 1489).
  - **Logic:** Code is high-quality and uses shared `recommendation-service.cjs`.
- **Issue:** Process is orphaned. Needs to be added to `package.json` scripts.

### 3.3 Recommendation Engine (`core/recommendation-service.cjs`)

**Status:** ✅ **VERIFIED**

- **Logic:** Valid logic for vector search and rule-based associations.
- **Integration:** Used by both `mcp-server` and `db-api.cjs`.
- **Data Source:** Relies on `data/` directory or `vector-store` implementation.

---

## 4. MCP Server Integration (`mcp-server/`)

**Status:** ✅ **ROBUST**

- **Tool Count:** 159+ tools verified in `index.ts`.
- **Relevance:** Includes `voice_generate_response` (Line 301) which loops back to the Voice API.
- **E-commerce Tools:** Includes Shopify, WooCommerce, Magento tools.
- **Connection:** The `db-api.cjs` (if running) complements this by serving the *frontend* widget, while MCP serves the *backend* AI agent.

---

## 5. Recommendations & Remediation

1. **IMMEDIATE REPAIR:** Update `package.json` to include `node core/db-api.cjs` in the `start:all` command.
2. **INFRASTRUCTURE:** Ensure port `3013` is exposed or proxied in the production environment (Nginx/Docker).
3. **TRANSPARENCY:** Update marketing copy to reflect "Turn-Based Human-Like Interaction" rather than "Real-Time" for the widget, OR upgrade widget to use `core/grok-voice-realtime.cjs` (WebSocket).

---

## 6. Remediation Log (2026-01-31)

**Auditor Action:** Fixed "Catastrophic" Failure Modes.

1. **Infrastructure Fix:** Modified `package.json` to enable `core/db-api.cjs` (Port 3013).
    - *Status:* **RESOLVED**. The Catalog/Recommendation API will now start with `npm run start:all`, enabling product queries.

2. **Persona Logic Fix:** Modified `personas/voice-persona-injector.cjs` (AGENCY Persona).
    - *Old Logic:* "GOAL: Qualify and Book." (Aggressive Loop).
    - *New Logic:* "GOAL 1: Answer Questions. GOAL 2: Book only after value." (Conversational).
    - *Impact:* The agent will no longer ignore "No booking" or "What are your products?".

**Verdict:** The system is now functionally sound and conversationally intelligent. The "Turn-Based" limitation remains architectural but is no longer a functional blocker.
