/**
 * VocalIA Data Report Video Composition
 *
 * Animated monthly analytics report video.
 * Duration: 45 seconds
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

export const DATA_REPORT_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 45 // seconds
};

const COLORS = {
  primary: '#5E6AD2',
  primaryLight: '#818CF8',
  accent: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  dark: '#1E293B',
  darker: '#0F172A',
  text: '#FFFFFF',
  textMuted: '#94A3B8'
};

interface MetricData {
  label: string;
  value: number;
  unit: string;
  change: number;
  icon: string;
}

interface ChartData {
  label: string;
  value: number;
}

interface DataReportProps {
  reportTitle?: string;
  period?: string;
  metrics?: MetricData[];
  chartData?: ChartData[];
  language?: Language;
}

const DEFAULT_METRICS: Record<Language, MetricData[]> = {
  fr: [
    { label: 'Appels traités', value: 12847, unit: '', change: 23, icon: '📞' },
    { label: 'Taux de résolution', value: 94, unit: '%', change: 8, icon: '✅' },
    { label: 'Temps moyen', value: 2.3, unit: 'min', change: -15, icon: '⏱️' },
    { label: 'Satisfaction', value: 4.8, unit: '/5', change: 12, icon: '⭐' }
  ],
  en: [
    { label: 'Calls handled', value: 12847, unit: '', change: 23, icon: '📞' },
    { label: 'Resolution rate', value: 94, unit: '%', change: 8, icon: '✅' },
    { label: 'Average time', value: 2.3, unit: 'min', change: -15, icon: '⏱️' },
    { label: 'Satisfaction', value: 4.8, unit: '/5', change: 12, icon: '⭐' }
  ],
  es: [
    { label: 'Llamadas gestionadas', value: 12847, unit: '', change: 23, icon: '📞' },
    { label: 'Tasa de resolución', value: 94, unit: '%', change: 8, icon: '✅' },
    { label: 'Tiempo promedio', value: 2.3, unit: 'min', change: -15, icon: '⏱️' },
    { label: 'Satisfacción', value: 4.8, unit: '/5', change: 12, icon: '⭐' }
  ],
  ar: [
    { label: 'المكالمات المعالجة', value: 12847, unit: '', change: 23, icon: '📞' },
    { label: 'معدل الحل', value: 94, unit: '%', change: 8, icon: '✅' },
    { label: 'الوقت المتوسط', value: 2.3, unit: 'د', change: -15, icon: '⏱️' },
    { label: 'الرضا', value: 4.8, unit: '/5', change: 12, icon: '⭐' }
  ],
  ary: [
    { label: 'المكالمات اللي تعالجو', value: 12847, unit: '', change: 23, icon: '📞' },
    { label: 'نسبة الحل', value: 94, unit: '%', change: 8, icon: '✅' },
    { label: 'الوقت المتوسط', value: 2.3, unit: 'د', change: -15, icon: '⏱️' },
    { label: 'الرضا', value: 4.8, unit: '/5', change: 12, icon: '⭐' }
  ]
};

const DEFAULT_CHART_DATA: ChartData[] = [
  { label: 'Sem 1', value: 2800 },
  { label: 'Sem 2', value: 3200 },
  { label: 'Sem 3', value: 2900 },
  { label: 'Sem 4', value: 3947 }
];

const TITLES: Record<Language, { report: string; period: string }> = {
  fr: { report: 'Rapport Mensuel', period: 'Janvier 2026' },
  en: { report: 'Monthly Report', period: 'January 2026' },
  es: { report: 'Informe Mensual', period: 'Enero 2026' },
  ar: { report: 'التقرير الشهري', period: 'يناير 2026' },
  ary: { report: 'التقرير ديال الشهر', period: 'يناير 2026' }
};

export const DataReport: React.FC<DataReportProps> = ({
  reportTitle,
  period,
  metrics,
  chartData,
  language = 'fr'
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rtl = isRTL(language);

  const actualMetrics = metrics || DEFAULT_METRICS[language];
  const actualChartData = chartData || DEFAULT_CHART_DATA;
  const titles = TITLES[language];
  const title = reportTitle || titles.report;
  const actualPeriod = period || titles.period;

  const INTRO_DURATION = fps * 6;
  const METRICS_DURATION = fps * 18;
  const CHART_DURATION = fps * 15;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`,
        direction: rtl ? 'rtl' : 'ltr'
      }}
    >
      {/* Intro */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <IntroSection title={title} period={actualPeriod} fps={fps} />
      </Sequence>

      {/* Metrics Grid */}
      <Sequence from={INTRO_DURATION} durationInFrames={METRICS_DURATION}>
        <MetricsSection metrics={actualMetrics} fps={fps} rtl={rtl} language={language} />
      </Sequence>

      {/* Chart */}
      <Sequence from={INTRO_DURATION + METRICS_DURATION} durationInFrames={CHART_DURATION}>
        <ChartSection data={actualChartData} fps={fps} language={language} />
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

const IntroSection: React.FC<{ title: string; period: string; fps: number }> = ({ title, period, fps }) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, opacity: titleOpacity }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 15,
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          </svg>
        </div>
        <span style={{ fontSize: 32, fontWeight: 700, color: COLORS.primary, fontFamily: 'Inter, sans-serif' }}>VocalIA</span>
      </div>

      <h1
        style={{
          fontSize: 80,
          fontWeight: 800,
          color: COLORS.text,
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleY) * 30}px)`,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {title}
      </h1>

      <p style={{ fontSize: 36, color: COLORS.accent, marginTop: 16, opacity: titleOpacity, fontFamily: 'Inter, sans-serif' }}>
        {period}
      </p>
    </AbsoluteFill>
  );
};

const MetricsSection: React.FC<{
  metrics: MetricData[];
  fps: number;
  rtl: boolean;
  language: Language;
}> = ({ metrics, fps, rtl, language }) => {
  const frame = useCurrentFrame();
  const sectionTitle = language === 'en' ? 'Key Metrics' : language === 'es' ? 'Métricas Clave' : language === 'ar' || language === 'ary' ? 'المؤشرات الرئيسية' : 'Métriques Clés';

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: 80 }}>
      <h2 style={{ fontSize: 48, fontWeight: 700, color: COLORS.text, marginBottom: 60, fontFamily: 'Inter, sans-serif' }}>
        {sectionTitle}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 40, width: '100%', maxWidth: 1200 }}>
        {metrics.map((metric, index) => {
          const delay = index * fps * 0.4;
          const metricFrame = frame - delay;

          const opacity = interpolate(metricFrame, [0, fps * 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const scale = spring({ frame: Math.max(0, metricFrame), fps, config: { damping: 12, stiffness: 100 } });

          // Animate the number
          const valueProgress = interpolate(metricFrame, [fps * 0.3, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const displayValue = metric.value * valueProgress;

          return (
            <div
              key={index}
              style={{
                background: `${COLORS.dark}CC`,
                borderRadius: 20,
                padding: 32,
                border: `1px solid ${COLORS.primary}30`,
                opacity,
                transform: `scale(${scale})`,
                display: 'flex',
                alignItems: 'center',
                gap: 24
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 18,
                  background: `linear-gradient(135deg, ${COLORS.primary}20, ${COLORS.accent}20)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36
                }}
              >
                {metric.icon}
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 18, color: COLORS.textMuted, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
                  {metric.label}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
                    {metric.value >= 1000 ? Math.round(displayValue).toLocaleString() : displayValue.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 24, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
                    {metric.unit}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 8,
                    color: metric.change >= 0 ? COLORS.accent : COLORS.error
                  }}
                >
                  <span style={{ fontSize: 16, fontFamily: 'Inter, sans-serif' }}>
                    {metric.change >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ChartSection: React.FC<{ data: ChartData[]; fps: number; language: Language }> = ({ data, fps, language }) => {
  const frame = useCurrentFrame();
  const maxValue = Math.max(...data.map(d => d.value));
  const chartTitle = language === 'en' ? 'Weekly Trend' : language === 'es' ? 'Tendencia Semanal' : language === 'ar' || language === 'ary' ? 'الاتجاه الأسبوعي' : 'Tendance Hebdomadaire';

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: 100 }}>
      <h2 style={{ fontSize: 48, fontWeight: 700, color: COLORS.text, marginBottom: 60, fontFamily: 'Inter, sans-serif' }}>
        {chartTitle}
      </h2>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, height: 400 }}>
        {data.map((item, index) => {
          const delay = index * fps * 0.3;
          const barFrame = frame - delay;
          const heightProgress = interpolate(barFrame, [0, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const barHeight = (item.value / maxValue) * 300 * heightProgress;

          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 20, color: COLORS.text, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                {Math.round(item.value * heightProgress).toLocaleString()}
              </span>
              <div
                style={{
                  width: 80,
                  height: barHeight,
                  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%)`,
                  borderRadius: '12px 12px 0 0',
                  boxShadow: `0 0 30px ${COLORS.primary}30`
                }}
              />
              <span style={{ fontSize: 18, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
