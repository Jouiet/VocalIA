<?php
/**
 * Drupal core stubs — global namespace classes
 */

class StubImmutableConfig
{
    private $values = [];

    public function __construct(array $values = [])
    {
        $this->values = $values;
    }

    public function get($key)
    {
        return $this->values[$key] ?? null;
    }
}

class StubAdminContext
{
    private $isAdmin;

    public function __construct(bool $isAdmin = false)
    {
        $this->isAdmin = $isAdmin;
    }

    public function isAdminRoute()
    {
        return $this->isAdmin;
    }
}

class Drupal
{
    private static $services = [];

    public static function setService($name, $service)
    {
        self::$services[$name] = $service;
    }

    public static function service($name)
    {
        return self::$services[$name] ?? null;
    }

    public static function config($name)
    {
        return self::$services['config.' . $name] ?? new StubImmutableConfig();
    }
}

if (!function_exists('t')) {
    function t($string, array $args = [])
    {
        return strtr($string, $args);
    }
}
