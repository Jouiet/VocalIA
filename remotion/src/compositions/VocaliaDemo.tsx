/**
 * VocalIA Demo Video Composition
 *
 * A 30-second product demo video with animated brand elements.
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

// Configuration
export const DEMO_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 30 // seconds
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

interface DemoProps {
  title: string;
  subtitle: string;
  features: string[];
}

export const VocaliaDemo: React.FC<DemoProps> = ({ title, subtitle, features }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Animation phases (in frames)
  const INTRO_END = fps * 5;        // 0-5s: Logo intro
  const FEATURES_START = fps * 6;   // 6s: Features start
  const FEATURES_END = fps * 22;    // 22s: Features end
  const OUTRO_START = fps * 24;     // 24s: Outro starts

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });

  const logoOpacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: 'clamp'
  });

  // Subtitle animation
  const subtitleY = interpolate(frame, [fps * 2, fps * 3], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const subtitleOpacity = interpolate(frame, [fps * 2, fps * 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
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
        opacity: outroOpacity
      }}
    >
      {/* Animated mesh gradient background */}
      <MeshGradient frame={frame} />

      {/* Logo and Title Section */}
      <Sequence from={0} durationInFrames={INTRO_END}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${logoScale})`,
              opacity: logoOpacity,
              boxShadow: `0 0 60px ${COLORS.primary}40`
            }}
          >
            <MicIcon size={60} />
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 96,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.primaryLight} 0%, ${COLORS.primary} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginTop: 24,
              opacity: logoOpacity,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 32,
              color: COLORS.textMuted,
              marginTop: 16,
              transform: `translateY(${subtitleY}px)`,
              opacity: subtitleOpacity,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {subtitle}
          </p>
        </AbsoluteFill>
      </Sequence>

      {/* Features Section */}
      <Sequence from={FEATURES_START} durationInFrames={FEATURES_END - FEATURES_START}>
        <FeaturesSection features={features} fps={fps} />
      </Sequence>

      {/* Call to Action */}
      <Sequence from={OUTRO_START}>
        <CTASection fps={fps} frame={frame - OUTRO_START} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Mesh Gradient Background
const MeshGradient: React.FC<{ frame: number }> = ({ frame }) => {
  const offset = frame * 0.5;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.primary}20 0%, transparent 70%)`,
          top: -200,
          right: -200,
          transform: `translate(${Math.sin(offset * 0.01) * 20}px, ${Math.cos(offset * 0.01) * 20}px)`
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.accent}15 0%, transparent 70%)`,
          bottom: -150,
          left: -150,
          transform: `translate(${Math.cos(offset * 0.01) * 15}px, ${Math.sin(offset * 0.01) * 15}px)`
        }}
      />
    </AbsoluteFill>
  );
};

// Features Section
const FeaturesSection: React.FC<{ features: string[]; fps: number }> = ({ features, fps }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: 80
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.text,
          marginBottom: 60,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        Fonctionnalités Clés
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 40,
          maxWidth: 1200
        }}
      >
        {features.map((feature, index) => {
          const delay = index * fps * 0.5;
          const featureFrame = frame - delay;

          const opacity = interpolate(featureFrame, [0, fps * 0.5], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          });

          const translateY = interpolate(featureFrame, [0, fps * 0.5], [30, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          });

          return (
            <div
              key={index}
              style={{
                background: `${COLORS.dark}CC`,
                borderRadius: 16,
                padding: 32,
                border: `1px solid ${COLORS.primary}40`,
                opacity,
                transform: `translateY(${translateY}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckIcon size={24} />
              </div>
              <span
                style={{
                  fontSize: 24,
                  color: COLORS.text,
                  fontWeight: 600,
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              >
                {feature}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// CTA Section
const CTASection: React.FC<{ fps: number; frame: number }> = ({ fps, frame }) => {
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: 'clamp'
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        opacity
      }}
    >
      <h2
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: COLORS.text,
          marginBottom: 24,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        Prêt à transformer votre service client ?
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 24,
          transform: `scale(${scale})`
        }}
      >
        <div
          style={{
            padding: '20px 48px',
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
            borderRadius: 16,
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.text,
            boxShadow: `0 0 40px ${COLORS.primary}60`,
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          Essai Gratuit
        </div>

        <div
          style={{
            padding: '20px 48px',
            background: 'transparent',
            border: `2px solid ${COLORS.primary}`,
            borderRadius: 16,
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.primary,
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          Voir la Démo
        </div>
      </div>

      <p
        style={{
          fontSize: 20,
          color: COLORS.textMuted,
          marginTop: 40,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        vocalia.ma
      </p>
    </AbsoluteFill>
  );
};

// Icon Components
const MicIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-4.07z" />
  </svg>
);

const CheckIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);
