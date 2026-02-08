/**
 * VocalIA Database Client
 * Frontend client for Google Sheets Database API
 *
 * Usage:
 *   import { db } from './lib/db-client.js';
 *   const tenants = await db.tenants.list();
 *   const tenant = await db.tenants.create({ name: 'Acme', email: 'a@b.com' });
 */

const DB_API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3013/api/db'
  : 'https://api.vocalia.ma/api/db';

class DBClient {
  constructor(baseUrl = DB_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make API request
   */
  async request(method, path, data = null) {
    const token = localStorage.getItem('vocalia_access_token');
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseUrl}${path}`, options);
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'API Error');
    }

    return json;
  }

  /**
   * Create sheet accessor
   */
  sheet(name) {
    return {
      /**
       * List all records
       */
      list: async (query = {}) => {
        const params = new URLSearchParams(query).toString();
        const path = params ? `/${name}?${params}` : `/${name}`;
        const result = await this.request('GET', path);
        return result.data || result;
      },

      /**
       * Get by ID
       */
      get: async (id) => {
        return await this.request('GET', `/${name}/${id}`);
      },

      /**
       * Create record
       */
      create: async (data) => {
        return await this.request('POST', `/${name}`, data);
      },

      /**
       * Update record
       */
      update: async (id, data) => {
        return await this.request('PUT', `/${name}/${id}`, data);
      },

      /**
       * Delete record
       */
      delete: async (id) => {
        return await this.request('DELETE', `/${name}/${id}`);
      },

      /**
       * Find by query
       */
      find: async (query) => {
        const params = new URLSearchParams(query).toString();
        const result = await this.request('GET', `/${name}?${params}`);
        return result.data || [];
      },

      /**
       * Find one
       */
      findOne: async (query) => {
        const records = await this.sheet(name).find(query);
        return records[0] || null;
      },

      /**
       * Count
       */
      count: async (query = {}) => {
        const result = await this.sheet(name).find(query);
        return result.length;
      }
    };
  }

  /**
   * Health check
   */
  async health() {
    return await this.request('GET', '/health');
  }

  // Convenience accessors
  get tenants() { return this.sheet('tenants'); }
  get sessions() { return this.sheet('sessions'); }
  get logs() { return this.sheet('logs'); }
  get users() { return this.sheet('users'); }
}

// Singleton instance
const db = new DBClient();

// Export for ES modules
export { DBClient, db };

// Export for global use
if (typeof window !== 'undefined') {
  window.VocaliaDB = db;
}
