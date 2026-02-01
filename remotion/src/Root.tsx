/**
 * VocalIA Remotion Root
 *
 * Defines all video compositions available for rendering.
 * Session 250.42 - Optimized with multi-language support.
 */
import React from 'react';
import { Composition, Still } from 'remotion';
import { VocaliaDemo, DEMO_CONFIG } from './compositions/VocaliaDemo';
import { FeatureShowcase, FEATURE_CONFIG } from './compositions/FeatureShowcase';
import { Testimonial, TESTIMONIAL_CONFIG } from './compositions/Testimonial';
import {
  DEMO_CONTENT,
  FEATURE_CONTENT,
  TESTIMONIAL_CONTENT,
  VOCALIA_METRICS,
  type Language
} from './config/i18n';

// All supported languages
const LANGUAGES: Language[] = ['fr', 'en', 'es', 'ar', 'ary'];

export const Root: React.FC = () => {
  return (
    <>
      {/* === FRENCH (Default) === */}
      <Composition
        id="VocaliaDemo"
        component={VocaliaDemo}
        durationInFrames={DEMO_CONFIG.duration * DEMO_CONFIG.fps}
        fps={DEMO_CONFIG.fps}
        width={DEMO_CONFIG.width}
        height={DEMO_CONFIG.height}
        defaultProps={{
          ...DEMO_CONTENT.fr,
          language: 'fr' as Language
        }}
      />

      <Composition
        id="FeatureShowcase"
        component={FeatureShowcase}
        durationInFrames={FEATURE_CONFIG.duration * FEATURE_CONFIG.fps}
        fps={FEATURE_CONFIG.fps}
        width={FEATURE_CONFIG.width}
        height={FEATURE_CONFIG.height}
        defaultProps={{
          ...FEATURE_CONTENT.fr,
          language: 'fr' as Language
        }}
      />

      <Composition
        id="Testimonial"
        component={Testimonial}
        durationInFrames={TESTIMONIAL_CONFIG.duration * TESTIMONIAL_CONFIG.fps}
        fps={TESTIMONIAL_CONFIG.fps}
        width={TESTIMONIAL_CONFIG.width}
        height={TESTIMONIAL_CONFIG.height}
        defaultProps={{
          ...TESTIMONIAL_CONTENT.fr,
          language: 'fr' as Language
        }}
      />

      {/* === MULTI-LANGUAGE COMPOSITIONS === */}
      {LANGUAGES.map((lang) => (
        <React.Fragment key={lang}>
          {/* Demo - per language */}
          <Composition
            id={`VocaliaDemo-${lang.toUpperCase()}`}
            component={VocaliaDemo}
            durationInFrames={DEMO_CONFIG.duration * DEMO_CONFIG.fps}
            fps={DEMO_CONFIG.fps}
            width={DEMO_CONFIG.width}
            height={DEMO_CONFIG.height}
            defaultProps={{
              ...DEMO_CONTENT[lang],
              language: lang
            }}
          />

          {/* Features - per language */}
          <Composition
            id={`FeatureShowcase-${lang.toUpperCase()}`}
            component={FeatureShowcase}
            durationInFrames={FEATURE_CONFIG.duration * FEATURE_CONFIG.fps}
            fps={FEATURE_CONFIG.fps}
            width={FEATURE_CONFIG.width}
            height={FEATURE_CONFIG.height}
            defaultProps={{
              ...FEATURE_CONTENT[lang],
              language: lang
            }}
          />

          {/* Testimonial - per language */}
          <Composition
            id={`Testimonial-${lang.toUpperCase()}`}
            component={Testimonial}
            durationInFrames={TESTIMONIAL_CONFIG.duration * TESTIMONIAL_CONFIG.fps}
            fps={TESTIMONIAL_CONFIG.fps}
            width={TESTIMONIAL_CONFIG.width}
            height={TESTIMONIAL_CONFIG.height}
            defaultProps={{
              ...TESTIMONIAL_CONTENT[lang],
              language: lang
            }}
          />
        </React.Fragment>
      ))}

      {/* === THUMBNAILS === */}
      <Still
        id="Thumbnail"
        component={VocaliaDemo}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'VocalIA',
          subtitle: 'Voice AI Platform',
          features: [
            `${VOCALIA_METRICS.personas} Personas`,
            `${VOCALIA_METRICS.languages} Languages`,
            `${VOCALIA_METRICS.mcpTools} Tools`
          ],
          language: 'en' as Language
        }}
      />

      {/* Thumbnail per language */}
      {LANGUAGES.map((lang) => (
        <Still
          key={`thumb-${lang}`}
          id={`Thumbnail-${lang.toUpperCase()}`}
          component={VocaliaDemo}
          width={1920}
          height={1080}
          defaultProps={{
            ...DEMO_CONTENT[lang],
            language: lang
          }}
        />
      ))}
    </>
  );
};
