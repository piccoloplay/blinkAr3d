// ══════════════════════════════════════
//  QUANTUM AR — slit-level.js
//  Double-slit experiment simulation
//  All objects anchored to MindAR image target
// ══════════════════════════════════════

import * as THREE from 'three';
import { AREngine } from './ar-engine.js';

export class SlitLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.config = arData;
    this.root = engine.getAnchorGroup();

    this.fireRate = arData.controls[0].default;
    this.detectorOn = arData.controls[1].default || false;
    this.slitSep = arData.slit_separation;
    this.slitWidth = arData.slit_width;
    this.wavelength = arData.wavelength;
    this.screenDist = arData.screen_distance;
    this.maxParticles = arData.max_particles;

    this.particles = [];
    this.screenHits = [];
    this.spawnTimer = 0;

    this.build();
  }

  build() {
    // ── Source sphere ──
    const srcGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const srcMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.8 });
    this.source = new THREE.Mesh(srcGeo, srcMat);
    this.source.position.set(-0.9, 0.15, 0.1);
    this.root.add(this.source);

    // Source ring
    const ringGeo = new THREE.TorusGeometry(0.12, 0.008, 8, 32);
    const ringMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.6, opacity: 0.5 });
    this.source.add(new THREE.Mesh(ringGeo, ringMat));

    // ── Barrier with two slits ──
    this._buildBarrier();

    // ── Detection screen (canvas texture) ──
    this.hitCanvas = document.createElement('canvas');
    this.hitCanvas.width = 256;
    this.hitCanvas.height = 512;
    const ctx = this.hitCanvas.getContext('2d');
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, 256, 512);

    this.hitTexture = new THREE.CanvasTexture(this.hitCanvas);
    this.hitTexture.minFilter = THREE.LinearFilter;

    const screenGeo = new THREE.PlaneGeometry(0.4, 0.8);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.hitTexture, transparent: true, opacity: 0.95 });
    this.screen = new THREE.Mesh(screenGeo, screenMat);
    this.screen.position.set(0.7, 0.15, 0.1);
    this.root.add(this.screen);

    // Screen frame
    const frameGeo = new THREE.EdgesGeometry(screenGeo);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.4 });
    this.screen.add(new THREE.LineSegments(frameGeo, frameMat));

    // ── Detector indicator ──
    const detGeo = new THREE.ConeGeometry(0.04, 0.1, 6);
    const detMat = AREngine.createGlowMaterial(0xff3366, { emissiveIntensity: 0.6, opacity: 0 });
    this.detectorMesh = new THREE.Mesh(detGeo, detMat);
    this.detectorMesh.rotation.z = Math.PI / 2;
    this.detectorMesh.position.set(-0.15, 0.4, 0.1);
    this.root.add(this.detectorMesh);

    // Detector label
    const lblCanvas = document.createElement('canvas');
    lblCanvas.width = 128; lblCanvas.height = 32;
    const lctx = lblCanvas.getContext('2d');
    lctx.fillStyle = 'rgba(255,51,102,0.9)';
    lctx.font = 'bold 18px monospace';
    lctx.fillText('DETECTOR', 8, 22);
    const lblTex = new THREE.CanvasTexture(lblCanvas);
    const lblMat = new THREE.MeshBasicMaterial({ map: lblTex, transparent: true, opacity: 0 });
    this.detectorLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), lblMat);
    this.detectorLabel.position.set(-0.15, 0.5, 0.1);
    this.root.add(this.detectorLabel);

    this.engine.onUpdate((clock) => this.update(clock));
  }

  _buildBarrier() {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x2a3a4a, metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.9
    });

    const slitHalf = this.slitWidth / 2;
    const sepHalf = this.slitSep / 2;
    const totalH = 0.8;

    // Top piece
    const topH = totalH / 2 - (sepHalf + slitHalf);
    if (topH > 0) {
      const topGeo = new THREE.BoxGeometry(0.03, topH, 0.25);
      const top = new THREE.Mesh(topGeo, mat);
      top.position.y = (sepHalf + slitHalf) + topH / 2;
      group.add(top);
      const bot = top.clone();
      bot.position.y = -top.position.y;
      group.add(bot);
    }

    // Middle piece
    const midH = this.slitSep - this.slitWidth;
    if (midH > 0) {
      const midGeo = new THREE.BoxGeometry(0.03, midH, 0.25);
      const mid = new THREE.Mesh(midGeo, mat);
      group.add(mid);
    }

    // Edge glow
    group.traverse(child => {
      if (child.isMesh) {
        const eg = new THREE.EdgesGeometry(child.geometry);
        const em = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.25 });
        child.add(new THREE.LineSegments(eg, em));
      }
    });

    group.position.set(-0.15, 0.15, 0.1);
    this.barrier = group;
    this.root.add(group);
  }

  _computeHitY(passedSlit) {
    if (this.detectorOn) {
      const center = passedSlit === 'top' ? this.slitSep / 2 : -this.slitSep / 2;
      return center + (Math.random() - 0.5) * 0.2;
    }
    // Interference pattern via rejection sampling
    for (let a = 0; a < 100; a++) {
      const y = (Math.random() - 0.5) * 0.75;
      const phase = Math.PI * this.slitSep * y / (this.wavelength * this.screenDist);
      if (Math.random() < Math.cos(phase) ** 2) return y;
    }
    return (Math.random() - 0.5) * 0.75;
  }

  spawnParticle() {
    const geo = new THREE.SphereGeometry(0.015, 6, 6);
    const mat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 1.2, opacity: 0.85 });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(-0.8, 0.15 + (Math.random() - 0.5) * 0.03, 0.1);

    const slit = Math.random() > 0.5 ? 'top' : 'bottom';
    const slitY = slit === 'top' ? this.slitSep / 2 : -this.slitSep / 2;
    const finalY = this._computeHitY(slit);

    p.userData = {
      phase: 0, speed: 0.8 + Math.random() * 0.3,
      slitY: 0.15 + slitY, finalY: 0.15 + finalY, alive: true
    };

    this.root.add(p);
    this.particles.push(p);
  }

  _paintHit(y) {
    const ctx = this.hitCanvas.getContext('2d');
    const canvasY = ((y - 0.15) / 0.8 + 0.5) * this.hitCanvas.height;
    const canvasX = this.hitCanvas.width / 2 + (Math.random() - 0.5) * 30;
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 217, 255, 0.7)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 217, 255, 0.08)';
    ctx.fill();
    this.hitTexture.needsUpdate = true;
    this.screenHits.push(y);
  }

  clearScreen() {
    const ctx = this.hitCanvas.getContext('2d');
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, this.hitCanvas.width, this.hitCanvas.height);
    this.hitTexture.needsUpdate = true;
    this.screenHits = [];
  }

  update(clock) {
    const dt = clock.delta;

    // Spawn
    this.spawnTimer += dt;
    const interval = 0.3 / this.fireRate;
    if (this.spawnTimer >= interval && this.screenHits.length < this.maxParticles) {
      this.spawnTimer = 0;
      this.spawnParticle();
    }

    // Detector visibility
    const detOp = this.detectorOn ? 0.8 : 0;
    this.detectorMesh.material.opacity += (detOp - this.detectorMesh.material.opacity) * 0.1;
    this.detectorLabel.material.opacity += (detOp - this.detectorLabel.material.opacity) * 0.1;

    // Move particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.userData.alive) continue;
      const ud = p.userData;

      if (ud.phase === 0) {
        p.position.x += ud.speed * dt;
        p.position.y += (ud.slitY - p.position.y) * 0.04;
        if (p.position.x >= -0.18) ud.phase = 1;
      } else if (ud.phase === 1) {
        p.position.x += ud.speed * dt;
        if (p.position.x >= -0.12) ud.phase = 2;
      } else {
        p.position.x += ud.speed * dt;
        p.position.y += (ud.finalY - p.position.y) * 0.05;
        if (p.position.x >= 0.65) {
          this._paintHit(ud.finalY);
          ud.alive = false;
          this.root.remove(p); p.geometry.dispose(); p.material.dispose();
          this.particles.splice(i, 1);
          continue;
        }
      }

      if (p.position.x > 3) {
        this.root.remove(p); p.geometry.dispose(); p.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Source pulse
    this.source.scale.setScalar(1 + Math.sin(clock.time * 3) * 0.04);
  }

  setFireRate(val) { this.fireRate = val; }

  setDetector(on) {
    if (this.detectorOn !== on) {
      this.detectorOn = on;
      this.clearScreen();
      this.particles.forEach(p => {
        this.root.remove(p); p.geometry.dispose(); p.material.dispose();
      });
      this.particles = [];
    }
  }

  destroy() {
    this.particles.forEach(p => { this.root.remove(p); p.geometry.dispose(); p.material.dispose(); });
    this.particles = [];
    this.screenHits = [];
  }
}
