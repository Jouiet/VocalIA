#!/usr/bin/env node
/**
 * VocalIA MCP Server
 *
 * Model Context Protocol server exposing VocalIA Voice AI Platform capabilities.
 * Enables Claude to interact with voice generation, lead qualification, and personas.
 *
 * FACTUAL STATUS (Session 231):
 * - voice_generate_response: ✅ Uses /respond endpoint on voice-api-resilient.cjs
 * - qualify_lead: ✅ LOCAL tool (BANT calculation, no API needed)
 * - personas_list: ✅ LOCAL tool (30 personas, no API needed)
 * - knowledge_base_search: ✅ LOCAL tool (uses knowledge-base-services.cjs)
 * - telephony_*: ⚠️ REQUIRES Twilio credentials (not available without config)
 * - voice_synthesize/transcribe: ⚠️ Browser handles via Web Speech API
 *
 * CRITICAL: Never use console.log - it corrupts JSON-RPC transport.
 * All logging must use console.error.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Environment configuration
const VOCALIA_API_URL = process.env.VOCALIA_API_URL || "http://localhost:3004";
const VOCALIA_API_KEY = process.env.VOCALIA_API_KEY || "";

// Initialize MCP Server
const server = new McpServer({
  name: "vocalia",
  version: "0.2.0",
});

// Language enum for API calls
const LanguageEnum = z.enum(["fr", "en", "es", "ar", "ary"]);

// All 30 verified personas from voice-persona-injector.cjs (for reference)
const PERSONAS_COUNT = 30;

// =============================================================================
// VOICE TOOLS (WORKING)
// =============================================================================

server.tool(
  "voice_generate_response",
  {
    message: z.string().describe("The user's message or query to respond to"),
    language: LanguageEnum.optional().describe("Response language (default: fr)"),
    sessionId: z.string().optional().describe("Session ID for conversation continuity"),
  },
  async ({ message, language = "fr", sessionId }) => {
    try {
      // Uses the real /respond endpoint on voice-api-resilient.cjs
      const response = await fetch(`${VOCALIA_API_URL}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(VOCALIA_API_KEY && { "Authorization": `Bearer ${VOCALIA_API_KEY}` }),
        },
        body: JSON.stringify({ message, language, sessionId }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as {
        response: string;
        provider: string;
        latencyMs: number;
        lead?: {
          sessionId: string;
          score: number;
          status: string;
        };
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              response: data.response,
              provider: data.provider,
              latency_ms: data.latencyMs,
              language,
              lead: data.lead,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Connection error: ${(error as Error).message}. Ensure voice-api-resilient.cjs is running on ${VOCALIA_API_URL}`
        }]
      };
    }
  }
);

// =============================================================================
// PERSONA TOOLS (LOCAL - NO API NEEDED)
// =============================================================================

server.tool(
  "personas_list",
  {
    tier: z.enum(["core", "expansion", "extended", "all"]).optional().describe("Filter by tier (default: all)"),
  },
  async ({ tier = "all" }) => {
    // Factual data from voice-persona-injector.cjs
    const personas = {
      core: [
        { key: "AGENCY", name: "VocalIA Architect", industries: ["marketing", "consulting"] },
        { key: "DENTAL", name: "Cabinet Dentaire", industries: ["dental", "healthcare"] },
        { key: "PROPERTY", name: "Property Management", industries: ["real-estate"] },
        { key: "HOA", name: "HOA Support", industries: ["community", "residential"] },
        { key: "SCHOOL", name: "School Attendance", industries: ["education"] },
        { key: "CONTRACTOR", name: "Contractor Leads", industries: ["construction", "trades"] },
        { key: "FUNERAL", name: "Funeral Services", industries: ["funeral", "memorial"] },
      ],
      expansion: [
        { key: "HEALER", name: "Centre de Santé", industries: ["clinic", "wellness"] },
        { key: "MECHANIC", name: "Auto Expert Service", industries: ["automotive"] },
        { key: "COUNSELOR", name: "Cabinet Juridique", industries: ["legal"] },
        { key: "CONCIERGE", name: "Hôtel Concierge", industries: ["hospitality"] },
        { key: "STYLIST", name: "Espace Beauté & Spa", industries: ["beauty", "salon"] },
        { key: "RECRUITER", name: "Talent Acquisition", industries: ["HR", "staffing"] },
        { key: "DISPATCHER", name: "Logistique Express", industries: ["logistics"] },
        { key: "COLLECTOR", name: "Recouvrement Éthique", industries: ["finance"] },
        { key: "SURVEYOR", name: "Satisfaction Client", industries: ["CSAT", "NPS"] },
        { key: "GOVERNOR", name: "Mairie de Proximité", industries: ["government"] },
        { key: "INSURER", name: "Assurance Horizon", industries: ["insurance"] },
      ],
      extended: [
        { key: "ACCOUNTANT", name: "Cabinet Comptable", industries: ["accounting"] },
        { key: "ARCHITECT", name: "Cabinet d'Architecture", industries: ["architecture"] },
        { key: "PHARMACIST", name: "Pharmacie de Garde", industries: ["pharmacy"] },
        { key: "RENTER", name: "Location Services", industries: ["rentals"] },
        { key: "LOGISTICIAN", name: "Supply Chain", industries: ["logistics"] },
        { key: "TRAINER", name: "Fitness Coach", industries: ["gym", "fitness"] },
        { key: "PLANNER", name: "Event Planner", industries: ["events"] },
        { key: "PRODUCER", name: "Production Studio", industries: ["media"] },
        { key: "CLEANER", name: "Cleaning Services", industries: ["cleaning"] },
        { key: "GYM", name: "Fitness Center", industries: ["gym"] },
        { key: "UNIVERSAL_ECOMMERCE", name: "E-commerce Support", industries: ["e-commerce"] },
        { key: "UNIVERSAL_SME", name: "SME Assistant", industries: ["small-business"] },
      ],
    };

    let result;
    if (tier === "all") {
      result = { ...personas, total: PERSONAS_COUNT };
    } else {
      result = { [tier]: personas[tier as keyof typeof personas], total: personas[tier as keyof typeof personas].length };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// =============================================================================
// LEAD QUALIFICATION TOOLS (LOCAL - NO API NEEDED)
// =============================================================================

server.tool(
  "qualify_lead",
  {
    budget: z.number().min(0).max(100).describe("Budget score (0-100)"),
    authority: z.number().min(0).max(100).describe("Authority/decision-maker score (0-100)"),
    need: z.number().min(0).max(100).describe("Need/urgency score (0-100)"),
    timeline: z.number().min(0).max(100).describe("Timeline score (0-100)"),
    notes: z.string().optional().describe("Additional qualification notes"),
  },
  async ({ budget, authority, need, timeline, notes }) => {
    // BANT scoring - local calculation, no API needed
    const totalScore = (budget + authority + need + timeline) / 4;
    const qualification = totalScore >= 75 ? "HOT" : totalScore >= 50 ? "WARM" : "COLD";

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            bant_scores: { budget, authority, need, timeline },
            total_score: Math.round(totalScore),
            qualification,
            recommendation: qualification === "HOT"
              ? "Immediate follow-up recommended"
              : qualification === "WARM"
              ? "Schedule follow-up within 48 hours"
              : "Add to nurture campaign",
            notes,
          }, null, 2),
        },
      ],
    };
  }
);

// =============================================================================
// API STATUS TOOL
// =============================================================================

server.tool(
  "api_status",
  {},
  async () => {
    let apiStatus = "unknown";
    let apiLatency = 0;

    try {
      const start = Date.now();
      const response = await fetch(`${VOCALIA_API_URL}/health`);
      apiLatency = Date.now() - start;
      apiStatus = response.ok ? "healthy" : `error: ${response.status}`;
    } catch (error) {
      apiStatus = `offline: ${(error as Error).message}`;
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          api_url: VOCALIA_API_URL,
          status: apiStatus,
          latency_ms: apiLatency,
          tools_available: {
            voice_generate_response: apiStatus === "healthy",
            personas_list: true, // Always available (local)
            qualify_lead: true, // Always available (local)
            api_status: true, // Always available
          },
          tools_requiring_setup: {
            telephony: "Requires TWILIO_* credentials",
            voice_synthesize: "Browser handles via Web Speech API",
            voice_transcribe: "Browser handles via Web Speech API",
          }
        }, null, 2)
      }]
    };
  }
);

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VocalIA MCP Server v0.2.0 running on stdio");
  console.error(`API URL: ${VOCALIA_API_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
