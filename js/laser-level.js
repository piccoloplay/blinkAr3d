// ══════════════════════════════════════
//  QUANTUM AR — laser-level.js
//  Photoelectric effect simulation
//  Uses primitive geometries (swap with GLB later)
// ══════════════════════════════════════

class LaserLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.config = arData;
    this.scene = engine.scene;

    // State
    this.frequency = arData.controls[0].default;   // THz
    this.intensity = arData.controls[1].default;    // photon count
    this.thresholdFreq = arData.threshold_frequency;
    this.photonColors = arData.photon_colors;

    // Object pools
    this.photons = [];
    this.electrons = [];
    this.spawnTimer = 0;

    // Scene objects (primitives — replace with GLB)
    this.laserSource = null;
    this.metalPlate = null;
    this.infoDisplay = null;

    this.build();
  }

  build() {
    // ── Laser source (cylinder) ──
    const laserGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8);
    const laserMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.6 });
    this.laserSource = new THREE.Mesh(laserGeo, laserMat);
    this.laserSource.rotation.z = Math.PI / 2;
    this.laserSource.position.set(-3, 0, 0);
    this.scene.add(this.laserSource);

    // Nozzle ring
    const nozzleGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16);
    const nozzleMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.8 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.rotation.y = Math.PI / 2;
    nozzle.position.set(0.45, 0, 0);
    this.laserSource.add(nozzle);

    // ── Metal plate (box) ──
    const plateGeo = new THREE.BoxGeometry(0.15, 2, 1.5);
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0x8899aa,
      metalness: 0.9,
      roughness: 0.2,
      clearcoat: 1
    });
    this.metalPlate = new THREE.Mesh(plateGeo, plateMat);
    this.metalPlate.position.set(2, 0, 0);
    this.scene.add(this.metalPlate);

    // Plate edge glow
    const edgeGeo = new THREE.EdgesGeometry(plateGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.3 });
    this.metalPlate.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // ── Beam line (thin box, always visible) ──
    this.beamGeo = new THREE.BoxGeometry(4.2, 0.02, 0.02);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.15
    });
    this.beam = new THREE.Mesh(this.beamGeo, this.beamMat);
    this.beam.position.set(-0.4, 0, 0);
    this.scene.add(this.beam);

    // ── Electron collector (wireframe arc) ──
    const arcGeo = new THREE.TorusGeometry(1.2, 0.03, 8, 32, Math.PI);
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x9d00ff, transparent: true, opacity: 0.3 });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.rotation.z = -Math.PI / 2;
    arc.position.set(3.2, 0, 0);
    this.scene.add(arc);

    // Register update
    this.engine.onUpdate((clock) => this.update(clock));
  }

  // ── Get photon color from frequency ──
  getPhotonColor() {
    const keys = Object.keys(this.photonColors).map(Number).sort((a, b) => a - b);
    let closest = keys[0];
    for (const k of keys) {
      if (Math.abs(k - this.frequency) < Math.abs(closest - this.frequency)) closest = k;
    }
    return this.photonColors[String(closest)];
  }

  // ── Spawn a photon ──
  spawnPhoton() {
    const color = this.getPhotonColor();
    const geo = new THREE.SphereGeometry(0.06, 8, 8);
    const mat = AREngine.createGlowMaterial(
      AREngine.hexToColor(color),
      { emissiveIntensity: 1.0, opacity: 0.9 }
    );
    const photon = new THREE.Mesh(geo, mat);

    // Start from laser nozzle with slight random spread
    photon.position.set(
      -2.4,
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.15
    );

    photon.userData = {
      speed: 3 + Math.random() * 1.5,
      alive: true
    };

    this.scene.add(photon);
    this.photons.push(photon);
  }

  // ── Spawn electron (emitted from plate) ──
  spawnElectron(y, z) {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = AREngine.createGlowMaterial(0x00ff88, { emissiveIntensity: 1.2, opacity: 0.85 });
    const electron = new THREE.Mesh(geo, mat);

    electron.position.set(2.1, y, z);
    electron.userData = {
      vx: 1.5 + Math.random() * 2,
      vy: (Math.random() - 0.5) * 2,
      vz: (Math.random() - 0.5) * 1,
      life: 1.5,
      age: 0
    };

    this.scene.add(electron);
    this.electrons.push(electron);
  }

  // ── Per-frame update ──
  update(clock) {
    const dt = clock.delta;

    // Update beam color
    const beamColor = AREngine.hexToColor(this.getPhotonColor());
    this.beamMat.color = beamColor;
    this.beamMat.opacity = 0.1 + (this.intensity / 20) * 0.15;

    // Spawn photons based on intensity
    this.spawnTimer += dt;
    const spawnInterval = 0.15 / (this.intensity * 0.3);
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnPhoton();
    }

    // Move photons
    for (let i = this.photons.length - 1; i >= 0; i--) {
      const p = this.photons[i];
      if (!p.userData.alive) continue;

      p.position.x += p.userData.speed * dt;

      // Hit metal plate
      if (p.position.x >= 1.9) {
        p.userData.alive = false;
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.photons.splice(i, 1);

        // Emit electron only if frequency >= threshold
        if (this.frequency >= this.thresholdFreq) {
          this.spawnElectron(p.position.y, p.position.z);
        }

        // Flash plate
        this.metalPlate.material.emissive = beamColor;
        this.metalPlate.material.emissiveIntensity = 0.5;
        setTimeout(() => {
          if (this.metalPlate) this.metalPlate.material.emissiveIntensity = 0;
        }, 80);
      }

      // Cleanup far away
      if (p.position.x > 10) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
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

      // Fade out
      e.material.opacity = Math.max(0, 0.85 * (1 - e.userData.age / e.userData.life));

      if (e.userData.age >= e.userData.life) {
        this.scene.remove(e);
        e.geometry.dispose();
        e.material.dispose();
        this.electrons.splice(i, 1);
      }
    }

    // Gentle laser source float
    this.laserSource.position.y = Math.sin(clock.time * 0.8) * 0.05;
  }

  // ── Set frequency from slider ──
  setFrequency(val) {
    this.frequency = val;
  }

  // ── Set intensity from slider ──
  setIntensity(val) {
    this.intensity = val;
  }

  // ── Cleanup ──
  destroy() {
    this.photons.forEach(p => { this.scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
    this.electrons.forEach(e => { this.scene.remove(e); e.geometry.dispose(); e.material.dispose(); });
    this.photons = [];
    this.electrons = [];
  }
}
