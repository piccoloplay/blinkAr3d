// entanglement-game.js — Scuoti per Separare
export default function(G, data) {
  const controls = document.getElementById('game-controls');
  let distance = 0.5, angle = 0, measurements = [], totalM = 0, correlated = 0;
  let particleA = { x: 0, y: 0, spin: null, measured: false };
  let particleB = { x: 0, y: 0, spin: null, measured: false };
  let linkWave = 0, flashA = 0, flashB = 0;
  const target = data.game.target_measurements;

  controls.innerHTML = `
    <div class="game-slider-group">
      <div class="game-slider-label"><span>Angolo misura</span><span class="game-slider-val" id="g-angle-val">0°</span></div>
      <input type="range" class="ar-slider" id="g-angle" min="0" max="360" step="15" value="0">
    </div>
    <button class="game-btn game-btn-action" id="g-measure">⚛ MISURA</button>
  `;

  document.getElementById('g-angle').addEventListener('input', e => {
    angle = parseFloat(e.target.value);
    document.getElementById('g-angle-val').textContent = angle + '°';
  });
  document.getElementById('g-measure').addEventListener('click', measure);

  G.setScore(0);

  function measure() {
    if (particleA.measured) resetParticles();

    const angleRad = angle * Math.PI / 180;
    particleA.spin = Math.random() > 0.5 ? 1 : -1;
    const probSame = Math.cos(angleRad / 2) ** 2;
    particleB.spin = Math.random() < probSame ? -particleA.spin : particleA.spin;

    particleA.measured = true;
    particleB.measured = true;
    flashA = 1; flashB = 1;

    totalM++;
    if (particleA.spin !== particleB.spin) correlated++;
    const rate = correlated / totalM;
    G.setScore(totalM);
    G.vibrate(40);

    measurements.push({ angle, corr: particleA.spin !== particleB.spin });

    if (totalM >= target) {
      const bellVal = (rate * 4).toFixed(2);
      if (rate > 0.5) {
        G.showToast(`🎉 Bell violata! S=${bellVal} > 2.0`, 'var(--neon-green)', 4000);
      } else {
        G.showToast(`Prova angoli diversi! S=${bellVal}`, 'var(--neon-cyan)', 3000);
      }
    }

    setTimeout(() => resetParticles(), 1200);
  }

  function resetParticles() {
    particleA.measured = false; particleA.spin = null;
    particleB.measured = false; particleB.spin = null;
  }

  // Shake increases distance
  let lastShake = 0;
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (a && Math.abs(a.x) + Math.abs(a.y) > 20) {
      const now = Date.now();
      if (now - lastShake > 500) {
        lastShake = now;
        distance = Math.min(0.95, distance + 0.08);
        G.vibrate(20);
      }
    }
  });

  // Tilt adjusts angle
  function update(dt) {
    if (G.hasAccel) {
      const tiltAngle = Math.atan2(G.accel.x, G.accel.y) * 180 / Math.PI + 180;
      angle = Math.round(tiltAngle / 15) * 15;
      document.getElementById('g-angle').value = angle;
      document.getElementById('g-angle-val').textContent = Math.round(angle) + '°';
    }

    linkWave += dt * 3;
    flashA = Math.max(0, flashA - dt * 2);
    flashB = Math.max(0, flashB - dt * 2);

    particleA.x = G.W / 2 - distance * G.W * 0.35;
    particleA.y = G.H / 2 + Math.sin(linkWave * 0.8) * 8;
    particleB.x = G.W / 2 + distance * G.W * 0.35;
    particleB.y = G.H / 2 + Math.sin(linkWave * 0.8 + Math.PI) * 8;
  }

  function render(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, W, H);

    // Entanglement link
    ctx.beginPath();
    ctx.moveTo(particleA.x, particleA.y);
    for (let i = 1; i <= 30; i++) {
      const t = i / 30;
      const x = particleA.x + (particleB.x - particleA.x) * t;
      const y = (particleA.y + particleB.y) / 2 + Math.sin(t * Math.PI * 5 + linkWave) * 8;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = particleA.measured ? 'rgba(0,217,255,0.08)' : 'rgba(0,217,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Particle A
    const ra = 20 + flashA * 15;
    ctx.beginPath();
    ctx.arc(particleA.x, particleA.y, ra, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,217,255,${0.15 + flashA * 0.3})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(particleA.x, particleA.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#00d9ff';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('A', particleA.x, particleA.y + 4);

    // Spin arrow A
    if (particleA.measured) {
      const dir = particleA.spin > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(particleA.x, particleA.y + dir * 18);
      ctx.lineTo(particleA.x, particleA.y + dir * 40);
      ctx.strokeStyle = particleA.spin > 0 ? '#00ff88' : '#ff3366';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = particleA.spin > 0 ? '#00ff88' : '#ff3366';
      ctx.font = 'bold 16px Orbitron';
      ctx.fillText(particleA.spin > 0 ? '↑' : '↓', particleA.x, particleA.y + dir * 55);
    }

    // Particle B
    const rb = 20 + flashB * 15;
    ctx.beginPath();
    ctx.arc(particleB.x, particleB.y, rb, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(157,0,255,${0.15 + flashB * 0.3})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(particleB.x, particleB.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#9d00ff';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('B', particleB.x, particleB.y + 4);

    if (particleB.measured) {
      const dir = particleB.spin > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(particleB.x, particleB.y + dir * 18);
      ctx.lineTo(particleB.x, particleB.y + dir * 40);
      ctx.strokeStyle = particleB.spin > 0 ? '#00ff88' : '#ff3366';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = particleB.spin > 0 ? '#00ff88' : '#ff3366';
      ctx.font = 'bold 16px Orbitron';
      ctx.fillText(particleB.spin > 0 ? '↑' : '↓', particleB.x, particleB.y + dir * 55);
    }

    ctx.textAlign = 'left';

    // Stats
    const rate = totalM > 0 ? (correlated / totalM * 100).toFixed(0) : '—';
    ctx.fillStyle = '#7da3c0';
    ctx.font = '12px Rajdhani, sans-serif';
    ctx.fillText(`Misure: ${totalM}/${target} | Correlazione: ${rate}% | Distanza: ${(distance*100).toFixed(0)}%`, 20, 30);

    if (G.hasAccel) {
      ctx.fillStyle = '#4a6a85';
      ctx.font = '10px Rajdhani';
      ctx.fillText('📱 Scuoti per allontanare | Inclina per angolo', 20, H - 20);
    }
  }

  G.start(update, render);
}
