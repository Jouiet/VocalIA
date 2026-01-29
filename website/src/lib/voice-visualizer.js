/**
 * VocalIA Voice Visualizer - Advanced Audio Waveform Animation
 * Session 210 - 2026 Standard Implementation
 *
 * Features:
 * - Canvas-based GPU-accelerated rendering
 * - Multiple visualization modes (wave, bars, orb, pulse)
 * - Web Audio API integration for real audio
 * - Demo mode with simulated activity
 * - Responsive design
 * - Theme-aware (dark/light mode)
 */

class VoiceVisualizer {
  constructor(canvasElement, options = {}) {
    this.canvas = typeof canvasElement === 'string'
      ? document.querySelector(canvasElement)
      : canvasElement;

    if (!this.canvas) {
      console.warn('VoiceVisualizer: Canvas element not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.options = {
      mode: options.mode || 'wave',           // wave, bars, orb, pulse
      color: options.color || '#5E6AD2',      // Primary color
      secondaryColor: options.secondaryColor || '#8b5cf6',
      backgroundColor: options.backgroundColor || 'transparent',
      barCount: options.barCount || 64,
      sensitivity: options.sensitivity || 1.0,
      smoothing: options.smoothing || 0.8,
      demo: options.demo !== false,           // Demo mode by default
      ...options
    };

    this.isActive = false;
    this.analyser = null;
    this.dataArray = null;
    this.animationId = null;
    this.demoPhase = 0;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Start demo mode if enabled
    if (this.options.demo) {
      this.startDemo();
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * Connect to a MediaStream (e.g., from getUserMedia)
   */
  connectStream(stream) {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('VoiceVisualizer: Web Audio API not supported');
      return;
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = this.options.smoothing;

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.options.demo = false;
    this.start();
  }

  /**
   * Connect to an audio element
   */
  connectAudioElement(audioElement) {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('VoiceVisualizer: Web Audio API not supported');
      return;
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = this.options.smoothing;

    const source = this.audioContext.createMediaElementSource(audioElement);
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.options.demo = false;
    this.start();
  }

  /**
   * Start demo mode with simulated audio data
   */
  startDemo() {
    this.options.demo = true;
    this.dataArray = new Uint8Array(this.options.barCount);
    this.start();
  }

  /**
   * Start visualization
   */
  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.animate();
  }

  /**
   * Stop visualization
   */
  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Animation loop
   */
  animate() {
    if (!this.isActive) return;

    if (this.options.demo) {
      this.generateDemoData();
    } else if (this.analyser) {
      this.analyser.getByteFrequencyData(this.dataArray);
    }

    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Generate demo data (simulated voice activity)
   */
  generateDemoData() {
    this.demoPhase += 0.05;

    for (let i = 0; i < this.dataArray.length; i++) {
      // Simulate natural voice frequency distribution
      const normalizedIndex = i / this.dataArray.length;
      const voiceFreqWeight = Math.exp(-Math.pow(normalizedIndex - 0.3, 2) * 10);

      // Multiple wave layers for organic look
      const wave1 = Math.sin(this.demoPhase * 2 + i * 0.2) * 0.5 + 0.5;
      const wave2 = Math.sin(this.demoPhase * 3.7 + i * 0.15) * 0.3 + 0.5;
      const wave3 = Math.sin(this.demoPhase * 1.3 + i * 0.08) * 0.2 + 0.5;

      // Breathing effect
      const breathing = Math.sin(this.demoPhase * 0.5) * 0.1 + 0.9;

      const value = ((wave1 + wave2 + wave3) / 3) * voiceFreqWeight * breathing;
      this.dataArray[i] = Math.floor(value * 200 * this.options.sensitivity);
    }
  }

  /**
   * Main draw function
   */
  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Set background if specified
    if (this.options.backgroundColor !== 'transparent') {
      this.ctx.fillStyle = this.options.backgroundColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    switch (this.options.mode) {
      case 'bars':
        this.drawBars();
        break;
      case 'orb':
        this.drawOrb();
        break;
      case 'pulse':
        this.drawPulse();
        break;
      case 'wave':
      default:
        this.drawWave();
    }
  }

  /**
   * Wave visualization - flowing waveform
   */
  drawWave() {
    const sliceWidth = this.width / (this.dataArray.length - 1);
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    gradient.addColorStop(0, this.options.color);
    gradient.addColorStop(0.5, this.options.secondaryColor);
    gradient.addColorStop(1, this.options.color);

    // Draw filled wave
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);

    for (let i = 0; i < this.dataArray.length; i++) {
      const value = this.dataArray[i] / 255;
      const y = this.height - (value * this.height * 0.8 + this.height * 0.1);
      const x = i * sliceWidth;

      if (i === 0) {
        this.ctx.lineTo(x, y);
      } else {
        // Bezier curve for smooth wave
        const prevX = (i - 1) * sliceWidth;
        const cpX = (prevX + x) / 2;
        this.ctx.quadraticCurveTo(prevX, this.height - (this.dataArray[i - 1] / 255 * this.height * 0.8 + this.height * 0.1), cpX, y);
      }
    }

    this.ctx.lineTo(this.width, this.height);
    this.ctx.closePath();

    // Gradient fill
    this.ctx.fillStyle = gradient;
    this.ctx.globalAlpha = 0.3;
    this.ctx.fill();

    // Stroke line
    this.ctx.beginPath();
    for (let i = 0; i < this.dataArray.length; i++) {
      const value = this.dataArray[i] / 255;
      const y = this.height - (value * this.height * 0.8 + this.height * 0.1);
      const x = i * sliceWidth;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * sliceWidth;
        const cpX = (prevX + x) / 2;
        this.ctx.quadraticCurveTo(prevX, this.height - (this.dataArray[i - 1] / 255 * this.height * 0.8 + this.height * 0.1), cpX, y);
      }
    }

    this.ctx.strokeStyle = gradient;
    this.ctx.globalAlpha = 1;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  /**
   * Bars visualization - frequency bars
   */
  drawBars() {
    const barWidth = this.width / this.options.barCount;
    const gap = barWidth * 0.2;
    const actualBarWidth = barWidth - gap;

    const gradient = this.ctx.createLinearGradient(0, this.height, 0, 0);
    gradient.addColorStop(0, this.options.color);
    gradient.addColorStop(1, this.options.secondaryColor);

    for (let i = 0; i < this.options.barCount; i++) {
      const dataIndex = Math.floor(i * this.dataArray.length / this.options.barCount);
      const value = this.dataArray[dataIndex] / 255;
      const barHeight = Math.max(4, value * this.height * 0.9);

      const x = i * barWidth + gap / 2;
      const y = this.height - barHeight;

      // Bar glow
      this.ctx.shadowColor = this.options.color;
      this.ctx.shadowBlur = value * 10;

      // Rounded bar
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, actualBarWidth, barHeight, 3);
      this.ctx.fillStyle = gradient;
      this.ctx.fill();

      this.ctx.shadowBlur = 0;
    }
  }

  /**
   * Orb visualization - circular pulsing orb
   */
  drawOrb() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseRadius = Math.min(this.width, this.height) * 0.25;

    // Calculate average amplitude
    let avgAmplitude = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      avgAmplitude += this.dataArray[i];
    }
    avgAmplitude = avgAmplitude / this.dataArray.length / 255;

    // Draw multiple rings
    for (let ring = 4; ring >= 0; ring--) {
      const ringOffset = ring * 0.1;
      const radius = baseRadius * (1 + avgAmplitude * 0.5 + ringOffset);
      const alpha = 0.2 - ring * 0.04;

      const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `${this.options.secondaryColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(0.7, `${this.options.color}${Math.floor(alpha * 0.5 * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, 'transparent');

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }

    // Draw frequency-based spikes around orb
    const spikeCount = 32;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const dataIndex = Math.floor(i * this.dataArray.length / spikeCount);
      const value = this.dataArray[dataIndex] / 255;
      const spikeLength = baseRadius * 0.3 + value * baseRadius * 0.5;

      const innerRadius = baseRadius * (1 + avgAmplitude * 0.3);
      const outerRadius = innerRadius + spikeLength;

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;

      const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, this.options.color);
      gradient.addColorStop(1, 'transparent');

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Center orb
    const innerGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.8);
    innerGradient.addColorStop(0, this.options.secondaryColor);
    innerGradient.addColorStop(0.5, this.options.color);
    innerGradient.addColorStop(1, `${this.options.color}00`);

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, baseRadius * 0.8 * (1 + avgAmplitude * 0.2), 0, Math.PI * 2);
    this.ctx.fillStyle = innerGradient;
    this.ctx.fill();
  }

  /**
   * Pulse visualization - rippling circles
   */
  drawPulse() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const maxRadius = Math.min(this.width, this.height) * 0.45;

    // Calculate average amplitude
    let avgAmplitude = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      avgAmplitude += this.dataArray[i];
    }
    avgAmplitude = avgAmplitude / this.dataArray.length / 255;

    // Draw ripples
    const rippleCount = 5;
    for (let i = 0; i < rippleCount; i++) {
      const progress = ((this.demoPhase * 0.3 + i / rippleCount) % 1);
      const radius = progress * maxRadius;
      const alpha = (1 - progress) * 0.5 * avgAmplitude;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `${this.options.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      this.ctx.lineWidth = 2 + (1 - progress) * 3;
      this.ctx.stroke();
    }

    // Center pulse
    const pulseRadius = 20 + avgAmplitude * 30;
    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRadius);
    gradient.addColorStop(0, this.options.secondaryColor);
    gradient.addColorStop(0.6, this.options.color);
    gradient.addColorStop(1, 'transparent');

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }

  /**
   * Set visualization mode
   */
  setMode(mode) {
    this.options.mode = mode;
  }

  /**
   * Update colors (for theme switching)
   */
  setColors(primary, secondary) {
    this.options.color = primary;
    this.options.secondaryColor = secondary;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceVisualizer;
}

// Global export for script usage
window.VoiceVisualizer = VoiceVisualizer;
