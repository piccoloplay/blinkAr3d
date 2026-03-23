// tunnel-game.js — Lancia la Particella
export default function(G, data) {
  const controls = document.getElementById('game-controls');
  let energy = 5, barrierW = 0.4, barrierH = 7;
  let particles = [], tunneled = 0, launched = 0;
  const target = data.game.target_tunneled;

  controls.innerHTML = `
    <div class="game-slider-group">
      <div class="game-slider-label"><span>Energia</span><span class="game-slider-val" id="g-e-val">${energy}</span></div>
      <input type="range" class="ar-slider" id="g-energy" min="1" max="10" step="0.5" value="${energy}">
    </div>
    <div class="game-slider-group">
      <div class="game-slider-label"><span>Spessore</span><span class="game-slider-val" id="g-w-val">${barrierW}</span></div>
      <input type="range" class="ar-slider" id="g-width" min="0.1" max="1" step="0.05" value="${barrierW}">
    </div>
    <button class="game-btn game-btn-action" id="g-launch">🚀 LANCIA</button>
  `;

  document.getElementById('g-energy').addEventListener('input', e => {
    energy = parseFloat(e.target.value);
    document.getElementById('g-e-val').textContent = energy;
  });
  document.getElementById('g-width').addEventListener('input', e => {
    barrierW = parseFloat(e.target.value);
    document.getElementById('g-w-val').textContent = barrierW;
  });
  document.getElementById('g-launch').addEventListener('click', launch);

  G.setScore(0);

  function getTunnelProb() {
    if (energy >= barrierH) return 0.95;
    const kappa = Math.sqrt(Math.max(0.1, barrierH - energy));
    return Math.min(0.9, Math.max(0.01, Math.exp(-2 * barrierW * kappa * 3)));
  }

  function launch() {
    // Tilt gives boost
    const boost = G.hasAccel ? Math.max(0, G.accel.y * 0.3) : 0;
    const totalEnergy = energy + boost;
    const effectiveProb = (() => {
      if (totalEnergy >= barrierH) return 0.95;
      const k = Math.sqrt(Math.max(0.1, barrierH - totalEnergy));
      return Math.min(0.9, Math.max(0.01, Math.exp(-2 * barrierW * k * 3)));
    })();

    const willTunnel = Math.random() < effectiveProb;
    launched++;

    particles.push({
      x: G.W * 0.1,
      y: G.H / 2 + (Math.random() - 0.5) * 20,
      vx: 200 + totalEnergy * 30,
      phase: 'fly',
      willTunnel,
      opacity: 1,
      color: `hsl(${180 - totalEnergy * 12}, 100%, 60%)`
    });

    G.vibrate(25);
    if (boost > 1) G.showToast(`+${boost.toFixed(1)} boost!`, 'var(--neon-cyan)', 600);
  }

  function barrierXStart() { return G.W * 0.55; }
  function barrierXEnd() { return G.W * 0.55 + barrierW * G.W * 0.15; }
  function detectorX() { return G.W * 0.85; }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.phase === 'fly') {
        p.x += p.vx * dt;
        if (p.x >= barrierXStart()) {
          p.phase = p.willTunnel ? 'tunnel' : 'reflect';
          if (!p.willTunnel) p.vx = -p.vx * 0.4;
        }
      } else if (p.phase === 'tunnel') {
        p.x += p.vx * dt * 0.3;
        p.opacity = 0.3 + Math.sin(Date.now() * 0.01) * 0.15;
        if (p.x >= barrierXEnd()) {
          p.phase = 'passed';
          p.opacity = 1;
          p.color = '#00ff88';
          tunneled++;
          G.setScore(tunneled);
          G.vibrate(60);
          if (tunneled >= target) {
            G.showToast('🎉 Tunnel riuscito! 5/5!', 'var(--neon-green)', 3000);
          }
        }
      } else if (p.phase === 'reflect') {
        p.x += p.vx * dt;
        p.opacity -= dt;
        if (p.opacity <= 0) { particles.splice(i, 1); continue; }
      } else if (p.phase === 'passed') {
        p.x += p.vx * dt;
        if (p.x > G.W + 50) { particles.splice(i, 1); continue; }
      }
    }
  }

  function render(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, W, H);

    const bxs = barrierXStart(), bxe = barrierXEnd();

    // Source
    ctx.beginPath();
    ctx.arc(W * 0.08, H / 2, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#00d9ff';
    ctx.fill();

    // Barrier
    const bOpacity = 0.3 + (barrierH / 12) * 0.5;
    ctx.fillStyle = `rgba(255,51,102,${bOpacity})`;
    ctx.fillRect(bxs, H * 0.15, bxe - bxs, H * 0.7);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 1;
    ctx.strokeRect(bxs, H * 0.15, bxe - bxs, H * 0.7);

    // Barrier label
    ctx.fillStyle = '#ff3366';
    ctx.font = '10px Orbitron';
    ctx.fillText(`H=${barrierH}`, bxs, H * 0.12);

    // Probability bar
    const prob = getTunnelProb();
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(20, H - 60, 150, 12);
    ctx.fillStyle = prob > 0.3 ? '#00ff88' : prob > 0.1 ? '#ffe066' : '#ff3366';
    ctx.fillRect(20, H - 60, 150 * prob, 12);
    ctx.fillStyle = '#7da3c0';
    ctx.font = '10px Rajdhani';
    ctx.fillText(`P tunnel: ${(prob * 100).toFixed(1)}%`, 20, H - 65);

    // Detector
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.strokeRect(detectorX() - 4, H * 0.3, 8, H * 0.4);

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Stats
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Orbitron';
    ctx.fillText(`Tunnel: ${tunneled}/${target} | Lanciate: ${launched}`, 20, 30);

    if (G.hasAccel) {
      ctx.fillStyle = '#4a6a85';
      ctx.font = '10px Rajdhani';
      ctx.fillText('↕ Inclina per boost energia', 20, H - 20);
    }
  }

  G.start(update, render);
}
