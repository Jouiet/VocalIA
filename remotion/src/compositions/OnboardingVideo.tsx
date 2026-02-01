/**
 * VocalIA Onboarding Video Composition
 *
 * Welcome video for new clients with setup steps.
 * Duration: 60 seconds
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
import { isRTL, type Language, VOCALIA_METRICS } from '../config/i18n';

export const ONBOARDING_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 60 // seconds
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

interface OnboardingStep {
  number: number;
  title: string;
  description: string;
  icon: string;
  duration: string;
}

interface OnboardingProps {
  clientName?: string;
  steps?: OnboardingStep[];
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  language?: Language;
}

const DEFAULT_STEPS: Record<Language, OnboardingStep[]> = {
  fr: [
    { number: 1, title: 'Créer votre compte', description: 'Inscription en 2 minutes', icon: '👤', duration: '2 min' },
    { number: 2, title: 'Configurer votre persona', description: 'Choisissez parmi 40 personas métier', icon: '🎭', duration: '5 min' },
    { number: 3, title: 'Intégrer le widget', description: '2 lignes de code JavaScript', icon: '💻', duration: '3 min' },
    { number: 4, title: 'Tester votre agent', description: 'Conversation de test en direct', icon: '🎙️', duration: '5 min' },
    { number: 5, title: 'Lancer en production', description: 'Activez votre agent vocal', icon: '🚀', duration: '1 min' }
  ],
  en: [
    { number: 1, title: 'Create your account', description: 'Sign up in 2 minutes', icon: '👤', duration: '2 min' },
    { number: 2, title: 'Configure your persona', description: 'Choose from 40 business personas', icon: '🎭', duration: '5 min' },
    { number: 3, title: 'Integrate the widget', description: '2 lines of JavaScript code', icon: '💻', duration: '3 min' },
    { number: 4, title: 'Test your agent', description: 'Live test conversation', icon: '🎙️', duration: '5 min' },
    { number: 5, title: 'Go live', description: 'Activate your voice agent', icon: '🚀', duration: '1 min' }
  ],
  es: [
    { number: 1, title: 'Crear tu cuenta', description: 'Registro en 2 minutos', icon: '👤', duration: '2 min' },
    { number: 2, title: 'Configurar tu persona', description: 'Elige entre 40 personas de negocio', icon: '🎭', duration: '5 min' },
    { number: 3, title: 'Integrar el widget', description: '2 líneas de código JavaScript', icon: '💻', duration: '3 min' },
    { number: 4, title: 'Probar tu agente', description: 'Conversación de prueba en vivo', icon: '🎙️', duration: '5 min' },
    { number: 5, title: 'Lanzar en producción', description: 'Activa tu agente de voz', icon: '🚀', duration: '1 min' }
  ],
  ar: [
    { number: 1, title: 'إنشاء حسابك', description: 'التسجيل في دقيقتين', icon: '👤', duration: '2 د' },
    { number: 2, title: 'تكوين شخصيتك', description: 'اختر من 40 شخصية أعمال', icon: '🎭', duration: '5 د' },
    { number: 3, title: 'دمج الأداة', description: 'سطرين من كود JavaScript', icon: '💻', duration: '3 د' },
    { number: 4, title: 'اختبار وكيلك', description: 'محادثة اختبار مباشرة', icon: '🎙️', duration: '5 د' },
    { number: 5, title: 'الإطلاق', description: 'فعّل وكيلك الصوتي', icon: '🚀', duration: '1 د' }
  ],
  ary: [
    { number: 1, title: 'دير الكونط ديالك', description: 'التسجيل ف 2 دقايق', icon: '👤', duration: '2 د' },
    { number: 2, title: 'سيتي البيرسونا ديالك', description: 'ختار من 40 بيرسونا ديال الخدمة', icon: '🎭', duration: '5 د' },
    { number: 3, title: 'دخل الويدجيت', description: '2 سطور ديال الكود', icon: '💻', duration: '3 د' },
    { number: 4, title: 'جرب الوكيل ديالك', description: 'محادثة تجريبية لايف', icon: '🎙️', duration: '5 د' },
    { number: 5, title: 'طلقو', description: 'فعّل الوكيل الصوتي ديالك', icon: '🚀', duration: '1 د' }
  ]
};

const WELCOME_CONTENT: Record<Language, { title: string; subtitle: string }> = {
  fr: { title: 'Bienvenue sur VocalIA', subtitle: 'Votre parcours d\'intégration en 5 étapes' },
  en: { title: 'Welcome to VocalIA', subtitle: 'Your 5-step onboarding journey' },
  es: { title: 'Bienvenido a VocalIA', subtitle: 'Tu recorrido de integración en 5 pasos' },
  ar: { title: 'مرحباً بك في VocalIA', subtitle: 'رحلة الإعداد في 5 خطوات' },
  ary: { title: 'مرحبا بيك ف VocalIA', subtitle: 'الطريق ديالك ف 5 مراحل' }
};

export const OnboardingVideo: React.FC<OnboardingProps> = ({
  clientName,
  steps,
  welcomeTitle,
  welcomeSubtitle,
  language = 'fr'
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rtl = isRTL(language);

  const actualSteps = steps || DEFAULT_STEPS[language];
  const welcome = WELCOME_CONTENT[language];
  const title = welcomeTitle || welcome.title;
  const subtitle = welcomeSubtitle || welcome.subtitle;

  const INTRO_DURATION = fps * 8;
  const STEP_DURATION = fps * 9;
  const OUTRO_DURATION = fps * 7;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`,
        direction: rtl ? 'rtl' : 'ltr'
      }}
    >
      <AnimatedBackground frame={frame} />

      {/* Welcome Section */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <WelcomeSection
          title={title}
          subtitle={subtitle}
          clientName={clientName}
          fps={fps}
        />
      </Sequence>

      {/* Step Sections */}
      {actualSteps.map((step, index) => (
        <Sequence
          key={step.number}
          from={INTRO_DURATION + index * STEP_DURATION}
          durationInFrames={STEP_DURATION}
        >
          <StepSection step={step} fps={fps} rtl={rtl} totalSteps={actualSteps.length} />
        </Sequence>
      ))}

      {/* Outro */}
      <Sequence from={durationInFrames - OUTRO_DURATION}>
        <OutroSection fps={fps} language={language} />
      </Sequence>
    </AbsoluteFill>
  );
};

const AnimatedBackground: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <div
      style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.primary}15 0%, transparent 70%)`,
        top: -100,
        right: -100,
        transform: `translate(${Math.sin(frame * 0.01) * 20}px, ${Math.cos(frame * 0.01) * 20}px)`
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.accent}10 0%, transparent 70%)`,
        bottom: -50,
        left: -50,
        transform: `translate(${Math.cos(frame * 0.01) * 15}px, ${Math.sin(frame * 0.01) * 15}px)`
      }}
    />
  </AbsoluteFill>
);

const WelcomeSection: React.FC<{
  title: string;
  subtitle: string;
  clientName?: string;
  fps: number;
}> = ({ title, subtitle, clientName, fps }) => {
  const frame = useCurrentFrame();

  const logoScale = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [fps * 0.5, fps * 1.5], [0, 1], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [fps * 1.5, fps * 2.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${logoScale})`,
          boxShadow: `0 0 50px ${COLORS.primary}40`,
          marginBottom: 32
        }}
      >
        <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-4.07z" />
        </svg>
      </div>

      {clientName && (
        <p style={{ fontSize: 28, color: COLORS.accent, marginBottom: 16, fontFamily: 'Inter, sans-serif', opacity: titleOpacity }}>
          {clientName}
        </p>
      )}

      <h1 style={{ fontSize: 72, fontWeight: 800, color: COLORS.text, opacity: titleOpacity, fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        {title}
      </h1>

      <p style={{ fontSize: 28, color: COLORS.textMuted, marginTop: 16, opacity: subtitleOpacity, fontFamily: 'Inter, sans-serif' }}>
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};

const StepSection: React.FC<{
  step: OnboardingStep;
  fps: number;
  rtl: boolean;
  totalSteps: number;
}> = ({ step, fps, rtl, totalSteps }) => {
  const frame = useCurrentFrame();

  const iconScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const contentOpacity = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const progressWidth = interpolate(frame, [fps * 0.5, fps * 2], [0, (step.number / totalSteps) * 100], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 100 }}>
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 60, left: 100, right: 100, height: 8, background: `${COLORS.dark}`, borderRadius: 4 }}>
        <div style={{ width: `${progressWidth}%`, height: '100%', background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`, borderRadius: 4 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 60, flexDirection: rtl ? 'row-reverse' : 'row' }}>
        {/* Step number and icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 30,
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${iconScale})`,
              boxShadow: `0 0 60px ${COLORS.primary}40`,
              fontSize: 56
            }}
          >
            {step.icon}
          </div>
          <div style={{ fontSize: 24, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
            {step.number}/{totalSteps}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, opacity: contentOpacity }}>
          <h2 style={{ fontSize: 56, fontWeight: 700, color: COLORS.text, marginBottom: 16, fontFamily: 'Inter, sans-serif' }}>
            {step.title}
          </h2>
          <p style={{ fontSize: 28, color: COLORS.textMuted, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
            {step.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.accent }} />
            <span style={{ fontSize: 20, color: COLORS.accent, fontFamily: 'Inter, sans-serif' }}>
              {step.duration}
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroSection: React.FC<{ fps: number; language: Language }> = ({ fps, language }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  const content = {
    fr: { title: 'Prêt à démarrer ?', cta: 'Commencer maintenant' },
    en: { title: 'Ready to start?', cta: 'Get started now' },
    es: { title: '¿Listo para empezar?', cta: 'Comenzar ahora' },
    ar: { title: 'مستعد للبدء؟', cta: 'ابدأ الآن' },
    ary: { title: 'واش نتا ريدي؟', cta: 'بدا دابا' }
  };

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <h2 style={{ fontSize: 64, fontWeight: 800, color: COLORS.text, marginBottom: 32, fontFamily: 'Inter, sans-serif' }}>
        {content[language].title}
      </h2>
      <div
        style={{
          padding: '24px 64px',
          background: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.primary} 100%)`,
          borderRadius: 16,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.text,
          transform: `scale(${scale})`,
          boxShadow: `0 0 40px ${COLORS.accent}60`,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {content[language].cta}
      </div>
      <p style={{ fontSize: 20, color: COLORS.textMuted, marginTop: 32, fontFamily: 'Inter, sans-serif' }}>
        vocalia.ma
      </p>
    </AbsoluteFill>
  );
};
