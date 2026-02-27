<?php

namespace Drupal\vocalia\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * VocalIA Voice Assistant settings form.
 */
class VocaliaSettingsForm extends ConfigFormBase {

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames() {
    return ['vocalia.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'vocalia_settings_form';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this->config('vocalia.settings');

    $form['enabled'] = [
      '#type'          => 'checkbox',
      '#title'         => $this->t('Enable VocalIA Widget'),
      '#default_value' => $config->get('enabled'),
      '#description'   => $this->t('Show the VocalIA voice assistant on your site.'),
    ];

    $form['tenant_id'] = [
      '#type'          => 'textfield',
      '#title'         => $this->t('Tenant ID'),
      '#default_value' => $config->get('tenant_id'),
      '#description'   => $this->t('Your VocalIA Tenant ID from vocalia.ma dashboard → Settings.'),
      '#required'      => TRUE,
      '#maxlength'     => 64,
    ];

    $form['widget_type'] = [
      '#type'          => 'select',
      '#title'         => $this->t('Widget Type'),
      '#default_value' => $config->get('widget_type'),
      '#options'       => [
        'ecommerce' => $this->t('E-commerce'),
        'b2b'       => $this->t('B2B / Service Business'),
      ],
      '#description' => $this->t('Choose the widget type that best fits your site.'),
    ];

    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state) {
    parent::validateForm($form, $form_state);

    $tenant_id = trim($form_state->getValue('tenant_id'));
    if (!empty($tenant_id) && !preg_match('/^[a-z0-9_-]+$/i', $tenant_id)) {
      $form_state->setErrorByName('tenant_id', $this->t('Tenant ID must contain only letters, numbers, hyphens, and underscores.'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $this->config('vocalia.settings')
      ->set('enabled', (bool) $form_state->getValue('enabled'))
      ->set('tenant_id', trim($form_state->getValue('tenant_id')))
      ->set('widget_type', $form_state->getValue('widget_type'))
      ->save();

    parent::submitForm($form, $form_state);
  }

}
