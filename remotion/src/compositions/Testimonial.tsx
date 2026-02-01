/**
 * VocalIA Testimonial Video Composition
 *
 * A 20-second testimonial video with quote animation.
 * Session 250.42 - Optimized with multi-language and RTL support.
 */
import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring
} from 'remotion';
import { isRTL, type Language } from '../config/i18n';

// Configuration
export const TESTIMONIAL_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 20 // seconds
};

// VocalIA Brand Colors
const COLORS = {
  primary: '#5E6AD2',
  primaryLight: '#818CF8',
  accent: '#10B981',
  dark: '#1E293B',
  darker: '#0F172A',
  text: '#FFFFFF',
  textMuted: '#94A3B8'
};

interface TestimonialProps {
  quote: string;
  author: string;
  role: string;
  metric: string;
  metricLabel: string;
  language?: Language;
}

export const Testimonial: React.FC<TestimonialProps> = ({
  quote,
  author,
  role,
  metric,
  metricLabel,
  language = 'fr'
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rtl = isRTL(language);

  // Metric counter animation
  const metricProgress = interpolate(frame, [fps * 2, fps * 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Extract number from metric (e.g., "-60%" -> -60)
  const metricNumber = parseInt(metric.replace(/[^-\d]/g, ''), 10);
  const displayNumber = Math.round(metricNumber * metricProgress);

  // Quote animation
  const quoteOpacity = interpolate(frame, [fps * 4, fps * 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const quoteY = interpolate(frame, [fps * 4, fps * 6], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Author animation
  const authorOpacity = interpolate(frame, [fps * 8, fps * 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });

  // Outro fade
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - fps * 2, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`,
        opacity: outroOpacity,
        direction: rtl ? 'rtl' : 'ltr'
      }}
    >
      {/* Background elements */}
      <QuoteBackground frame={frame} />

      {/* Main content */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          padding: 100
        }}
      >
        {/* Metric highlight */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 60
          }}
        >
          <span
            style={{
              fontSize: 160,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.primaryLight} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: 1
            }}
          >
            {displayNumber}%
          </span>
        </div>

        <p
          style={{
            fontSize: 28,
            color: COLORS.textMuted,
            marginBottom: 60,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          {metricLabel}
        </p>

        {/* Quote */}
        <div
          style={{
            maxWidth: 1000,
            opacity: quoteOpacity,
            transform: `translateY(${quoteY}px)`
          }}
        >
          <QuoteIcon />

          <p
            style={{
              fontSize: 36,
              color: COLORS.text,
              lineHeight: 1.6,
              textAlign: 'center',
              fontStyle: 'italic',
              marginTop: 24,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            "{quote}"
          </p>
        </div>

        {/* Author */}
        <div
          style={{
            marginTop: 48,
            opacity: authorOpacity,
            textAlign: 'center'
          }}
        >
          <p
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.text,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {author}
          </p>
          <p
            style={{
              fontSize: 18,
              color: COLORS.textMuted,
              marginTop: 8,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {role}
          </p>
        </div>

        {/* VocalIA badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transform: `scale(${logoScale})`
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-4.07z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${COLORS.primaryLight} 0%, ${COLORS.primary} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            VocalIA
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Quote background decoration
const QuoteBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = frame * 0.05;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Large faded quote marks */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          fontSize: 400,
          color: `${COLORS.primary}08`,
          fontFamily: 'Georgia, serif',
          transform: `rotate(${rotation}deg)`
        }}
      >
        "
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          fontSize: 400,
          color: `${COLORS.accent}08`,
          fontFamily: 'Georgia, serif',
          transform: `rotate(180deg) rotate(${-rotation}deg)`
        }}
      >
        "
      </div>

      {/* Accent orb */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.accent}10 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${1 + Math.sin(frame * 0.02) * 0.1})`
        }}
      />
    </AbsoluteFill>
  );
};

// Quote icon
const QuoteIcon: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center' }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill={COLORS.primary}>
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
    </svg>
  </div>
);
