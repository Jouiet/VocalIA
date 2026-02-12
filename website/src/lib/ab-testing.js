/**
 * VocalIA A/B Testing Framework
 * Session 250 - Task #32
 *
 * Lightweight client-side A/B testing for CTAs and landing pages.
 * No external dependencies. Uses localStorage for consistent variant assignment.
 *
 * Usage:
 *   const variant = VocaliaAB.getVariant('hero-cta');
 *   VocaliaAB.trackConversion('hero-cta', 'click');
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'vocalia_ab_v1';
  const ANALYTICS_ENDPOINT = '/api/analytics/ab';

  // Experiment Configurations
  const EXPERIMENTS = {
    // Hero CTA variations
    'hero-cta': {
      variants: ['control', 'urgent', 'value', 'social'],
      weights: [0.25, 0.25, 0.25, 0.25],
      enabled: true,
      content: {
        control: {
          text: 'Essai 14 Jours',
          textEn: 'Try 14 Days',
          subtext: 'Sans carte bancaire'
        },
        urgent: {
          text: 'Demander une Démo',
          textEn: 'Request a Demo',
          subtext: 'Personnalisée et sans engagement'
        },
        value: {
          text: 'Plateforme Tout-en-Un',
          textEn: 'All-in-One Platform',
          subtext: '38 personas • 5 langues • 203 outils MCP'
        },
        social: {
          text: 'Découvrir VocalIA',
          textEn: 'Discover VocalIA',
          subtext: 'Widget + Téléphonie PSTN'
        }
      }
    },

    // Pricing page CTA
    'pricing-cta': {
      variants: ['control', 'trial', 'guarantee'],
      weights: [0.34, 0.33, 0.33],
      enabled: true,
      content: {
        control: {
          text: 'Démarrer',
          textEn: 'Get Started'
        },
        trial: {
          text: 'Essai 14 Jours Gratuit',
          textEn: '14-Day Free Trial'
        },
        guarantee: {
          text: 'Démarrer — Essai 14 Jours',
          textEn: 'Start — 14-Day Trial'
        }
      }
    },

    // Demo request button
    'demo-request': {
      variants: ['control', 'personalized', 'instant'],
      weights: [0.34, 0.33, 0.33],
      enabled: true,
      content: {
        control: {
          text: 'Demander une Démo',
          textEn: 'Request Demo'
        },
        personalized: {
          text: 'Démo Personnalisée Gratuite',
          textEn: 'Free Personalized Demo'
        },
        instant: {
          text: 'Voir VocalIA en Action',
          textEn: 'See VocalIA in Action'
        }
      }
    },

    // Newsletter signup
    'newsletter': {
      variants: ['control', 'exclusive', 'count'],
      weights: [0.34, 0.33, 0.33],
      enabled: true,
      content: {
        control: {
          text: "S'inscrire",
          textEn: 'Subscribe',
          placeholder: 'votre@email.com'
        },
        exclusive: {
          text: 'Accès Anticipé',
          textEn: 'Early Access',
          placeholder: 'Email pour accès VIP'
        },
        count: {
          text: 'Rejoindre 1,500+ Abonnés',
          textEn: 'Join 1,500+ Subscribers',
          placeholder: 'votre@email.com'
        }
      }
    }
  };

  // Event types
  const EVENTS = {
    IMPRESSION: 'impression',
    CLICK: 'click',
    CONVERSION: 'conversion',
    HOVER: 'hover'
  };

  /**
   * Get or create user's experiment assignments
   */
  function getAssignments() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Validate structure
        if (data.userId && data.assignments) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[AB] Failed to load assignments:', e);
    }

    // Create new user
    return {
      userId: generateUserId(),
      assignments: {},
      createdAt: Date.now()
    };
  }

  /**
   * Save assignments to localStorage
   */
  function saveAssignments(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[AB] Failed to save assignments:', e);
    }
  }

  /**
   * Generate unique user ID
   */
  function generateUserId() {
    return 'ab_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Assign variant based on weights
   */
  function assignVariant(experiment) {
    const config = EXPERIMENTS[experiment];
    if (!config || !config.enabled) {
      return 'control';
    }

    const { variants, weights } = config;
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return variants[i];
      }
    }

    return variants[0]; // Fallback to first variant
  }

  /**
   * Get variant for an experiment
   */
  function getVariant(experiment) {
    const data = getAssignments();

    // Check if already assigned
    if (data.assignments[experiment]) {
      return data.assignments[experiment];
    }

    // Assign new variant
    const variant = assignVariant(experiment);
    data.assignments[experiment] = variant;
    saveAssignments(data);

    // Track impression
    trackEvent(experiment, EVENTS.IMPRESSION, { variant });

    return variant;
  }

  /**
   * Get variant content based on current language
   */
  function getVariantContent(experiment) {
    const variant = getVariant(experiment);
    const config = EXPERIMENTS[experiment];

    if (!config || !config.content || !config.content[variant]) {
      return null;
    }

    const content = config.content[variant];
    let lang = 'fr';
    try { lang = localStorage.getItem('vocalia_lang') || 'fr'; } catch (e) { /* ignore */ }

    // Return localized content
    return {
      variant,
      text: lang === 'en' ? (content.textEn || content.text) : content.text,
      subtext: content.subtext || null,
      placeholder: content.placeholder || null
    };
  }

  /**
   * Track event
   */
  function trackEvent(experiment, eventType, data = {}) {
    const assignments = getAssignments();
    const variant = assignments.assignments[experiment] || 'unknown';

    const payload = {
      experiment,
      variant,
      eventType,
      userId: assignments.userId,
      timestamp: Date.now(),
      url: window.location.pathname,
      ...data
    };

    // Send to analytics endpoint (fire and forget)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_ENDPOINT, JSON.stringify(payload));
    } else {
      fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      }).catch(() => {});
    }

    // Also log to console in development
    if (window.location.hostname === 'localhost') {
    }

    // Push to dataLayer for GTM/GA4 integration
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'ab_' + eventType,
        ab_experiment: experiment,
        ab_variant: variant,
        ...data
      });
    }
  }

  /**
   * Track click on A/B tested element
   */
  function trackClick(experiment) {
    trackEvent(experiment, EVENTS.CLICK);
  }

  /**
   * Track conversion (form submit, signup, etc.)
   */
  function trackConversion(experiment, conversionType = 'default') {
    trackEvent(experiment, EVENTS.CONVERSION, { conversionType });
  }

  /**
   * Apply variant to element
   */
  function applyVariant(element, experiment) {
    const content = getVariantContent(experiment);
    if (!content) return;

    // Update text content
    if (content.text && element.tagName !== 'INPUT') {
      element.textContent = content.text;
    }

    // Update placeholder for inputs
    if (content.placeholder && element.tagName === 'INPUT') {
      element.placeholder = content.placeholder;
    }

    // Add subtext if present
    if (content.subtext) {
      const existingSubtext = element.parentElement.querySelector('.ab-subtext');
      if (!existingSubtext) {
        const subtextEl = document.createElement('span');
        subtextEl.className = 'ab-subtext text-xs text-zinc-400 block mt-1';
        subtextEl.textContent = content.subtext;
        element.parentElement.appendChild(subtextEl);
      }
    }

    // Track click automatically
    element.addEventListener('click', () => trackClick(experiment), { once: true });

    // Add data attribute for debugging
    element.dataset.abExperiment = experiment;
    element.dataset.abVariant = content.variant;
  }

  /**
   * Initialize A/B testing on page load
   */
  function init() {
    // Auto-apply to elements with data-ab attribute
    document.querySelectorAll('[data-ab]').forEach(el => {
      const experiment = el.dataset.ab;
      if (EXPERIMENTS[experiment]) {
        applyVariant(el, experiment);
      }
    });
  }

  /**
   * Get all experiment results for current user
   */
  function getResults() {
    const data = getAssignments();
    return {
      userId: data.userId,
      assignments: data.assignments,
      experiments: Object.keys(EXPERIMENTS).map(key => ({
        name: key,
        variant: data.assignments[key] || 'not_assigned',
        enabled: EXPERIMENTS[key].enabled
      }))
    };
  }

  /**
   * Force a specific variant (for testing)
   */
  function forceVariant(experiment, variant) {
    const data = getAssignments();
    data.assignments[experiment] = variant;
    saveAssignments(data);
  }

  /**
   * Reset all assignments (for testing)
   */
  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export
  window.VocaliaAB = {
    getVariant,
    getVariantContent,
    applyVariant,
    trackClick,
    trackConversion,
    trackEvent,
    getResults,
    forceVariant,
    reset,
    EXPERIMENTS,
    EVENTS
  };

})();
