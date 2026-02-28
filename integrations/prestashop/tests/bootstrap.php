<?php
/**
 * PHPUnit Bootstrap for VocalIA PrestaShop Module
 *
 * Provides PrestaShop class/function stubs so the module
 * can be tested without a full PrestaShop installation.
 */

// PrestaShop version constant
if (!defined('_PS_VERSION_')) {
    define('_PS_VERSION_', '8.1.0');
}

// ===== PrestaShop Class Stubs =====

/**
 * Minimal Module base class stub
 */
class Module
{
    public $name;
    public $tab;
    public $version;
    public $author;
    public $need_instance;
    public $ps_versions_compliancy;
    public $bootstrap;
    public $displayName;
    public $description;
    public $confirmUninstall;
    public $context;

    protected $_hooks = [];

    public function __construct()
    {
        $this->context = new stdClass();
        $this->context->link = new LinkStub();
    }

    public function l($string)
    {
        return $string;
    }

    public function install()
    {
        return true;
    }

    public function uninstall()
    {
        return true;
    }

    public function registerHook($hookName)
    {
        $this->_hooks[] = $hookName;
        return true;
    }

    public function getRegisteredHooks()
    {
        return $this->_hooks;
    }

    public function displayError($message)
    {
        return '<div class="alert alert-danger">' . $message . '</div>';
    }

    public function displayConfirmation($message)
    {
        return '<div class="alert alert-success">' . $message . '</div>';
    }
}

/**
 * Configuration class stub
 */
class Configuration
{
    private static $values = [];

    public static function get($key)
    {
        return self::$values[$key] ?? false;
    }

    public static function updateValue($key, $value)
    {
        self::$values[$key] = $value;
        return true;
    }

    public static function deleteByName($key)
    {
        unset(self::$values[$key]);
        return true;
    }

    public static function reset()
    {
        self::$values = [];
    }
}

/**
 * Tools class stub
 */
class Tools
{
    private static $submitValues = [];
    private static $isSubmit = false;

    public static function isSubmit($name)
    {
        return self::$isSubmit && isset(self::$submitValues[$name]);
    }

    public static function getValue($name, $default = '')
    {
        return self::$submitValues[$name] ?? $default;
    }

    public static function getAdminTokenLite($tab)
    {
        return 'fake_token_' . $tab;
    }

    public static function simulateSubmit($name, $values = [])
    {
        self::$isSubmit = true;
        self::$submitValues[$name] = true;
        self::$submitValues = array_merge(self::$submitValues, $values);
    }

    public static function resetSubmit()
    {
        self::$isSubmit = false;
        self::$submitValues = [];
    }
}

/**
 * HelperForm class stub
 */
class HelperForm
{
    public $submit_action;
    public $currentIndex;
    public $token;
    public $fields_value = [];

    public function generateForm($fieldsForm)
    {
        // Return a minimal HTML form for testing
        $html = '<form method="post">';
        foreach ($fieldsForm as $form) {
            foreach ($form['form']['input'] ?? [] as $input) {
                $name = $input['name'];
                $value = $this->fields_value[$name] ?? '';
                $html .= "<input name=\"{$name}\" value=\"{$value}\">";
            }
        }
        $html .= '<input type="submit" name="' . $this->submit_action . '" value="Save"></form>';
        return $html;
    }
}

/**
 * Link class stub
 */
class LinkStub
{
    public function getAdminLink($controller, $withToken = true)
    {
        return 'https://shop.example.com/admin/' . $controller;
    }
}

// Load the module
require_once dirname(__DIR__) . '/vocalia.php';
