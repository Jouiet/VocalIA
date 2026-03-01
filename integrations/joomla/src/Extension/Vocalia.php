<?php

/**
 * VocalIA Voice Assistant — Joomla System Plugin
 * ================================================
 * Version: 1.0.0
 * Compatible: Joomla 4.x / 5.x
 *
 * Injects the VocalIA voice widget before </body> on all frontend pages.
 * Configuration: Joomla Admin → Plugins → VocalIA Voice Assistant
 */

namespace VocalIA\Plugin\System\Vocalia\Extension;

defined('_JEXEC') or die;

use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\CMS\Application\SiteApplication;
use Joomla\Event\SubscriberInterface;

final class Vocalia extends CMSPlugin implements SubscriberInterface
{
    private const CDN_BASE = 'https://vocalia.ma/voice-assistant';

    private const WIDGET_FILES = [
        'ecommerce' => 'voice-widget-ecommerce.js',
        'b2b'       => 'voice-widget-b2b.js',
    ];

    private const VOCALIA_SRI_ECOMMERCE = 'sha384-ZOrFKaCREh1dqsxu1PdaNIcW/MTg1VumxPof7Yja9+Wv3R/doPB6rqcjolmgjeQn'; // Auto-updated by build-widgets.cjs
    private const VOCALIA_SRI_B2B = 'sha384-3MldGAd6hn/SpDyGMM8as1PUfJghkrjmoKIfQfVONxcCVsBcxmhlC3TCbRUJ12e9'; // Auto-updated by build-widgets.cjs

    public static function getSubscribedEvents(): array
    {
        return [
            'onBeforeCompileHead' => 'onBeforeCompileHead',
        ];
    }

    public function onBeforeCompileHead(): void
    {
        $app = $this->getApplication();

        if (!$app instanceof SiteApplication) {
            return;
        }

        if (!$this->params->get('enabled', 1)) {
            return;
        }

        $tenantId = trim($this->params->get('tenant_id', ''));
        if (empty($tenantId) || !preg_match('/^[a-z0-9_-]+$/i', $tenantId)) {
            return;
        }

        $widgetType = $this->params->get('widget_type', 'ecommerce');
        $file = self::WIDGET_FILES[$widgetType] ?? self::WIDGET_FILES['ecommerce'];
        $url = self::CDN_BASE . '/' . $file;

        $escapedUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        $escapedTenant = htmlspecialchars($tenantId, ENT_QUOTES, 'UTF-8');

        $sri = ($widgetType === 'ecommerce') ? self::VOCALIA_SRI_ECOMMERCE : self::VOCALIA_SRI_B2B;

        $app->getDocument()->addCustomTag(
            '<script src="' . $escapedUrl . '" integrity="' . htmlspecialchars($sri, ENT_QUOTES, 'UTF-8') . '" crossorigin="anonymous" data-vocalia-tenant="' . $escapedTenant . '" defer></script>'
        );
    }
}
