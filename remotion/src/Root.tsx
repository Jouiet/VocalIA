/**
 * VocalIA Remotion Root
 *
 * Defines all video compositions available for rendering.
 */
import React from 'react';
import { Composition, Still } from 'remotion';
import { VocaliaDemo, DEMO_CONFIG } from './compositions/VocaliaDemo';
import { FeatureShowcase, FEATURE_CONFIG } from './compositions/FeatureShowcase';
import { Testimonial, TESTIMONIAL_CONFIG } from './compositions/Testimonial';

export const Root: React.FC = () => {
  return (
    <>
      {/* Main Demo Video - 30 seconds */}
      <Composition
        id="VocaliaDemo"
        component={VocaliaDemo}
        durationInFrames={DEMO_CONFIG.duration * DEMO_CONFIG.fps}
        fps={DEMO_CONFIG.fps}
        width={DEMO_CONFIG.width}
        height={DEMO_CONFIG.height}
        defaultProps={{
          title: 'VocalIA',
          subtitle: 'Agents Vocaux IA pour Entreprises',
          features: [
            '40 Personas SOTA',
            '5 Langues + Darija',
            '182 MCP Tools',
            '28 Intégrations'
          ]
        }}
      />

      {/* Feature Showcase - 45 seconds */}
      <Composition
        id="FeatureShowcase"
        component={FeatureShowcase}
        durationInFrames={FEATURE_CONFIG.duration * FEATURE_CONFIG.fps}
        fps={FEATURE_CONFIG.fps}
        width={FEATURE_CONFIG.width}
        height={FEATURE_CONFIG.height}
        defaultProps={{
          features: [
            {
              title: 'Voice Widget',
              description: 'Intégration web en 2 lignes de code',
              icon: '🎙️'
            },
            {
              title: 'Voice Telephony',
              description: 'Bridge PSTN ↔ AI pour appels entrants',
              icon: '📞'
            },
            {
              title: 'Multi-Persona',
              description: '40 personas métier pré-configurés',
              icon: '🎭'
            },
            {
              title: 'Multilingue',
              description: 'FR, EN, ES, AR, Darija natif',
              icon: '🌍'
            }
          ]
        }}
      />

      {/* Testimonial Video - 20 seconds */}
      <Composition
        id="Testimonial"
        component={Testimonial}
        durationInFrames={TESTIMONIAL_CONFIG.duration * TESTIMONIAL_CONFIG.fps}
        fps={TESTIMONIAL_CONFIG.fps}
        width={TESTIMONIAL_CONFIG.width}
        height={TESTIMONIAL_CONFIG.height}
        defaultProps={{
          quote: 'VocalIA a réduit nos coûts support de 60% tout en améliorant la satisfaction client.',
          author: 'Clinique Amal',
          role: 'Directeur Opérations',
          metric: '-60%',
          metricLabel: 'Coûts Support'
        }}
      />

      {/* Thumbnail Still */}
      <Still
        id="Thumbnail"
        component={VocaliaDemo}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'VocalIA',
          subtitle: 'Agents Vocaux IA',
          features: ['Voice AI', 'Multilingue', '40 Personas']
        }}
      />
    </>
  );
};
