<?php

namespace Joomla\CMS\Plugin;

class CMSPlugin
{
    protected $params;

    public function __construct($params = null)
    {
        $this->params = $params ?? new \StdParams();
    }

    public function getApplication()
    {
        return $GLOBALS['joomla_app'] ?? new \Joomla\CMS\Application\SiteApplication();
    }
}
