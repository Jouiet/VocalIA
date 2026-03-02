<?php
/**
 * Plugin Name: VocalIA Voice Assistant
 * Plugin URI: https://vocalia.ma/integrations
 * Description: Add the VocalIA AI voice assistant to your WordPress site. No coding required.
 * Version: 1.0.0
 * Author: VocalIA
 * Author URI: https://vocalia.ma
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: vocalia-voice-assistant
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('VOCALIA_VERSION', '1.0.0');
define('VOCALIA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('VOCALIA_CDN_BASE', 'https://vocalia.ma/voice-assistant');
define('VOCALIA_SRI_ECOMMERCE', 'sha384-IS/hVYvfFRdc59Gec4Yszm8TlUctq1dScFrxRJo50FVftCcfXdKbUOOVJwnx9qq3'); // Auto-updated by build-widgets.cjs
define('VOCALIA_SRI_B2B', 'sha384-kAb/ZXzAasi/oaJ9sKFcnUt8Ott4+DWvMTGbF8OxtbWdVkPUZ6Pf6q1Vu2MGBkoB'); // Auto-updated by build-widgets.cjs

/**
 * Register settings page
 */
function vocalia_add_settings_page() {
    add_options_page(
        __('VocalIA Voice Assistant', 'vocalia-voice-assistant'),
        __('VocalIA', 'vocalia-voice-assistant'),
        'manage_options',
        'vocalia-settings',
        'vocalia_render_settings_page'
    );
}
add_action('admin_menu', 'vocalia_add_settings_page');

/**
 * Register settings
 */
function vocalia_register_settings() {
    register_setting('vocalia_settings', 'vocalia_tenant_id', [
        'type' => 'string',
        'sanitize_callback' => 'vocalia_sanitize_tenant_id',
        'default' => '',
    ]);
    register_setting('vocalia_settings', 'vocalia_widget_type', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default' => 'b2b',
    ]);
    register_setting('vocalia_settings', 'vocalia_enabled', [
        'type' => 'boolean',
        'sanitize_callback' => 'rest_sanitize_boolean',
        'default' => true,
    ]);
    register_setting('vocalia_settings', 'vocalia_pages', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default' => 'all',
    ]);
    register_setting('vocalia_settings', 'vocalia_plugin_token', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default' => '',
    ]);
}
add_action('admin_init', 'vocalia_register_settings');

/**
 * Handle OAuth plugin-connect callback
 */
function vocalia_handle_plugin_connect_callback() {
    if (!current_user_can('manage_options')) {
        return;
    }
    if (!isset($_GET['page']) || $_GET['page'] !== 'vocalia-settings') {
        return;
    }

    // Handle disconnect
    if (isset($_GET['vocalia_disconnect']) && $_GET['vocalia_disconnect'] === '1') {
        check_admin_referer('vocalia_disconnect');
        delete_option('vocalia_tenant_id');
        delete_option('vocalia_plugin_token');
        add_settings_error('vocalia_settings', 'disconnected', __('Disconnected from VocalIA.', 'vocalia-voice-assistant'), 'updated');
        return;
    }

    // Handle connect callback
    if (isset($_GET['vocalia_token']) && isset($_GET['tenant_id']) && isset($_GET['nonce'])) {
        $stored_nonce = get_transient('vocalia_connect_nonce');
        if ($stored_nonce && hash_equals($stored_nonce, sanitize_text_field($_GET['nonce']))) {
            update_option('vocalia_tenant_id', vocalia_sanitize_tenant_id($_GET['tenant_id']));
            update_option('vocalia_plugin_token', sanitize_text_field($_GET['vocalia_token']));
            delete_transient('vocalia_connect_nonce');
            add_settings_error('vocalia_settings', 'connected', __('Connected to VocalIA! Your domain has been auto-registered.', 'vocalia-voice-assistant'), 'updated');
        } else {
            add_settings_error('vocalia_settings', 'nonce_error', __('Connection failed: invalid nonce. Please try again.', 'vocalia-voice-assistant'), 'error');
        }
    }
}
add_action('admin_init', 'vocalia_handle_plugin_connect_callback');

/**
 * Sanitize tenant ID — only allow alphanumeric, hyphens, underscores
 */
function vocalia_sanitize_tenant_id($value) {
    $value = sanitize_text_field($value);
    if (!empty($value) && !preg_match('/^[a-z0-9_-]+$/i', $value)) {
        add_settings_error('vocalia_tenant_id', 'invalid_format', __('Tenant ID must contain only letters, numbers, hyphens, and underscores.', 'vocalia-voice-assistant'));
        return get_option('vocalia_tenant_id', '');
    }
    return $value;
}

/**
 * Render settings page
 */
function vocalia_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $tenant_id = get_option('vocalia_tenant_id', '');
    $plugin_token = get_option('vocalia_plugin_token', '');
    $widget_type = get_option('vocalia_widget_type', 'b2b');
    $enabled = get_option('vocalia_enabled', true);
    $pages = get_option('vocalia_pages', 'all');
    $is_connected = !empty($tenant_id) && !empty($plugin_token);

    settings_errors('vocalia_settings');
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

        <?php if ($is_connected) : ?>
        <!-- Connected state -->
        <div class="notice notice-success" style="border-left-color: #6366f1;">
            <p style="font-size: 14px;">
                <strong style="color: #6366f1;"><?php esc_html_e('Connected to VocalIA', 'vocalia-voice-assistant'); ?></strong><br>
                <?php printf(
                    /* translators: %s: tenant ID */
                    esc_html__('Tenant: %s', 'vocalia-voice-assistant'),
                    '<code>' . esc_html($tenant_id) . '</code>'
                ); ?>
                &nbsp;|&nbsp;
                <a href="<?php echo esc_url(wp_nonce_url(admin_url('options-general.php?page=vocalia-settings&vocalia_disconnect=1'), 'vocalia_disconnect')); ?>" style="color: #dc2626;">
                    <?php esc_html_e('Disconnect', 'vocalia-voice-assistant'); ?>
                </a>
            </p>
        </div>
        <?php elseif (empty($tenant_id)) : ?>
        <!-- Not connected — show Connect button -->
        <div class="card" style="max-width: 520px; padding: 20px; border-left: 4px solid #6366f1;">
            <h2 style="margin-top: 0;"><?php esc_html_e('Connect your VocalIA account', 'vocalia-voice-assistant'); ?></h2>
            <p><?php esc_html_e('Click below to connect your VocalIA account. Your domain will be auto-registered.', 'vocalia-voice-assistant'); ?></p>
            <?php
            $nonce = wp_generate_password(32, false);
            set_transient('vocalia_connect_nonce', $nonce, 600); // 10 min expiry
            $return_url = admin_url('options-general.php?page=vocalia-settings');
            $connect_url = 'https://api.vocalia.ma/api/auth/plugin-authorize?' . http_build_query([
                'platform' => 'wordpress',
                'return_url' => $return_url,
                'nonce' => $nonce,
            ]);
            ?>
            <a href="<?php echo esc_url($connect_url); ?>" class="button button-primary button-hero" style="background: #6366f1; border-color: #4f46e5; font-size: 15px;">
                <?php esc_html_e('Connect with VocalIA', 'vocalia-voice-assistant'); ?>
            </a>
            <hr style="margin: 20px 0;">
            <details>
                <summary style="cursor: pointer; color: #6b7280;"><?php esc_html_e('Or configure manually', 'vocalia-voice-assistant'); ?></summary>
                <div style="margin-top: 10px;">
                    <form method="post" action="options.php">
                        <?php settings_fields('vocalia_settings'); ?>
                        <label for="vocalia_tenant_id"><?php esc_html_e('Tenant ID', 'vocalia-voice-assistant'); ?></label><br>
                        <input type="text" id="vocalia_tenant_id" name="vocalia_tenant_id"
                               value="<?php echo esc_attr($tenant_id); ?>"
                               class="regular-text" placeholder="e.g. mycompany_a1b2"
                               pattern="[a-z0-9_-]+" title="<?php esc_attr_e('Lowercase letters, numbers, underscores, hyphens', 'vocalia-voice-assistant'); ?>">
                        <p class="description">
                            <?php printf(
                                /* translators: %s: dashboard URL */
                                esc_html__('Find your Tenant ID in your %s under Settings.', 'vocalia-voice-assistant'),
                                '<a href="https://vocalia.ma/app/client/settings.html" target="_blank" rel="noopener">' . esc_html__('VocalIA dashboard', 'vocalia-voice-assistant') . '</a>'
                            ); ?>
                        </p>
                        <?php submit_button(__('Save', 'vocalia-voice-assistant'), 'secondary'); ?>
                    </form>
                </div>
            </details>
        </div>
        <?php
        return; // Don't show widget config until connected
        endif; ?>

        <!-- Widget configuration (shown when connected or tenant ID set) -->
        <form method="post" action="options.php">
            <?php settings_fields('vocalia_settings'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="vocalia_enabled"><?php esc_html_e('Enable Widget', 'vocalia-voice-assistant'); ?></label>
                    </th>
                    <td>
                        <input type="checkbox" id="vocalia_enabled" name="vocalia_enabled" value="1" <?php checked($enabled); ?>>
                        <p class="description"><?php esc_html_e('Show the VocalIA voice assistant on your site.', 'vocalia-voice-assistant'); ?></p>
                    </td>
                </tr>
                <?php if (!$is_connected) : ?>
                <tr>
                    <th scope="row">
                        <label for="vocalia_tenant_id"><?php esc_html_e('Tenant ID', 'vocalia-voice-assistant'); ?></label>
                    </th>
                    <td>
                        <input type="text" id="vocalia_tenant_id" name="vocalia_tenant_id"
                               value="<?php echo esc_attr($tenant_id); ?>"
                               class="regular-text" placeholder="e.g. mycompany_a1b2"
                               pattern="[a-z0-9_-]+">
                    </td>
                </tr>
                <?php endif; ?>
                <tr>
                    <th scope="row">
                        <label for="vocalia_widget_type"><?php esc_html_e('Widget Type', 'vocalia-voice-assistant'); ?></label>
                    </th>
                    <td>
                        <select id="vocalia_widget_type" name="vocalia_widget_type">
                            <option value="b2b" <?php selected($widget_type, 'b2b'); ?>><?php esc_html_e('B2B / Service Business', 'vocalia-voice-assistant'); ?></option>
                            <option value="ecommerce" <?php selected($widget_type, 'ecommerce'); ?>><?php esc_html_e('E-commerce', 'vocalia-voice-assistant'); ?></option>
                        </select>
                        <p class="description"><?php esc_html_e('B2B for service businesses, E-commerce for online stores.', 'vocalia-voice-assistant'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="vocalia_pages"><?php esc_html_e('Show On', 'vocalia-voice-assistant'); ?></label>
                    </th>
                    <td>
                        <select id="vocalia_pages" name="vocalia_pages">
                            <option value="all" <?php selected($pages, 'all'); ?>><?php esc_html_e('All pages', 'vocalia-voice-assistant'); ?></option>
                            <option value="front" <?php selected($pages, 'front'); ?>><?php esc_html_e('Homepage only', 'vocalia-voice-assistant'); ?></option>
                            <option value="shop" <?php selected($pages, 'shop'); ?>><?php esc_html_e('Shop pages only (WooCommerce)', 'vocalia-voice-assistant'); ?></option>
                        </select>
                    </td>
                </tr>
            </table>

            <!-- Hidden field to preserve tenant_id when connected -->
            <?php if ($is_connected) : ?>
            <input type="hidden" name="vocalia_tenant_id" value="<?php echo esc_attr($tenant_id); ?>">
            <input type="hidden" name="vocalia_plugin_token" value="<?php echo esc_attr($plugin_token); ?>">
            <?php endif; ?>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

/**
 * Inject widget script in frontend
 */
function vocalia_enqueue_widget() {
    $enabled = get_option('vocalia_enabled', true);
    if (!$enabled) {
        return;
    }

    $tenant_id = get_option('vocalia_tenant_id', '');
    if (empty($tenant_id)) {
        return;
    }

    // Page filtering
    $pages = get_option('vocalia_pages', 'all');
    if ($pages === 'front' && !is_front_page()) {
        return;
    }
    if ($pages === 'shop' && function_exists('is_woocommerce') && !is_woocommerce() && !is_cart() && !is_checkout()) {
        return;
    }

    $widget_type = get_option('vocalia_widget_type', 'b2b');
    $widget_file = ($widget_type === 'ecommerce') ? 'voice-widget-ecommerce.js' : 'voice-widget-b2b.js';
    $script_url = VOCALIA_CDN_BASE . '/' . $widget_file;

    wp_enqueue_script(
        'vocalia-widget',
        $script_url,
        [],
        VOCALIA_VERSION,
        ['strategy' => 'defer', 'in_footer' => true]
    );

    // Pass tenant ID + SRI via data attribute (wp_enqueue_script doesn't support custom attributes natively)
    $sri = ($widget_type === 'ecommerce') ? VOCALIA_SRI_ECOMMERCE : VOCALIA_SRI_B2B;
    add_filter('script_loader_tag', function($tag, $handle) use ($tenant_id, $sri) {
        if ($handle === 'vocalia-widget') {
            $tag = str_replace(' src=', ' data-vocalia-tenant="' . esc_attr($tenant_id) . '" integrity="' . esc_attr($sri) . '" crossorigin="anonymous" src=', $tag);
        }
        return $tag;
    }, 10, 2);
}
add_action('wp_enqueue_scripts', 'vocalia_enqueue_widget');

/**
 * Add settings link on plugins page
 */
function vocalia_plugin_action_links($links) {
    $settings_link = '<a href="' . esc_url(admin_url('options-general.php?page=vocalia-settings')) . '">' . esc_html__('Settings', 'vocalia-voice-assistant') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'vocalia_plugin_action_links');

/**
 * Activation hook — auto-detect domain and prompt for tenant ID
 */
function vocalia_activate() {
    // Set defaults on activation
    if (get_option('vocalia_enabled') === false) {
        update_option('vocalia_enabled', true);
    }
    if (empty(get_option('vocalia_widget_type'))) {
        // Auto-detect WooCommerce
        if (class_exists('WooCommerce') || is_plugin_active('woocommerce/woocommerce.php')) {
            update_option('vocalia_widget_type', 'ecommerce');
        } else {
            update_option('vocalia_widget_type', 'b2b');
        }
    }
}
register_activation_hook(__FILE__, 'vocalia_activate');

/**
 * Uninstall hook — clean up options
 */
function vocalia_uninstall() {
    delete_option('vocalia_tenant_id');
    delete_option('vocalia_widget_type');
    delete_option('vocalia_enabled');
    delete_option('vocalia_pages');
    delete_option('vocalia_plugin_token');
}
register_uninstall_hook(__FILE__, 'vocalia_uninstall');
