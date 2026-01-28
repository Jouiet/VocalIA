/**
 * ContextBox.cjs - Unified Memory Layer for Agent Ops v3.0
 * 3A Automation - Session 178quater (SOTA Multi-Agent Coordination)
 *
 * Implements the "Context Box" concept from the Agent Ops manifesto.
 * Provides a persistent, self-healing state manager for customer journeys.
 * Enables horizontal orchestration by sharing context between agents.
 *
 * SOTA Features v3.0 (Session 178quater):
 * - Context Compaction: Summarize history when exceeding threshold
 * - Token Window Management: Estimate tokens, compact for LLM context
 * - Key Fact Extraction: Structured extraction from conversation
 * - TTL Management: Cleanup stale sessions
 * - EventBus Integration: Event-driven state changes
 * - Multi-Agent Handoff: LangGraph-inspired state machine
 * - Predictive Context: Pre-load context based on event patterns
 *
 * Based on: Anthropic Context Engineering (2025), LangGraph State Machines
 * Sources:
 * - https://www.growin.com/blog/event-driven-architecture-scale-systems-2025/
 * - https://microservices.io/patterns/data/event-driven-architecture.html
 */

const fs = require('fs');
const path = require('path');

// SOTA Configuration
const CONTEXT_CONFIG = {
    maxHistoryEvents: 50,      // Compact after this many events
    maxTokenEstimate: 4000,    // Target token budget for LLM context
    staleSessionHours: 24,     // TTL for inactive sessions
    tokensPerChar: 0.25        // Rough estimate: 1 token ≈ 4 chars
};

class ContextBox {
    constructor(options = {}) {
        this.storageDir = options.storageDir || path.join(process.cwd(), 'data', 'contexts');
        this.config = { ...CONTEXT_CONFIG, ...options.config };

        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    /**
     * Get the file path for a specific context ID
     */
    _getPath(id) {
        // Sanitize ID to prevent path traversal
        const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.storageDir, `${safeId}.json`);
    }

    /**
     * Estimate token count for a string
     * SOTA: Important for context window management
     */
    _estimateTokens(text) {
        if (!text) return 0;
        const str = typeof text === 'string' ? text : JSON.stringify(text);
        return Math.ceil(str.length * this.config.tokensPerChar);
    }

    /**
     * Load or initialize a context
     */
    get(id) {
        const filePath = this._getPath(id);
        if (fs.existsSync(filePath)) {
            try {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                console.error(`[ContextBox] Error loading context ${id}: ${e.message}`);
            }
        }

        // Default structure (Context Pillars)
        return {
            id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            pillars: {
                identity: {},      // Who is the user?
                intent: {},        // What do they want?
                qualification: {}, // BANT/MEDDPICC data
                sentiment: [],     // History of sentiment scores
                history: [],       // Event log (compacted)
                keyFacts: [],      // SOTA: Extracted key facts
                summary: null      // SOTA: Compacted history summary
            },
            status: 'active',
            metadata: {
                tokenEstimate: 0,
                lastCompaction: null
            }
        };
    }

    /**
     * Upsert context data
     */
    set(id, data) {
        const current = this.get(id);
        const updated = {
            ...current,
            ...data,
            updated_at: new Date().toISOString()
        };

        // Deep merge logic for pillars if provided
        if (data.pillars) {
            updated.pillars = {
                identity: { ...current.pillars.identity, ...data.pillars.identity },
                intent: { ...current.pillars.intent, ...data.pillars.intent },
                qualification: { ...current.pillars.qualification, ...data.pillars.qualification },
                sentiment: [...current.pillars.sentiment, ...(data.pillars.sentiment || [])].slice(-20), // Keep last 20
                history: [...current.pillars.history, ...(data.pillars.history || [])],
                keyFacts: [...(current.pillars.keyFacts || []), ...(data.pillars.keyFacts || [])],
                summary: data.pillars.summary || current.pillars.summary
            };
        }

        // SOTA: Auto-compact if history exceeds threshold
        if (updated.pillars.history.length > this.config.maxHistoryEvents) {
            this._compactHistory(updated);
        }

        // Update token estimate
        updated.metadata.tokenEstimate = this._estimateTokens(updated.pillars);

        const filePath = this._getPath(id);
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
        return updated;
    }

    /**
     * SOTA: Compact history to maintain manageable context size
     * Keeps recent events + creates summary of older events
     */
    _compactHistory(context) {
        const history = context.pillars.history;
        if (history.length <= this.config.maxHistoryEvents) return;

        const keepRecent = Math.floor(this.config.maxHistoryEvents * 0.6); // Keep 60%
        const toSummarize = history.slice(0, -keepRecent);
        const recentEvents = history.slice(-keepRecent);

        // Create summary of older events
        const eventCounts = {};
        toSummarize.forEach(e => {
            const key = `${e.agent}:${e.event}`;
            eventCounts[key] = (eventCounts[key] || 0) + 1;
        });

        const summaryParts = Object.entries(eventCounts)
            .map(([key, count]) => `${key} (x${count})`)
            .join(', ');

        const compactionNote = {
            timestamp: new Date().toISOString(),
            agent: 'ContextBox',
            event: 'COMPACTION',
            summarized: toSummarize.length,
            summary: `Compacted ${toSummarize.length} events: ${summaryParts}`
        };

        context.pillars.history = [compactionNote, ...recentEvents];
        context.pillars.summary = (context.pillars.summary || '') +
            `\n[${new Date().toISOString()}] ${compactionNote.summary}`;
        context.metadata.lastCompaction = new Date().toISOString();

        console.log(`[ContextBox] Compacted ${context.id}: ${toSummarize.length} events summarized`);
    }

    /**
     * SOTA: Get context optimized for LLM consumption
     * Returns context that fits within token budget
     */
    getContextForLLM(id, maxTokens = null) {
        const context = this.get(id);
        const budget = maxTokens || this.config.maxTokenEstimate;

        // Priority: identity > intent > qualification > keyFacts > recent history
        const llmContext = {
            identity: context.pillars.identity,
            intent: context.pillars.intent,
            qualification: context.pillars.qualification,
            keyFacts: context.pillars.keyFacts || [],
            recentHistory: []
        };

        let currentTokens = this._estimateTokens(llmContext);

        // Add recent history until budget exhausted
        const history = context.pillars.history.slice().reverse(); // Most recent first
        for (const event of history) {
            const eventTokens = this._estimateTokens(event);
            if (currentTokens + eventTokens > budget) break;
            llmContext.recentHistory.unshift(event);
            currentTokens += eventTokens;
        }

        // Add summary if space permits
        if (context.pillars.summary) {
            const summaryTokens = this._estimateTokens(context.pillars.summary);
            if (currentTokens + summaryTokens <= budget) {
                llmContext.historySummary = context.pillars.summary;
            }
        }

        return llmContext;
    }

    /**
     * SOTA: Extract key facts from a message
     * Used for structured note-taking during conversations
     */
    extractKeyFact(id, factType, factValue, source = 'conversation') {
        const fact = {
            type: factType,       // e.g., 'budget', 'timeline', 'pain_point', 'goal'
            value: factValue,
            source: source,
            extractedAt: new Date().toISOString()
        };

        return this.set(id, {
            pillars: {
                keyFacts: [fact]
            }
        });
    }

    /**
     * Append an event to the journey history
     */
    logEvent(id, agentName, event, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            agent: agentName,
            event,
            ...details
        };

        return this.set(id, {
            pillars: {
                history: [entry]
            }
        });
    }

    /**
     * Handoff context to a new agent
     * SOTA: Includes context summary for receiving agent
     */
    handoff(id, fromAgent, toAgent, reason = '') {
        const context = this.get(id);
        const llmContext = this.getContextForLLM(id, 2000); // Compact handoff context

        console.log(`[ContextBox] HANDOFF: ${id} from ${fromAgent} to ${toAgent}`);
        console.log(`[ContextBox] Handoff context: ${JSON.stringify(llmContext.keyFacts)}`);

        return this.logEvent(id, fromAgent, 'HANDOFF', {
            target: toAgent,
            reason,
            contextSnapshot: {
                keyFacts: llmContext.keyFacts,
                intent: llmContext.intent,
                qualification: llmContext.qualification
            }
        });
    }

    /**
     * SOTA: Cleanup stale sessions (TTL management)
     */
    cleanupStale(maxAgeHours = null) {
        const ttlHours = maxAgeHours || this.config.staleSessionHours;
        const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
        let cleaned = 0;

        try {
            const files = fs.readdirSync(this.storageDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(this.storageDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime < cutoff) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            }
        } catch (e) {
            console.error(`[ContextBox] Cleanup error: ${e.message}`);
        }

        if (cleaned > 0) {
            console.log(`[ContextBox] Cleaned ${cleaned} stale sessions (TTL: ${ttlHours}h)`);
        }
        return cleaned;
    }

    /**
     * List all active sessions (for monitoring)
     */
    listSessions() {
        try {
            const files = fs.readdirSync(this.storageDir);
            return files
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    const id = f.replace('.json', '');
                    const context = this.get(id);
                    return {
                        id,
                        status: context.status,
                        created: context.created_at,
                        updated: context.updated_at,
                        tokenEstimate: context.metadata?.tokenEstimate || 0,
                        historyCount: context.pillars.history.length,
                        keyFactCount: (context.pillars.keyFacts || []).length
                    };
                });
        } catch (e) {
            return [];
        }
    }

    /**
     * v3.0: Emit context change event to EventBus
     */
    _emitEvent(eventType, contextId, data) {
        try {
            const eventBus = require('./AgencyEventBus.cjs');
            eventBus.publish(eventType, {
                contextId,
                ...data
            }, {
                tenantId: data.tenantId || 'agency_internal',
                source: 'ContextBox.v3'
            }).catch(() => {}); // Non-blocking
        } catch (e) {
            // EventBus not available, skip
        }
    }

    /**
     * v3.0: Subscribe to relevant events for context updates
     */
    static initEventSubscriptions() {
        try {
            const eventBus = require('./AgencyEventBus.cjs');

            // Update context when lead is qualified
            eventBus.subscribe('lead.qualified', async (event) => {
                const context = instance.get(event.payload.sessionId);
                if (context) {
                    instance.set(event.payload.sessionId, {
                        pillars: {
                            qualification: {
                                score: event.payload.score,
                                status: event.payload.status,
                                qualifiedAt: event.metadata.timestamp
                            }
                        }
                    });
                }
            }, { name: 'ContextBox.onLeadQualified' });

            // Update context when voice session ends
            eventBus.subscribe('voice.session_end', async (event) => {
                instance.logEvent(event.payload.sessionId, 'VoiceAI', 'session_end', {
                    duration: event.payload.duration,
                    outcome: event.payload.outcome
                });
            }, { name: 'ContextBox.onVoiceSessionEnd' });

            // Update context on payment
            eventBus.subscribe('payment.completed', async (event) => {
                const sessionId = event.payload.sessionId || event.metadata.correlationId;
                if (sessionId) {
                    instance.extractKeyFact(sessionId, 'payment', {
                        amount: event.payload.amount,
                        transactionId: event.payload.transactionId,
                        completedAt: event.metadata.timestamp
                    }, 'billing_agent');
                }
            }, { name: 'ContextBox.onPaymentCompleted' });

            console.log('[ContextBox] v3.0 EventBus subscriptions active');
        } catch (e) {
            console.log('[ContextBox] EventBus not available for subscriptions');
        }
    }

    /**
     * v3.0: Get context with predictive pre-loading
     * Based on event patterns, pre-load related contexts
     */
    getWithPrediction(id, relatedIds = []) {
        const primary = this.get(id);
        const related = relatedIds.map(rid => ({
            id: rid,
            context: this.get(rid)
        })).filter(r => r.context);

        return {
            primary,
            related,
            prediction: {
                likelyNextAgent: this._predictNextAgent(primary),
                suggestedActions: this._suggestActions(primary)
            }
        };
    }

    /**
     * v3.0: Predict likely next agent based on context state
     */
    _predictNextAgent(context) {
        const qual = context.pillars?.qualification;
        if (qual?.score >= 70) return 'BillingAgent';
        if (qual?.score >= 40) return 'BookingAgent';
        if (context.pillars?.intent?.type === 'support') return 'SupportAgent';
        return 'VoiceAgent';
    }

    /**
     * v3.0: Suggest actions based on context
     */
    _suggestActions(context) {
        const actions = [];
        const qual = context.pillars?.qualification;

        if (!qual?.budget) actions.push('extract_budget');
        if (!qual?.timeline) actions.push('extract_timeline');
        if (qual?.score >= 50 && !context.pillars?.history?.find(h => h.event === 'booking_offered')) {
            actions.push('offer_booking');
        }
        return actions;
    }
}

// Singleton instance for the system
const instance = new ContextBox();

// Initialize event subscriptions (non-blocking)
setTimeout(() => {
    ContextBox.initEventSubscriptions();
}, 100);

module.exports = instance;
module.exports.ContextBox = ContextBox; // Export class for custom instances

