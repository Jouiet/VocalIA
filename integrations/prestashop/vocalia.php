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
    const VOCALIA_SRI_ECOMMERCE = 'sha384-ZOrFKaCREh1dqsxu1PdaNIcW/MTg1VumxPof7Yja9+Wv3R/doPB6rqcjolmgjeQn'; // Auto-updated by build-widgets.cjs
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
            && Configuration::updateValue('VOCALIA_ENABLED', true);
    }

    public function uninstall()
    {
        return parent::uninstall()
            && Configuration::deleteByName('VOCALIA_TENANT_ID')
            && Configuration::deleteByName('VOCALIA_WIDGET_TYPE')
            && Configuration::deleteByName('VOCALIA_ENABLED');
    }

    public function getContent()
    {
        $output = '';

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
