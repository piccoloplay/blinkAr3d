// ══════════════════════════════════════
//  QUANTUM AR — heisenberg-level.js
//  Uncertainty principle visualization
// ══════════════════════════════════════

import * as THREE from 'three';
import { AREngine } from './ar-engine.js';

export class HeisenbergLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.root = engine.getAnchorGroup();
    this.config = arData;

    this.deltaX = arData.controls[0].default; // position uncertainty
    this.deltaP = this._computeDeltaP(this.deltaX); // momentum uncertainty (inverse)
    this.measurements = [];
    this.measured = false;

    this.build();
  }

  _computeDeltaP(dx) {
    // ΔxΔp ≥ ℏ/2 → Δp = (ℏ/2) / Δx, scaled for visualization
    const hbar = 0.5;
    return hbar / dx;
  }

  build() {
    // ── Position uncertainty cloud (cyan ring/sphere) ──
    this.posCloud = new THREE.Mesh(
      new THREE.SphereGeometry(this.deltaX * 0.3, 32, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x00d9ff, transparent: true, opacity: 0.12,
        metalness: 0, roughness: 1
      })
    );
    this.posCloud.position.set(0, 0.15, 0.1);
    this.root.add(this.posCloud);

    // Position ring
    this.posRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.deltaX * 0.3, 0.005, 8, 64),
      AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.6, opacity: 0.5 })
    );
    this.posCloud.add(this.posRing);

    // ── Particle (dot inside cloud) ──
    this.particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      AREngine.createGlowMaterial(0xffe066, { emissiveIntensity: 1 })
    );
    this.posCloud.add(this.particle);

    // ── Momentum arrows (showing velocity uncertainty) ──
    this.momentumGroup = new THREE.Group();
    this.momentumGroup.position.set(0, 0.15, 0.1);
    this.root.add(this.momentumGroup);
    this._buildMomentumArrows();

    // ── Labels ──
    this.labelDx = this._createLabel('Δx', 0x00d9ff);
    this.labelDx.position.set(0, -0.25, 0.1);
    this.root.add(this.labelDx);

    this.labelDp = this._createLabel('Δp', 0xff3366);
    this.labelDp.position.set(0, 0.45, 0.1);
    this.root.add(this.labelDp);

    // ── Measurement markers ──
    this.measureDots = [];

    this.engine.onUpdate((clock) => this.update(clock));
  }

  _buildMomentumArrows() {
    // Clear old
    while (this.momentumGroup.children.length) {
      const c = this.momentumGroup.children[0];
      this.momentumGroup.remove(c);
      c.geometry?.dispose(); c.material?.dispose();
    }

    const count = Math.min(12, Math.max(4, Math.round(this.deltaP * 8)));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const length = this.deltaP * 0.15;
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.01, length, 4),
        AREngine.createGlowMaterial(0xff3366, {
          emissiveIntensity: 0.8,
          opacity: 0.4 + this.deltaP * 0.1
        })
      );
      arrow.position.set(
        Math.cos(angle) * 0.15,
        Math.sin(angle) * 0.15,
        0
      );
      arrow.rotation.z = angle - Math.PI / 2;
      this.momentumGroup.add(arrow);
    }
  }

  _createLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 48, 24);
    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.04),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
  }

  measure() {
    // Sample position from gaussian with σ = deltaX
    const px = (Math.random() - 0.5) * this.deltaX * 0.6 + (Math.random() - 0.5) * this.deltaX * 0.6;
    const py = (Math.random() - 0.5) * this.deltaX * 0.6;
    // Sample momentum
    const mx = (Math.random() - 0.5) * this.deltaP * 0.4;
    const my = (Math.random() - 0.5) * this.deltaP * 0.4;

    // Place measurement dot
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 6, 6),
      AREngine.createGlowMaterial(0xffe066, { emissiveIntensity: 1, opacity: 0.6 })
    );
    dot.position.set(px, py, 0);
    this.posCloud.add(dot);
    this.measureDots.push(dot);

    // Keep max 30 dots
    if (this.measureDots.length > 30) {
      const old = this.measureDots.shift();
      this.posCloud.remove(old);
      old.geometry.dispose(); old.material.dispose();
    }

    this.measurements.push({ x: px, y: py, mx, my });

    // Flash
    this.particle.material.emissiveIntensity = 2;
    setTimeout(() => { this.particle.material.emissiveIntensity = 1; }, 150);

    return {
      position: { x: px.toFixed(3), y: py.toFixed(3) },
      momentum: { x: mx.toFixed(3), y: my.toFixed(3) },
      total: this.measurements.length,
      deltaX: this.deltaX.toFixed(2),
      deltaP: this.deltaP.toFixed(2)
    };
  }

  update(clock) {
    const t = clock.time;

    // Particle jitters based on momentum uncertainty
    this.particle.position.x = Math.sin(t * this.deltaP * 5) * this.deltaX * 0.2;
    this.particle.position.y = Math.cos(t * this.deltaP * 4.3 + 1) * this.deltaX * 0.2;
    this.particle.position.z = Math.sin(t * this.deltaP * 3.7 + 2) * 0.03;

    // Rotate momentum arrows
    this.momentumGroup.rotation.z = t * 0.3 * this.deltaP;

    // Pulse position cloud
    const pulse = 1 + Math.sin(t * 2) * 0.03;
    this.posCloud.scale.setScalar(pulse);
  }

  setDeltaX(val) {
    this.deltaX = val;
    this.deltaP = this._computeDeltaP(val);

    // Update cloud size
    this.posCloud.geometry.dispose();
    this.posCloud.geometry = new THREE.SphereGeometry(val * 0.3, 32, 32);

    this.posRing.geometry.dispose();
    this.posRing.geometry = new THREE.TorusGeometry(val * 0.3, 0.005, 8, 64);

    this._buildMomentumArrows();

    // Clear old measurements
    this.measureDots.forEach(d => {
      this.posCloud.remove(d); d.geometry.dispose(); d.material.dispose();
    });
    this.measureDots = [];
    this.measurements = [];

    return this.deltaP;
  }

  destroy() {
    this.measureDots.forEach(d => {
      this.posCloud.remove(d); d.geometry.dispose(); d.material.dispose();
    });
  }
}
