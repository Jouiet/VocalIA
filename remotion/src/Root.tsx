/**
 * VocalIA Remotion Root
 *
 * Defines all video compositions available for rendering.
 * Session 250.43 - Added 5 new use-case compositions.
 */
import React from 'react';
import { Composition, Still } from 'remotion';
import { VocaliaDemo, DEMO_CONFIG } from './compositions/VocaliaDemo';
import { FeatureShowcase, FEATURE_CONFIG } from './compositions/FeatureShowcase';
import { Testimonial, TESTIMONIAL_CONFIG } from './compositions/Testimonial';
import { OnboardingVideo, ONBOARDING_CONFIG } from './compositions/OnboardingVideo';
import { DataReport, DATA_REPORT_CONFIG } from './compositions/DataReport';
import { SocialClip, SOCIAL_CLIP_CONFIG, SOCIAL_CLIP_VERTICAL, SOCIAL_CLIP_HORIZONTAL } from './compositions/SocialClip';
import { PricingExplainer, PRICING_CONFIG } from './compositions/PricingExplainer';
import { IntegrationGuide, INTEGRATION_CONFIG } from './compositions/IntegrationGuide';
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

      {/* === NEW USE-CASE COMPOSITIONS (Session 250.43) === */}

      {/* Onboarding Video - Default (FR) */}
      <Composition
        id="OnboardingVideo"
        component={OnboardingVideo}
        durationInFrames={ONBOARDING_CONFIG.duration * ONBOARDING_CONFIG.fps}
        fps={ONBOARDING_CONFIG.fps}
        width={ONBOARDING_CONFIG.width}
        height={ONBOARDING_CONFIG.height}
        defaultProps={{ language: 'fr' as Language }}
      />

      {/* Onboarding Video - Per Language */}
      {LANGUAGES.map((lang) => (
        <Composition
          key={`onboarding-${lang}`}
          id={`OnboardingVideo-${lang.toUpperCase()}`}
          component={OnboardingVideo}
          durationInFrames={ONBOARDING_CONFIG.duration * ONBOARDING_CONFIG.fps}
          fps={ONBOARDING_CONFIG.fps}
          width={ONBOARDING_CONFIG.width}
          height={ONBOARDING_CONFIG.height}
          defaultProps={{ language: lang }}
        />
      ))}

      {/* Data Report - Default (FR) */}
      <Composition
        id="DataReport"
        component={DataReport}
        durationInFrames={DATA_REPORT_CONFIG.duration * DATA_REPORT_CONFIG.fps}
        fps={DATA_REPORT_CONFIG.fps}
        width={DATA_REPORT_CONFIG.width}
        height={DATA_REPORT_CONFIG.height}
        defaultProps={{ language: 'fr' as Language }}
      />

      {/* Data Report - Per Language */}
      {LANGUAGES.map((lang) => (
        <Composition
          key={`datareport-${lang}`}
          id={`DataReport-${lang.toUpperCase()}`}
          component={DataReport}
          durationInFrames={DATA_REPORT_CONFIG.duration * DATA_REPORT_CONFIG.fps}
          fps={DATA_REPORT_CONFIG.fps}
          width={DATA_REPORT_CONFIG.width}
          height={DATA_REPORT_CONFIG.height}
          defaultProps={{ language: lang }}
        />
      ))}

      {/* Social Clip - Square (1:1) Default */}
      <Composition
        id="SocialClip"
        component={SocialClip}
        durationInFrames={SOCIAL_CLIP_CONFIG.duration * SOCIAL_CLIP_CONFIG.fps}
        fps={SOCIAL_CLIP_CONFIG.fps}
        width={SOCIAL_CLIP_CONFIG.width}
        height={SOCIAL_CLIP_CONFIG.height}
        defaultProps={{ type: 'stat', language: 'fr' as Language }}
      />

      {/* Social Clip - Square Per Language */}
      {LANGUAGES.map((lang) => (
        <Composition
          key={`social-square-${lang}`}
          id={`SocialClip-${lang.toUpperCase()}`}
          component={SocialClip}
          durationInFrames={SOCIAL_CLIP_CONFIG.duration * SOCIAL_CLIP_CONFIG.fps}
          fps={SOCIAL_CLIP_CONFIG.fps}
          width={SOCIAL_CLIP_CONFIG.width}
          height={SOCIAL_CLIP_CONFIG.height}
          defaultProps={{ type: 'stat', language: lang }}
        />
      ))}

      {/* Social Clip - Vertical (9:16 for Stories/Reels) */}
      <Composition
        id="SocialClip-Vertical"
        component={SocialClip}
        durationInFrames={SOCIAL_CLIP_CONFIG.duration * SOCIAL_CLIP_CONFIG.fps}
        fps={SOCIAL_CLIP_CONFIG.fps}
        width={SOCIAL_CLIP_VERTICAL.width}
        height={SOCIAL_CLIP_VERTICAL.height}
        defaultProps={{ type: 'stat', language: 'fr' as Language }}
      />

      {/* Social Clip - Horizontal (16:9 for YouTube) */}
      <Composition
        id="SocialClip-Horizontal"
        component={SocialClip}
        durationInFrames={SOCIAL_CLIP_CONFIG.duration * SOCIAL_CLIP_CONFIG.fps}
        fps={SOCIAL_CLIP_CONFIG.fps}
        width={SOCIAL_CLIP_HORIZONTAL.width}
        height={SOCIAL_CLIP_HORIZONTAL.height}
        defaultProps={{ type: 'stat', language: 'fr' as Language }}
      />

      {/* Pricing Explainer - Default (FR) */}
      <Composition
        id="PricingExplainer"
        component={PricingExplainer}
        durationInFrames={PRICING_CONFIG.duration * PRICING_CONFIG.fps}
        fps={PRICING_CONFIG.fps}
        width={PRICING_CONFIG.width}
        height={PRICING_CONFIG.height}
        defaultProps={{ language: 'fr' as Language }}
      />

      {/* Pricing Explainer - Per Language */}
      {LANGUAGES.map((lang) => (
        <Composition
          key={`pricing-${lang}`}
          id={`PricingExplainer-${lang.toUpperCase()}`}
          component={PricingExplainer}
          durationInFrames={PRICING_CONFIG.duration * PRICING_CONFIG.fps}
          fps={PRICING_CONFIG.fps}
          width={PRICING_CONFIG.width}
          height={PRICING_CONFIG.height}
          defaultProps={{ language: lang }}
        />
      ))}

      {/* Integration Guide - HubSpot (Default) */}
      <Composition
        id="IntegrationGuide-HubSpot"
        component={IntegrationGuide}
        durationInFrames={INTEGRATION_CONFIG.duration * INTEGRATION_CONFIG.fps}
        fps={INTEGRATION_CONFIG.fps}
        width={INTEGRATION_CONFIG.width}
        height={INTEGRATION_CONFIG.height}
        defaultProps={{ integration: 'hubspot', language: 'fr' as Language }}
      />

      {/* Integration Guide - Shopify */}
      <Composition
        id="IntegrationGuide-Shopify"
        component={IntegrationGuide}
        durationInFrames={INTEGRATION_CONFIG.duration * INTEGRATION_CONFIG.fps}
        fps={INTEGRATION_CONFIG.fps}
        width={INTEGRATION_CONFIG.width}
        height={INTEGRATION_CONFIG.height}
        defaultProps={{ integration: 'shopify', language: 'fr' as Language }}
      />

      {/* Integration Guide - Stripe */}
      <Composition
        id="IntegrationGuide-Stripe"
        component={IntegrationGuide}
        durationInFrames={INTEGRATION_CONFIG.duration * INTEGRATION_CONFIG.fps}
        fps={INTEGRATION_CONFIG.fps}
        width={INTEGRATION_CONFIG.width}
        height={INTEGRATION_CONFIG.height}
        defaultProps={{ integration: 'stripe', language: 'fr' as Language }}
      />

      {/* Integration Guides - Per Language (HubSpot example) */}
      {LANGUAGES.map((lang) => (
        <Composition
          key={`integration-hubspot-${lang}`}
          id={`IntegrationGuide-HubSpot-${lang.toUpperCase()}`}
          component={IntegrationGuide}
          durationInFrames={INTEGRATION_CONFIG.duration * INTEGRATION_CONFIG.fps}
          fps={INTEGRATION_CONFIG.fps}
          width={INTEGRATION_CONFIG.width}
          height={INTEGRATION_CONFIG.height}
          defaultProps={{ integration: 'hubspot', language: lang }}
        />
      ))}
    </>
  );
};
