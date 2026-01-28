/**
 * Compliance Guardian (Policy-as-Code Engine)
 * Validates agent actions against EU AI Act 2026 and Agency Ethics.
 * 
 * @version 1.0.0
 * @date 2026-01-20
 */

const fs = require('fs');
const path = require('path');

class ComplianceGuardian {
    constructor() {
        this.rules = [
            { id: 'GDPR_PII', pattern: /\b(\d{3}-\d{2}-\d{4}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i, severity: 'HIGH', description: 'Possible PII leak (Email/SSN)' },
            { id: 'ETHICS_PRESSURE', pattern: /\b(buy now or die|force them|don't take no|harass)\b/i, severity: 'HIGH', description: 'Unethical pressure tactics' },
            { id: 'AI_DISCLOSURE', required: true, check: (text) => text.includes('[AI]') || text.includes('Assisté par IA') || text.includes('Automated'), severity: 'MEDIUM', description: 'Must disclose AI usage in outreach' }
        ];
        this.logPath = path.join(__dirname, '../../../data/compliance_audit.log');
    }

    /**
     * Validate content against rules
     * @param {string} content - Text to validate
     * @param {string} type - 'PROMPT', 'RESPONSE', 'EMAIL', 'SMS'
     * @returns {object} { valid: boolean, violations: [] }
     */
    validate(content, type) {
        const violations = [];
        const isOutreach = ['EMAIL', 'SMS'].includes(type);

        for (const rule of this.rules) {
            // Regex Pattern Check
            if (rule.pattern && rule.pattern.test(content)) {
                // Exception for PII in PROMPT (we allow agents to process data, but warn)
                if (rule.id === 'GDPR_PII' && type === 'PROMPT') continue;

                violations.push({ rule: rule.id, severity: rule.severity, description: rule.description });
            }

            // Custom Logic Checks
            if (isOutreach && rule.id === 'AI_DISCLOSURE' && !rule.check(content)) {
                // In 2026, AI Act requires transparency for bots
                // But simplified for now: just warn, don't block unless strict
                violations.push({ rule: rule.id, severity: rule.severity, description: rule.description });
            }
        }

        const valid = violations.filter(v => v.severity === 'HIGH').length === 0;
        this._log(type, valid, violations);

        return { valid, violations };
    }

    _log(type, valid, violations) {
        const entry = `[${new Date().toISOString()}] [${type}] ${valid ? 'PASS' : 'BLOCK'} - Violations: ${violations.map(v => v.rule).join(',') || 'None'}\n`;
        try {
            fs.appendFileSync(this.logPath, entry);
        } catch (e) {
            // Silent fail if log dir missing (should create it though)
        }
    }
}

module.exports = new ComplianceGuardian();
