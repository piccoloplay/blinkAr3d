// ══════════════════════════════════════
//  QUANTUM AR — entanglement-level.js
//  Two entangled particles with correlation
// ══════════════════════════════════════

import * as THREE from 'three';
import { AREngine } from './ar-engine.js';

export class EntanglementLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.root = engine.getAnchorGroup();
    this.config = arData;

    this.distance = arData.controls[0].default;
    this.measureAngle = 0;
    this.measured = false;
    this.spinA = null;
    this.spinB = null;
    this.measurements = [];
    this.linkParticles = [];

    this.build();
  }

  build() {
    // ── Particle A (left, cyan) ──
    const geoA = new THREE.SphereGeometry(0.08, 16, 16);
    const matA = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.8 });
    this.particleA = new THREE.Mesh(geoA, matA);
    this.particleA.position.set(-this.distance / 2, 0.15, 0.1);
    this.root.add(this.particleA);

    // Ring around A
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.006, 8, 32),
      AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.5, opacity: 0.5 })
    );
    this.particleA.add(ringA);

    // ── Particle B (right, purple) ──
    const geoB = new THREE.SphereGeometry(0.08, 16, 16);
    const matB = AREngine.createGlowMaterial(0x9d00ff, { emissiveIntensity: 0.8 });
    this.particleB = new THREE.Mesh(geoB, matB);
    this.particleB.position.set(this.distance / 2, 0.15, 0.1);
    this.root.add(this.particleB);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.006, 8, 32),
      AREngine.createGlowMaterial(0x9d00ff, { emissiveIntensity: 0.5, opacity: 0.5 })
    );
    this.particleB.add(ringB);

    // ── Entanglement link (wavy line between them) ──
    this._buildLink();

    // ── Spin arrows (hidden until measurement) ──
    this.arrowA = this._createArrow(0x00ff88);
    this.arrowA.visible = false;
    this.particleA.add(this.arrowA);

    this.arrowB = this._createArrow(0xff3366);
    this.arrowB.visible = false;
    this.particleB.add(this.arrowB);

    // ── Labels ──
    this.labelA = this._createLabel('A');
    this.labelA.position.set(0, -0.18, 0);
    this.particleA.add(this.labelA);

    this.labelB = this._createLabel('B');
    this.labelB.position.set(0, -0.18, 0);
    this.particleB.add(this.labelB);

    this.engine.onUpdate((clock) => this.update(clock));
  }

  _buildLink() {
    // Simple line between particles
    const mat = new THREE.LineBasicMaterial({
      color: 0x00d9ff, transparent: true, opacity: 0.3
    });
    const points = [];
    for (let i = 0; i <= 20; i++) {
      points.push(new THREE.Vector3(0, 0, 0));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    this.link = new THREE.Line(geo, mat);
    this.link.position.set(0, 0.15, 0.1);
    this.root.add(this.link);
  }

  _updateLink(time) {
    const positions = this.link.geometry.attributes.position;
    const halfDist = this.distance / 2;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = -halfDist + t * this.distance;
      const y = Math.sin(t * Math.PI * 4 + time * 3) * 0.03;
      const z = Math.cos(t * Math.PI * 3 + time * 2) * 0.02;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
    this.link.material.opacity = this.measured ? 0.08 : 0.3;
  }

  _createArrow(color) {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.15, 6),
      AREngine.createGlowMaterial(color, { emissiveIntensity: 1 })
    );
    shaft.position.y = 0.075;
    group.add(shaft);

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.04, 6),
      AREngine.createGlowMaterial(color, { emissiveIntensity: 1 })
    );
    head.position.y = 0.17;
    group.add(head);
    return group;
  }

  _createLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,217,255,0.9)';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 32, 24);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    return new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.04), mat);
  }

  measure() {
    // Quantum measurement: random spin for A, opposite for B
    const angleRad = this.measureAngle * Math.PI / 180;
    this.spinA = Math.random() > 0.5 ? 1 : -1;

    // Quantum correlation: cos²(angle/2) probability of same result
    const probSame = Math.cos(angleRad / 2) ** 2;
    this.spinB = Math.random() < probSame ? -this.spinA : this.spinA;

    this.measured = true;

    // Show arrows
    this.arrowA.visible = true;
    this.arrowA.rotation.z = this.spinA > 0 ? 0 : Math.PI;
    this.arrowB.visible = true;
    this.arrowB.rotation.z = this.spinB > 0 ? 0 : Math.PI;

    this.measurements.push({
      angle: this.measureAngle,
      spinA: this.spinA,
      spinB: this.spinB,
      correlated: this.spinA !== this.spinB
    });

    // Flash particles
    this.particleA.material.emissiveIntensity = 1.5;
    this.particleB.material.emissiveIntensity = 1.5;
    setTimeout(() => {
      this.particleA.material.emissiveIntensity = 0.8;
      this.particleB.material.emissiveIntensity = 0.8;
    }, 300);

    return {
      spinA: this.spinA > 0 ? '↑' : '↓',
      spinB: this.spinB > 0 ? '↑' : '↓',
      correlated: this.spinA !== this.spinB,
      total: this.measurements.length,
      correlationRate: this.measurements.filter(m => m.correlated).length / this.measurements.length
    };
  }

  reset() {
    this.measured = false;
    this.arrowA.visible = false;
    this.arrowB.visible = false;
  }

  update(clock) {
    const t = clock.time;

    // Float particles
    this.particleA.position.x = -this.distance / 2;
    this.particleB.position.x = this.distance / 2;
    this.particleA.position.y = 0.15 + Math.sin(t * 1.2) * 0.02;
    this.particleB.position.y = 0.15 + Math.sin(t * 1.2 + Math.PI) * 0.02;

    // Pulse rings
    this.particleA.children[0].rotation.x = t * 0.5;
    this.particleA.children[0].rotation.y = t * 0.3;
    this.particleB.children[0].rotation.x = t * 0.5;
    this.particleB.children[0].rotation.y = -t * 0.3;

    // Update link wave
    this._updateLink(t);
  }

  setDistance(val) { this.distance = val; this.reset(); }
  setMeasureAngle(val) { this.measureAngle = val; }

  destroy() {}
}
