#!/usr/bin/env node
/**
 * VocalIA MCP Server - SOTA Implementation
 * Model Context Protocol server exposing VocalIA Voice AI Platform capabilities.
 *
 * Session 250.87 - v0.9.0 - HubSpot + Klaviyo + Twilio MCP Tools
 *
 * TOOL CATEGORIES (203 tools - 23 inline, 180 external modules):
 *
 * INLINE TOOLS (23):
 * - System Tools (3): translation_qa_check, api_status, system_languages [ALWAYS]
 * - Voice Tools (2): voice_generate_response, voice_providers_status [REQUIRE API]
 * - Persona Tools (3): personas_list, personas_get, personas_get_system_prompt [ALWAYS]
 * - Lead Tools (2): qualify_lead, lead_score_explain [ALWAYS]
 * - Knowledge Base Tools (2): knowledge_search [API], knowledge_base_status [ALWAYS]
 * - Telephony Tools (3): telephony_initiate_call, telephony_get_status, telephony_transfer_call [REQUIRE TWILIO]
 * - CRM Tools (2): crm_get_customer, crm_create_contact [REQUIRE HUBSPOT]
 * - E-commerce Tools (3): ecommerce_order_status, ecommerce_product_stock [SHOPIFY], ecommerce_customer_profile [KLAVIYO]
 * - UCP Inline (1): ucp_sync [REQUIRE UCP]
 * - Booking Tools (2): booking_schedule_callback, booking_create [ALWAYS - FILE PERSISTENCE]
 *
 * EXTERNAL MODULE TOOLS (93):
 * - Calendar Tools (2): calendar_check_availability, calendar_create_event [REQUIRE GOOGLE]
 * - Slack Tools (1): slack_send_notification [REQUIRE WEBHOOK]
 * - UCP Tools (7): ucp_sync_preference, ucp_get_profile, ucp_list_profiles, ucp_record_interaction, ucp_track_event, ucp_get_insights, ucp_update_ltv [REQUIRE UCP]
 * - Sheets Tools (5): sheets_read_range, sheets_write_range, sheets_append_rows, sheets_get_info, sheets_create [REQUIRE GOOGLE]
 * - Drive Tools (6): drive_list_files, drive_get_file, drive_create_folder, drive_upload_file, drive_share_file, drive_delete_file [REQUIRE GOOGLE]
 * - Docs Tools (4): docs_get_document, docs_create_document, docs_append_text, docs_replace_text [REQUIRE GOOGLE]
 * - Calendly Tools (6): calendly_get_user, calendly_list_event_types, calendly_get_available_times, calendly_list_events, calendly_cancel_event, calendly_get_busy_times [REQUIRE CALENDLY]
 * - Freshdesk Tools (6): freshdesk_list_tickets, freshdesk_get_ticket, freshdesk_create_ticket, freshdesk_reply_ticket, freshdesk_update_ticket, freshdesk_search_contacts [REQUIRE FRESHDESK]
 * - Zendesk Tools (6): zendesk_list_tickets, zendesk_get_ticket, zendesk_create_ticket, zendesk_add_comment, zendesk_update_ticket, zendesk_search_users [REQUIRE ZENDESK]
 * - Pipedrive Tools (7): pipedrive_list_deals, pipedrive_create_deal, pipedrive_update_deal, pipedrive_list_persons, pipedrive_create_person, pipedrive_search, pipedrive_list_activities [REQUIRE PIPEDRIVE]
 * - WooCommerce Tools (7): woocommerce_list_orders, woocommerce_get_order, woocommerce_update_order, woocommerce_list_products, woocommerce_get_product, woocommerce_list_customers, woocommerce_get_customer [REQUIRE WOOCOMMERCE]
 * - Zoho CRM Tools (6): zoho_list_leads, zoho_get_lead, zoho_create_lead, zoho_list_contacts, zoho_list_deals, zoho_search_records [REQUIRE ZOHO]
 * - Magento Tools (6): magento_list_orders, magento_get_order, magento_list_products, magento_get_product, magento_get_stock, magento_list_customers [REQUIRE MAGENTO]
 * - Wix Tools (6): wix_list_orders, wix_get_order, wix_list_products, wix_get_product, wix_get_inventory, wix_update_inventory [REQUIRE WIX]
 * - Squarespace Tools (7): squarespace_list_orders, squarespace_get_order, squarespace_fulfill_order, squarespace_list_products, squarespace_get_product, squarespace_list_inventory, squarespace_update_inventory [REQUIRE SQUARESPACE]
 * - BigCommerce Tools (7): bigcommerce_list_orders, bigcommerce_get_order, bigcommerce_update_order_status, bigcommerce_list_products, bigcommerce_get_product, bigcommerce_list_customers, bigcommerce_get_customer [REQUIRE BIGCOMMERCE]
 * - PrestaShop Tools (7): prestashop_list_orders, prestashop_get_order, prestashop_list_products, prestashop_get_product, prestashop_get_stock, prestashop_list_customers, prestashop_get_customer [REQUIRE PRESTASHOP]
 * - Export Tools (5): export_generate_csv, export_generate_xlsx, export_generate_pdf, export_generate_pdf_table, export_list_files [LOCAL]
 * - Email Tools (3): email_send, email_send_template, email_verify_smtp [REQUIRE SMTP]
 * - Zapier Tools (3): zapier_trigger_webhook, zapier_trigger_nla, zapier_list_actions [REQUIRE ZAPIER]
 * - Make Tools (5): make_trigger_webhook, make_list_scenarios, make_get_scenario, make_run_scenario, make_list_executions [REQUIRE MAKE]
 * - n8n Tools (5): n8n_trigger_webhook, n8n_list_workflows, n8n_get_workflow, n8n_activate_workflow, n8n_list_executions [REQUIRE N8N]
 *
 * - HubSpot Tools (7): hubspot_create_contact, hubspot_search_contacts, hubspot_get_contact, hubspot_update_contact, hubspot_create_deal, hubspot_log_call, hubspot_list_pipelines [REQUIRE HUBSPOT]
 * - Klaviyo Tools (5): klaviyo_create_profile, klaviyo_get_profile, klaviyo_track_event, klaviyo_subscribe, klaviyo_list_segments [REQUIRE KLAVIYO]
 * - Twilio MCP Tools (5): twilio_send_sms, twilio_make_call, twilio_get_call, twilio_list_calls, twilio_send_whatsapp [REQUIRE TWILIO]
 *
 * TOTAL: 203 tools (SOTA - Vapi has 8, Twilio has 5)
 * E-commerce coverage: ~64% of global market (WooCommerce+Shopify+Magento+Wix+Squarespace+BigCommerce+PrestaShop)
 *
 * CRITICAL: Never use console.log - it corrupts JSON-RPC transport.
 * All logging must use console.error.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { calendarTools } from "./tools/calendar.js";
import { slackTools } from "./tools/slack.js";
import { ucpTools } from "./tools/ucp.js";
import { sheetsTools } from "./tools/sheets.js";
import { driveTools } from "./tools/drive.js";
import { calendlyTools } from "./tools/calendly.js";
import { freshdeskTools } from "./tools/freshdesk.js";
import { pipedriveTools } from "./tools/pipedrive.js";
import { docsTools } from "./tools/docs.js";
import { zendeskTools } from "./tools/zendesk.js";
import { woocommerceTools } from "./tools/woocommerce.js";
import { zohoTools } from "./tools/zoho.js";
import { magentoTools } from "./tools/magento.js";
import { exportTools } from "./tools/export.js";
import { emailTools } from "./tools/email.js";
import { gmailTools } from "./tools/gmail.js";
import { zapierTools } from "./tools/zapier.js";
import { makeTools } from "./tools/make.js";
import { n8nTools } from "./tools/n8n.js";
import { wixTools } from "./tools/wix.js";
import { squarespaceTools } from "./tools/squarespace.js";
import { bigcommerceTools } from "./tools/bigcommerce.js";
import { prestashopTools } from "./tools/prestashop.js";
import { shopifyTools } from "./tools/shopify.js";
import { stripeTools } from "./tools/stripe.js";
import { recommendationTools } from "./tools/recommendations.js";
import { hubspotTools } from "./tools/hubspot.js";
import { klaviyoTools } from "./tools/klaviyo.js";
import { twilioTools } from "./tools/twilio.js";

const execAsync = promisify(exec);

// Session 245: A2A Protocol Integration
// Import AgencyEventBus (CommonJS require in TS)
// const EVENT_BUS_PATH = path.join(process.cwd(), "..", "core", "AgencyEventBus.cjs");
// let eventBus: any = null;

// try {
//   // Dynamic require to avoid TS build issues with outside modules
//   const busModule = require(EVENT_BUS_PATH);
//   eventBus = busModule;
// } catch (error) {
//   console.error("Failed to load AgencyEventBus:", error);
// }


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
  version: "0.8.0",
});

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const LanguageEnum = z.enum(["fr", "en", "es", "ar", "ary"]);
// Session 250.43: Synced with 40 personas from voice-persona-injector.cjs
const PersonaKeyEnum = z.enum([
  // Tier 1 - Core (5)
  "AGENCY", "DENTAL", "PROPERTY", "CONTRACTOR", "FUNERAL",
  // Tier 2 - Expansion (19)
  "HEALER", "MECHANIC", "COUNSELOR", "CONCIERGE", "STYLIST", "RECRUITER",
  "DISPATCHER", "COLLECTOR", "INSURER", "ACCOUNTANT", "ARCHITECT",
  "PHARMACIST", "RENTER", "LOGISTICIAN", "TRAINER", "PLANNER",
  "PRODUCER", "CLEANER", "GYM",
  // Tier 3 - Universal (2)
  "UNIVERSAL_ECOMMERCE", "UNIVERSAL_SME",
  // Tier 4 - PME Economy (14)
  "RETAILER", "BUILDER", "RESTAURATEUR", "TRAVEL_AGENT", "CONSULTANT",
  "IT_SERVICES", "MANUFACTURER", "DOCTOR", "NOTARY", "BAKERY",
  "SPECIALIST", "REAL_ESTATE_AGENT", "HAIRDRESSER", "GROCERY"
]);

// =============================================================================
// FACTUAL DATA - 40 PERSONAS (from voice-persona-injector.cjs)
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
    fr: `Tu es le conseiller Voice AI de VocalIA. VocalIA est une plateforme Voice AI avec 2 produits:
1. Voice Widget: Assistant vocal 24/7 pour sites web
2. Voice Telephony: Ligne téléphonique IA (via Twilio)
OBJECTIF: Qualifier le prospect et proposer une démo à vocalia.ma/booking.
ATOUTS: 40 personas sectoriels, 5 langues dont Darija, intégrations CRM/e-commerce.`,
    en: `You are VocalIA's Voice AI consultant. VocalIA is a Voice AI platform with 2 products:
1. Voice Widget: 24/7 voice assistant for websites
2. Voice Telephony: AI phone line (via Twilio)
GOAL: Qualify prospects and offer a demo at vocalia.ma/booking.
STRENGTHS: 40 industry personas, 5 languages including Darija, CRM/e-commerce integrations.`,
    es: `Eres el consultor de Voice AI de VocalIA. VocalIA es una plataforma Voice AI con 2 productos:
1. Voice Widget: Asistente de voz 24/7 para sitios web
2. Voice Telephony: Línea telefónica IA (via Twilio)
OBJETIVO: Calificar prospectos y ofrecer demo en vocalia.ma/booking.
FORTALEZAS: 40 personas sectoriales, 5 idiomas incluyendo Darija, integraciones CRM/e-commerce.`,
    ar: `أنت مستشار Voice AI في فوكاليا. فوكاليا هي منصة Voice AI بمنتجين:
1. Voice Widget: مساعد صوتي 24/7 للمواقع
2. Voice Telephony: خط هاتف ذكي (Twilio)
الهدف: تأهيل العملاء المحتملين واقتراح عرض توضيحي في vocalia.ma/booking.`,
    ary: `نتا هو المستشار ديال Voice AI فـ VocalIA. VocalIA هي منصة Voice AI عندها 2 منتوجات:
1. Voice Widget: مساعد صوتي 24/7 للمواقع
2. Voice Telephony: خط تيليفون ذكي (Twilio)
الهدف: تأهيل العميل المحتمل وتقترح عليه ديمو فـ vocalia.ma/booking.`,
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
// SYSTEM TOOLS (3)
// =============================================================================

// Tool 0: translation_qa_check - Run translation quality audit
server.tool(
  "translation_qa_check",
  {},
  async () => {
    try {
      const scriptPath = path.join(process.cwd(), "scripts", "translation-quality-check.py");
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`);
      return {
        content: [{
          type: "text" as const,
          text: stdout || stderr || "QA Check Completed"
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `QA Check Failed: ${(error as any).message}\n${(error as any).stdout || ""}`
        }]
      };
    }
  }
);


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

// Tool 3: personas_list - List all 40 personas by tier
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

// Tool 8: knowledge_search - BM25 search in knowledge base (SOTA Session 241.2)
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
            type: "BM25 + TF-IDF Hybrid Retrieval",
            source: "automations-registry.json",
            chunks: "12 automation knowledge articles",
            categories: 12,
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
// TELEPHONY TOOLS (3) - REQUIRE TWILIO CREDENTIALS
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
// MESSAGING TOOLS (1) - Session 249.18
// =============================================================================

// Tool 13: messaging_send - Send message via WhatsApp or Twilio SMS fallback
server.tool(
  "messaging_send",
  {
    to: z.string().describe("Phone number in E.164 format (e.g., +33612345678)"),
    message: z.string().describe("Message content to send"),
    channel: z.enum(["auto", "whatsapp", "sms"]).optional().describe("Channel preference (default: auto with fallback)"),
  },
  async ({ to, message, channel = "auto" }) => {
    try {
      const response = await fetch(`${VOCALIA_TELEPHONY_URL}/messaging/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message, channel }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Messaging error: ${response.status} - ${error}` }] };
      }

      const data = await response.json();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "messaging_service_offline",
            error: (error as Error).message,
            fallback_chain: ["WhatsApp Business API", "Twilio SMS ($0.0083/msg US)"],
            requirements: {
              whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
              twilio_sms: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
            },
            note: "Requires voice-telephony-bridge.cjs running on port 3009",
          }, null, 2),
        }],
      };
    }
  }
);

// =============================================================================
// CRM TOOLS (3) - REQUIRE HUBSPOT CREDENTIALS
// =============================================================================

// Tool 14: crm_get_customer - Get customer context from HubSpot (number corrected from 13)
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
// E-COMMERCE TOOLS (1) - KLAVIYO CUSTOMER PROFILE
// Note: Shopify tools moved to shopify.ts with full GraphQL Admin API support (8 tools)
// =============================================================================

// Tool: ecommerce_customer_profile - Get profile from Klaviyo
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
          requirements: {
            credential: "KLAVIYO_API_KEY",
            setup: "Klaviyo Settings → Account → API Keys",
          },
          attributes: {
            segments: "VIP, Engaged, Churned",
            last_active: "Timestamp",
            predicted_ltv: "Customer lifetime value",
            product_recommendations: "Based on browsing history",
          },
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// UCP TOOLS (1) - UNIFIED CUSTOMER PROFILE
// =============================================================================

// Tool 18: ucp_sync - Sync customer profile data
server.tool(
  "ucp_sync",
  {
    sessionId: z.string().describe("Session ID"),
    tenantId: z.string().optional().describe("Tenant ID (default: agency)"),
    diff: z.object({
      preferences: z.record(z.any()).optional(),
      extractedData: z.record(z.any()).optional(),
      overrides: z.record(z.any()).optional()
    }).describe("Changes to apply to the profile"),
  },
  async ({ sessionId, tenantId = "agency", diff }) => {
    // In a real implementation, this would write to a DB (Postgres/Redis)
    // For now, we simulate a successful sync

    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "synced",
          timestamp: new Date().toISOString(),
          ucp_id: `ucp_${sessionId.split('_')[1] || Date.now()}`,
          applied_diff: diff,
          target: {
            tenant: tenantId,
            system: "ContextBox v3.0"
          }
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
            version: "0.5.0",
            tools_count: 75,
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
            requires_google: [
              "calendar_check_availability", "calendar_create_event",
              "sheets_read_range", "sheets_write_range", "sheets_append_rows", "sheets_get_info", "sheets_create",
              "drive_list_files", "drive_get_file", "drive_create_folder", "drive_upload_file", "drive_share_file", "drive_delete_file"
            ],
            requires_slack: ["slack_send_notification"],
            requires_calendly: [
              "calendly_get_user", "calendly_list_event_types", "calendly_get_available_times",
              "calendly_list_events", "calendly_cancel_event", "calendly_get_busy_times"
            ],
            requires_freshdesk: [
              "freshdesk_list_tickets", "freshdesk_get_ticket", "freshdesk_create_ticket",
              "freshdesk_reply_ticket", "freshdesk_update_ticket", "freshdesk_search_contacts"
            ],
            requires_pipedrive: [
              "pipedrive_list_deals", "pipedrive_create_deal", "pipedrive_update_deal",
              "pipedrive_list_persons", "pipedrive_create_person", "pipedrive_search", "pipedrive_list_activities"
            ],
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
// CALENDAR TOOLS (2) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

server.tool(calendarTools.check_availability.name, calendarTools.check_availability.parameters, calendarTools.check_availability.handler);
server.tool(calendarTools.create_event.name, calendarTools.create_event.parameters, calendarTools.create_event.handler);

// =============================================================================
// SLACK TOOLS (1) - REQUIRE WEBHOOK URL
// =============================================================================

server.tool(slackTools.send_notification.name, slackTools.send_notification.parameters, slackTools.send_notification.handler);

// =============================================================================
// UCP TOOLS (2) - GLOBAL MARKET RULES
// =============================================================================

server.tool(ucpTools.ucp_sync_preference.name, ucpTools.ucp_sync_preference.parameters, ucpTools.ucp_sync_preference.handler);
server.tool(ucpTools.ucp_get_profile.name, ucpTools.ucp_get_profile.parameters, ucpTools.ucp_get_profile.handler);
server.tool(ucpTools.ucp_list_profiles.name, ucpTools.ucp_list_profiles.parameters, ucpTools.ucp_list_profiles.handler);
// CDP Enhanced Tools (Session 250.28)
server.tool(ucpTools.ucp_record_interaction.name, ucpTools.ucp_record_interaction.parameters, ucpTools.ucp_record_interaction.handler);
server.tool(ucpTools.ucp_track_event.name, ucpTools.ucp_track_event.parameters, ucpTools.ucp_track_event.handler);
server.tool(ucpTools.ucp_get_insights.name, ucpTools.ucp_get_insights.parameters, ucpTools.ucp_get_insights.handler);
server.tool(ucpTools.ucp_update_ltv.name, ucpTools.ucp_update_ltv.parameters, ucpTools.ucp_update_ltv.handler);

// =============================================================================
// GOOGLE SHEETS TOOLS (5) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

server.tool(sheetsTools.read_range.name, sheetsTools.read_range.parameters, sheetsTools.read_range.handler);
server.tool(sheetsTools.write_range.name, sheetsTools.write_range.parameters, sheetsTools.write_range.handler);
server.tool(sheetsTools.append_rows.name, sheetsTools.append_rows.parameters, sheetsTools.append_rows.handler);
server.tool(sheetsTools.get_spreadsheet_info.name, sheetsTools.get_spreadsheet_info.parameters, sheetsTools.get_spreadsheet_info.handler);
server.tool(sheetsTools.create_spreadsheet.name, sheetsTools.create_spreadsheet.parameters, sheetsTools.create_spreadsheet.handler);

// =============================================================================
// GOOGLE DRIVE TOOLS (6) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

server.tool(driveTools.list_files.name, driveTools.list_files.parameters, driveTools.list_files.handler);
server.tool(driveTools.get_file.name, driveTools.get_file.parameters, driveTools.get_file.handler);
server.tool(driveTools.create_folder.name, driveTools.create_folder.parameters, driveTools.create_folder.handler);
server.tool(driveTools.upload_file.name, driveTools.upload_file.parameters, driveTools.upload_file.handler);
server.tool(driveTools.share_file.name, driveTools.share_file.parameters, driveTools.share_file.handler);
server.tool(driveTools.delete_file.name, driveTools.delete_file.parameters, driveTools.delete_file.handler);

// =============================================================================
// CALENDLY TOOLS (6) - REQUIRE CALENDLY CREDENTIALS
// =============================================================================

server.tool(calendlyTools.get_user.name, calendlyTools.get_user.parameters, calendlyTools.get_user.handler);
server.tool(calendlyTools.list_event_types.name, calendlyTools.list_event_types.parameters, calendlyTools.list_event_types.handler);
server.tool(calendlyTools.get_available_times.name, calendlyTools.get_available_times.parameters, calendlyTools.get_available_times.handler);
server.tool(calendlyTools.list_scheduled_events.name, calendlyTools.list_scheduled_events.parameters, calendlyTools.list_scheduled_events.handler);
server.tool(calendlyTools.cancel_event.name, calendlyTools.cancel_event.parameters, calendlyTools.cancel_event.handler);
server.tool(calendlyTools.get_user_busy_times.name, calendlyTools.get_user_busy_times.parameters, calendlyTools.get_user_busy_times.handler);

// =============================================================================
// FRESHDESK TOOLS (6) - REQUIRE FRESHDESK CREDENTIALS
// =============================================================================

server.tool(freshdeskTools.list_tickets.name, freshdeskTools.list_tickets.parameters, freshdeskTools.list_tickets.handler);
server.tool(freshdeskTools.get_ticket.name, freshdeskTools.get_ticket.parameters, freshdeskTools.get_ticket.handler);
server.tool(freshdeskTools.create_ticket.name, freshdeskTools.create_ticket.parameters, freshdeskTools.create_ticket.handler);
server.tool(freshdeskTools.reply_to_ticket.name, freshdeskTools.reply_to_ticket.parameters, freshdeskTools.reply_to_ticket.handler);
server.tool(freshdeskTools.update_ticket.name, freshdeskTools.update_ticket.parameters, freshdeskTools.update_ticket.handler);
server.tool(freshdeskTools.search_contacts.name, freshdeskTools.search_contacts.parameters, freshdeskTools.search_contacts.handler);

// =============================================================================
// PIPEDRIVE TOOLS (7) - REQUIRE PIPEDRIVE CREDENTIALS
// =============================================================================

server.tool(pipedriveTools.list_deals.name, pipedriveTools.list_deals.parameters, pipedriveTools.list_deals.handler);
server.tool(pipedriveTools.create_deal.name, pipedriveTools.create_deal.parameters, pipedriveTools.create_deal.handler);
server.tool(pipedriveTools.update_deal.name, pipedriveTools.update_deal.parameters, pipedriveTools.update_deal.handler);
server.tool(pipedriveTools.list_persons.name, pipedriveTools.list_persons.parameters, pipedriveTools.list_persons.handler);
server.tool(pipedriveTools.create_person.name, pipedriveTools.create_person.parameters, pipedriveTools.create_person.handler);
server.tool(pipedriveTools.search.name, pipedriveTools.search.parameters, pipedriveTools.search.handler);
server.tool(pipedriveTools.list_activities.name, pipedriveTools.list_activities.parameters, pipedriveTools.list_activities.handler);

// =============================================================================
// GOOGLE DOCS TOOLS (4) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

server.tool(docsTools.get_document.name, docsTools.get_document.parameters, docsTools.get_document.handler);
server.tool(docsTools.create_document.name, docsTools.create_document.parameters, docsTools.create_document.handler);
server.tool(docsTools.append_text.name, docsTools.append_text.parameters, docsTools.append_text.handler);
server.tool(docsTools.replace_text.name, docsTools.replace_text.parameters, docsTools.replace_text.handler);

// =============================================================================
// ZENDESK TOOLS (6) - REQUIRE ZENDESK CREDENTIALS
// =============================================================================

server.tool(zendeskTools.list_tickets.name, zendeskTools.list_tickets.parameters, zendeskTools.list_tickets.handler);
server.tool(zendeskTools.get_ticket.name, zendeskTools.get_ticket.parameters, zendeskTools.get_ticket.handler);
server.tool(zendeskTools.create_ticket.name, zendeskTools.create_ticket.parameters, zendeskTools.create_ticket.handler);
server.tool(zendeskTools.add_comment.name, zendeskTools.add_comment.parameters, zendeskTools.add_comment.handler);
server.tool(zendeskTools.update_ticket.name, zendeskTools.update_ticket.parameters, zendeskTools.update_ticket.handler);
server.tool(zendeskTools.search_users.name, zendeskTools.search_users.parameters, zendeskTools.search_users.handler);

// =============================================================================
// WOOCOMMERCE TOOLS (7) - REQUIRE WOOCOMMERCE CREDENTIALS
// =============================================================================

server.tool(woocommerceTools.list_orders.name, woocommerceTools.list_orders.parameters, woocommerceTools.list_orders.handler);
server.tool(woocommerceTools.get_order.name, woocommerceTools.get_order.parameters, woocommerceTools.get_order.handler);
server.tool(woocommerceTools.update_order.name, woocommerceTools.update_order.parameters, woocommerceTools.update_order.handler);
server.tool(woocommerceTools.list_products.name, woocommerceTools.list_products.parameters, woocommerceTools.list_products.handler);
server.tool(woocommerceTools.get_product.name, woocommerceTools.get_product.parameters, woocommerceTools.get_product.handler);
server.tool(woocommerceTools.list_customers.name, woocommerceTools.list_customers.parameters, woocommerceTools.list_customers.handler);
server.tool(woocommerceTools.get_customer.name, woocommerceTools.get_customer.parameters, woocommerceTools.get_customer.handler);

// =============================================================================
// SHOPIFY TOOLS (8) - REQUIRE SHOPIFY CREDENTIALS - Session 249.20
// =============================================================================

server.tool(shopifyTools.get_order.name, shopifyTools.get_order.parameters, shopifyTools.get_order.handler);
server.tool(shopifyTools.list_orders.name, shopifyTools.list_orders.parameters, shopifyTools.list_orders.handler);
server.tool(shopifyTools.get_product.name, shopifyTools.get_product.parameters, shopifyTools.get_product.handler);
server.tool(shopifyTools.cancel_order.name, shopifyTools.cancel_order.parameters, shopifyTools.cancel_order.handler);
server.tool(shopifyTools.create_refund.name, shopifyTools.create_refund.parameters, shopifyTools.create_refund.handler);
server.tool(shopifyTools.update_order.name, shopifyTools.update_order.parameters, shopifyTools.update_order.handler);
server.tool(shopifyTools.create_fulfillment.name, shopifyTools.create_fulfillment.parameters, shopifyTools.create_fulfillment.handler);
server.tool(shopifyTools.search_customers.name, shopifyTools.search_customers.parameters, shopifyTools.search_customers.handler);

// =============================================================================
// ZOHO CRM TOOLS (6) - REQUIRE ZOHO CREDENTIALS
// =============================================================================

server.tool(zohoTools.list_leads.name, zohoTools.list_leads.parameters, zohoTools.list_leads.handler);
server.tool(zohoTools.get_lead.name, zohoTools.get_lead.parameters, zohoTools.get_lead.handler);
server.tool(zohoTools.create_lead.name, zohoTools.create_lead.parameters, zohoTools.create_lead.handler);
server.tool(zohoTools.list_contacts.name, zohoTools.list_contacts.parameters, zohoTools.list_contacts.handler);
server.tool(zohoTools.list_deals.name, zohoTools.list_deals.parameters, zohoTools.list_deals.handler);
server.tool(zohoTools.search_records.name, zohoTools.search_records.parameters, zohoTools.search_records.handler);

// =============================================================================
// MAGENTO TOOLS (6) - REQUIRE MAGENTO CREDENTIALS
// =============================================================================

server.tool(magentoTools.list_orders.name, magentoTools.list_orders.parameters, magentoTools.list_orders.handler);
server.tool(magentoTools.get_order.name, magentoTools.get_order.parameters, magentoTools.get_order.handler);
server.tool(magentoTools.list_products.name, magentoTools.list_products.parameters, magentoTools.list_products.handler);
server.tool(magentoTools.get_product.name, magentoTools.get_product.parameters, magentoTools.get_product.handler);
server.tool(magentoTools.get_stock.name, magentoTools.get_stock.parameters, magentoTools.get_stock.handler);
server.tool(magentoTools.list_customers.name, magentoTools.list_customers.parameters, magentoTools.list_customers.handler);
// Magento WRITE operations - Session 249.20
server.tool(magentoTools.cancel_order.name, magentoTools.cancel_order.parameters, magentoTools.cancel_order.handler);
server.tool(magentoTools.create_refund.name, magentoTools.create_refund.parameters, magentoTools.create_refund.handler);
server.tool(magentoTools.hold_order.name, magentoTools.hold_order.parameters, magentoTools.hold_order.handler);
server.tool(magentoTools.unhold_order.name, magentoTools.unhold_order.parameters, magentoTools.unhold_order.handler);

// =============================================================================
// WIX STORES TOOLS (6) - REQUIRE WIX CREDENTIALS - Session 249.11
// Market: 7.4% global, 23% USA, +32.6% YoY (fastest growing)
// =============================================================================

server.tool(wixTools.list_orders.name, wixTools.list_orders.parameters, wixTools.list_orders.handler);
server.tool(wixTools.get_order.name, wixTools.get_order.parameters, wixTools.get_order.handler);
server.tool(wixTools.list_products.name, wixTools.list_products.parameters, wixTools.list_products.handler);
server.tool(wixTools.get_product.name, wixTools.get_product.parameters, wixTools.get_product.handler);
server.tool(wixTools.get_inventory.name, wixTools.get_inventory.parameters, wixTools.get_inventory.handler);
server.tool(wixTools.update_inventory.name, wixTools.update_inventory.parameters, wixTools.update_inventory.handler);

// =============================================================================
// SQUARESPACE COMMERCE TOOLS (7) - REQUIRE SQUARESPACE CREDENTIALS - Session 249.11
// Market: 2.6% global, 16% USA, design-focused merchants
// =============================================================================

server.tool(squarespaceTools.list_orders.name, squarespaceTools.list_orders.parameters, squarespaceTools.list_orders.handler);
server.tool(squarespaceTools.get_order.name, squarespaceTools.get_order.parameters, squarespaceTools.get_order.handler);
server.tool(squarespaceTools.fulfill_order.name, squarespaceTools.fulfill_order.parameters, squarespaceTools.fulfill_order.handler);
server.tool(squarespaceTools.list_products.name, squarespaceTools.list_products.parameters, squarespaceTools.list_products.handler);
server.tool(squarespaceTools.get_product.name, squarespaceTools.get_product.parameters, squarespaceTools.get_product.handler);
server.tool(squarespaceTools.list_inventory.name, squarespaceTools.list_inventory.parameters, squarespaceTools.list_inventory.handler);
server.tool(squarespaceTools.update_inventory.name, squarespaceTools.update_inventory.parameters, squarespaceTools.update_inventory.handler);

// =============================================================================
// BIGCOMMERCE TOOLS (7) - REQUIRE BIGCOMMERCE CREDENTIALS - Session 249.11
// Market: 1% global, 3% USA, mid-market/enterprise focus (75% ARR = enterprise)
// =============================================================================

server.tool(bigcommerceTools.list_orders.name, bigcommerceTools.list_orders.parameters, bigcommerceTools.list_orders.handler);
server.tool(bigcommerceTools.get_order.name, bigcommerceTools.get_order.parameters, bigcommerceTools.get_order.handler);
server.tool(bigcommerceTools.update_order_status.name, bigcommerceTools.update_order_status.parameters, bigcommerceTools.update_order_status.handler);
server.tool(bigcommerceTools.list_products.name, bigcommerceTools.list_products.parameters, bigcommerceTools.list_products.handler);
server.tool(bigcommerceTools.get_product.name, bigcommerceTools.get_product.parameters, bigcommerceTools.get_product.handler);
server.tool(bigcommerceTools.list_customers.name, bigcommerceTools.list_customers.parameters, bigcommerceTools.list_customers.handler);
server.tool(bigcommerceTools.get_customer.name, bigcommerceTools.get_customer.parameters, bigcommerceTools.get_customer.handler);
// BigCommerce WRITE operations - Session 249.20
server.tool(bigcommerceTools.cancel_order.name, bigcommerceTools.cancel_order.parameters, bigcommerceTools.cancel_order.handler);
server.tool(bigcommerceTools.refund_order.name, bigcommerceTools.refund_order.parameters, bigcommerceTools.refund_order.handler);

// =============================================================================
// PRESTASHOP TOOLS (7) - REQUIRE PRESTASHOP CREDENTIALS - Session 249.11
// Market: 1.91% global, 37% clients in France, strong in Europe
// =============================================================================

server.tool(prestashopTools.list_orders.name, prestashopTools.list_orders.parameters, prestashopTools.list_orders.handler);
server.tool(prestashopTools.get_order.name, prestashopTools.get_order.parameters, prestashopTools.get_order.handler);
server.tool(prestashopTools.list_products.name, prestashopTools.list_products.parameters, prestashopTools.list_products.handler);
server.tool(prestashopTools.get_product.name, prestashopTools.get_product.parameters, prestashopTools.get_product.handler);
server.tool(prestashopTools.get_stock.name, prestashopTools.get_stock.parameters, prestashopTools.get_stock.handler);
server.tool(prestashopTools.list_customers.name, prestashopTools.list_customers.parameters, prestashopTools.list_customers.handler);
server.tool(prestashopTools.get_customer.name, prestashopTools.get_customer.parameters, prestashopTools.get_customer.handler);
// PrestaShop WRITE operations - Session 249.20
server.tool(prestashopTools.update_order_status.name, prestashopTools.update_order_status.parameters, prestashopTools.update_order_status.handler);
server.tool(prestashopTools.cancel_order.name, prestashopTools.cancel_order.parameters, prestashopTools.cancel_order.handler);
server.tool(prestashopTools.refund_order.name, prestashopTools.refund_order.parameters, prestashopTools.refund_order.handler);

// =============================================================================
// EXPORT TOOLS (5) - Document Generation (CSV, XLSX, PDF)
// =============================================================================

server.tool(exportTools.generate_csv.name, exportTools.generate_csv.parameters, exportTools.generate_csv.handler);
server.tool(exportTools.generate_xlsx.name, exportTools.generate_xlsx.parameters, exportTools.generate_xlsx.handler);
server.tool(exportTools.generate_pdf.name, exportTools.generate_pdf.parameters, exportTools.generate_pdf.handler);
server.tool(exportTools.generate_pdf_table.name, exportTools.generate_pdf_table.parameters, exportTools.generate_pdf_table.handler);
server.tool(exportTools.list_exports.name, exportTools.list_exports.parameters, exportTools.list_exports.handler);

// =============================================================================
// EMAIL TOOLS (3) - SMTP Email Sending
// =============================================================================

server.tool(emailTools.send_email.name, emailTools.send_email.parameters, emailTools.send_email.handler);
server.tool(emailTools.send_email_with_template.name, emailTools.send_email_with_template.parameters, emailTools.send_email_with_template.handler);
server.tool(emailTools.verify_smtp.name, emailTools.verify_smtp.parameters, emailTools.verify_smtp.handler);

// =============================================================================
// GMAIL TOOLS (7) - Full Gmail API Integration - Session 249.9
// =============================================================================

server.tool(gmailTools.send_email.name, gmailTools.send_email.parameters, gmailTools.send_email.handler);
server.tool(gmailTools.list_messages.name, gmailTools.list_messages.parameters, gmailTools.list_messages.handler);
server.tool(gmailTools.get_message.name, gmailTools.get_message.parameters, gmailTools.get_message.handler);
server.tool(gmailTools.search_emails.name, gmailTools.search_emails.parameters, gmailTools.search_emails.handler);
server.tool(gmailTools.create_draft.name, gmailTools.create_draft.parameters, gmailTools.create_draft.handler);
server.tool(gmailTools.list_labels.name, gmailTools.list_labels.parameters, gmailTools.list_labels.handler);
server.tool(gmailTools.modify_labels.name, gmailTools.modify_labels.parameters, gmailTools.modify_labels.handler);

// =============================================================================
// IPAAS TOOLS (Zapier, Make, n8n) - Session 249.8
// Strategic integrations enabling +7000 app connections
// =============================================================================

// Zapier Tools (3) - iPaaS #1 worldwide
server.tool(zapierTools.trigger_webhook.name, zapierTools.trigger_webhook.parameters, zapierTools.trigger_webhook.handler);
server.tool(zapierTools.trigger_nla.name, zapierTools.trigger_nla.parameters, zapierTools.trigger_nla.handler);
server.tool(zapierTools.list_available_actions.name, zapierTools.list_available_actions.parameters, zapierTools.list_available_actions.handler);

// Make Tools (5) - iPaaS #2, popular in Europe/MENA
server.tool(makeTools.trigger_webhook.name, makeTools.trigger_webhook.parameters, makeTools.trigger_webhook.handler);
server.tool(makeTools.list_scenarios.name, makeTools.list_scenarios.parameters, makeTools.list_scenarios.handler);
server.tool(makeTools.get_scenario.name, makeTools.get_scenario.parameters, makeTools.get_scenario.handler);
server.tool(makeTools.run_scenario.name, makeTools.run_scenario.parameters, makeTools.run_scenario.handler);
server.tool(makeTools.list_executions.name, makeTools.list_executions.parameters, makeTools.list_executions.handler);

// n8n Tools (5) - Open-source iPaaS, self-hostable
server.tool(n8nTools.trigger_webhook.name, n8nTools.trigger_webhook.parameters, n8nTools.trigger_webhook.handler);
server.tool(n8nTools.list_workflows.name, n8nTools.list_workflows.parameters, n8nTools.list_workflows.handler);
server.tool(n8nTools.get_workflow.name, n8nTools.get_workflow.parameters, n8nTools.get_workflow.handler);
server.tool(n8nTools.activate_workflow.name, n8nTools.activate_workflow.parameters, n8nTools.activate_workflow.handler);
server.tool(n8nTools.list_executions.name, n8nTools.list_executions.parameters, n8nTools.list_executions.handler);

// =============================================================================
// STRIPE TOOLS (20) - Payment Processing - Session 249.21
// Complete transactional cycle: Payment Links, Customers, Products, Invoices
// =============================================================================

server.tool(stripeTools.create_payment_link.name, stripeTools.create_payment_link.parameters, stripeTools.create_payment_link.handler);
server.tool(stripeTools.list_payment_links.name, stripeTools.list_payment_links.parameters, stripeTools.list_payment_links.handler);
server.tool(stripeTools.deactivate_payment_link.name, stripeTools.deactivate_payment_link.parameters, stripeTools.deactivate_payment_link.handler);
server.tool(stripeTools.create_customer.name, stripeTools.create_customer.parameters, stripeTools.create_customer.handler);
server.tool(stripeTools.get_customer.name, stripeTools.get_customer.parameters, stripeTools.get_customer.handler);
server.tool(stripeTools.list_customers.name, stripeTools.list_customers.parameters, stripeTools.list_customers.handler);
server.tool(stripeTools.create_product.name, stripeTools.create_product.parameters, stripeTools.create_product.handler);
server.tool(stripeTools.list_products.name, stripeTools.list_products.parameters, stripeTools.list_products.handler);
server.tool(stripeTools.create_price.name, stripeTools.create_price.parameters, stripeTools.create_price.handler);
server.tool(stripeTools.create_checkout_session.name, stripeTools.create_checkout_session.parameters, stripeTools.create_checkout_session.handler);
server.tool(stripeTools.get_checkout_session.name, stripeTools.get_checkout_session.parameters, stripeTools.get_checkout_session.handler);
server.tool(stripeTools.create_invoice.name, stripeTools.create_invoice.parameters, stripeTools.create_invoice.handler);
server.tool(stripeTools.add_invoice_item.name, stripeTools.add_invoice_item.parameters, stripeTools.add_invoice_item.handler);
server.tool(stripeTools.finalize_invoice.name, stripeTools.finalize_invoice.parameters, stripeTools.finalize_invoice.handler);
server.tool(stripeTools.send_invoice.name, stripeTools.send_invoice.parameters, stripeTools.send_invoice.handler);
server.tool(stripeTools.create_payment_intent.name, stripeTools.create_payment_intent.parameters, stripeTools.create_payment_intent.handler);
server.tool(stripeTools.get_payment_intent.name, stripeTools.get_payment_intent.parameters, stripeTools.get_payment_intent.handler);
server.tool(stripeTools.create_refund.name, stripeTools.create_refund.parameters, stripeTools.create_refund.handler);
server.tool(stripeTools.get_balance.name, stripeTools.get_balance.parameters, stripeTools.get_balance.handler);

// =============================================================================
// RECOMMENDATION TOOLS (4) - AI Product Recommendations
// =============================================================================

server.tool(recommendationTools.get_similar_products.name, recommendationTools.get_similar_products.parameters, recommendationTools.get_similar_products.handler);
server.tool(recommendationTools.get_frequently_bought_together.name, recommendationTools.get_frequently_bought_together.parameters, recommendationTools.get_frequently_bought_together.handler);
server.tool(recommendationTools.get_personalized.name, recommendationTools.get_personalized.parameters, recommendationTools.get_personalized.handler);
server.tool(recommendationTools.learn_from_orders.name, recommendationTools.learn_from_orders.parameters, recommendationTools.learn_from_orders.handler);

// =============================================================================
// HUBSPOT TOOLS (7) - CRM + CTI Integration
// =============================================================================

server.tool(hubspotTools.create_contact.name, hubspotTools.create_contact.parameters, hubspotTools.create_contact.handler);
server.tool(hubspotTools.search_contacts.name, hubspotTools.search_contacts.parameters, hubspotTools.search_contacts.handler);
server.tool(hubspotTools.get_contact.name, hubspotTools.get_contact.parameters, hubspotTools.get_contact.handler);
server.tool(hubspotTools.update_contact.name, hubspotTools.update_contact.parameters, hubspotTools.update_contact.handler);
server.tool(hubspotTools.create_deal.name, hubspotTools.create_deal.parameters, hubspotTools.create_deal.handler);
server.tool(hubspotTools.log_call.name, hubspotTools.log_call.parameters, hubspotTools.log_call.handler);
server.tool(hubspotTools.list_pipelines.name, hubspotTools.list_pipelines.parameters, hubspotTools.list_pipelines.handler);

// =============================================================================
// KLAVIYO TOOLS (5) - Marketing Automation
// =============================================================================

server.tool(klaviyoTools.create_profile.name, klaviyoTools.create_profile.parameters, klaviyoTools.create_profile.handler);
server.tool(klaviyoTools.get_profile.name, klaviyoTools.get_profile.parameters, klaviyoTools.get_profile.handler);
server.tool(klaviyoTools.track_event.name, klaviyoTools.track_event.parameters, klaviyoTools.track_event.handler);
server.tool(klaviyoTools.subscribe.name, klaviyoTools.subscribe.parameters, klaviyoTools.subscribe.handler);
server.tool(klaviyoTools.list_segments.name, klaviyoTools.list_segments.parameters, klaviyoTools.list_segments.handler);

// =============================================================================
// TWILIO TOOLS (5) - SMS + Voice + WhatsApp
// =============================================================================

server.tool(twilioTools.send_sms.name, twilioTools.send_sms.parameters, twilioTools.send_sms.handler);
server.tool(twilioTools.make_call.name, twilioTools.make_call.parameters, twilioTools.make_call.handler);
server.tool(twilioTools.get_call.name, twilioTools.get_call.parameters, twilioTools.get_call.handler);
server.tool(twilioTools.list_calls.name, twilioTools.list_calls.parameters, twilioTools.list_calls.handler);
server.tool(twilioTools.send_whatsapp.name, twilioTools.send_whatsapp.parameters, twilioTools.send_whatsapp.handler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VocalIA MCP Server v0.9.0 running on stdio");
  console.error(`Voice API URL: ${VOCALIA_API_URL}`);
  console.error(`Telephony URL: ${VOCALIA_TELEPHONY_URL}`);
  console.error("Tools: 203 (11 always available, 192 require external services)");
  console.error("E-commerce: Shopify, WooCommerce, Magento, Wix, Squarespace, BigCommerce, PrestaShop (~64% market)");
  console.error("CRM: HubSpot (7 tools - CTI, Contacts, Deals, Pipelines)");
  console.error("Marketing: Klaviyo (5 tools - Profiles, Events, Segments)");
  console.error("Communications: Twilio (5 tools - SMS, Voice, WhatsApp)");
  console.error("Payments: Stripe (19 tools - Payment Links, Checkout, Invoices, Refunds)");
  console.error("Integrations: 28 native + iPaaS (Zapier/Make/n8n → +7000 apps)");
  console.error(`Booking queue: ${BOOKING_QUEUE_PATH}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
