<?php

namespace Magento\Framework\View\Element;

class Template
{
    public function __construct(...$args)
    {
    }

    protected function _toHtml(): string
    {
        return '<rendered>';
    }
}
