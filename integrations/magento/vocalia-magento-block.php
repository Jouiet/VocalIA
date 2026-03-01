<?php
/**
 * VocalIA Voice Assistant — Magento 2 Block
 * ==========================================
 * Version: 1.0.0
 *
 * This block renders the VocalIA widget script tag.
 * It reads configuration from Stores → Configuration → VocalIA.
 *
 * Layout XML reference (default.xml):
 *   <referenceContainer name="before.body.end">
 *       <block class="VocalIA\VoiceAssistant\Block\Widget"
 *              name="vocalia.voice.widget"
 *              template="VocalIA_VoiceAssistant::widget.phtml" />
 *   </referenceContainer>
 *
 * Template (widget.phtml):
 *   <?php if ($block->isEnabled()): ?>
 *   <script src="<?= $block->escapeUrl($block->getWidgetUrl()) ?>"
 *           integrity="<?= $block->escapeHtmlAttr($block->getSRIHash()) ?>"
 *           crossorigin="anonymous"
 *           data-vocalia-tenant="<?= $block->escapeHtmlAttr($block->getTenantId()) ?>"
 *           defer></script>
 *   <?php endif; ?>
 */

namespace VocalIA\VoiceAssistant\Block;

use Magento\Framework\View\Element\Template;
use Magento\Framework\View\Element\Template\Context;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;

class Widget extends Template
{
    const XML_PATH_ENABLED = 'vocalia_voice/general/enabled';
    const XML_PATH_TENANT_ID = 'vocalia_voice/general/tenant_id';
    const XML_PATH_WIDGET_TYPE = 'vocalia_voice/general/widget_type';
    const CDN_BASE = 'https://vocalia.ma/voice-assistant';
    const VOCALIA_SRI_ECOMMERCE = 'sha384-ZOrFKaCREh1dqsxu1PdaNIcW/MTg1VumxPof7Yja9+Wv3R/doPB6rqcjolmgjeQn'; // Auto-updated by build-widgets.cjs
    const VOCALIA_SRI_B2B = 'sha384-3MldGAd6hn/SpDyGMM8as1PUfJghkrjmoKIfQfVONxcCVsBcxmhlC3TCbRUJ12e9'; // Auto-updated by build-widgets.cjs

    /**
     * @var ScopeConfigInterface
     */
    protected $scopeConfig;

    public function __construct(
        Context $context,
        ScopeConfigInterface $scopeConfig,
        array $data = []
    ) {
        $this->scopeConfig = $scopeConfig;
        parent::__construct($context, $data);
    }

    /**
     * Check if widget is enabled
     */
    public function isEnabled(): bool
    {
        return (bool) $this->scopeConfig->getValue(
            self::XML_PATH_ENABLED,
            ScopeInterface::SCOPE_STORE
        );
    }

    /**
     * Get configured tenant ID
     */
    public function getTenantId(): string
    {
        return (string) $this->scopeConfig->getValue(
            self::XML_PATH_TENANT_ID,
            ScopeInterface::SCOPE_STORE
        );
    }

    /**
     * Get widget URL based on configured type
     */
    public function getWidgetUrl(): string
    {
        $type = $this->scopeConfig->getValue(
            self::XML_PATH_WIDGET_TYPE,
            ScopeInterface::SCOPE_STORE
        );

        $file = ($type === 'ecommerce')
            ? 'voice-widget-ecommerce.js'
            : 'voice-widget-b2b.js';

        return self::CDN_BASE . '/' . $file;
    }

    /**
     * Get SRI hash for the current widget type
     */
    public function getSRIHash(): string
    {
        $type = $this->scopeConfig->getValue(
            self::XML_PATH_WIDGET_TYPE,
            ScopeInterface::SCOPE_STORE
        );
        return ($type === 'ecommerce') ? self::VOCALIA_SRI_ECOMMERCE : self::VOCALIA_SRI_B2B;
    }

    /**
     * Override toHtml to return empty when disabled or no tenant
     */
    protected function _toHtml(): string
    {
        if (!$this->isEnabled() || empty($this->getTenantId())) {
            return '';
        }
        return parent::_toHtml();
    }
}
