// doppia-fenditura-game.js — Mira e Spara
export default function(G, data) {
  const controls = document.getElementById('game-controls');
  let detectorOn = false, particles = [], hits = [], hitCount = 0;
  const slitSep = 0.3, wavelength = 0.1, screenDist = 3;

  controls.innerHTML = `
    <button class="game-btn game-btn-action" id="g-fire">🔵 SPARA</button>
    <button class="game-btn game-btn-secondary" id="g-burst">⚡ RAFFICA</button>
    <button class="game-btn game-btn-secondary" id="g-detector">👁 Detector: OFF</button>
    <button class="game-btn game-btn-secondary" id="g-reset">🗑 Reset</button>
  `;

  const fireBtn = document.getElementById('g-fire');
  const burstBtn = document.getElementById('g-burst');
  const detBtn = document.getElementById('g-detector');
  const resetBtn = document.getElementById('g-reset');

  fireBtn.addEventListener('click', () => spawnParticle());
  burstBtn.addEventListener('touchstart', () => { burstInterval = setInterval(() => spawnParticle(), 80); });
  burstBtn.addEventListener('touchend', () => clearInterval(burstInterval));
  burstBtn.addEventListener('mousedown', () => { burstInterval = setInterval(() => spawnParticle(), 80); });
  burstBtn.addEventListener('mouseup', () => clearInterval(burstInterval));
  detBtn.addEventListener('click', () => toggleDetector());
  resetBtn.addEventListener('click', () => resetScreen());

  let burstInterval = null;

  // Shake detection for reset
  let lastShake = 0;
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (a && Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z) > 30) {
      const now = Date.now();
      if (now - lastShake > 1000) {
        lastShake = now;
        resetScreen();
        G.showToast('Schermo resettato!', 'var(--neon-cyan)', 800);
      }
    }
  });

  G.setScore(0);

  function screenX() { return G.W * 0.85; }
  function barrierX() { return G.W * 0.45; }
  function sourceX() { return G.W * 0.08; }

  function computeHitY(slit) {
    if (detectorOn) {
      const center = slit === 'top' ? -40 : 40;
      return G.H / 2 + center + (Math.random() - 0.5) * 50;
    }
    // Interference
    for (let a = 0; a < 100; a++) {
      const y = (Math.random() - 0.5) * 200;
      const phase = Math.PI * slitSep * y / (wavelength * screenDist * 50);
      if (Math.random() < Math.cos(phase) ** 2) return G.H / 2 + y;
    }
    return G.H / 2 + (Math.random() - 0.5) * 200;
  }

  function spawnParticle() {
    const slit = Math.random() > 0.5 ? 'top' : 'bottom';
    const slitY = G.H / 2 + (slit === 'top' ? -25 : 25);
    const finalY = computeHitY(slit);
    particles.push({
      x: sourceX(), y: G.H / 2 + (Math.random() - 0.5) * 10,
      phase: 0, slitY, finalY, speed: 400 + Math.random() * 100
    });
    G.vibrate(15);
  }

  function toggleDetector() {
    detectorOn = !detectorOn;
    detBtn.textContent = detectorOn ? '👁 Detector: ON' : '👁 Detector: OFF';
    detBtn.style.borderColor = detectorOn ? 'var(--neon-red)' : 'var(--glass-border)';
    resetScreen();
    G.showToast(detectorOn ? 'Detector ON — niente interferenza' : 'Detector OFF — interferenza!',
      detectorOn ? 'var(--neon-red)' : 'var(--neon-green)', 1200);
  }

  function resetScreen() {
    hits = [];
    hitCount = 0;
    G.setScore(0);
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.speed * dt;

      if (p.phase === 0 && p.x < barrierX()) {
        p.y += (p.slitY - p.y) * 0.05;
      } else if (p.phase === 0) {
        p.phase = 1;
      }

      if (p.phase === 1) {
        p.y += (p.finalY - p.y) * 0.04;
      }

      if (p.x >= screenX()) {
        hits.push({ x: screenX(), y: p.finalY });
        hitCount++;
        G.setScore(hitCount);
        particles.splice(i, 1);
        if (hitCount === 100) {
          G.showToast('🎉 100 particelle! Osserva il pattern!', 'var(--neon-green)', 3000);
        }
      }
    }
  }

  function render(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, W, H);

    const bx = barrierX(), sx = screenX();

    // Source
    ctx.beginPath();
    ctx.arc(sourceX(), H/2, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#00d9ff';
    ctx.fill();

    // Barrier
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(bx - 3, 0, 6, H/2 - 30);
    ctx.fillRect(bx - 3, H/2 - 20, 6, 15);
    ctx.fillRect(bx - 3, H/2 + 5, 6, H);

    // Screen
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(sx - 2, 0, 4, H);

    // Hits
    for (const h of hits) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,217,255,0.6)';
      ctx.fill();
    }

    // Particles in flight
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00d9ff';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00d9ff';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Detector indicator
    if (detectorOn) {
      ctx.fillStyle = 'rgba(255,51,102,0.15)';
      ctx.fillRect(bx - 20, H/2 - 50, 40, 100);
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 20, H/2 - 50, 40, 100);
      ctx.fillStyle = '#ff3366';
      ctx.font = '10px Orbitron';
      ctx.fillText('DETECTOR', bx - 18, H/2 - 55);
    }

    // Counter
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillText(`Particelle: ${hitCount}/100`, 20, 30);
  }

  G.start(update, render);
}
