# VocalIA Security Policy 2026

## 1. Data Protection & Privacy (GDPR/EU AI Act)

- **PII Handling**: Personal Identifiable Information must be masked or encrypted in transit.
- **AI Transparency**: All automated outbound communications (Voice, SMS, Email) MUST include a clear disclosure that the interaction is AI-assisted.
- **Moroccan Compliance**: Alignment with CNDP (Commission Nationale de contrôle de la protection des Données à caractère Personnel) for MAD-based transactions.

## 2. Infrastructure Security

- **Multi-tenant Isolation**: Each tenant data is isolated in dedicated directores with unique credentials.
- **Secret Management**: API keys (Twilio, HubSpot, Stripe) are strictly managed via environment variables and `credentials.json` outside the main repository.

## 3. Compliance Monitoring

- **Policy-as-Code**: The `compliance-guardian.cjs` engine enforces these rules in real-time.
- **Audit Logs**: All compliance violations are logged to `data/compliance_audit.log` for regular forensic review.
