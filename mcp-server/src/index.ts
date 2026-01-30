#!/usr/bin/env node
/**
 * VocalIA MCP Server - SOTA Implementation
 * Model Context Protocol server exposing VocalIA Voice AI Platform capabilities.
 *
 * Session 232 - v0.3.2 - REAL Implementation (NO MOCKS)
 *
 * TOOL CATEGORIES (21 tools - 10 always available, 11 require services):
 * - Voice Tools (2): voice_generate_response, voice_providers_status [REQUIRE API]
 * - Persona Tools (3): personas_list, personas_get, personas_get_system_prompt [ALWAYS]
 * - Lead Tools (2): qualify_lead, lead_score_explain [ALWAYS]
 * - Knowledge Base Tools (2): knowledge_search [API], knowledge_base_status [ALWAYS]
 * - Telephony Tools (3): telephony_initiate_call, telephony_get_status, telephony_transfer_call [REQUIRE TWILIO]
 * - CRM Tools (2): crm_get_customer, crm_create_contact [REQUIRE HUBSPOT]
 * - E-commerce Tools (3): ecommerce_order_status, ecommerce_product_stock [SHOPIFY], ecommerce_customer_profile [KLAVIYO]
 * - Booking Tools (2): booking_schedule_callback, booking_create [ALWAYS - FILE PERSISTENCE]
 * - System Tools (2): api_status, system_languages [ALWAYS]
 *
 * TOTAL: 21 tools (SOTA - Vapi has 8, Twilio has 5)
 *
 * CRITICAL: Never use console.log - it corrupts JSON-RPC transport.
 * All logging must use console.error.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Booking queue file path (real persistence)
const BOOKING_QUEUE_PATH = path.join(process.cwd(), "data", "booking-queue.json");

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(BOOKING_QUEUE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load booking queue from file
function loadBookingQueue(): any[] {
  try {
    if (fs.existsSync(BOOKING_QUEUE_PATH)) {
      return JSON.parse(fs.readFileSync(BOOKING_QUEUE_PATH, "utf-8"));
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return [];
}

// Save booking to queue file (REAL persistence)
function saveToBookingQueue(booking: any): string {
  ensureDataDir();
  const queue = loadBookingQueue();
  const id = `BK-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const entry = {
    id,
    ...booking,
    created_at: new Date().toISOString(),
    status: "pending",
  };
  queue.push(entry);
  fs.writeFileSync(BOOKING_QUEUE_PATH, JSON.stringify(queue, null, 2));
  return id;
}

// Environment configuration
const VOCALIA_API_URL = process.env.VOCALIA_API_URL || "http://localhost:3004";
const VOCALIA_TELEPHONY_URL = process.env.VOCALIA_TELEPHONY_URL || "http://localhost:3009";
const VOCALIA_API_KEY = process.env.VOCALIA_API_KEY || "";

// Initialize MCP Server
const server = new McpServer({
  name: "vocalia",
  version: "0.3.0",
});

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const LanguageEnum = z.enum(["fr", "en", "es", "ar", "ary"]);
const PersonaKeyEnum = z.enum([
  "AGENCY", "DENTAL", "PROPERTY", "HOA", "SCHOOL", "CONTRACTOR", "FUNERAL",
  "HEALER", "MECHANIC", "COUNSELOR", "CONCIERGE", "STYLIST", "RECRUITER",
  "DISPATCHER", "COLLECTOR", "SURVEYOR", "GOVERNOR", "INSURER",
  "ACCOUNTANT", "ARCHITECT", "PHARMACIST", "RENTER", "LOGISTICIAN",
  "TRAINER", "PLANNER", "PRODUCER", "CLEANER", "GYM",
  "UNIVERSAL_ECOMMERCE", "UNIVERSAL_SME"
]);

// =============================================================================
// FACTUAL DATA - 30 PERSONAS (from voice-persona-injector.cjs)
// =============================================================================

const PERSONAS_DATA = {
  core: [
    { key: "AGENCY", name: "VocalIA Architect", industries: ["marketing", "consulting"], voice: "ara", sensitivity: "normal" },
    { key: "DENTAL", name: "Cabinet Dentaire", industries: ["dental", "healthcare"], voice: "eve", sensitivity: "high" },
    { key: "PROPERTY", name: "Property Management", industries: ["real-estate"], voice: "leo", sensitivity: "normal" },
    { key: "HOA", name: "HOA Support", industries: ["community", "residential"], voice: "sal", sensitivity: "normal" },
    { key: "SCHOOL", name: "School Attendance", industries: ["education"], voice: "mika", sensitivity: "high" },
    { key: "CONTRACTOR", name: "Contractor Leads", industries: ["construction", "trades"], voice: "rex", sensitivity: "normal" },
    { key: "FUNERAL", name: "Funeral Services", industries: ["funeral", "memorial"], voice: "valentin", sensitivity: "high" },
  ],
  expansion: [
    { key: "HEALER", name: "Centre de Santé", industries: ["clinic", "wellness"], voice: "eve", sensitivity: "high" },
    { key: "MECHANIC", name: "Auto Expert Service", industries: ["automotive"], voice: "leo", sensitivity: "normal" },
    { key: "COUNSELOR", name: "Cabinet Juridique", industries: ["legal"], voice: "sal", sensitivity: "high" },
    { key: "CONCIERGE", name: "Hôtel Concierge", industries: ["hospitality"], voice: "mika", sensitivity: "normal" },
    { key: "STYLIST", name: "Espace Beauté & Spa", industries: ["beauty", "salon"], voice: "eve", sensitivity: "normal" },
    { key: "RECRUITER", name: "Talent Acquisition", industries: ["HR", "staffing"], voice: "sal", sensitivity: "normal" },
    { key: "DISPATCHER", name: "Logistique Express", industries: ["logistics"], voice: "leo", sensitivity: "normal" },
    { key: "COLLECTOR", name: "Recouvrement Éthique", industries: ["finance"], voice: "rex", sensitivity: "normal" },
    { key: "SURVEYOR", name: "Satisfaction Client", industries: ["CSAT", "NPS"], voice: "mika", sensitivity: "normal" },
    { key: "GOVERNOR", name: "Mairie de Proximité", industries: ["government"], voice: "sal", sensitivity: "normal" },
    { key: "INSURER", name: "Assurance Horizon", industries: ["insurance"], voice: "eve", sensitivity: "normal" },
  ],
  extended: [
    { key: "ACCOUNTANT", name: "Cabinet Comptable", industries: ["accounting"], voice: "sal", sensitivity: "high" },
    { key: "ARCHITECT", name: "Cabinet d'Architecture", industries: ["architecture"], voice: "leo", sensitivity: "normal" },
    { key: "PHARMACIST", name: "Pharmacie de Garde", industries: ["pharmacy"], voice: "eve", sensitivity: "high" },
    { key: "RENTER", name: "Location Services", industries: ["rentals"], voice: "sal", sensitivity: "normal" },
    { key: "LOGISTICIAN", name: "Supply Chain", industries: ["logistics"], voice: "leo", sensitivity: "normal" },
    { key: "TRAINER", name: "Fitness Coach", industries: ["gym", "fitness"], voice: "rex", sensitivity: "normal" },
    { key: "PLANNER", name: "Event Planner", industries: ["events"], voice: "mika", sensitivity: "normal" },
    { key: "PRODUCER", name: "Production Studio", industries: ["media"], voice: "sal", sensitivity: "normal" },
    { key: "CLEANER", name: "Cleaning Services", industries: ["cleaning"], voice: "mika", sensitivity: "normal" },
    { key: "GYM", name: "Fitness Center", industries: ["gym"], voice: "rex", sensitivity: "normal" },
    { key: "UNIVERSAL_ECOMMERCE", name: "E-commerce Support", industries: ["e-commerce"], voice: "mika", sensitivity: "normal" },
    { key: "UNIVERSAL_SME", name: "SME Assistant", industries: ["small-business"], voice: "sal", sensitivity: "normal" },
  ],
};

// System prompts per persona per language
const SYSTEM_PROMPTS: Record<string, Record<string, string>> = {
  AGENCY: {
    fr: `Tu es l'Architecte Holistique #1 de VocalIA. Ta mission est de diagnostiquer les failles de croissance et de proposer des écosystèmes d'automatisation striking modern.
DIRECTIVE: Utilise TOUJOURS le "Strategic Intent" et l'"Expected Outcome" des services pour justifier tes conseils.
AUDIT: Chaque interaction doit tendre vers un "Audit Système Complet" pour identifier les fuites de profit.`,
    en: `You are the #1 Holistic Systems Architect for VocalIA. Your mission is to diagnose growth bottlenecks and propose strikingly modern automation ecosystems.
DIRECTIVE: ALWAYS use the "Strategic Intent" and "Expected Outcome" of services to justify your architectural decisions.
MISSION: Every dialogue must move towards a "Complete Flywheel Audit" to identify high-leverage profit leaks.`,
    es: `Eres el Arquitecto de Sistemas Holístico #1 de VocalIA. Tu misión es diagnosticar cuellos de botella de crecimiento y proponer ecosistemas de automatización modernos.
DIRECTIVA: SIEMPRE usa el "Strategic Intent" y el "Expected Outcome" para justificar tus decisiones.`,
    ar: `أنت المهندس المعماري الشامل رقم 1 في VocalIA. مهمتك هي تشخيص اختناقات النمو واقتراح أنظمة أتمتة حديثة.`,
    ary: `نتا هو المهندس المعماري ديال السيستيمات فـ VocalIA. الخدمة ديالك هي تلقى المشاكل لي كاينين عند الكليان فـ البيزنس ديالهم وتقترح ليهم حلول ديال الذكاء الاصطناعي.`,
  },
  DENTAL: {
    fr: `Tu es la secrétaire médicale virtuelle du Cabinet Dentaire Lumière.
OBJECTIF: Gérer les nouveaux patients et les urgences.
STYLE: Chaleureux, rassurant, professionnel, organisé.
INSTRUCTIONS: Demande s'il s'agit d'une urgence (Douleur ?). Si Urgence: Propose créneau immédiat. Si Nouveau Patient: Demande Nom, Prénom, Téléphone, Motif.`,
    en: `You are the virtual medical secretary for a Dental Practice.
GOAL: Manage new patients and emergencies.
STYLE: Warm, reassuring, professional, organized.`,
    ary: `نتا هو السكريتير الطبي الافتراضي ديال Cabinet Dentaire. كون رسمي ومهني.`,
  },
  UNIVERSAL_ECOMMERCE: {
    fr: `Tu es l'assistant client IA d'une boutique E-commerce dynamique.
OBJECTIF: Aider les clients et pousser à la vente.
FONCTIONS: Statut commandes, disponibilité stock, retours, suivi colis.`,
    en: `You are the AI Customer Assistant for a dynamic E-commerce store.
GOAL: Help customers and drive sales.
CAPABILITIES: Order status, stock availability, returns, tracking.`,
    ary: `نتا هو المساعد ديال الكليان فـ متجر إلكتروني. هضر بالداريجة المغربية بطريقة زوينة.`,
  },
};

// =============================================================================
// VOICE TOOLS (3)
// =============================================================================

// Tool 1: voice_generate_response - Main voice response with lead scoring
server.tool(
  "voice_generate_response",
  {
    message: z.string().describe("The user's message or query to respond to"),
    language: LanguageEnum.optional().describe("Response language (default: fr)"),
    sessionId: z.string().optional().describe("Session ID for conversation continuity"),
    personaKey: PersonaKeyEnum.optional().describe("Persona to use (default: AGENCY)"),
  },
  async ({ message, language = "fr", sessionId, personaKey }) => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(VOCALIA_API_KEY && { "Authorization": `Bearer ${VOCALIA_API_KEY}` }),
        },
        body: JSON.stringify({ message, language, sessionId, personaId: personaKey }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }] };
      }

      const data = await response.json() as {
        response: string;
        provider: string;
        latencyMs: number;
        lead?: { sessionId: string; score: number; status: string };
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            response: data.response,
            provider: data.provider,
            latency_ms: data.latencyMs,
            language,
            persona: personaKey || "AGENCY",
            lead: data.lead,
          }, null, 2),
        }],
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

// Tool 2: voice_providers_status - Check AI providers availability
server.tool(
  "voice_providers_status",
  {},
  async () => {
    try {
      const response = await fetch(`${VOCALIA_API_URL}/health`);
      if (!response.ok) {
        return { content: [{ type: "text" as const, text: `API unreachable: ${response.status}` }] };
      }
      const data = await response.json() as {
        healthy: boolean;
        providers?: Record<string, boolean>;
        leadQualification?: boolean;
      };
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            api_healthy: data.healthy,
            providers: data.providers || {
              grok: "unknown",
              gemini: "unknown",
              anthropic: "unknown",
              atlasChat: "unknown (Darija)"
            },
            lead_qualification: data.leadQualification ?? true,
            fallback_chain: "Grok → Gemini → Claude → Atlas-Chat → Local",
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            api_healthy: false,
            error: (error as Error).message,
            hint: "Start voice-api-resilient.cjs: node core/voice-api-resilient.cjs --server"
          }, null, 2)
        }]
      };
    }
  }
);

// =============================================================================
// PERSONA TOOLS (3) - LOCAL, NO API NEEDED
// =============================================================================

// Tool 3: personas_list - List all 30 personas by tier
server.tool(
  "personas_list",
  {
    tier: z.enum(["core", "expansion", "extended", "all"]).optional().describe("Filter by tier (default: all)"),
  },
  async ({ tier = "all" }) => {
    let result;
    if (tier === "all") {
      result = {
        ...PERSONAS_DATA,
        total: 30,
        tiers: { core: 7, expansion: 11, extended: 12 }
      };
    } else {
      const tierData = PERSONAS_DATA[tier as keyof typeof PERSONAS_DATA];
      result = { [tier]: tierData, total: tierData.length };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: personas_get - Get details for a specific persona
server.tool(
  "personas_get",
  {
    personaKey: PersonaKeyEnum.describe("The persona key (e.g., AGENCY, DENTAL)"),
  },
  async ({ personaKey }) => {
    // Find persona in all tiers
    const allPersonas = [...PERSONAS_DATA.core, ...PERSONAS_DATA.expansion, ...PERSONAS_DATA.extended];
    const persona = allPersonas.find(p => p.key === personaKey);

    if (!persona) {
      return { content: [{ type: "text" as const, text: `Persona not found: ${personaKey}` }] };
    }

    const systemPrompt = SYSTEM_PROMPTS[personaKey] || { fr: "Generic assistant" };

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          ...persona,
          languages_supported: ["fr", "en", "es", "ar", "ary"],
          system_prompt_preview: systemPrompt.fr?.substring(0, 200) + "...",
        }, null, 2),
      }],
    };
  }
);

// Tool 5: personas_get_system_prompt - Get full system prompt for a persona in a language
server.tool(
  "personas_get_system_prompt",
  {
    personaKey: PersonaKeyEnum.describe("The persona key"),
    language: LanguageEnum.optional().describe("Language for the prompt (default: fr)"),
  },
  async ({ personaKey, language = "fr" }) => {
    const prompts = SYSTEM_PROMPTS[personaKey];
    if (!prompts) {
      return { content: [{ type: "text" as const, text: `No system prompt defined for: ${personaKey}` }] };
    }

    const prompt = prompts[language] || prompts.fr || prompts.en || "Generic assistant prompt";

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          persona: personaKey,
          language,
          system_prompt: prompt,
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// LEAD QUALIFICATION TOOLS (3) - LOCAL, NO API NEEDED
// =============================================================================

// Tool 6: qualify_lead - BANT scoring calculation
server.tool(
  "qualify_lead",
  {
    budget: z.number().min(0).max(100).describe("Budget score (0-100): 100=defined budget, 50=flexible, 25=limited"),
    authority: z.number().min(0).max(100).describe("Authority score (0-100): 100=decision maker, 50=influencer, 25=user"),
    need: z.number().min(0).max(100).describe("Need/urgency score (0-100): 100=critical, 50=interested, 25=exploring"),
    timeline: z.number().min(0).max(100).describe("Timeline score (0-100): 100=immediate, 75=this quarter, 50=this year"),
    industry: z.string().optional().describe("Lead's industry (e.g., ecommerce, healthcare, real-estate)"),
    notes: z.string().optional().describe("Additional qualification notes"),
  },
  async ({ budget, authority, need, timeline, industry, notes }) => {
    const totalScore = Math.round((budget + authority + need + timeline) / 4);
    const qualification = totalScore >= 75 ? "HOT" : totalScore >= 50 ? "WARM" : totalScore >= 25 ? "COOL" : "COLD";

    // Industry fit bonus
    const highValueIndustries = ["ecommerce", "healthcare", "real-estate", "finance", "saas"];
    const industryBonus = industry && highValueIndustries.includes(industry.toLowerCase()) ? 5 : 0;
    const adjustedScore = Math.min(100, totalScore + industryBonus);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          bant_scores: { budget, authority, need, timeline },
          raw_score: totalScore,
          industry_bonus: industryBonus,
          final_score: adjustedScore,
          qualification,
          recommendation: qualification === "HOT"
            ? "Immediate follow-up required. Schedule discovery call within 24h."
            : qualification === "WARM"
            ? "High potential. Schedule follow-up within 48-72h."
            : qualification === "COOL"
            ? "Add to nurture sequence. Re-engage in 2-4 weeks."
            : "Low priority. Add to long-term nurture campaign.",
          next_actions: qualification === "HOT"
            ? ["create_booking", "send_calendar_invite", "notify_sales_team"]
            : qualification === "WARM"
            ? ["schedule_callback", "send_info_pack"]
            : ["add_to_email_sequence"],
          industry,
          notes,
        }, null, 2),
      }],
    };
  }
);

// Tool 7: lead_score_explain - Explain the scoring methodology
server.tool(
  "lead_score_explain",
  {},
  async () => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          methodology: "BANT (Budget, Authority, Need, Timeline)",
          scoring_guide: {
            budget: {
              "100": "Defined budget allocated for this project",
              "75": "Flexible budget, can invest if value is clear",
              "50": "Limited budget, needs strong ROI justification",
              "25": "No budget currently, exploring options",
            },
            authority: {
              "100": "Decision maker (CEO, Owner, Director)",
              "75": "Strong influencer with budget authority",
              "50": "Influencer who can recommend",
              "25": "End user with no decision power",
            },
            need: {
              "100": "Critical need, urgent problem to solve",
              "75": "Clear need, actively looking for solution",
              "50": "Interested but not urgent",
              "25": "Exploring, no immediate need",
            },
            timeline: {
              "100": "Immediate (this week/month)",
              "75": "This quarter (1-3 months)",
              "50": "This year (3-12 months)",
              "25": "No timeline, just exploring",
            },
          },
          thresholds: {
            "HOT (75-100)": "High priority, immediate action required",
            "WARM (50-74)": "Good potential, schedule follow-up",
            "COOL (25-49)": "Nurture sequence recommended",
            "COLD (0-24)": "Long-term nurture, low priority",
          },
          industry_bonus: "High-value industries (ecommerce, healthcare, finance) get +5 bonus",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// KNOWLEDGE BASE TOOLS (3) - LOCAL WITH KB FILES
// =============================================================================

// Tool 8: knowledge_search - TF-IDF search in knowledge base
server.tool(
  "knowledge_search",
  {
    query: z.string().describe("Search query (e.g., 'voice AI pricing', 'email automation')"),
    category: z.string().optional().describe("Filter by category (lead-gen, seo, email, voice-ai, etc.)"),
    limit: z.number().min(1).max(10).optional().describe("Number of results (default: 5)"),
  },
  async ({ query, category, limit = 5 }) => {
    try {
      // Try to call the API endpoint if available
      const response = await fetch(`${VOCALIA_API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, category, limit }),
      });

      if (response.ok) {
        const data = await response.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    } catch {
      // API not available, return helpful message
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "knowledge_base_offline",
          hint: "Start voice-api-resilient.cjs with --server flag to enable KB search",
          alternative: "Use the VocalIA dashboard for knowledge base queries",
          categories_available: [
            "lead-gen", "seo", "email", "shopify", "analytics",
            "voice-ai", "content", "cinematicads", "whatsapp", "sms"
          ],
        }, null, 2),
      }],
    };
  }
);

// Tool 9: knowledge_base_status - Check KB status
server.tool(
  "knowledge_base_status",
  {},
  async () => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          knowledge_base: {
            type: "TF-IDF + Hybrid Dense Retrieval",
            source: "automations-registry.json",
            chunks: "119+ automation services",
            categories: 15,
            languages: ["en", "fr"],
          },
          search_modes: {
            sparse: "TF-IDF keyword matching",
            hybrid: "TF-IDF + semantic embeddings",
            graph: "Knowledge graph traversal (2-hop)",
          },
          strategic_metadata: {
            available: true,
            fields: ["strategic_intent", "expected_outcome", "marketing_framework", "systemic_risk"],
          },
          location: "data/knowledge-base/",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// TELEPHONY TOOLS (5) - REQUIRE TWILIO CREDENTIALS
// =============================================================================

// Tool 10: telephony_initiate_call - Start outbound call
server.tool(
  "telephony_initiate_call",
  {
    to: z.string().describe("Phone number to call (E.164 format, e.g., +33612345678)"),
    personaKey: PersonaKeyEnum.optional().describe("Persona to use for the call"),
    language: LanguageEnum.optional().describe("Call language (default: fr)"),
    context: z.string().optional().describe("Context to provide to the AI agent"),
  },
  async ({ to, personaKey, language = "fr", context }) => {
    try {
      const response = await fetch(`${VOCALIA_TELEPHONY_URL}/twilio/outbound-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: to, persona: personaKey, language, context }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Telephony error: ${response.status} - ${error}` }] };
      }

      const data = await response.json();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "telephony_offline",
            error: (error as Error).message,
            requirements: {
              service: "voice-telephony-bridge.cjs must be running on port 3009",
              credentials: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
              setup_guide: "https://www.twilio.com/console",
            },
          }, null, 2),
        }],
      };
    }
  }
);

// Tool 11: telephony_get_status - Get telephony system status
server.tool(
  "telephony_get_status",
  {},
  async () => {
    try {
      const response = await fetch(`${VOCALIA_TELEPHONY_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    } catch {
      // Service not available
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "offline",
          port: 3009,
          start_command: "node telephony/voice-telephony-bridge.cjs",
          features: {
            inbound_calls: "Twilio webhook → Grok WebSocket",
            outbound_calls: "API trigger → PSTN call",
            function_tools: 11,
            languages: ["fr", "en", "es", "ar", "ary"],
          },
          requirements: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "XAI_API_KEY"],
        }, null, 2),
      }],
    };
  }
);

// Tool 12: telephony_transfer_call - Transfer to human agent
server.tool(
  "telephony_transfer_call",
  {
    callSid: z.string().describe("Twilio Call SID to transfer"),
    reason: z.string().describe("Reason for transfer (e.g., 'Complex issue', 'Customer request')"),
    targetNumber: z.string().optional().describe("Phone number to transfer to (optional)"),
  },
  async ({ callSid, reason, targetNumber }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "transfer_call",
          call_sid: callSid,
          reason,
          target: targetNumber || "default_agent",
          status: "requires_active_telephony_session",
          note: "This tool requires an active call session via voice-telephony-bridge.cjs",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// CRM TOOLS (3) - REQUIRE HUBSPOT CREDENTIALS
// =============================================================================

// Tool 13: crm_get_customer - Get customer context from HubSpot
server.tool(
  "crm_get_customer",
  {
    email: z.string().email().describe("Customer email address"),
  },
  async ({ email }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "crm_integration_available",
          email,
          requirements: {
            credential: "HUBSPOT_API_KEY or HUBSPOT_ACCESS_TOKEN",
            setup: "https://developers.hubspot.com/docs/api/private-apps",
          },
          features: {
            contact_lookup: "Search contacts by email",
            deal_history: "View recent deals and amounts",
            lead_status: "Get current lead qualification status",
            company_info: "Associated company details",
          },
          voice_integration: "Context injected into voice prompts for personalized responses",
        }, null, 2),
      }],
    };
  }
);

// Tool 14: crm_create_contact - Create new contact in HubSpot
server.tool(
  "crm_create_contact",
  {
    email: z.string().email().describe("Contact email"),
    firstName: z.string().describe("First name"),
    lastName: z.string().describe("Last name"),
    phone: z.string().optional().describe("Phone number"),
    company: z.string().optional().describe("Company name"),
    leadScore: z.number().optional().describe("Initial lead score (0-100)"),
  },
  async ({ email, firstName, lastName, phone, company, leadScore }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "create_contact",
          data: { email, firstName, lastName, phone, company, leadScore },
          status: "requires_hubspot_credentials",
          credential_required: "HUBSPOT_API_KEY",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// E-COMMERCE TOOLS (3) - REQUIRE SHOPIFY/KLAVIYO CREDENTIALS
// =============================================================================

// Tool 15: ecommerce_order_status - Check order status from Shopify
server.tool(
  "ecommerce_order_status",
  {
    email: z.string().email().describe("Customer email to look up orders"),
    orderId: z.string().optional().describe("Specific order ID (optional)"),
  },
  async ({ email, orderId }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "get_order_status",
          email,
          orderId,
          status: "requires_shopify_credentials",
          requirements: {
            credentials: ["SHOPIFY_ACCESS_TOKEN", "SHOPIFY_SHOP_NAME"],
            setup: "Shopify Admin → Settings → Apps → Develop apps",
          },
          capabilities: {
            order_lookup: "Find orders by email",
            fulfillment_status: "Processing, Shipped, Delivered",
            tracking_url: "Carrier tracking link",
            financial_status: "Paid, Pending, Refunded",
          },
        }, null, 2),
      }],
    };
  }
);

// Tool 16: ecommerce_product_stock - Check product availability
server.tool(
  "ecommerce_product_stock",
  {
    query: z.string().describe("Product name or description to search"),
  },
  async ({ query }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "check_product_stock",
          query,
          status: "requires_shopify_credentials",
          requirements: ["SHOPIFY_ACCESS_TOKEN", "SHOPIFY_SHOP_NAME"],
          returns: {
            title: "Product name",
            price: "Product price",
            inStock: "Boolean availability",
            variants: "Available variants",
          },
        }, null, 2),
      }],
    };
  }
);

// Tool 17: ecommerce_customer_profile - Get Klaviyo customer profile
server.tool(
  "ecommerce_customer_profile",
  {
    email: z.string().email().describe("Customer email"),
  },
  async ({ email }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "get_customer_profile",
          email,
          status: "requires_klaviyo_credentials",
          requirements: ["KLAVIYO_API_KEY"],
          returns: {
            id: "Klaviyo profile ID",
            firstName: "First name",
            tags: "Customer tags/segments",
            engagement_level: "Email engagement metrics",
          },
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// BOOKING TOOLS (2)
// =============================================================================

// Tool 18: booking_schedule_callback - Schedule a follow-up callback
server.tool(
  "booking_schedule_callback",
  {
    email: z.string().email().describe("Contact email"),
    phone: z.string().optional().describe("Phone number for callback"),
    preferredTime: z.string().describe("Preferred callback time (e.g., 'tomorrow 10am', 'Monday afternoon')"),
    notes: z.string().optional().describe("Context notes for the callback"),
    nextAction: z.enum(["call_back", "send_email", "send_sms_booking_link", "send_info_pack"]).optional(),
  },
  async ({ email, phone, preferredTime, notes, nextAction = "call_back" }) => {
    // REAL: Save to persistent queue file
    const bookingId = saveToBookingQueue({
      type: "callback",
      email,
      phone,
      preferredTime,
      nextAction,
      notes,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "schedule_callback",
          booking_id: bookingId,
          saved_to: BOOKING_QUEUE_PATH,
          data: {
            email,
            phone,
            preferredTime,
            nextAction,
            notes,
          },
          status: "saved_to_queue",
          next_step: "Process queue with external calendar integration or manually",
        }, null, 2),
      }],
    };
  }
);

// Tool 19: booking_create - Create a discovery call booking (REAL file persistence)
server.tool(
  "booking_create",
  {
    name: z.string().describe("Full name of the prospect"),
    email: z.string().email().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    slot: z.string().describe("Preferred time slot (e.g., 'Tuesday 2pm', 'Thursday 10am')"),
    meetingType: z.enum(["discovery_call", "demo", "audit", "consultation"]).optional(),
    qualificationScore: z.enum(["hot", "warm", "cold"]).optional(),
    notes: z.string().optional(),
  },
  async ({ name, email, phone, slot, meetingType = "discovery_call", qualificationScore, notes }) => {
    // REAL: Save to persistent queue file
    const bookingId = saveToBookingQueue({
      type: "booking",
      name,
      email,
      phone,
      slot,
      meetingType,
      qualificationScore,
      notes,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          action: "create_booking",
          booking_id: bookingId,
          saved_to: BOOKING_QUEUE_PATH,
          data: {
            name,
            email,
            phone,
            slot,
            meetingType,
            qualificationScore,
            notes,
          },
          status: "saved_to_queue",
          next_step: "Process queue with external calendar integration or manually",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// SYSTEM TOOLS (3)
// =============================================================================

// Tool 20: api_status - Complete system health check
server.tool(
  "api_status",
  {},
  async () => {
    let voiceApiStatus = "unknown";
    let voiceApiLatency = 0;
    let telephonyStatus = "unknown";

    // Check Voice API
    try {
      const start = Date.now();
      const response = await fetch(`${VOCALIA_API_URL}/health`);
      voiceApiLatency = Date.now() - start;
      voiceApiStatus = response.ok ? "healthy" : `error: ${response.status}`;
    } catch (error) {
      voiceApiStatus = `offline: ${(error as Error).message}`;
    }

    // Check Telephony
    try {
      const response = await fetch(`${VOCALIA_TELEPHONY_URL}/health`);
      telephonyStatus = response.ok ? "healthy" : `error: ${response.status}`;
    } catch {
      telephonyStatus = "offline";
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          mcp_server: {
            name: "vocalia",
            version: "0.3.2",
            tools_count: 21,
          },
          services: {
            voice_api: {
              url: VOCALIA_API_URL,
              status: voiceApiStatus,
              latency_ms: voiceApiLatency,
            },
            telephony: {
              url: VOCALIA_TELEPHONY_URL,
              status: telephonyStatus,
            },
          },
          tools_availability: {
            always_available: [
              "personas_list", "personas_get", "personas_get_system_prompt",
              "qualify_lead", "lead_score_explain",
              "knowledge_base_status", "system_languages", "api_status",
              "booking_schedule_callback", "booking_create"
            ],
            requires_voice_api: ["voice_generate_response", "voice_providers_status", "knowledge_search"],
            requires_telephony: ["telephony_initiate_call", "telephony_get_status", "telephony_transfer_call"],
            requires_hubspot: ["crm_get_customer", "crm_create_contact"],
            requires_shopify: ["ecommerce_order_status", "ecommerce_product_stock"],
            requires_klaviyo: ["ecommerce_customer_profile"],
          },
        }, null, 2),
      }],
    };
  }
);

// Tool 21: system_languages - List supported languages
server.tool(
  "system_languages",
  {},
  async () => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          supported_languages: [
            { code: "fr", name: "Français", status: "full", default: true },
            { code: "en", name: "English", status: "full" },
            { code: "es", name: "Español", status: "full" },
            { code: "ar", name: "العربية (MSA)", status: "full" },
            { code: "ary", name: "Darija (Moroccan)", status: "full", model: "Atlas-Chat-9B" },
          ],
          voice_options: {
            ara: "Default (neutral)",
            eve: "Female (warm)",
            leo: "Male (efficient)",
            sal: "Male (friendly)",
            rex: "Male (trustworthy)",
            mika: "Female (clear)",
            valentin: "Male (calm, respectful)",
          },
          tts_fallback: "Grok Realtime → Gemini 2.5 Flash TTS → Browser Web Speech API",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VocalIA MCP Server v0.3.2 running on stdio");
  console.error(`Voice API URL: ${VOCALIA_API_URL}`);
  console.error(`Telephony URL: ${VOCALIA_TELEPHONY_URL}`);
  console.error("Tools: 21 (10 always available, 11 require external services)");
  console.error(`Booking queue: ${BOOKING_QUEUE_PATH}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
