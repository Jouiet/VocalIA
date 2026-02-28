<?php
/**
 * PHPUnit Bootstrap for VocalIA Magento 2 Module
 */

require_once __DIR__ . '/stubs/MagentoStubs.php';
require_once __DIR__ . '/stubs/ScopeConfigInterface.php';
require_once __DIR__ . '/stubs/ScopeInterface.php';
require_once __DIR__ . '/stubs/TemplateContext.php';
require_once __DIR__ . '/stubs/Template.php';

// Make StubScopeConfig implement the interface
class TestScopeConfig extends StubScopeConfig implements \Magento\Framework\App\Config\ScopeConfigInterface
{
}
