<?php
/**
 * VocalIA Voice Assistant — Magento 2 WidgetType Source Model
 *
 * Place at: app/code/VocalIA/VoiceAssistant/Model/Config/Source/WidgetType.php
 */

namespace VocalIA\VoiceAssistant\Model\Config\Source;

use Magento\Framework\Data\OptionSourceInterface;

class WidgetType implements OptionSourceInterface
{
    public function toOptionArray(): array
    {
        return [
            ['value' => 'ecommerce', 'label' => __('E-commerce (recommended)')],
            ['value' => 'b2b', 'label' => __('B2B / Service Business')],
        ];
    }
}
