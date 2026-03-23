// heisenberg-game.js — Cattura la Particella
export default function(G, data) {
  const controls = document.getElementById('game-controls');
  let deltaX = 1.0, deltaP = 0.5;
  let particleX, particleY, particleVX, particleVY;
  let viewX = 0, viewY = 0;
  let measurements = [], totalM = 0;
  let flash = 0, measured = false, measuredPos = null;
  const target = data.game.target_measurements;

  controls.innerHTML = `
    <div class="game-slider-group">
      <div class="game-slider-label"><span>Precisione Δx</span><span class="game-slider-val" id="g-dx-val">1.00</span></div>
      <input type="range" class="ar-slider" id="g-dx" min="0.1" max="2" step="0.05" value="1.0">
    </div>
    <button class="game-btn game-btn-action" id="g-measure">🎯 MISURA</button>
  `;

  document.getElementById('g-dx').addEventListener('input', e => {
    deltaX = parseFloat(e.target.value);
    deltaP = 0.5 / deltaX;
    document.getElementById('g-dx-val').textContent = deltaX.toFixed(2);
  });
  document.getElementById('g-measure').addEventListener('click', doMeasure);

  G.setScore(0);

  // Init particle
  resetParticle();

  function resetParticle() {
    particleX = G.W / 2;
    particleY = G.H / 2;
    particleVX = (Math.random() - 0.5) * 100;
    particleVY = (Math.random() - 0.5) * 100;
    measured = false;
    measuredPos = null;
  }

  function doMeasure() {
    // Sample from uncertainty
    const mx = particleX + (Math.random() - 0.5) * deltaX * 80;
    const my = particleY + (Math.random() - 0.5) * deltaX * 80;
    const mmx = particleVX + (Math.random() - 0.5) * deltaP * 200;
    const mmy = particleVY + (Math.random() - 0.5) * deltaP * 200;

    measured = true;
    measuredPos = { x: mx, y: my };
    flash = 1;
    totalM++;
    G.setScore(totalM);
    G.vibrate(30);

    measurements.push({ x: mx, y: my, dx: deltaX, dp: deltaP });

    // After measure, particle jumps (disturbance)
    particleVX += (Math.random() - 0.5) * deltaP * 150;
    particleVY += (Math.random() - 0.5) * deltaP * 150;

    if (totalM >= target) {
      G.showToast('🎯 ' + target + ' misure! Osserva la nuvola di incertezza', 'var(--neon-green)', 3000);
    }

    setTimeout(() => { measured = false; }, 800);
  }

  function update(dt) {
    // Particle moves with randomness proportional to Δp
    particleVX += (Math.random() - 0.5) * deltaP * 300 * dt;
    particleVY += (Math.random() - 0.5) * deltaP * 300 * dt;

    // Damping
    particleVX *= 0.995;
    particleVY *= 0.995;

    particleX += particleVX * dt;
    particleY += particleVY * dt;

    // Bounce off walls
    if (particleX < 50 || particleX > G.W - 50) particleVX *= -0.8;
    if (particleY < 80 || particleY > G.H - 120) particleVY *= -0.8;
    particleX = Math.max(50, Math.min(G.W - 50, particleX));
    particleY = Math.max(80, Math.min(G.H - 120, particleY));

    // Tilt moves viewpoint
    if (G.hasAccel) {
      viewX += G.accel.x * 2 * dt;
      viewY -= G.accel.y * 2 * dt;
      viewX = Math.max(-50, Math.min(50, viewX));
      viewY = Math.max(-50, Math.min(50, viewY));
    }

    flash = Math.max(0, flash - dt * 3);
  }

  function render(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, W, H);

    const ox = viewX, oy = viewY; // offset from tilt

    // Past measurement dots (uncertainty cloud)
    for (const m of measurements) {
      ctx.beginPath();
      ctx.arc(m.x + ox, m.y + oy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,224,102,0.25)';
      ctx.fill();
    }

    // Position uncertainty cloud
    const cloudR = deltaX * 60;
    const grad = ctx.createRadialGradient(
      particleX + ox, particleY + oy, 0,
      particleX + ox, particleY + oy, cloudR
    );
    grad.addColorStop(0, 'rgba(0,217,255,0.15)');
    grad.addColorStop(1, 'rgba(0,217,255,0)');
    ctx.beginPath();
    ctx.arc(particleX + ox, particleY + oy, cloudR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Cloud ring
    ctx.beginPath();
    ctx.arc(particleX + ox, particleY + oy, cloudR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,217,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Momentum arrows
    const arrowCount = Math.min(12, Math.max(3, Math.round(deltaP * 8)));
    for (let i = 0; i < arrowCount; i++) {
      const a = (i / arrowCount) * Math.PI * 2 + Date.now() * 0.001;
      const len = deltaP * 25;
      const ax = particleX + ox + Math.cos(a) * 30;
      const ay = particleY + oy + Math.sin(a) * 30;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.cos(a) * len, ay + Math.sin(a) * len);
      ctx.strokeStyle = `rgba(255,51,102,${0.2 + deltaP * 0.15})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Particle
    ctx.beginPath();
    ctx.arc(particleX + ox, particleY + oy, 8 + flash * 10, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,224,102,${0.8 + flash * 0.2})`;
    ctx.shadowBlur = 15 + flash * 20;
    ctx.shadowColor = '#ffe066';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Measured position marker
    if (measured && measuredPos) {
      ctx.beginPath();
      ctx.arc(measuredPos.x + ox, measuredPos.y + oy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#00ff88';
      ctx.font = '10px Orbitron';
      ctx.fillText('MISURATO', measuredPos.x + ox - 25, measuredPos.y + oy - 18);
    }

    // Info
    ctx.fillStyle = '#7da3c0';
    ctx.font = '12px Rajdhani';
    ctx.fillText(`Δx = ${deltaX.toFixed(2)} | Δp = ${deltaP.toFixed(2)} | ΔxΔp = ${(deltaX * deltaP).toFixed(2)} ≥ 0.50`, 20, 30);
    ctx.fillText(`Misure: ${totalM}/${target}`, 20, 50);

    // Warning
    if (deltaX < 0.3) {
      ctx.fillStyle = '#ff3366';
      ctx.font = 'bold 11px Orbitron';
      ctx.fillText('⚠ MOMENTO IMPAZZITO!', 20, 70);
    } else if (deltaX > 1.7) {
      ctx.fillStyle = '#ff3366';
      ctx.font = 'bold 11px Orbitron';
      ctx.fillText('⚠ POSIZIONE SFUOCATA!', 20, 70);
    }

    if (G.hasAccel) {
      ctx.fillStyle = '#4a6a85';
      ctx.font = '10px Rajdhani';
      ctx.fillText('📱 Inclina per spostare il punto di vista', 20, H - 20);
    }
  }

  G.start(update, render);
}
