// ══════════════════════════════════════
//  QUANTUM AR — ar-engine.js
//  MindAR Image Tracking + Three.js
//  Marker-based: anchors 3D scene to tracked image
// ══════════════════════════════════════

import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

export class AREngine {
  /**
   * @param {Object} config
   * @param {string} config.container       – CSS selector for the AR container div
   * @param {string} config.targetSrc       – path to compiled .mind file
   */
  constructor({ container, targetSrc }) {
    this.containerEl = document.querySelector(container);
    this.targetSrc = targetSrc;
    this.mindar = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.anchor = null;
    this.running = false;
    this.updateCallbacks = [];
    this.clock = { time: 0, delta: 0.016 };
    this._lastFrame = 0;
  }

  // ── Initialise MindAR + Three.js ──
  init() {
    // Ensure container has required styles for MindAR
    this.containerEl.style.position = 'relative';
    this.containerEl.style.overflow = 'hidden';

    this.mindar = new MindARThree({
      container: this.containerEl,
      imageTargetSrc: this.targetSrc,
      filterMinCF: 0.001,
      filterBeta: 100,
      missTolerance: 5,
      warmupTolerance: 5,
    });

    this.renderer = this.mindar.renderer;
    this.scene = this.mindar.scene;
    this.camera = this.mindar.camera;

    // Ensure Three.js canvas is transparent so camera video shows behind it
    this.renderer.setClearColor(0x000000, 0);
    // Make sure the canvas created by MindAR doesn't block the video
    const canvas = this.renderer.domElement;
    if (canvas) {
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.zIndex = '2';
    }
    // Ensure the video element (created by MindAR) is visible beneath
    const video = this.containerEl.querySelector('video');
    if (video) {
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.zIndex = '1';
    }

    // Anchor for target index 0 (blink.jpeg)
    this.anchor = this.mindar.addAnchor(0);

    // Global lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 4, 3);
    this.scene.add(dir);

    const cyan = new THREE.PointLight(0x00d9ff, 1.0, 15);
    cyan.position.set(-2, 1, 3);
    this.scene.add(cyan);

    const purple = new THREE.PointLight(0x9d00ff, 0.6, 15);
    purple.position.set(2, -1, 2);
    this.scene.add(purple);

    // Track events
    this.anchor.onTargetFound = () => {
      this.containerEl?.dispatchEvent(new CustomEvent('target-found'));
    };
    this.anchor.onTargetLost = () => {
      this.containerEl?.dispatchEvent(new CustomEvent('target-lost'));
    };

    return this;
  }

  /** Returns the THREE.Group anchored to the marker image */
  getAnchorGroup() {
    return this.anchor.group;
  }

  /** Register a per-frame callback: fn({ time, delta }) */
  onUpdate(fn) {
    this.updateCallbacks.push(fn);
    return this;
  }

  /** Start tracking + render loop */
  async start() {
    if (this.running) return;
    this.running = true;
    await this.mindar.start();

    // After start, MindAR has created the video element — ensure it's visible
    this._fixVideoVisibility();

    this._lastFrame = performance.now();

    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      this.clock.delta = (now - this._lastFrame) / 1000;
      this.clock.time += this.clock.delta;
      this._lastFrame = now;
      this.updateCallbacks.forEach(fn => fn(this.clock));
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Ensure MindAR's video and canvas are properly layered */
  _fixVideoVisibility() {
    // MindAR creates: video (camera feed) + canvas (Three.js) inside container
    const video = this.containerEl.querySelector('video');
    const canvas = this.containerEl.querySelector('canvas');

    if (video) {
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.zIndex = '1';
    }

    if (canvas) {
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '2';
    }

    // Remove any background that might hide the video
    this.containerEl.style.background = 'transparent';
  }

  stop() {
    this.running = false;
    this.renderer?.setAnimationLoop(null);
    this.mindar?.stop();
  }

  destroy() {
    this.stop();
    this.scene?.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
      }
    });
    this.renderer?.dispose();
  }

  // ── Utilities ──
  static createGlowMaterial(color, opts = {}) {
    return new THREE.MeshPhysicalMaterial({
      color, emissive: color,
      emissiveIntensity: opts.emissiveIntensity || 0.4,
      metalness: opts.metalness || 0.2,
      roughness: opts.roughness || 0.3,
      transparent: true,
      opacity: opts.opacity || 0.9,
      clearcoat: 0.5,
      ...opts
    });
  }

  static hexToColor(hex) {
    return new THREE.Color(hex);
  }
}
