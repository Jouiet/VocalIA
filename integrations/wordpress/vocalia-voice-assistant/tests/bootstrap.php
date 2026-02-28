<?php
/**
 * PHPUnit Bootstrap for VocalIA WordPress Plugin
 *
 * This bootstrap provides WordPress function stubs so the plugin
 * can be tested without a full WordPress installation.
 * For real E2E testing, use wp-phpunit with a WP test suite.
 */

// Simulate WordPress constants
if (!defined('ABSPATH')) {
    define('ABSPATH', '/tmp/wordpress/');
}

// ===== WordPress Function Stubs =====
// These stubs simulate WordPress core functions to allow unit testing
// without a full WP environment. They track calls for assertions.

$GLOBALS['wp_options'] = [];
$GLOBALS['wp_actions'] = [];
$GLOBALS['wp_filters'] = [];
$GLOBALS['wp_scripts'] = [];
$GLOBALS['wp_settings_errors'] = [];

function get_option($key, $default = false) {
    return $GLOBALS['wp_options'][$key] ?? $default;
}

function update_option($key, $value) {
    $GLOBALS['wp_options'][$key] = $value;
    return true;
}

function delete_option($key) {
    unset($GLOBALS['wp_options'][$key]);
    return true;
}

function add_action($tag, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['wp_actions'][$tag][] = [
        'callback' => $callback,
        'priority' => $priority,
    ];
}

function add_filter($tag, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['wp_filters'][$tag][] = [
        'callback' => $callback,
        'priority' => $priority,
    ];
}

function add_options_page($page_title, $menu_title, $capability, $menu_slug, $callback) {
    $GLOBALS['wp_admin_pages'][$menu_slug] = [
        'title' => $page_title,
        'callback' => $callback,
        'capability' => $capability,
    ];
}

function register_setting($option_group, $option_name, $args = []) {
    $GLOBALS['wp_registered_settings'][$option_name] = [
        'group' => $option_group,
        'args' => $args,
    ];
}

function add_settings_error($setting, $code, $message, $type = 'error') {
    $GLOBALS['wp_settings_errors'][] = [
        'setting' => $setting,
        'code' => $code,
        'message' => $message,
        'type' => $type,
    ];
}

function wp_enqueue_script($handle, $src = '', $deps = [], $ver = false, $args = []) {
    $GLOBALS['wp_scripts'][$handle] = [
        'src' => $src,
        'deps' => $deps,
        'ver' => $ver,
        'args' => $args,
    ];
}

function register_activation_hook($file, $callback) {
    $GLOBALS['wp_activation_hooks'][] = ['file' => $file, 'callback' => $callback];
}

function register_uninstall_hook($file, $callback) {
    $GLOBALS['wp_uninstall_hooks'][] = ['file' => $file, 'callback' => $callback];
}

function plugin_dir_path($file) {
    return dirname($file) . '/';
}

function plugin_basename($file) {
    return basename(dirname($file)) . '/' . basename($file);
}

function sanitize_text_field($str) {
    return trim(strip_tags($str));
}

function esc_attr($text) {
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function esc_html($text) {
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function esc_html__($text, $domain = 'default') {
    return $text;
}

function esc_html_e($text, $domain = 'default') {
    echo $text;
}

function esc_attr_e($text, $domain = 'default') {
    echo esc_attr($text);
}

function esc_url($url) {
    return filter_var($url, FILTER_SANITIZE_URL);
}

function rest_sanitize_boolean($value) {
    return (bool) $value;
}

function __($text, $domain = 'default') {
    return $text;
}

function checked($checked, $current = true, $echo = true) {
    $result = ($checked == $current) ? ' checked="checked"' : '';
    if ($echo) echo $result;
    return $result;
}

function selected($selected, $current = true, $echo = true) {
    $result = ($selected == $current) ? ' selected="selected"' : '';
    if ($echo) echo $result;
    return $result;
}

function settings_fields($option_group) {
    echo '<input type="hidden" name="option_page" value="' . esc_attr($option_group) . '">';
}

function submit_button($text = 'Save Changes') {
    echo '<input type="submit" value="' . esc_attr($text) . '">';
}

function get_admin_page_title() {
    return 'Admin Page';
}

function current_user_can($capability) {
    return $GLOBALS['wp_current_user_can'] ?? true;
}

function admin_url($path = '') {
    return 'https://example.com/wp-admin/' . $path;
}

function is_front_page() {
    return $GLOBALS['wp_is_front_page'] ?? false;
}

function is_plugin_active($plugin) {
    return $GLOBALS['wp_active_plugins'][$plugin] ?? false;
}

function is_woocommerce() {
    return $GLOBALS['wp_is_woocommerce'] ?? false;
}

function is_cart() {
    return $GLOBALS['wp_is_cart'] ?? false;
}

function is_checkout() {
    return $GLOBALS['wp_is_checkout'] ?? false;
}

function class_exists_wp($class) {
    return class_exists($class);
}

// Load the plugin file
require_once dirname(__DIR__) . '/vocalia-voice-assistant.php';
