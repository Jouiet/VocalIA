#!/usr/bin/env node
/**
 * VocalIA - Knowledge Base Provisioner
 * Session 250.97quinquies - Deep Surgery Fix
 *
 * Auto-provision per-tenant KB directories with initial data from tenant info.
 * Solves: Real tenants from Google Sheets have no /clients/{id}/knowledge_base/
 *
 * Version: 1.0.0 | 06/02/2026
 */

const fs = require('fs');
const path = require('path');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

// Paths
const CLIENTS_DIR = path.join(__dirname, '../clients');
const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'ar', 'ary'];

/**
 * Generate initial KB entries from tenant data
 * @param {Object} tenant - Tenant data from Google Sheets
 * @param {string} lang - Language code
 * @returns {Object} - KB structure
 */
function generateInitialKB(tenant, lang) {
  const businessName = tenant.business_name || tenant.name || tenant.company || 'Business';

  // Language-specific templates
  const templates = {
    fr: {
      business_info: {
        question: `Où se trouve ${businessName} ?`,
        response: tenant.address
          ? `${businessName} est situé au ${tenant.address}. ${tenant.phone ? `Vous pouvez nous joindre au ${tenant.phone}.` : ''}`
          : `Pour connaître notre adresse exacte, veuillez nous contacter.`,
        keywords: ['adresse', 'où', 'situé', 'localisation', 'trouver']
      },
      horaires: {
        question: `Quels sont vos horaires d'ouverture ?`,
        response: tenant.horaires
          ? `Nos horaires sont: ${tenant.horaires}`
          : `Pour connaître nos horaires, veuillez nous contacter.`,
        keywords: ['horaires', 'heures', 'ouvert', 'fermé', 'quand']
      },
      services: {
        question: `Quels services proposez-vous ?`,
        response: tenant.services
          ? `Nous proposons les services suivants: ${Array.isArray(tenant.services) ? tenant.services.join(', ') : tenant.services}`
          : `Nous offrons une gamme complète de services adaptés à vos besoins.`,
        keywords: ['services', 'proposez', 'offrez', 'faites']
      },
      contact: {
        question: `Comment vous contacter ?`,
        response: tenant.phone
          ? `Vous pouvez nous contacter au ${tenant.phone}${tenant.address ? ` ou nous rendre visite au ${tenant.address}` : ''}.`
          : `Pour nous contacter, veuillez utiliser le formulaire de contact.`,
        keywords: ['contact', 'joindre', 'appeler', 'téléphone', 'email']
      },
      payment: {
        question: `Quels modes de paiement acceptez-vous ?`,
        response: tenant.payment_method
          ? `Nous acceptons: ${tenant.payment_method}${tenant.payment_details ? `. ${tenant.payment_details}` : ''}`
          : `Nous acceptons plusieurs modes de paiement. Contactez-nous pour plus de détails.`,
        keywords: ['paiement', 'payer', 'carte', 'espèces', 'virement']
      },
      zones: {
        question: `Dans quelles zones intervenez-vous ?`,
        response: tenant.zones
          ? `Nous intervenons dans les zones suivantes: ${Array.isArray(tenant.zones) ? tenant.zones.join(', ') : tenant.zones}`
          : `Nous couvrons une large zone géographique. Contactez-nous pour vérifier votre secteur.`,
        keywords: ['zones', 'secteur', 'région', 'intervention', 'livraison']
      },
      booking: {
        question: `Comment prendre rendez-vous ?`,
        response: tenant.booking_url
          ? `Vous pouvez prendre rendez-vous directement en ligne : ${tenant.booking_url}${tenant.phone ? ` ou nous appeler au ${tenant.phone}.` : '.'}`
          : tenant.phone
            ? `Pour prendre rendez-vous, appelez-nous au ${tenant.phone}.`
            : `Veuillez nous contacter pour prendre rendez-vous.`,
        keywords: ['rendez-vous', 'rdv', 'réserver', 'booking', 'prendre rdv', 'disponibilité', 'créneau'],
        booking_url: tenant.booking_url || null,
        booking_phone: tenant.phone || null
      }
    },
    en: {
      business_info: {
        question: `Where is ${businessName} located?`,
        response: tenant.address
          ? `${businessName} is located at ${tenant.address}. ${tenant.phone ? `You can reach us at ${tenant.phone}.` : ''}`
          : `Please contact us for our exact address.`,
        keywords: ['address', 'where', 'located', 'location', 'find']
      },
      horaires: {
        question: `What are your opening hours?`,
        response: tenant.horaires
          ? `Our hours are: ${tenant.horaires}`
          : `Please contact us for our opening hours.`,
        keywords: ['hours', 'open', 'closed', 'when', 'schedule']
      },
      services: {
        question: `What services do you offer?`,
        response: tenant.services
          ? `We offer the following services: ${Array.isArray(tenant.services) ? tenant.services.join(', ') : tenant.services}`
          : `We offer a comprehensive range of services tailored to your needs.`,
        keywords: ['services', 'offer', 'provide', 'do']
      },
      contact: {
        question: `How can I contact you?`,
        response: tenant.phone
          ? `You can reach us at ${tenant.phone}${tenant.address ? ` or visit us at ${tenant.address}` : ''}.`
          : `Please use our contact form to reach us.`,
        keywords: ['contact', 'reach', 'call', 'phone', 'email']
      },
      payment: {
        question: `What payment methods do you accept?`,
        response: tenant.payment_method
          ? `We accept: ${tenant.payment_method}${tenant.payment_details ? `. ${tenant.payment_details}` : ''}`
          : `We accept multiple payment methods. Contact us for details.`,
        keywords: ['payment', 'pay', 'card', 'cash', 'transfer']
      },
      zones: {
        question: `What areas do you serve?`,
        response: tenant.zones
          ? `We serve the following areas: ${Array.isArray(tenant.zones) ? tenant.zones.join(', ') : tenant.zones}`
          : `We cover a wide geographic area. Contact us to check your location.`,
        keywords: ['areas', 'zones', 'region', 'delivery', 'service']
      },
      booking: {
        question: `How can I book an appointment?`,
        response: tenant.booking_url
          ? `You can book an appointment online: ${tenant.booking_url}${tenant.phone ? ` or call us at ${tenant.phone}.` : '.'}`
          : tenant.phone
            ? `To book an appointment, call us at ${tenant.phone}.`
            : `Please contact us to schedule an appointment.`,
        keywords: ['appointment', 'book', 'booking', 'schedule', 'reserve', 'availability', 'slot'],
        booking_url: tenant.booking_url || null,
        booking_phone: tenant.phone || null
      }
    },
    es: {
      business_info: {
        question: `¿Dónde se encuentra ${businessName}?`,
        response: tenant.address
          ? `${businessName} está ubicado en ${tenant.address}. ${tenant.phone ? `Puede contactarnos al ${tenant.phone}.` : ''}`
          : `Por favor contáctenos para nuestra dirección exacta.`,
        keywords: ['dirección', 'dónde', 'ubicado', 'ubicación', 'encontrar']
      },
      horaires: {
        question: `¿Cuáles son sus horarios de apertura?`,
        response: tenant.horaires
          ? `Nuestros horarios son: ${tenant.horaires}`
          : `Por favor contáctenos para nuestros horarios.`,
        keywords: ['horarios', 'horas', 'abierto', 'cerrado', 'cuándo']
      },
      services: {
        question: `¿Qué servicios ofrecen?`,
        response: tenant.services
          ? `Ofrecemos los siguientes servicios: ${Array.isArray(tenant.services) ? tenant.services.join(', ') : tenant.services}`
          : `Ofrecemos una gama completa de servicios adaptados a sus necesidades.`,
        keywords: ['servicios', 'ofrecen', 'proporcionan', 'hacen']
      },
      contact: {
        question: `¿Cómo puedo contactarles?`,
        response: tenant.phone
          ? `Puede contactarnos al ${tenant.phone}${tenant.address ? ` o visitarnos en ${tenant.address}` : ''}.`
          : `Por favor use nuestro formulario de contacto.`,
        keywords: ['contacto', 'contactar', 'llamar', 'teléfono', 'email']
      },
      payment: {
        question: `¿Qué métodos de pago aceptan?`,
        response: tenant.payment_method
          ? `Aceptamos: ${tenant.payment_method}${tenant.payment_details ? `. ${tenant.payment_details}` : ''}`
          : `Aceptamos múltiples métodos de pago. Contáctenos para más detalles.`,
        keywords: ['pago', 'pagar', 'tarjeta', 'efectivo', 'transferencia']
      },
      zones: {
        question: `¿En qué zonas trabajan?`,
        response: tenant.zones
          ? `Trabajamos en las siguientes zonas: ${Array.isArray(tenant.zones) ? tenant.zones.join(', ') : tenant.zones}`
          : `Cubrimos una amplia zona geográfica. Contáctenos para verificar su sector.`,
        keywords: ['zonas', 'sector', 'región', 'entrega', 'servicio']
      },
      booking: {
        question: `¿Cómo puedo reservar una cita?`,
        response: tenant.booking_url
          ? `Puede reservar una cita en línea: ${tenant.booking_url}${tenant.phone ? ` o llámenos al ${tenant.phone}.` : '.'}`
          : tenant.phone
            ? `Para reservar una cita, llámenos al ${tenant.phone}.`
            : `Por favor contáctenos para programar una cita.`,
        keywords: ['cita', 'reservar', 'reserva', 'programar', 'disponibilidad', 'horario'],
        booking_url: tenant.booking_url || null,
        booking_phone: tenant.phone || null
      }
    },
    ar: {
      business_info: {
        question: `أين يقع ${businessName}؟`,
        response: tenant.address
          ? `يقع ${businessName} في ${tenant.address}. ${tenant.phone ? `يمكنك الاتصال بنا على ${tenant.phone}.` : ''}`
          : `يرجى التواصل معنا للحصول على عنواننا الدقيق.`,
        keywords: ['عنوان', 'أين', 'موقع', 'مكان', 'أجد']
      },
      horaires: {
        question: `ما هي ساعات العمل؟`,
        response: tenant.horaires
          ? `ساعات العمل لدينا: ${tenant.horaires}`
          : `يرجى التواصل معنا للحصول على ساعات العمل.`,
        keywords: ['ساعات', 'أوقات', 'مفتوح', 'مغلق', 'متى']
      },
      services: {
        question: `ما الخدمات التي تقدمونها؟`,
        response: tenant.services
          ? `نقدم الخدمات التالية: ${Array.isArray(tenant.services) ? tenant.services.join('، ') : tenant.services}`
          : `نقدم مجموعة شاملة من الخدمات المصممة لاحتياجاتك.`,
        keywords: ['خدمات', 'تقدمون', 'توفرون', 'تفعلون']
      },
      contact: {
        question: `كيف يمكنني التواصل معكم؟`,
        response: tenant.phone
          ? `يمكنك التواصل معنا على ${tenant.phone}${tenant.address ? ` أو زيارتنا في ${tenant.address}` : ''}.`
          : `يرجى استخدام نموذج الاتصال للتواصل معنا.`,
        keywords: ['اتصال', 'تواصل', 'هاتف', 'بريد']
      },
      payment: {
        question: `ما طرق الدفع المقبولة؟`,
        response: tenant.payment_method
          ? `نقبل: ${tenant.payment_method}${tenant.payment_details ? `. ${tenant.payment_details}` : ''}`
          : `نقبل طرق دفع متعددة. تواصل معنا للتفاصيل.`,
        keywords: ['دفع', 'يدفع', 'بطاقة', 'نقد', 'تحويل']
      },
      zones: {
        question: `ما المناطق التي تخدمونها؟`,
        response: tenant.zones
          ? `نخدم المناطق التالية: ${Array.isArray(tenant.zones) ? tenant.zones.join('، ') : tenant.zones}`
          : `نغطي منطقة جغرافية واسعة. تواصل معنا للتحقق من موقعك.`,
        keywords: ['مناطق', 'قطاع', 'منطقة', 'توصيل', 'خدمة']
      },
      booking: {
        question: `كيف يمكنني حجز موعد؟`,
        response: tenant.booking_url
          ? `يمكنك حجز موعد عبر الإنترنت: ${tenant.booking_url}${tenant.phone ? ` أو اتصل بنا على ${tenant.phone}.` : '.'}`
          : tenant.phone
            ? `لحجز موعد، اتصل بنا على ${tenant.phone}.`
            : `يرجى التواصل معنا لحجز موعد.`,
        keywords: ['موعد', 'حجز', 'احجز', 'متاح', 'وقت', 'جدول'],
        booking_url: tenant.booking_url || null,
        booking_phone: tenant.phone || null
      }
    },
    ary: {
      business_info: {
        question: `فين كاين ${businessName}؟`,
        response: tenant.address
          ? `${businessName} كاين ف ${tenant.address}. ${tenant.phone ? `تقدر تتصل بينا على ${tenant.phone}.` : ''}`
          : `تواصل معانا باش تعرف العنوان ديالنا.`,
        keywords: ['عنوان', 'فين', 'كاين', 'مكان', 'نلقى']
      },
      horaires: {
        question: `شنو هي أوقات العمل ديالكم؟`,
        response: tenant.horaires
          ? `أوقات العمل ديالنا: ${tenant.horaires}`
          : `تواصل معانا باش تعرف أوقات العمل.`,
        keywords: ['أوقات', 'ساعات', 'مفتوح', 'مسدود', 'إمتى']
      },
      services: {
        question: `شنو الخدمات لي كتقدمو؟`,
        response: tenant.services
          ? `كنقدمو الخدمات التالية: ${Array.isArray(tenant.services) ? tenant.services.join('، ') : tenant.services}`
          : `كنقدمو بزاف ديال الخدمات لي كتناسب الحاجيات ديالك.`,
        keywords: ['خدمات', 'كتقدمو', 'كتديرو', 'عندكم']
      },
      contact: {
        question: `كيفاش نقدر نتواصل معاكم؟`,
        response: tenant.phone
          ? `تقدر تتصل بينا على ${tenant.phone}${tenant.address ? ` ولا تجينا ف ${tenant.address}` : ''}.`
          : `استعمل الفورميلير ديال الاتصال باش تتواصل معانا.`,
        keywords: ['اتصال', 'تواصل', 'عيط', 'تيليفون']
      },
      payment: {
        question: `شنو طرق الخلاص لي كتقبلو؟`,
        response: tenant.payment_method
          ? `كنقبلو: ${tenant.payment_method}${tenant.payment_details ? `. ${tenant.payment_details}` : ''}`
          : `كنقبلو بزاف ديال طرق الخلاص. تواصل معانا باش تعرف أكثر.`,
        keywords: ['خلاص', 'يخلص', 'كارطة', 'كاش', 'فيرمون']
      },
      zones: {
        question: `فين كتخدمو؟`,
        response: tenant.zones
          ? `كنخدمو ف: ${Array.isArray(tenant.zones) ? tenant.zones.join('، ') : tenant.zones}`
          : `كنغطيو منطقة كبيرة. تواصل معانا باش تشوف واش كنوصلو ليك.`,
        keywords: ['مناطق', 'فين', 'منطقة', 'توصيل', 'خدمة']
      },
      booking: {
        question: `كيفاش ناخد موعد؟`,
        response: tenant.booking_url
          ? `تقدر تاخد موعد أونلاين: ${tenant.booking_url}${tenant.phone ? ` ولا عيط لينا على ${tenant.phone}.` : '.'}`
          : tenant.phone
            ? `باش تاخد موعد، عيط لينا على ${tenant.phone}.`
            : `تواصل معانا باش تاخد موعد.`,
        keywords: ['موعد', 'حجز', 'نحجز', 'وقت', 'كريني', 'ردفو'],
        booking_url: tenant.booking_url || null,
        booking_phone: tenant.phone || null
      }
    }
  };

  const langTemplate = templates[lang] || templates.fr;

  // Build KB object
  const kb = {
    __meta: {
      tenant_id: tenant.id,
      business_name: businessName,
      language: lang,
      created_at: new Date().toISOString(),
      auto_generated: true,
      version: '1.0.0'
    }
  };

  // Add entries based on available tenant data
  for (const [key, entry] of Object.entries(langTemplate)) {
    // Only add entries where we have relevant data
    const relevantFields = {
      business_info: tenant.address || tenant.phone,
      horaires: tenant.horaires,
      services: tenant.services,
      contact: tenant.phone || tenant.address,
      payment: tenant.payment_method,
      zones: tenant.zones,
      booking: tenant.booking_url || tenant.phone
    };

    // Always add with at least a generic response
    kb[key] = entry;
  }

  return kb;
}

/**
 * Provision KB directory for a tenant
 * @param {Object} tenant - Tenant data
 * @param {Object} options - Options (languages, overwrite)
 * @returns {Object} - Result {success, created, errors}
 */
function provisionKB(tenant, options = {}) {
  const tenantId = tenant.id;
  const languages = options.languages || SUPPORTED_LANGUAGES;
  const overwrite = options.overwrite === true;

  const safeTenantId = sanitizeTenantId(tenantId);
  const kbDir = path.join(CLIENTS_DIR, safeTenantId, 'knowledge_base');
  const result = {
    success: true,
    tenant_id: tenantId,
    created: [],
    skipped: [],
    errors: []
  };

  // Create directory structure
  try {
    if (!fs.existsSync(path.join(CLIENTS_DIR, safeTenantId))) {
      fs.mkdirSync(path.join(CLIENTS_DIR, safeTenantId), { recursive: true });
      console.log(`[KBProvisioner] Created client directory: ${tenantId}`);
    }
    if (!fs.existsSync(kbDir)) {
      fs.mkdirSync(kbDir, { recursive: true });
      console.log(`[KBProvisioner] Created KB directory: ${tenantId}`);
    }
  } catch (e) {
    result.success = false;
    result.errors.push(`Failed to create directory: ${e.message}`);
    return result;
  }

  // Create config.json if not exists
  const configPath = path.join(CLIENTS_DIR, safeTenantId, 'config.json');
  if (!fs.existsSync(configPath)) {
    const hasBooking = !!(tenant.booking_url || tenant.phone);
    if (!tenant.booking_url && !tenant.phone) {
      console.warn(`[KBProvisioner] ⚠️ Tenant ${tenantId} has no booking_url nor phone - booking CTA will be disabled`);
    }
    const config = {
      tenant_id: tenantId,
      business_name: tenant.business_name || tenant.name || tenantId,
      plan: tenant.plan || 'starter',
      language: tenant.language || 'fr',
      booking_url: tenant.booking_url || null,
      booking_phone: tenant.phone || null,
      widget_features: {
        social_proof_enabled: true,
        booking_enabled: hasBooking,
        exit_intent_enabled: true
      },
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`[KBProvisioner] Created config.json for ${tenantId}`);
  }

  // Generate KB for each language
  for (const lang of languages) {
    const kbFile = path.join(kbDir, `kb_${lang}.json`);

    if (fs.existsSync(kbFile) && !overwrite) {
      result.skipped.push(lang);
      continue;
    }

    try {
      const kb = generateInitialKB(tenant, lang);
      fs.writeFileSync(kbFile, JSON.stringify(kb, null, 2));
      result.created.push(lang);
      console.log(`[KBProvisioner] Created KB: ${tenantId}/kb_${lang}.json`);
    } catch (e) {
      result.errors.push(`Failed to create kb_${lang}.json: ${e.message}`);
    }
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * Provision KBs for all tenants from Google Sheets
 * @param {Object} options - Options (overwrite, dryRun)
 * @returns {Object} - Summary {total, provisioned, skipped, errors}
 */
async function provisionAllTenants(options = {}) {
  const dryRun = options.dryRun === true;
  const overwrite = options.overwrite === true;

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  KB PROVISIONER - Multi-Tenant Knowledge Base Setup');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Overwrite existing: ${overwrite}`);
  console.log();

  const summary = {
    total: 0,
    provisioned: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  try {
    // Load Google Sheets DB
    const { getDB } = require('./GoogleSheetsDB.cjs');
    const db = getDB();
    const tenants = await db.find('tenants', {});

    summary.total = tenants.length;
    console.log(`Found ${tenants.length} tenants in database\n`);

    for (const tenant of tenants) {
      console.log(`Processing: ${tenant.id} (${tenant.business_name || tenant.name || 'Unknown'})...`);

      if (dryRun) {
        const kbDir = path.join(CLIENTS_DIR, sanitizeTenantId(tenant.id), 'knowledge_base');
        const exists = fs.existsSync(kbDir);
        console.log(`  Would ${exists && !overwrite ? 'SKIP (exists)' : 'CREATE'}`);
        summary.details.push({
          id: tenant.id,
          action: exists && !overwrite ? 'would_skip' : 'would_create'
        });
        continue;
      }

      const result = provisionKB(tenant, { overwrite });

      if (result.success && result.created.length > 0) {
        summary.provisioned++;
        console.log(`  ✅ Created: ${result.created.join(', ')}`);
      } else if (result.skipped.length === SUPPORTED_LANGUAGES.length) {
        summary.skipped++;
        console.log(`  ⏭️ Skipped (already exists)`);
      } else {
        summary.errors.push({ id: tenant.id, errors: result.errors });
        console.log(`  ❌ Errors: ${result.errors.join(', ')}`);
      }

      summary.details.push({
        id: tenant.id,
        result
      });
    }

  } catch (e) {
    console.error(`\n❌ Fatal error: ${e.message}`);
    summary.errors.push({ fatal: e.message });
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total tenants: ${summary.total}`);
  console.log(`Provisioned: ${summary.provisioned}`);
  console.log(`Skipped (existing): ${summary.skipped}`);
  console.log(`Errors: ${summary.errors.length}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  return summary;
}

/**
 * Hook for db-api.cjs - Call after tenant creation
 * @param {Object} tenant - Created tenant data
 */
async function onTenantCreated(tenant) {
  console.log(`[KBProvisioner] Auto-provisioning KB for new tenant: ${tenant.id}`);
  const result = provisionKB(tenant, { overwrite: false });
  if (result.success) {
    console.log(`[KBProvisioner] ✅ KB provisioned for ${tenant.id}: ${result.created.join(', ')}`);
  } else {
    console.error(`[KBProvisioner] ❌ KB provisioning failed for ${tenant.id}: ${result.errors.join(', ')}`);
  }
  return result;
}

// Export for use in db-api.cjs and scripts
module.exports = {
  provisionKB,
  provisionAllTenants,
  onTenantCreated,
  generateInitialKB,
  SUPPORTED_LANGUAGES
};

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const overwrite = args.includes('--overwrite');

  if (args.includes('--help')) {
    console.log(`
Usage: node kb-provisioner.cjs [options]

Options:
  --dry-run     Show what would be done without making changes
  --overwrite   Overwrite existing KB files
  --help        Show this help

Examples:
  node kb-provisioner.cjs --dry-run      # Preview changes
  node kb-provisioner.cjs                # Provision missing KBs
  node kb-provisioner.cjs --overwrite    # Regenerate all KBs
`);
    process.exit(0);
  }

  provisionAllTenants({ dryRun, overwrite })
    .then(summary => {
      process.exit(summary.errors.length > 0 ? 1 : 0);
    })
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}
