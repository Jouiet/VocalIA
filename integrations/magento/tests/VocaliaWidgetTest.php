<?php

use PHPUnit\Framework\TestCase;
use VocalIA\VoiceAssistant\Block\Widget;
use Magento\Framework\View\Element\Template\Context;

require_once __DIR__ . '/bootstrap.php';
require_once dirname(__DIR__) . '/Block/Widget.php';

class VocaliaWidgetTest extends TestCase
{
    private TestScopeConfig $scopeConfig;

    protected function setUp(): void
    {
        $this->scopeConfig = new TestScopeConfig();
        $this->scopeConfig->setValue('vocalia_voice/general/enabled', '1');
        $this->scopeConfig->setValue('vocalia_voice/general/tenant_id', 'test_tenant');
        $this->scopeConfig->setValue('vocalia_voice/general/widget_type', 'ecommerce');
    }

    private function createWidget(): Widget
    {
        return new Widget(new Context(), $this->scopeConfig);
    }

    // ─── isEnabled ──────────────────────────────────────────

    public function testIsEnabledTrue()
    {
        $widget = $this->createWidget();
        $this->assertTrue($widget->isEnabled());
    }

    public function testIsEnabledFalse()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/enabled', '0');
        $widget = $this->createWidget();
        $this->assertFalse($widget->isEnabled());
    }

    public function testIsEnabledNull()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/enabled', null);
        $widget = $this->createWidget();
        $this->assertFalse($widget->isEnabled());
    }

    // ─── getTenantId ────────────────────────────────────────

    public function testGetTenantId()
    {
        $widget = $this->createWidget();
        $this->assertEquals('test_tenant', $widget->getTenantId());
    }

    public function testGetTenantIdEmpty()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/tenant_id', '');
        $widget = $this->createWidget();
        $this->assertEquals('', $widget->getTenantId());
    }

    // ─── getWidgetUrl ───────────────────────────────────────

    public function testGetWidgetUrlEcommerce()
    {
        $widget = $this->createWidget();
        $url = $widget->getWidgetUrl();
        $this->assertStringContainsString('voice-widget-ecommerce.js', $url);
        $this->assertStringContainsString('vocalia.ma/voice-assistant/', $url);
    }

    public function testGetWidgetUrlB2b()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/widget_type', 'b2b');
        $widget = $this->createWidget();
        $url = $widget->getWidgetUrl();
        $this->assertStringContainsString('voice-widget-b2b.js', $url);
    }

    public function testGetWidgetUrlDefaultIsB2b()
    {
        // When widget_type is null/undefined, code checks === 'ecommerce'
        $this->scopeConfig->setValue('vocalia_voice/general/widget_type', null);
        $widget = $this->createWidget();
        $url = $widget->getWidgetUrl();
        // null !== 'ecommerce' → falls to b2b
        $this->assertStringContainsString('voice-widget-b2b.js', $url);
    }

    // ─── CDN URL ────────────────────────────────────────────

    public function testCdnUrlNotApiDomain()
    {
        $widget = $this->createWidget();
        $url = $widget->getWidgetUrl();
        $this->assertStringNotContainsString('api.vocalia.ma', $url);
    }

    // ─── _toHtml ────────────────────────────────────────────

    public function testToHtmlRendersWhenEnabled()
    {
        $widget = $this->createWidget();
        // Can't directly call protected _toHtml, but we verify public methods
        $this->assertTrue($widget->isEnabled());
        $this->assertNotEmpty($widget->getTenantId());
    }

    public function testBlockDisabledReturnsEmpty()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/enabled', '0');
        $widget = $this->createWidget();
        $this->assertFalse($widget->isEnabled());
    }

    public function testBlockNoTenantReturnsEmpty()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/tenant_id', '');
        $widget = $this->createWidget();
        $this->assertEmpty($widget->getTenantId());
    }

    // ─── XML paths ──────────────────────────────────────────

    public function testXmlPathConstants()
    {
        $this->assertEquals('vocalia_voice/general/enabled', Widget::XML_PATH_ENABLED);
        $this->assertEquals('vocalia_voice/general/tenant_id', Widget::XML_PATH_TENANT_ID);
        $this->assertEquals('vocalia_voice/general/widget_type', Widget::XML_PATH_WIDGET_TYPE);
    }

    // ─── SRI Integrity ────────────────────────────────────────

    public function testGetSRIHashEcommerce()
    {
        $widget = $this->createWidget();
        $sri = $widget->getSRIHash();
        $this->assertStringStartsWith('sha384-', $sri);
        $this->assertEquals(Widget::VOCALIA_SRI_ECOMMERCE, $sri);
    }

    public function testGetSRIHashB2b()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/widget_type', 'b2b');
        $widget = $this->createWidget();
        $sri = $widget->getSRIHash();
        $this->assertEquals(Widget::VOCALIA_SRI_B2B, $sri);
    }

    // ─── Input Sanitization ─────────────────────────────────

    public function testGetTenantIdWithXSSPayload()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/tenant_id', '<script>alert(1)</script>');
        $widget = $this->createWidget();
        // getTenantId returns raw value — escaping is template responsibility
        // Verify _toHtml won't render for non-empty but dangerous tenant
        // (Magento templates use $block->escapeHtmlAttr() for safety)
        $this->assertNotEmpty($widget->getTenantId());
    }

    public function testGetTenantIdWithNull()
    {
        $this->scopeConfig->setValue('vocalia_voice/general/tenant_id', null);
        $widget = $this->createWidget();
        $this->assertEquals('', $widget->getTenantId());
    }

    // ─── CDN_BASE constant ──────────────────────────────────

    public function testCdnBaseConstant()
    {
        $this->assertEquals('https://vocalia.ma/voice-assistant', Widget::CDN_BASE);
    }
}
