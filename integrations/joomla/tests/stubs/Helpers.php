<?php

class StdParams
{
    private $values = [];

    public function get($key, $default = null)
    {
        return $this->values[$key] ?? $default;
    }

    public function set($key, $value)
    {
        $this->values[$key] = $value;
    }
}

class StdDocument
{
    public $customTags = [];

    public function addCustomTag($tag)
    {
        $this->customTags[] = $tag;
    }
}
