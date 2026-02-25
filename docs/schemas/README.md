# VocalIA Catalog Schemas

> Version: 1.0.0 | Session 250.63 | 03/02/2026

## Overview

JSON Schema definitions for VocalIA Dynamic Catalog system. All schemas follow JSON Schema Draft 2020-12 specification.

## Schemas

| Schema | File | Personas | Description |
|:-------|:-----|:---------|:------------|
| **Product** | `vocalia-catalog-product-v1.json` | universal_ecom, retailer, grocery, producer | E-commerce products with variants, stock, pricing |
| **Menu** | `vocalia-catalog-menu-v1.json` | restaurateur, bakery | Restaurant/bakery menus with allergens, dietary info |
| **Services** | `vocalia-catalog-services-v1.json` | stylist, healer, dental, gym, spa, planner, notary, architect | Services with appointment slots and providers |
| **Fleet** | `vocalia-catalog-fleet-v1.json` | renter | Vehicle rental fleet with availability, locations |
| **Trips** | `vocalia-catalog-trips-v1.json` | travel_agent, concierge | Travel packages with itineraries, departures |

## Usage

### Validation Example (Node.js)

```javascript
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv();
addFormats(ajv);

const productSchema = require('./vocalia-catalog-product-v1.json');
const validate = ajv.compile(productSchema);

const catalog = {
  "$schema": "vocalia-catalog-product-v1",
  "tenant_id": "client_xyz",
  "last_sync": "2026-02-03T10:00:00Z",
  "products": [...]
};

if (validate(catalog)) {
  console.log('✅ Catalog valid');
} else {
  console.error('❌ Validation errors:', validate.errors);
}
```

### Voice Description Guidelines

All schemas include `voice_description` fields optimized for TTS:

1. **Keep concise**: 15-30 words max
2. **Include key info**: Name, price, availability
3. **Use natural language**: "à 29,99 euros" not "29.99 EUR"
4. **Spell numbers**: "5 places" not "5pl"
5. **Avoid abbreviations**: "automatique" not "auto"

## Schema Versioning

- Current version: `v1`
- Breaking changes increment major version
- Backward-compatible additions are allowed within same version

## Persona Coverage

| Tier | Personas | Schema |
|:-----|:---------|:-------|
| **CRITICAL** (10) | universal_ecom, retailer, grocery, producer | Product |
| **CRITICAL** (10) | restaurateur, bakery | Menu |
| **MEDIUM** (10) | stylist, healer, dental, gym, spa | Services |
| **MEDIUM** (10) | renter | Fleet |
| **MEDIUM** (10) | travel_agent, concierge | Trips |

**Total Coverage**: 23/40 personas (58%)

## Related Files

- `core/catalog-connector.cjs` - Connector implementations
- `core/tenant-catalog-store.cjs` - Centralized store with LRU cache
- `data/catalogs/` - Sample catalog data
- `docs/DYNAMIC-CATALOG-CAPABILITY-ANALYSIS.md` - Full analysis

---

*Created: Session 250.63 | VocalIA v6.71.0*
