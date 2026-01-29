/**
 * VocalIA Card Tilt - Mouse-tracking 3D Effect
 * Session 214: Liquid Glass Implementation
 *
 * Sources:
 * - GitHub alexanderuk82/3d-card
 * - CodePen Glassmorphism 3D Tilt
 * - Apple Liquid Glass principles
 *
 * Usage:
 * <div data-tilt data-tilt-max="15" data-tilt-speed="400" data-tilt-perspective="1200">
 *   <div class="tilt-inner">Content</div>
 *   <div class="tilt-glare"></div>
 * </div>
 */

(function() {
  'use strict';

  // Default configuration
  const defaults = {
    max: 15,           // Maximum tilt angle (degrees)
    perspective: 1200, // Perspective distance (px)
    speed: 400,        // Transition speed (ms)
    scale: 1.02,       // Scale on hover
    glare: true,       // Enable glare effect
    glareMax: 0.25,    // Maximum glare opacity
    reset: true,       // Reset on mouse leave
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)'
  };

  /**
   * Initialize tilt effect on element
   */
  function initTilt(element) {
    // Parse options from data attributes
    const options = {
      max: parseFloat(element.dataset.tiltMax) || defaults.max,
      perspective: parseFloat(element.dataset.tiltPerspective) || defaults.perspective,
      speed: parseFloat(element.dataset.tiltSpeed) || defaults.speed,
      scale: parseFloat(element.dataset.tiltScale) || defaults.scale,
      glare: element.dataset.tiltGlare !== 'false',
      reset: element.dataset.tiltReset !== 'false'
    };

    // Store original transform
    const originalTransform = element.style.transform || '';

    // Set up initial styles
    element.style.transformStyle = 'preserve-3d';
    element.style.transition = `transform ${options.speed}ms ${defaults.easing}`;
    element.style.willChange = 'transform';

    // Find or create glare element
    let glareEl = element.querySelector('.tilt-glare');
    if (options.glare && !glareEl) {
      glareEl = document.createElement('div');
      glareEl.className = 'tilt-glare';
      glareEl.style.cssText = `
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.4) 0%,
          rgba(255, 255, 255, 0.1) 40%,
          transparent 60%
        );
        z-index: 10;
      `;
      element.appendChild(glareEl);
    }

    // Mouse move handler
    function onMouseMove(e) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate mouse position relative to center (-1 to 1)
      const mouseX = (e.clientX - centerX) / (rect.width / 2);
      const mouseY = (e.clientY - centerY) / (rect.height / 2);

      // Calculate rotation (inverted for natural feel)
      const rotateY = mouseX * options.max;
      const rotateX = -mouseY * options.max;

      // Apply transform
      element.style.transform = `
        perspective(${options.perspective}px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        scale3d(${options.scale}, ${options.scale}, ${options.scale})
      `;

      // Update glare position
      if (glareEl && options.glare) {
        const glareX = (mouseX + 1) / 2 * 100;
        const glareY = (mouseY + 1) / 2 * 100;
        const glareOpacity = Math.max(Math.abs(mouseX), Math.abs(mouseY)) * defaults.glareMax;

        glareEl.style.background = `
          radial-gradient(
            circle at ${glareX}% ${glareY}%,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(255, 255, 255, 0.1) 30%,
            transparent 60%
          )
        `;
        glareEl.style.opacity = glareOpacity;
      }

      // Update shadow dynamically
      const shadowX = -rotateY * 1.5;
      const shadowY = rotateX * 1.5 + 20;
      element.style.boxShadow = `
        ${shadowX}px ${shadowY}px 50px rgba(0, 0, 0, 0.35),
        ${shadowX * 0.5}px ${shadowY * 0.5}px 20px rgba(0, 0, 0, 0.25),
        0 0 40px rgba(94, 106, 210, 0.1)
      `;
    }

    // Mouse enter handler
    function onMouseEnter() {
      element.style.transition = `transform ${options.speed}ms ${defaults.easing}`;
    }

    // Mouse leave handler
    function onMouseLeave() {
      if (options.reset) {
        element.style.transform = originalTransform || `
          perspective(${options.perspective}px)
          rotateX(0deg)
          rotateY(0deg)
          scale3d(1, 1, 1)
        `;
        element.style.boxShadow = '';

        if (glareEl) {
          glareEl.style.opacity = '0';
        }
      }
    }

    // Attach event listeners
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseenter', onMouseEnter);
    element.addEventListener('mouseleave', onMouseLeave);

    // Store cleanup function
    element._tiltCleanup = () => {
      element.removeEventListener('mousemove', onMouseMove);
      element.removeEventListener('mouseenter', onMouseEnter);
      element.removeEventListener('mouseleave', onMouseLeave);
    };
  }

  /**
   * Initialize all tilt elements
   */
  function init() {
    const elements = document.querySelectorAll('[data-tilt]');
    elements.forEach(initTilt);
  }

  /**
   * Destroy tilt effect on element
   */
  function destroy(element) {
    if (element._tiltCleanup) {
      element._tiltCleanup();
      delete element._tiltCleanup;
    }
  }

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Initialize on DOM ready (skip if reduced motion)
  if (!prefersReducedMotion) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    // Reinitialize on dynamic content (MutationObserver)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute('data-tilt')) {
              initTilt(node);
            }
            const tiltElements = node.querySelectorAll && node.querySelectorAll('[data-tilt]');
            if (tiltElements) {
              tiltElements.forEach(initTilt);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose API
  window.VocalIATilt = {
    init,
    initTilt,
    destroy
  };
})();
