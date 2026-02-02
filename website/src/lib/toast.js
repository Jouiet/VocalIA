/**
 * VocalIA Toast Notifications
 * Session 250.55: Lightweight toast notification system
 *
 * Features:
 * - 4 types: success, error, warning, info
 * - Auto-dismiss with configurable duration
 * - Stacking (max 5)
 * - RTL support
 * - Accessible (ARIA live region)
 */

const TOAST_CONFIG = {
  maxToasts: 5,
  defaultDuration: 5000,
  animationDuration: 300,
  position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
  icons: {
    success: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    error: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    warning: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    info: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
  },
  colors: {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/30',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-200',
      icon: 'text-green-500'
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: 'text-red-500'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/30',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: 'text-yellow-500'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-200',
      icon: 'text-blue-500'
    }
  }
};

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = [];
    this.init();
  }

  /**
   * Initialize toast container
   */
  init() {
    if (typeof document === 'undefined') return;

    // Check if container already exists
    this.container = document.getElementById('vocalia-toast-container');
    if (this.container) return;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'vocalia-toast-container';
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-atomic', 'true');
    this.container.className = this._getContainerClasses();

    document.body.appendChild(this.container);
  }

  /**
   * Get container position classes
   */
  _getContainerClasses() {
    const positions = {
      'bottom-right': 'fixed bottom-4 right-4 rtl:right-auto rtl:left-4',
      'bottom-left': 'fixed bottom-4 left-4 rtl:left-auto rtl:right-4',
      'top-right': 'fixed top-4 right-4 rtl:right-auto rtl:left-4',
      'top-left': 'fixed top-4 left-4 rtl:left-auto rtl:right-4'
    };
    return `${positions[TOAST_CONFIG.position]} z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none`;
  }

  /**
   * Create toast element
   */
  _createToast(message, type = 'info', options = {}) {
    const colors = TOAST_CONFIG.colors[type];
    const icon = TOAST_CONFIG.icons[type];

    const toast = document.createElement('div');
    toast.className = `
      pointer-events-auto
      flex items-start gap-3 p-4 rounded-lg border shadow-lg
      transform transition-all duration-300 ease-out
      translate-x-full opacity-0
      ${colors.bg} ${colors.border} ${colors.text}
    `.trim().replace(/\s+/g, ' ');

    toast.innerHTML = `
      <div class="flex-shrink-0 ${colors.icon}">
        ${icon}
      </div>
      <div class="flex-1 min-w-0">
        ${options.title ? `<p class="font-medium">${this._escapeHtml(options.title)}</p>` : ''}
        <p class="${options.title ? 'text-sm opacity-90' : ''}">${this._escapeHtml(message)}</p>
      </div>
      <button class="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors" aria-label="Close">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => this.remove(toast));

    return toast;
  }

  /**
   * Escape HTML to prevent XSS
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show toast
   */
  show(message, type = 'info', options = {}) {
    if (!this.container) this.init();

    const duration = options.duration ?? TOAST_CONFIG.defaultDuration;
    const toast = this._createToast(message, type, options);

    // Add to DOM
    this.container.appendChild(toast);
    this.toasts.push(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
      toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Remove oldest if over limit
    while (this.toasts.length > TOAST_CONFIG.maxToasts) {
      this.remove(this.toasts[0]);
    }

    // Auto-dismiss
    if (duration > 0) {
      toast._timeoutId = setTimeout(() => this.remove(toast), duration);
    }

    return toast;
  }

  /**
   * Remove toast
   */
  remove(toast) {
    if (!toast || !toast.parentNode) return;

    // Clear timeout
    if (toast._timeoutId) {
      clearTimeout(toast._timeoutId);
    }

    // Animate out
    toast.classList.add('translate-x-full', 'opacity-0');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      const index = this.toasts.indexOf(toast);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    }, TOAST_CONFIG.animationDuration);
  }

  /**
   * Remove all toasts
   */
  clear() {
    [...this.toasts].forEach(toast => this.remove(toast));
  }

  // ==================== Convenience Methods ====================

  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { duration: 8000, ...options });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  /**
   * Show loading toast (no auto-dismiss)
   */
  loading(message, options = {}) {
    const toast = this.show(message, 'info', { duration: 0, ...options });

    // Replace icon with spinner
    const iconContainer = toast.querySelector('div:first-child');
    iconContainer.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    `;

    return toast;
  }

  /**
   * Promise helper - show loading, then success/error
   */
  async promise(promise, messages = {}) {
    const {
      loading = 'Loading...',
      success = 'Success!',
      error = 'Something went wrong'
    } = messages;

    const loadingToast = this.loading(loading);

    try {
      const result = await promise;
      this.remove(loadingToast);
      this.success(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (err) {
      this.remove(loadingToast);
      this.error(typeof error === 'function' ? error(err) : error);
      throw err;
    }
  }
}

// Create singleton
const toast = new ToastManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.VocaliaToast = toast;
}

export default toast;
export { toast, ToastManager };
