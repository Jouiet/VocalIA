# Contributing to VocalIA

## Prerequisites

- Node.js 20+
- Python 3.x (for i18n scripts)
- npm

## Setup

```bash
git clone https://github.com/Jouiet/VoicalAI.git
cd VoicalAI
npm install
cp .env.example .env  # Configure API keys
```

## Development

```bash
# Start Voice API
node core/voice-api-resilient.cjs --server --port=3004

# Start DB API
node core/db-api.cjs

# Serve website
npx serve website -l 8080

# Run tests
npm test

# Run i18n validation
python3 scripts/translation-quality-check.py
python3 scripts/darija-validator.py
```

## Code Standards

- **Format**: CommonJS (.cjs), 2 spaces, single quotes
- **Credentials**: Always via `process.env.*`, never hardcoded
- **Logging**: `console.error('...')` for errors, `console.log('...')` for success
- **Languages**: All user-facing text must support 5 languages (FR, EN, ES, AR, ARY)
- **Security**: No `innerHTML` with dynamic data. Use `textContent` or `escapeHTML()`

## Branch Strategy

- `main` — Production (auto-deploys website via FTP)
- `develop` — Staging integration
- Feature branches: `feature/<name>`

## Testing

```bash
# Unit tests
npm test

# Multi-tenant exhaustive
node --test test/exhaustive-multi-tenant-test.cjs

# i18n regression
python3 scripts/sync-locales.py --check
```

## Commit Messages

Use conventional format: `fix(scope): description`, `feat(scope): description`, `chore(scope): description`

## License

Proprietary. See [LICENSE](LICENSE).
