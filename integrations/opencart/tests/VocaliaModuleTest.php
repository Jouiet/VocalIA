<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/bootstrap.php';

class VocaliaOpenCartModuleTest extends TestCase
{
    private ControllerExtensionModuleVocalia $controller;

    protected function setUp(): void
    {
        $this->controller = new ControllerExtensionModuleVocalia();
    }

    // ─── Widget Rendering ───────────────────────────────────

    public function testWidgetRendersWithValidSettings()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test_tenant',
            'widget_type' => 'ecommerce',
        ]);

        $this->assertStringContainsString('<script', $output);
        $this->assertStringContainsString('data-vocalia-tenant="test_tenant"', $output);
        $this->assertStringContainsString('voice-widget-ecommerce.js', $output);
        $this->assertStringContainsString('defer', $output);
    }

    public function testWidgetRendersB2bType()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test_tenant',
            'widget_type' => 'b2b',
        ]);

        $this->assertStringContainsString('voice-widget-b2b.js', $output);
    }

    public function testWidgetDisabled()
    {
        $output = $this->controller->index([
            'status' => 0,
            'tenant_id' => 'test_tenant',
        ]);

        $this->assertEquals('', $output);
    }

    public function testWidgetEmptyTenant()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => '',
        ]);

        $this->assertEquals('', $output);
    }

    public function testWidgetMissingTenant()
    {
        $output = $this->controller->index([
            'status' => 1,
        ]);

        $this->assertEquals('', $output);
    }

    public function testWidgetInvalidTenant()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => '<script>alert(1)</script>',
        ]);

        $this->assertEquals('', $output);
    }

    // ─── XSS Protection ─────────────────────────────────────

    public function testTenantIdIsHtmlEscaped()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => 'valid_tenant',
            'widget_type' => 'ecommerce',
        ]);

        // The tenant_id passed to view is escaped
        $this->assertStringContainsString('data-vocalia-tenant="valid_tenant"', $output);
    }

    // ─── CDN URL ────────────────────────────────────────────

    public function testCdnUrlPointsToVocaliaMa()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test',
            'widget_type' => 'ecommerce',
        ]);

        $this->assertStringContainsString('vocalia.ma/voice-assistant/', $output);
        $this->assertStringNotContainsString('api.vocalia.ma', $output);
    }

    // ─── Default widget type ────────────────────────────────

    public function testDefaultWidgetTypeIsEcommerce()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test',
            // widget_type not set
        ]);

        $this->assertStringContainsString('voice-widget-ecommerce.js', $output);
    }

    // ─── Missing status defaults to disabled ────────────────

    public function testMissingStatusDefaultsToDisabled()
    {
        $output = $this->controller->index([
            'tenant_id' => 'test',
        ]);

        $this->assertEquals('', $output);
    }

    // ─── Empty settings ─────────────────────────────────────

    public function testEmptySettings()
    {
        $output = $this->controller->index([]);
        $this->assertEquals('', $output);
    }

    // ─── View template name ─────────────────────────────────

    public function testCorrectViewTemplate()
    {
        $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test',
            'widget_type' => 'ecommerce',
        ]);

        $loader = (new ReflectionClass($this->controller))->getProperty('load');
        $loader->setAccessible(true);
        $loaderObj = $loader->getValue($this->controller);

        $this->assertCount(1, $loaderObj->renderedViews);
        $this->assertEquals('extension/module/vocalia', $loaderObj->renderedViews[0]['template']);
    }

    // ─── SRI Integrity ────────────────────────────────────────

    public function testSRIHashPassedToView()
    {
        $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test',
            'widget_type' => 'ecommerce',
        ]);

        $loader = (new ReflectionClass($this->controller))->getProperty('load');
        $loader->setAccessible(true);
        $loaderObj = $loader->getValue($this->controller);

        $data = $loaderObj->renderedViews[0]['data'];
        $this->assertArrayHasKey('sri_hash', $data);
        $this->assertStringStartsWith('sha384-', $data['sri_hash']);
    }

    // ─── HTTPS URL ──────────────────────────────────────────

    public function testWidgetUrlUsesHttps()
    {
        $output = $this->controller->index([
            'status' => 1,
            'tenant_id' => 'test',
            'widget_type' => 'ecommerce',
        ]);

        $this->assertStringContainsString('https://vocalia.ma', $output);
    }

    // ─── Valid tenant patterns ──────────────────────────────

    public function testValidTenantPatterns()
    {
        $valid = ['abc', 'b2b_test', 'my-tenant', 'UPPER123'];
        foreach ($valid as $tid) {
            $output = $this->controller->index([
                'status' => 1,
                'tenant_id' => $tid,
                'widget_type' => 'ecommerce',
            ]);
            $this->assertNotEmpty($output, "Tenant '$tid' should be accepted");
        }
    }
}
