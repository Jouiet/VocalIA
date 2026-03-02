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
    private const CONNECT_URL = 'https://api.vocalia.ma/api/auth/plugin-authorize';

    private const WIDGET_FILES = [
        'ecommerce' => 'voice-widget-ecommerce.js',
        'b2b'       => 'voice-widget-b2b.js',
    ];

    private const VOCALIA_SRI_ECOMMERCE = 'sha384-IS/hVYvfFRdc59Gec4Yszm8TlUctq1dScFrxRJo50FVftCcfXdKbUOOVJwnx9qq3'; // Auto-updated by build-widgets.cjs
    private const VOCALIA_SRI_B2B = 'sha384-kAb/ZXzAasi/oaJ9sKFcnUt8Ott4+DWvMTGbF8OxtbWdVkPUZ6Pf6q1Vu2MGBkoB'; // Auto-updated by build-widgets.cjs

    public static function getSubscribedEvents(): array
    {
        return [
            'onBeforeCompileHead' => 'onBeforeCompileHead',
            'onAfterRoute'        => 'onAfterRoute',
        ];
    }

    /**
     * Handle plugin-connect OAuth callback in admin context
     */
    public function onAfterRoute(): void
    {
        $app = $this->getApplication();
        if ($app instanceof SiteApplication) {
            return; // Only handle in admin
        }

        $input = $app->getInput();
        $vocaliaToken = $input->getString('vocalia_token', '');
        $tenantId = $input->getString('tenant_id', '');
        $nonce = $input->getString('nonce', '');

        if (!empty($vocaliaToken) && !empty($tenantId) && !empty($nonce)) {
            // Validate nonce
            $storedNonce = $app->getSession()->get('vocalia_connect_nonce', '');
            if (!empty($storedNonce) && hash_equals($storedNonce, $nonce)) {
                $cleanTenantId = preg_replace('/[^a-z0-9_-]/i', '', $tenantId);
                $this->params->set('tenant_id', $cleanTenantId);
                $this->params->set('vocalia_plugin_token', $vocaliaToken);
                // Save params to DB
                $db = \Joomla\CMS\Factory::getDbo();
                $query = $db->getQuery(true)
                    ->update($db->quoteName('#__extensions'))
                    ->set($db->quoteName('params') . ' = ' . $db->quote($this->params->toString()))
                    ->where($db->quoteName('element') . ' = ' . $db->quote('vocalia'))
                    ->where($db->quoteName('type') . ' = ' . $db->quote('plugin'));
                $db->setQuery($query);
                $db->execute();
                $app->getSession()->set('vocalia_connect_nonce', null);
                $app->enqueueMessage('Connected to VocalIA! Tenant: ' . $cleanTenantId, 'success');
            }
        }
    }

    /**
     * Generate the Connect URL for admin usage
     */
    public static function getConnectUrl(string $returnUrl): string
    {
        $nonce = bin2hex(random_bytes(16));
        \Joomla\CMS\Factory::getApplication()->getSession()->set('vocalia_connect_nonce', $nonce);
        return self::CONNECT_URL . '?' . http_build_query([
            'platform'   => 'joomla',
            'return_url' => $returnUrl,
            'nonce'      => $nonce,
        ]);
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
