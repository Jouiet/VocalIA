/**
 * VocalIA DataTable Component
 * Session 250.56: Sortable, filterable, paginated data tables
 *
 * Features:
 * - Sorting by column (asc/desc)
 * - Text search filtering
 * - Column filters (select, range, date)
 * - Pagination with page size options
 * - Row selection (single/multi)
 * - CSV export
 * - RTL support
 * - Loading states
 * - Empty states
 */

function _t(key) {
  return (typeof VocaliaI18n !== 'undefined' && VocaliaI18n.t) ? VocaliaI18n.t(key) : key;
}

const DEFAULT_CONFIG = {
  pageSize: 10,
  pageSizes: [10, 25, 50, 100],
  searchable: true,
  sortable: true,
  selectable: false,
  exportable: true,
  emptyMessage: null,
  loadingMessage: null,
  searchPlaceholder: null
};

class DataTable {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('DataTable: Container not found');
    }

    this.config = { ...DEFAULT_CONFIG, ...options };
    this.columns = options.columns || [];
    this.data = [];
    this.filteredData = [];
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.currentPage = 1;
    this.searchQuery = '';
    this.selectedRows = new Set();
    this.columnFilters = {};
    this.loading = false;

    this._init();
  }

  /**
   * Initialize the table
   */
  _init() {
    this.container.innerHTML = '';
    this.container.className = 'vocalia-datatable w-full';

    // Create structure
    this._createToolbar();
    this._createTable();
    this._createPagination();

    // Initial render
    this._applyFilters();
    this._render();
  }

  /**
   * Create toolbar with search and actions
   */
  _createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4';

    // Search
    if (this.config.searchable) {
      const searchWrapper = document.createElement('div');
      searchWrapper.className = 'relative w-full sm:w-64';
      searchWrapper.innerHTML = `
        <input type="text"
          class="w-full pl-10 rtl:pl-3 rtl:pr-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          placeholder="${this.config.searchPlaceholder || _t('datatable.search')}"
        >
        <div class="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3 rtl:pr-3 flex items-center pointer-events-none">
          <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
      `;

      const input = searchWrapper.querySelector('input');
      let debounceTimer;
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.currentPage = 1;
          this._applyFilters();
          this._render();
        }, 300);
      });

      this.toolbar.appendChild(searchWrapper);
    }

    // Actions
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'flex items-center gap-2';

    if (this.config.exportable) {
      const exportBtn = document.createElement('button');
      exportBtn.className = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors';
      exportBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        ${_t('datatable.export_csv')}
      `;
      exportBtn.addEventListener('click', () => this.exportCSV());
      actionsWrapper.appendChild(exportBtn);
    }

    this.toolbar.appendChild(actionsWrapper);
    this.container.appendChild(this.toolbar);
  }

  /**
   * Create table element
   */
  _createTable() {
    this.tableWrapper = document.createElement('div');
    this.tableWrapper.className = 'overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700';

    this.table = document.createElement('table');
    this.table.className = 'w-full text-sm';

    // Header
    this.thead = document.createElement('thead');
    this.thead.className = 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300';

    // Body
    this.tbody = document.createElement('tbody');
    this.tbody.className = 'bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700';

    this.table.appendChild(this.thead);
    this.table.appendChild(this.tbody);
    this.tableWrapper.appendChild(this.table);
    this.container.appendChild(this.tableWrapper);
  }

  /**
   * Create pagination
   */
  _createPagination() {
    this.paginationWrapper = document.createElement('div');
    this.paginationWrapper.className = 'flex flex-col sm:flex-row items-center justify-between gap-3 mt-4';
    this.container.appendChild(this.paginationWrapper);
  }

  /**
   * Render header row
   */
  _renderHeader() {
    const tr = document.createElement('tr');

    // Selection checkbox
    if (this.config.selectable) {
      const th = document.createElement('th');
      th.className = 'px-4 py-3 w-10';
      th.innerHTML = `
        <input type="checkbox" class="select-all w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500">
      `;
      th.querySelector('.select-all').addEventListener('change', (e) => {
        this._selectAll(e.target.checked);
      });
      tr.appendChild(th);
    }

    // Column headers
    this.columns.forEach(col => {
      const th = document.createElement('th');
      th.className = 'px-4 py-3 text-left rtl:text-right font-medium whitespace-nowrap';

      if (this.config.sortable && col.sortable !== false) {
        th.className += ' cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 select-none';
        th.addEventListener('click', () => this._sort(col.key));
      }

      const isActive = this.sortColumn === col.key;
      const icon = isActive
        ? (this.sortDirection === 'asc' ? '↑' : '↓')
        : '';

      th.innerHTML = `
        <div class="flex items-center gap-1">
          <span>${col.label}</span>
          ${this.config.sortable && col.sortable !== false ? `<span class="text-indigo-500">${icon}</span>` : ''}
        </div>
      `;

      tr.appendChild(th);
    });

    this.thead.innerHTML = '';
    this.thead.appendChild(tr);
  }

  /**
   * Render body rows
   */
  _renderBody() {
    this.tbody.innerHTML = '';

    if (this.loading) {
      this._renderLoading();
      return;
    }

    const pageData = this._getPageData();

    if (pageData.length === 0) {
      this._renderEmpty();
      return;
    }

    pageData.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors';
      tr.dataset.index = index;

      // Selection checkbox
      if (this.config.selectable) {
        const td = document.createElement('td');
        td.className = 'px-4 py-3';
        const rowId = row.id || index;
        td.innerHTML = `
          <input type="checkbox" class="row-select w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500" data-id="${rowId}" ${this.selectedRows.has(rowId) ? 'checked' : ''}>
        `;
        td.querySelector('.row-select').addEventListener('change', (e) => {
          this._selectRow(rowId, e.target.checked);
        });
        tr.appendChild(td);
      }

      // Data cells
      this.columns.forEach(col => {
        const td = document.createElement('td');
        td.className = 'px-4 py-3 text-slate-700 dark:text-slate-300';

        const value = this._getValue(row, col.key);

        if (col.render) {
          // W3 fix: col.render may return unsafe HTML — use textContent as default,
          // render callbacks that need HTML should return a DocumentFragment or Element
          const rendered = col.render(value, row, index);
          if (rendered instanceof HTMLElement || rendered instanceof DocumentFragment) {
            td.appendChild(rendered);
          } else {
            td.innerHTML = rendered;
          }
        } else if (col.type === 'date') {
          td.textContent = value ? new Date(value).toLocaleDateString() : '-';
        } else if (col.type === 'datetime') {
          td.textContent = value ? new Date(value).toLocaleString() : '-';
        } else if (col.type === 'badge') {
          const colors = col.badgeColors || {};
          const color = colors[value] || 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
          td.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}">${this._escapeHtml(value || '-')}</span>`;
        } else if (col.type === 'boolean') {
          const icon = value
            ? '<svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
            : '<svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
          td.innerHTML = icon;
        } else {
          td.textContent = value ?? '-';
        }

        tr.appendChild(td);
      });

      // Row click
      if (this.config.onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
          if (!e.target.closest('input, button, a')) {
            this.config.onRowClick(row, index);
          }
        });
      }

      this.tbody.appendChild(tr);
    });
  }

  /**
   * Render loading state
   */
  _renderLoading() {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = this.columns.length + (this.config.selectable ? 1 : 0);
    td.className = 'px-4 py-12 text-center';
    td.innerHTML = `
      <div class="flex flex-col items-center gap-3">
        <svg class="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-slate-500">${this.config.loadingMessage || _t('datatable.loading')}</span>
      </div>
    `;
    tr.appendChild(td);
    this.tbody.appendChild(tr);
  }

  /**
   * Render empty state
   */
  _renderEmpty() {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = this.columns.length + (this.config.selectable ? 1 : 0);
    td.className = 'px-4 py-12 text-center';
    td.innerHTML = `
      <div class="flex flex-col items-center gap-3">
        <svg class="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <span class="text-slate-500">${this.config.emptyMessage || _t('datatable.empty')}</span>
      </div>
    `;
    tr.appendChild(td);
    this.tbody.appendChild(tr);
  }

  /**
   * Render pagination
   */
  _renderPagination() {
    const total = this.filteredData.length;
    const totalPages = Math.ceil(total / this.config.pageSize);
    const start = (this.currentPage - 1) * this.config.pageSize + 1;
    const end = Math.min(start + this.config.pageSize - 1, total);

    this.paginationWrapper.innerHTML = `
      <div class="text-sm text-slate-600 dark:text-slate-400">
        ${total > 0 ? _t('datatable.showing').replace('{start}', start).replace('{end}', end).replace('{total}', total) : ''}
      </div>
      <div class="flex items-center gap-2">
        <select class="page-size px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          ${this.config.pageSizes.map(size => `
            <option value="${size}" ${size === this.config.pageSize ? 'selected' : ''}>${size} / ${_t('datatable.page')}</option>
          `).join('')}
        </select>
        <nav class="flex items-center gap-1">
          <button class="prev px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${this.currentPage === 1 ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="px-3 py-1 text-sm text-slate-700 dark:text-slate-200">
            ${this.currentPage} / ${totalPages || 1}
          </span>
          <button class="next px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${this.currentPage >= totalPages ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </nav>
      </div>
    `;

    // Event listeners
    this.paginationWrapper.querySelector('.page-size')?.addEventListener('change', (e) => {
      this.config.pageSize = parseInt(e.target.value);
      this.currentPage = 1;
      this._render();
    });

    this.paginationWrapper.querySelector('.prev')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this._render();
      }
    });

    this.paginationWrapper.querySelector('.next')?.addEventListener('click', () => {
      const totalPages = Math.ceil(this.filteredData.length / this.config.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this._render();
      }
    });
  }

  /**
   * Apply search and column filters
   */
  _applyFilters() {
    this.filteredData = this.data.filter(row => {
      // Text search
      if (this.searchQuery) {
        const searchable = this.columns
          .filter(col => col.searchable !== false)
          .map(col => String(this._getValue(row, col.key) || '').toLowerCase());

        if (!searchable.some(val => val.includes(this.searchQuery))) {
          return false;
        }
      }

      // Column filters
      for (const [key, filter] of Object.entries(this.columnFilters)) {
        const value = this._getValue(row, key);
        if (!this._matchFilter(value, filter)) {
          return false;
        }
      }

      return true;
    });

    // Apply sort
    if (this.sortColumn) {
      const col = this.columns.find(c => c.key === this.sortColumn);
      this.filteredData.sort((a, b) => {
        let valA = this._getValue(a, this.sortColumn);
        let valB = this._getValue(b, this.sortColumn);

        // Handle dates
        if (col?.type === 'date' || col?.type === 'datetime') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        }

        // Handle numbers
        if (typeof valA === 'number' && typeof valB === 'number') {
          return this.sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        // Handle strings
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        const cmp = valA.localeCompare(valB);
        return this.sortDirection === 'asc' ? cmp : -cmp;
      });
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  /**
   * Get nested value from object
   */
  _getValue(obj, key) {
    return key.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Check if value matches filter
   */
  _matchFilter(value, filter) {
    if (filter.type === 'equals') {
      return value === filter.value;
    }
    if (filter.type === 'contains') {
      return String(value || '').toLowerCase().includes(String(filter.value).toLowerCase());
    }
    if (filter.type === 'range') {
      const num = Number(value);
      return (!filter.min || num >= filter.min) && (!filter.max || num <= filter.max);
    }
    if (filter.type === 'dateRange') {
      const date = new Date(value).getTime();
      return (!filter.start || date >= new Date(filter.start).getTime()) &&
             (!filter.end || date <= new Date(filter.end).getTime());
    }
    return true;
  }

  /**
   * Get current page data
   */
  _getPageData() {
    const start = (this.currentPage - 1) * this.config.pageSize;
    return this.filteredData.slice(start, start + this.config.pageSize);
  }

  /**
   * Sort by column
   */
  _sort(key) {
    if (this.sortColumn === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = key;
      this.sortDirection = 'asc';
    }
    this._applyFilters();
    this._render();
  }

  /**
   * Select/deselect row
   */
  _selectRow(id, selected) {
    if (selected) {
      this.selectedRows.add(id);
    } else {
      this.selectedRows.delete(id);
    }

    if (this.config.onSelectionChange) {
      this.config.onSelectionChange([...this.selectedRows]);
    }
  }

  /**
   * Select/deselect all rows
   */
  _selectAll(selected) {
    this._getPageData().forEach((row, i) => {
      const id = row.id || i;
      if (selected) {
        this.selectedRows.add(id);
      } else {
        this.selectedRows.delete(id);
      }
    });

    this._render();

    if (this.config.onSelectionChange) {
      this.config.onSelectionChange([...this.selectedRows]);
    }
  }

  /**
   * Render entire table
   */
  _render() {
    this._renderHeader();
    this._renderBody();
    this._renderPagination();
  }

  // ==================== PUBLIC API ====================

  /**
   * Set data and re-render
   */
  setData(data) {
    this.data = data || [];
    this.currentPage = 1;
    this.selectedRows.clear();
    this._applyFilters();
    this._render();
  }

  /**
   * Add data rows
   */
  addData(rows) {
    this.data = [...this.data, ...(Array.isArray(rows) ? rows : [rows])];
    this._applyFilters();
    this._render();
  }

  /**
   * Update a row by id
   */
  updateRow(id, updates) {
    const index = this.data.findIndex(row => row.id === id);
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...updates };
      this._applyFilters();
      this._render();
    }
  }

  /**
   * Remove a row by id
   */
  removeRow(id) {
    this.data = this.data.filter(row => row.id !== id);
    this.selectedRows.delete(id);
    this._applyFilters();
    this._render();
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.loading = loading;
    this._render();
  }

  /**
   * Set column filter
   */
  setFilter(key, filter) {
    if (filter) {
      this.columnFilters[key] = filter;
    } else {
      delete this.columnFilters[key];
    }
    this.currentPage = 1;
    this._applyFilters();
    this._render();
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.searchQuery = '';
    this.columnFilters = {};
    this.currentPage = 1;
    this._applyFilters();
    this._render();

    // Clear search input
    const searchInput = this.toolbar.querySelector('input');
    if (searchInput) searchInput.value = '';
  }

  /**
   * Get selected rows
   */
  getSelectedRows() {
    return this.data.filter(row => this.selectedRows.has(row.id || this.data.indexOf(row)));
  }

  /**
   * Export to CSV
   */
  exportCSV(filename = 'export.csv') {
    const headers = this.columns.map(col => col.label);
    const rows = this.filteredData.map(row =>
      this.columns.map(col => {
        const value = this._getValue(row, col.key);
        // Escape quotes and wrap in quotes if contains comma
        const str = String(value ?? '');
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
    );

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * Refresh (re-apply filters and re-render)
   */
  refresh() {
    this._applyFilters();
    this._render();
  }

  /**
   * Destroy the table
   */
  destroy() {
    this.container.innerHTML = '';
  }
}

// Export
if (typeof window !== 'undefined') {
  window.VocaliaDataTable = DataTable;
}

export default DataTable;
export { DataTable };
