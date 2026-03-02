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

  private const CONNECT_URL = 'https://api.vocalia.ma/api/auth/plugin-authorize';

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    $config = $this->config('vocalia.settings');

    // Handle plugin-connect callback
    $request = \Drupal::request();
    if ($request->query->has('vocalia_token') && $request->query->has('tenant_id')) {
      $storedNonce = \Drupal::state()->get('vocalia_connect_nonce', '');
      $receivedNonce = $request->query->get('nonce', '');
      if (!empty($storedNonce) && hash_equals($storedNonce, $receivedNonce)) {
        $tenantId = preg_replace('/[^a-z0-9_-]/i', '', $request->query->get('tenant_id'));
        $this->config('vocalia.settings')
          ->set('tenant_id', $tenantId)
          ->set('plugin_token', $request->query->get('vocalia_token'))
          ->save();
        \Drupal::state()->delete('vocalia_connect_nonce');
        \Drupal::messenger()->addStatus($this->t('Connected to VocalIA! Tenant: @tid. Your domain has been auto-registered.', ['@tid' => $tenantId]));
        // Reload config
        $config = $this->config('vocalia.settings');
      } else {
        \Drupal::messenger()->addError($this->t('Connection failed: invalid nonce. Please try again.'));
      }
    }

    // Handle disconnect
    if ($request->query->has('vocalia_disconnect')) {
      $this->config('vocalia.settings')
        ->set('tenant_id', '')
        ->set('plugin_token', '')
        ->save();
      \Drupal::messenger()->addStatus($this->t('Disconnected from VocalIA.'));
      $config = $this->config('vocalia.settings');
    }

    $tenantId = $config->get('tenant_id');
    $pluginToken = $config->get('plugin_token');
    $isConnected = !empty($tenantId) && !empty($pluginToken);

    // Connect button (shown when not connected)
    if (!$isConnected) {
      $nonce = bin2hex(random_bytes(16));
      \Drupal::state()->set('vocalia_connect_nonce', $nonce);
      $returnUrl = $request->getUri();
      $connectUrl = self::CONNECT_URL . '?' . http_build_query([
        'platform' => 'drupal',
        'return_url' => $returnUrl,
        'nonce' => $nonce,
      ]);
      $form['connect'] = [
        '#type' => 'markup',
        '#markup' => '<div style="margin-bottom:20px;padding:15px;border:1px solid #6366f1;border-radius:6px;">'
          . '<h3>' . $this->t('Connect your VocalIA account') . '</h3>'
          . '<p>' . $this->t('Click below to connect. Your domain will be auto-registered.') . '</p>'
          . '<a href="' . htmlspecialchars($connectUrl, ENT_QUOTES, 'UTF-8') . '" class="button button--primary">'
          . $this->t('Connect with VocalIA') . '</a>'
          . '<hr><p style="color:#999;">' . $this->t('Or configure manually below.') . '</p></div>',
        '#weight' => -100,
      ];
    } else {
      $form['connected'] = [
        '#type' => 'markup',
        '#markup' => '<div style="margin-bottom:15px;padding:10px 15px;background:#d4edda;border-radius:4px;">'
          . '<strong>' . $this->t('Connected to VocalIA') . '</strong> — '
          . $this->t('Tenant:') . ' <code>' . htmlspecialchars($tenantId, ENT_QUOTES, 'UTF-8') . '</code>'
          . ' | <a href="?vocalia_disconnect=1" style="color:#c0392b;">' . $this->t('Disconnect') . '</a></div>',
        '#weight' => -100,
      ];
    }

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
      '#required'      => !$isConnected,
      '#maxlength'     => 64,
      '#access'        => !$isConnected,
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
