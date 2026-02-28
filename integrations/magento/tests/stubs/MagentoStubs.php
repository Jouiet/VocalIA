<?php
/**
 * Magento 2 framework stubs for PHPUnit testing.
 */

class StubScopeConfig
{
    private $values = [];

    public function setValue($path, $value)
    {
        $this->values[$path] = $value;
    }

    public function getValue($path, $scopeType = 'default', $scopeCode = null)
    {
        return $this->values[$path] ?? null;
    }
}

class StubContext
{
}
