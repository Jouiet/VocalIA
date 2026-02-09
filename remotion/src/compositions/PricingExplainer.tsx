/**
 * VocalIA Pricing Explainer Video Composition
 *
 * Animated comparison of pricing plans.
 * Duration: 30 seconds
 * Session 250.43
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence
} from 'remotion';
import { isRTL, type Language } from '../config/i18n';

export const PRICING_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 30 // seconds
};

const COLORS = {
  primary: '#5E6AD2',
  primaryLight: '#818CF8',
  accent: '#10B981',
  warning: '#F59E0B',
  dark: '#1E293B',
  darker: '#0F172A',
  text: '#FFFFFF',
  textMuted: '#94A3B8'
};

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

interface PricingExplainerProps {
  title?: string;
  plans?: PricingPlan[];
  language?: Language;
}

const DEFAULT_PLANS: Record<Language, PricingPlan[]> = {
  fr: [
    {
      name: 'Starter',
      price: '0',
      period: '/mois',
      features: ['Voice Widget', '100 conversations/mois', 'Support email', '1 persona']
    },
    {
      name: 'Pro',
      price: '99',
      period: '/mois',
      features: ['Widget + Telephony', '5,000 conversations/mois', 'Support prioritaire', '10 personas', 'Analytics avancés'],
      highlighted: true,
      badge: 'Populaire'
    },
    {
      name: 'Enterprise',
      price: 'Sur mesure',
      period: '',
      features: ['Solution complète', 'Illimité', 'Support dédié', '38 personas', 'Intégrations custom', 'SLA 99.9%']
    }
  ],
  en: [
    {
      name: 'Starter',
      price: '0',
      period: '/month',
      features: ['Voice Widget', '100 conversations/mo', 'Email support', '1 persona']
    },
    {
      name: 'Pro',
      price: '99',
      period: '/month',
      features: ['Widget + Telephony', '5,000 conversations/mo', 'Priority support', '10 personas', 'Advanced analytics'],
      highlighted: true,
      badge: 'Popular'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: ['Full solution', 'Unlimited', 'Dedicated support', '38 personas', 'Custom integrations', '99.9% SLA']
    }
  ],
  es: [
    {
      name: 'Starter',
      price: '0',
      period: '/mes',
      features: ['Voice Widget', '100 conversaciones/mes', 'Soporte email', '1 persona']
    },
    {
      name: 'Pro',
      price: '99',
      period: '/mes',
      features: ['Widget + Telefonía', '5,000 conversaciones/mes', 'Soporte prioritario', '10 personas', 'Analytics avanzados'],
      highlighted: true,
      badge: 'Popular'
    },
    {
      name: 'Enterprise',
      price: 'Personalizado',
      period: '',
      features: ['Solución completa', 'Ilimitado', 'Soporte dedicado', '38 personas', 'Integraciones custom', 'SLA 99.9%']
    }
  ],
  ar: [
    {
      name: 'Starter',
      price: '0',
      period: '/شهر',
      features: ['Voice Widget', '100 محادثة/شهر', 'دعم البريد', '1 شخصية']
    },
    {
      name: 'Pro',
      price: '99',
      period: '/شهر',
      features: ['Widget + الاتصال', '5,000 محادثة/شهر', 'دعم أولوية', '10 شخصيات', 'تحليلات متقدمة'],
      highlighted: true,
      badge: 'الأكثر شعبية'
    },
    {
      name: 'Enterprise',
      price: 'مخصص',
      period: '',
      features: ['حل كامل', 'غير محدود', 'دعم مخصص', '40 شخصية', 'تكاملات مخصصة', 'SLA 99.9%']
    }
  ],
  ary: [
    {
      name: 'Starter',
      price: '0',
      period: '/شهر',
      features: ['Voice Widget', '100 محادثة/شهر', 'سوبور بالإيميل', '1 شخصية']
    },
    {
      name: 'Pro',
      price: '99',
      period: '/شهر',
      features: ['Widget + التيليفون', '5,000 محادثة/شهر', 'سوبور بالأولوية', '10 شخصيات', 'أناليتيكس متقدم'],
      highlighted: true,
      badge: 'الأكثر طلباً'
    },
    {
      name: 'Enterprise',
      price: 'على المقاس',
      period: '',
      features: ['حل كامل', 'بلا حدود', 'سوبور مخصص', '40 شخصية', 'تكاملات مخصصة', 'SLA 99.9%']
    }
  ]
};

const TITLES: Record<Language, string> = {
  fr: 'Choisissez votre plan',
  en: 'Choose your plan',
  es: 'Elige tu plan',
  ar: 'اختر خطتك',
  ary: 'ختار الخطة ديالك'
};

export const PricingExplainer: React.FC<PricingExplainerProps> = ({
  title,
  plans,
  language = 'fr'
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rtl = isRTL(language);

  const actualPlans = plans || DEFAULT_PLANS[language];
  const actualTitle = title || TITLES[language];

  const INTRO_DURATION = fps * 5;
  const PLANS_DURATION = fps * 20;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`,
        direction: rtl ? 'rtl' : 'ltr'
      }}
    >
      <AnimatedBackground frame={frame} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <IntroSection title={actualTitle} fps={fps} />
      </Sequence>

      {/* Plans */}
      <Sequence from={INTRO_DURATION} durationInFrames={PLANS_DURATION}>
        <PlansSection plans={actualPlans} fps={fps} rtl={rtl} language={language} />
      </Sequence>

      {/* Outro fade */}
      <AbsoluteFill
        style={{
          background: COLORS.darker,
          opacity: interpolate(frame, [durationInFrames - fps * 2, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' })
        }}
      />
    </AbsoluteFill>
  );
};

const AnimatedBackground: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <div
      style={{
        position: 'absolute',
        width: 800,
        height: 800,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.primary}10 0%, transparent 70%)`,
        top: -200,
        left: '50%',
        transform: `translateX(-50%) translateY(${Math.sin(frame * 0.01) * 20}px)`
      }}
    />
  </AbsoluteFill>
);

const IntroSection: React.FC<{ title: string; fps: number }> = ({ title, fps }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: COLORS.text,
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleY) * 40}px)`,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {title}
      </h1>
    </AbsoluteFill>
  );
};

const PlansSection: React.FC<{
  plans: PricingPlan[];
  fps: number;
  rtl: boolean;
  language: Language;
}> = ({ plans, fps, rtl, language }) => {
  const frame = useCurrentFrame();
  const currency = language === 'ar' || language === 'ary' ? 'د.م' : '€';

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div
        style={{
          display: 'flex',
          gap: 32,
          flexDirection: rtl ? 'row-reverse' : 'row'
        }}
      >
        {plans.map((plan, index) => {
          const delay = index * fps * 0.4;
          const planFrame = frame - delay;
          const opacity = interpolate(planFrame, [0, fps * 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const scale = spring({ frame: Math.max(0, planFrame), fps, config: { damping: 12, stiffness: 100 } });

          return (
            <div
              key={index}
              style={{
                width: 360,
                background: plan.highlighted ? `linear-gradient(135deg, ${COLORS.primary}20, ${COLORS.accent}10)` : `${COLORS.dark}CC`,
                borderRadius: 24,
                padding: 40,
                border: plan.highlighted ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.primary}30`,
                opacity,
                transform: `scale(${scale}) ${plan.highlighted ? 'translateY(-20px)' : ''}`,
                position: 'relative'
              }}
            >
              {plan.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`,
                    padding: '8px 24px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.text,
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  {plan.badge}
                </div>
              )}

              <h3 style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, marginBottom: 16, fontFamily: 'Inter, sans-serif' }}>
                {plan.name}
              </h3>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                {plan.price !== 'Sur mesure' && plan.price !== 'Custom' && plan.price !== 'Personalizado' && plan.price !== 'مخصص' && plan.price !== 'على المقاس' && (
                  <span style={{ fontSize: 20, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>{currency}</span>
                )}
                <span style={{ fontSize: 48, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 18, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
                  {plan.period}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: COLORS.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 16, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
