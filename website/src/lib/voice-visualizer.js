/**
 * VocalIA Voice Visualizer - Premium Audio Visualization
 * Session 210 - Enhanced Visual Design
 *
 * Features:
 * - Canvas-based GPU-accelerated rendering
 * - Multiple visualization modes (wave, bars, orb, pulse)
 * - Vibrant neon color palette with high contrast
 * - Dramatic glow effects
 * - Ambient background gradients
 * - Web Audio API integration
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

    // PURE SKY BLUE - Exact match from user reference image
    this.options = {
      mode: options.mode || 'wave',
      // Pure sky blue ONLY - NO purple/violet
      primaryColor: options.primaryColor || '#5DADE2',    // Sky Blue (exact from reference)
      secondaryColor: options.secondaryColor || '#85C1E9', // Light Sky Blue
      accentColor: options.accentColor || '#5DADE2',       // Same sky blue (no lavender)
      glowColor: options.glowColor || '#5DADE2',           // Same sky blue glow
      barCount: options.barCount || 32,
      sensitivity: options.sensitivity || 1.0,
      smoothing: options.smoothing || 0.8,
      demo: options.demo !== false,
      showAmbient: options.showAmbient !== false,
      ...options
    };

    this.isActive = false;
    this.analyser = null;
    this.dataArray = null;
    this.animationId = null;
    this.demoPhase = 0;
    this.time = 0;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

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

  startDemo() {
    this.options.demo = true;
    this.dataArray = new Uint8Array(this.options.barCount);
    this.start();
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.animate();
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    if (!this.isActive) return;

    // Safety check - don't animate if canvas has no size
    if (!this.width || !this.height || this.width <= 0 || this.height <= 0) {
      this.resize();
      this.animationId = requestAnimationFrame(() => this.animate());
      return;
    }

    this.time += 0.016; // ~60fps timing

    if (this.options.demo) {
      this.generateDemoData();
    } else if (this.analyser) {
      this.analyser.getByteFrequencyData(this.dataArray);
    }

    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  generateDemoData() {
    this.demoPhase += 0.04;

    for (let i = 0; i < this.dataArray.length; i++) {
      const normalizedIndex = i / this.dataArray.length;

      // Natural voice frequency curve (peak around 30%)
      const voiceFreqWeight = Math.exp(-Math.pow(normalizedIndex - 0.3, 2) * 8);

      // Multiple organic waves
      const wave1 = Math.sin(this.demoPhase * 2.5 + i * 0.25) * 0.5 + 0.5;
      const wave2 = Math.sin(this.demoPhase * 3.3 + i * 0.18) * 0.35 + 0.5;
      const wave3 = Math.sin(this.demoPhase * 1.7 + i * 0.1) * 0.25 + 0.5;

      // Breathing pulse
      const breathing = Math.sin(this.demoPhase * 0.6) * 0.15 + 0.85;

      // Random micro-variations for organic feel
      const noise = (Math.random() - 0.5) * 0.1;

      const value = ((wave1 + wave2 + wave3) / 3 + noise) * voiceFreqWeight * breathing;
      this.dataArray[i] = Math.floor(Math.max(0, Math.min(255, value * 220 * this.options.sensitivity)));
    }
  }

  /**
   * Draw ambient background glow
   */
  drawAmbient(intensity = 0.2) {
    // Very subtle bottom gradient
    const gradient = this.ctx.createLinearGradient(0, this.height, 0, 0);
    gradient.addColorStop(0, `${this.options.primaryColor}${Math.floor(intensity * 20).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(0.4, 'transparent');
    gradient.addColorStop(1, 'transparent');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  draw() {
    try {
      // Clear canvas completely - clean look
      this.ctx.fillStyle = 'rgba(15, 20, 30, 1)';
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Calculate average for ambient
      let avg = 0;
      for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
      avg = avg / this.dataArray.length / 255;

      // Subtle ambient glow
      if (this.options.showAmbient) {
        this.drawAmbient(avg * 0.3 + 0.1);
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
    } catch (e) {
      console.error('[VoiceVisualizer] Draw error:', e.message);
    }
  }

  /**
   * WAVE - Flowing neon waveform
   */
  drawWave() {
    const sliceWidth = this.width / (this.dataArray.length - 1);

    // Horizontal gradient
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    gradient.addColorStop(0, this.options.primaryColor);
    gradient.addColorStop(0.3, this.options.secondaryColor);
    gradient.addColorStop(0.7, this.options.primaryColor);
    gradient.addColorStop(1, this.options.accentColor);

    // GLOW LAYER - 5 passes for intense neon effect
    for (let glow = 4; glow >= 0; glow--) {
      this.ctx.beginPath();

      for (let i = 0; i < this.dataArray.length; i++) {
        const value = this.dataArray[i] / 255;
        const y = this.height - (value * this.height * 0.8 + this.height * 0.1);
        const x = i * sliceWidth;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          const prevX = (i - 1) * sliceWidth;
          const prevY = this.height - (this.dataArray[i - 1] / 255 * this.height * 0.8 + this.height * 0.1);
          const cpX = (prevX + x) / 2;
          this.ctx.quadraticCurveTo(prevX, prevY, cpX, y);
        }
      }

      // Subtle glow effect
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = glow === 0 ? 2 : 1 + glow * 2;
      this.ctx.globalAlpha = glow === 0 ? 0.9 : 0.12;
      this.ctx.shadowColor = this.options.primaryColor;
      this.ctx.shadowBlur = 5 + glow * 5;
      this.ctx.stroke();
    }

    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;

    // Filled area under wave
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);

    for (let i = 0; i < this.dataArray.length; i++) {
      const value = this.dataArray[i] / 255;
      const y = this.height - (value * this.height * 0.75 + this.height * 0.12);
      const x = i * sliceWidth;

      if (i === 0) {
        this.ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * sliceWidth;
        const prevY = this.height - (this.dataArray[i - 1] / 255 * this.height * 0.75 + this.height * 0.12);
        const cpX = (prevX + x) / 2;
        this.ctx.quadraticCurveTo(prevX, prevY, cpX, y);
      }
    }

    this.ctx.lineTo(this.width, this.height);
    this.ctx.closePath();

    // Vertical gradient fill
    const fillGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    fillGradient.addColorStop(0, `${this.options.primaryColor}60`);
    fillGradient.addColorStop(0.5, `${this.options.secondaryColor}30`);
    fillGradient.addColorStop(1, 'transparent');

    this.ctx.fillStyle = fillGradient;
    this.ctx.fill();
  }

  /**
   * BARS - Frequency visualizer with neon glow
   */
  drawBars() {
    const barCount = this.options.barCount;
    const barWidth = this.width / barCount;
    const gap = barWidth * 0.25;
    const actualBarWidth = barWidth - gap;

    // Calculate average for glow intensity
    let avg = 0;
    for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
    avg = avg / this.dataArray.length / 255;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * this.dataArray.length / barCount);
      const value = this.dataArray[dataIndex] / 255;
      const barHeight = Math.max(6, value * this.height * 0.85);

      const x = i * barWidth + gap / 2;
      const y = this.height - barHeight;

      // Color based on frequency position - BLUE gradient
      const hue = 200 + (i / barCount) * 20; // Blue range (200-220)
      const saturation = 85 + value * 15;    // 85-100%
      const lightness = 55 + value * 25;     // Brighter: 55-80%
      const barColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      // Subtle glow effect
      this.ctx.shadowColor = this.options.primaryColor;
      this.ctx.shadowBlur = 4 + value * 8;

      // Bar gradient
      const barGradient = this.ctx.createLinearGradient(x, y + barHeight, x, y);
      barGradient.addColorStop(0, `${this.options.primaryColor}40`);
      barGradient.addColorStop(0.5, barColor);
      barGradient.addColorStop(1, this.options.secondaryColor);

      // Draw rounded bar
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, actualBarWidth, barHeight, 4);
      this.ctx.fillStyle = barGradient;
      this.ctx.fill();

      // Top cap highlight
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, actualBarWidth, 4, 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = value * 0.8;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    this.ctx.shadowBlur = 0;

    // Reflection effect
    this.ctx.globalAlpha = 0.15;
    this.ctx.scale(1, -0.3);
    this.ctx.translate(0, -this.height * 4.33);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * this.dataArray.length / barCount);
      const value = this.dataArray[dataIndex] / 255;
      const barHeight = Math.max(6, value * this.height * 0.85);

      const x = i * barWidth + gap / 2;
      const y = this.height - barHeight;

      const hue = 200 + (i / barCount) * 20; // Blue range for reflection

      this.ctx.beginPath();
      this.ctx.roundRect(x, y, actualBarWidth, barHeight, 4);
      this.ctx.fillStyle = `hsl(${hue}, 90%, 65%)`;
      this.ctx.fill();
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    this.ctx.scale(dpr, dpr);
    this.ctx.globalAlpha = 1;
  }

  /**
   * ORB - Elegant pulsing orb with subtle rays
   */
  drawOrb() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseRadius = Math.min(this.width, this.height) * 0.22; // Smaller base

    // Average amplitude
    let avg = 0;
    for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
    avg = avg / this.dataArray.length / 255;

    // Outer glow rings - fewer and more subtle
    for (let ring = 2; ring >= 0; ring--) {
      const ringRadius = baseRadius * (1.3 + ring * 0.12 + avg * 0.2);
      const alpha = (0.2 - ring * 0.05) * (0.4 + avg * 0.3);

      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, ringRadius * 0.6,
        centerX, centerY, ringRadius
      );
      gradient.addColorStop(0, `${this.options.primaryColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(0.7, `${this.options.secondaryColor}${Math.floor(alpha * 0.2 * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, 'transparent');

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }

    // Energy rays - fewer and thinner
    const rayCount = 24; // Reduced from 48
    this.ctx.lineCap = 'round';

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + this.time * 0.3; // Slower rotation
      const dataIndex = Math.floor(i * this.dataArray.length / rayCount);
      const value = this.dataArray[dataIndex] / 255;

      const innerRadius = baseRadius * (0.95 + avg * 0.1);
      const rayLength = baseRadius * 0.3 + value * baseRadius * 0.5; // Shorter rays
      const outerRadius = innerRadius + rayLength;

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;

      // Ray gradient
      const rayGradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
      rayGradient.addColorStop(0, this.options.primaryColor);
      rayGradient.addColorStop(0.5, this.options.secondaryColor);
      rayGradient.addColorStop(1, 'transparent');

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = rayGradient;
      this.ctx.lineWidth = 1 + value * 1.5; // Thinner rays
      this.ctx.globalAlpha = 0.4 + value * 0.3; // More transparent
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;

    // Core orb - smaller with subtle glow
    this.ctx.shadowColor = this.options.primaryColor;
    this.ctx.shadowBlur = 8 + avg * 5; // Reduced glow

    const coreRadius = baseRadius * 0.55 * (1 + avg * 0.15); // Smaller core
    const coreGradient = this.ctx.createRadialGradient(
      centerX - coreRadius * 0.15, centerY - coreRadius * 0.15, 0,
      centerX, centerY, coreRadius
    );
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.25, this.options.primaryColor);
    coreGradient.addColorStop(0.7, this.options.secondaryColor);
    coreGradient.addColorStop(1, this.options.accentColor);

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = coreGradient;
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Inner shine - smaller
    const shineGradient = this.ctx.createRadialGradient(
      centerX - coreRadius * 0.25, centerY - coreRadius * 0.25, 0,
      centerX, centerY, coreRadius * 0.45
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    shineGradient.addColorStop(1, 'transparent');

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, coreRadius * 0.45, 0, Math.PI * 2);
    this.ctx.fillStyle = shineGradient;
    this.ctx.fill();
  }

  /**
   * PULSE - Expanding ripples with center beacon
   */
  drawPulse() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const maxRadius = Math.min(this.width, this.height) * 0.38; // Smaller radius

    // Average amplitude
    let avg = 0;
    for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
    avg = avg / this.dataArray.length / 255;

    // Ripples - more subtle
    const rippleCount = 4; // Fewer ripples
    for (let i = 0; i < rippleCount; i++) {
      const progress = ((this.time * 0.3 + i / rippleCount) % 1); // Slower
      const radius = progress * maxRadius;
      const alpha = (1 - progress) * (0.3 + avg * 0.3); // More transparent
      const lineWidth = 1 + (1 - progress) * 2; // Thinner lines

      // Subtle ripple glow
      this.ctx.shadowColor = this.options.primaryColor;
      this.ctx.shadowBlur = 5; // Reduced glow

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      // Gradient stroke effect (ensure inner radius is never negative)
      const innerRadius = Math.max(0, radius - lineWidth);
      const rippleGradient = this.ctx.createRadialGradient(
        centerX, centerY, innerRadius,
        centerX, centerY, radius + lineWidth
      );
      rippleGradient.addColorStop(0, 'transparent');
      rippleGradient.addColorStop(0.5, `${this.options.primaryColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
      rippleGradient.addColorStop(1, 'transparent');

      this.ctx.strokeStyle = `${this.options.primaryColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }

    this.ctx.shadowBlur = 0;

    // Center pulse beacon - smaller and more elegant
    const pulseRadius = 15 + avg * 20; // Reduced size

    // Subtle outer glow
    this.ctx.shadowColor = this.options.primaryColor;
    this.ctx.shadowBlur = 10; // Reduced glow

    const beaconGradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, pulseRadius
    );
    beaconGradient.addColorStop(0, '#ffffff');
    beaconGradient.addColorStop(0.3, this.options.primaryColor);
    beaconGradient.addColorStop(0.7, this.options.secondaryColor);
    beaconGradient.addColorStop(1, 'transparent');

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = beaconGradient;
    this.ctx.fill();

    // Inner bright core
    const coreGradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, pulseRadius * 0.4
    );
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(1, this.options.primaryColor);

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, pulseRadius * 0.4, 0, Math.PI * 2);
    this.ctx.fillStyle = coreGradient;
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Particle sparks - subtle and fewer
    const sparkCount = 8; // Fewer sparks
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + this.time * 0.5; // Slower rotation
      const sparkProgress = ((this.time * 1.5 + i * 0.3) % 1);
      const sparkRadius = pulseRadius * 0.8 + sparkProgress * maxRadius * 0.3;
      const sparkAlpha = (1 - sparkProgress) * avg * 0.6; // More transparent

      const sparkX = centerX + Math.cos(angle) * sparkRadius;
      const sparkY = centerY + Math.sin(angle) * sparkRadius;

      this.ctx.beginPath();
      this.ctx.arc(sparkX, sparkY, 1.5 + avg * 2, 0, Math.PI * 2); // Smaller sparks
      this.ctx.fillStyle = `${this.options.primaryColor}${Math.floor(sparkAlpha * 255).toString(16).padStart(2, '0')}`;
      this.ctx.fill();
    }
  }

  setMode(mode) {
    this.options.mode = mode;
  }

  setColors(primary, secondary, accent) {
    this.options.primaryColor = primary;
    this.options.secondaryColor = secondary;
    if (accent) this.options.accentColor = accent;
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceVisualizer;
}
window.VoiceVisualizer = VoiceVisualizer;
