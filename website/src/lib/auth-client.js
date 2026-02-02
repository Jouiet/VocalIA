/**
 * VocalIA Auth Client
 * Session 250.55: Browser-side JWT token management
 *
 * Features:
 * - Token storage (localStorage/sessionStorage)
 * - Auto token refresh
 * - Login/logout/register flows
 * - Permission/role checks
 * - Current user state
 */

const AUTH_CONFIG = {
  tokenKey: 'vocalia_access_token',
  refreshKey: 'vocalia_refresh_token',
  userKey: 'vocalia_user',
  rememberKey: 'vocalia_remember',
  apiBase: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3013/api/auth'
    : 'https://api.vocalia.ma/api/auth',
  tokenRefreshThreshold: 5 * 60 * 1000 // Refresh if expiring in 5 minutes
};

class AuthClient {
  constructor() {
    this._user = null;
    this._refreshPromise = null;
    this._listeners = new Set();

    // Load user from storage on init
    this._loadFromStorage();
  }

  /**
   * Load tokens and user from storage
   */
  _loadFromStorage() {
    const storage = this._getStorage();
    const accessToken = storage.getItem(AUTH_CONFIG.tokenKey);
    const userJson = storage.getItem(AUTH_CONFIG.userKey);

    if (accessToken && userJson) {
      try {
        this._user = JSON.parse(userJson);
      } catch (e) {
        this._clearStorage();
      }
    }
  }

  /**
   * Get appropriate storage (localStorage if remember, sessionStorage otherwise)
   */
  _getStorage() {
    const remember = localStorage.getItem(AUTH_CONFIG.rememberKey) === 'true';
    return remember ? localStorage : sessionStorage;
  }

  /**
   * Store tokens
   */
  _storeTokens(accessToken, refreshToken, user, remember = false) {
    // Set remember preference
    localStorage.setItem(AUTH_CONFIG.rememberKey, remember ? 'true' : 'false');

    const storage = this._getStorage();
    storage.setItem(AUTH_CONFIG.tokenKey, accessToken);
    if (refreshToken) {
      storage.setItem(AUTH_CONFIG.refreshKey, refreshToken);
    }
    if (user) {
      storage.setItem(AUTH_CONFIG.userKey, JSON.stringify(user));
      this._user = user;
    }

    this._notifyListeners('login', user);
  }

  /**
   * Clear all storage
   */
  _clearStorage() {
    localStorage.removeItem(AUTH_CONFIG.tokenKey);
    localStorage.removeItem(AUTH_CONFIG.refreshKey);
    localStorage.removeItem(AUTH_CONFIG.userKey);
    sessionStorage.removeItem(AUTH_CONFIG.tokenKey);
    sessionStorage.removeItem(AUTH_CONFIG.refreshKey);
    sessionStorage.removeItem(AUTH_CONFIG.userKey);
    this._user = null;
    this._notifyListeners('logout', null);
  }

  /**
   * Notify listeners of auth state change
   */
  _notifyListeners(event, data) {
    this._listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (e) {
        console.error('[Auth] Listener error:', e);
      }
    });
  }

  /**
   * Decode JWT token payload
   */
  _decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if token is expired or expiring soon
   */
  _isTokenExpiring(token) {
    const decoded = this._decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const expiresAt = decoded.exp * 1000;
    const now = Date.now();
    return expiresAt - now < AUTH_CONFIG.tokenRefreshThreshold;
  }

  /**
   * Make API request
   */
  async _request(endpoint, options = {}) {
    const url = `${AUTH_CONFIG.apiBase}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth header if we have a token
    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.status = response.status;
      error.code = data.code;
      throw error;
    }

    return data;
  }

  // ==================== PUBLIC API ====================

  /**
   * Register new user
   */
  async register({ email, password, name, tenantId = null }) {
    const result = await this._request('/register', {
      method: 'POST',
      body: { email, password, name, tenant_id: tenantId }
    });

    return result;
  }

  /**
   * Login user
   */
  async login({ email, password, rememberMe = false }) {
    const result = await this._request('/login', {
      method: 'POST',
      body: { email, password, remember_me: rememberMe }
    });

    this._storeTokens(
      result.access_token,
      result.refresh_token,
      result.user,
      rememberMe
    );

    return result;
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      const refreshToken = this._getStorage().getItem(AUTH_CONFIG.refreshKey);
      if (refreshToken) {
        await this._request('/logout', {
          method: 'POST',
          body: { refresh_token: refreshToken }
        });
      }
    } catch (e) {
      // Ignore logout errors
    } finally {
      this._clearStorage();
    }
  }

  /**
   * Refresh access token
   */
  async refreshTokens() {
    // Prevent multiple concurrent refresh requests
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    const refreshToken = this._getStorage().getItem(AUTH_CONFIG.refreshKey);
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    this._refreshPromise = this._request('/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken }
    }).then(result => {
      this._getStorage().setItem(AUTH_CONFIG.tokenKey, result.access_token);
      return result;
    }).finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  /**
   * Ensure we have a valid token, refreshing if necessary
   */
  async ensureValidToken() {
    const token = this.getAccessToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    if (this._isTokenExpiring(token)) {
      try {
        const result = await this.refreshTokens();
        return result.access_token;
      } catch (e) {
        this._clearStorage();
        throw new Error('Session expired');
      }
    }

    return token;
  }

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    return this._request('/forgot', {
      method: 'POST',
      body: { email }
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, password) {
    return this._request('/reset', {
      method: 'POST',
      body: { token, password }
    });
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token) {
    return this._request('/verify-email', {
      method: 'POST',
      body: { token }
    });
  }

  /**
   * Request password reset (alias for forgotPassword)
   */
  async requestPasswordReset(email) {
    return this.forgotPassword(email);
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    return this._request('/resend-verification', {
      method: 'POST',
      body: { email }
    });
  }

  /**
   * Get current user from API
   */
  async fetchCurrentUser() {
    const result = await this._request('/me', { method: 'GET' });
    this._user = result;
    this._getStorage().setItem(AUTH_CONFIG.userKey, JSON.stringify(result));
    return result;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates) {
    const result = await this._request('/me', {
      method: 'PUT',
      body: updates
    });
    this._user = result;
    this._getStorage().setItem(AUTH_CONFIG.userKey, JSON.stringify(result));
    return result;
  }

  /**
   * Change password
   */
  async changePassword(oldPassword, newPassword) {
    return this._request('/password', {
      method: 'PUT',
      body: { old_password: oldPassword, new_password: newPassword }
    });
  }

  /**
   * Get current access token
   */
  getAccessToken() {
    return this._getStorage().getItem(AUTH_CONFIG.tokenKey);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = this.getAccessToken();
    if (!token) return false;

    const decoded = this._decodeToken(token);
    if (!decoded) return false;

    // Check if completely expired (not just expiring soon)
    return decoded.exp * 1000 > Date.now();
  }

  /**
   * Get current user (cached)
   */
  getCurrentUser() {
    return this._user;
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission) {
    const token = this.getAccessToken();
    if (!token) return false;

    const decoded = this._decodeToken(token);
    return decoded?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has role
   */
  hasRole(role) {
    const token = this.getAccessToken();
    if (!token) return false;

    const decoded = this._decodeToken(token);
    return decoded?.role === role;
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.hasRole('admin');
  }

  /**
   * Get user's tenant ID
   */
  getTenantId() {
    const token = this.getAccessToken();
    if (!token) return null;

    const decoded = this._decodeToken(token);
    return decoded?.tenant_id || null;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Redirect to login if not authenticated
   */
  requireAuth(redirectUrl = '/app/auth/login.html') {
    if (!this.isAuthenticated()) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${redirectUrl}?return=${returnUrl}`;
      return false;
    }
    return true;
  }

  /**
   * Require specific role
   */
  requireRole(role, redirectUrl = '/app/auth/login.html') {
    if (!this.isAuthenticated()) {
      this.requireAuth(redirectUrl);
      return false;
    }

    if (!this.hasRole(role)) {
      window.location.href = '/app/client/index.html?error=forbidden';
      return false;
    }

    return true;
  }
}

// Export singleton
const auth = new AuthClient();

// Make available globally
if (typeof window !== 'undefined') {
  window.VocaliaAuth = auth;
}

export default auth;
export { auth, AuthClient };
