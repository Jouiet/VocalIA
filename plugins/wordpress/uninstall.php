<?php
/**
 * VocalIA Voice Widget Uninstall
 *
 * Removes all plugin data when uninstalled
 */

// Exit if not called by WordPress
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Remove all options
$options = array(
    'vocalia_enabled',
    'vocalia_tenant_id',
    'vocalia_api_key',
    'vocalia_position',
    'vocalia_primary_color',
    'vocalia_button_size',
    'vocalia_language',
    'vocalia_persona',
    'vocalia_show_on_mobile',
    'vocalia_excluded_pages'
);

foreach ($options as $option) {
    delete_option($option);
}

// Clear any cached data
wp_cache_flush();
