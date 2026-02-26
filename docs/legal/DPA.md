# DATA PROCESSING AGREEMENT (DPA)

**Between:**
- **Data Controller ("Client"):** The entity identified in the VocalIA service subscription
- **Data Processor ("VocalIA"):** VocalIA SAS, operating vocalia.ma

**Effective Date:** Upon subscription activation

---

## 1. DEFINITIONS

- **Personal Data:** Any data relating to an identified or identifiable natural person, as defined in Article 4(1) of the GDPR.
- **Processing:** Any operation performed on Personal Data, as defined in Article 4(2) of the GDPR.
- **Sub-processor:** Any third party engaged by VocalIA to process Personal Data on behalf of the Client.
- **Services:** The VocalIA voice AI platform, including voice widget, telephony, APIs, and associated services.

---

## 2. SCOPE AND PURPOSE OF PROCESSING

### 2.1 Categories of Data Subjects
- End users interacting with the Client's voice assistant (website visitors, callers)
- Client employees and administrators

### 2.2 Types of Personal Data Processed

| Data Type | Purpose | Retention |
|:----------|:--------|:----------|
| Voice recordings (telephony) | AI conversation, quality assurance | 90 days |
| Conversation transcripts | Service delivery, analytics | Duration of contract + 30 days |
| IP addresses | Security, rate limiting | 30 days |
| Browser metadata (User-Agent) | Widget compatibility | Session only |
| Name, email, phone (if provided by end user) | Lead qualification, booking, CRM sync | Duration of contract + 30 days |
| BANT qualification data | Lead scoring | Duration of contract + 30 days |
| Session identifiers | Conversation continuity | Duration of contract + 30 days |

### 2.3 Purpose of Processing
VocalIA processes Personal Data solely to:
1. Provide AI-powered voice assistant services as configured by the Client
2. Deliver telephony services (inbound/outbound calls)
3. Generate analytics and usage reports for the Client
4. Maintain service security and integrity
5. Comply with legal obligations

---

## 3. OBLIGATIONS OF VOCALIA (DATA PROCESSOR)

### 3.1 Lawfulness
VocalIA shall process Personal Data only on documented instructions from the Client, unless required by applicable law.

### 3.2 Confidentiality
All personnel authorized to process Personal Data are bound by confidentiality obligations.

### 3.3 Security Measures (Article 32 GDPR)
VocalIA implements the following technical and organizational measures:

**Technical:**
- Encryption in transit (TLS 1.2+ / HTTPS / WSS)
- API key authentication per tenant (format: `vk_` + 48-char hex)
- Per-tenant CORS origin validation (dual-source: registry + dynamic config)
- Per-tenant rate limiting (plan-based: 20-120 requests/minute)
- HMAC-SHA256 signed webhook payloads
- Content Security Policy (CSP) on all pages
- Subresource Integrity (SRI) on all CDN resources
- Append-only audit trail with SHA-256 hash chain
- SSH key-only VPS access + fail2ban + UFW firewall

**Organizational:**
- Tenant data isolation (separate directories per tenant)
- Role-based access (admin/user/viewer)
- Recording consent mechanism in 5 languages before call recording
- Automated backup (daily 2AM UTC, 7-day retention)

### 3.4 Sub-processors
VocalIA uses the following sub-processors:

| Sub-processor | Purpose | Data Location | DPA |
|:-------------|:--------|:-------------|:----|
| Hostinger | VPS hosting, Docker infrastructure | EU (Netherlands) | Yes |
| Twilio | Telephony (PSTN calls, SMS) | US/EU | Yes |
| xAI (Grok) | Primary AI model (voice conversations) | US | Yes |
| Google (Gemini) | Fallback AI model | US/EU | Yes |
| Anthropic (Claude) | Tertiary AI model (optional) | US | Yes |
| ElevenLabs | Text-to-Speech (premium voice) | US/EU | Yes |
| Stripe | Payment processing | US/EU | Yes |
| Resend | Transactional email (SMTP) | US | Yes |
| Cloudflare | CDN, DNS | Global | Yes |

VocalIA shall inform the Client of any intended changes to sub-processors, giving the Client the opportunity to object.

### 3.5 Data Subject Rights
VocalIA shall assist the Client in responding to data subject requests (access, rectification, erasure, portability, restriction, objection) within the timeframes required by GDPR.

**Technical implementation:**
- **Right to erasure:** `DELETE /api/tenants/:id/data` endpoint with explicit confirmation
- **Right of access:** `GET /api/tenants/:id/usage` + `GET /api/tenants/:id/calls` endpoints
- **Data portability:** `GET /api/tenants/:id/calls?format=json` export

### 3.6 Data Breach Notification
VocalIA shall notify the Client without undue delay (and in any event within 48 hours) upon becoming aware of a Personal Data breach, providing:
- Nature of the breach
- Categories and approximate number of data subjects affected
- Likely consequences
- Measures taken or proposed to address the breach

### 3.7 Audit Rights
The Client may audit VocalIA's compliance with this DPA upon reasonable notice (minimum 30 days). VocalIA shall provide all information necessary to demonstrate compliance.

---

## 4. OBLIGATIONS OF THE CLIENT (DATA CONTROLLER)

The Client shall:
1. Ensure a lawful basis for processing (e.g., legitimate interest, consent)
2. Provide clear privacy notices to end users before voice interactions
3. Configure recording consent settings appropriately for their jurisdiction
4. Inform VocalIA of any data subject requests promptly
5. Not instruct VocalIA to process data in violation of applicable law

---

## 5. INTERNATIONAL DATA TRANSFERS

Where Personal Data is transferred outside the EEA, VocalIA ensures appropriate safeguards through:
- EU Standard Contractual Clauses (SCCs) with sub-processors
- Adequacy decisions where applicable
- The Client's explicit consent where required

---

## 6. DATA RETENTION AND DELETION

### 6.1 During the Contract
Data is retained as specified in Section 2.2. The Client may request deletion at any time via the GDPR erasure API endpoint.

### 6.2 Upon Termination
Within 30 days of contract termination, VocalIA shall:
1. Delete all Personal Data processed on behalf of the Client
2. Delete all backups containing Client data within 7 additional days
3. Provide written confirmation of deletion upon request

---

## 7. LIABILITY AND INDEMNIFICATION

Each party's liability under this DPA is subject to the limitations set forth in the main Services Agreement. VocalIA shall indemnify the Client for any damages arising from VocalIA's breach of this DPA or applicable data protection law.

---

## 8. GOVERNING LAW

This DPA is governed by the laws of the Kingdom of Morocco and, where applicable, the European Union General Data Protection Regulation (EU) 2016/679.

For EU clients, the competent supervisory authority is that of the Client's establishment.

---

## 9. CONTACT

**Data Protection Contact:**
- Email: privacy@vocalia.ma
- Address: VocalIA, Morocco

---

## 10. SIGNATURES

| | Data Controller (Client) | Data Processor (VocalIA) |
|:--|:------------------------|:------------------------|
| **Name** | _________________________ | _________________________ |
| **Title** | _________________________ | _________________________ |
| **Date** | _________________________ | _________________________ |
| **Signature** | _________________________ | _________________________ |

---

*This DPA is an integral part of the VocalIA Terms of Service and is automatically effective upon subscription activation.*
