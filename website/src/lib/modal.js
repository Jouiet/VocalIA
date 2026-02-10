/**
 * VocalIA Modal Component
 * Session 250.56: Accessible modal dialogs
 *
 * Features:
 * - Confirm/Alert/Custom modals
 * - Keyboard navigation (Esc to close)
 * - Focus trap
 * - Backdrop click to close
 * - RTL support
 * - Stacking support
 * - Animations
 */

const MODAL_CONFIG = {
  animationDuration: 200,
  zIndexBase: 1000
};

let modalStack = [];
let modalId = 0;

class Modal {
  constructor(options = {}) {
    this.id = `modal-${++modalId}`;
    this.options = {
      title: options.title || '',
      content: options.content || '',
      size: options.size || 'md', // sm, md, lg, xl, full
      closable: options.closable !== false,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      closeOnEsc: options.closeOnEsc !== false,
      showClose: options.showClose !== false,
      buttons: options.buttons || [],
      onOpen: options.onOpen,
      onClose: options.onClose,
      className: options.className || ''
    };

    this.element = null;
    this.backdrop = null;
    this.isOpen = false;
    this._previousFocus = null;
    this._focusableElements = [];

    this._create();
  }

  /**
   * Create modal elements
   */
  _create() {
    // Backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 bg-black/50 z-50 opacity-0 transition-opacity duration-200';
    this.backdrop.style.zIndex = MODAL_CONFIG.zIndexBase + (modalStack.length * 2);

    if (this.options.closeOnBackdrop) {
      this.backdrop.addEventListener('click', () => this.close());
    }

    // Modal container
    this.element = document.createElement('div');
    this.element.id = this.id;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', `${this.id}-title`);
    this.element.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 opacity-0 transition-all duration-200';
    this.element.style.zIndex = MODAL_CONFIG.zIndexBase + (modalStack.length * 2) + 1;

    // Size classes
    const sizeClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      full: 'max-w-full mx-4'
    };

    // Modal content
    const modalContent = document.createElement('div');
    modalContent.className = `w-full ${sizeClasses[this.options.size]} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl transform scale-95 transition-transform duration-200 ${this.options.className}`;

    // Header
    if (this.options.title || this.options.showClose) {
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700';

      if (this.options.title) {
        const title = document.createElement('h3');
        title.id = `${this.id}-title`;
        title.className = 'text-lg font-semibold text-slate-900 dark:text-white';
        title.textContent = this.options.title;
        header.appendChild(title);
      }

      if (this.options.showClose && this.options.closable) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = `
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        `;
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);
      }

      modalContent.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'px-6 py-4';

    if (typeof this.options.content === 'string') {
      body.innerHTML = this.options.content;
    } else if (this.options.content instanceof HTMLElement) {
      body.appendChild(this.options.content);
    }

    modalContent.appendChild(body);

    // Footer with buttons
    if (this.options.buttons.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700';

      this.options.buttons.forEach(btn => {
        const button = document.createElement('button');

        const variants = {
          primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          secondary: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200',
          danger: 'bg-red-600 hover:bg-red-700 text-white',
          success: 'bg-green-600 hover:bg-green-700 text-white',
          ghost: 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
        };

        button.className = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${variants[btn.variant] || variants.secondary}`;
        button.textContent = btn.text;

        if (btn.onClick) {
          button.addEventListener('click', () => btn.onClick(this));
        }

        if (btn.closeOnClick !== false) {
          button.addEventListener('click', () => this.close());
        }

        footer.appendChild(button);
      });

      modalContent.appendChild(footer);
    }

    this.element.appendChild(modalContent);

    // Keyboard handling
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.options.closeOnEsc && this.options.closable) {
        e.preventDefault();
        this.close();
      }

      // Focus trap
      if (e.key === 'Tab') {
        this._handleTab(e);
      }
    });

    // Stop propagation on modal content click
    modalContent.addEventListener('click', (e) => e.stopPropagation());
  }

  /**
   * Handle tab key for focus trap
   */
  _handleTab(e) {
    const focusable = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    this._focusableElements = Array.from(focusable);

    if (this._focusableElements.length === 0) return;

    const first = this._focusableElements[0];
    const last = this._focusableElements[this._focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Open modal
   */
  open() {
    if (this.isOpen) return this;

    this._previousFocus = document.activeElement;

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.element);
    document.body.style.overflow = 'hidden';

    modalStack.push(this);

    // Trigger animation
    requestAnimationFrame(() => {
      this.backdrop.classList.add('opacity-100');
      this.element.classList.add('opacity-100');
      this.element.querySelector('div').classList.remove('scale-95');
      this.element.querySelector('div').classList.add('scale-100');
    });

    // Focus first focusable element
    setTimeout(() => {
      const focusable = this.element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) {
        focusable[0].focus();
      }
    }, MODAL_CONFIG.animationDuration);

    this.isOpen = true;

    if (this.options.onOpen) {
      this.options.onOpen(this);
    }

    return this;
  }

  /**
   * Close modal
   */
  close() {
    if (!this.isOpen) return this;

    // Animate out
    this.backdrop.classList.remove('opacity-100');
    this.element.classList.remove('opacity-100');
    this.element.querySelector('div').classList.remove('scale-100');
    this.element.querySelector('div').classList.add('scale-95');

    setTimeout(() => {
      this.backdrop.remove();
      this.element.remove();

      // Restore focus
      if (this._previousFocus) {
        this._previousFocus.focus();
      }

      // Remove from stack
      const index = modalStack.indexOf(this);
      if (index > -1) {
        modalStack.splice(index, 1);
      }

      // Restore body scroll if no more modals
      if (modalStack.length === 0) {
        document.body.style.overflow = '';
      }

      this.isOpen = false;

      if (this.options.onClose) {
        this.options.onClose(this);
      }
    }, MODAL_CONFIG.animationDuration);

    return this;
  }

  /**
   * Set content
   */
  setContent(content) {
    const body = this.element.querySelector('div > div:nth-child(2)');
    if (!body) return this;

    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.innerHTML = '';
      body.appendChild(content);
    }

    return this;
  }

  /**
   * Set title
   */
  setTitle(title) {
    const titleEl = this.element.querySelector(`#${this.id}-title`);
    if (titleEl) {
      titleEl.textContent = title;
    }
    return this;
  }
}

// ==================== HELPERS ====================

function _escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

// ==================== FACTORY FUNCTIONS ====================

/**
 * Show alert modal
 */
function alert(message, options = {}) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title || 'Alert',
      content: `<p class="text-slate-600 dark:text-slate-300">${_escapeHtml(message)}</p>`,
      size: 'sm',
      closable: true,
      buttons: [
        {
          text: options.okText || 'OK',
          variant: 'primary',
          onClick: () => resolve(true)
        }
      ],
      onClose: () => resolve(true),
      ...options
    });

    modal.open();
  });
}

/**
 * Show confirm modal
 */
function confirm(message, options = {}) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title || 'Confirmation',
      content: `<p class="text-slate-600 dark:text-slate-300">${_escapeHtml(message)}</p>`,
      size: 'sm',
      closable: true,
      closeOnBackdrop: false,
      buttons: [
        {
          text: options.cancelText || 'Annuler',
          variant: 'secondary',
          onClick: () => resolve(false)
        },
        {
          text: options.confirmText || 'Confirmer',
          variant: options.danger ? 'danger' : 'primary',
          onClick: () => resolve(true)
        }
      ],
      onClose: () => resolve(false),
      ...options
    });

    modal.open();
  });
}

/**
 * Show prompt modal
 */
function prompt(message, options = {}) {
  return new Promise((resolve) => {
    const inputId = `prompt-input-${Date.now()}`;
    const content = `
      <div class="space-y-3">
        <p class="text-slate-600 dark:text-slate-300">${_escapeHtml(message)}</p>
        <input
          type="${_escapeHtml(options.type || 'text')}"
          id="${inputId}"
          value="${_escapeHtml(options.defaultValue || '')}"
          placeholder="${_escapeHtml(options.placeholder || '')}"
          class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
      </div>
    `;

    const modal = new Modal({
      title: options.title || 'Input',
      content,
      size: 'sm',
      closable: true,
      closeOnBackdrop: false,
      buttons: [
        {
          text: options.cancelText || 'Annuler',
          variant: 'secondary',
          onClick: () => resolve(null)
        },
        {
          text: options.confirmText || 'OK',
          variant: 'primary',
          closeOnClick: false,
          onClick: (m) => {
            const input = m.element.querySelector(`#${inputId}`);
            resolve(input.value);
            m.close();
          }
        }
      ],
      onClose: () => resolve(null),
      ...options
    });

    modal.open();

    // Focus input after animation
    setTimeout(() => {
      const input = modal.element.querySelector(`#${inputId}`);
      if (input) input.focus();
    }, MODAL_CONFIG.animationDuration + 50);
  });
}

/**
 * Show loading modal
 */
function loading(message = 'Chargement...', options = {}) {
  const content = `
    <div class="flex flex-col items-center py-4">
      <svg class="w-10 h-10 animate-spin text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-slate-600 dark:text-slate-300">${_escapeHtml(message)}</p>
    </div>
  `;

  const modal = new Modal({
    content,
    size: 'sm',
    closable: false,
    showClose: false,
    buttons: [],
    ...options
  });

  modal.open();
  return modal;
}

/**
 * Close all modals
 */
function closeAll() {
  [...modalStack].forEach(modal => modal.close());
}

// Export
const modal = {
  Modal,
  alert,
  confirm,
  prompt,
  loading,
  closeAll
};

if (typeof window !== 'undefined') {
  window.VocaliaModal = modal;
}

export default modal;
export { Modal, alert, confirm, prompt, loading, closeAll };
