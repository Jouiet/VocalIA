<?php
/**
 * VocalIA Voice Assistant — OpenCart Admin Controller
 * ====================================================
 * Place at: admin/controller/extension/module/vocalia.php
 * Compatible: OpenCart 3.x / 4.x
 */

class ControllerExtensionModuleVocalia extends Controller
{
    private $error = [];

    public function index()
    {
        $this->load->language('extension/module/vocalia');
        $this->document->setTitle($this->language->get('heading_title'));

        $this->load->model('setting/module');

        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
            if (!isset($this->request->get['module_id'])) {
                $this->model_setting_module->addModule('vocalia', $this->request->post);
            } else {
                $this->model_setting_module->editModule($this->request->get['module_id'], $this->request->post);
            }

            $this->session->data['success'] = $this->language->get('text_success');
            $this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module'));
        }

        $data['heading_title'] = 'VocalIA Voice Assistant';
        $data['text_edit'] = 'Edit VocalIA Module';

        if (isset($this->request->get['module_id'])) {
            $module_info = $this->model_setting_module->getModule($this->request->get['module_id']);
        }

        $data['status'] = isset($module_info['status']) ? $module_info['status'] : 1;
        $data['tenant_id'] = isset($module_info['tenant_id']) ? $module_info['tenant_id'] : '';
        $data['widget_type'] = isset($module_info['widget_type']) ? $module_info['widget_type'] : 'ecommerce';

        $data['action'] = $this->url->link('extension/module/vocalia', 'user_token=' . $this->session->data['user_token'] . (isset($this->request->get['module_id']) ? '&module_id=' . $this->request->get['module_id'] : ''));
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module');

        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/module/vocalia', $data));
    }

    protected function validate()
    {
        if (!$this->user->hasPermission('modify', 'extension/module/vocalia')) {
            $this->error['warning'] = 'Permission denied.';
        }

        $tenant_id = isset($this->request->post['tenant_id']) ? $this->request->post['tenant_id'] : '';
        if (!empty($tenant_id) && !preg_match('/^[a-z0-9_-]+$/i', $tenant_id)) {
            $this->error['tenant_id'] = 'Invalid Tenant ID format.';
        }

        return !$this->error;
    }
}
