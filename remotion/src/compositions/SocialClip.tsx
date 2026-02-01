/**
 * VocalIA Social Clip Composition
 *
 * Short-form video for LinkedIn/Twitter/Instagram.
 * Duration: 15 seconds (optimal for social)
 * Formats: Square (1:1), Vertical (9:16), Horizontal (16:9)
 * Session 250.43
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring
} from 'remotion';
import { isRTL, type Language, VOCALIA_METRICS } from '../config/i18n';

export const SOCIAL_CLIP_CONFIG = {
  fps: 30,
  width: 1080,  // Square format default
  height: 1080,
  duration: 15 // seconds
};

// Also export vertical and horizontal configs
export const SOCIAL_CLIP_VERTICAL = { ...SOCIAL_CLIP_CONFIG, width: 1080, height: 1920 };
export const SOCIAL_CLIP_HORIZONTAL = { ...SOCIAL_CLIP_CONFIG, width: 1920, height: 1080 };

const COLORS = {
  primary: '#5E6AD2',
  primaryLight: '#818CF8',
  accent: '#10B981',
  dark: '#1E293B',
  darker: '#0F172A',
  text: '#FFFFFF',
  textMuted: '#94A3B8'
};

type ClipType = 'stat' | 'tip' | 'announcement' | 'quote';

interface SocialClipProps {
  type?: ClipType;
  headline?: string;
  subline?: string;
  stat?: string;
  statLabel?: string;
  language?: Language;
}

const CONTENT: Record<ClipType, Record<Language, { headline: string; subline: string; stat?: string; statLabel?: string }>> = {
  stat: {
    fr: { headline: 'Réduisez vos coûts support', stat: '-60%', statLabel: 'En moyenne avec VocalIA' },
    en: { headline: 'Reduce your support costs', stat: '-60%', statLabel: 'On average with VocalIA' },
    es: { headline: 'Reduce tus costos de soporte', stat: '-60%', statLabel: 'En promedio con VocalIA' },
    ar: { headline: 'خفض تكاليف الدعم', stat: '-60%', statLabel: 'في المتوسط مع VocalIA' },
    ary: { headline: 'نقص تكاليف الدعم', stat: '-60%', statLabel: 'ف المتوسط مع VocalIA' }
  },
  tip: {
    fr: { headline: '💡 Astuce du jour', subline: `Utilisez nos ${VOCALIA_METRICS.personas} personas pour personnaliser chaque interaction client` },
    en: { headline: '💡 Tip of the day', subline: `Use our ${VOCALIA_METRICS.personas} personas to personalize every customer interaction` },
    es: { headline: '💡 Consejo del día', subline: `Usa nuestras ${VOCALIA_METRICS.personas} personas para personalizar cada interacción` },
    ar: { headline: '💡 نصيحة اليوم', subline: `استخدم ${VOCALIA_METRICS.personas} شخصية لتخصيص كل تفاعل` },
    ary: { headline: '💡 نصيحة ديال اليوم', subline: `استعمل ${VOCALIA_METRICS.personas} شخصية باش تخصص كل تفاعل` }
  },
  announcement: {
    fr: { headline: '🚀 Nouveau', subline: `${VOCALIA_METRICS.mcpTools} outils MCP maintenant disponibles` },
    en: { headline: '🚀 New', subline: `${VOCALIA_METRICS.mcpTools} MCP tools now available` },
    es: { headline: '🚀 Nuevo', subline: `${VOCALIA_METRICS.mcpTools} herramientas MCP disponibles` },
    ar: { headline: '🚀 جديد', subline: `${VOCALIA_METRICS.mcpTools} أداة MCP متاحة الآن` },
    ary: { headline: '🚀 جديد', subline: `${VOCALIA_METRICS.mcpTools} أداة MCP ولات متاحة` }
  },
  quote: {
    fr: { headline: '"VocalIA a transformé notre service client"', subline: '— Clinique Amal, Directeur Opérations' },
    en: { headline: '"VocalIA transformed our customer service"', subline: '— Clinique Amal, Operations Director' },
    es: { headline: '"VocalIA transformó nuestro servicio al cliente"', subline: '— Clinique Amal, Director de Operaciones' },
    ar: { headline: '"VocalIA حوّل خدمة العملاء لدينا"', subline: '— عيادة أمل، مدير العمليات' },
    ary: { headline: '"VocalIA بدّل خدمة الزبناء ديالنا"', subline: '— كلينيك أمل، مدير العمليات' }
  }
};

export const SocialClip: React.FC<SocialClipProps> = ({
  type = 'stat',
  headline,
  subline,
  stat,
  statLabel,
  language = 'fr'
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const rtl = isRTL(language);

  const content = CONTENT[type][language];
  const actualHeadline = headline || content.headline;
  const actualSubline = subline || content.subline;
  const actualStat = stat || content.stat;
  const actualStatLabel = statLabel || content.statLabel;

  const isVertical = height > width;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`,
        direction: rtl ? 'rtl' : 'ltr'
      }}
    >
      <AnimatedBackground frame={frame} />

      {/* Logo */}
      <LogoBadge frame={frame} fps={fps} isVertical={isVertical} />

      {/* Main Content */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          padding: isVertical ? 60 : 80
        }}
      >
        {type === 'stat' && actualStat ? (
          <StatContent
            stat={actualStat}
            statLabel={actualStatLabel || ''}
            headline={actualHeadline}
            fps={fps}
            frame={frame}
          />
        ) : (
          <TextContent
            headline={actualHeadline}
            subline={actualSubline || ''}
            fps={fps}
            frame={frame}
            isQuote={type === 'quote'}
          />
        )}
      </AbsoluteFill>

      {/* CTA */}
      <CTASection fps={fps} frame={frame} language={language} isVertical={isVertical} />
    </AbsoluteFill>
  );
};

const AnimatedBackground: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <div
      style={{
        position: 'absolute',
        width: '150%',
        height: '150%',
        background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}15 0%, transparent 50%)`,
        transform: `translate(${Math.sin(frame * 0.02) * 30}px, ${Math.cos(frame * 0.02) * 30}px)`
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: '120%',
        height: '120%',
        background: `radial-gradient(circle at 70% 70%, ${COLORS.accent}10 0%, transparent 50%)`,
        transform: `translate(${Math.cos(frame * 0.02) * 20}px, ${Math.sin(frame * 0.02) * 20}px)`
      }}
    />
  </AbsoluteFill>
);

const LogoBadge: React.FC<{ frame: number; fps: number; isVertical: boolean }> = ({ frame, fps, isVertical }) => {
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  return (
    <div
      style={{
        position: 'absolute',
        top: isVertical ? 80 : 40,
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        </svg>
      </div>
      <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>VocalIA</span>
    </div>
  );
};

const StatContent: React.FC<{
  stat: string;
  statLabel: string;
  headline: string;
  fps: number;
  frame: number;
}> = ({ stat, statLabel, headline, fps, frame }) => {
  const statProgress = interpolate(frame, [fps * 0.5, fps * 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const statNumber = parseInt(stat.replace(/[^-\d]/g, ''), 10);
  const displayNumber = Math.round(statNumber * statProgress);

  const headlineOpacity = interpolate(frame, [fps * 2, fps * 3], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <>
      <span
        style={{
          fontSize: 180,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.primaryLight} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1
        }}
      >
        {displayNumber}%
      </span>

      <p style={{ fontSize: 24, color: COLORS.textMuted, marginTop: 16, fontFamily: 'Inter, sans-serif' }}>
        {statLabel}
      </p>

      <h2
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: COLORS.text,
          marginTop: 40,
          opacity: headlineOpacity,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {headline}
      </h2>
    </>
  );
};

const TextContent: React.FC<{
  headline: string;
  subline: string;
  fps: number;
  frame: number;
  isQuote: boolean;
}> = ({ headline, subline, fps, frame, isQuote }) => {
  const headlineOpacity = interpolate(frame, [fps * 0.3, fps * 1], [0, 1], { extrapolateRight: 'clamp' });
  const headlineY = interpolate(frame, [fps * 0.3, fps * 1], [30, 0], { extrapolateRight: 'clamp' });
  const sublineOpacity = interpolate(frame, [fps * 1.5, fps * 2.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <>
      <h1
        style={{
          fontSize: isQuote ? 40 : 48,
          fontWeight: isQuote ? 500 : 800,
          color: COLORS.text,
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          fontStyle: isQuote ? 'italic' : 'normal',
          lineHeight: 1.3,
          maxWidth: 900
        }}
      >
        {headline}
      </h1>

      {subline && (
        <p
          style={{
            fontSize: 24,
            color: isQuote ? COLORS.accent : COLORS.textMuted,
            marginTop: 24,
            opacity: sublineOpacity,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.5,
            maxWidth: 800
          }}
        >
          {subline}
        </p>
      )}
    </>
  );
};

const CTASection: React.FC<{ fps: number; frame: number; language: Language; isVertical: boolean }> = ({ fps, frame, language, isVertical }) => {
  const opacity = interpolate(frame, [fps * 3, fps * 4], [0, 1], { extrapolateRight: 'clamp' });
  const cta = language === 'en' ? 'Learn more' : language === 'es' ? 'Saber más' : language === 'ar' || language === 'ary' ? 'اعرف أكثر' : 'En savoir plus';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isVertical ? 120 : 60,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <span style={{ fontSize: 20, color: COLORS.primary, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
        {cta} →
      </span>
      <span style={{ fontSize: 18, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
        vocalia.ma
      </span>
    </div>
  );
};
