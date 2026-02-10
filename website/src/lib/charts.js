/**
 * VocalIA Charts Component
 * Session 250.56: Chart.js wrapper with VocalIA styling
 *
 * Features:
 * - Pre-configured chart types (line, bar, doughnut, pie, area)
 * - VocalIA color palette
 * - Dark mode support
 * - Responsive by default
 * - RTL support
 * - Loading states
 * - Easy data updates
 */

// VocalIA color palette
const COLORS = {
  primary: '#6366f1',      // Indigo
  secondary: '#8b5cf6',    // Violet
  success: '#22c55e',      // Green
  warning: '#f59e0b',      // Amber
  danger: '#ef4444',       // Red
  info: '#3b82f6',         // Blue
  slate: '#64748b',        // Slate
  palette: [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6',
    '#6b7280', '#a855f7'
  ]
};

// Default chart configuration
const DEFAULT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          family: 'Inter, sans-serif'
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: {
        family: 'Inter, sans-serif',
        weight: '600'
      },
      bodyFont: {
        family: 'Inter, sans-serif'
      },
      padding: 12,
      cornerRadius: 8,
      displayColors: true
    }
  }
};

/**
 * VocaliaChart wrapper class
 */
class VocaliaChart {
  constructor(canvas, type, options = {}) {
    this.canvas = typeof canvas === 'string'
      ? document.querySelector(canvas)
      : canvas;

    if (!this.canvas) {
      throw new Error('VocaliaChart: Canvas not found');
    }

    this.type = type;
    this.userOptions = options;
    this.chart = null;
    this.loading = false;

    // Check for Chart.js
    if (typeof Chart === 'undefined') {
      console.error('VocaliaChart: Chart.js is required');
      return;
    }

    this._init();
  }

  /**
   * Initialize chart
   */
  _init() {
    const ctx = this.canvas.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');

    // Merge options
    const options = this._mergeOptions(isDark);

    this.chart = new Chart(ctx, {
      type: this.type,
      data: this.userOptions.data || { labels: [], datasets: [] },
      options
    });

    // Watch for dark mode changes
    this._setupDarkModeObserver();
  }

  /**
   * Merge default options with user options
   */
  _mergeOptions(isDark) {
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#e2e8f0' : '#334155';

    const baseOptions = {
      ...DEFAULT_OPTIONS,
      plugins: {
        ...DEFAULT_OPTIONS.plugins,
        legend: {
          ...DEFAULT_OPTIONS.plugins.legend,
          labels: {
            ...DEFAULT_OPTIONS.plugins.legend.labels,
            color: textColor
          }
        }
      }
    };

    // Add scales for line, bar, area charts
    if (['line', 'bar', 'area'].includes(this.type)) {
      baseOptions.scales = {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'Inter, sans-serif' } }
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'Inter, sans-serif' } },
          beginAtZero: true
        }
      };
    }

    // Deep merge user options
    return this._deepMerge(baseOptions, this.userOptions.options || {});
  }

  /**
   * Deep merge objects
   */
  _deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  /**
   * Setup dark mode observer
   */
  _setupDarkModeObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          this._updateColors(isDark);
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    this._darkModeObserver = observer;
  }

  /**
   * Update colors for dark mode
   */
  _updateColors(isDark) {
    if (!this.chart) return;

    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#e2e8f0' : '#334155';

    // Update legend
    if (this.chart.options.plugins?.legend?.labels) {
      this.chart.options.plugins.legend.labels.color = textColor;
    }

    // Update scales
    if (this.chart.options.scales) {
      Object.values(this.chart.options.scales).forEach(scale => {
        if (scale.grid) scale.grid.color = gridColor;
        if (scale.ticks) scale.ticks.color = textColor;
      });
    }

    this.chart.update();
  }

  // ==================== PUBLIC API ====================

  /**
   * Update chart data
   */
  setData(data) {
    if (!this.chart) return;

    this.chart.data = data;
    this.chart.update();
  }

  /**
   * Update specific dataset
   */
  updateDataset(index, data) {
    if (!this.chart || !this.chart.data.datasets[index]) return;

    Object.assign(this.chart.data.datasets[index], data);
    this.chart.update();
  }

  /**
   * Add data point to all datasets
   */
  addData(label, values) {
    if (!this.chart) return;

    this.chart.data.labels.push(label);
    this.chart.data.datasets.forEach((dataset, i) => {
      dataset.data.push(values[i] || 0);
    });
    this.chart.update();
  }

  /**
   * Remove first data point
   */
  shiftData() {
    if (!this.chart) return;

    this.chart.data.labels.shift();
    this.chart.data.datasets.forEach(dataset => {
      dataset.data.shift();
    });
    this.chart.update();
  }

  /**
   * Update options
   */
  setOptions(options) {
    if (!this.chart) return;

    this.chart.options = this._deepMerge(this.chart.options, options);
    this.chart.update();
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.loading = true;
    if (!this.chart) return;

    // Create overlay
    const parent = this.canvas.parentElement;
    let overlay = parent.querySelector('.chart-loading');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-loading absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-800/80';
      overlay.innerHTML = `
        <svg class="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
      parent.style.position = 'relative';
      parent.appendChild(overlay);
    }

    overlay.classList.remove('hidden');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.loading = false;
    const parent = this.canvas.parentElement;
    const overlay = parent.querySelector('.chart-loading');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  /**
   * Resize chart
   */
  resize() {
    if (this.chart) {
      this.chart.resize();
    }
  }

  /**
   * Destroy chart
   */
  destroy() {
    if (this._darkModeObserver) {
      this._darkModeObserver.disconnect();
      this._darkModeObserver = null;
    }
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Get chart instance
   */
  getInstance() {
    return this.chart;
  }
}

// ==================== FACTORY FUNCTIONS ====================

/**
 * Create line chart
 */
function createLineChart(canvas, { labels = [], datasets = [], ...options } = {}) {
  const formattedDatasets = datasets.map((ds, i) => ({
    label: ds.label || `Dataset ${i + 1}`,
    data: ds.data || [],
    borderColor: ds.color || COLORS.palette[i % COLORS.palette.length],
    backgroundColor: (ds.color || COLORS.palette[i % COLORS.palette.length]) + '20',
    borderWidth: 2,
    tension: 0.4,
    fill: ds.fill !== false,
    pointRadius: ds.pointRadius ?? 3,
    pointHoverRadius: 5,
    ...ds
  }));

  return new VocaliaChart(canvas, 'line', {
    data: { labels, datasets: formattedDatasets },
    options
  });
}

/**
 * Create bar chart
 */
function createBarChart(canvas, { labels = [], datasets = [], ...options } = {}) {
  const formattedDatasets = datasets.map((ds, i) => ({
    label: ds.label || `Dataset ${i + 1}`,
    data: ds.data || [],
    backgroundColor: ds.color || COLORS.palette[i % COLORS.palette.length],
    borderRadius: 4,
    barPercentage: 0.7,
    ...ds
  }));

  return new VocaliaChart(canvas, 'bar', {
    data: { labels, datasets: formattedDatasets },
    options
  });
}

/**
 * Create doughnut chart
 */
function createDoughnutChart(canvas, { labels = [], data = [], colors = [], ...options } = {}) {
  return new VocaliaChart(canvas, 'doughnut', {
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.length ? colors : COLORS.palette.slice(0, data.length),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '60%',
      ...options
    }
  });
}

/**
 * Create pie chart
 */
function createPieChart(canvas, { labels = [], data = [], colors = [], ...options } = {}) {
  return new VocaliaChart(canvas, 'pie', {
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.length ? colors : COLORS.palette.slice(0, data.length),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options
  });
}

/**
 * Create area chart (filled line)
 */
function createAreaChart(canvas, options = {}) {
  return createLineChart(canvas, {
    ...options,
    datasets: (options.datasets || []).map(ds => ({
      ...ds,
      fill: true
    }))
  });
}

// Export
const charts = {
  VocaliaChart,
  createLineChart,
  createBarChart,
  createDoughnutChart,
  createPieChart,
  createAreaChart,
  COLORS
};

if (typeof window !== 'undefined') {
  window.VocaliaCharts = charts;
}

export default charts;
export {
  VocaliaChart,
  createLineChart,
  createBarChart,
  createDoughnutChart,
  createPieChart,
  createAreaChart,
  COLORS
};
