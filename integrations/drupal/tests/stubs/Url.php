<?php

namespace Drupal\Core;

class Url
{
    private $route;

    public static function fromRoute($route)
    {
        $u = new self();
        $u->route = $route;
        return $u;
    }

    public function toString()
    {
        return '/admin/config/vocalia';
    }
}
