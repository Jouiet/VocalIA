<?php
/**
 * PHPUnit Bootstrap for VocalIA OpenCart Module
 * Stubs OpenCart Controller class for unit testing.
 */

class Controller
{
    protected $load;

    public function __construct()
    {
        $this->load = new StubLoader();
    }
}

class StubLoader
{
    public $renderedViews = [];

    public function view($template, $data = [])
    {
        $this->renderedViews[] = ['template' => $template, 'data' => $data];

        // Simulate the twig template rendering
        if (isset($data['widget_url']) && isset($data['tenant_id'])) {
            return '<script src="' . $data['widget_url']
                 . '" data-vocalia-tenant="' . $data['tenant_id']
                 . '" defer></script>';
        }
        return '';
    }
}

require_once dirname(__DIR__) . '/upload/catalog/controller/extension/module/vocalia.php';
