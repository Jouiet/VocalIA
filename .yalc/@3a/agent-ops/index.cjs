/**
 * @3a/agent-ops - Agent Operations v3.0
 *
 * Étagère Technologique - 3A Automation
 *
 * Modules:
 * - AgencyEventBus: Event-driven architecture backbone
 * - ContextBox: Token management, session state, predictive context
 * - BillingAgent: Cost tracking, revenue analytics
 * - ErrorScience: Error handling, confidence scoring
 * - RevenueScience: Pricing optimization, demand curves
 *
 * Usage:
 *   const { EventBus, ContextBox, BillingAgent } = require('@3a/agent-ops');
 *
 *   // Or individual imports
 *   const EventBus = require('@3a/agent-ops/EventBus');
 */

const AgencyEventBus = require('./AgencyEventBus.cjs');
const ContextBox = require('./ContextBox.cjs');
const BillingAgent = require('./BillingAgent.cjs');
const ErrorScience = require('./ErrorScience.cjs');
const RevenueScience = require('./RevenueScience.cjs');

module.exports = {
  // Main exports
  EventBus: AgencyEventBus,
  AgencyEventBus,
  ContextBox,
  BillingAgent,
  ErrorScience,
  RevenueScience,

  // Version info
  VERSION: '3.0.0',

  // Health check
  health: async function() {
    return {
      package: '@3a/agent-ops',
      version: '3.0.0',
      modules: {
        AgencyEventBus: typeof AgencyEventBus === 'function' || typeof AgencyEventBus === 'object',
        ContextBox: typeof ContextBox === 'function' || typeof ContextBox === 'object',
        BillingAgent: typeof BillingAgent === 'function' || typeof BillingAgent === 'object',
        ErrorScience: typeof ErrorScience === 'function' || typeof ErrorScience === 'object',
        RevenueScience: typeof RevenueScience === 'function' || typeof RevenueScience === 'object'
      },
      status: 'healthy'
    };
  }
};

// CLI health check
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--health')) {
    module.exports.health().then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    });
  } else {
    console.log('@3a/agent-ops v3.0.0 - Agent Operations for 3A Automation');
    console.log('Usage: node index.cjs --health');
  }
}
