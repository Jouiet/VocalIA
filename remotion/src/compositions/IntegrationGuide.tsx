/**
 * VocalIA Integration Guide Video Composition
 *
 * Per-integration tutorial video.
 * Duration: 40 seconds
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

export const INTEGRATION_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 40 // seconds
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

// Integration brand colors
const INTEGRATION_COLORS: Record<string, string> = {
  hubspot: '#FF7A59',
  shopify: '#96BF48',
  stripe: '#635BFF',
  calendly: '#006BFF',
  slack: '#4A154B',
  zendesk: '#03363D',
  pipedrive: '#017737',
  google: '#4285F4',
  zapier: '#FF4A00',
  make: '#6D00CC'
};

interface IntegrationStep {
  title: string;
  description: string;
  code?: string;
}

interface IntegrationGuideProps {
  integration?: string;
  integrationLogo?: string;
  title?: string;
  steps?: IntegrationStep[];
  language?: Language;
}

const INTEGRATIONS: Record<string, Record<Language, { title: string; steps: IntegrationStep[] }>> = {
  hubspot: {
    fr: {
      title: 'Intégrer HubSpot',
      steps: [
        { title: 'Connecter votre compte', description: 'OAuth 2.0 en un clic depuis le dashboard' },
        { title: 'Configurer le mapping', description: 'Associez les champs CRM aux données VocalIA' },
        { title: 'Activer la sync', description: 'Synchronisation bidirectionnelle automatique', code: 'vocalia.hubspot.enable({ sync: "bidirectional" })' },
        { title: 'Tester le flux', description: 'Vérifiez que les leads sont créés correctement' }
      ]
    },
    en: {
      title: 'Integrate HubSpot',
      steps: [
        { title: 'Connect your account', description: 'One-click OAuth 2.0 from the dashboard' },
        { title: 'Configure mapping', description: 'Map CRM fields to VocalIA data' },
        { title: 'Enable sync', description: 'Automatic bidirectional synchronization', code: 'vocalia.hubspot.enable({ sync: "bidirectional" })' },
        { title: 'Test the flow', description: 'Verify leads are created correctly' }
      ]
    },
    es: {
      title: 'Integrar HubSpot',
      steps: [
        { title: 'Conectar tu cuenta', description: 'OAuth 2.0 con un clic desde el dashboard' },
        { title: 'Configurar el mapeo', description: 'Asocia los campos CRM con los datos de VocalIA' },
        { title: 'Activar la sincronización', description: 'Sincronización bidireccional automática', code: 'vocalia.hubspot.enable({ sync: "bidirectional" })' },
        { title: 'Probar el flujo', description: 'Verifica que los leads se crean correctamente' }
      ]
    },
    ar: {
      title: 'ربط HubSpot',
      steps: [
        { title: 'ربط حسابك', description: 'OAuth 2.0 بنقرة واحدة من لوحة التحكم' },
        { title: 'تكوين التعيين', description: 'ربط حقول CRM ببيانات VocalIA' },
        { title: 'تفعيل المزامنة', description: 'مزامنة ثنائية الاتجاه تلقائية', code: 'vocalia.hubspot.enable({ sync: "bidirectional" })' },
        { title: 'اختبار التدفق', description: 'تحقق من إنشاء العملاء المحتملين بشكل صحيح' }
      ]
    },
    ary: {
      title: 'ربط HubSpot',
      steps: [
        { title: 'كونيكتي الكونط ديالك', description: 'OAuth 2.0 بكليك وحدة من الداشبورد' },
        { title: 'سيتي التعيين', description: 'ربط الحقول ديال CRM مع الداتا ديال VocalIA' },
        { title: 'فعّل المزامنة', description: 'مزامنة أوتوماتيكية ف الاتجاهين', code: 'vocalia.hubspot.enable({ sync: "bidirectional" })' },
        { title: 'جرب الفلو', description: 'تأكد أن الليدز كيتخلقو مزيان' }
      ]
    }
  },
  shopify: {
    fr: {
      title: 'Intégrer Shopify',
      steps: [
        { title: 'Installer l\'app', description: 'Depuis le Shopify App Store' },
        { title: 'Autoriser l\'accès', description: 'Permissions orders, products, customers' },
        { title: 'Configurer les triggers', description: 'Nouvelle commande, abandon panier, etc.', code: 'vocalia.shopify.onOrder(handleNewOrder)' },
        { title: 'Personnaliser le persona', description: 'Adaptez le ton à votre marque' }
      ]
    },
    en: {
      title: 'Integrate Shopify',
      steps: [
        { title: 'Install the app', description: 'From the Shopify App Store' },
        { title: 'Authorize access', description: 'Permissions for orders, products, customers' },
        { title: 'Configure triggers', description: 'New order, cart abandonment, etc.', code: 'vocalia.shopify.onOrder(handleNewOrder)' },
        { title: 'Customize the persona', description: 'Adapt the tone to your brand' }
      ]
    },
    es: {
      title: 'Integrar Shopify',
      steps: [
        { title: 'Instalar la app', description: 'Desde la Shopify App Store' },
        { title: 'Autorizar acceso', description: 'Permisos para pedidos, productos, clientes' },
        { title: 'Configurar triggers', description: 'Nuevo pedido, abandono de carrito, etc.', code: 'vocalia.shopify.onOrder(handleNewOrder)' },
        { title: 'Personalizar el persona', description: 'Adapta el tono a tu marca' }
      ]
    },
    ar: {
      title: 'ربط Shopify',
      steps: [
        { title: 'تثبيت التطبيق', description: 'من متجر تطبيقات Shopify' },
        { title: 'تفويض الوصول', description: 'أذونات للطلبات والمنتجات والعملاء' },
        { title: 'تكوين المحفزات', description: 'طلب جديد، ترك السلة، إلخ', code: 'vocalia.shopify.onOrder(handleNewOrder)' },
        { title: 'تخصيص الشخصية', description: 'كيّف النبرة مع علامتك التجارية' }
      ]
    },
    ary: {
      title: 'ربط Shopify',
      steps: [
        { title: 'نصّب الآب', description: 'من Shopify App Store' },
        { title: 'عطي الأوتوريزاسيون', description: 'البيرميسيون ديال الأوردرز والبروديكتس والزبناء' },
        { title: 'سيتي التريغرز', description: 'أوردر جديد، ترك البانيي، إلخ', code: 'vocalia.shopify.onOrder(handleNewOrder)' },
        { title: 'خصص الشخصية', description: 'أدابتي التون للبراند ديالك' }
      ]
    }
  },
  stripe: {
    fr: {
      title: 'Intégrer Stripe',
      steps: [
        { title: 'Ajouter la clé API', description: 'Clé secrète dans le dashboard VocalIA' },
        { title: 'Configurer les webhooks', description: 'Événements payment_intent, invoice, etc.' },
        { title: 'Activer les paiements vocaux', description: 'L\'agent peut envoyer des liens de paiement', code: 'vocalia.stripe.sendPaymentLink(amount, customer)' },
        { title: 'Tester en mode sandbox', description: 'Validez le flux avant la production' }
      ]
    },
    en: {
      title: 'Integrate Stripe',
      steps: [
        { title: 'Add API key', description: 'Secret key in VocalIA dashboard' },
        { title: 'Configure webhooks', description: 'Events: payment_intent, invoice, etc.' },
        { title: 'Enable voice payments', description: 'Agent can send payment links', code: 'vocalia.stripe.sendPaymentLink(amount, customer)' },
        { title: 'Test in sandbox mode', description: 'Validate the flow before production' }
      ]
    },
    es: {
      title: 'Integrar Stripe',
      steps: [
        { title: 'Agregar clave API', description: 'Clave secreta en el dashboard de VocalIA' },
        { title: 'Configurar webhooks', description: 'Eventos: payment_intent, invoice, etc.' },
        { title: 'Activar pagos por voz', description: 'El agente puede enviar enlaces de pago', code: 'vocalia.stripe.sendPaymentLink(amount, customer)' },
        { title: 'Probar en modo sandbox', description: 'Valida el flujo antes de producción' }
      ]
    },
    ar: {
      title: 'ربط Stripe',
      steps: [
        { title: 'إضافة مفتاح API', description: 'المفتاح السري في لوحة تحكم VocalIA' },
        { title: 'تكوين webhooks', description: 'الأحداث: payment_intent, invoice, إلخ' },
        { title: 'تفعيل الدفع الصوتي', description: 'الوكيل يمكنه إرسال روابط الدفع', code: 'vocalia.stripe.sendPaymentLink(amount, customer)' },
        { title: 'اختبار في وضع sandbox', description: 'تحقق من التدفق قبل الإنتاج' }
      ]
    },
    ary: {
      title: 'ربط Stripe',
      steps: [
        { title: 'زيد API key', description: 'الكلي السري ف داشبورد VocalIA' },
        { title: 'سيتي الويبهوكس', description: 'الإيفنتس: payment_intent, invoice, إلخ' },
        { title: 'فعّل الدفع بالصوت', description: 'الوكيل يقدر يصيفط لينكات الدفع', code: 'vocalia.stripe.sendPaymentLink(amount, customer)' },
        { title: 'جرب ف ساندبوكس', description: 'تأكد من الفلو قبل البروديكشن' }
      ]
    }
  }
};

export const IntegrationGuide: React.FC<IntegrationGuideProps> = ({
  integration = 'hubspot',
  integrationLogo,
  title,
  steps,
  language = 'fr'
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rtl = isRTL(language);

  const integrationData = INTEGRATIONS[integration]?.[language] || INTEGRATIONS.hubspot[language];
  const actualTitle = title || integrationData.title;
  const actualSteps = steps || integrationData.steps;
  const color = INTEGRATION_COLORS[integration] || COLORS.primary;

  const INTRO_DURATION = fps * 6;
  const STEP_DURATION = Math.floor((durationInFrames - INTRO_DURATION - fps * 4) / actualSteps.length);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darker} 0%, ${COLORS.dark} 100%)`,
        direction: rtl ? 'rtl' : 'ltr'
      }}
    >
      <AnimatedBackground frame={frame} color={color} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <IntroSection title={actualTitle} integration={integration} color={color} fps={fps} />
      </Sequence>

      {/* Steps */}
      {actualSteps.map((step, index) => (
        <Sequence
          key={index}
          from={INTRO_DURATION + index * STEP_DURATION}
          durationInFrames={STEP_DURATION}
        >
          <StepSection
            step={step}
            stepNumber={index + 1}
            totalSteps={actualSteps.length}
            fps={fps}
            rtl={rtl}
            color={color}
          />
        </Sequence>
      ))}

      {/* Outro */}
      <Sequence from={durationInFrames - fps * 4}>
        <OutroSection fps={fps} language={language} />
      </Sequence>
    </AbsoluteFill>
  );
};

const AnimatedBackground: React.FC<{ frame: number; color: string }> = ({ frame, color }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <div
      style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        top: -100,
        right: -100,
        transform: `translate(${Math.sin(frame * 0.01) * 20}px, ${Math.cos(frame * 0.01) * 20}px)`
      }}
    />
  </AbsoluteFill>
);

const IntroSection: React.FC<{ title: string; integration: string; color: string; fps: number }> = ({ title, integration, color, fps }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [fps * 0.5, fps * 1.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${scale})`
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          </svg>
        </div>
        <span style={{ fontSize: 40, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>+</span>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${scale})`,
            fontSize: 32,
            fontWeight: 700,
            color: 'white',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {integration.charAt(0).toUpperCase()}
        </div>
      </div>

      <h1 style={{ fontSize: 64, fontWeight: 800, color: COLORS.text, opacity: titleOpacity, fontFamily: 'Inter, sans-serif' }}>
        {title}
      </h1>
    </AbsoluteFill>
  );
};

const StepSection: React.FC<{
  step: IntegrationStep;
  stepNumber: number;
  totalSteps: number;
  fps: number;
  rtl: boolean;
  color: string;
}> = ({ step, stepNumber, totalSteps, fps, rtl, color }) => {
  const frame = useCurrentFrame();
  const contentOpacity = interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const contentY = interpolate(frame, [fps * 0.2, fps * 0.6], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 100 }}>
      {/* Progress */}
      <div style={{ position: 'absolute', top: 60, left: 100, right: 100, height: 6, background: `${COLORS.dark}`, borderRadius: 3 }}>
        <div style={{ width: `${(stepNumber / totalSteps) * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 60, maxWidth: 1400, flexDirection: rtl ? 'row-reverse' : 'row' }}>
        {/* Step number */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 25,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {stepNumber}
        </div>

        {/* Content */}
        <div style={{ flex: 1, opacity: contentOpacity, transform: `translateY(${contentY}px)` }}>
          <h2 style={{ fontSize: 48, fontWeight: 700, color: COLORS.text, marginBottom: 16, fontFamily: 'Inter, sans-serif' }}>
            {step.title}
          </h2>
          <p style={{ fontSize: 28, color: COLORS.textMuted, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
            {step.description}
          </p>

          {step.code && (
            <div
              style={{
                marginTop: 32,
                padding: 24,
                background: `${COLORS.darker}`,
                borderRadius: 12,
                border: `1px solid ${COLORS.primary}30`,
                fontFamily: 'monospace',
                fontSize: 20,
                color: COLORS.accent
              }}
            >
              {step.code}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 60, fontSize: 20, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
        Étape {stepNumber}/{totalSteps}
      </div>
    </AbsoluteFill>
  );
};

const OutroSection: React.FC<{ fps: number; language: Language }> = ({ fps, language }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' });

  const content = {
    fr: { title: 'Intégration terminée !', subtitle: 'Votre agent vocal est maintenant connecté' },
    en: { title: 'Integration complete!', subtitle: 'Your voice agent is now connected' },
    es: { title: '¡Integración completa!', subtitle: 'Tu agente de voz está ahora conectado' },
    ar: { title: 'اكتمل التكامل!', subtitle: 'وكيلك الصوتي متصل الآن' },
    ary: { title: 'التكامل كمل!', subtitle: 'الوكيل الصوتي ديالك متصل دابا' }
  };

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', opacity }}>
      <div style={{ fontSize: 80, marginBottom: 24 }}>✅</div>
      <h2 style={{ fontSize: 56, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
        {content[language].title}
      </h2>
      <p style={{ fontSize: 28, color: COLORS.textMuted, marginTop: 16, fontFamily: 'Inter, sans-serif' }}>
        {content[language].subtitle}
      </p>
    </AbsoluteFill>
  );
};
