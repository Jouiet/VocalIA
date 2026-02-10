<?php
/**
 * Plugin Name: VocalIA Voice Agent
 * Plugin URI:  https://vocalia.ma
 * Description: Official integration for VocalIA Voice & AI Agents. Adds the voice commerce widget to your WooCommerce store.
 * Version:     1.0.0
 * Author:      VocalIA
 * Author URI:  https://vocalia.ma
 * License:     GPL-2.0+
 * Text Domain: vocalia-voice-agent
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Define plugin constants
define( 'VOCALIA_VERSION', '1.1.1' );
define( 'VOCALIA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'VOCALIA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register Settings
 */
function vocalia_register_settings() {
	register_setting( 'vocalia_options_group', 'vocalia_tenant_id' );
	register_setting( 'vocalia_options_group', 'vocalia_position', [
		'default' => 'bottom-right'
	]);
    register_setting( 'vocalia_options_group', 'vocalia_mode', [
        'default' => 'b2c' // b2c, b2b, ecommerce, telephony
    ]);
    register_setting( 'vocalia_options_group', 'vocalia_api_url', [
        'default' => 'https://api.vocalia.ma'
    ]);
}
add_action( 'admin_init', 'vocalia_register_settings' );

/**
 * Add Admin Menu
 */
function vocalia_add_admin_menu() {
	add_menu_page(
		'VocalIA Agent Settings',
		'VocalIA Agent',
		'manage_options',
		'vocalia_voice_agent',
		'vocalia_options_page',
		'dashicons-microphone', // Icon
		90
	);
}
add_action( 'admin_menu', 'vocalia_add_admin_menu' );

/**
 * Render Settings Page
 */
function vocalia_options_page() {
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<div class="card" style="max-width: 800px; padding: 20px;">
            <p>Connect your store to the VocalIA Neural Grid. <a href="https://vocalia.ma" target="_blank">Get your Tenant ID</a>.</p>
            
            <form action="options.php" method="post">
                <?php
                settings_fields( 'vocalia_options_group' );
                do_settings_sections( 'vocalia_options_group' );
                ?>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">Tenant ID</th>
                        <td>
                            <input type="text" name="vocalia_tenant_id" value="<?php echo esc_attr( get_option( 'vocalia_tenant_id' ) ); ?>" class="regular-text" placeholder="e.g. tenant_12345" />
                            <p class="description">Your unique API Tenant ID from the VocalIA Dashboard.</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Widget Position</th>
                        <td>
                            <select name="vocalia_position">
                                <option value="bottom-right" <?php selected( get_option( 'vocalia_position' ), 'bottom-right' ); ?>>Bottom Right</option>
                                <option value="bottom-left" <?php selected( get_option( 'vocalia_position' ), 'bottom-left' ); ?>>Bottom Left</option>
                            </select>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Agent Mode</th>
                        <td>
                            <select name="vocalia_mode">
                                <option value="b2c" <?php selected( get_option( 'vocalia_mode' ), 'b2c' ); ?>>B2C (Support, FAQ, Personal Assistant)</option>
                                <option value="b2b" <?php selected( get_option( 'vocalia_mode' ), 'b2b' ); ?>>B2B / Lead Gen (Booking, Forms)</option>
                                <option value="ecommerce" <?php selected( get_option( 'vocalia_mode' ), 'ecommerce' ); ?>>E-Commerce (Sales, Cart, Catalog)</option>
                                <option value="telephony" <?php selected( get_option( 'vocalia_mode' ), 'telephony' ); ?>>Telephony (PSTN, Outbound/Inbound)</option>
                            </select>
                            <p class="description">Select the mode that matches your subscription.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button( 'Save Configuration' ); ?>
            </form>
        </div>
	</div>
	<?php
}

/**
 * Enqueue Widget Script on Frontend
 */
function vocalia_enqueue_widget() {
	$tenant_id = get_option( 'vocalia_tenant_id' );

    // Don't load if no Tenant ID (or maybe load in 'demo' mode? No, safer to not load)
	if ( empty( $tenant_id ) ) {
		return;
	}

    // Determine config based on saved settings
    $mode = get_option('vocalia_mode', 'ecommerce');
    $is_ecommerce = ($mode === 'ecommerce');
    // Unified V3 Kernel Handles all modes (B2B, B2C, Ecommerce)
    $script_name = 'voice-widget-v3.js';

    // API Base URL
    $api_base = get_option('vocalia_api_url', 'https://api.vocalia.ma');

	// Enqueue the script from CDN/API
    $widget_url = $api_base . '/voice-assistant/' . $script_name;
    
	wp_enqueue_script( 
        'vocalia-widget', 
        $widget_url, 
        array(), 
        VOCALIA_VERSION, 
        true 
    );

	// Pass Configuration to JS
	wp_localize_script( 'vocalia-widget', 'VOCALIA_CONFIG_INJECTED', array(
		'tenantId'       => sanitize_text_field( $tenant_id ),
		'position'       => sanitize_text_field( get_option( 'vocalia_position', 'bottom-right' ) ),
        'ecommerceMode'  => $is_ecommerce,
        'apiBaseUrl'     => $api_base,
        'assetsUrl'      => $api_base . '/assets/',
	));
    
    // Inline script to merge injected config with window.VOCALIA_CONFIG if it exists
    wp_add_inline_script( 'vocalia-widget', '
        window.VOCALIA_CONFIG = window.VOCALIA_CONFIG || {};
        Object_assign(window.VOCALIA_CONFIG, VOCALIA_CONFIG_INJECTED);
        function Object_assign(target, source) {
            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
            return target;
        }
    ', 'before' );
}
add_action( 'wp_enqueue_scripts', 'vocalia_enqueue_widget' );
