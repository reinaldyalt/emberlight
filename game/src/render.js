// Emberlight's renderer: everything the player sees, painted on one canvas.
// The look is a dark nebula lit by the ship's own light: a soft glow follows the
// wisp, embers burn gold, rocks are dull and heavy, and the dark presses in as
// the light drains. The HUD is drawn last so it stays readable in the dark.
import { COLORS, FIELD, LIGHT } from './config.js';
import { KIND_ASTEROID, KIND_COMET, KIND_EMBER, KIND_POWER, POWER_MAGNET, POWER_NOVA, POWER_SHIELD } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowCircle(ctx, x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function drawBackground(state, time) {
    // The deep sky.
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, '#070510');
    sky.addColorStop(0.55, '#0d0a1e');
    sky.addColorStop(1, '#120a24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // The nebulae: slow, soft, coloured clouds.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const nebula of state.nebulae) {
      const breathe = 1 + 0.08 * Math.sin(nebula.phase);
      const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius * breathe);
      gradient.addColorStop(0, `hsla(${nebula.hue}, 70%, 42%, 0.16)`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(nebula.x, nebula.y, nebula.radius * breathe, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // The parallax stars, twinkling.
    for (const star of state.stars) {
      const twinkle = 0.65 + 0.35 * Math.sin(star.twinkle);
      ctx.globalAlpha = star.bright * twinkle;
      ctx.fillStyle = '#e8ecff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEmber(item, time) {
    const pulse = 1 + 0.18 * Math.sin(time * 5 + item.seed);
    const r = item.radius * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowCircle(ctx, item.x, item.y, r * 3.2, 'rgba(255,170,40,0.55)', 1);
    ctx.restore();
    ctx.fillStyle = COLORS.emberCore;
    ctx.beginPath();
    ctx.arc(item.x, item.y, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.arc(item.x, item.y, r, 0, TAU);
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    // A tiny sparkle on top.
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.arc(item.x - r * 0.3, item.y - r * 0.3, r * 0.22, 0, TAU);
    ctx.fill();
  }

  function drawAsteroid(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    ctx.beginPath();
    for (let i = 0; i < item.shape.shape.length; i += 1) {
      const angle = (i / item.shape.shape.length) * TAU;
      const r = item.shape.shape[i];
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.asteroidDark;
    ctx.fill();
    ctx.strokeStyle = COLORS.asteroid;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Craters.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const crater of item.shape.craters) {
      ctx.beginPath();
      ctx.arc(Math.cos(crater.angle) * crater.dist * item.radius, Math.sin(crater.angle) * crater.dist * item.radius, crater.radius, 0, TAU);
      ctx.fill();
    }
    // A lit rim on the upper edge.
    ctx.strokeStyle = 'rgba(255,220,170,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, item.radius * 0.92, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.restore();
  }

  function drawComet(item) {
    const angle = Math.atan2(item.vy, item.vx);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(angle);
    const tail = ctx.createLinearGradient(0, 0, -90, 0);
    tail.addColorStop(0, 'rgba(159,232,255,0.85)');
    tail.addColorStop(1, 'rgba(159,232,255,0)');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-90, 0);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowCircle(ctx, item.x, item.y, 26, 'rgba(159,232,255,0.7)', 1);
    ctx.restore();
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius * 0.7, 0, TAU);
    ctx.fill();
  }

  function drawPower(item, time) {
    const bob = Math.sin(time * 3 + item.seed) * 3;
    const y = item.y + bob;
    const r = item.radius;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = item.power === POWER_SHIELD ? 'rgba(77,227,255,0.6)' : item.power === POWER_MAGNET ? 'rgba(255,95,208,0.6)' : 'rgba(255,255,255,0.7)';
    glowCircle(ctx, item.x, y, r * 2.6, glow, 1);
    ctx.restore();
    ctx.fillStyle = 'rgba(10,8,20,0.85)';
    ctx.beginPath();
    ctx.arc(item.x, y, r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = item.power === POWER_SHIELD ? COLORS.shield : item.power === POWER_MAGNET ? COLORS.magnet : COLORS.nova;
    ctx.stroke();
    ctx.fillStyle = item.power === POWER_SHIELD ? COLORS.shield : item.power === POWER_MAGNET ? COLORS.magnet : COLORS.nova;
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = item.power === POWER_SHIELD ? 'S' : item.power === POWER_MAGNET ? 'M' : 'N';
    ctx.fillText(glyph, item.x, y + 1);
  }

  function drawShip(state, time) {
    const ship = state.ship;
    const blink = ship.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    // The trail: a soft comet of light behind the wisp.
    ctx.globalCompositeOperation = 'lighter';
    glowCircle(ctx, ship.x, ship.y, 60, 'rgba(255,200,90,0.55)', 1);
    glowCircle(ctx, ship.x, ship.y, 120, 'rgba(255,170,60,0.12)', 1);
    ctx.restore();
    ctx.save();
    // The wisp itself: a bright core, bigger than an ember, ringed in white
    // so the eye finds it at once, with a small flame tail below.
    ctx.fillStyle = COLORS.shipCore;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.shipGlow;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 19, 0, TAU);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,248,224,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 16, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffb84d';
    ctx.beginPath();
    ctx.ellipse(ship.x, ship.y + 16, 6, 11, 0, 0, TAU);
    ctx.fill();
    // The shield ring, when it is held.
    if (ship.shield) {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, 24 + Math.sin(time * 4) * 1.5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = COLORS.shield;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, 24, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // The magnet ring, while it pulls.
    if (ship.magnet > 0) {
      ctx.strokeStyle = COLORS.magnet;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, 34, time * 2, time * 2 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawParticles(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFloats(state) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of state.floats) {
      const alpha = Math.max(0, Math.min(1, f.life / 0.5));
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = f.color;
      // Keep the floats out of the HUD strip at the top.
      ctx.fillText(f.text, f.x, Math.max(92, f.y));
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    ctx.save();
    // Score and best, top left.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(state.score).padStart(5, '0'), 18, 14);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`BEST ${best}`, 18, 50);
    // Level, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`LEVEL ${state.level}`, FIELD.width / 2, 16);
    // The combo, under the level.
    if (state.combo > 1) {
      const width = 120;
      const x = FIELD.width / 2 - width / 2;
      ctx.fillStyle = '#ff9d5c';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(`COMBO x${state.combo}`, FIELD.width / 2, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, x, 64, width, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#ff9d5c';
      roundRect(ctx, x, 64, width * Math.max(0, state.comboTimer / 2.5), 6, 3);
      ctx.fill();
    }
    // Lives as hearts, top right.
    const heartY = 30;
    for (let i = 0; i < 3; i += 1) {
      const x = FIELD.width - 30 - i * 32;
      ctx.fillStyle = i < state.lives ? '#ff6b81' : 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(x - 6, heartY - 2, 7, 0, TAU);
      ctx.arc(x + 6, heartY - 2, 7, 0, TAU);
      ctx.moveTo(x - 12, heartY);
      ctx.lineTo(x, heartY + 12);
      ctx.lineTo(x + 12, heartY);
      ctx.closePath();
      ctx.fill();
    }
    // The light bar, top right under the hearts.
    const barX = FIELD.width - 190;
    const barY = 52;
    const barW = 160;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('LIGHT', barX - 8, barY + 11);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, barX, barY, barW, 12, 6);
    ctx.fill();
    const fraction = Math.max(0, Math.min(1, state.light / LIGHT.max));
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradient.addColorStop(0, '#ff9d3c');
    gradient.addColorStop(1, '#ffe08a');
    ctx.fillStyle = fraction < 0.25 ? '#ff5c5c' : gradient;
    if (fraction > 0) {
      roundRect(ctx, barX, barY, Math.max(12, barW * fraction), 12, 6);
      ctx.fill();
    }
    // The magnet timer, when it runs.
    if (state.ship.magnet > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.magnet;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`MAGNET ${Math.ceil(state.ship.magnet)}s`, FIELD.width - 30, 84);
    }
    ctx.restore();
  }

  function drawVignette(state) {
    // The dark presses in as the light drains: a radial shade centred on the
    // ship, clear inside the light and dark beyond it.
    const ship = state.ship;
    const radius = Math.max(60, state.light * 2.4);
    const gradient = ctx.createRadialGradient(ship.x, ship.y, radius * 0.35, ship.x, ship.y, radius * 2.1);
    gradient.addColorStop(0, 'rgba(2,2,8,0)');
    gradient.addColorStop(0.55, 'rgba(2,2,8,0.28)');
    gradient.addColorStop(1, 'rgba(2,2,8,0.82)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawPanel(title, lines, accent) {
    const w = 560;
    const h = 150 + lines.length * 34;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,18,0.82)';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title, FIELD.width / 2, y + 52);
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, y + 108 + i * 34));
    ctx.restore();
  }

  function drawTitle(state, best) {
    drawPanel('EMBERLIGHT', [
      'Keep your light alive. Catch the embers, dodge the rocks.',
      'Move with the mouse or arrow keys  ·  P pauses  ·  M mutes',
      'Press SPACE or click to start',
    ], '#ffd76a');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`BEST ${best}`, FIELD.width / 2, FIELD.height - 92);
    ctx.restore();
  }

  function drawPaused() {
    drawPanel('PAUSED', ['Press P or click to keep playing'], '#8fe3ff');
  }

  function drawOver(state, best) {
    const reason = state.overReason === 'dark' ? 'Your light faded into the dark.' : 'The rocks caught you in the end.';
    const lines = [reason, `SCORE ${state.score}   ·   BEST ${best}`];
    if (state.score > 0 && state.score >= best) lines.push('NEW BEST!');
    lines.push('Press SPACE or click to play again');
    drawPanel('LIGHT FADES', lines, '#ff8a7a');
  }

  function draw(state, screen, best) {
    const time = state.time;
    ctx.save();
    if (state.shake > 0) {
      const magnitude = state.shake * 14;
      ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
    }
    drawBackground(state, time);
    for (const item of state.items) {
      if (!item.active) continue;
      if (item.kind === KIND_EMBER) drawEmber(item, time);
      else if (item.kind === KIND_ASTEROID) drawAsteroid(item);
      else if (item.kind === KIND_COMET) drawComet(item);
      else if (item.kind === KIND_POWER) drawPower(item, time);
    }
    if (screen !== SCREEN_TITLE) drawShip(state, time);
    drawParticles(state);
    drawFloats(state);
    // The nova flash washes the screen white for a beat.
    if (state.novaFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.novaFlash * 0.5})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen !== SCREEN_TITLE) drawVignette(state);
    ctx.restore();

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);

    // The level banner, over everything.
    if (state.levelBanner > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.levelBanner);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8fe3ff';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.fillText(`LEVEL ${state.level}`, FIELD.width / 2, FIELD.height * 0.3);
      ctx.restore();
    }
  }

  return { draw };
}
