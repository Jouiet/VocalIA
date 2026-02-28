<?php
/**
 * Unit Tests for VocalIA PrestaShop Module
 *
 * Tests: install/uninstall, configuration, hook registration,
 * form rendering, input sanitization, widget output.
 */

use PHPUnit\Framework\TestCase;

class VocaliaModuleTest extends TestCase
{
    private Vocalia $module;

    protected function setUp(): void
    {
        Configuration::reset();
        Tools::resetSubmit();
        $this->module = new Vocalia();
    }

    // ============================================================
    // Module Metadata
    // ============================================================

    public function testModuleNameIsVocalia()
    {
        $this->assertEquals('vocalia', $this->module->name);
    }

    public function testModuleVersion()
    {
        $this->assertEquals('1.0.0', $this->module->version);
    }

    public function testModuleAuthor()
    {
        $this->assertEquals('VocalIA', $this->module->author);
    }

    public function testModuleTab()
    {
        $this->assertEquals('front_office_features', $this->module->tab);
    }

    public function testPsVersionCompliancy()
    {
        $this->assertEquals('1.7.0.0', $this->module->ps_versions_compliancy['min']);
        $this->assertEquals('8.99.99', $this->module->ps_versions_compliancy['max']);
    }

    public function testDisplayNameIsSet()
    {
        $this->assertNotEmpty($this->module->displayName);
        $this->assertStringContainsString('VocalIA', $this->module->displayName);
    }

    public function testDescriptionIsSet()
    {
        $this->assertNotEmpty($this->module->description);
    }

    public function testConfirmUninstallIsSet()
    {
        $this->assertNotEmpty($this->module->confirmUninstall);
    }

    // ============================================================
    // Install / Uninstall
    // ============================================================

    public function testInstallReturnsTrue()
    {
        $result = $this->module->install();
        $this->assertTrue($result);
    }

    public function testInstallRegistersHooks()
    {
        $this->module->install();
        $hooks = $this->module->getRegisteredHooks();
        $this->assertContains('displayBeforeBodyClosingTag', $hooks);
        $this->assertContains('displayFooter', $hooks);
    }

    public function testInstallSetsDefaultConfiguration()
    {
        $this->module->install();
        $this->assertEquals('', Configuration::get('VOCALIA_TENANT_ID'));
        $this->assertEquals('ecommerce', Configuration::get('VOCALIA_WIDGET_TYPE'));
        $this->assertTrue(Configuration::get('VOCALIA_ENABLED'));
    }

    public function testUninstallReturnsTrue()
    {
        $this->module->install();
        $result = $this->module->uninstall();
        $this->assertTrue($result);
    }

    public function testUninstallRemovesConfiguration()
    {
        $this->module->install();
        $this->module->uninstall();
        $this->assertFalse(Configuration::get('VOCALIA_TENANT_ID'));
        $this->assertFalse(Configuration::get('VOCALIA_WIDGET_TYPE'));
        $this->assertFalse(Configuration::get('VOCALIA_ENABLED'));
    }

    // ============================================================
    // Configuration Form (getContent)
    // ============================================================

    public function testGetContentRendersForm()
    {
        $this->module->install();
        $output = $this->module->getContent();
        $this->assertStringContainsString('VOCALIA_TENANT_ID', $output);
        $this->assertStringContainsString('VOCALIA_WIDGET_TYPE', $output);
        $this->assertStringContainsString('VOCALIA_ENABLED', $output);
    }

    public function testGetContentSavesValidSettings()
    {
        $this->module->install();
        Tools::simulateSubmit('submitVocaliaSettings', [
            'VOCALIA_TENANT_ID' => 'my_tenant_123',
            'VOCALIA_WIDGET_TYPE' => 'b2b',
            'VOCALIA_ENABLED' => '1',
        ]);

        $output = $this->module->getContent();

        $this->assertEquals('my_tenant_123', Configuration::get('VOCALIA_TENANT_ID'));
        $this->assertEquals('b2b', Configuration::get('VOCALIA_WIDGET_TYPE'));
        $this->assertStringContainsString('alert-success', $output);
    }

    public function testGetContentRejectsInvalidTenantId()
    {
        $this->module->install();
        Tools::simulateSubmit('submitVocaliaSettings', [
            'VOCALIA_TENANT_ID' => 'invalid@#$%',
            'VOCALIA_WIDGET_TYPE' => 'ecommerce',
            'VOCALIA_ENABLED' => '1',
        ]);

        $output = $this->module->getContent();

        $this->assertStringContainsString('alert-danger', $output);
        // Should NOT save the invalid tenant ID
        $this->assertNotEquals('invalid@#$%', Configuration::get('VOCALIA_TENANT_ID'));
    }

    public function testGetContentAcceptsEmptyTenantId()
    {
        $this->module->install();
        Configuration::updateValue('VOCALIA_TENANT_ID', 'old_value');

        Tools::simulateSubmit('submitVocaliaSettings', [
            'VOCALIA_TENANT_ID' => '',
            'VOCALIA_WIDGET_TYPE' => 'ecommerce',
            'VOCALIA_ENABLED' => '1',
        ]);

        $output = $this->module->getContent();

        // Empty is valid (user might want to disable)
        $this->assertEquals('', Configuration::get('VOCALIA_TENANT_ID'));
        $this->assertStringContainsString('alert-success', $output);
    }

    // ============================================================
    // Widget Rendering
    // ============================================================

    public function testWidgetRendersWhenEnabled()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test_tenant');
        Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'ecommerce');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        $this->assertStringContainsString('<script', $output);
        $this->assertStringContainsString('data-vocalia-tenant="test_tenant"', $output);
        $this->assertStringContainsString('voice-widget-ecommerce.js', $output);
        $this->assertStringContainsString('vocalia.ma', $output);
    }

    public function testWidgetRendersB2bType()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test_tenant');
        Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'b2b');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        $this->assertStringContainsString('voice-widget-b2b.js', $output);
    }

    public function testWidgetNotRenderedWhenDisabled()
    {
        Configuration::updateValue('VOCALIA_ENABLED', false);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test_tenant');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        $this->assertEmpty($output);
    }

    public function testWidgetNotRenderedWithoutTenantId()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', '');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        $this->assertEmpty($output);
    }

    public function testWidgetRenderedOnlyOnce()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test_tenant');
        Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'ecommerce');

        // First call via displayBeforeBodyClosingTag
        $output1 = $this->module->hookDisplayBeforeBodyClosingTag([]);
        // Second call via displayFooter (should be empty — double-render guard)
        $output2 = $this->module->hookDisplayFooter([]);

        $this->assertNotEmpty($output1);
        $this->assertEmpty($output2);
    }

    public function testWidgetEscapesTenantId()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test"onclick="alert(1)');
        Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'ecommerce');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        // Quotes must be escaped to prevent attribute breakout (XSS)
        $this->assertStringContainsString('&quot;', $output);
        // The raw unescaped double-quote must NOT appear in the tenant attribute
        $this->assertStringNotContainsString('data-vocalia-tenant="test"', $output);
    }

    public function testWidgetUsesDefer()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test');
        Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'b2b');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        $this->assertStringContainsString('defer', $output);
    }

    // ============================================================
    // Security
    // ============================================================

    public function testWidgetUrlUsesHttps()
    {
        Configuration::updateValue('VOCALIA_ENABLED', true);
        Configuration::updateValue('VOCALIA_TENANT_ID', 'test');
        Configuration::updateValue('VOCALIA_WIDGET_TYPE', 'ecommerce');

        $output = $this->module->hookDisplayBeforeBodyClosingTag([]);

        $this->assertStringContainsString('https://vocalia.ma', $output);
        $this->assertStringNotContainsString('http://', $output);
    }
}
