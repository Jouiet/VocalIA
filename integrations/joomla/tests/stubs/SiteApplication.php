<?php

namespace Joomla\CMS\Application;

class SiteApplication
{
    private $document;

    public function __construct()
    {
        $this->document = new \StdDocument();
    }

    public function getDocument()
    {
        return $this->document;
    }
}
