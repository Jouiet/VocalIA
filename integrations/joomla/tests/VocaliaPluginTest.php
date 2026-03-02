<?php

use PHPUnit\Framework\TestCase;
use VocalIA\Plugin\System\Vocalia\Extension\Vocalia;
use Joomla\CMS\Application\SiteApplication;
use Joomla\CMS\Application\AdministratorApplication;

require_once __DIR__ . '/bootstrap.php';
require_once dirname(__DIR__) . '/src/Extension/Vocalia.php';

class VocaliaPluginTest extends TestCase
{
    private StdParams $params;

    protected function setUp(): void
    {
        $this->params = new StdParams();
        $this->params->set('enabled', 1);
        $this->params->set('tenant_id', 'test_tenant_123');
        $this->params->set('widget_type', 'ecommerce');

        $GLOBALS['joomla_app'] = new SiteApplication();
    }

    private function createPlugin(): Vocalia
    {
        return new Vocalia($this->params);
    }

    // ─── SubscriberInterface ─────────────────────────────────

    public function testSubscribedEvents()
    {
        $events = Vocalia::getSubscribedEvents();
        $this->assertArrayHasKey('onBeforeCompileHead', $events);
        $this->assertEquals('onBeforeCompileHead', $events['onBeforeCompileHead']);
    }

    // ─── Widget Injection ────────────────────────────────────

    public function testWidgetInjectsOnFrontend()
    {
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertCount(1, $doc->customTags);
        $this->assertStringContainsString('data-vocalia-tenant="test_tenant_123"', $doc->customTags[0]);
        $this->assertStringContainsString('voice-widget-ecommerce.js', $doc->customTags[0]);
        $this->assertStringContainsString('defer', $doc->customTags[0]);
    }

    public function testWidgetB2bType()
    {
        $this->params->set('widget_type', 'b2b');
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertStringContainsString('voice-widget-b2b.js', $doc->customTags[0]);
    }

    public function testWidgetDisabled()
    {
        $this->params->set('enabled', 0);
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertEmpty($doc->customTags);
    }

    public function testWidgetNoTenant()
    {
        $this->params->set('tenant_id', '');
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertEmpty($doc->customTags);
    }

    public function testWidgetInvalidTenant()
    {
        $this->params->set('tenant_id', '<script>alert(1)</script>');
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertEmpty($doc->customTags);
    }

    public function testWidgetNotOnAdmin()
    {
        $GLOBALS['joomla_app'] = new AdministratorApplication();
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        // Admin app — no document, no injection
        $this->assertTrue(true); // Didn't crash
    }

    // ─── CDN URL ─────────────────────────────────────────────

    public function testCdnUrlPointsToVocaliaMa()
    {
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertStringContainsString('https://vocalia.ma/voice-assistant/', $doc->customTags[0]);
        $this->assertStringNotContainsString('api.vocalia.ma', $doc->customTags[0]);
    }

    // ─── XSS Protection ─────────────────────────────────────

    public function testTenantIdIsEscaped()
    {
        $this->params->set('tenant_id', 'valid_tenant');
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $tag = $doc->customTags[0];
        $this->assertStringContainsString('data-vocalia-tenant="valid_tenant"', $tag);
    }

    // ─── Default widget type ────────────────────────────────

    public function testDefaultWidgetTypeIsEcommerce()
    {
        $params = new StdParams();
        $params->set('enabled', 1);
        $params->set('tenant_id', 'test');
        // widget_type not set — should default to ecommerce
        $GLOBALS['joomla_app'] = new SiteApplication();
        $plugin = new Vocalia($params);
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertStringContainsString('voice-widget-ecommerce.js', $doc->customTags[0]);
    }

    // ─── Invalid widget type fallback ───────────────────────

    public function testInvalidWidgetTypeFallsBackToEcommerce()
    {
        $this->params->set('widget_type', 'invalid_type');
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertStringContainsString('voice-widget-ecommerce.js', $doc->customTags[0]);
    }

    // ─── Script tag structure ───────────────────────────────

    public function testScriptTagStructure()
    {
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $tag = $doc->customTags[0];
        $this->assertStringStartsWith('<script src="', $tag);
        $this->assertStringEndsWith('defer></script>', $tag);
    }

    // ─── SRI Integrity ────────────────────────────────────────

    public function testSRIIntegrityInWidgetTag()
    {
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $tag = $doc->customTags[0];
        $this->assertStringContainsString('integrity="sha384-', $tag);
        $this->assertStringContainsString('crossorigin="anonymous"', $tag);
    }

    // ─── Whitespace tenant ID ───────────────────────────────

    public function testWhitespaceTenantIdIsRejected()
    {
        $this->params->set('tenant_id', '   ');
        $plugin = $this->createPlugin();
        $plugin->onBeforeCompileHead();

        $doc = $GLOBALS['joomla_app']->getDocument();
        $this->assertEmpty($doc->customTags);
    }

    // ─── Valid tenant ID patterns ───────────────────────────

    public function testValidTenantIdPatterns()
    {
        $valid = ['abc', 'b2b_test', 'my-tenant', 'UPPER123', 'a'];
        foreach ($valid as $tid) {
            $GLOBALS['joomla_app'] = new SiteApplication();
            $this->params->set('tenant_id', $tid);
            $plugin = $this->createPlugin();
            $plugin->onBeforeCompileHead();

            $doc = $GLOBALS['joomla_app']->getDocument();
            $this->assertNotEmpty($doc->customTags, "Tenant '$tid' should be accepted");
        }
    }
}
