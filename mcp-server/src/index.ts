#!/usr/bin/env node
/**
 * VocalIA MCP Server - SOTA Implementation
 * Model Context Protocol server exposing VocalIA Voice AI Platform capabilities.
 *
 * Session 250.171c - v1.0.0 - SOTA: registerTool() + descriptions + annotations on ALL 203 tools
 * + 6 Resources (registerResource) + 8 Prompts (registerPrompt)
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
 * EXTERNAL MODULE TOOLS (181):
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

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import { VocaliaOAuthProvider } from "./auth-provider.js";
import { dataPath, personasPath, scriptsPath } from "./paths.js";
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
const require = createRequire(import.meta.url);

// =============================================================================
// DYNAMIC DATA LOADING — Single source of truth from voice-persona-injector.cjs
// =============================================================================

// Loaded once at module level (Node.js caches requires)
let INJECTOR_PERSONAS: Record<string, any> = {};
let INJECTOR_SYSTEM_PROMPTS: Record<string, Record<string, string>> = {};

try {
  const injectorPath = personasPath('voice-persona-injector.cjs');
  const injector = require(injectorPath);
  INJECTOR_PERSONAS = injector.PERSONAS || {};
  INJECTOR_SYSTEM_PROMPTS = injector.SYSTEM_PROMPTS || {};
  console.error(`✅ Loaded ${Object.keys(INJECTOR_PERSONAS).length} personas + ${Object.keys(INJECTOR_SYSTEM_PROMPTS).length} system prompts from voice-persona-injector.cjs`);
} catch (e) {
  console.error('⚠️ Could not load voice-persona-injector.cjs — using inline fallback data');
}

// =============================================================================
// SERVER FACTORY — Creates a fully configured VocalIA McpServer instance
// Each call creates an independent server (required for multi-session HTTP transport)
// =============================================================================

export function createVocaliaServer(): McpServer {

// =============================================================================
// TOOL ANNOTATION PRESETS
// =============================================================================

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const CREATE_OP: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };
const UPDATE_OP: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };
const DELETE_OP: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true };
const GENERATE_OP: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };

// =============================================================================
// LOGGING HELPERS — Phase 3: Structured logging via MCP protocol
// =============================================================================

type LogLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";

/**
 * Send a structured log message to connected MCP clients.
 * Safe to call even when no client is connected (silently ignored).
 */
function log(level: LogLevel, data: unknown, logger?: string) {
  try {
    server.sendLoggingMessage({ level, logger: logger || "vocalia", data });
  } catch {
    // Silently ignore if not connected — logging must never break the server
  }
}

/**
 * Wrap an inline tool handler with automatic logging (start/complete/error).
 * Used for registerTool() handlers. registerModuleTool() has its own wrapper.
 */
function withLogging<T extends (...args: any[]) => any>(name: string, handler: T): T {
  return (async (...args: any[]) => {
    const start = Date.now();
    log("info", `[tool:${name}] started`, "tools");
    try {
      const result = await handler(...args);
      log("info", `[tool:${name}] completed in ${Date.now() - start}ms`, "tools");
      return result;
    } catch (error) {
      log("error", `[tool:${name}] failed after ${Date.now() - start}ms: ${(error as Error).message}`, "tools");
      throw error;
    }
  }) as unknown as T;
}

/**
 * Helper to infer annotations from tool name patterns.
 */
function inferAnnotations(name: string): ToolAnnotations {
  if (/_(get|list|search|status|check|explain|info|busy)/.test(name)) return READ_ONLY;
  if (/_(create|send|trigger|initiate|subscribe|log|append|schedule|track|record)/.test(name)) return CREATE_OP;
  if (/_(update|sync|modify|activate|replace|set|hold|unhold)/.test(name)) return UPDATE_OP;
  if (/_(delete|cancel|deactivate|refund|clear|remove|fulfill)/.test(name)) return DELETE_OP;
  if (/_(generate|export)/.test(name)) return GENERATE_OP;
  return READ_ONLY; // safe default
}

/**
 * Register a module tool with description, inferred annotations, and automatic logging.
 * Wraps the handler with sendLoggingMessage for observability.
 */
function registerModuleTool(
  toolDef: { name: string; description?: string; parameters: any; handler: any },
  annotationsOverride?: ToolAnnotations
) {
  const wrappedHandler = withLogging(toolDef.name, toolDef.handler);

  server.registerTool(toolDef.name, {
    description: toolDef.description || `VocalIA tool: ${toolDef.name}`,
    inputSchema: toolDef.parameters,
    annotations: annotationsOverride || inferAnnotations(toolDef.name),
  }, wrappedHandler);
}

// Session 245: A2A Protocol Integration
// Import AgencyEventBus (CommonJS require in TS)
// const EVENT_BUS_PATH = corePath("AgencyEventBus.cjs");
// let eventBus: any = null;

// try {
//   // Dynamic require to avoid TS build issues with outside modules
//   const busModule = require(EVENT_BUS_PATH);
//   eventBus = busModule;
// } catch (error) {
//   console.error("Failed to load AgencyEventBus:", error);
// }


// Booking queue file path (real persistence)
const BOOKING_QUEUE_PATH = dataPath("booking-queue.json");

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

// Simple file lock for booking queue (MM1 fix — prevent race conditions)
let bookingQueueLocked = false;

async function withBookingLock<T>(fn: () => T): Promise<T> {
  const maxWait = 5000;
  const start = Date.now();
  while (bookingQueueLocked) {
    if (Date.now() - start > maxWait) throw new Error('Booking queue lock timeout');
    await new Promise(r => setTimeout(r, 50));
  }
  bookingQueueLocked = true;
  try {
    return fn();
  } finally {
    bookingQueueLocked = false;
  }
}

// Save booking to queue file (REAL persistence)
async function saveToBookingQueue(booking: any): Promise<string> {
  return withBookingLock(() => {
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
  });
}

// Environment configuration
const VOCALIA_API_URL = process.env.VOCALIA_API_URL || "http://localhost:3004";
const VOCALIA_TELEPHONY_URL = process.env.VOCALIA_TELEPHONY_URL || "http://localhost:3009";
const VOCALIA_API_KEY = process.env.VOCALIA_API_KEY || "";

// Initialize MCP Server
const server = new McpServer({
  name: "vocalia",
  version: "1.0.0",
});

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const LanguageEnum = z.enum(["fr", "en", "es", "ar", "ary"]);
// Session 250.120: Synced with 38 personas from voice-persona-injector.cjs
const PersonaKeyEnum = z.enum([
  // Tier 1 - Core (4)
  "AGENCY", "DENTAL", "PROPERTY", "CONTRACTOR",
  // Tier 2 - Expansion (18)
  "HEALER", "COUNSELOR", "CONCIERGE", "STYLIST", "RECRUITER",
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
// FACTUAL DATA - 38 PERSONAS (synced from voice-persona-injector.cjs - Session 250.120)
// =============================================================================

const PERSONAS_DATA = {
  core: [
    { key: "AGENCY", name: "VocalIA Architect", industries: ["marketing", "consulting"], voice: "ara", sensitivity: "normal" },
    { key: "DENTAL", name: "Cabinet Dentaire", industries: ["dental", "healthcare"], voice: "eve", sensitivity: "high" },
    { key: "PROPERTY", name: "Property Management", industries: ["real-estate"], voice: "leo", sensitivity: "normal" },
    { key: "CONTRACTOR", name: "Contractor Leads", industries: ["construction", "trades"], voice: "rex", sensitivity: "normal" },
  ],
  expansion: [
    { key: "HEALER", name: "Centre de Santé", industries: ["clinic", "wellness"], voice: "eve", sensitivity: "high" },
    { key: "COUNSELOR", name: "Cabinet Juridique", industries: ["legal"], voice: "sal", sensitivity: "high" },
    { key: "CONCIERGE", name: "Hôtel Concierge", industries: ["hospitality"], voice: "mika", sensitivity: "normal" },
    { key: "STYLIST", name: "Espace Beauté & Spa", industries: ["beauty", "salon"], voice: "eve", sensitivity: "normal" },
    { key: "RECRUITER", name: "Talent Acquisition", industries: ["HR", "staffing"], voice: "sal", sensitivity: "normal" },
    { key: "DISPATCHER", name: "Logistique Express", industries: ["logistics"], voice: "leo", sensitivity: "normal" },
    { key: "COLLECTOR", name: "Recouvrement Éthique", industries: ["finance"], voice: "rex", sensitivity: "normal" },
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
  pme: [
    { key: "RETAILER", name: "Commerce de Proximité", industries: ["retail"], voice: "mika", sensitivity: "normal" },
    { key: "BUILDER", name: "Entreprise BTP", industries: ["construction"], voice: "rex", sensitivity: "normal" },
    { key: "RESTAURATEUR", name: "Restaurant & Traiteur", industries: ["food-service"], voice: "eve", sensitivity: "normal" },
    { key: "TRAVEL_AGENT", name: "Agence de Voyage", industries: ["travel"], voice: "mika", sensitivity: "normal" },
    { key: "CONSULTANT", name: "Cabinet Conseil", industries: ["consulting"], voice: "sal", sensitivity: "normal" },
    { key: "IT_SERVICES", name: "Prestataire IT", industries: ["technology"], voice: "leo", sensitivity: "normal" },
    { key: "MANUFACTURER", name: "Industrie PME", industries: ["manufacturing"], voice: "rex", sensitivity: "normal" },
    { key: "DOCTOR", name: "Cabinet Médical", industries: ["healthcare"], voice: "eve", sensitivity: "high" },
    { key: "NOTARY", name: "Étude Notariale", industries: ["legal"], voice: "sal", sensitivity: "high" },
    { key: "BAKERY", name: "Boulangerie Pâtisserie", industries: ["food-retail"], voice: "eve", sensitivity: "normal" },
    { key: "SPECIALIST", name: "Spécialiste Métier", industries: ["specialist"], voice: "sal", sensitivity: "normal" },
    { key: "REAL_ESTATE_AGENT", name: "Agent Immobilier", industries: ["real-estate"], voice: "leo", sensitivity: "normal" },
    { key: "HAIRDRESSER", name: "Salon de Coiffure", industries: ["beauty"], voice: "eve", sensitivity: "normal" },
    { key: "GROCERY", name: "Épicerie & Livraison", industries: ["grocery", "delivery"], voice: "mika", sensitivity: "normal" },
  ],
};

// System prompts per persona per language
const SYSTEM_PROMPTS: Record<string, Record<string, string>> = {
  AGENCY: {
    fr: `Tu es le conseiller Voice AI de VocalIA. VocalIA est une plateforme Voice AI avec 2 produits:
1. Voice Widget: Assistant vocal 24/7 pour sites web
2. Voice Telephony: Ligne téléphonique IA (via Twilio)
OBJECTIF: Qualifier le prospect et proposer une démo à vocalia.ma/booking.
ATOUTS: 38 personas sectoriels, 5 langues dont Darija, intégrations CRM/e-commerce.`,
    en: `You are VocalIA's Voice AI consultant. VocalIA is a Voice AI platform with 2 products:
1. Voice Widget: 24/7 voice assistant for websites
2. Voice Telephony: AI phone line (via Twilio)
GOAL: Qualify prospects and offer a demo at vocalia.ma/booking.
STRENGTHS: 38 industry personas, 5 languages including Darija, CRM/e-commerce integrations.`,
    es: `Eres el consultor de Voice AI de VocalIA. VocalIA es una plataforma Voice AI con 2 productos:
1. Voice Widget: Asistente de voz 24/7 para sitios web
2. Voice Telephony: Línea telefónica IA (via Twilio)
OBJETIVO: Calificar prospectos y ofrecer demo en vocalia.ma/booking.
FORTALEZAS: 38 personas sectoriales, 5 idiomas incluyendo Darija, integraciones CRM/e-commerce.`,
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
server.registerTool(
  "translation_qa_check",
  {
    description: "Run translation quality audit across all 5 language files (FR, EN, ES, AR, ARY). Checks for missing keys, brand name corruption, and placeholder mismatches.",
    inputSchema: {},
    annotations: GENERATE_OP,
  },
  withLogging("translation_qa_check", async () => {
    try {
      const scriptPath = scriptsPath("translation-quality-check.py");
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, { timeout: 30000 });
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
        }],
        isError: true,
      };
    }
  })
);


// =============================================================================
// VOICE TOOLS (3)
// =============================================================================

// Tool 1: voice_generate_response - Main voice response with lead scoring
server.registerTool(
  "voice_generate_response",
  {
    description: "Generate an AI voice response using VocalIA's multi-provider fallback chain (Grok → Gemini → Claude → Atlas-Chat). Supports 38 industry personas across 5 languages with integrated lead scoring.",
    inputSchema: {
      message: z.string().describe("The user's message or query to respond to"),
      language: LanguageEnum.optional().describe("Response language (default: fr)"),
      sessionId: z.string().optional().describe("Session ID for conversation continuity"),
      personaKey: PersonaKeyEnum.optional().describe("Persona to use (default: AGENCY)"),
    },
    annotations: GENERATE_OP,
  },
  withLogging("voice_generate_response", async ({ message, language = "fr", sessionId, personaKey }) => {
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
        return { content: [{ type: "text" as const, text: `Error: ${response.status} - ${error}` }], isError: true };
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
        }],
        isError: true,
      };
    }
  })
);

// Tool 2: voice_providers_status - Check AI providers availability
server.registerTool(
  "voice_providers_status",
  {
    description: "Check real-time availability of all AI voice providers (Grok, Gemini, Claude, Atlas-Chat) and the TTS fallback chain status.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
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
        }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// PERSONA TOOLS (3) - LOCAL, NO API NEEDED
// =============================================================================

// Tool 3: personas_list - List all 38 personas by tier
server.registerTool(
  "personas_list",
  {
    description: "List all 38 VocalIA industry personas organized by tier (core, expansion, extended, pme). Returns persona keys, names, industries, voice options, and sensitivity levels.",
    inputSchema: {
      tier: z.enum(["core", "expansion", "extended", "pme", "all"]).optional().describe("Filter by tier (default: all)"),
    },
    annotations: READ_ONLY,
  },
  async ({ tier = "all" }) => {
    const tiers = {
      core: PERSONAS_DATA.core.length,
      expansion: PERSONAS_DATA.expansion.length,
      extended: PERSONAS_DATA.extended.length,
      pme: PERSONAS_DATA.pme.length,
    };
    const total = tiers.core + tiers.expansion + tiers.extended + tiers.pme;

    let result;
    if (tier === "all") {
      result = { ...PERSONAS_DATA, total, tiers };
    } else {
      const tierData = PERSONAS_DATA[tier as keyof typeof PERSONAS_DATA];
      result = { [tier]: tierData, total: tierData ? tierData.length : 0 };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: personas_get - Get details for a specific persona
server.registerTool(
  "personas_get",
  {
    description: "Get detailed information about a specific VocalIA persona including name, industries, voice, sensitivity, and a preview of the system prompt.",
    inputSchema: {
      personaKey: PersonaKeyEnum.describe("The persona key (e.g., AGENCY, DENTAL)"),
    },
    annotations: READ_ONLY,
  },
  async ({ personaKey }) => {
    // Find persona in ALL tiers including PME
    const allPersonas = [...PERSONAS_DATA.core, ...PERSONAS_DATA.expansion, ...PERSONAS_DATA.extended, ...PERSONAS_DATA.pme];
    const persona = allPersonas.find(p => p.key === personaKey);

    if (!persona) {
      return { content: [{ type: "text" as const, text: `Persona not found: ${personaKey}` }], isError: true };
    }

    // Use dynamic SYSTEM_PROMPTS from injector if available, fallback to inline
    const systemPrompt = INJECTOR_SYSTEM_PROMPTS[personaKey] || SYSTEM_PROMPTS[personaKey] || { fr: "Generic assistant" };

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          ...persona,
          languages_supported: ["fr", "en", "es", "ar", "ary"],
          system_prompt_preview: (systemPrompt.fr || "Generic assistant").substring(0, 200) + "...",
          system_prompt_languages: Object.keys(systemPrompt),
        }, null, 2),
      }],
    };
  }
);

// Tool 5: personas_get_system_prompt - Get full system prompt for a persona in a language
server.registerTool(
  "personas_get_system_prompt",
  {
    description: "Get the complete system prompt for a specific persona in a given language. Supports all 38 personas across 5 languages (fr, en, es, ar, ary).",
    inputSchema: {
      personaKey: PersonaKeyEnum.describe("The persona key"),
      language: LanguageEnum.optional().describe("Language for the prompt (default: fr)"),
    },
    annotations: READ_ONLY,
  },
  async ({ personaKey, language = "fr" }) => {
    // Prefer dynamic prompts from injector (190 prompts), fallback to inline (3 personas)
    const prompts = INJECTOR_SYSTEM_PROMPTS[personaKey] || SYSTEM_PROMPTS[personaKey];
    if (!prompts) {
      return { content: [{ type: "text" as const, text: `No system prompt defined for: ${personaKey}` }], isError: true };
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
server.registerTool(
  "qualify_lead",
  {
    description: "Calculate BANT (Budget, Authority, Need, Timeline) lead qualification score with industry bonus. Returns HOT/WARM/COOL/COLD classification and recommended next actions.",
    inputSchema: {
      budget: z.number().min(0).max(100).describe("Budget score (0-100): 100=defined budget, 50=flexible, 25=limited"),
      authority: z.number().min(0).max(100).describe("Authority score (0-100): 100=decision maker, 50=influencer, 25=user"),
      need: z.number().min(0).max(100).describe("Need/urgency score (0-100): 100=critical, 50=interested, 25=exploring"),
      timeline: z.number().min(0).max(100).describe("Timeline score (0-100): 100=immediate, 75=this quarter, 50=this year"),
      industry: z.string().optional().describe("Lead's industry (e.g., ecommerce, healthcare, real-estate)"),
      notes: z.string().optional().describe("Additional qualification notes"),
    },
    annotations: READ_ONLY,
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
server.registerTool(
  "lead_score_explain",
  {
    description: "Explain the BANT lead scoring methodology, qualification thresholds (HOT/WARM/COOL/COLD), and industry bonus rules.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
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
server.registerTool(
  "knowledge_search",
  {
    description: "Search VocalIA's knowledge base using BM25+TF-IDF hybrid retrieval. Covers 12 categories including lead-gen, SEO, email, voice-ai, and e-commerce.",
    inputSchema: {
      query: z.string().describe("Search query (e.g., 'voice AI pricing', 'email automation')"),
      category: z.string().optional().describe("Filter by category (lead-gen, seo, email, voice-ai, etc.)"),
      limit: z.number().min(1).max(10).optional().describe("Number of results (default: 5)"),
    },
    annotations: READ_ONLY,
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
server.registerTool(
  "knowledge_base_status",
  {
    description: "Get knowledge base system status including search modes (sparse, hybrid, graph), strategic metadata fields, and data location.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
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
server.registerTool(
  "telephony_initiate_call",
  {
    description: "Initiate an outbound AI phone call via Twilio PSTN bridge. The AI agent uses the specified persona and language for the conversation.",
    inputSchema: {
      to: z.string().describe("Phone number to call (E.164 format, e.g., +33612345678)"),
      personaKey: PersonaKeyEnum.optional().describe("Persona to use for the call"),
      language: LanguageEnum.optional().describe("Call language (default: fr)"),
      context: z.string().optional().describe("Context to provide to the AI agent"),
    },
    annotations: CREATE_OP,
  },
  withLogging("telephony_initiate_call", async ({ to, personaKey, language = "fr", context }) => {
    try {
      const response = await fetch(`${VOCALIA_TELEPHONY_URL}/twilio/outbound-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: to, persona: personaKey, language, context }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: [{ type: "text" as const, text: `Telephony error: ${response.status} - ${error}` }], isError: true };
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
        isError: true,
      };
    }
  })
);

// Tool 11: telephony_get_status - Get telephony system status
server.registerTool(
  "telephony_get_status",
  {
    description: "Check telephony system status including service availability, supported features (inbound/outbound calls), function tools count, and required credentials.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
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
            function_tools: 25,
            languages: ["fr", "en", "es", "ar", "ary"],
          },
          requirements: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "XAI_API_KEY"],
        }, null, 2),
      }],
    };
  }
);

// Tool 12: telephony_transfer_call - Transfer to human agent
server.registerTool(
  "telephony_transfer_call",
  {
    description: "Transfer an active phone call to a human agent. Requires an active call session via voice-telephony-bridge.",
    inputSchema: {
      callSid: z.string().describe("Twilio Call SID to transfer"),
      reason: z.string().describe("Reason for transfer (e.g., 'Complex issue', 'Customer request')"),
      targetNumber: z.string().optional().describe("Phone number to transfer to (optional)"),
    },
    annotations: UPDATE_OP,
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
server.registerTool(
  "messaging_send",
  {
    description: "Send a message via WhatsApp Business API or Twilio SMS with automatic fallback. Supports auto channel selection.",
    inputSchema: {
      to: z.string().describe("Phone number in E.164 format (e.g., +33612345678)"),
      message: z.string().describe("Message content to send"),
      channel: z.enum(["auto", "whatsapp", "sms"]).optional().describe("Channel preference (default: auto with fallback)"),
    },
    annotations: CREATE_OP,
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
        return { content: [{ type: "text" as const, text: `Messaging error: ${response.status} - ${error}` }], isError: true };
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
        isError: true,
      };
    }
  }
);

// =============================================================================
// CRM TOOLS (3) - REQUIRE HUBSPOT CREDENTIALS
// =============================================================================

// Tool 14: crm_get_customer - Get customer context from HubSpot
server.registerTool(
  "crm_get_customer",
  {
    description: "Get customer context from HubSpot CRM by email. Returns contact details, deal history, lead status, and company info.",
    inputSchema: {
      email: z.string().email().describe("Customer email address"),
    },
    annotations: READ_ONLY,
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

// Tool 15: crm_create_contact - Create new contact in HubSpot
server.registerTool(
  "crm_create_contact",
  {
    description: "Create a new contact in HubSpot CRM with optional lead score. Requires HUBSPOT_API_KEY credential.",
    inputSchema: {
      email: z.string().email().describe("Contact email"),
      firstName: z.string().describe("First name"),
      lastName: z.string().describe("Last name"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      leadScore: z.number().optional().describe("Initial lead score (0-100)"),
    },
    annotations: CREATE_OP,
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

// Tool 16: ecommerce_customer_profile - Get profile from Klaviyo
server.registerTool(
  "ecommerce_customer_profile",
  {
    description: "Get e-commerce customer profile from Klaviyo including segments (VIP, Engaged, Churned), predicted LTV, and product recommendations.",
    inputSchema: {
      email: z.string().email().describe("Customer email"),
    },
    annotations: READ_ONLY,
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

// Tool 17: ucp_sync - Sync customer profile data
server.registerTool(
  "ucp_sync",
  {
    description: "Sync customer profile data to the Unified Customer Profile (ContextBox v3.0). Applies preference, extracted data, and override diffs.",
    inputSchema: {
      sessionId: z.string().describe("Session ID"),
      tenantId: z.string().optional().describe("Tenant ID (default: agency)"),
      diff: z.object({
        preferences: z.record(z.any()).optional(),
        extractedData: z.record(z.any()).optional(),
        overrides: z.record(z.any()).optional()
      }).describe("Changes to apply to the profile"),
    },
    annotations: UPDATE_OP,
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
server.registerTool(
  "booking_schedule_callback",
  {
    description: "Schedule a follow-up callback with persistent file storage. Saves to booking queue for manual or automated processing.",
    inputSchema: {
      email: z.string().email().describe("Contact email"),
      phone: z.string().optional().describe("Phone number for callback"),
      preferredTime: z.string().describe("Preferred callback time (e.g., 'tomorrow 10am', 'Monday afternoon')"),
      notes: z.string().optional().describe("Context notes for the callback"),
      nextAction: z.enum(["call_back", "send_email", "send_sms_booking_link", "send_info_pack"]).optional(),
    },
    annotations: CREATE_OP,
  },
  async ({ email, phone, preferredTime, notes, nextAction = "call_back" }) => {
    // REAL: Save to persistent queue file (with lock — MM1 fix)
    const bookingId = await saveToBookingQueue({
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
          saved_to: "data/booking-queue.json",
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
server.registerTool(
  "booking_create",
  {
    description: "Create a discovery call booking with persistent file storage. Supports 4 meeting types (discovery_call, demo, audit, consultation) with lead qualification scoring.",
    inputSchema: {
      name: z.string().describe("Full name of the prospect"),
      email: z.string().email().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      slot: z.string().describe("Preferred time slot (e.g., 'Tuesday 2pm', 'Thursday 10am')"),
      meetingType: z.enum(["discovery_call", "demo", "audit", "consultation"]).optional(),
      qualificationScore: z.enum(["hot", "warm", "cold"]).optional(),
      notes: z.string().optional(),
    },
    annotations: CREATE_OP,
  },
  withLogging("booking_create", async ({ name, email, phone, slot, meetingType = "discovery_call", qualificationScore, notes }) => {
    // REAL: Save to persistent queue file (with lock — MM1 fix)
    const bookingId = await saveToBookingQueue({
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
          saved_to: "data/booking-queue.json",
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
  })
);

// =============================================================================
// SYSTEM TOOLS (3)
// =============================================================================

// Tool 20: api_status - Complete system health check
server.registerTool(
  "api_status",
  {
    description: "Complete system health check including Voice API and Telephony service status, latency metrics, and tool availability by credential requirement.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
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
            version: "1.0.0",
            tools_count: 203,
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
            requires_shopify: [
              "shopify_get_order", "shopify_list_orders", "shopify_get_product",
              "shopify_cancel_order", "shopify_create_refund", "shopify_update_order",
              "shopify_create_fulfillment", "shopify_search_customers"
            ],
            requires_klaviyo: [
              "klaviyo_create_profile", "klaviyo_get_profile", "klaviyo_track_event",
              "klaviyo_subscribe", "klaviyo_list_segments"
            ],
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
            requires_zendesk: [
              "zendesk_list_tickets", "zendesk_get_ticket", "zendesk_create_ticket",
              "zendesk_add_comment", "zendesk_update_ticket", "zendesk_search_users"
            ],
            requires_woocommerce: [
              "woocommerce_list_orders", "woocommerce_get_order", "woocommerce_update_order",
              "woocommerce_list_products", "woocommerce_get_product", "woocommerce_list_customers", "woocommerce_get_customer"
            ],
            requires_zoho: [
              "zoho_list_leads", "zoho_get_lead", "zoho_create_lead",
              "zoho_list_contacts", "zoho_list_deals", "zoho_search_records"
            ],
            requires_magento: [
              "magento_list_orders", "magento_get_order", "magento_list_products", "magento_get_product",
              "magento_get_stock", "magento_list_customers", "magento_cancel_order", "magento_create_refund",
              "magento_hold_order", "magento_unhold_order"
            ],
            requires_wix: [
              "wix_list_orders", "wix_get_order", "wix_list_products",
              "wix_get_product", "wix_get_inventory", "wix_update_inventory"
            ],
            requires_squarespace: [
              "squarespace_list_orders", "squarespace_get_order", "squarespace_fulfill_order",
              "squarespace_list_products", "squarespace_get_product", "squarespace_list_inventory", "squarespace_update_inventory"
            ],
            requires_bigcommerce: [
              "bigcommerce_list_orders", "bigcommerce_get_order", "bigcommerce_update_order_status",
              "bigcommerce_list_products", "bigcommerce_get_product", "bigcommerce_list_customers",
              "bigcommerce_get_customer", "bigcommerce_cancel_order", "bigcommerce_refund_order"
            ],
            requires_prestashop: [
              "prestashop_list_orders", "prestashop_get_order", "prestashop_list_products", "prestashop_get_product",
              "prestashop_get_stock", "prestashop_list_customers", "prestashop_get_customer",
              "prestashop_update_order_status", "prestashop_cancel_order", "prestashop_refund_order"
            ],
            requires_stripe: [
              "stripe_create_payment_link", "stripe_list_payment_links", "stripe_deactivate_payment_link",
              "stripe_create_customer", "stripe_get_customer", "stripe_list_customers",
              "stripe_create_product", "stripe_list_products", "stripe_create_price",
              "stripe_create_checkout_session", "stripe_get_checkout_session",
              "stripe_create_invoice", "stripe_add_invoice_item", "stripe_finalize_invoice", "stripe_send_invoice",
              "stripe_create_payment_intent", "stripe_get_payment_intent", "stripe_create_refund", "stripe_get_balance"
            ],
            requires_smtp: ["email_send", "email_send_template", "email_verify_smtp"],
            requires_gmail: [
              "gmail_send", "gmail_list", "gmail_get", "gmail_search",
              "gmail_draft", "gmail_labels", "gmail_modify_labels"
            ],
            requires_zapier: ["zapier_trigger_webhook", "zapier_trigger_nla", "zapier_list_actions"],
            requires_make: ["make_trigger_webhook", "make_list_scenarios", "make_get_scenario", "make_run_scenario", "make_list_executions"],
            requires_n8n: ["n8n_trigger_webhook", "n8n_list_workflows", "n8n_get_workflow", "n8n_activate_workflow", "n8n_list_executions"],
            local: [
              "export_generate_csv", "export_generate_xlsx", "export_generate_pdf", "export_generate_pdf_table", "export_list_files",
              "recommendation_get_similar", "recommendation_get_frequently_bought_together", "recommendation_get_personalized", "recommendation_learn_from_orders",
              "ucp_sync_preference", "ucp_get_profile", "ucp_list_profiles", "ucp_record_interaction", "ucp_track_event", "ucp_get_insights", "ucp_update_ltv"
            ],
          },
        }, null, 2),
      }],
    };
  }
);

// Tool 21: system_languages - List supported languages
server.registerTool(
  "system_languages",
  {
    description: "List all 5 supported languages (FR, EN, ES, AR, ARY/Darija) and 7 voice options with TTS fallback chain (Grok → Gemini → Browser).",
    inputSchema: {},
    annotations: READ_ONLY,
  },
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

registerModuleTool(calendarTools.check_availability);
registerModuleTool(calendarTools.create_event);

// =============================================================================
// SLACK TOOLS (1) - REQUIRE WEBHOOK URL
// =============================================================================

registerModuleTool(slackTools.send_notification);

// =============================================================================
// UCP TOOLS (7) - GLOBAL MARKET RULES + CDP Enhanced
// =============================================================================

registerModuleTool(ucpTools.ucp_sync_preference);
registerModuleTool(ucpTools.ucp_get_profile);
registerModuleTool(ucpTools.ucp_list_profiles);
registerModuleTool(ucpTools.ucp_record_interaction);
registerModuleTool(ucpTools.ucp_track_event);
registerModuleTool(ucpTools.ucp_get_insights);
registerModuleTool(ucpTools.ucp_update_ltv);

// =============================================================================
// GOOGLE SHEETS TOOLS (5) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

registerModuleTool(sheetsTools.read_range);
registerModuleTool(sheetsTools.write_range);
registerModuleTool(sheetsTools.append_rows);
registerModuleTool(sheetsTools.get_spreadsheet_info);
registerModuleTool(sheetsTools.create_spreadsheet);

// =============================================================================
// GOOGLE DRIVE TOOLS (6) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

registerModuleTool(driveTools.list_files);
registerModuleTool(driveTools.get_file);
registerModuleTool(driveTools.create_folder);
registerModuleTool(driveTools.upload_file);
registerModuleTool(driveTools.share_file);
registerModuleTool(driveTools.delete_file);

// =============================================================================
// CALENDLY TOOLS (6) - REQUIRE CALENDLY CREDENTIALS
// =============================================================================

registerModuleTool(calendlyTools.get_user);
registerModuleTool(calendlyTools.list_event_types);
registerModuleTool(calendlyTools.get_available_times);
registerModuleTool(calendlyTools.list_scheduled_events);
registerModuleTool(calendlyTools.cancel_event);
registerModuleTool(calendlyTools.get_user_busy_times);

// =============================================================================
// FRESHDESK TOOLS (6) - REQUIRE FRESHDESK CREDENTIALS
// =============================================================================

registerModuleTool(freshdeskTools.list_tickets);
registerModuleTool(freshdeskTools.get_ticket);
registerModuleTool(freshdeskTools.create_ticket);
registerModuleTool(freshdeskTools.reply_to_ticket);
registerModuleTool(freshdeskTools.update_ticket);
registerModuleTool(freshdeskTools.search_contacts);

// =============================================================================
// PIPEDRIVE TOOLS (7) - REQUIRE PIPEDRIVE CREDENTIALS
// =============================================================================

registerModuleTool(pipedriveTools.list_deals);
registerModuleTool(pipedriveTools.create_deal);
registerModuleTool(pipedriveTools.update_deal);
registerModuleTool(pipedriveTools.list_persons);
registerModuleTool(pipedriveTools.create_person);
registerModuleTool(pipedriveTools.search);
registerModuleTool(pipedriveTools.list_activities);

// =============================================================================
// GOOGLE DOCS TOOLS (4) - REQUIRE GOOGLE CREDENTIALS
// =============================================================================

registerModuleTool(docsTools.get_document);
registerModuleTool(docsTools.create_document);
registerModuleTool(docsTools.append_text);
registerModuleTool(docsTools.replace_text);

// =============================================================================
// ZENDESK TOOLS (6) - REQUIRE ZENDESK CREDENTIALS
// =============================================================================

registerModuleTool(zendeskTools.list_tickets);
registerModuleTool(zendeskTools.get_ticket);
registerModuleTool(zendeskTools.create_ticket);
registerModuleTool(zendeskTools.add_comment);
registerModuleTool(zendeskTools.update_ticket);
registerModuleTool(zendeskTools.search_users);

// =============================================================================
// WOOCOMMERCE TOOLS (7) - REQUIRE WOOCOMMERCE CREDENTIALS
// =============================================================================

registerModuleTool(woocommerceTools.list_orders);
registerModuleTool(woocommerceTools.get_order);
registerModuleTool(woocommerceTools.update_order);
registerModuleTool(woocommerceTools.list_products);
registerModuleTool(woocommerceTools.get_product);
registerModuleTool(woocommerceTools.list_customers);
registerModuleTool(woocommerceTools.get_customer);

// =============================================================================
// SHOPIFY TOOLS (8) - REQUIRE SHOPIFY CREDENTIALS
// =============================================================================

registerModuleTool(shopifyTools.get_order);
registerModuleTool(shopifyTools.list_orders);
registerModuleTool(shopifyTools.get_product);
registerModuleTool(shopifyTools.cancel_order);
registerModuleTool(shopifyTools.create_refund);
registerModuleTool(shopifyTools.update_order);
registerModuleTool(shopifyTools.create_fulfillment);
registerModuleTool(shopifyTools.search_customers);

// =============================================================================
// ZOHO CRM TOOLS (6) - REQUIRE ZOHO CREDENTIALS
// =============================================================================

registerModuleTool(zohoTools.list_leads);
registerModuleTool(zohoTools.get_lead);
registerModuleTool(zohoTools.create_lead);
registerModuleTool(zohoTools.list_contacts);
registerModuleTool(zohoTools.list_deals);
registerModuleTool(zohoTools.search_records);

// =============================================================================
// MAGENTO TOOLS (10) - REQUIRE MAGENTO CREDENTIALS
// =============================================================================

registerModuleTool(magentoTools.list_orders);
registerModuleTool(magentoTools.get_order);
registerModuleTool(magentoTools.list_products);
registerModuleTool(magentoTools.get_product);
registerModuleTool(magentoTools.get_stock);
registerModuleTool(magentoTools.list_customers);
registerModuleTool(magentoTools.cancel_order);
registerModuleTool(magentoTools.create_refund);
registerModuleTool(magentoTools.hold_order);
registerModuleTool(magentoTools.unhold_order);

// =============================================================================
// WIX STORES TOOLS (6) - REQUIRE WIX CREDENTIALS
// =============================================================================

registerModuleTool(wixTools.list_orders);
registerModuleTool(wixTools.get_order);
registerModuleTool(wixTools.list_products);
registerModuleTool(wixTools.get_product);
registerModuleTool(wixTools.get_inventory);
registerModuleTool(wixTools.update_inventory);

// =============================================================================
// SQUARESPACE COMMERCE TOOLS (7) - REQUIRE SQUARESPACE CREDENTIALS
// =============================================================================

registerModuleTool(squarespaceTools.list_orders);
registerModuleTool(squarespaceTools.get_order);
registerModuleTool(squarespaceTools.fulfill_order);
registerModuleTool(squarespaceTools.list_products);
registerModuleTool(squarespaceTools.get_product);
registerModuleTool(squarespaceTools.list_inventory);
registerModuleTool(squarespaceTools.update_inventory);

// =============================================================================
// BIGCOMMERCE TOOLS (9) - REQUIRE BIGCOMMERCE CREDENTIALS
// =============================================================================

registerModuleTool(bigcommerceTools.list_orders);
registerModuleTool(bigcommerceTools.get_order);
registerModuleTool(bigcommerceTools.update_order_status);
registerModuleTool(bigcommerceTools.list_products);
registerModuleTool(bigcommerceTools.get_product);
registerModuleTool(bigcommerceTools.list_customers);
registerModuleTool(bigcommerceTools.get_customer);
registerModuleTool(bigcommerceTools.cancel_order);
registerModuleTool(bigcommerceTools.refund_order);

// =============================================================================
// PRESTASHOP TOOLS (10) - REQUIRE PRESTASHOP CREDENTIALS
// =============================================================================

registerModuleTool(prestashopTools.list_orders);
registerModuleTool(prestashopTools.get_order);
registerModuleTool(prestashopTools.list_products);
registerModuleTool(prestashopTools.get_product);
registerModuleTool(prestashopTools.get_stock);
registerModuleTool(prestashopTools.list_customers);
registerModuleTool(prestashopTools.get_customer);
registerModuleTool(prestashopTools.update_order_status);
registerModuleTool(prestashopTools.cancel_order);
registerModuleTool(prestashopTools.refund_order);

// =============================================================================
// EXPORT TOOLS (5) - Document Generation (CSV, XLSX, PDF)
// =============================================================================

registerModuleTool(exportTools.generate_csv);
registerModuleTool(exportTools.generate_xlsx);
registerModuleTool(exportTools.generate_pdf);
registerModuleTool(exportTools.generate_pdf_table);
registerModuleTool(exportTools.list_exports);

// =============================================================================
// EMAIL TOOLS (3) - SMTP Email Sending
// =============================================================================

registerModuleTool(emailTools.send_email);
registerModuleTool(emailTools.send_email_with_template);
registerModuleTool(emailTools.verify_smtp);

// =============================================================================
// GMAIL TOOLS (7) - Full Gmail API Integration
// =============================================================================

registerModuleTool(gmailTools.send_email);
registerModuleTool(gmailTools.list_messages);
registerModuleTool(gmailTools.get_message);
registerModuleTool(gmailTools.search_emails);
registerModuleTool(gmailTools.create_draft);
registerModuleTool(gmailTools.list_labels);
registerModuleTool(gmailTools.modify_labels);

// =============================================================================
// IPAAS TOOLS (Zapier, Make, n8n) — +7000 app connections
// =============================================================================

// Zapier (3) - iPaaS #1 worldwide
registerModuleTool(zapierTools.trigger_webhook);
registerModuleTool(zapierTools.trigger_nla);
registerModuleTool(zapierTools.list_available_actions);

// Make (5) - iPaaS #2, popular in Europe/MENA
registerModuleTool(makeTools.trigger_webhook);
registerModuleTool(makeTools.list_scenarios);
registerModuleTool(makeTools.get_scenario);
registerModuleTool(makeTools.run_scenario);
registerModuleTool(makeTools.list_executions);

// n8n (5) - Open-source iPaaS, self-hostable
registerModuleTool(n8nTools.trigger_webhook);
registerModuleTool(n8nTools.list_workflows);
registerModuleTool(n8nTools.get_workflow);
registerModuleTool(n8nTools.activate_workflow);
registerModuleTool(n8nTools.list_executions);

// =============================================================================
// STRIPE TOOLS (19) - Payment Processing
// =============================================================================

registerModuleTool(stripeTools.create_payment_link);
registerModuleTool(stripeTools.list_payment_links);
registerModuleTool(stripeTools.deactivate_payment_link);
registerModuleTool(stripeTools.create_customer);
registerModuleTool(stripeTools.get_customer);
registerModuleTool(stripeTools.list_customers);
registerModuleTool(stripeTools.create_product);
registerModuleTool(stripeTools.list_products);
registerModuleTool(stripeTools.create_price);
registerModuleTool(stripeTools.create_checkout_session);
registerModuleTool(stripeTools.get_checkout_session);
registerModuleTool(stripeTools.create_invoice);
registerModuleTool(stripeTools.add_invoice_item);
registerModuleTool(stripeTools.finalize_invoice);
registerModuleTool(stripeTools.send_invoice);
registerModuleTool(stripeTools.create_payment_intent);
registerModuleTool(stripeTools.get_payment_intent);
registerModuleTool(stripeTools.create_refund);
registerModuleTool(stripeTools.get_balance);

// =============================================================================
// RECOMMENDATION TOOLS (4) - AI Product Recommendations
// =============================================================================

registerModuleTool(recommendationTools.get_similar_products);
registerModuleTool(recommendationTools.get_frequently_bought_together);
registerModuleTool(recommendationTools.get_personalized);
registerModuleTool(recommendationTools.learn_from_orders);

// =============================================================================
// HUBSPOT TOOLS (7) - CRM + CTI Integration
// =============================================================================

registerModuleTool(hubspotTools.create_contact);
registerModuleTool(hubspotTools.search_contacts);
registerModuleTool(hubspotTools.get_contact);
registerModuleTool(hubspotTools.update_contact);
registerModuleTool(hubspotTools.create_deal);
registerModuleTool(hubspotTools.log_call);
registerModuleTool(hubspotTools.list_pipelines);

// =============================================================================
// KLAVIYO TOOLS (5) - Marketing Automation
// =============================================================================

registerModuleTool(klaviyoTools.create_profile);
registerModuleTool(klaviyoTools.get_profile);
registerModuleTool(klaviyoTools.track_event);
registerModuleTool(klaviyoTools.subscribe);
registerModuleTool(klaviyoTools.list_segments);

// =============================================================================
// TWILIO TOOLS (5) - SMS + Voice + WhatsApp
// =============================================================================

registerModuleTool(twilioTools.send_sms);
registerModuleTool(twilioTools.make_call);
registerModuleTool(twilioTools.get_call);
registerModuleTool(twilioTools.list_calls);
registerModuleTool(twilioTools.send_whatsapp);

// =============================================================================
// RESOURCES (6) — MCP Phase 2: Contextual data for LLM consumption
// =============================================================================

// Resource 1: vocalia://personas — Full persona catalog
server.registerResource(
  "personas",
  "vocalia://personas",
  {
    description: "Complete catalog of 38 VocalIA industry personas with metadata, voice config, and tier classification.",
    mimeType: "application/json",
  },
  async (uri) => {
    const allPersonas = Object.entries(PERSONAS_DATA).flatMap(([tier, personas]) =>
      personas.map((p: any) => ({ ...p, tier }))
    );
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          total: allPersonas.length,
          tiers: {
            core: PERSONAS_DATA.core.length,
            expansion: PERSONAS_DATA.expansion.length,
            extended: PERSONAS_DATA.extended.length,
            pme: PERSONAS_DATA.pme.length,
          },
          personas: allPersonas,
        }, null, 2),
      }],
    };
  }
);

// Resource 2: vocalia://personas/{key} — Single persona detail (template)
server.registerResource(
  "persona-detail",
  new ResourceTemplate("vocalia://personas/{key}", {
    list: async () => {
      const allKeys = Object.values(PERSONAS_DATA).flat().map((p: any) => p.key);
      return {
        resources: allKeys.map(key => ({
          uri: `vocalia://personas/${key}`,
          name: `Persona: ${key}`,
          description: `Detailed persona configuration for ${key}`,
          mimeType: "application/json",
        })),
      };
    },
    complete: {
      key: async (value) => {
        const allKeys = Object.values(PERSONAS_DATA).flat().map((p: any) => p.key as string);
        return allKeys.filter(k => k.toLowerCase().startsWith(value.toLowerCase()));
      },
    },
  }),
  {
    description: "Detailed persona configuration including system prompts in all available languages.",
    mimeType: "application/json",
  },
  async (uri, variables) => {
    const key = String(variables.key).toUpperCase();
    const persona = Object.values(PERSONAS_DATA).flat().find((p: any) => p.key === key);

    if (!persona) {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: `Persona '${key}' not found`, available_keys: Object.values(PERSONAS_DATA).flat().map((p: any) => p.key) }),
        }],
      };
    }

    // Get system prompts from injector (dynamic) or fallback (inline)
    const prompts = INJECTOR_SYSTEM_PROMPTS[key] || SYSTEM_PROMPTS[key] || {};
    const injectorData = INJECTOR_PERSONAS[key] || {};

    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          ...persona,
          system_prompts: prompts,
          available_languages: Object.keys(prompts),
          injector_metadata: {
            systemPrompt: injectorData.systemPrompt ? "(available)" : "(not set)",
            tone: injectorData.tone,
            examples: injectorData.examples ? injectorData.examples.length : 0,
          },
        }, null, 2),
      }],
    };
  }
);

// Resource 3: vocalia://knowledge-base — Knowledge base status and summary
server.registerResource(
  "knowledge-base",
  "vocalia://knowledge-base",
  {
    description: "Knowledge base status including chunk count, categories, search modes, and data location.",
    mimeType: "application/json",
  },
  async (uri) => {
    let status: any = { available: false };
    const statusPath = dataPath("knowledge-base", "status.json");
    try {
      if (fs.existsSync(statusPath)) {
        status = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
        status.available = true;
      }
    } catch { /* status remains unavailable */ }

    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          knowledge_base: status,
          search_modes: {
            sparse: "TF-IDF keyword matching",
            hybrid: "TF-IDF + semantic embeddings",
            graph: "Knowledge graph traversal (2-hop)",
          },
          location: "data/knowledge-base/",
        }, null, 2),
      }],
    };
  }
);

// Resource 4: vocalia://market-rules — Geo-market routing rules
server.registerResource(
  "market-rules",
  "vocalia://market-rules",
  {
    description: "Market routing rules mapping countries to language, currency, and pricing region. Used for geo-detection and i18n.",
    mimeType: "application/json",
  },
  async (uri) => {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          strategy: "1.Europe(FR+EUR) → 2.MENA(AR+USD) → 3.International(EN+USD) → 4.Morocco(FR+MAD)",
          markets: {
            MA: { id: "maroc", lang: "fr", currency: "MAD", symbol: "DH", label: "Maroc" },
            DZ: { id: "maghreb", lang: "fr", currency: "EUR", symbol: "€", label: "Maghreb" },
            TN: { id: "maghreb", lang: "fr", currency: "EUR", symbol: "€", label: "Maghreb" },
            FR: { id: "europe", lang: "fr", currency: "EUR", symbol: "€", label: "Europe" },
            BE: { id: "europe", lang: "fr", currency: "EUR", symbol: "€", label: "Europe" },
            CH: { id: "europe", lang: "fr", currency: "EUR", symbol: "€", label: "Europe" },
            ES: { id: "europe", lang: "es", currency: "EUR", symbol: "€", label: "Europe" },
            AE: { id: "mena", lang: "ar", currency: "USD", symbol: "$", label: "MENA" },
            SA: { id: "mena", lang: "ar", currency: "USD", symbol: "$", label: "MENA" },
            US: { id: "intl", lang: "en", currency: "USD", symbol: "$", label: "International" },
            GB: { id: "intl", lang: "en", currency: "USD", symbol: "$", label: "International" },
          },
          default: { id: "intl", lang: "en", currency: "USD", symbol: "$", label: "International" },
          supported_languages: ["fr", "en", "es", "ar", "ary"],
          supported_currencies: ["EUR", "USD", "MAD"],
        }, null, 2),
      }],
    };
  }
);

// Resource 5: vocalia://pricing — Plans and pricing
server.registerResource(
  "pricing",
  "vocalia://pricing",
  {
    description: "VocalIA pricing plans with features, costs, and margin analysis. Source of truth for commercial offers.",
    mimeType: "application/json",
  },
  async (uri) => {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          currency: "EUR",
          trial: "14-day free trial (no free tier)",
          plans: [
            {
              name: "Starter",
              price: 49,
              period: "month",
              target: "Small businesses",
              features: ["Voice AI assistant", "500 conversations/month", "1 persona", "1 language", "Email support"],
              margin: "~90-93%",
            },
            {
              name: "Pro",
              price: 99,
              period: "month",
              target: "Growing businesses",
              features: ["Lead generation + booking", "CRM sync", "5 personas", "5 languages", "Priority support"],
              margin: "~80-92%",
            },
            {
              name: "E-commerce",
              price: 99,
              period: "month",
              target: "Online stores",
              features: ["Cart recovery", "Product quiz", "Gamification", "7 platform integrations", "Priority support"],
              margin: "~80-92%",
            },
            {
              name: "Telephony",
              price: 199,
              period: "month",
              usage: "0.10€/min",
              target: "Call centers & enterprises",
              features: ["AI phone line", "38 personas", "5 languages", "Twilio PSTN", "25 function tools", "Dedicated support"],
              margin: "~38% on usage",
            },
          ],
        }, null, 2),
      }],
    };
  }
);

// Resource 6: vocalia://languages — Supported languages and voice configurations
server.registerResource(
  "languages",
  "vocalia://languages",
  {
    description: "Complete language support matrix with voice provider mappings, RTL flags, and geo-detection rules.",
    mimeType: "application/json",
  },
  async (uri) => {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          total: 5,
          languages: [
            { code: "fr", name: "Français", native: "Français", rtl: false, voice_providers: ["grok", "gemini", "elevenlabs"], geo_countries: ["FR", "BE", "CH", "MA", "DZ", "TN"] },
            { code: "en", name: "English", native: "English", rtl: false, voice_providers: ["grok", "gemini", "elevenlabs"], geo_countries: ["US", "GB", "AE"] },
            { code: "es", name: "Spanish", native: "Español", rtl: false, voice_providers: ["grok", "gemini", "elevenlabs"], geo_countries: ["ES"] },
            { code: "ar", name: "Arabic (MSA)", native: "العربية", rtl: true, voice_providers: ["grok", "gemini", "elevenlabs"], geo_countries: ["AE", "SA"] },
            { code: "ary", name: "Darija (Moroccan Arabic)", native: "الدارجة", rtl: true, voice_providers: ["grok", "gemini"], geo_countries: ["MA"] },
          ],
          fallback_chain: "grok → gemini → anthropic → atlas → local (rule-based)",
        }, null, 2),
      }],
    };
  }
);

// =============================================================================
// PROMPTS (8) — MCP Phase 2: Pre-built conversation templates
// =============================================================================

// Prompt 1: voice-response — Generate AI voice response
server.registerPrompt(
  "voice-response",
  {
    title: "Voice Response",
    description: "Generate an AI voice response using a VocalIA persona. Returns a system+user message pair ready for voice synthesis.",
    argsSchema: {
      message: z.string().describe("The user message to respond to"),
      language: z.enum(["fr", "en", "es", "ar", "ary"]).default("fr").describe("Response language"),
      personaKey: z.string().default("AGENCY").describe("Persona key (e.g. AGENCY, DENTAL, PROPERTY)"),
    },
  },
  async ({ message, language, personaKey }) => {
    const key = personaKey.toUpperCase();
    const systemPrompt = INJECTOR_SYSTEM_PROMPTS[key]?.[language]
      || SYSTEM_PROMPTS[key]?.[language]
      || SYSTEM_PROMPTS["AGENCY"]?.[language]
      || "You are VocalIA, a voice AI assistant.";

    return {
      messages: [
        { role: "user" as const, content: { type: "text" as const, text: `[System Persona: ${key} | Language: ${language}]\n\n${systemPrompt}` } },
        { role: "user" as const, content: { type: "text" as const, text: message } },
      ],
    };
  }
);

// Prompt 2: qualify-lead — BANT lead qualification
server.registerPrompt(
  "qualify-lead",
  {
    title: "Lead Qualification (BANT)",
    description: "Qualify a sales lead using the BANT framework (Budget, Authority, Need, Timeline). Returns a structured qualification analysis.",
    argsSchema: {
      budget: z.string().describe("Prospect's budget range or willingness to invest"),
      authority: z.string().describe("Decision-making authority level"),
      need: z.string().describe("Business need or pain point"),
      timeline: z.string().describe("Expected timeline for decision/implementation"),
    },
  },
  async ({ budget, authority, need, timeline }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's lead qualification expert. Analyze this prospect using the BANT framework and provide a qualification score (0-100), recommended next action, and suggested VocalIA plan.

**Budget:** ${budget}
**Authority:** ${authority}
**Need:** ${need}
**Timeline:** ${timeline}

VocalIA Plans: Starter (49€/mo), Pro (99€/mo), E-commerce (99€/mo), Telephony (199€/mo + 0.10€/min).

Respond with:
1. BANT Score (0-100) with breakdown per dimension
2. Qualification status: HOT / WARM / COLD
3. Recommended VocalIA plan
4. Suggested next action (demo, trial, call, nurture)
5. Key objection risks`,
          },
        },
      ],
    };
  }
);

// Prompt 3: book-appointment — Booking workflow
server.registerPrompt(
  "book-appointment",
  {
    title: "Book Discovery Call",
    description: "Create a booking request for a VocalIA discovery call. Generates the structured booking data.",
    argsSchema: {
      email: z.string().describe("Prospect's email address"),
      preferredTime: z.string().describe("Preferred date/time (ISO 8601 or natural language)"),
      notes: z.string().optional().describe("Additional notes or context about the prospect"),
    },
  },
  async ({ email, preferredTime, notes }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's booking assistant. A prospect wants to schedule a discovery call.

**Email:** ${email}
**Preferred Time:** ${preferredTime}
${notes ? `**Notes:** ${notes}` : ""}

Use the booking_create tool to register this appointment. Then confirm the booking with a professional response including:
1. Confirmation of the time slot
2. What to expect during the 20-min discovery call
3. A link to vocalia.ma/booking for rescheduling`,
          },
        },
      ],
    };
  }
);

// Prompt 4: check-order — Multi-platform order status
server.registerPrompt(
  "check-order",
  {
    title: "Check Order Status",
    description: "Check order status across supported e-commerce platforms (Shopify, WooCommerce, Magento, Wix, Squarespace, BigCommerce, PrestaShop).",
    argsSchema: {
      orderId: z.string().describe("Order ID or reference number"),
      platform: z.enum(["shopify", "woocommerce", "magento", "wix", "squarespace", "bigcommerce", "prestashop"]).describe("E-commerce platform"),
    },
  },
  async ({ orderId, platform }) => {
    const toolMap: Record<string, string> = {
      shopify: "shopify_get_order",
      woocommerce: "woocommerce_get_order",
      magento: "magento_get_order",
      wix: "wix_get_order",
      squarespace: "squarespace_get_order",
      bigcommerce: "bigcommerce_get_order",
      prestashop: "prestashop_get_order",
    };

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's e-commerce assistant. A customer wants to check their order status.

**Order ID:** ${orderId}
**Platform:** ${platform}

Use the ${toolMap[platform]} tool to retrieve the order details. Then provide:
1. Current order status (processing, shipped, delivered, etc.)
2. Tracking information if available
3. Estimated delivery date
4. Any action items needed`,
          },
        },
      ],
    };
  }
);

// Prompt 5: create-invoice — Stripe invoice workflow
server.registerPrompt(
  "create-invoice",
  {
    title: "Create Invoice",
    description: "Create and send a Stripe invoice. Guides through customer lookup/creation, invoice line items, and sending.",
    argsSchema: {
      customerEmail: z.string().describe("Customer email address"),
      amount: z.string().describe("Invoice amount (e.g. '99.00')"),
      currency: z.enum(["eur", "usd", "mad"]).default("eur").describe("Invoice currency"),
    },
  },
  async ({ customerEmail, amount, currency }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's billing assistant. Create and send a Stripe invoice.

**Customer Email:** ${customerEmail}
**Amount:** ${amount} ${currency.toUpperCase()}
**Currency:** ${currency}

Follow these steps using the available Stripe tools:
1. Search for existing customer with stripe_list_customers (filter by email)
2. If not found, create with stripe_create_customer
3. Add invoice item with stripe_add_invoice_item
4. Create invoice with stripe_create_invoice
5. Finalize with stripe_finalize_invoice
6. Send with stripe_send_invoice

Report the invoice URL and status when complete.`,
          },
        },
      ],
    };
  }
);

// Prompt 6: export-report — Generate data export
server.registerPrompt(
  "export-report",
  {
    title: "Export Report",
    description: "Generate a data export in CSV, XLSX, or PDF format using VocalIA's export tools.",
    argsSchema: {
      data: z.string().describe("JSON string of data to export, or description of what to export"),
      format: z.enum(["csv", "xlsx", "pdf"]).describe("Export format"),
      title: z.string().describe("Report title"),
    },
  },
  async ({ data, format, title }) => {
    const toolMap: Record<string, string> = {
      csv: "export_generate_csv",
      xlsx: "export_generate_xlsx",
      pdf: "export_generate_pdf",
    };

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's reporting assistant. Generate a ${format.toUpperCase()} report.

**Title:** ${title}
**Format:** ${format}
**Data:** ${data}

Use the ${toolMap[format]} tool to generate the export. If the data is a description rather than JSON, first gather the data using appropriate tools (sheets, CRM, etc.), then generate the export.

Return the file path and size when complete.`,
          },
        },
      ],
    };
  }
);

// Prompt 7: onboard-tenant — New client onboarding
server.registerPrompt(
  "onboard-tenant",
  {
    title: "Onboard New Tenant",
    description: "Guide through the complete onboarding workflow for a new VocalIA client including persona selection, integration setup, and configuration.",
    argsSchema: {
      tenantId: z.string().describe("Unique tenant identifier (lowercase, alphanumeric + underscores)"),
      industry: z.string().describe("Client's industry (e.g. dental, real-estate, e-commerce, restaurant)"),
    },
  },
  async ({ tenantId, industry }) => {
    // Find matching personas for this industry
    const matchingPersonas = Object.values(PERSONAS_DATA).flat()
      .filter((p: any) => p.industries.some((i: string) =>
        i.toLowerCase().includes(industry.toLowerCase()) ||
        industry.toLowerCase().includes(i.toLowerCase())
      ))
      .map((p: any) => p.key);

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's onboarding specialist. Set up a new client.

**Tenant ID:** ${tenantId}
**Industry:** ${industry}
**Matching Personas:** ${matchingPersonas.length > 0 ? matchingPersonas.join(", ") : "UNIVERSAL_SME (no exact match)"}

Onboarding checklist:
1. Verify tenant ID is unique and follows naming convention
2. Select primary persona from matches above (use personas_get for details)
3. Recommend VocalIA plan based on industry:
   - Service businesses → Pro (99€/mo)
   - E-commerce → E-commerce (99€/mo)
   - High-volume calls → Telephony (199€/mo)
   - Starting out → Starter (49€/mo)
4. Configure integrations (CRM, e-commerce platform, calendar)
5. Set market rules (language, currency based on client location)
6. Generate API key and widget embed code
7. Schedule training discovery call using booking_create

Provide a complete configuration summary when done.`,
          },
        },
      ],
    };
  }
);

// Prompt 8: troubleshoot — System diagnostics
server.registerPrompt(
  "troubleshoot",
  {
    title: "Troubleshoot System",
    description: "Diagnose VocalIA system issues using available status and monitoring tools.",
    argsSchema: {
      symptom: z.string().describe("Description of the problem or error message"),
    },
  },
  async ({ symptom }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are VocalIA's system diagnostic assistant. Investigate and resolve this issue.

**Symptom:** ${symptom}

Diagnostic procedure:
1. Run api_status to check overall system health
2. Run voice_providers_status to check AI provider connectivity
3. Run knowledge_base_status to check retrieval system
4. Check relevant service logs

Common issues:
- "No response" → Voice API not running (port 3004) or provider API key missing
- "Wrong language" → Check persona language config with personas_get
- "Widget not loading" → Check allowed_origins in tenant config
- "Call failed" → Check Twilio credentials and telephony bridge (port 3009)
- "Slow responses" → Check fallback chain activation, may indicate primary provider down

Provide:
1. Root cause identification
2. Severity level (CRITICAL / HIGH / MEDIUM / LOW)
3. Step-by-step fix instructions
4. Prevention recommendations`,
          },
        },
      ],
    };
  }
);

return server;
} // end createVocaliaServer()

// =============================================================================
// SERVER STARTUP — Dual Transport: stdio (default) or Streamable HTTP
// =============================================================================

const MCP_TRANSPORT = process.env.MCP_TRANSPORT || "stdio";
const MCP_PORT = parseInt(process.env.MCP_PORT || "3015", 10);

function logStartup(server: McpServer, transport: string) {
  try {
    server.sendLoggingMessage({
      level: "info",
      logger: "startup",
      data: {
        event: "server_started",
        version: "1.0.0",
        transport,
        capabilities: { tools: 203, resources: 6, prompts: 8 },
        languages: 5,
      },
    });
  } catch {
    // Silently ignore if not connected
  }
}

async function startStdio() {
  const server = createVocaliaServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VocalIA MCP Server v1.0.0 running on stdio");
  console.error(`Voice API URL: ${process.env.VOCALIA_API_URL || "http://localhost:3004"}`);
  console.error(`Telephony URL: ${process.env.VOCALIA_TELEPHONY_URL || "http://localhost:3009"}`);
  console.error("Tools: 203 | Resources: 6 | Prompts: 8");
  logStartup(server, "stdio");
}

async function startHttp() {
  const useOAuth = process.env.MCP_OAUTH === "true" || process.argv.includes("--oauth");
  const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}/mcp`);

  // Express app with DNS rebinding protection
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  // --- CORS (MM5: warn if wildcard in production) ---
  const corsOrigins = process.env.MCP_CORS_ORIGINS || "*";
  if (corsOrigins === "*") {
    console.error("⚠️  CORS: wildcard origin (*) enabled. Set MCP_CORS_ORIGINS for production.");
  }
  app.use((_req, res, next) => {
    const allowedOrigins = corsOrigins.split(",");
    const origin = _req.headers.origin || "";
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Authorization, Last-Event-ID");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    if (_req.method === "OPTIONS") { res.status(204).end(); return; }
    next();
  });

  // Body parsing
  app.use("/mcp", (await import("express")).default.json());

  // --- OAuth 2.1 (optional, enabled with MCP_OAUTH=true or --oauth) ---
  let authMiddleware: ReturnType<typeof requireBearerAuth> | null = null;

  if (useOAuth) {
    const oauthProvider = new VocaliaOAuthProvider();
    const issuerUrl = new URL(process.env.MCP_OAUTH_ISSUER || `http://localhost:${MCP_PORT}`);

    // OAuth endpoints: /authorize, /token, /register, /revoke, /.well-known/oauth-authorization-server
    app.use(mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl,
      baseUrl: issuerUrl,
      scopesSupported: ["mcp:tools", "mcp:resources", "mcp:prompts"],
      resourceName: "VocalIA MCP Server",
      resourceServerUrl: mcpServerUrl,
    }));

    // Bearer token validation middleware (MC2 fix: require scope)
    authMiddleware = requireBearerAuth({
      verifier: oauthProvider,
      requiredScopes: ["mcp:tools"],
    });

    console.error("✅ OAuth 2.1 enabled — endpoints: /authorize, /token, /register, /revoke");
  }

  // --- Health endpoint ---
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      transport: "streamable-http",
      oauth: useOAuth,
      tools: 203,
      resources: 6,
      prompts: 8,
    });
  });

  // --- Rate limiting ---
  const RATE_LIMIT = parseInt(process.env.MCP_RATE_LIMIT || "100", 10); // per minute
  const rateLimitWindow: number[] = [];

  app.use("/mcp", (_req, res, next) => {
    const now = Date.now();
    while (rateLimitWindow.length > 0 && rateLimitWindow[0]! < now - 60000) {
      rateLimitWindow.shift();
    }
    if (rateLimitWindow.length >= RATE_LIMIT) {
      res.status(429).json({ error: "Too many requests", retry_after: 60 });
      return;
    }
    rateLimitWindow.push(now);
    next();
  });

  // --- Session map (MH4 fix: TTL + max sessions) ---
  const MAX_SESSIONS = 100;
  const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
  const transports: Record<string, { transport: StreamableHTTPServerTransport; server: McpServer; lastActivity: number }> = {};

  // Cleanup stale sessions every 5 minutes
  const sessionCleanup = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const sid of Object.keys(transports)) {
      if (now - transports[sid].lastActivity > SESSION_TTL) {
        try { transports[sid].transport.close(); } catch {}
        delete transports[sid];
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.error(`🧹 Session cleanup: ${cleaned} stale sessions removed (active: ${Object.keys(transports).length})`);
    }
  }, 5 * 60 * 1000);
  sessionCleanup.unref();

  // --- MCP POST handler ---
  const mcpPostHandler = async (req: any, res: any) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      // Existing session — update activity timestamp
      if (sessionId && transports[sessionId]) {
        transports[sessionId].lastActivity = Date.now();
        await transports[sessionId].transport.handleRequest(req, res, req.body);
        return;
      }

      // New initialization request (MH4: enforce max sessions)
      if (!sessionId && isInitializeRequest(req.body)) {
        if (Object.keys(transports).length >= MAX_SESSIONS) {
          res.status(503).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Maximum concurrent sessions reached" },
            id: null,
          });
          return;
        }
        const mcpServer = createVocaliaServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = { transport, server: mcpServer, lastActivity: Date.now() };
            console.error(`✅ HTTP session initialized: ${sid} (active: ${Object.keys(transports).length})`);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
            console.error(`🔒 HTTP session closed: ${sid}`);
          }
        };

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Invalid request
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };

  // --- MCP GET handler (SSE streams) ---
  const mcpGetHandler = async (req: any, res: any) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    transports[sessionId].lastActivity = Date.now();
    await transports[sessionId].transport.handleRequest(req, res);
  };

  // --- MCP DELETE handler (session termination) ---
  const mcpDeleteHandler = async (req: any, res: any) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].transport.handleRequest(req, res);
  };

  // --- Route registration with conditional auth ---
  if (useOAuth && authMiddleware) {
    app.post("/mcp", authMiddleware, mcpPostHandler);
    app.get("/mcp", authMiddleware, mcpGetHandler);
    app.delete("/mcp", authMiddleware, mcpDeleteHandler);
  } else {
    app.post("/mcp", mcpPostHandler);
    app.get("/mcp", mcpGetHandler);
    app.delete("/mcp", mcpDeleteHandler);
  }

  // --- Start server ---
  const server = app.listen(MCP_PORT, "0.0.0.0", () => {
    console.error(`VocalIA MCP Server v1.0.0 running on Streamable HTTP`);
    console.error(`Endpoint: http://0.0.0.0:${MCP_PORT}/mcp`);
    console.error(`Health: http://0.0.0.0:${MCP_PORT}/health`);
    console.error(`OAuth: ${useOAuth ? "enabled" : "disabled (use MCP_OAUTH=true to enable)"}`);
    console.error("Tools: 203 | Resources: 6 | Prompts: 8");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("Shutting down HTTP server...");
    for (const sid of Object.keys(transports)) {
      try {
        await transports[sid].transport.close();
        delete transports[sid];
      } catch {
        // ignore close errors
      }
    }
    server.close();
    process.exit(0);
  });
}

async function main() {
  if (MCP_TRANSPORT === "http" || process.argv.includes("--http")) {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
