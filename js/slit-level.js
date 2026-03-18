// ══════════════════════════════════════
//  QUANTUM AR — slit-level.js
//  Double-slit experiment simulation
//  Uses primitive geometries (swap with GLB later)
// ══════════════════════════════════════

class SlitLevel {
  constructor(engine, arData) {
    this.engine = engine;
    this.config = arData;
    this.scene = engine.scene;

    // State
    this.fireRate = arData.controls[0].default;
    this.detectorOn = arData.controls[1].default || false;
    this.slitWidth = arData.slit_width;
    this.slitSep = arData.slit_separation;
    this.wavelength = arData.wavelength;
    this.screenDist = arData.screen_distance;
    this.maxParticles = arData.max_particles;

    // Object pools
    this.particles = [];
    this.screenHits = [];
    this.spawnTimer = 0;

    // Scene objects
    this.barrier = null;
    this.screen = null;
    this.source = null;
    this.detectorMesh = null;
    this.hitTexture = null;
    this.hitCanvas = null;

    this.build();
  }

  build() {
    // ── Particle source (glowing sphere) ──
    const srcGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const srcMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.8 });
    this.source = new THREE.Mesh(srcGeo, srcMat);
    this.source.position.set(-3.5, 0, 0);
    this.scene.add(this.source);

    // Source ring
    const ringGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 32);
    const ringMat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 0.6, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.y = Math.PI / 2;
    this.source.add(ring);

    // ── Barrier with two slits ──
    this._buildBarrier();

    // ── Detection screen (plane with dynamic texture) ──
    this.hitCanvas = document.createElement('canvas');
    this.hitCanvas.width = 256;
    this.hitCanvas.height = 512;
    const ctx = this.hitCanvas.getContext('2d');
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, 256, 512);

    this.hitTexture = new THREE.CanvasTexture(this.hitCanvas);
    this.hitTexture.minFilter = THREE.LinearFilter;

    const screenGeo = new THREE.PlaneGeometry(1.5, 3);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.hitTexture,
      transparent: true,
      opacity: 0.95
    });
    this.screen = new THREE.Mesh(screenGeo, screenMat);
    this.screen.position.set(2.5, 0, 0);
    this.scene.add(this.screen);

    // Screen frame
    const frameGeo = new THREE.EdgesGeometry(screenGeo);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.4 });
    this.screen.add(new THREE.LineSegments(frameGeo, frameMat));

    // ── Detector indicator ──
    const detGeo = new THREE.ConeGeometry(0.12, 0.3, 6);
    const detMat = AREngine.createGlowMaterial(0xff3366, { emissiveIntensity: 0.6, opacity: 0 });
    this.detectorMesh = new THREE.Mesh(detGeo, detMat);
    this.detectorMesh.rotation.z = Math.PI / 2;
    this.detectorMesh.position.set(-0.3, 0.6, 0);
    this.scene.add(this.detectorMesh);

    // Detector label (small plane)
    const detLabelGeo = new THREE.PlaneGeometry(0.6, 0.15);
    const detLabelCanvas = document.createElement('canvas');
    detLabelCanvas.width = 128;
    detLabelCanvas.height = 32;
    const dctx = detLabelCanvas.getContext('2d');
    dctx.fillStyle = 'rgba(255,51,102,0.8)';
    dctx.font = 'bold 18px monospace';
    dctx.fillText('DETECTOR', 8, 22);
    const detLabelTex = new THREE.CanvasTexture(detLabelCanvas);
    const detLabelMat = new THREE.MeshBasicMaterial({ map: detLabelTex, transparent: true, opacity: 0 });
    this.detectorLabel = new THREE.Mesh(detLabelGeo, detLabelMat);
    this.detectorLabel.position.set(-0.3, 0.9, 0);
    this.scene.add(this.detectorLabel);

    // Register update
    this.engine.onUpdate((clock) => this.update(clock));
  }

  _buildBarrier() {
    // Barrier: three solid pieces with two gaps (slits)
    const barrierGroup = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x2a3a4a,
      metalness: 0.7,
      roughness: 0.4,
      transparent: true,
      opacity: 0.9
    });

    const slitHalf = this.slitWidth / 2;
    const sepHalf = this.slitSep / 2;

    // Top piece
    const topGeo = new THREE.BoxGeometry(0.08, 3 - (sepHalf + slitHalf), 0.8);
    const top = new THREE.Mesh(topGeo, mat);
    top.position.y = (sepHalf + slitHalf) + (3 - (sepHalf + slitHalf)) / 2;
    barrierGroup.add(top);

    // Middle piece (between slits)
    const midGeo = new THREE.BoxGeometry(0.08, sepHalf * 2 - slitHalf * 2, 0.8);
    const mid = new THREE.Mesh(midGeo, mat);
    mid.position.y = 0;
    barrierGroup.add(mid);

    // Bottom piece
    const bot = top.clone();
    bot.position.y = -top.position.y;
    barrierGroup.add(bot);

    // Edge glow for each piece
    [top, mid, bot].forEach(piece => {
      const edgeGeo = new THREE.EdgesGeometry(piece.geometry);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.25 });
      piece.add(new THREE.LineSegments(edgeGeo, edgeMat));
    });

    barrierGroup.position.set(-0.5, 0, 0);
    this.barrier = barrierGroup;
    this.scene.add(barrierGroup);
  }

  // ── Compute landing Y using interference pattern ──
  _computeHitY(passedSlit) {
    if (this.detectorOn) {
      // Detector ON → classical distribution (two bands, no interference)
      const center = passedSlit === 'top' ? this.slitSep / 2 : -this.slitSep / 2;
      return center + (Math.random() - 0.5) * 0.6;
    } else {
      // Detector OFF → interference pattern
      // Use rejection sampling from |ψ|² ∝ cos²(π·d·y / (λ·L))
      for (let attempts = 0; attempts < 100; attempts++) {
        const y = (Math.random() - 0.5) * 2.8;
        const phase = Math.PI * this.slitSep * y / (this.wavelength * this.screenDist);
        const prob = Math.cos(phase) ** 2;
        if (Math.random() < prob) return y;
      }
      return (Math.random() - 0.5) * 2.8;
    }
  }

  // ── Spawn particle ──
  spawnParticle() {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = AREngine.createGlowMaterial(0x00d9ff, { emissiveIntensity: 1.2, opacity: 0.85 });
    const particle = new THREE.Mesh(geo, mat);

    particle.position.set(-3.2, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);

    // Decide which slit it will pass through
    const passedSlit = Math.random() > 0.5 ? 'top' : 'bottom';
    const slitY = passedSlit === 'top' ? this.slitSep / 2 : -this.slitSep / 2;

    // Pre-compute final Y on screen
    const finalY = this._computeHitY(passedSlit);

    particle.userData = {
      phase: 0,          // 0 = approaching barrier, 1 = through slit, 2 = approaching screen
      speed: 2.5 + Math.random(),
      slitY: slitY,
      slitZ: (Math.random() - 0.5) * 0.3,
      finalY: finalY,
      alive: true
    };

    this.scene.add(particle);
    this.particles.push(particle);
  }

  // ── Paint hit on screen texture ──
  _paintHit(y) {
    const ctx = this.hitCanvas.getContext('2d');
    // Map y from [-1.5, 1.5] to canvas coords
    const canvasY = ((y / 3) + 0.5) * this.hitCanvas.height;
    const canvasX = this.hitCanvas.width / 2 + (Math.random() - 0.5) * 30;

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 217, 255, 0.7)';
    ctx.fill();

    // Glow
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 217, 255, 0.08)';
    ctx.fill();

    this.hitTexture.needsUpdate = true;
    this.screenHits.push(y);
  }

  // ── Clear screen ──
  clearScreen() {
    const ctx = this.hitCanvas.getContext('2d');
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, this.hitCanvas.width, this.hitCanvas.height);
    this.hitTexture.needsUpdate = true;
    this.screenHits = [];
  }

  // ── Per-frame update ──
  update(clock) {
    const dt = clock.delta;

    // Spawn particles
    this.spawnTimer += dt;
    const interval = 0.3 / this.fireRate;
    if (this.spawnTimer >= interval && this.screenHits.length < this.maxParticles) {
      this.spawnTimer = 0;
      this.spawnParticle();
    }

    // Update detector visibility
    const detectorOpacity = this.detectorOn ? 0.8 : 0;
    this.detectorMesh.material.opacity += (detectorOpacity - this.detectorMesh.material.opacity) * 0.1;
    this.detectorLabel.material.opacity += (detectorOpacity - this.detectorLabel.material.opacity) * 0.1;

    // Move particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.userData.alive) continue;

      const ud = p.userData;

      if (ud.phase === 0) {
        // Moving towards barrier
        p.position.x += ud.speed * dt;
        // Aim towards slit
        p.position.y += (ud.slitY - p.position.y) * 0.03;

        if (p.position.x >= -0.55) {
          ud.phase = 1;
        }
      } else if (ud.phase === 1) {
        // Through the slit
        p.position.x += ud.speed * dt;
        p.position.y = ud.slitY + (Math.random() - 0.5) * this.slitWidth;

        if (p.position.x >= -0.4) {
          ud.phase = 2;
        }
      } else if (ud.phase === 2) {
        // Heading to screen
        p.position.x += ud.speed * dt;
        // Curve towards final Y
        p.position.y += (ud.finalY - p.position.y) * 0.04;
        p.position.z += (0 - p.position.z) * 0.05;

        if (p.position.x >= 2.4) {
          // Hit screen
          this._paintHit(ud.finalY);
          ud.alive = false;
          this.scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
          this.particles.splice(i, 1);
        }
      }

      // Cleanup stale
      if (p.position.x > 10) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Source pulse
    this.source.scale.setScalar(1 + Math.sin(clock.time * 3) * 0.05);
  }

  // ── Controls ──
  setFireRate(val) {
    this.fireRate = val;
  }

  setDetector(on) {
    if (this.detectorOn !== on) {
      this.detectorOn = on;
      // Clear screen when toggling detector to show difference
      this.clearScreen();
      // Remove in-flight particles
      this.particles.forEach(p => {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
      });
      this.particles = [];
    }
  }

  // ── Cleanup ──
  destroy() {
    this.particles.forEach(p => { this.scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
    this.particles = [];
    this.screenHits = [];
  }
}
