/**
 * VocalIA Dashboard Grid - Drag & Drop System
 * Session 209 - 2026 Standard Implementation
 *
 * Features:
 * - Drag-and-drop widget reordering
 * - Layout persistence (localStorage)
 * - Collapse/expand widgets
 * - Responsive grid
 */

class DashboardGrid {
  constructor(containerSelector, options = {}) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.warn(`DashboardGrid: Container "${containerSelector}" not found`);
      return;
    }

    this.options = {
      storageKey: options.storageKey || 'vocalia-dashboard-layout',
      onReorder: options.onReorder || null,
      enableCollapse: options.enableCollapse !== false,
      enableDrag: options.enableDrag !== false,
      ...options
    };

    this.draggedElement = null;
    this.placeholder = null;

    this.init();
  }

  init() {
    this.container.classList.add('dashboard-grid');
    this.loadLayout();
    this.setupWidgets();
    this.setupEventListeners();
  }

  setupWidgets() {
    const widgets = this.container.querySelectorAll('.dashboard-widget');

    widgets.forEach((widget, index) => {
      // Assign ID if not present
      if (!widget.dataset.widgetId) {
        widget.dataset.widgetId = `widget-${index}`;
      }

      // Add drag handle
      if (this.options.enableDrag && !widget.querySelector('.drag-handle')) {
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.setAttribute('aria-label', 'Déplacer le widget');
        dragHandle.setAttribute('role', 'button');
        dragHandle.setAttribute('tabindex', '0');
        widget.appendChild(dragHandle);
      }

      // Add collapse toggle
      if (this.options.enableCollapse && !widget.querySelector('.collapse-toggle')) {
        const collapseToggle = document.createElement('button');
        collapseToggle.className = 'collapse-toggle';
        collapseToggle.setAttribute('aria-label', 'Réduire/Agrandir le widget');
        collapseToggle.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 4l4 4 4-4H2z"/>
          </svg>
        `;
        collapseToggle.addEventListener('click', () => this.toggleCollapse(widget));
        widget.appendChild(collapseToggle);
      }

      // Make draggable
      if (this.options.enableDrag) {
        widget.setAttribute('draggable', 'true');
      }
    });
  }

  setupEventListeners() {
    if (!this.options.enableDrag) return;

    this.container.addEventListener('dragstart', (e) => this.handleDragStart(e));
    this.container.addEventListener('dragend', (e) => this.handleDragEnd(e));
    this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.container.addEventListener('drop', (e) => this.handleDrop(e));
    this.container.addEventListener('dragleave', (e) => this.handleDragLeave(e));

    // Keyboard support for drag handles
    this.container.querySelectorAll('.drag-handle').forEach(handle => {
      handle.addEventListener('keydown', (e) => this.handleKeyboardDrag(e));
    });
  }

  handleDragStart(e) {
    const widget = e.target.closest('.dashboard-widget');
    if (!widget) return;

    this.draggedElement = widget;
    widget.classList.add('is-dragging');

    // Create placeholder
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'dashboard-widget is-placeholder';
    this.placeholder.style.height = `${widget.offsetHeight}px`;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widget.dataset.widgetId);

    // Delay adding placeholder to avoid visual glitch
    requestAnimationFrame(() => {
      widget.parentNode.insertBefore(this.placeholder, widget);
    });
  }

  handleDragEnd(e) {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('is-dragging');
    }

    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }

    // Remove all drag-over states
    this.container.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });

    this.draggedElement = null;
    this.placeholder = null;

    this.saveLayout();
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const widget = e.target.closest('.dashboard-widget');
    if (!widget || widget === this.draggedElement || widget === this.placeholder) return;

    // Determine position
    const rect = widget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
      widget.parentNode.insertBefore(this.placeholder, widget);
    } else {
      widget.parentNode.insertBefore(this.placeholder, widget.nextSibling);
    }

    widget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    const widget = e.target.closest('.dashboard-widget');
    if (widget) {
      widget.classList.remove('drag-over');
    }
  }

  handleDrop(e) {
    e.preventDefault();

    if (!this.placeholder || !this.draggedElement) return;

    // Insert dragged element at placeholder position
    this.placeholder.parentNode.insertBefore(this.draggedElement, this.placeholder);

    // Callback
    if (this.options.onReorder) {
      this.options.onReorder(this.getLayout());
    }
  }

  handleKeyboardDrag(e) {
    const widget = e.target.closest('.dashboard-widget');
    if (!widget) return;

    const widgets = Array.from(this.container.querySelectorAll('.dashboard-widget'));
    const currentIndex = widgets.indexOf(widget);

    if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      this.container.insertBefore(widget, widgets[currentIndex - 1]);
      this.saveLayout();
      e.target.focus();
    } else if (e.key === 'ArrowDown' && currentIndex < widgets.length - 1) {
      e.preventDefault();
      this.container.insertBefore(widgets[currentIndex + 1], widget);
      this.saveLayout();
      e.target.focus();
    }
  }

  toggleCollapse(widget) {
    widget.classList.toggle('is-collapsed');
    this.saveLayout();
  }

  getLayout() {
    const widgets = this.container.querySelectorAll('.dashboard-widget');
    return Array.from(widgets).map(widget => ({
      id: widget.dataset.widgetId,
      collapsed: widget.classList.contains('is-collapsed')
    }));
  }

  saveLayout() {
    const layout = this.getLayout();
    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(layout));
    } catch (e) {
      console.warn('DashboardGrid: Could not save layout to localStorage');
    }
  }

  loadLayout() {
    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (!saved) return;

      const layout = JSON.parse(saved);
      const widgets = this.container.querySelectorAll('.dashboard-widget');
      const widgetMap = new Map();

      widgets.forEach(widget => {
        widgetMap.set(widget.dataset.widgetId, widget);
      });

      // Reorder based on saved layout
      layout.forEach(item => {
        const widget = widgetMap.get(item.id);
        if (widget) {
          this.container.appendChild(widget);
          if (item.collapsed) {
            widget.classList.add('is-collapsed');
          }
        }
      });
    } catch (e) {
      console.warn('DashboardGrid: Could not load layout from localStorage');
    }
  }

  resetLayout() {
    try {
      localStorage.removeItem(this.options.storageKey);
      window.location.reload();
    } catch (e) {
      console.warn('DashboardGrid: Could not reset layout');
    }
  }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize dashboard grids
  const grids = document.querySelectorAll('[data-dashboard-grid]');
  grids.forEach(grid => {
    new DashboardGrid(`#${grid.id}`, {
      storageKey: `vocalia-${grid.id}-layout`
    });
  });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardGrid;
}

// Global export for script usage
window.DashboardGrid = DashboardGrid;
