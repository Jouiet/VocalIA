<?php
/**
 * VocalIA Voice Assistant — PrestaShop Module
 * ============================================
 * Version: 1.0.0
 *
 * INSTALLATION:
 * 1. Zip this directory as vocalia.zip
 * 2. In PrestaShop Back Office → Modules → Module Manager → Upload a module
 * 3. Upload vocalia.zip
 * 4. Click "Configure" on VocalIA Voice Assistant
 * 5. Enter your Tenant ID
 * 6. Add your PrestaShop domain to Allowed Origins in VocalIA dashboard
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Vocalia extends Module
{
    const VOCALIA_SRI_ECOMMERCE = 'sha384-IS/hVYvfFRdc59Gec4Yszm8TlUctq1dScFrxRJo50FVftCcfXdKbUOOVJwnx9qq3'; // Auto-updated by build-widgets.cjs
    const VOCALIA_SRI_B2B = 'sha384-kAb/ZXzAasi/oaJ9sKFcnUt8Ott4+DWvMTGbF8OxtbWdVkPUZ6Pf6q1Vu2MGBkoB'; // Auto-updated by build-widgets.cjs

    public function __construct()
    {
        $this->name = 'vocalia';
        $this->tab = 'front_office_features';
        $this->version = '1.0.0';
        $this->author = 'VocalIA';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = ['min' => '1.7.0.0', 'max' => '8.99.99'];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('VocalIA Voice Assistant');
        $this->description = $this->l('Add AI voice assistant to your PrestaShop store. Speaks 5 languages, qualifies leads, remembers clients.');
        $this->confirmUninstall = $this->l('Are you sure you want to uninstall VocalIA?');
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('displayBeforeBodyClosingTag')
            && $this->registerHook('displayFooter')
            && Configuration::updateValue('VOCALIA_TENANT_ID', '')
            && Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'ecommerce')
            && Configuration::updateValue('VOCALIA_ENABLED', true)
            && Configuration::updateValue('VOCALIA_PLUGIN_TOKEN', '');
    }

    public function uninstall()
    {
        return parent::uninstall()
            && Configuration::deleteByName('VOCALIA_TENANT_ID')
            && Configuration::deleteByName('VOCALIA_WIDGET_TYPE')
            && Configuration::deleteByName('VOCALIA_ENABLED')
            && Configuration::deleteByName('VOCALIA_PLUGIN_TOKEN');
    }

    public function getContent()
    {
        $output = '';

        // Handle plugin-connect callback
        if (Tools::getValue('vocalia_token') && Tools::getValue('tenant_id') && Tools::getValue('nonce')) {
            $storedNonce = Configuration::get('VOCALIA_CONNECT_NONCE');
            $receivedNonce = Tools::getValue('nonce');
            if ($storedNonce && hash_equals($storedNonce, $receivedNonce)) {
                $tenantId = preg_replace('/[^a-z0-9_-]/i', '', Tools::getValue('tenant_id'));
                Configuration::updateValue('VOCALIA_TENANT_ID', $tenantId);
                Configuration::updateValue('VOCALIA_PLUGIN_TOKEN', Tools::getValue('vocalia_token'));
                Configuration::deleteByName('VOCALIA_CONNECT_NONCE');
                $output .= $this->displayConfirmation($this->l('Connected to VocalIA! Your domain has been auto-registered.'));
            } else {
                $output .= $this->displayError($this->l('Connection failed: invalid nonce. Please try again.'));
            }
        }

        // Handle disconnect
        if (Tools::getValue('vocalia_disconnect') === '1') {
            Configuration::updateValue('VOCALIA_TENANT_ID', '');
            Configuration::updateValue('VOCALIA_PLUGIN_TOKEN', '');
            $output .= $this->displayConfirmation($this->l('Disconnected from VocalIA.'));
        }

        if (Tools::isSubmit('submitVocaliaSettings')) {
            $tenantId = Tools::getValue('VOCALIA_TENANT_ID');
            $widgetType = Tools::getValue('VOCALIA_WIDGET_TYPE');
            $enabled = (bool)Tools::getValue('VOCALIA_ENABLED');

            if (!empty($tenantId) && !preg_match('/^[a-z0-9_-]+$/i', $tenantId)) {
                $output .= $this->displayError($this->l('Invalid Tenant ID format.'));
            } else {
                Configuration::updateValue('VOCALIA_TENANT_ID', $tenantId);
                Configuration::updateValue('VOCALIA_WIDGET_TYPE', $widgetType);
                Configuration::updateValue('VOCALIA_ENABLED', $enabled);
                $output .= $this->displayConfirmation($this->l('Settings saved.'));
            }
        }

        // Show Connect button if not connected
        $tenantId = Configuration::get('VOCALIA_TENANT_ID');
        $pluginToken = Configuration::get('VOCALIA_PLUGIN_TOKEN');
        if (empty($tenantId) || empty($pluginToken)) {
            $nonce = bin2hex(random_bytes(16));
            Configuration::updateValue('VOCALIA_CONNECT_NONCE', $nonce);
            $returnUrl = $this->context->link->getAdminLink('AdminModules', true)
                . '&configure=' . $this->name . '&tab_module=' . $this->tab . '&module_name=' . $this->name;
            $connectUrl = 'https://api.vocalia.ma/api/auth/plugin-authorize?'
                . http_build_query(['platform' => 'prestashop', 'return_url' => $returnUrl, 'nonce' => $nonce]);

            $output .= '<div class="panel"><h3>' . $this->l('Connect your VocalIA account') . '</h3>'
                . '<p>' . $this->l('Click below to connect. Your domain will be auto-registered.') . '</p>'
                . '<a href="' . htmlspecialchars($connectUrl, ENT_QUOTES, 'UTF-8') . '" class="btn btn-primary btn-lg">'
                . $this->l('Connect with VocalIA') . '</a>'
                . '<hr><p style="color:#999;">' . $this->l('Or configure manually using the form below.') . '</p></div>';
        } else {
            $disconnectUrl = $this->context->link->getAdminLink('AdminModules', true)
                . '&configure=' . $this->name . '&vocalia_disconnect=1';
            $output .= '<div class="alert alert-success">'
                . '<strong>' . $this->l('Connected to VocalIA') . '</strong> — '
                . $this->l('Tenant:') . ' <code>' . htmlspecialchars($tenantId, ENT_QUOTES, 'UTF-8') . '</code>'
                . ' | <a href="' . htmlspecialchars($disconnectUrl, ENT_QUOTES, 'UTF-8') . '" style="color:#c0392b;">' . $this->l('Disconnect') . '</a>'
                . '</div>';
        }

        return $output . $this->renderForm();
    }

    protected function renderForm()
    {
        $fields_form = [
            'form' => [
                'legend' => [
                    'title' => $this->l('VocalIA Configuration'),
                    'icon' => 'icon-cogs',
                ],
                'input' => [
                    [
                        'type' => 'switch',
                        'label' => $this->l('Enable Widget'),
                        'name' => 'VOCALIA_ENABLED',
                        'is_bool' => true,
                        'values' => [
                            ['id' => 'active_on', 'value' => 1, 'label' => $this->l('Yes')],
                            ['id' => 'active_off', 'value' => 0, 'label' => $this->l('No')],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'label' => $this->l('Tenant ID'),
                        'name' => 'VOCALIA_TENANT_ID',
                        'desc' => $this->l('Your VocalIA Tenant ID from vocalia.ma dashboard → Settings.'),
                        'required' => true,
                    ],
                    [
                        'type' => 'select',
                        'label' => $this->l('Widget Type'),
                        'name' => 'VOCALIA_WIDGET_TYPE',
                        'options' => [
                            'query' => [
                                ['id' => 'ecommerce', 'name' => $this->l('E-commerce (recommended for PrestaShop)')],
                                ['id' => 'b2b', 'name' => $this->l('B2B / Service Business')],
                            ],
                            'id' => 'id',
                            'name' => 'name',
                        ],
                    ],
                ],
                'submit' => [
                    'title' => $this->l('Save'),
                ],
            ],
        ];

        $helper = new HelperForm();
        $helper->submit_action = 'submitVocaliaSettings';
        $helper->currentIndex = $this->context->link->getAdminLink('AdminModules', false)
            . '&configure=' . $this->name . '&tab_module=' . $this->tab . '&module_name=' . $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->fields_value = [
            'VOCALIA_ENABLED' => Configuration::get('VOCALIA_ENABLED'),
            'VOCALIA_TENANT_ID' => Configuration::get('VOCALIA_TENANT_ID'),
            'VOCALIA_WIDGET_TYPE' => Configuration::get('VOCALIA_WIDGET_TYPE'),
        ];

        return $helper->generateForm([$fields_form]);
    }

    private $widgetRendered = false;

    public function hookDisplayBeforeBodyClosingTag($params)
    {
        return $this->renderWidgetOnce();
    }

    public function hookDisplayFooter($params)
    {
        return $this->renderWidgetOnce();
    }

    protected function renderWidgetOnce()
    {
        if ($this->widgetRendered) {
            return '';
        }
        $this->widgetRendered = true;
        return $this->renderWidget();
    }

    protected function renderWidget()
    {
        if (!Configuration::get('VOCALIA_ENABLED')) {
            return '';
        }

        $tenantId = Configuration::get('VOCALIA_TENANT_ID');
        if (empty($tenantId)) {
            return '';
        }

        $widgetType = Configuration::get('VOCALIA_WIDGET_TYPE');
        $file = ($widgetType === 'ecommerce')
            ? 'voice-widget-ecommerce.js'
            : 'voice-widget-b2b.js';

        $url = 'https://vocalia.ma/voice-assistant/' . $file;
        $sri = ($widgetType === 'ecommerce') ? self::VOCALIA_SRI_ECOMMERCE : self::VOCALIA_SRI_B2B;

        return '<script src="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8')
            . '" integrity="' . htmlspecialchars($sri, ENT_QUOTES, 'UTF-8')
            . '" crossorigin="anonymous"'
            . ' data-vocalia-tenant="' . htmlspecialchars($tenantId, ENT_QUOTES, 'UTF-8')
            . '" defer></script>';
    }
}
