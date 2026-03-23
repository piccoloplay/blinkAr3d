// ══════════════════════════════════════
//  QUANTUM AR — tunnel-level.js
//  Quantum tunneling simulation
// ══════════════════════════════════════

import * as THREE from 'three';
import { AREngine } from './ar-engine.js';

export class TunnelLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.root = engine.getAnchorGroup();
    this.config = arData;

    this.energy = arData.controls[0].default;
    this.barrierWidth = arData.controls[1].default;
    this.barrierHeight = arData.controls[2].default;

    this.particles = [];
    this.tunneled = 0;
    this.launched = 0;
    this.spawnTimer = 0;

    this.build();
  }

  build() {
    // ── Barrier (semi-transparent wall) ──
    this._buildBarrier();

    // ── Source (left) ──
    const srcGeo = new THREE.SphereGeometry(0.07, 16, 16);
    const srcMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.7 });
    this.source = new THREE.Mesh(srcGeo, srcMat);
    this.source.position.set(-0.7, 0.15, 0.1);
    this.root.add(this.source);

    // ── Detector (right) ──
    const detGeo = new THREE.BoxGeometry(0.1, 0.3, 0.3);
    const detMat = AREngine.createGlowMaterial(0x00ff88, { emissiveIntensity: 0.3, opacity: 0.4 });
    this.detector = new THREE.Mesh(detGeo, detMat);
    this.detector.position.set(0.7, 0.15, 0.1);
    this.root.add(this.detector);

    const detEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(detGeo),
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4 })
    );
    this.detector.add(detEdge);

    // ── Probability bar (visual indicator) ──
    this.probBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x1a2a3a })
    );
    this.probBarBg.position.set(0, -0.05, 0.1);
    this.root.add(this.probBarBg);

    this.probBarFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.035),
      AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.6 })
    );
    this.probBarFill.position.set(-0.15, -0.05, 0.11);
    this.root.add(this.probBarFill);

    this.engine.onUpdate((clock) => this.update(clock));
  }

  _buildBarrier() {
    if (this.barrier) this.root.remove(this.barrier);

    const geo = new THREE.BoxGeometry(this.barrierWidth * 0.3, 0.5, 0.4);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xff3366,
      metalness: 0.3, roughness: 0.5,
      transparent: true,
      opacity: 0.4 + (this.barrierHeight / 12) * 0.4
    });
    this.barrier = new THREE.Mesh(geo, mat);
    this.barrier.position.set(0, 0.15, 0.1);
    this.root.add(this.barrier);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.5 })
    );
    this.barrier.add(edge);
  }

  _getTunnelProbability() {
    // Simplified: P ∝ exp(-2 * width * sqrt(barrierHeight - energy))
    if (this.energy >= this.barrierHeight) return 0.95; // classical pass
    const kappa = Math.sqrt(Math.max(0.1, this.barrierHeight - this.energy));
    const prob = Math.exp(-2 * this.barrierWidth * kappa * 3);
    return Math.min(0.9, Math.max(0.01, prob));
  }

  launch() {
    const geo = new THREE.SphereGeometry(0.03, 8, 8);
    const energy01 = this.energy / 10;
    const color = new THREE.Color().setHSL(0.55 - energy01 * 0.3, 1, 0.6);
    const mat = AREngine.createGlowMaterial(color, { emissiveIntensity: 1, opacity: 0.9 });
    const p = new THREE.Mesh(geo, mat);

    p.position.set(-0.6, 0.15 + (Math.random() - 0.5) * 0.05, 0.1 + (Math.random() - 0.5) * 0.05);

    const willTunnel = Math.random() < this._getTunnelProbability();

    p.userData = {
      speed: 0.5 + (this.energy / 10) * 0.8,
      phase: 'approaching', // approaching, at_barrier, tunneling, reflected, passed
      willTunnel,
      alive: true,
      waveOpacity: 1,
      barrierX: -this.barrierWidth * 0.15,
      barrierEndX: this.barrierWidth * 0.15
    };

    this.root.add(p);
    this.particles.push(p);
    this.launched++;
  }

  update(clock) {
    const dt = clock.delta;

    // Update probability bar
    const prob = this._getTunnelProbability();
    this.probBarFill.scale.x = prob;
    this.probBarFill.position.x = -0.3 * (1 - prob) / 2;

    // Source pulse
    this.source.scale.setScalar(1 + Math.sin(clock.time * 3) * 0.04);

    // Move particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.userData.alive) continue;
      const ud = p.userData;

      if (ud.phase === 'approaching') {
        p.position.x += ud.speed * dt;
        if (p.position.x >= ud.barrierX) {
          ud.phase = ud.willTunnel ? 'tunneling' : 'reflecting';
          if (ud.willTunnel) {
            // Shrink and fade while tunneling
            p.material.opacity = 0.4;
          }
        }
      } else if (ud.phase === 'tunneling') {
        p.position.x += ud.speed * dt * 0.4; // slower through barrier
        p.material.opacity = 0.3 + Math.sin(clock.time * 10) * 0.15;
        if (p.position.x >= ud.barrierEndX) {
          ud.phase = 'passed';
          p.material.opacity = 0.9;
          p.material.emissive = new THREE.Color(0x00ff88);
          this.tunneled++;
          // Flash detector
          this.detector.material.emissiveIntensity = 1;
          setTimeout(() => { this.detector.material.emissiveIntensity = 0.3; }, 200);
        }
      } else if (ud.phase === 'reflecting') {
        p.position.x -= ud.speed * dt * 0.6;
        p.material.opacity -= dt * 0.8;
        if (p.material.opacity <= 0) {
          ud.alive = false;
          this.root.remove(p); p.geometry.dispose(); p.material.dispose();
          this.particles.splice(i, 1);
        }
      } else if (ud.phase === 'passed') {
        p.position.x += ud.speed * dt;
        if (p.position.x > 1.2) {
          ud.alive = false;
          this.root.remove(p); p.geometry.dispose(); p.material.dispose();
          this.particles.splice(i, 1);
        }
      }
    }
  }

  setEnergy(val) { this.energy = val; }

  setBarrierWidth(val) {
    this.barrierWidth = val;
    this._buildBarrier();
  }

  setBarrierHeight(val) {
    this.barrierHeight = val;
    if (this.barrier) {
      this.barrier.material.opacity = 0.4 + (val / 12) * 0.4;
    }
  }

  getStats() {
    return { tunneled: this.tunneled, launched: this.launched, probability: this._getTunnelProbability() };
  }

  destroy() {
    this.particles.forEach(p => { this.root.remove(p); p.geometry.dispose(); p.material.dispose(); });
    this.particles = [];
  }
}
