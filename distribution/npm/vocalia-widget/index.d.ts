export interface VocaliaConfig {
  tenantId: string;
  apiKey?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  buttonSize?: number;
  language?: 'auto' | 'fr' | 'en' | 'es' | 'ar' | 'ary';
  persona?: string;
  ecommerceMode?: boolean;
  showOnMobile?: boolean;
}

export function initVocalia(config: VocaliaConfig): void;
export function initVocaliaB2B(config: VocaliaConfig): void;
export function initVocaliaEcommerce(config: VocaliaConfig): void;
