/**
 * VocalIA GSAP Animation System
 * SOTA Scroll-Triggered Animations for Voice AI Platform
 *
 * Features:
 * - ScrollTrigger parallax and reveal effects
 * - 3D card hover transforms
 * - Staggered grid animations
 * - Animated number counters
 * - Mouse-following effects
 * - GPU-accelerated (transform/opacity only)
 *
 * @version 1.0.0
 * @date 2026-01-29
 */

class VocalIAAnimations {
  constructor() {
    this.initialized = false;
    this.scrollTriggers = [];
    this.observers = [];
    this.rafId = null;
    this.mouse = { x: 0, y: 0 };

    // Animation config
    this.config = {
      duration: {
        fast: 0.3,
        normal: 0.6,
        slow: 1.2
      },
      ease: {
        smooth: 'power2.out',
        bounce: 'back.out(1.7)',
        elastic: 'elastic.out(1, 0.5)',
        expo: 'expo.out'
      },
      stagger: {
        fast: 0.05,
        normal: 0.1,
        slow: 0.15
      }
    };
  }

  /**
   * Initialize all animations
   */
  async init() {
    if (this.initialized) return;

    // Wait for GSAP to be available
    await this.waitForGSAP();

    // Register ScrollTrigger plugin
    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Mark body as GSAP-ready (enables CSS hiding for reveal animations)
    if (window.gsap && window.ScrollTrigger) {
      document.body.classList.add('gsap-ready');
    }

    // Initialize animation systems
    this.initHeroAnimations();
    this.initScrollReveal();
    this.init3DCards();
    this.initCounters();
    this.initParallax();
    this.initMouseFollower();
    this.initTextAnimations();
    this.initBentoGrid();

    // Handle resize
    window.addEventListener('resize', this.handleResize.bind(this));

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.disableAnimations();
    }

    this.initialized = true;
    console.log('[VocalIA] Animation system initialized');
  }

  /**
   * Wait for GSAP to load
   */
  waitForGSAP() {
    return new Promise((resolve) => {
      if (window.gsap) {
        resolve();
        return;
      }

      const check = setInterval(() => {
        if (window.gsap) {
          clearInterval(check);
          resolve();
        }
      }, 50);

      // Timeout after 5s - reveal elements as fallback
      setTimeout(() => {
        clearInterval(check);
        console.warn('[VocalIA] GSAP not loaded, using fallback animations');
        this.revealAllElements();
        resolve();
      }, 5000);
    });
  }

  /**
   * Fallback: Reveal all hidden elements when GSAP fails
   */
  revealAllElements() {
    document.querySelectorAll('[data-reveal]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelectorAll('[data-bento-item]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    console.log('[VocalIA] Fallback: All elements revealed');
  }

  /**
   * Hero Section Animations
   */
  initHeroAnimations() {
    const hero = document.querySelector('[data-animate="hero"]');
    if (!hero || !window.gsap) return;

    const tl = gsap.timeline({ defaults: { ease: this.config.ease.expo } });

    // Badge animation
    const badge = hero.querySelector('[data-animate="badge"]');
    if (badge) {
      tl.from(badge, {
        opacity: 0,
        y: 30,
        scale: 0.9,
        duration: this.config.duration.normal
      });
    }

    // Title split animation
    const title = hero.querySelector('[data-animate="title"]');
    if (title) {
      const chars = this.splitText(title);
      tl.from(chars, {
        opacity: 0,
        y: 50,
        rotateX: -90,
        stagger: 0.02,
        duration: this.config.duration.fast
      }, '-=0.3');
    }

    // Subtitle
    const subtitle = hero.querySelector('[data-animate="subtitle"]');
    if (subtitle) {
      tl.from(subtitle, {
        opacity: 0,
        y: 20,
        duration: this.config.duration.normal
      }, '-=0.4');
    }

    // CTA buttons
    const ctas = hero.querySelectorAll('[data-animate="cta"]');
    if (ctas.length) {
      tl.from(ctas, {
        opacity: 0,
        y: 30,
        scale: 0.95,
        stagger: this.config.stagger.normal,
        duration: this.config.duration.normal
      }, '-=0.3');
    }

    // Hero visual/orb
    const visual = hero.querySelector('[data-animate="visual"]');
    if (visual) {
      tl.from(visual, {
        opacity: 0,
        scale: 0.8,
        duration: this.config.duration.slow
      }, '-=0.5');
    }
  }

  /**
   * Split text into spans for character animation
   */
  splitText(element) {
    const text = element.textContent;
    element.innerHTML = '';

    const chars = [];
    text.split('').forEach(char => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.display = 'inline-block';
      element.appendChild(span);
      chars.push(span);
    });

    return chars;
  }

  /**
   * Scroll Reveal Animations
   */
  initScrollReveal() {
    if (!window.gsap || !window.ScrollTrigger) {
      // Fallback: reveal all elements immediately
      this.revealAllElements();
      return;
    }

    // Fade up elements
    document.querySelectorAll('[data-reveal="up"]').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        y: 60,
        duration: this.config.duration.normal,
        ease: this.config.ease.smooth
      });
    });

    // Fade in elements
    document.querySelectorAll('[data-reveal="fade"]').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        duration: this.config.duration.normal,
        ease: this.config.ease.smooth
      });
    });

    // Scale elements
    document.querySelectorAll('[data-reveal="scale"]').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        scale: 0.9,
        duration: this.config.duration.normal,
        ease: this.config.ease.bounce
      });
    });

    // Slide from left
    document.querySelectorAll('[data-reveal="left"]').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        x: -60,
        duration: this.config.duration.normal,
        ease: this.config.ease.smooth
      });
    });

    // Slide from right
    document.querySelectorAll('[data-reveal="right"]').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        opacity: 0,
        x: 60,
        duration: this.config.duration.normal,
        ease: this.config.ease.smooth
      });
    });
  }

  /**
   * 3D Card Hover Effects
   */
  init3DCards() {
    document.querySelectorAll('[data-card-3d]').forEach(card => {
      const intensity = parseFloat(card.dataset.card3d) || 10;
      const glare = card.querySelector('.card-glare');

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
      });

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / centerY * -intensity;
        const rotateY = (x - centerX) / centerX * intensity;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

        // Glare effect
        if (glare) {
          const glareX = (x / rect.width) * 100;
          const glareY = (y / rect.height) * 100;
          glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.5s ease-out';
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';

        if (glare) {
          glare.style.background = 'transparent';
        }
      });
    });
  }

  /**
   * Animated Number Counters
   */
  initCounters() {
    document.querySelectorAll('[data-counter]').forEach(counter => {
      const target = parseFloat(counter.dataset.counter);
      const duration = parseFloat(counter.dataset.counterDuration) || 2;
      const suffix = counter.dataset.counterSuffix || '';
      const prefix = counter.dataset.counterPrefix || '';
      const decimals = parseInt(counter.dataset.counterDecimals) || 0;

      // Set initial value
      counter.textContent = prefix + '0' + suffix;

      // Create intersection observer
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.animateCounter(counter, target, duration, prefix, suffix, decimals);
            observer.unobserve(counter);
          }
        });
      }, { threshold: 0.5 });

      observer.observe(counter);
      this.observers.push(observer);
    });
  }

  /**
   * Animate a counter element
   */
  animateCounter(element, target, duration, prefix, suffix, decimals) {
    const startTime = performance.now();
    const startValue = 0;

    const update = (currentTime) => {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (target - startValue) * easeProgress;

      element.textContent = prefix + currentValue.toFixed(decimals) + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = prefix + target.toFixed(decimals) + suffix;
      }
    };

    requestAnimationFrame(update);
  }

  /**
   * Parallax Effects
   */
  initParallax() {
    if (!window.gsap || !window.ScrollTrigger) return;

    document.querySelectorAll('[data-parallax]').forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.5;

      gsap.to(el, {
        yPercent: -100 * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });

    // Horizontal parallax
    document.querySelectorAll('[data-parallax-x]').forEach(el => {
      const speed = parseFloat(el.dataset.parallaxX) || 0.5;

      gsap.to(el, {
        xPercent: -50 * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /**
   * Mouse Follower Effect
   */
  initMouseFollower() {
    const follower = document.querySelector('[data-mouse-follower]');
    if (!follower) return;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    const speed = 0.1;

    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    const animate = () => {
      currentX += (targetX - currentX) * speed;
      currentY += (targetY - currentY) * speed;

      follower.style.transform = `translate(${currentX}px, ${currentY}px)`;

      this.rafId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Text Reveal Animations
   */
  initTextAnimations() {
    if (!window.gsap || !window.ScrollTrigger) return;

    // Line by line reveal
    document.querySelectorAll('[data-text-reveal="lines"]').forEach(el => {
      const lines = el.innerHTML.split('<br>');
      el.innerHTML = lines.map(line => `<span class="line-wrapper"><span class="line">${line}</span></span>`).join('');

      gsap.from(el.querySelectorAll('.line'), {
        scrollTrigger: {
          trigger: el,
          start: 'top 80%'
        },
        yPercent: 100,
        opacity: 0,
        stagger: 0.1,
        duration: this.config.duration.normal,
        ease: this.config.ease.expo
      });
    });

    // Word by word reveal
    document.querySelectorAll('[data-text-reveal="words"]').forEach(el => {
      const words = el.textContent.split(' ');
      el.innerHTML = words.map(word => `<span class="word">${word}</span>`).join(' ');

      gsap.from(el.querySelectorAll('.word'), {
        scrollTrigger: {
          trigger: el,
          start: 'top 80%'
        },
        opacity: 0,
        y: 20,
        stagger: 0.03,
        duration: this.config.duration.fast,
        ease: this.config.ease.smooth
      });
    });
  }

  /**
   * Bento Grid Staggered Reveal
   */
  initBentoGrid() {
    if (!window.gsap || !window.ScrollTrigger) return;

    document.querySelectorAll('[data-bento-grid]').forEach(grid => {
      const items = grid.querySelectorAll('[data-bento-item]');

      gsap.from(items, {
        scrollTrigger: {
          trigger: grid,
          start: 'top 75%'
        },
        opacity: 0,
        y: 40,
        scale: 0.95,
        stagger: {
          each: 0.08,
          from: 'start',
          grid: 'auto'
        },
        duration: this.config.duration.normal,
        ease: this.config.ease.smooth
      });
    });
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (window.ScrollTrigger) {
      ScrollTrigger.refresh();
    }
  }

  /**
   * Disable animations for reduced motion
   */
  disableAnimations() {
    if (window.gsap) {
      gsap.globalTimeline.timeScale(100);
    }

    document.documentElement.style.setProperty('--animation-duration', '0.01s');
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];

    if (window.ScrollTrigger) {
      ScrollTrigger.getAll().forEach(st => st.kill());
    }

    this.initialized = false;
  }
}

// Particle System for Hero Background
class ParticleSystem {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: null, y: null, radius: 100 };
    this.animationId = null;
    this.isVisible = true;
    this.lastFrameTime = 0;
    this.targetFPS = 30; // Throttle to 30fps for performance
    this.frameInterval = 1000 / this.targetFPS;

    this.options = {
      particleCount: options.particleCount || 25, // Reduced for performance
      color: options.color || '#5E6AD2',
      minSize: options.minSize || 1,
      maxSize: options.maxSize || 2.5,
      speed: options.speed || 0.25,
      connectDistance: options.connectDistance || 60, // Reduced connections
      mouseInteraction: options.mouseInteraction !== false
    };

    this.init();
  }

  init() {
    this.resize();
    this.createParticles();
    this.bindEvents();
    this.setupVisibilityDetection();
    this.animate();
  }

  setupVisibilityDetection() {
    // Pause when tab not visible
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible && !this.animationId) {
        this.animate();
      }
    });

    // Pause when not in viewport
    const observer = new IntersectionObserver((entries) => {
      this.isVisible = entries[0].isIntersecting;
      if (this.isVisible && !this.animationId) {
        this.animate();
      }
    }, { threshold: 0.1 });
    observer.observe(this.canvas);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  createParticles() {
    this.particles = [];

    for (let i = 0; i < this.options.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * (this.options.maxSize - this.options.minSize) + this.options.minSize,
        speedX: (Math.random() - 0.5) * this.options.speed,
        speedY: (Math.random() - 0.5) * this.options.speed,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.createParticles();
    });

    if (this.options.mouseInteraction) {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.mouse.x = null;
        this.mouse.y = null;
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, i) => {
      // Update position
      p.x += p.speedX;
      p.y += p.speedY;

      // Wrap around edges
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      // Mouse interaction - push particles away
      if (this.mouse.x !== null && this.mouse.y !== null) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.mouse.radius) {
          const force = (this.mouse.radius - dist) / this.mouse.radius;
          p.x += dx * force * 0.03;
          p.y += dy * force * 0.03;
        }
      }

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = this.hexToRgba(this.options.color, p.opacity);
      this.ctx.fill();

      // Connect particles (limit connections for performance)
      const maxConnections = 3;
      let connections = 0;
      for (let j = i + 1; j < this.particles.length && connections < maxConnections; j++) {
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy; // Avoid sqrt for performance
        const connectDistSq = this.options.connectDistance * this.options.connectDistance;

        if (distSq < connectDistSq) {
          const opacity = (1 - Math.sqrt(distSq) / this.options.connectDistance) * 0.2;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = this.hexToRgba(this.options.color, opacity);
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
          connections++;
        }
      }
    });

    // Continue animation loop with throttling
    if (this.isVisible) {
      this.animationId = requestAnimationFrame((timestamp) => this.animateThrottled(timestamp));
    } else {
      this.animationId = null;
    }
  }

  animateThrottled(timestamp) {
    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = timestamp - (elapsed % this.frameInterval);
      this.animate();
    } else if (this.isVisible) {
      this.animationId = requestAnimationFrame((ts) => this.animateThrottled(ts));
    }
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Floating Orb Animation
class FloatingOrb {
  constructor(container, options = {}) {
    this.container = container;
    this.orbs = [];
    this.options = {
      count: options.count || 3, // Reduced from 5
      colors: options.colors || ['#5E6AD2', '#6366f1', '#a5b4fc'],
      minSize: options.minSize || 80,
      maxSize: options.maxSize || 200, // Reduced from 300
      blur: options.blur || 40 // Reduced from 80 (blur is expensive)
    };

    this.init();
  }

  init() {
    for (let i = 0; i < this.options.count; i++) {
      this.createOrb(i);
    }
  }

  createOrb(index) {
    const orb = document.createElement('div');
    const size = Math.random() * (this.options.maxSize - this.options.minSize) + this.options.minSize;
    const color = this.options.colors[index % this.options.colors.length];

    orb.className = 'floating-orb';
    orb.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, ${color}, transparent 70%);
      filter: blur(${this.options.blur}px);
      opacity: 0.4;
      pointer-events: none;
      will-change: transform;
    `;

    // Random initial position
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    orb.style.left = `${x}%`;
    orb.style.top = `${y}%`;

    // Add animation with random duration
    const duration = 15 + Math.random() * 10;
    const delay = Math.random() * -20;
    orb.style.animation = `floatOrb${index % 3} ${duration}s ease-in-out ${delay}s infinite`;

    this.container.appendChild(orb);
    this.orbs.push(orb);
  }

  destroy() {
    this.orbs.forEach(orb => orb.remove());
    this.orbs = [];
  }
}

// Magnetic Button Effect
class MagneticButton {
  constructor(element, strength = 0.3) {
    this.element = element;
    this.strength = strength;
    this.bound = false;

    this.init();
  }

  init() {
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.element.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.bound = true;
  }

  handleMouseMove(e) {
    const rect = this.element.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    this.element.style.transform = `translate(${x * this.strength}px, ${y * this.strength}px)`;
  }

  handleMouseLeave() {
    this.element.style.transform = 'translate(0, 0)';
  }

  destroy() {
    if (this.bound) {
      this.element.style.transform = '';
      this.bound = false;
    }
  }
}

// Export for global use
window.VocalIAAnimations = VocalIAAnimations;
window.ParticleSystem = ParticleSystem;
window.FloatingOrb = FloatingOrb;
window.MagneticButton = MagneticButton;

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Performance: Detect preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Initialize GSAP scroll animations (meaningful for UX)
  if (!prefersReducedMotion) {
    const animations = new VocalIAAnimations();
    animations.init();
  }

  // NOTE: Particle system and floating orbs REMOVED
  // Reason: No semantic connection to Voice AI product
  // Voice AI animations should represent: sound waves, voice activity, conversations
  // Random particles/orbs are visual noise without marketing meaning

  console.log('[VocalIA] Animations initialized (Voice AI focused)');
});
