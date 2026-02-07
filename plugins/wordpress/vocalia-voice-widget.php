<?php
/**
 * Plugin Name: VocalIA Voice Widget
 * Plugin URI: https://vocalia.ma/integrations/wordpress
 * Description: Add AI-powered voice assistant to your WordPress site. Supports 5 languages (FR, EN, ES, AR, Darija) with 40 industry personas.
 * Version: 1.0.0
 * Author: VocalIA
 * Author URI: https://vocalia.ma
 * License: MIT
 * Text Domain: vocalia-voice-widget
 * Domain Path: /languages
 * Requires at least: 5.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

define('VOCALIA_VERSION', '1.0.0');
define('VOCALIA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('VOCALIA_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main VocalIA Voice Widget Class
 */
class VocalIA_Voice_Widget {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('wp_footer', array($this, 'render_widget'));
        add_action('admin_enqueue_scripts', array($this, 'admin_styles'));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('VocalIA Voice Widget', 'vocalia-voice-widget'),
            __('VocalIA Widget', 'vocalia-voice-widget'),
            'manage_options',
            'vocalia-voice-widget',
            array($this, 'render_admin_page')
        );
    }

    /**
     * Register plugin settings
     */
    public function register_settings() {
        // Main settings
        register_setting('vocalia_settings', 'vocalia_enabled', array(
            'type' => 'boolean',
            'default' => false,
            'sanitize_callback' => 'rest_sanitize_boolean'
        ));

        register_setting('vocalia_settings', 'vocalia_tenant_id', array(
            'type' => 'string',
            'default' => '',
            'sanitize_callback' => 'sanitize_text_field'
        ));

        register_setting('vocalia_settings', 'vocalia_api_key', array(
            'type' => 'string',
            'default' => '',
            'sanitize_callback' => 'sanitize_text_field'
        ));

        // Appearance settings
        register_setting('vocalia_settings', 'vocalia_position', array(
            'type' => 'string',
            'default' => 'bottom-right',
            'sanitize_callback' => 'sanitize_text_field'
        ));

        register_setting('vocalia_settings', 'vocalia_primary_color', array(
            'type' => 'string',
            'default' => '#5E6AD2',
            'sanitize_callback' => 'sanitize_hex_color'
        ));

        register_setting('vocalia_settings', 'vocalia_button_size', array(
            'type' => 'string',
            'default' => '60',
            'sanitize_callback' => 'absint'
        ));

        // Language settings
        register_setting('vocalia_settings', 'vocalia_language', array(
            'type' => 'string',
            'default' => 'auto',
            'sanitize_callback' => 'sanitize_text_field'
        ));

        // Persona settings
        register_setting('vocalia_settings', 'vocalia_persona', array(
            'type' => 'string',
            'default' => 'AGENCY',
            'sanitize_callback' => 'sanitize_text_field'
        ));

        // Display settings
        register_setting('vocalia_settings', 'vocalia_show_on_mobile', array(
            'type' => 'boolean',
            'default' => true,
            'sanitize_callback' => 'rest_sanitize_boolean'
        ));

        register_setting('vocalia_settings', 'vocalia_excluded_pages', array(
            'type' => 'string',
            'default' => '',
            'sanitize_callback' => 'sanitize_textarea_field'
        ));
    }

    /**
     * Admin page styles
     */
    public function admin_styles($hook) {
        if ('settings_page_vocalia-voice-widget' !== $hook) {
            return;
        }

        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script('wp-color-picker');
    }

    /**
     * Render admin settings page
     */
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Save message
        if (isset($_GET['settings-updated'])) {
            add_settings_error('vocalia_messages', 'vocalia_message',
                __('Settings saved.', 'vocalia-voice-widget'), 'updated');
        }

        settings_errors('vocalia_messages');

        $enabled = get_option('vocalia_enabled', false);
        $tenant_id = get_option('vocalia_tenant_id', '');
        $api_key = get_option('vocalia_api_key', '');
        $position = get_option('vocalia_position', 'bottom-right');
        $primary_color = get_option('vocalia_primary_color', '#5E6AD2');
        $button_size = get_option('vocalia_button_size', '60');
        $language = get_option('vocalia_language', 'auto');
        $persona = get_option('vocalia_persona', 'AGENCY');
        $show_mobile = get_option('vocalia_show_on_mobile', true);
        $excluded = get_option('vocalia_excluded_pages', '');

        $personas = array(
            'AGENCY' => 'Agence Digitale',
            'DENTAL' => 'Cabinet Dentaire',
            'PROPERTY' => 'Immobilier',
            'CONTRACTOR' => 'Artisan BTP',
            'HEALER' => 'Praticien Santé',
            'COUNSELOR' => 'Coach / Consultant',
            'CONCIERGE' => 'Conciergerie',
            'STYLIST' => 'Salon Coiffure/Beauté',
            'ACCOUNTANT' => 'Cabinet Comptable',
            'ARCHITECT' => 'Cabinet Architecture',
            'PHARMACIST' => 'Pharmacie',
            'RENTER' => 'Location Véhicules',
            'LAWYER' => 'Cabinet Avocat',
            'VET' => 'Clinique Vétérinaire',
            'TRAVEL' => 'Agence Voyage',
            'INSURANCE' => 'Assurance',
            'RESTAURANT' => 'Restaurant',
            'HOTEL' => 'Hôtellerie',
            'ECOMMERCE' => 'E-commerce',
            'SAAS' => 'SaaS / Tech',
            'HEALTHCARE' => 'Établissement Santé',
            'FINANCE' => 'Services Financiers',
            'EDUCATION' => 'Éducation',
            'NONPROFIT' => 'Association',
            'GOVERNMENT' => 'Service Public',
            'CUSTOM' => 'Personnalisé'
        );

        $languages = array(
            'auto' => 'Auto-detect (Geo)',
            'fr' => 'Français',
            'en' => 'English',
            'es' => 'Español',
            'ar' => 'العربية (MSA)',
            'ary' => 'الدارجة (Darija)'
        );

        $positions = array(
            'bottom-right' => 'Bottom Right',
            'bottom-left' => 'Bottom Left',
            'top-right' => 'Top Right',
            'top-left' => 'Top Left'
        );
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <div style="display: flex; gap: 30px; margin-top: 20px;">
                <!-- Settings Form -->
                <div style="flex: 1; max-width: 600px;">
                    <form action="options.php" method="post">
                        <?php settings_fields('vocalia_settings'); ?>

                        <!-- Enable/Disable -->
                        <table class="form-table">
                            <tr>
                                <th scope="row"><?php _e('Enable Widget', 'vocalia-voice-widget'); ?></th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="vocalia_enabled" value="1" <?php checked($enabled); ?>>
                                        <?php _e('Show voice widget on site', 'vocalia-voice-widget'); ?>
                                    </label>
                                </td>
                            </tr>
                        </table>

                        <h2 class="title"><?php _e('API Configuration', 'vocalia-voice-widget'); ?></h2>
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_tenant_id"><?php _e('Tenant ID', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <input type="text" id="vocalia_tenant_id" name="vocalia_tenant_id"
                                           value="<?php echo esc_attr($tenant_id); ?>" class="regular-text"
                                           placeholder="your_company_name">
                                    <p class="description">
                                        <?php _e('Your VocalIA tenant identifier. Get it from', 'vocalia-voice-widget'); ?>
                                        <a href="https://vocalia.ma/dashboard" target="_blank">vocalia.ma/dashboard</a>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_api_key"><?php _e('API Key', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <input type="password" id="vocalia_api_key" name="vocalia_api_key"
                                           value="<?php echo esc_attr($api_key); ?>" class="regular-text"
                                           placeholder="voc_xxxxxxxxxxxx">
                                    <p class="description">
                                        <?php _e('Your VocalIA API key for authentication.', 'vocalia-voice-widget'); ?>
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <h2 class="title"><?php _e('Persona & Language', 'vocalia-voice-widget'); ?></h2>
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_persona"><?php _e('Industry Persona', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <select id="vocalia_persona" name="vocalia_persona">
                                        <?php foreach ($personas as $key => $label): ?>
                                            <option value="<?php echo esc_attr($key); ?>" <?php selected($persona, $key); ?>>
                                                <?php echo esc_html($label); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <p class="description">
                                        <?php _e('AI personality adapted to your industry.', 'vocalia-voice-widget'); ?>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_language"><?php _e('Language', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <select id="vocalia_language" name="vocalia_language">
                                        <?php foreach ($languages as $key => $label): ?>
                                            <option value="<?php echo esc_attr($key); ?>" <?php selected($language, $key); ?>>
                                                <?php echo esc_html($label); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <p class="description">
                                        <?php _e('Auto-detect uses visitor geolocation.', 'vocalia-voice-widget'); ?>
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <h2 class="title"><?php _e('Appearance', 'vocalia-voice-widget'); ?></h2>
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_position"><?php _e('Position', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <select id="vocalia_position" name="vocalia_position">
                                        <?php foreach ($positions as $key => $label): ?>
                                            <option value="<?php echo esc_attr($key); ?>" <?php selected($position, $key); ?>>
                                                <?php echo esc_html($label); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_primary_color"><?php _e('Primary Color', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <input type="text" id="vocalia_primary_color" name="vocalia_primary_color"
                                           value="<?php echo esc_attr($primary_color); ?>" class="vocalia-color-picker">
                                    <script>
                                        jQuery(document).ready(function($) {
                                            $('.vocalia-color-picker').wpColorPicker();
                                        });
                                    </script>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_button_size"><?php _e('Button Size (px)', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <input type="number" id="vocalia_button_size" name="vocalia_button_size"
                                           value="<?php echo esc_attr($button_size); ?>" min="40" max="100" step="5">
                                </td>
                            </tr>
                        </table>

                        <h2 class="title"><?php _e('Display Rules', 'vocalia-voice-widget'); ?></h2>
                        <table class="form-table">
                            <tr>
                                <th scope="row"><?php _e('Mobile', 'vocalia-voice-widget'); ?></th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="vocalia_show_on_mobile" value="1" <?php checked($show_mobile); ?>>
                                        <?php _e('Show on mobile devices', 'vocalia-voice-widget'); ?>
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="vocalia_excluded_pages"><?php _e('Exclude Pages', 'vocalia-voice-widget'); ?></label>
                                </th>
                                <td>
                                    <textarea id="vocalia_excluded_pages" name="vocalia_excluded_pages"
                                              rows="3" class="large-text"><?php echo esc_textarea($excluded); ?></textarea>
                                    <p class="description">
                                        <?php _e('Page IDs or slugs to exclude, one per line.', 'vocalia-voice-widget'); ?>
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <?php submit_button(__('Save Settings', 'vocalia-voice-widget')); ?>
                    </form>
                </div>

                <!-- Preview Panel -->
                <div style="flex: 0 0 300px;">
                    <div style="background: #1e293b; border-radius: 12px; padding: 20px; color: white; position: sticky; top: 40px;">
                        <h3 style="margin-top: 0; color: #94a3b8;"><?php _e('Preview', 'vocalia-voice-widget'); ?></h3>
                        <div style="background: #0f172a; border-radius: 8px; height: 200px; position: relative; margin-bottom: 15px;">
                            <div id="vocalia-preview-button" style="
                                position: absolute;
                                bottom: 20px;
                                right: 20px;
                                width: 60px;
                                height: 60px;
                                border-radius: 50%;
                                background: <?php echo esc_attr($primary_color); ?>;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                box-shadow: 0 4px 20px rgba(94, 106, 210, 0.4);
                                cursor: pointer;
                            ">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                        </div>

                        <h4 style="color: #94a3b8; margin-bottom: 10px;"><?php _e('Features', 'vocalia-voice-widget'); ?></h4>
                        <ul style="color: #cbd5e1; font-size: 13px; line-height: 1.8; padding-left: 20px;">
                            <li>40 industry personas</li>
                            <li>5 languages (FR, EN, ES, AR, Darija)</li>
                            <li>Web Speech API ($0 cost)</li>
                            <li>RTL support for Arabic</li>
                            <li>BANT lead qualification</li>
                        </ul>

                        <a href="https://vocalia.ma/docs/wordpress" target="_blank"
                           style="display: block; text-align: center; padding: 10px; background: #5E6AD2; border-radius: 6px; color: white; text-decoration: none; margin-top: 15px;">
                            <?php _e('View Documentation', 'vocalia-voice-widget'); ?>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Render widget in footer
     */
    public function render_widget() {
        // Check if enabled
        if (!get_option('vocalia_enabled', false)) {
            return;
        }

        // Check tenant ID
        $tenant_id = get_option('vocalia_tenant_id', '');
        if (empty($tenant_id)) {
            return;
        }

        // Check excluded pages
        $excluded = get_option('vocalia_excluded_pages', '');
        if (!empty($excluded)) {
            $excluded_list = array_map('trim', explode("\n", $excluded));
            $current_id = get_the_ID();
            $current_slug = get_post_field('post_name', $current_id);

            if (in_array($current_id, $excluded_list) || in_array($current_slug, $excluded_list)) {
                return;
            }
        }

        // Check mobile
        $show_mobile = get_option('vocalia_show_on_mobile', true);
        if (!$show_mobile && wp_is_mobile()) {
            return;
        }

        // Get settings
        $api_key = get_option('vocalia_api_key', '');
        $position = get_option('vocalia_position', 'bottom-right');
        $primary_color = get_option('vocalia_primary_color', '#5E6AD2');
        $button_size = get_option('vocalia_button_size', '60');
        $language = get_option('vocalia_language', 'auto');
        $persona = get_option('vocalia_persona', 'AGENCY');

        // Build config
        $config = array(
            'tenantId' => $tenant_id,
            'apiKey' => $api_key,
            'position' => $position,
            'primaryColor' => $primary_color,
            'buttonSize' => intval($button_size),
            'language' => $language,
            'persona' => $persona,
            'source' => 'wordpress'
        );

        ?>
        <!-- VocalIA Voice Widget -->
        <script>
            window.VocalIAConfig = <?php echo json_encode($config); ?>;
        </script>
        <script src="https://vocalia.ma/widget/vocalia-widget.min.js" async defer></script>
        <!-- End VocalIA Voice Widget -->
        <?php
    }
}

// Initialize plugin
function vocalia_voice_widget_init() {
    VocalIA_Voice_Widget::get_instance();
}
add_action('plugins_loaded', 'vocalia_voice_widget_init');

// Activation hook
register_activation_hook(__FILE__, 'vocalia_voice_widget_activate');
function vocalia_voice_widget_activate() {
    // Set default options
    add_option('vocalia_enabled', false);
    add_option('vocalia_position', 'bottom-right');
    add_option('vocalia_primary_color', '#5E6AD2');
    add_option('vocalia_button_size', '60');
    add_option('vocalia_language', 'auto');
    add_option('vocalia_persona', 'AGENCY');
    add_option('vocalia_show_on_mobile', true);
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'vocalia_voice_widget_deactivate');
function vocalia_voice_widget_deactivate() {
    // Cleanup if needed
}

// Uninstall hook (in separate uninstall.php for best practice)
