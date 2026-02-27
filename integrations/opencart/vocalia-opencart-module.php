<?php
/**
 * VocalIA Voice Assistant — OpenCart Module
 * ==========================================
 * Version: 1.0.0
 * Compatible: OpenCart 3.x / 4.x
 *
 * INSTALLATION (OpenCart 3.x):
 * 1. Upload this file to:
 *    - catalog/controller/extension/module/vocalia.php
 * 2. Create the admin controller:
 *    - admin/controller/extension/module/vocalia.php
 * 3. Extensions → Modules → VocalIA Voice Assistant → Install
 * 4. Edit → Enter your Tenant ID → Save
 * 5. Design → Layouts → Default → Add Module → VocalIA (position: Content Bottom)
 *
 * INSTALLATION (OpenCart 4.x):
 * 1. Upload via Extensions → Installer (OCMOD zip)
 * 2. Extensions → Extensions → Modules → VocalIA → Install → Edit
 * 3. Enter Tenant ID → Save
 *
 * IMPORTANT: Add your OpenCart domain to Allowed Origins in VocalIA dashboard.
 */

class ControllerExtensionModuleVocalia extends Controller
{
    public function index($setting)
    {
        $status = isset($setting['status']) ? $setting['status'] : 0;
        if (!$status) {
            return '';
        }

        $tenant_id = isset($setting['tenant_id']) ? $setting['tenant_id'] : '';
        if (empty($tenant_id) || !preg_match('/^[a-z0-9_-]+$/i', $tenant_id)) {
            return '';
        }

        $widget_type = isset($setting['widget_type']) ? $setting['widget_type'] : 'ecommerce';
        $file = ($widget_type === 'ecommerce')
            ? 'voice-widget-ecommerce.js'
            : 'voice-widget-b2b.js';

        $url = 'https://api.vocalia.ma/voice-assistant/' . $file;

        $data = [
            'widget_url' => $url,
            'tenant_id'  => htmlspecialchars($tenant_id, ENT_QUOTES, 'UTF-8'),
        ];

        return $this->load->view('extension/module/vocalia', $data);
    }
}

/*
 * Template file: catalog/view/theme/default/template/extension/module/vocalia.twig
 *
 * Contents:
 * <script src="{{ widget_url }}" data-vocalia-tenant="{{ tenant_id }}" defer></script>
 *
 * Admin controller (admin/controller/extension/module/vocalia.php):
 * Standard OpenCart admin module with fields: status (toggle), tenant_id (text), widget_type (select)
 */
