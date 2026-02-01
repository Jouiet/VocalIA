/**
 * VocalIA Feature Showcase Video Composition
 *
 * A 45-second video showcasing individual features with animations.
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
export const FEATURE_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 45 // seconds
};

// VocalIA Brand Colors
const COLORS = {
  primary: '#5E6AD2',
  primaryLight: '#818CF8',
  accent: '#10B981',
  orange: '#F59E0B',
  red: '#EF4444',
  dark: '#1E293B',
  darker: '#0F172A',
  text: '#FFFFFF',
  textMuted: '#94A3B8'
};

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface FeatureShowcaseProps {
  features: Feature[];
}

export const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ features }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Each feature gets ~10 seconds
  const featureDuration = Math.floor(durationInFrames / (features.length + 1));

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`
      }}
    >
      {/* Animated background */}
      <AnimatedBackground frame={frame} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={featureDuration}>
        <IntroSection fps={fps} />
      </Sequence>

      {/* Feature slides */}
      {features.map((feature, index) => (
        <Sequence
          key={index}
          from={(index + 1) * featureDuration}
          durationInFrames={featureDuration}
        >
          <FeatureSlide
            feature={feature}
            index={index}
            fps={fps}
            color={[COLORS.primary, COLORS.accent, COLORS.orange, COLORS.red][index % 4]}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// Animated Background
const AnimatedBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = frame * 0.1;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.primary}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.primary}08 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: `perspective(500px) rotateX(60deg) translateY(${frame * 2}px)`,
          transformOrigin: 'top center'
        }}
      />

      {/* Floating orbs */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.primary}30 0%, transparent 70%)`,
          top: '10%',
          right: '10%',
          transform: `rotate(${rotation}deg) translateX(${Math.sin(frame * 0.02) * 30}px)`
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.accent}20 0%, transparent 70%)`,
          bottom: '15%',
          left: '5%',
          transform: `rotate(${-rotation}deg) translateY(${Math.cos(frame * 0.02) * 20}px)`
        }}
      />
    </AbsoluteFill>
  );
};

// Intro Section
const IntroSection: React.FC<{ fps: number }> = ({ fps }) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: 'clamp'
  });

  const titleY = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
      }}
    >
      <h1
        style={{
          fontSize: 80,
          fontWeight: 800,
          color: COLORS.text,
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleY) * 50}px)`,
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center'
        }}
      >
        Découvrez
        <br />
        <span
          style={{
            background: `linear-gradient(135deg, ${COLORS.primaryLight} 0%, ${COLORS.accent} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          VocalIA
        </span>
      </h1>
    </AbsoluteFill>
  );
};

// Feature Slide
const FeatureSlide: React.FC<{
  feature: Feature;
  index: number;
  fps: number;
  color: string;
}> = ({ feature, fps, color }) => {
  const frame = useCurrentFrame();

  // Icon animation
  const iconScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 80 }
  });

  // Title animation
  const titleOpacity = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const titleX = interpolate(frame, [fps * 0.3, fps * 0.8], [-50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Description animation
  const descOpacity = interpolate(frame, [fps * 0.8, fps * 1.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const descY = interpolate(frame, [fps * 0.8, fps * 1.3], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 80,
          maxWidth: 1400
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 40,
            background: `linear-gradient(135deg, ${color} 0%, ${color}80 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${iconScale})`,
            boxShadow: `0 0 80px ${color}40`,
            fontSize: 80
          }}
        >
          {feature.icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.text,
              marginBottom: 24,
              opacity: titleOpacity,
              transform: `translateX(${titleX}px)`,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {feature.title}
          </h2>

          <p
            style={{
              fontSize: 32,
              color: COLORS.textMuted,
              lineHeight: 1.5,
              opacity: descOpacity,
              transform: `translateY(${descY}px)`,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {feature.description}
          </p>

          {/* Accent line */}
          <div
            style={{
              width: interpolate(frame, [fps, fps * 2], [0, 200], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp'
              }),
              height: 4,
              background: color,
              borderRadius: 2,
              marginTop: 32
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
