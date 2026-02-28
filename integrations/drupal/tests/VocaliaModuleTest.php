<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/bootstrap.php';

class VocaliaModuleTest extends TestCase
{
    protected function setUp(): void
    {
        // Reset globals
        Drupal::setService('router.admin_context', new StubAdminContext(false));
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => true,
            'tenant_id' => 'test_tenant',
            'widget_type' => 'ecommerce',
        ]));

        // Load module functions
        if (!function_exists('vocalia_page_attachments')) {
            require_once dirname(__DIR__) . '/vocalia.module';
        }
    }

    // ─── page_attachments hook ──────────────────────────────

    public function testWidgetInjectsOnFrontend()
    {
        $attachments = [];
        vocalia_page_attachments($attachments);

        $this->assertArrayHasKey('#attached', $attachments);
        $tag = $attachments['#attached']['html_head'][0][0];
        $this->assertEquals('script', $tag['#tag']);
        $this->assertEquals('test_tenant', $tag['#attributes']['data-vocalia-tenant']);
        $this->assertStringContainsString('voice-widget-ecommerce.js', $tag['#attributes']['src']);
        $this->assertTrue($tag['#attributes']['defer']);
    }

    public function testWidgetB2bType()
    {
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => true,
            'tenant_id' => 'test_tenant',
            'widget_type' => 'b2b',
        ]));

        $attachments = [];
        vocalia_page_attachments($attachments);

        $tag = $attachments['#attached']['html_head'][0][0];
        $this->assertStringContainsString('voice-widget-b2b.js', $tag['#attributes']['src']);
    }

    public function testWidgetDisabled()
    {
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => false,
            'tenant_id' => 'test_tenant',
        ]));

        $attachments = [];
        vocalia_page_attachments($attachments);
        $this->assertArrayNotHasKey('#attached', $attachments);
    }

    public function testWidgetEmptyTenant()
    {
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => true,
            'tenant_id' => '',
        ]));

        $attachments = [];
        vocalia_page_attachments($attachments);
        $this->assertArrayNotHasKey('#attached', $attachments);
    }

    public function testWidgetInvalidTenant()
    {
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => true,
            'tenant_id' => '<script>xss</script>',
        ]));

        $attachments = [];
        vocalia_page_attachments($attachments);
        $this->assertArrayNotHasKey('#attached', $attachments);
    }

    public function testWidgetSkipsAdminPages()
    {
        Drupal::setService('router.admin_context', new StubAdminContext(true));

        $attachments = [];
        vocalia_page_attachments($attachments);
        $this->assertArrayNotHasKey('#attached', $attachments);
    }

    public function testCdnUrlPointsToVocaliaMa()
    {
        $attachments = [];
        vocalia_page_attachments($attachments);

        $src = $attachments['#attached']['html_head'][0][0]['#attributes']['src'];
        $this->assertStringContainsString('vocalia.ma/voice-assistant/', $src);
        $this->assertStringNotContainsString('api.vocalia.ma', $src);
    }

    public function testWidgetIdentifier()
    {
        $attachments = [];
        vocalia_page_attachments($attachments);

        $identifier = $attachments['#attached']['html_head'][0][1];
        $this->assertEquals('vocalia_widget', $identifier);
    }

    public function testNullTenantTreatedAsEmpty()
    {
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => true,
            'tenant_id' => null,
        ]));

        $attachments = [];
        vocalia_page_attachments($attachments);
        $this->assertArrayNotHasKey('#attached', $attachments);
    }

    public function testDefaultWidgetTypeIsEcommerce()
    {
        Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
            'enabled' => true,
            'tenant_id' => 'test',
            // widget_type not set
        ]));

        $attachments = [];
        vocalia_page_attachments($attachments);

        $src = $attachments['#attached']['html_head'][0][0]['#attributes']['src'];
        $this->assertStringContainsString('voice-widget-ecommerce.js', $src);
    }

    // ─── help hook ──────────────────────────────────────────

    public function testHelpReturnsContentForVocaliaPage()
    {
        $result = vocalia_help('help.page.vocalia', new class implements \Drupal\Core\Routing\RouteMatchInterface {});
        $this->assertStringContainsString('VocalIA', $result);
        $this->assertStringContainsString('<a href=', $result);
    }

    public function testHelpReturnsNullForOtherPages()
    {
        $result = vocalia_help('help.page.other', new class implements \Drupal\Core\Routing\RouteMatchInterface {});
        $this->assertNull($result);
    }

    // ─── Valid tenant patterns ──────────────────────────────

    public function testValidTenantPatterns()
    {
        $valid = ['abc', 'b2b_test', 'my-tenant', 'UPPER'];
        foreach ($valid as $tid) {
            Drupal::setService('config.vocalia.settings', new StubImmutableConfig([
                'enabled' => true,
                'tenant_id' => $tid,
                'widget_type' => 'ecommerce',
            ]));
            $attachments = [];
            vocalia_page_attachments($attachments);
            $this->assertArrayHasKey('#attached', $attachments, "Tenant '$tid' should be accepted");
        }
    }
}
