# VocalIA - GDPR Compliance Documentation

> **Version**: 1.0.0 | **Date**: 31/01/2026 | **Session**: 250.12
> **Status**: COMPLIANT | **DPO**: <dpo@vocalia.ma>
> **Legal Basis**: RGPD (EU), Loi 09-08 (Maroc), AI Act (EU)

---

## 1. Executive Summary

VocalIA implements comprehensive data protection measures in compliance with:

- **GDPR** (General Data Protection Regulation - EU)
- **Loi 09-08** (Morocco Data Protection Law)
- **AI Act** (EU Artificial Intelligence Act)

| Compliance Area | Status | Documentation |
|:----------------|:------:|:--------------|
| Privacy Policy | ✅ | website/privacy.html |
| Data Processing Agreement | ✅ | Section 4 below |
| Processing Activities Registry | ✅ | Section 3 below |
| Data Subject Rights | ✅ | privacy.html Section 7 |
| Security Measures | ✅ | docs/SECURITY.md |
| AI Transparency | ✅ | privacy.html Section 9 |

---

## 2. Data Controller Information

```
Data Controller: VocalIA SARL
Address: Casablanca, Morocco
Email: privacy@vocalia.ma
DPO Contact: dpo@vocalia.ma
CNDP Registration: [Pending]
```

---

## 3. Processing Activities Registry (Article 30 RGPD)

### 3.1 Voice Call Processing

| Field | Value |
|:------|:------|
| **Purpose** | Voice AI assistant services |
| **Legal Basis** | Contract execution (Art. 6.1.b) |
| **Data Categories** | Voice recordings (temporary), call metadata, transcripts |
| **Data Subjects** | Business clients, end-users |
| **Recipients** | AI providers (Grok, Gemini), Twilio (telephony) |
| **Transfers** | USA (Twilio, xAI) - Standard Contractual Clauses |
| **Retention** | Real-time processing only, no permanent storage |
| **Security** | TLS 1.3, AES-256-GCM, no voice storage |

### 3.2 Lead Qualification Processing

| Field | Value |
|:------|:------|
| **Purpose** | BANT lead scoring and qualification |
| **Legal Basis** | Legitimate interest (Art. 6.1.f) |
| **Data Categories** | Name, email, phone, company, budget, timeline |
| **Data Subjects** | Business prospects |
| **Recipients** | Client CRM (via MCP integration) |
| **Transfers** | Client-controlled destinations |
| **Retention** | Client-defined (typically 3 years) |
| **Security** | SecretVault encryption, tenant isolation |

### 3.3 Booking/Appointment Processing

| Field | Value |
|:------|:------|
| **Purpose** | Calendar scheduling |
| **Legal Basis** | Contract execution (Art. 6.1.b) |
| **Data Categories** | Name, email, preferred time, service type |
| **Data Subjects** | Appointment requesters |
| **Recipients** | Google Calendar, Calendly (client choice) |
| **Transfers** | USA (Google) - Standard Contractual Clauses |
| **Retention** | Until appointment completed + client policy |
| **Security** | OAuth 2.0, per-tenant credentials |

### 3.4 Analytics Processing

| Field | Value |
|:------|:------|
| **Purpose** | Service improvement, usage analytics |
| **Legal Basis** | Legitimate interest (Art. 6.1.f) |
| **Data Categories** | Call duration, language, conversion events |
| **Data Subjects** | Platform users (aggregated) |
| **Recipients** | Plausible Analytics (EU-based) |
| **Transfers** | None (EU processing) |
| **Retention** | 26 months (aggregated) |
| **Security** | Anonymization, no PII stored |

### 3.5 Payment Processing

| Field | Value |
|:------|:------|
| **Purpose** | Subscription billing |
| **Legal Basis** | Contract execution (Art. 6.1.b) |
| **Data Categories** | Name, email, billing address, payment token |
| **Data Subjects** | Paying customers |
| **Recipients** | Stripe |
| **Transfers** | USA (Stripe) - Standard Contractual Clauses |
| **Retention** | Legal requirement (10 years invoices) |
| **Security** | PCI-DSS compliant (Stripe handles card data) |

---

## 4. Data Processing Agreement (DPA) Template

### 4.1 Parties

This Data Processing Agreement ("DPA") is entered into between:

- **Data Controller**: [Client Company Name] ("Controller")
- **Data Processor**: VocalIA SARL ("Processor")

### 4.2 Subject Matter and Duration

The Processor shall process personal data on behalf of the Controller for the purpose of providing Voice AI services as described in the Service Agreement. This DPA shall remain in effect for the duration of the Service Agreement.

### 4.3 Nature and Purpose of Processing

| Processing Activity | Purpose |
|:--------------------|:--------|
| Voice call handling | Automated customer interactions |
| Lead qualification | BANT scoring and routing |
| Appointment booking | Calendar integration |
| CRM synchronization | Contact/deal updates |

### 4.4 Types of Personal Data

- Identification data (name, email, phone)
- Voice recordings (temporary, not stored)
- Call transcripts (if enabled by Controller)
- Behavioral data (conversation context)

### 4.5 Categories of Data Subjects

- Controller's customers
- Controller's prospects
- Controller's employees (if applicable)

### 4.6 Processor Obligations

The Processor shall:

1. **Process only on instructions**: Process personal data only on documented instructions from the Controller.

2. **Confidentiality**: Ensure persons authorized to process personal data have committed to confidentiality.

3. **Security measures**: Implement appropriate technical and organizational measures:
   - Encryption at rest (AES-256-GCM)
   - Encryption in transit (TLS 1.3)
   - Access controls (per-tenant isolation)
   - Regular security audits

4. **Sub-processors**: Not engage another processor without prior authorization. Current sub-processors:
   - xAI (Grok AI) - USA - SCCs
   - Google (Gemini AI) - USA - SCCs
   - Twilio (Telephony) - USA - SCCs
   - Stripe (Payments) - USA - SCCs

5. **Data subject rights**: Assist the Controller in responding to data subject requests.

6. **Breach notification**: Notify the Controller of personal data breaches within 24 hours.

7. **Deletion**: Delete or return all personal data upon termination.

8. **Audits**: Make available all information necessary to demonstrate compliance.

### 4.7 Controller Obligations

The Controller shall:

1. Ensure lawful basis for processing
2. Provide clear instructions to Processor
3. Inform data subjects about processing
4. Respond to data subject requests

### 4.8 International Transfers

Personal data may be transferred to the USA for processing by sub-processors. Such transfers are governed by Standard Contractual Clauses (SCCs) as per EU Commission Decision 2021/914.

### 4.9 Liability

Each party shall be liable for damages caused by processing that infringes GDPR, in accordance with Article 82.

### 4.10 Term and Termination

This DPA terminates automatically upon termination of the Service Agreement. Processor shall delete all personal data within 30 days of termination.

---

## 5. Technical Measures (Article 32 RGPD)

### 5.1 Encryption

| Layer | Technology | Implementation |
|:------|:-----------|:---------------|
| Data at rest | Managed (Google Cloud) | Leads/Docs stored in Google Sheets/Drive |
| Data in transit | TLS 1.3 | All API endpoints |
| Secrets | AES-256-GCM | Per-tenant keys (SecretVault.cjs) |

### 5.2 Access Control

| Measure | Implementation |
|:--------|:---------------|
| Authentication | OAuth 2.0 + PKCE |
| Authorization | Tenant isolation |
| Session management | JWT with short expiry |
| MFA | Required for admin access |

### 5.3 Monitoring

| Capability | Implementation |
|:-----------|:---------------|
| Audit logging | TenantLogger.cjs |
| Intrusion detection | Rate limiting |
| Real-time alerts | AgencyEventBus |

### 5.4 Pseudonymization

Voice data is processed in real-time and not stored. Call metadata uses session IDs rather than direct identifiers.

---

## 6. Data Subject Rights Implementation

| Right | Implementation | Contact |
|:------|:---------------|:--------|
| Access (Art. 15) | Export via dashboard or email request | <privacy@vocalia.ma> |
| Rectification (Art. 16) | Dashboard edit or email request | <privacy@vocalia.ma> |
| Erasure (Art. 17) | Deletion within 72 hours | <privacy@vocalia.ma> |
| Portability (Art. 20) | JSON/CSV export | <privacy@vocalia.ma> |
| Objection (Art. 21) | Opt-out mechanism | <privacy@vocalia.ma> |
| Restrict (Art. 18) | Processing pause | <privacy@vocalia.ma> |

---

## 7. AI Act Compliance (Voice AI Specific)

### 7.1 Risk Classification

VocalIA Voice AI is classified as **Limited Risk** under the EU AI Act:

- Not a prohibited AI use
- Not high-risk (no critical infrastructure, employment, credit)
- Transparency obligations apply

### 7.2 Transparency Requirements

| Requirement | Implementation |
|:------------|:---------------|
| AI Disclosure | Users informed they interact with AI |
| Human Oversight | HITL for critical decisions (transfer_call) |
| Non-Discrimination | Regular bias testing across languages |

### 7.3 Human-In-The-Loop (HITL)

```javascript
// Implemented in voice-telephony-bridge.cjs
HITL_VOICE_ENABLED=true
HITL_APPROVE_HOT_BOOKINGS=true
HITL_APPROVE_TRANSFERS=true
HITL_BOOKING_SCORE_THRESHOLD=70
```

---

## 8. Breach Response Procedure

### 8.1 Timeline

| Event | Deadline |
|:------|:---------|
| Internal detection | Immediate |
| Risk assessment | Within 4 hours |
| Controller notification | Within 24 hours |
| Supervisory authority | Within 72 hours (if required) |
| Data subject notification | Without undue delay (if high risk) |

### 8.2 Breach Log Template

```
Date: [YYYY-MM-DD HH:MM]
Description: [What happened]
Data affected: [Types and volume]
Cause: [Root cause]
Measures taken: [Immediate actions]
Notification: [Who was notified]
Prevention: [Future measures]
```

---

## 9. Verification Commands

```bash
# Verify encryption implementation
node -e "require('./core/SecretVault.cjs')" && echo "✅ SecretVault OK"

# Verify tenant isolation
ls clients/ | head -5  # Should show tenant directories

# Verify HITL implementation
grep "HITL" telephony/voice-telephony-bridge.cjs | head -5

# Verify security utils
wc -l lib/security-utils.cjs  # Should show 919 lines

# Verify privacy page exists
ls website/privacy.html && echo "✅ Privacy page exists"
```

---

## 10. Contact Information

| Role | Email | Purpose |
|:-----|:------|:--------|
| Data Protection Officer | <dpo@vocalia.ma> | GDPR queries, breach reports |
| Privacy Team | <privacy@vocalia.ma> | Data subject requests |
| Security Team | <security@vocalia.ma> | Security incidents |
| Legal | <legal@vocalia.ma> | Contract/DPA queries |

---

## 11. Document History

| Version | Date | Changes |
|:--------|:-----|:--------|
| 1.0.0 | 31/01/2026 | Initial release |

---

*This document is maintained by VocalIA and updated as regulations or processing activities change.*
