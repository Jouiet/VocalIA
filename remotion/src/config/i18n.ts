/**
 * VocalIA Remotion i18n Configuration
 *
 * Multi-language content for video compositions.
 * Matches VocalIA's 5 supported languages.
 */

export type Language = 'fr' | 'en' | 'es' | 'ar' | 'ary';

export interface DemoContent {
  title: string;
  subtitle: string;
  features: string[];
  cta: {
    primary: string;
    secondary: string;
  };
  tagline: string;
}

export interface FeatureContent {
  introTitle: string;
  features: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
}

export interface TestimonialContent {
  quote: string;
  author: string;
  role: string;
  metric: string;
  metricLabel: string;
}

// VocalIA Metrics - Dynamic (fetched or hardcoded)
export const VOCALIA_METRICS = {
  personas: 40,
  languages: 5,
  mcpTools: 182,
  integrations: 28,
  ecommercePlatforms: 7,
  stripeTools: 19
};

export const DEMO_CONTENT: Record<Language, DemoContent> = {
  fr: {
    title: 'VocalIA',
    subtitle: 'Agents Vocaux IA pour Entreprises',
    features: [
      `${VOCALIA_METRICS.personas} Personas SOTA`,
      `${VOCALIA_METRICS.languages} Langues + Darija`,
      `${VOCALIA_METRICS.mcpTools} MCP Tools`,
      `${VOCALIA_METRICS.integrations} Intégrations`
    ],
    cta: {
      primary: 'Essai Gratuit',
      secondary: 'Voir la Démo'
    },
    tagline: 'Prêt à transformer votre service client ?'
  },
  en: {
    title: 'VocalIA',
    subtitle: 'Voice AI Agents for Business',
    features: [
      `${VOCALIA_METRICS.personas} SOTA Personas`,
      `${VOCALIA_METRICS.languages} Languages + Darija`,
      `${VOCALIA_METRICS.mcpTools} MCP Tools`,
      `${VOCALIA_METRICS.integrations} Integrations`
    ],
    cta: {
      primary: 'Free Trial',
      secondary: 'Watch Demo'
    },
    tagline: 'Ready to transform your customer service?'
  },
  es: {
    title: 'VocalIA',
    subtitle: 'Agentes de Voz IA para Empresas',
    features: [
      `${VOCALIA_METRICS.personas} Personas SOTA`,
      `${VOCALIA_METRICS.languages} Idiomas + Darija`,
      `${VOCALIA_METRICS.mcpTools} Herramientas MCP`,
      `${VOCALIA_METRICS.integrations} Integraciones`
    ],
    cta: {
      primary: 'Prueba Gratis',
      secondary: 'Ver Demo'
    },
    tagline: '¿Listo para transformar tu servicio al cliente?'
  },
  ar: {
    title: 'VocalIA',
    subtitle: 'وكلاء صوتيون بالذكاء الاصطناعي للشركات',
    features: [
      `${VOCALIA_METRICS.personas} شخصية SOTA`,
      `${VOCALIA_METRICS.languages} لغات + الدارجة`,
      `${VOCALIA_METRICS.mcpTools} أداة MCP`,
      `${VOCALIA_METRICS.integrations} تكامل`
    ],
    cta: {
      primary: 'تجربة مجانية',
      secondary: 'شاهد العرض'
    },
    tagline: 'هل أنت مستعد لتحويل خدمة العملاء؟'
  },
  ary: {
    title: 'VocalIA',
    subtitle: 'وكلاء صوتيين ديال الذكاء الاصطناعي للشركات',
    features: [
      `${VOCALIA_METRICS.personas} شخصية SOTA`,
      `${VOCALIA_METRICS.languages} لغات + الدارجة`,
      `${VOCALIA_METRICS.mcpTools} أداة MCP`,
      `${VOCALIA_METRICS.integrations} تكامل`
    ],
    cta: {
      primary: 'تجربة بلاش',
      secondary: 'شوف الديمو'
    },
    tagline: 'واش نتا مستعد تبدل خدمة الزبناء ديالك؟'
  }
};

export const FEATURE_CONTENT: Record<Language, FeatureContent> = {
  fr: {
    introTitle: 'Découvrez VocalIA',
    features: [
      { title: 'Voice Widget', description: 'Intégration web en 2 lignes de code', icon: '🎙️' },
      { title: 'Voice Telephony', description: 'Bridge PSTN ↔ AI pour appels entrants', icon: '📞' },
      { title: 'Multi-Persona', description: `${VOCALIA_METRICS.personas} personas métier pré-configurés`, icon: '🎭' },
      { title: 'Multilingue', description: 'FR, EN, ES, AR, Darija natif', icon: '🌍' }
    ]
  },
  en: {
    introTitle: 'Discover VocalIA',
    features: [
      { title: 'Voice Widget', description: 'Web integration in 2 lines of code', icon: '🎙️' },
      { title: 'Voice Telephony', description: 'PSTN ↔ AI bridge for inbound calls', icon: '📞' },
      { title: 'Multi-Persona', description: `${VOCALIA_METRICS.personas} pre-configured business personas`, icon: '🎭' },
      { title: 'Multilingual', description: 'FR, EN, ES, AR, native Darija', icon: '🌍' }
    ]
  },
  es: {
    introTitle: 'Descubre VocalIA',
    features: [
      { title: 'Voice Widget', description: 'Integración web en 2 líneas de código', icon: '🎙️' },
      { title: 'Voice Telephony', description: 'Puente PSTN ↔ AI para llamadas entrantes', icon: '📞' },
      { title: 'Multi-Persona', description: `${VOCALIA_METRICS.personas} personas de negocio preconfigurados`, icon: '🎭' },
      { title: 'Multilingüe', description: 'FR, EN, ES, AR, Darija nativo', icon: '🌍' }
    ]
  },
  ar: {
    introTitle: 'اكتشف VocalIA',
    features: [
      { title: 'Voice Widget', description: 'تكامل الويب في سطرين من الكود', icon: '🎙️' },
      { title: 'Voice Telephony', description: 'جسر PSTN ↔ AI للمكالمات الواردة', icon: '📞' },
      { title: 'Multi-Persona', description: `${VOCALIA_METRICS.personas} شخصية أعمال مُعدة مسبقاً`, icon: '🎭' },
      { title: 'متعدد اللغات', description: 'FR, EN, ES, AR, الدارجة الأصلية', icon: '🌍' }
    ]
  },
  ary: {
    introTitle: 'كتشف VocalIA',
    features: [
      { title: 'Voice Widget', description: 'تكامل ديال الويب ف 2 سطور ديال الكود', icon: '🎙️' },
      { title: 'Voice Telephony', description: 'جسر PSTN ↔ AI للمكالمات اللي كتجي', icon: '📞' },
      { title: 'Multi-Persona', description: `${VOCALIA_METRICS.personas} شخصية ديال الخدمة جاهزين`, icon: '🎭' },
      { title: 'بزاف ديال اللغات', description: 'FR, EN, ES, AR, الدارجة الأصلية', icon: '🌍' }
    ]
  }
};

export const TESTIMONIAL_CONTENT: Record<Language, TestimonialContent> = {
  fr: {
    quote: 'VocalIA a réduit nos coûts support de 60% tout en améliorant la satisfaction client.',
    author: 'Clinique Amal',
    role: 'Directeur Opérations',
    metric: '-60%',
    metricLabel: 'Coûts Support'
  },
  en: {
    quote: 'VocalIA reduced our support costs by 60% while improving customer satisfaction.',
    author: 'Clinique Amal',
    role: 'Operations Director',
    metric: '-60%',
    metricLabel: 'Support Costs'
  },
  es: {
    quote: 'VocalIA redujo nuestros costos de soporte en un 60% mientras mejoraba la satisfacción del cliente.',
    author: 'Clinique Amal',
    role: 'Director de Operaciones',
    metric: '-60%',
    metricLabel: 'Costos de Soporte'
  },
  ar: {
    quote: 'خفضت VocalIA تكاليف الدعم لدينا بنسبة 60% مع تحسين رضا العملاء.',
    author: 'عيادة أمل',
    role: 'مدير العمليات',
    metric: '-60%',
    metricLabel: 'تكاليف الدعم'
  },
  ary: {
    quote: 'VocalIA نقصات لينا تكاليف الدعم ب 60% و زادت رضا الزبناء.',
    author: 'كلينيك أمل',
    role: 'مدير العمليات',
    metric: '-60%',
    metricLabel: 'تكاليف الدعم'
  }
};

// RTL languages
export const RTL_LANGUAGES: Language[] = ['ar', 'ary'];

export function isRTL(lang: Language): boolean {
  return RTL_LANGUAGES.includes(lang);
}
