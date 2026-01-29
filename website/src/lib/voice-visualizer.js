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

    // BLUE EQUALIZER palette - Classic audio visualizer style
    this.options = {
      mode: options.mode || 'wave',
      // Blue gradient palette (from user reference image)
      primaryColor: options.primaryColor || '#5cb8ff',    // Bright Sky Blue
      secondaryColor: options.secondaryColor || '#1e90ff', // Dodger Blue
      accentColor: options.accentColor || '#a8d8ff',       // Light Ice Blue
      glowColor: options.glowColor || '#ffffff',           // White glow for intensity
      barCount: options.barCount || 48,
      sensitivity: options.sensitivity || 1.5,
      smoothing: options.smoothing || 0.7,
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
  drawAmbient(intensity = 0.5) {
    // Bottom-up gradient glow
    const gradient = this.ctx.createLinearGradient(0, this.height, 0, 0);
    gradient.addColorStop(0, `${this.options.primaryColor}${Math.floor(intensity * 40).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(0.5, `${this.options.accentColor}15`);
    gradient.addColorStop(1, 'transparent');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  draw() {
    // Clear with slight fade for trail effect - darker for more contrast
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Calculate average for ambient
    let avg = 0;
    for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
    avg = avg / this.dataArray.length / 255;

    // Draw stronger ambient glow
    if (this.options.showAmbient) {
      this.drawAmbient(avg * 1.2 + 0.3);
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

      // Intense glow effect
      this.ctx.strokeStyle = glow === 0 ? '#ffffff' : gradient;
      this.ctx.lineWidth = glow === 0 ? 3 : 4 + glow * 5;
      this.ctx.globalAlpha = glow === 0 ? 1 : 0.25;
      this.ctx.shadowColor = this.options.glowColor;
      this.ctx.shadowBlur = 20 + glow * 20;
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

      // INTENSE Glow effect
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 25 + value * 40;

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
   * ORB - Pulsing energy orb with rays
   */
  drawOrb() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseRadius = Math.min(this.width, this.height) * 0.28;

    // Average amplitude
    let avg = 0;
    for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
    avg = avg / this.dataArray.length / 255;

    // Outer glow rings
    for (let ring = 5; ring >= 0; ring--) {
      const ringRadius = baseRadius * (1.5 + ring * 0.15 + avg * 0.4);
      const alpha = (0.4 - ring * 0.06) * (0.5 + avg * 0.5);

      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, ringRadius * 0.5,
        centerX, centerY, ringRadius
      );
      gradient.addColorStop(0, `${this.options.primaryColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(0.7, `${this.options.secondaryColor}${Math.floor(alpha * 0.3 * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, 'transparent');

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }

    // Energy rays
    const rayCount = 48;
    this.ctx.lineCap = 'round';

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + this.time * 0.5;
      const dataIndex = Math.floor(i * this.dataArray.length / rayCount);
      const value = this.dataArray[dataIndex] / 255;

      const innerRadius = baseRadius * (0.9 + avg * 0.2);
      const rayLength = baseRadius * 0.4 + value * baseRadius * 0.8;
      const outerRadius = innerRadius + rayLength;

      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;

      // Ray gradient
      const rayGradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
      rayGradient.addColorStop(0, this.options.primaryColor);
      rayGradient.addColorStop(0.6, this.options.secondaryColor);
      rayGradient.addColorStop(1, 'transparent');

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = rayGradient;
      this.ctx.lineWidth = 2 + value * 3;
      this.ctx.globalAlpha = 0.6 + value * 0.4;
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;

    // Core orb with ULTRA intense glow
    this.ctx.shadowColor = '#ffffff';
    this.ctx.shadowBlur = 60 + avg * 50;

    const coreRadius = baseRadius * 0.65 * (1 + avg * 0.25);
    const coreGradient = this.ctx.createRadialGradient(
      centerX - coreRadius * 0.2, centerY - coreRadius * 0.2, 0,
      centerX, centerY, coreRadius
    );
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.2, this.options.primaryColor);
    coreGradient.addColorStop(0.6, this.options.secondaryColor);
    coreGradient.addColorStop(1, this.options.accentColor);

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = coreGradient;
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Inner shine
    const shineGradient = this.ctx.createRadialGradient(
      centerX - coreRadius * 0.3, centerY - coreRadius * 0.3, 0,
      centerX, centerY, coreRadius * 0.6
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    shineGradient.addColorStop(1, 'transparent');

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, coreRadius * 0.6, 0, Math.PI * 2);
    this.ctx.fillStyle = shineGradient;
    this.ctx.fill();
  }

  /**
   * PULSE - Expanding ripples with center beacon
   */
  drawPulse() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const maxRadius = Math.min(this.width, this.height) * 0.48;

    // Average amplitude
    let avg = 0;
    for (let i = 0; i < this.dataArray.length; i++) avg += this.dataArray[i];
    avg = avg / this.dataArray.length / 255;

    // Ripples
    const rippleCount = 6;
    for (let i = 0; i < rippleCount; i++) {
      const progress = ((this.time * 0.4 + i / rippleCount) % 1);
      const radius = progress * maxRadius;
      const alpha = (1 - progress) * (0.6 + avg * 0.4);
      const lineWidth = 3 + (1 - progress) * 4;

      // Ripple glow
      this.ctx.shadowColor = this.options.primaryColor;
      this.ctx.shadowBlur = 15;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      // Gradient stroke effect
      const rippleGradient = this.ctx.createRadialGradient(
        centerX, centerY, radius - lineWidth,
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

    // Center pulse beacon
    const pulseRadius = 25 + avg * 40;

    // ULTRA bright outer glow
    this.ctx.shadowColor = '#ffffff';
    this.ctx.shadowBlur = 80;

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

    // Particle sparks
    const sparkCount = 12;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + this.time;
      const sparkProgress = ((this.time * 2 + i * 0.3) % 1);
      const sparkRadius = pulseRadius * 0.5 + sparkProgress * maxRadius * 0.4;
      const sparkAlpha = (1 - sparkProgress) * avg;

      const sparkX = centerX + Math.cos(angle) * sparkRadius;
      const sparkY = centerY + Math.sin(angle) * sparkRadius;

      this.ctx.beginPath();
      this.ctx.arc(sparkX, sparkY, 2 + avg * 3, 0, Math.PI * 2);
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
