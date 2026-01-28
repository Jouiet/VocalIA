const { GoogleGenerativeAI } = require("@google/generative-ai");
const complianceGuardian = require('../compliance-guardian.cjs');

class LLMGateway {
    constructor() {
        // Load env systematically
        const fs = require('fs');
        const path = require('path');
        const envPaths = [
            path.join(__dirname, '.env'),
            path.join(__dirname, '../../../../.env'),
            path.join(__dirname, '../../../../../.env'),
            path.join(process.cwd(), '.env')
        ];
        for (const envPath of envPaths) {
            if (fs.existsSync(envPath)) {
                require('dotenv').config({ path: envPath });
                break;
            }
        }

        this.geminiKey = process.env.GEMINI_API_KEY;
        this.anthropicKey = process.env.ANTHROPIC_API_KEY;
        this.xaiKey = process.env.XAI_API_KEY; // Grok
        this.openaiKey = process.env.OPENAI_API_KEY; // gpt-5.2

        if (this.geminiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiKey);
            // gemini-3-flash-preview is the verified 2026 frontier (Jan 2026)
            this.geminiModel = this.genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        }
    }

    async generate(provider, prompt) {
        console.error(`[LLM] Requesting: ${provider.toUpperCase()}...`);

        // 🛡️ Compliance Check: PROMPT
        const promptAudit = complianceGuardian.validate(prompt, 'PROMPT');
        if (!promptAudit.valid) {
            throw new Error(`[Compliance] Prompt Blocked: ${JSON.stringify(promptAudit.violations)}`);
        }

        let response;
        try {
            switch (provider.toLowerCase()) {
                case 'gemini':
                    response = await this._generateGemini(prompt);
                    break;
                case 'claude':
                    response = await this._fetchClaude(prompt);
                    break;
                case 'grok':
                    response = await this._fetchGrok(prompt);
                    break;
                case 'openai':
                    response = await this._fetchOpenAI(prompt);
                    break;
                default:
                    throw new Error(`Unknown Provider: ${provider}`);
            }
        } catch (e) {
            console.error(`[LLM] ${provider.toUpperCase()} ERROR: ${e.message}`);
            throw e;
        }

        // 🛡️ Compliance Check: RESPONSE
        const responseAudit = complianceGuardian.validate(response, 'RESPONSE');
        if (!responseAudit.valid) {
            console.warn(`[Compliance] Response Warning: ${JSON.stringify(responseAudit.violations)}`);
            // We warn but allow for now, to avoid breaking flows unexpectedly. 
            // In L5 Strict Mode, this would throw.
        }

        return response;
    }

    /**
     * FRONTIER FALDOWN PROTOCOL (Resilient Chain) - Updated 26/01/2026
     * Models: Claude Opus 4.5 -> GPT-5.2 -> Grok 4.1 -> Gemini 3 Flash
     * IDs: claude-opus-4-5-20251101, gpt-5.2, grok-4-1-fast-reasoning, gemini-3-flash-preview
     * Fallbacks: Claude Opus 4.5 -> Claude 3.5 Sonnet (within Claude chain)
     */
    async generateWithFallback(prompt) {
        const chain = ['claude', 'openai', 'grok', 'gemini'];
        let lastError = null;

        for (const provider of chain) {
            try {
                return await this.generate(provider, prompt);
            } catch (e) {
                console.error(`[LLM] FALDOWN: ${provider.toUpperCase()} failed. Trying next in chain...`);
                lastError = e;
            }
        }

        throw new Error(`[LLM] CRITICAL: All Frontier models in Faldown chain failed. Last Error: ${lastError?.message}`);
    }

    async _generateGemini(prompt) {
        if (!this.genAI) throw new Error("GEMINI_API_KEY missing");
        let attempt = 0;
        while (attempt < 3) {
            try {
                const gemResult = await this.geminiModel.generateContent(prompt);
                const gemResponse = await gemResult.response;
                return gemResponse.text();
            } catch (e) {
                if (e.message.includes('503') || e.message.includes('overloaded')) {
                    attempt++;
                    console.error(`[LLM] Gemini Overloaded (Attempt ${attempt}/3). Retrying...`);
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                    continue;
                }
                throw e;
            }
        }
        throw new Error("Gemini consistently overloaded.");
    }

    async _fetchClaude(prompt) {
        if (!this.anthropicKey) throw new Error("ANTHROPIC_API_KEY missing");

        const tryModel = async (model) => {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': this.anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 8192,
                    messages: [{ role: "user", content: prompt }]
                })
            });
            return res;
        };

        // Frontier Claude Models (Jan 2026):
        // 1. claude-opus-4-5-20251101 - Most capable (expensive)
        // 2. claude-opus-4-5-20251101 - Fast & capable (balanced)
        // 3. claude-3-5-sonnet-20241022 - Fallback
        let res = await tryModel("claude-opus-4-5-20251101");

        if (res.status === 400 || res.status === 404) {
            console.warn("[LLM] Claude Opus 4.5 not available. Trying Claude Opus 4.5...");
            res = await tryModel("claude-opus-4-5-20251101");
        }

        if (res.status === 400 || res.status === 404) {
            console.warn("[LLM] Claude Opus 4.5 not available. Falling back to Claude 3.5 Sonnet...");
            res = await tryModel("claude-3-5-sonnet-20241022");
        }

        return this._handleFetchResponse(res, 'Claude');
    }

    async _fetchGrok(prompt) {
        if (!this.xaiKey) throw new Error("XAI_API_KEY missing");
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.xaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "grok-4-1-fast-reasoning",
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await this._handleFetchResponse(res, 'Grok');
        return data.choices[0].message.content;
    }

    async _fetchOpenAI(prompt) {
        if (!this.openaiKey) throw new Error("OPENAI_API_KEY missing");

        // Use Responses API if enabled (40-80% cost reduction via caching)
        // Toggle: OPENAI_USE_RESPONSES_API=true in .env
        const useResponsesAPI = process.env.OPENAI_USE_RESPONSES_API === 'true';

        if (useResponsesAPI) {
            return await this._fetchOpenAIResponses(prompt);
        }

        // Default: Chat Completions API (stable)
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-5.2",
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await this._handleFetchResponse(res, 'OpenAI');
        return data.choices[0].message.content;
    }

    /**
     * OpenAI Responses API (Jan 2026)
     * Benefits:
     *   - 40-80% cost reduction via improved cache utilization
     *   - 3% SWE-bench improvement
     *   - 98.7% Tau2-bench tool accuracy
     *   - Built-in tools (web search, MCP support)
     *
     * Migration guide: https://platform.openai.com/docs/guides/migrate-to-responses
     */
    async _fetchOpenAIResponses(prompt) {
        const res = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-5.2",
                input: prompt,
                // Responses API uses 'input' instead of 'messages' for simple text
                // For multi-turn, use 'input' array with { role, content } items
            })
        });

        if (!res.ok) {
            const err = await res.text();
            // Fallback to Chat Completions if Responses API fails
            console.warn(`[LLM] OpenAI Responses API failed (${res.status}): ${err}. Falling back to Chat Completions...`);
            return await this._fetchOpenAIChatCompletions(prompt);
        }

        const data = await res.json();
        // Responses API returns output array instead of choices
        if (data.output && data.output[0]) {
            // Handle different output item types
            const outputItem = data.output[0];
            if (outputItem.type === 'message' && outputItem.content) {
                return outputItem.content[0]?.text || outputItem.content;
            }
            return outputItem.content || outputItem.text || JSON.stringify(outputItem);
        }

        throw new Error('OpenAI Responses API: Unexpected response format');
    }

    // Keep original Chat Completions as fallback
    async _fetchOpenAIChatCompletions(prompt) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-5.2",
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await this._handleFetchResponse(res, 'OpenAI');
        return data.choices[0].message.content;
    }

    async _handleFetchResponse(res, name) {
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`${name} API Error (${res.status}): ${err}`);
        }
        const data = await res.json();
        if (name === 'Claude') return data.content[0].text;
        return data;
    }
}

module.exports = new LLMGateway();


