<?php
/**
 * Plugin Name: VocalIA Voice Assistant
 * Plugin URI: https://vocalia.ma
 * Description: The ultimate AI Voice Assistant for WordPress & WooCommerce. Boost conversion with native Darija, French, and English voice support.
 * Version: 1.1.1
 * Author: VocalIA Team
 * Author URI: https://vocalia.ma
 * License: GPL2
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Vocalia_Voice_Plugin {

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
        add_action( 'wp_footer', array( $this, 'render_widget' ) );
        add_shortcode( 'vocalia_widget', array( $this, 'shortcode_widget' ) );
    }


    public function enqueue_scripts() {
        // Enqueue the production VocalIA widget script
        wp_enqueue_script( 'vocalia-widget', 'https://api.vocalia.ma/voice-widget-v3.js', array(), '1.1.1', true );
    }


    public function render_widget() {
        // Output the initialization script with tenant config
        $tenant_id = get_option( 'vocalia_tenant_id', 'default' );
        ?>
        <script>
            window.VOCALIA_CONFIG = {
                tenantId: "<?php echo esc_js( $tenant_id ); ?>",
                branding: {
                    primaryColor: "#5E6AD2"
                }
            };
        </script>
        <?php
    }

    public function shortcode_widget() {
        return '<div id="vocalia-voice-widget" class="vocalia-embedded"></div>';
    }
}

new Vocalia_Voice_Plugin();
