// ══════════════════════════════════════
//  QUANTUM AR — ar-engine.js
//  Shared Three.js + Camera setup
// ══════════════════════════════════════

class AREngine {
  /**
   * @param {Object} config
   * @param {string} config.canvasSelector  – CSS selector for <canvas>
   * @param {string} config.videoSelector   – CSS selector for <video>
   */
  constructor({ canvasSelector, videoSelector }) {
    this.canvas = document.querySelector(canvasSelector);
    this.video = document.querySelector(videoSelector);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.running = false;
    this.animationId = null;
    this.updateCallbacks = [];
    this.clock = { time: 0, delta: 0.016 };
    this.hasCamera = false;
  }

  // ── Initialise Three.js ──
  initScene() {
    this.scene = new THREE.Scene();

    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 4, 5);
    this.scene.add(dir);

    const cyan = new THREE.PointLight(0x00d9ff, 1.2, 20);
    cyan.position.set(-3, 2, 4);
    this.scene.add(cyan);

    const purple = new THREE.PointLight(0x9d00ff, 0.8, 20);
    purple.position.set(3, -2, 3);
    this.scene.add(purple);

    // Resize
    this._onResize = () => this._handleResize();
    window.addEventListener('resize', this._onResize);

    return this;
  }

  _handleResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── Start device camera ──
  async startCamera() {
    if (!this.video) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      this.video.srcObject = stream;
      this.video.style.display = 'block';
      this.hasCamera = true;
      return true;
    } catch (err) {
      console.warn('Camera unavailable:', err);
      this.video.style.display = 'none';

      // Fallback dark background
      const parent = this.canvas.parentElement;
      parent.style.background = 'linear-gradient(135deg, #060e1a 0%, #0a1929 40%, #10203a 70%, #060e1a 100%)';

      this.hasCamera = false;
      return false;
    }
  }

  // ── Stop camera ──
  stopCamera() {
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
  }

  // ── Register per-frame update ──
  onUpdate(fn) {
    this.updateCallbacks.push(fn);
    return this;
  }

  // ── Animation loop ──
  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.animationId = requestAnimationFrame(loop);
      this.clock.time += this.clock.delta;
      this.updateCallbacks.forEach(fn => fn(this.clock));
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    this.running = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  // ── Cleanup ──
  destroy() {
    this.stop();
    this.stopCamera();
    window.removeEventListener('resize', this._onResize);

    // Dispose Three.js objects
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    if (this.renderer) this.renderer.dispose();
  }

  // ── Utility: create glowing material ──
  static createGlowMaterial(color, opts = {}) {
    return new THREE.MeshPhysicalMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: opts.emissiveIntensity || 0.4,
      metalness: opts.metalness || 0.2,
      roughness: opts.roughness || 0.3,
      transparent: true,
      opacity: opts.opacity || 0.9,
      clearcoat: 0.5,
      ...opts
    });
  }

  // ── Utility: hex string to THREE.Color ──
  static hexToColor(hex) {
    return new THREE.Color(hex);
  }
}
