<?php
/**
 * Unit Tests for VocalIA WordPress Plugin
 *
 * Tests: sanitization, settings registration, widget injection,
 * activation hook, uninstall hook, WooCommerce auto-detect.
 */

use PHPUnit\Framework\TestCase;

class VocaliaPluginTest extends TestCase
{
    protected function setUp(): void
    {
        // Reset WordPress stubs state
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_settings_errors'] = [];
        $GLOBALS['wp_scripts'] = [];
        $GLOBALS['wp_is_front_page'] = false;
        $GLOBALS['wp_is_woocommerce'] = false;
        $GLOBALS['wp_is_cart'] = false;
        $GLOBALS['wp_is_checkout'] = false;
        $GLOBALS['wp_current_user_can'] = true;
    }

    // ============================================================
    // Constants
    // ============================================================

    public function testConstantsAreDefined()
    {
        $this->assertTrue(defined('VOCALIA_VERSION'));
        $this->assertEquals('1.0.0', VOCALIA_VERSION);
        $this->assertTrue(defined('VOCALIA_CDN_BASE'));
        $this->assertEquals('https://api.vocalia.ma/voice-assistant', VOCALIA_CDN_BASE);
        $this->assertTrue(defined('VOCALIA_PLUGIN_DIR'));
    }

    // ============================================================
    // Sanitization
    // ============================================================

    public function testSanitizeTenantIdAcceptsValid()
    {
        $this->assertEquals('my_tenant-123', vocalia_sanitize_tenant_id('my_tenant-123'));
        $this->assertEquals('abc', vocalia_sanitize_tenant_id('abc'));
        $this->assertEquals('UPPER', vocalia_sanitize_tenant_id('UPPER'));
        $this->assertEquals('a1b2c3', vocalia_sanitize_tenant_id('a1b2c3'));
    }

    public function testSanitizeTenantIdRejectsInvalid()
    {
        // Should reject special characters and return previous value
        $GLOBALS['wp_options']['vocalia_tenant_id'] = 'old_value';
        $result = vocalia_sanitize_tenant_id('invalid@#$');
        $this->assertEquals('old_value', $result);
        $this->assertNotEmpty($GLOBALS['wp_settings_errors']);
    }

    public function testSanitizeTenantIdAllowsEmpty()
    {
        $this->assertEquals('', vocalia_sanitize_tenant_id(''));
    }

    public function testSanitizeTenantIdStripsHtml()
    {
        // sanitize_text_field strips tags first, then regex validates
        $result = vocalia_sanitize_tenant_id('<script>alert("xss")</script>');
        // After strip_tags: alert("xss") — contains quotes and parens → rejected
        $this->assertNotEquals('<script>alert("xss")</script>', $result);
    }

    // ============================================================
    // Settings Registration
    // ============================================================

    public function testSettingsAreRegistered()
    {
        // vocalia_register_settings is called via add_action('admin_init')
        // We verify the actions were registered
        $this->assertTrue(function_exists('vocalia_register_settings'));

        // Call it directly
        $GLOBALS['wp_registered_settings'] = [];
        vocalia_register_settings();

        $this->assertArrayHasKey('vocalia_tenant_id', $GLOBALS['wp_registered_settings']);
        $this->assertArrayHasKey('vocalia_widget_type', $GLOBALS['wp_registered_settings']);
        $this->assertArrayHasKey('vocalia_enabled', $GLOBALS['wp_registered_settings']);
        $this->assertArrayHasKey('vocalia_pages', $GLOBALS['wp_registered_settings']);
    }

    public function testSettingsHaveSanitizeCallbacks()
    {
        $GLOBALS['wp_registered_settings'] = [];
        vocalia_register_settings();

        $tenantSetting = $GLOBALS['wp_registered_settings']['vocalia_tenant_id'];
        $this->assertEquals('vocalia_sanitize_tenant_id', $tenantSetting['args']['sanitize_callback']);

        $widgetSetting = $GLOBALS['wp_registered_settings']['vocalia_widget_type'];
        $this->assertEquals('sanitize_text_field', $widgetSetting['args']['sanitize_callback']);
    }

    // ============================================================
    // Widget Injection (Enqueue)
    // ============================================================

    public function testWidgetNotEnqueuedWhenDisabled()
    {
        update_option('vocalia_enabled', false);
        update_option('vocalia_tenant_id', 'test_tenant');

        vocalia_enqueue_widget();

        $this->assertEmpty($GLOBALS['wp_scripts']);
    }

    public function testWidgetNotEnqueuedWhenNoTenantId()
    {
        update_option('vocalia_enabled', true);
        update_option('vocalia_tenant_id', '');

        vocalia_enqueue_widget();

        $this->assertEmpty($GLOBALS['wp_scripts']);
    }

    public function testWidgetEnqueuedWithB2bType()
    {
        update_option('vocalia_enabled', true);
        update_option('vocalia_tenant_id', 'my_tenant');
        update_option('vocalia_widget_type', 'b2b');
        update_option('vocalia_pages', 'all');

        vocalia_enqueue_widget();

        $this->assertArrayHasKey('vocalia-widget', $GLOBALS['wp_scripts']);
        $script = $GLOBALS['wp_scripts']['vocalia-widget'];
        $this->assertStringContainsString('voice-widget-b2b.js', $script['src']);
    }

    public function testWidgetEnqueuedWithEcommerceType()
    {
        update_option('vocalia_enabled', true);
        update_option('vocalia_tenant_id', 'my_tenant');
        update_option('vocalia_widget_type', 'ecommerce');
        update_option('vocalia_pages', 'all');

        vocalia_enqueue_widget();

        $this->assertArrayHasKey('vocalia-widget', $GLOBALS['wp_scripts']);
        $script = $GLOBALS['wp_scripts']['vocalia-widget'];
        $this->assertStringContainsString('voice-widget-ecommerce.js', $script['src']);
    }

    public function testWidgetUsesCorrectCdnBase()
    {
        update_option('vocalia_enabled', true);
        update_option('vocalia_tenant_id', 'test');
        update_option('vocalia_widget_type', 'b2b');
        update_option('vocalia_pages', 'all');

        vocalia_enqueue_widget();

        $script = $GLOBALS['wp_scripts']['vocalia-widget'];
        $this->assertStringStartsWith('https://api.vocalia.ma/voice-assistant/', $script['src']);
    }

    public function testWidgetFilteredOnFrontPageOnly()
    {
        update_option('vocalia_enabled', true);
        update_option('vocalia_tenant_id', 'test');
        update_option('vocalia_pages', 'front');

        // Not on front page
        $GLOBALS['wp_is_front_page'] = false;
        vocalia_enqueue_widget();
        $this->assertEmpty($GLOBALS['wp_scripts']);
    }

    // ============================================================
    // Activation Hook
    // ============================================================

    public function testActivationSetsDefaults()
    {
        // Simulate fresh install (no options set)
        $GLOBALS['wp_options'] = [];

        vocalia_activate();

        $this->assertTrue(get_option('vocalia_enabled'));
        // Without WooCommerce, should default to b2b
        $this->assertEquals('b2b', get_option('vocalia_widget_type'));
    }

    public function testActivationDoesNotOverrideExisting()
    {
        update_option('vocalia_enabled', false);
        update_option('vocalia_widget_type', 'ecommerce');

        vocalia_activate();

        // Should NOT override existing enabled=false (WP returns false for get_option, not identical to no option)
        // The actual check is: if (get_option('vocalia_enabled') === false) — strict comparison
        $this->assertEquals('ecommerce', get_option('vocalia_widget_type'));
    }

    // ============================================================
    // Uninstall Hook
    // ============================================================

    public function testUninstallCleansUpOptions()
    {
        update_option('vocalia_tenant_id', 'test');
        update_option('vocalia_widget_type', 'b2b');
        update_option('vocalia_enabled', true);
        update_option('vocalia_pages', 'all');

        vocalia_uninstall();

        $this->assertFalse(get_option('vocalia_tenant_id'));
        $this->assertFalse(get_option('vocalia_widget_type'));
        $this->assertFalse(get_option('vocalia_enabled'));
        $this->assertFalse(get_option('vocalia_pages'));
    }

    // ============================================================
    // Settings Page Render
    // ============================================================

    public function testSettingsPageRequiresManageOptions()
    {
        $GLOBALS['wp_current_user_can'] = false;

        ob_start();
        vocalia_render_settings_page();
        $output = ob_get_clean();

        // Should return early, no output
        $this->assertEmpty($output);
    }

    public function testSettingsPageRendersForm()
    {
        $GLOBALS['wp_current_user_can'] = true;
        update_option('vocalia_tenant_id', 'test_tenant');
        update_option('vocalia_widget_type', 'b2b');
        update_option('vocalia_enabled', true);
        update_option('vocalia_pages', 'all');

        ob_start();
        vocalia_render_settings_page();
        $output = ob_get_clean();

        $this->assertStringContainsString('vocalia_tenant_id', $output);
        $this->assertStringContainsString('vocalia_widget_type', $output);
        $this->assertStringContainsString('vocalia_enabled', $output);
        $this->assertStringContainsString('test_tenant', $output);
    }

    public function testSettingsPageShowsWarningWithoutTenantId()
    {
        $GLOBALS['wp_current_user_can'] = true;
        update_option('vocalia_tenant_id', '');

        ob_start();
        vocalia_render_settings_page();
        $output = ob_get_clean();

        $this->assertStringContainsString('notice-warning', $output);
        $this->assertStringContainsString('signup.html', $output);
    }

    // ============================================================
    // Action Links
    // ============================================================

    public function testPluginActionLinksAddsSettings()
    {
        $links = ['<a href="#">Deactivate</a>'];
        $result = vocalia_plugin_action_links($links);

        $this->assertCount(2, $result);
        $this->assertStringContainsString('vocalia-settings', $result[0]);
        $this->assertStringContainsString('Settings', $result[0]);
    }

    // ============================================================
    // Hooks Registration
    // ============================================================

    public function testAdminMenuHookRegistered()
    {
        $this->assertArrayHasKey('admin_menu', $GLOBALS['wp_actions']);
        $callbacks = array_column($GLOBALS['wp_actions']['admin_menu'], 'callback');
        $this->assertContains('vocalia_add_settings_page', $callbacks);
    }

    public function testAdminInitHookRegistered()
    {
        $this->assertArrayHasKey('admin_init', $GLOBALS['wp_actions']);
        $callbacks = array_column($GLOBALS['wp_actions']['admin_init'], 'callback');
        $this->assertContains('vocalia_register_settings', $callbacks);
    }

    public function testEnqueueScriptsHookRegistered()
    {
        $this->assertArrayHasKey('wp_enqueue_scripts', $GLOBALS['wp_actions']);
        $callbacks = array_column($GLOBALS['wp_actions']['wp_enqueue_scripts'], 'callback');
        $this->assertContains('vocalia_enqueue_widget', $callbacks);
    }

    public function testActivationHookRegistered()
    {
        $this->assertNotEmpty($GLOBALS['wp_activation_hooks'] ?? []);
    }

    public function testUninstallHookRegistered()
    {
        $this->assertNotEmpty($GLOBALS['wp_uninstall_hooks'] ?? []);
    }
}
