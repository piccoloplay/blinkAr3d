// laser-game.js — Sintonizza il fotone
export default function(G, data) {
  const controls = document.getElementById('game-controls');
  let frequency = 500, electrons = 0, photons = [], threshold = data.ar.threshold_frequency;

  // Slider: frequency
  controls.innerHTML = `
    <div class="game-slider-group">
      <div class="game-slider-label"><span>Frequenza</span><span class="game-slider-val" id="g-freq-val">${frequency} THz</span></div>
      <input type="range" class="ar-slider" id="g-freq" min="400" max="800" step="10" value="${frequency}">
    </div>
    <button class="game-btn game-btn-action" id="g-fire">⚡ SPARA</button>
  `;

  document.getElementById('g-freq').addEventListener('input', e => {
    frequency = parseFloat(e.target.value);
    document.getElementById('g-freq-val').textContent = frequency + ' THz';
  });

  document.getElementById('g-fire').addEventListener('click', fire);

  G.setScore(0);

  function freqToColor(f) {
    const t = (f - 400) / 400;
    const r = Math.max(0, 1 - t * 2.5);
    const g = t < 0.5 ? t * 2 : 1 - (t - 0.5) * 2;
    const b = Math.max(0, t * 2.5 - 1);
    return `rgb(${r*255|0},${g*255|0},${b*255|0})`;
  }

  function fire() {
    // Intensity from tilt (or default if no accel)
    const intensity = G.hasAccel ? Math.min(10, Math.max(1, Math.abs(G.accel.y) * 1.5)) : 5;
    const count = Math.round(intensity);
    for (let i = 0; i < count; i++) {
      photons.push({
        x: 60 + Math.random() * 20,
        y: G.H / 2 + (Math.random() - 0.5) * 40,
        vx: 300 + Math.random() * 150,
        color: freqToColor(frequency),
        alive: true
      });
    }
    G.vibrate(30);
  }

  // Plate position
  const plateX = () => G.W * 0.75;

  function update(dt) {
    for (let i = photons.length - 1; i >= 0; i--) {
      const p = photons[i];
      p.x += p.vx * dt;
      if (p.x >= plateX()) {
        p.alive = false;
        if (frequency >= threshold) {
          electrons++;
          G.setScore(electrons);
          G.vibrate(20);
          if (electrons >= 10) {
            G.showToast('🎉 10 elettroni! Vittoria!', 'var(--neon-green)', 3000);
          }
        }
        photons.splice(i, 1);
      } else if (p.x > G.W + 50) {
        photons.splice(i, 1);
      }
    }
  }

  function render(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, W, H);

    // Laser source
    ctx.fillStyle = '#0a2a4a';
    ctx.fillRect(20, H/2 - 30, 50, 60);
    ctx.strokeStyle = '#00d9ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, H/2 - 30, 50, 60);

    // Beam guide
    ctx.strokeStyle = freqToColor(frequency);
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, H/2);
    ctx.lineTo(plateX(), H/2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Metal plate
    const px = plateX();
    ctx.fillStyle = frequency >= threshold ? '#44aa66' : '#666';
    ctx.fillRect(px, H/2 - 80, 8, 160);
    ctx.strokeStyle = frequency >= threshold ? '#00ff88' : '#444';
    ctx.strokeRect(px, H/2 - 80, 8, 160);

    // Threshold label
    ctx.fillStyle = 'var(--text-muted)';
    ctx.font = '11px Orbitron, monospace';
    ctx.fillStyle = frequency >= threshold ? '#00ff88' : '#ff3366';
    ctx.fillText(frequency >= threshold ? '✓ SOPRA SOGLIA' : '✗ SOTTO SOGLIA', px - 50, H/2 + 110);

    // Photons
    for (const p of photons) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Score display
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillText(`Elettroni: ${electrons}/10`, 20, 30);

    // Tilt hint
    if (G.hasAccel) {
      ctx.fillStyle = '#4a6a85';
      ctx.font = '10px Rajdhani, sans-serif';
      ctx.fillText('↕ Inclina per intensità', 20, H - 20);
    }
  }

  G.start(update, render);
}
