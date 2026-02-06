/**
 * VocalIA API Client
 * Session 250.55: Fetch wrapper with automatic authentication
 *
 * Features:
 * - Automatic token injection
 * - Token refresh on 401
 * - Retry with exponential backoff
 * - Request/response interceptors
 * - Error handling with custom error class
 * - Request cancellation
 */

import auth from './auth-client.js';

const API_CONFIG = {
  baseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3013/api'
    : 'https://api.vocalia.ma/api',
  voiceApiUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3004'
    : 'https://api.vocalia.ma',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000
};

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, status, code = 'API_ERROR', data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.data = data;
  }

  static fromResponse(response, data) {
    return new APIError(
      data?.error || response.statusText || 'Request failed',
      response.status,
      data?.code || 'API_ERROR',
      data
    );
  }
}

/**
 * Sleep utility for retry delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main API Client class
 */
class APIClient {
  constructor(baseUrl = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(fn) {
    this.requestInterceptors.push(fn);
    return () => {
      const index = this.requestInterceptors.indexOf(fn);
      if (index > -1) this.requestInterceptors.splice(index, 1);
    };
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(fn) {
    this.responseInterceptors.push(fn);
    return () => {
      const index = this.responseInterceptors.indexOf(fn);
      if (index > -1) this.responseInterceptors.splice(index, 1);
    };
  }

  /**
   * Build URL with query params
   */
  _buildUrl(path, params = {}) {
    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    return url.toString();
  }

  /**
   * Core request method
   */
  async request(method, path, options = {}) {
    const {
      body,
      params,
      headers = {},
      timeout = API_CONFIG.timeout,
      retries = API_CONFIG.maxRetries,
      auth: requiresAuth = true,
      signal
    } = options;

    // Build request config
    let config = {
      method,
      headers: { ...this.defaultHeaders, ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal
    };

    // Add auth header if required
    if (requiresAuth && auth.isAuthenticated()) {
      try {
        const token = await auth.ensureValidToken();
        config.headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        // Auth failed, redirect to login
        auth.requireAuth();
        throw new APIError('Authentication required', 401, 'AUTH_REQUIRED');
      }
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config) || config;
    }

    // Build URL
    const url = this._buildUrl(path, params);

    // Execute with retry
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...config,
          signal: signal || controller.signal
        });

        clearTimeout(timeoutId);

        // Handle 401 - try to refresh token
        if (response.status === 401 && requiresAuth && attempt < retries) {
          try {
            await auth.refreshTokens();
            const newToken = auth.getAccessToken();
            config.headers['Authorization'] = `Bearer ${newToken}`;
            continue; // Retry with new token
          } catch (e) {
            auth.requireAuth();
            throw new APIError('Session expired', 401, 'SESSION_EXPIRED');
          }
        }

        // Handle 429 - rate limited
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          await sleep(retryAfter * 1000);
          continue;
        }

        // Parse response
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          data = await interceptor(data, response) || data;
        }

        // Handle error responses
        if (!response.ok) {
          throw APIError.fromResponse(response, data);
        }

        return data;

      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error.name === 'AbortError') {
          throw new APIError('Request timeout', 408, 'TIMEOUT');
        }
        if (error instanceof APIError && error.status < 500) {
          throw error;
        }

        // Exponential backoff for retries
        if (attempt < retries) {
          await sleep(API_CONFIG.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new APIError('Request failed', 500, 'UNKNOWN_ERROR');
  }

  // ==================== HTTP Methods ====================

  async get(path, params = {}, options = {}) {
    return this.request('GET', path, { ...options, params });
  }

  async post(path, body = {}, options = {}) {
    return this.request('POST', path, { ...options, body });
  }

  async put(path, body = {}, options = {}) {
    return this.request('PUT', path, { ...options, body });
  }

  async patch(path, body = {}, options = {}) {
    return this.request('PATCH', path, { ...options, body });
  }

  async delete(path, options = {}) {
    return this.request('DELETE', path, options);
  }

  // ==================== Resource Clients ====================

  /**
   * Get tenants resource client
   * Session 250.63: Direct tenant access for voice preferences
   */
  get tenants() {
    return {
      list: (params) => this.get('/db/tenants', params),
      get: (id) => this.get(`/db/tenants/${id}`),
      create: (data) => this.post('/db/tenants', data),
      update: (id, data) => this.put(`/db/tenants/${id}`, data),
      delete: (id) => this.delete(`/db/tenants/${id}`)
    };
  }

  /**
   * Get users resource client
   */
  get users() {
    return {
      list: (params) => this.get('/db/users', params),
      get: (id) => this.get(`/db/users/${id}`),
      create: (data) => this.post('/db/users', data),
      update: (id, data) => this.put(`/db/users/${id}`, data),
      delete: (id) => this.delete(`/db/users/${id}`)
    };
  }

  /**
   * Get sessions resource client
   */
  get sessions() {
    return {
      list: (params) => this.get('/db/sessions', params),
      get: (id) => this.get(`/db/sessions/${id}`),
      create: (data) => this.post('/db/sessions', data),
      getByTenant: (tenantId) => this.get('/db/sessions', { tenant_id: tenantId })
    };
  }

  /**
   * Get logs resource client
   */
  get logs() {
    return {
      list: (params) => this.get('/logs', params),
      get: (id) => this.get(`/db/logs/${id}`),
      realtime: (params) => this.get('/logs', { ...params, realtime: true })
    };
  }

  /**
   * Get HITL (Human-in-the-Loop) resource client
   */
  get hitl() {
    return {
      pending: () => this.get('/hitl/pending'),
      history: () => this.get('/hitl/history'),
      stats: () => this.get('/hitl/stats'),
      approve: (id, admin) => this.post(`/hitl/approve/${id}`, { admin }),
      reject: (id, admin, reason) => this.post(`/hitl/reject/${id}`, { admin, reason })
    };
  }

  /**
   * Get analytics data
   */
  get analytics() {
    return {
      calls: (params) => this.get('/db/sessions', params),
      summary: async () => {
        const sessions = await this.get('/db/sessions', { limit: 1000 });
        const data = sessions.data || sessions || [];
        return {
          total_calls: data.length,
          by_language: this._groupBy(data, 'language'),
          by_persona: this._groupBy(data, 'persona'),
          by_day: this._groupByDate(data, 'created_at')
        };
      }
    };
  }

  /**
   * Get integrations resource client (tenant integrations config)
   */
  get integrations() {
    return {
      list: async (tenantId) => {
        const tenant = await this.get(`/db/tenants/${tenantId}`);
        return tenant?.integrations || [];
      },
      connect: async (tenantId, integration) => {
        const tenant = await this.get(`/db/tenants/${tenantId}`);
        const integrations = tenant?.integrations || [];
        integrations.push({ ...integration, connected_at: new Date().toISOString() });
        return this.put(`/db/tenants/${tenantId}`, { integrations });
      },
      disconnect: async (tenantId, integrationName) => {
        const tenant = await this.get(`/db/tenants/${tenantId}`);
        const integrations = (tenant?.integrations || []).filter(i => i.name !== integrationName);
        return this.put(`/db/tenants/${tenantId}`, { integrations });
      }
    };
  }

  /**
   * Get settings resource client (tenant settings & API keys)
   */
  get settings() {
    return {
      get: async (tenantId) => {
        const tenant = await this.get(`/db/tenants/${tenantId}`);
        return {
          webhook_url: tenant?.webhook_url || '',
          webhook_secret: tenant?.webhook_secret || '',
          webhook_events: tenant?.webhook_events || [],
          api_keys: (tenant?.api_keys || []).map(k => ({
            ...k,
            key: k.key ? `${k.key.substring(0, 8)}••••••••${k.key.slice(-4)}` : null
          })),
          notifications: tenant?.notifications || {},
          // Session 250.63: Voice preferences
          voice_language: tenant?.voice_language || 'fr',
          voice_gender: tenant?.voice_gender || 'female',
          active_persona: tenant?.active_persona || 'UNIVERSAL_SME'
        };
      },
      update: async (tenantId, data) => {
        return this.put(`/db/tenants/${tenantId}`, data);
      },
      createApiKey: async (tenantId, name, type = 'production') => {
        const tenant = await this.get(`/db/tenants/${tenantId}`);
        const api_keys = tenant?.api_keys || [];
        const keyPrefix = type === 'production' ? 'voc_live_' : 'voc_test_';
        const newKey = {
          id: `key_${Date.now()}`,
          name,
          type,
          key: keyPrefix + crypto.randomUUID().replace(/-/g, '').substring(0, 24),
          created_at: new Date().toISOString()
        };
        api_keys.push(newKey);
        await this.put(`/db/tenants/${tenantId}`, { api_keys });
        return newKey; // Return full key only on creation
      },
      deleteApiKey: async (tenantId, keyId) => {
        const tenant = await this.get(`/db/tenants/${tenantId}`);
        const api_keys = (tenant?.api_keys || []).filter(k => k.id !== keyId);
        return this.put(`/db/tenants/${tenantId}`, { api_keys });
      }
    };
  }

  /**
   * Helper: Group array by field
   */
  _groupBy(arr, field) {
    return arr.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Helper: Group array by date
   */
  _groupByDate(arr, field) {
    return arr.reduce((acc, item) => {
      const date = new Date(item[field]).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
  }
}

/**
 * Voice API Client for AI responses
 */
class VoiceAPIClient {
  constructor(baseUrl = API_CONFIG.voiceApiUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get AI response
   */
  async respond(message, options = {}) {
    const { language = 'fr', sessionId, history = [] } = options;

    const response = await fetch(`${this.baseUrl}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: message,
        language,
        sessionId,
        history
      })
    });

    if (!response.ok) {
      throw new APIError('Voice API error', response.status);
    }

    return response.json();
  }

  /**
   * Qualify lead
   */
  async qualifyLead(data) {
    const response = await fetch(`${this.baseUrl}/qualify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new APIError('Lead qualification failed', response.status);
    }

    return response.json();
  }

  /**
   * Get health status
   */
  async health() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  /**
   * Get metrics
   */
  async metrics() {
    const response = await fetch(`${this.baseUrl}/metrics`);
    return response.json();
  }
}

// Create instances
const api = new APIClient();
const voiceApi = new VoiceAPIClient();

// Make available globally
if (typeof window !== 'undefined') {
  window.VocaliaAPI = api;
  window.VocaliaVoiceAPI = voiceApi;
}

export default api;
export { api, voiceApi, APIClient, VoiceAPIClient, APIError };
