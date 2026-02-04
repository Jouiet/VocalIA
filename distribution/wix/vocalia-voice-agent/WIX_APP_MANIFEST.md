# Wix App Manifest & Registration Guide

## 1. App Identity

- **App Name:** VocalIA Voice Agent & Telephony
- **Category:** Communication, Lead Generation
- **Description:** Turn your Wix site into a Voice AI powerhouse. Auto-recover abandoned carts and book appointments via voice.

## 2. Components

### A. Dashboard Page (Wix Velo / iFrame)

- **URL:** `https://app.vocalia.ma/wix/dashboard` (Placeholder)
- **Purpose:** Manage Voice Persona, View Call Logs, Top-up Credits.
- **Permissions:** `Read Orders`, `Read Contacts`, `Manage Contacts`.

### B. Widget (Custom Element)

- **Tag Name:** `vocalia-voice-widget`
- **Script URL:** `https://api.vocalia.ma/wix/loader.js` (Must serve `wix-custom-element.js`)
- **Parameters (Props):**
  - `tenant-id` (String)
  - `position` (Dropdown: bottom-right, bottom-left)
  - `primary-color` (Color Picker)

## 3. OAuth & Permissions

- **App Secret:** [Stored in vocal-ia-backend]
- **Redirect URL:** `https://api.vocalia.ma/auth/wix/callback`
- **Webhooks:**
  - `App Installed` -> Create Tenant in VocalIA DB
  - `App Removed` -> Deactivate Tenant
  - `Plan Purchased` -> Update Credits

## 4. Development Steps

1. Login to **Wix Developers Center**.
2. Create New App.
3. Configure **OAuth** credentials.
4. Define **Widget Extension** pointing to the hosted `wix-custom-element.js`.
5. Submit for Review (15 Day timeline).
