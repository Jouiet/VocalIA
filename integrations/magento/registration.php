<?php
/**
 * VocalIA Voice Assistant — Magento 2 Module Registration
 *
 * Place at: app/code/VocalIA/VoiceAssistant/registration.php
 */

use Magento\Framework\Component\ComponentRegistrar;

ComponentRegistrar::register(
    ComponentRegistrar::MODULE,
    'VocalIA_VoiceAssistant',
    __DIR__
);
