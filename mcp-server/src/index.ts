#!/usr/bin/env node
/**
 * VocalIA MCP Server
 *
 * Model Context Protocol server exposing VocalIA Voice AI Platform capabilities.
 * Enables Claude to interact with voice generation, telephony, personas, and knowledge base.
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
  version: "0.1.0",
});

// Persona enum for reuse
const PersonaEnum = z.enum([
  "AGENCY", "DENTAL", "PROPERTY", "HOA", "SCHOOL", "CONTRACTOR", "FUNERAL",
  "HEALER", "MECHANIC", "COUNSELOR", "CONCIERGE", "STYLIST", "TRAINER",
  "CHEF", "TUTOR", "PHOTOGRAPHER", "FLORIST", "CLEANER", "SECURITY",
  "ACCOUNTANT", "ARCHITECT", "PHARMACIST", "RENTER", "LAWYER", "INSURANCE",
  "BANKER", "RECRUITER", "LOGISTICS"
]);

const LanguageEnum = z.enum(["fr", "en", "es", "ar", "ary"]);

// =============================================================================
// VOICE TOOLS
// =============================================================================

server.tool(
  "voice_generate_response",
  {
    text: z.string().describe("The user's message or query to respond to"),
    persona: PersonaEnum.optional().describe("Industry-specific persona (default: AGENCY)"),
    language: LanguageEnum.optional().describe("Response language (default: fr)"),
    knowledgeBaseId: z.string().optional().describe("Optional knowledge base ID for RAG"),
  },
  async ({ text, persona = "AGENCY", language = "fr", knowledgeBaseId }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/voice/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ text, persona, language, knowledgeBaseId }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { text: string; latency_ms: number };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              response: data.text,
              persona,
              language,
              latency_ms: data.latency_ms,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

server.tool(
  "voice_synthesize",
  {
    text: z.string().describe("Text to convert to speech"),
    language: LanguageEnum.optional().describe("Voice language (default: fr)"),
    voice: z.string().optional().describe("Voice ID or name"),
  },
  async ({ text, language = "fr", voice }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/voice/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ text, language, voice }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { audio_url: string; duration_ms: number; format?: string };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              audio_url: data.audio_url,
              duration_ms: data.duration_ms,
              format: data.format || "mp3",
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

server.tool(
  "voice_transcribe",
  {
    audio_url: z.string().url().describe("URL of audio file to transcribe"),
    language: LanguageEnum.optional().describe("Expected language (auto-detect if not specified)"),
  },
  async ({ audio_url, language }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/voice/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ audio_url, language }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { text: string; detected_language?: string; confidence: number };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              text: data.text,
              language: data.detected_language || language,
              confidence: data.confidence,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

// =============================================================================
// TELEPHONY TOOLS
// =============================================================================

server.tool(
  "telephony_initiate_call",
  {
    to: z.string().describe("Phone number in E.164 format (e.g., +212600000000)"),
    persona: PersonaEnum.optional().describe("AI persona for the call"),
    language: LanguageEnum.optional().describe("Call language (default: fr)"),
    webhookUrl: z.string().url().optional().describe("Webhook URL for call events"),
    metadata: z.record(z.string()).optional().describe("Custom metadata for the call"),
  },
  async ({ to, persona = "AGENCY", language = "fr", webhookUrl, metadata }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/telephony/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ to, persona, language, webhookUrl, metadata }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { id: string; status: string; created_at: string };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              call_id: data.id,
              status: data.status,
              to,
              persona,
              language,
              created_at: data.created_at,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

server.tool(
  "telephony_get_call",
  {
    call_id: z.string().describe("The call ID to retrieve"),
  },
  async ({ call_id }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/telephony/calls/${call_id}`, {
        headers: {
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

server.tool(
  "telephony_get_transcript",
  {
    call_id: z.string().describe("The call ID to get transcript for"),
  },
  async ({ call_id }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/telephony/calls/${call_id}/transcript`, {
        headers: {
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { segments: unknown[]; duration_seconds: number };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              call_id,
              segments: data.segments,
              duration_seconds: data.duration_seconds,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

server.tool(
  "telephony_transfer_call",
  {
    call_id: z.string().describe("The call ID to transfer"),
    to: z.string().describe("Phone number to transfer to (E.164 format)"),
    announce: z.string().optional().describe("Message to announce before transfer"),
  },
  async ({ call_id, to, announce }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/telephony/calls/${call_id}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ to, announce }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { status: string };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              call_id,
              transfer_status: data.status,
              transferred_to: to,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

// =============================================================================
// PERSONA TOOLS
// =============================================================================

server.tool(
  "personas_list",
  {
    tier: z.enum(["core", "expansion", "extended", "all"]).optional().describe("Filter by tier (default: all)"),
  },
  async ({ tier = "all" }) => {
    const personas = {
      core: [
        { key: "AGENCY", name: "Agency Assistant", industries: ["marketing", "advertising", "PR"] },
        { key: "DENTAL", name: "Dental Receptionist", industries: ["dental", "healthcare"] },
        { key: "PROPERTY", name: "Property Manager", industries: ["real-estate", "property"] },
        { key: "HOA", name: "HOA Representative", industries: ["community", "residential"] },
        { key: "SCHOOL", name: "School Administrator", industries: ["education", "academy"] },
        { key: "CONTRACTOR", name: "Contractor Dispatch", industries: ["construction", "trades"] },
        { key: "FUNERAL", name: "Funeral Services", industries: ["funeral", "memorial"] },
      ],
      expansion: [
        { key: "HEALER", name: "Wellness Practitioner", industries: ["spa", "wellness", "holistic"] },
        { key: "MECHANIC", name: "Auto Service Advisor", industries: ["automotive", "repair"] },
        { key: "COUNSELOR", name: "Counseling Intake", industries: ["therapy", "mental-health"] },
        { key: "CONCIERGE", name: "Hotel Concierge", industries: ["hospitality", "travel"] },
        { key: "STYLIST", name: "Salon Coordinator", industries: ["beauty", "salon", "barber"] },
        { key: "TRAINER", name: "Fitness Coach", industries: ["gym", "fitness", "sports"] },
        { key: "CHEF", name: "Restaurant Host", industries: ["restaurant", "catering"] },
        { key: "TUTOR", name: "Education Advisor", industries: ["tutoring", "education"] },
        { key: "PHOTOGRAPHER", name: "Studio Booking", industries: ["photography", "events"] },
        { key: "FLORIST", name: "Floral Consultant", industries: ["florist", "gifts"] },
        { key: "CLEANER", name: "Cleaning Services", industries: ["cleaning", "janitorial"] },
      ],
      extended: [
        { key: "SECURITY", name: "Security Dispatch", industries: ["security", "monitoring"] },
        { key: "ACCOUNTANT", name: "Accounting Intake", industries: ["accounting", "tax"] },
        { key: "ARCHITECT", name: "Architecture Firm", industries: ["architecture", "design"] },
        { key: "PHARMACIST", name: "Pharmacy Assistant", industries: ["pharmacy", "healthcare"] },
        { key: "RENTER", name: "Rental Agent", industries: ["rentals", "equipment"] },
        { key: "LAWYER", name: "Legal Intake", industries: ["legal", "law-firm"] },
        { key: "INSURANCE", name: "Insurance Agent", industries: ["insurance", "claims"] },
        { key: "BANKER", name: "Banking Services", industries: ["banking", "finance"] },
        { key: "RECRUITER", name: "Recruitment Agent", industries: ["HR", "staffing"] },
        { key: "LOGISTICS", name: "Logistics Coordinator", industries: ["shipping", "logistics"] },
      ],
    };

    let result;
    if (tier === "all") {
      result = { ...personas, total: 28 };
    } else {
      result = { [tier]: personas[tier as keyof typeof personas], total: personas[tier as keyof typeof personas].length };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// =============================================================================
// KNOWLEDGE BASE TOOLS
// =============================================================================

server.tool(
  "knowledge_base_search",
  {
    query: z.string().describe("Search query"),
    persona: z.string().optional().describe("Filter by persona context"),
    language: LanguageEnum.optional().describe("Language filter"),
    limit: z.number().min(1).max(20).optional().describe("Maximum results (default: 5)"),
  },
  async ({ query, persona, language, limit = 5 }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/knowledge-base/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ query, persona, language, limit }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { results: unknown[]; total: number };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              query,
              results: data.results,
              total_found: data.total,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

// =============================================================================
// LEAD QUALIFICATION TOOLS (from 11 function tools)
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

server.tool(
  "schedule_callback",
  {
    phone: z.string().describe("Phone number (E.164 format)"),
    datetime: z.string().describe("Callback datetime (ISO 8601)"),
    persona: z.string().optional().describe("Persona for the callback"),
    notes: z.string().optional().describe("Notes for the callback"),
  },
  async ({ phone, datetime, persona, notes }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/v1/callbacks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VOCALIA_API_KEY}`,
        },
        body: JSON.stringify({ phone, datetime, persona, notes }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as { id: string };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              callback_id: data.id,
              phone,
              scheduled_for: datetime,
              status: "scheduled",
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Connection error: ${(error as Error).message}` }] };
    }
  }
);

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VocalIA MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
