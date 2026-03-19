// ══════════════════════════════════════
//  QUANTUM AR — laser-level.js
//  Photoelectric effect simulation
//  All objects anchored to MindAR image target
// ══════════════════════════════════════

import * as THREE from 'three';
import { AREngine } from './ar-engine.js';

export class LaserLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.config = arData;
    this.root = engine.getAnchorGroup();  // anchored to marker

    this.frequency = arData.controls[0].default;
    this.intensity = arData.controls[1].default;
    this.thresholdFreq = arData.threshold_frequency;
    this.photonColors = arData.photon_colors;

    this.photons = [];
    this.electrons = [];
    this.spawnTimer = 0;

    this.build();
  }

  build() {
    // ── Laser source (cylinder) ──
    const laserGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8);
    const laserMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.6 });
    this.laserSource = new THREE.Mesh(laserGeo, laserMat);
    this.laserSource.rotation.z = Math.PI / 2;
    this.laserSource.position.set(-0.8, 0.15, 0.1);
    this.root.add(this.laserSource);

    // Nozzle ring
    const nozzleGeo = new THREE.TorusGeometry(0.07, 0.012, 8, 16);
    const nozzleMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.8 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.rotation.y = Math.PI / 2;
    nozzle.position.set(0.2, 0, 0);
    this.laserSource.add(nozzle);

    // ── Metal plate (box) ──
    const plateGeo = new THREE.BoxGeometry(0.06, 0.6, 0.5);
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0x8899aa, metalness: 0.9, roughness: 0.2, clearcoat: 1
    });
    this.metalPlate = new THREE.Mesh(plateGeo, plateMat);
    this.metalPlate.position.set(0.6, 0.15, 0.1);
    this.root.add(this.metalPlate);

    // Plate edges
    const edgeGeo = new THREE.EdgesGeometry(plateGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.3 });
    this.metalPlate.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // ── Beam guide ──
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.12 });
    const beamGeo = new THREE.BoxGeometry(1.2, 0.008, 0.008);
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.position.set(-0.1, 0.15, 0.1);
    this.root.add(this.beam);

    // ── Electron collector arc ──
    const arcGeo = new THREE.TorusGeometry(0.35, 0.01, 8, 32, Math.PI);
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x9d00ff, transparent: true, opacity: 0.3 });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.rotation.z = -Math.PI / 2;
    arc.position.set(0.9, 0.15, 0.1);
    this.root.add(arc);

    // Register update
    this.engine.onUpdate((clock) => this.update(clock));
  }

  getPhotonColor() {
    const keys = Object.keys(this.photonColors).map(Number).sort((a, b) => a - b);
    let closest = keys[0];
    for (const k of keys) {
      if (Math.abs(k - this.frequency) < Math.abs(closest - this.frequency)) closest = k;
    }
    return this.photonColors[String(closest)];
  }

  spawnPhoton() {
    const color = this.getPhotonColor();
    const geo = new THREE.SphereGeometry(0.02, 8, 8);
    const mat = AREngine.createGlowMaterial(
      AREngine.hexToColor(color),
      { emissiveIntensity: 1.0, opacity: 0.9 }
    );
    const photon = new THREE.Mesh(geo, mat);
    photon.position.set(
      -0.6,
      0.15 + (Math.random() - 0.5) * 0.04,
      0.1 + (Math.random() - 0.5) * 0.04
    );
    photon.userData = { speed: 1.2 + Math.random() * 0.5, alive: true };
    this.root.add(photon);
    this.photons.push(photon);
  }

  spawnElectron(y, z) {
    const geo = new THREE.SphereGeometry(0.015, 6, 6);
    const mat = AREngine.createGlowMaterial(0x00ff88, { emissiveIntensity: 1.2, opacity: 0.85 });
    const electron = new THREE.Mesh(geo, mat);
    electron.position.set(0.65, y, z);
    electron.userData = {
      vx: 0.6 + Math.random() * 0.8,
      vy: (Math.random() - 0.5) * 0.6,
      vz: (Math.random() - 0.5) * 0.3,
      life: 1.2, age: 0
    };
    this.root.add(electron);
    this.electrons.push(electron);
  }

  update(clock) {
    const dt = clock.delta;

    // Beam color
    const beamColor = AREngine.hexToColor(this.getPhotonColor());
    this.beamMat.color = beamColor;
    this.beamMat.opacity = 0.08 + (this.intensity / 20) * 0.12;

    // Spawn photons
    this.spawnTimer += dt;
    const interval = 0.15 / (this.intensity * 0.3);
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;
      this.spawnPhoton();
    }

    // Move photons
    for (let i = this.photons.length - 1; i >= 0; i--) {
      const p = this.photons[i];
      if (!p.userData.alive) continue;
      p.position.x += p.userData.speed * dt;

      if (p.position.x >= 0.55) {
        p.userData.alive = false;
        this.root.remove(p);
        p.geometry.dispose(); p.material.dispose();
        this.photons.splice(i, 1);

        if (this.frequency >= this.thresholdFreq) {
          this.spawnElectron(p.position.y, p.position.z);
        }

        // Flash plate
        this.metalPlate.material.emissive = beamColor;
        this.metalPlate.material.emissiveIntensity = 0.5;
        setTimeout(() => {
          if (this.metalPlate) this.metalPlate.material.emissiveIntensity = 0;
        }, 80);
        continue;
      }

      if (p.position.x > 3) {
        this.root.remove(p);
        p.geometry.dispose(); p.material.dispose();
        this.photons.splice(i, 1);
      }
    }

    // Move electrons
    for (let i = this.electrons.length - 1; i >= 0; i--) {
      const e = this.electrons[i];
      e.userData.age += dt;
      e.position.x += e.userData.vx * dt;
      e.position.y += e.userData.vy * dt;
      e.position.z += e.userData.vz * dt;
      e.material.opacity = Math.max(0, 0.85 * (1 - e.userData.age / e.userData.life));
      if (e.userData.age >= e.userData.life) {
        this.root.remove(e);
        e.geometry.dispose(); e.material.dispose();
        this.electrons.splice(i, 1);
      }
    }

    // Gentle float
    this.laserSource.position.y = 0.15 + Math.sin(clock.time * 0.8) * 0.01;
  }

  setFrequency(val) { this.frequency = val; }
  setIntensity(val) { this.intensity = val; }

  destroy() {
    [...this.photons, ...this.electrons].forEach(o => {
      this.root.remove(o); o.geometry.dispose(); o.material.dispose();
    });
    this.photons = [];
    this.electrons = [];
  }
}
