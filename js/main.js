// ══════════════════════════════════════
//  QUANTUM AR — main.js
//  Navigation, routing, shared utilities
// ══════════════════════════════════════

const App = {
  // Navbar scroll effect
  initNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.style.background = window.scrollY > 60
        ? 'rgba(10, 25, 41, 0.95)'
        : 'rgba(10, 25, 41, 0.85)';
    });
  },

  // Holographic floating particles (background effect)
  initParticles(count = 15) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.style.cssText = `
        position: fixed;
        width: 2px; height: 2px;
        background: var(--neon-cyan);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--neon-cyan);
        opacity: 0.25;
        z-index: 0;
        pointer-events: none;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: particleFloat ${10 + Math.random() * 15}s linear infinite;
        animation-delay: ${Math.random() * -20}s;
      `;
      document.body.appendChild(p);
    }

    // Inject keyframes if not present
    if (!document.getElementById('particle-keyframes')) {
      const style = document.createElement('style');
      style.id = 'particle-keyframes';
      style.textContent = `
        @keyframes particleFloat {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 0.25; }
          90%  { opacity: 0.25; }
          100% { transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}80px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  },

  // Load JSON data
  async loadJSON(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to load ${path}`);
      return await res.json();
    } catch (err) {
      console.error('JSON load error:', err);
      return null;
    }
  },

  // Smooth scroll to element
  scrollTo(selector) {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Boot
  init() {
    this.initNav();
    this.initParticles();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
