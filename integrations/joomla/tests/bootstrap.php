<?php
/**
 * PHPUnit Bootstrap for VocalIA Joomla Plugin
 * Loads stubs for Joomla core classes.
 */

if (!defined('_JEXEC')) {
    define('_JEXEC', 1);
}

require_once __DIR__ . '/stubs/Helpers.php';
require_once __DIR__ . '/stubs/SubscriberInterface.php';
require_once __DIR__ . '/stubs/CMSPlugin.php';
require_once __DIR__ . '/stubs/SiteApplication.php';
require_once __DIR__ . '/stubs/AdministratorApplication.php';
