// Emberlight's world: the ship, its light, the things that fall, and what happens
// when they meet. The world advances in fixed 1/60 s steps and returns events, so
// the loop, the renderer and the screenshot autopilot all read the same state.
//
// The game: you are a wisp of light drifting through a dark nebula. Your light
// drains away on its own; only embers refill it. Dodge the rocks and the comets,
// chain embers into a combo, catch power-ups, and climb the levels before the
// dark closes in. You lose when your light reaches nothing or your lives run out.
import {
  ASTEROID,
  ASTEROID_TINTS,
  COMBO,
  COMET,
  EMBER,
  FIELD,
  GOLDEN,
  LEVEL_BONUS,
  LEVEL_EMBERS,
  LIGHT,
  LIVES,
  NOVA_POINTS,
  PLAY_TOP,
  POWER,
  SHIP,
  STEP,
} from './config.js';

export const KIND_EMBER = 'ember';
export const KIND_ASTEROID = 'asteroid';
export const KIND_COMET = 'comet';
export const KIND_POWER = 'power';

export const POWER_SHIELD = 'shield';
export const POWER_MAGNET = 'magnet';
export const POWER_NOVA = 'nova';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_LEVEL = 4;
export const EVENT_PICKUP = 8;

const TAU = Math.PI * 2;

/** A rock's outline: a fixed set of radii so it keeps its shape as it turns. */
function makeRockShape(random, radius) {
  const points = 9;
  const shape = [];
  for (let i = 0; i < points; i += 1) shape.push(random.range(0.72, 1.08) * radius);
  const craters = [];
  for (let i = 0; i < 3; i += 1) {
    craters.push({
      angle: random.range(0, TAU),
      dist: random.range(0.15, 0.55),
      radius: random.range(0.12, 0.24) * radius,
    });
  }
  return { shape, craters };
}

export function createWorld(random) {
  const state = {
    ship: { x: FIELD.width / 2, y: FIELD.height * 0.72, radius: SHIP.radius, invuln: 0, shield: false, magnet: 0 },
    light: LIGHT.start,
    lives: LIVES,
    score: 0,
    combo: 1,
    comboTimer: 0,
    level: 1,
    embers: 0,
    time: 0,
    items: [],
    particles: [],
    floats: [],
    rings: [],
    stars: [],
    nebulae: [],
    shooting: null,
    lastGolden: false,
    shake: 0,
    novaFlash: 0,
    levelBanner: 0,
    gameOver: false,
    overReason: '',
  };

  let emberTimer = 0.4;
  let asteroidTimer = 1.1;
  let cometTimer = 5;
  let powerTimer = POWER.spawnSeconds;

  /** The three star layers of the parallax sky, plus the nebula blobs. */
  function seedSky() {
    state.stars = [];
    const layers = [
      { count: 85, speed: 6, size: 1, bright: 0.5 },
      { count: 55, speed: 14, size: 1.6, bright: 0.75 },
      { count: 28, speed: 26, size: 2.4, bright: 1 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i += 1) {
        state.stars.push({
          x: random.range(0, FIELD.width),
          y: random.range(0, FIELD.height),
          speed: layer.speed,
          size: layer.size,
          bright: layer.bright,
          twinkle: random.range(0, TAU),
        });
      }
    }
    const hues = [265, 285, 210, 320, 45];
    state.nebulae = [];
    for (let i = 0; i < 6; i += 1) {
      state.nebulae.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        radius: random.range(170, 320),
        hue: hues[i % hues.length],
        drift: random.range(-4, 4),
        phase: random.range(0, TAU),
        alpha: random.range(0.22, 0.32),
      });
    }
  }

  function reset() {
    state.ship.x = FIELD.width / 2;
    state.ship.y = FIELD.height * 0.72;
    state.ship.radius = SHIP.radius;
    state.ship.invuln = 0;
    state.ship.shield = false;
    state.ship.magnet = 0;
    state.light = LIGHT.start;
    state.lives = LIVES;
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.level = 1;
    state.embers = 0;
    state.time = 0;
    state.items = [];
    state.particles = [];
    state.floats = [];
    state.rings = [];
    state.shooting = null;
    state.lastGolden = false;
    state.shake = 0;
    state.novaFlash = 0;
    state.levelBanner = 0;
    state.gameOver = false;
    state.overReason = '';
    emberTimer = 0.4;
    asteroidTimer = 1.1;
    cometTimer = 5;
    powerTimer = POWER.spawnSeconds;
    seedSky();
  }

  function addFloat(x, y, text, color) {
    // A little sideways jitter, and a cap, so a quick run of pickups does not
    // pile its numbers on top of each other and the HUD.
    state.floats.push({ x: x + random.range(-14, 14), y, text, color, life: 0.95, max: 0.95 });
    if (state.floats.length > 10) state.floats.shift();
  }

  function addRing(x, y, color) {
    state.rings.push({ x, y, color, life: 0.45, max: 0.45 });
    if (state.rings.length > 6) state.rings.shift();
  }

  /** When the game ends, the panel must stand alone: no banner, no leftover numbers. */
  function clearOverlays() {
    state.floats = [];
    state.rings = [];
    state.levelBanner = 0;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, TAU);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(0.35, 0.8),
        max: 0.8,
        size: random.range(1.5, 3.5),
        color,
      });
    }
  }

  function spawnEmber() {
    const golden = random.next() < GOLDEN.chance;
    state.items.push({
      kind: KIND_EMBER,
      x: random.range(30, FIELD.width - 30),
      y: -16,
      vx: 0,
      vy: random.range(EMBER.fallMin, EMBER.fallMax),
      radius: golden ? GOLDEN.radius : EMBER.radius,
      rotation: 0,
      rotSpeed: 0,
      seed: random.range(0, TAU),
      active: true,
      power: null,
      shape: null,
      golden,
    });
  }

  function spawnAsteroid() {
    const radius = random.range(ASTEROID.radiusMin, ASTEROID.radiusMax);
    // Small rocks fall fast, big boulders fall slow: the field reads at a glance.
    const band = radius > 28 ? ASTEROID.fallBig : radius < 20 ? ASTEROID.fallSmall : ASTEROID.fallMid;
    state.items.push({
      kind: KIND_ASTEROID,
      x: random.range(radius + 10, FIELD.width - radius - 10),
      y: -radius - 10,
      vx: random.range(-24, 24),
      vy: random.range(band[0], band[1]) + (state.level - 1) * ASTEROID.fallPerLevel,
      radius,
      rotation: random.range(0, TAU),
      rotSpeed: random.range(-0.9, 0.9),
      seed: random.range(0, TAU),
      active: true,
      power: null,
      shape: makeRockShape(random, radius),
      tint: random.int(0, ASTEROID_TINTS.length - 1),
    });
  }

  function spawnComet() {
    const fromLeft = random.next() < 0.5;
    const speed = random.range(COMET.speedMin, COMET.speedMax);
    state.items.push({
      kind: KIND_COMET,
      x: fromLeft ? -20 : FIELD.width + 20,
      y: random.range(40, FIELD.height * 0.45),
      vx: (fromLeft ? 1 : -1) * speed * random.range(0.8, 1),
      vy: random.range(60, 140),
      radius: COMET.radius,
      rotation: 0,
      rotSpeed: 0,
      seed: random.range(0, TAU),
      active: true,
      power: null,
      shape: null,
    });
  }

  function spawnPower() {
    const power = random.pick([POWER_SHIELD, POWER_MAGNET, POWER_NOVA]);
    state.items.push({
      kind: KIND_POWER,
      x: random.range(40, FIELD.width - 40),
      y: -18,
      vx: 0,
      vy: POWER.fallSpeed,
      radius: POWER.radius,
      rotation: 0,
      rotSpeed: 0,
      seed: random.range(0, TAU),
      active: true,
      power,
      shape: null,
    });
  }

  function collectEmber(item) {
    const golden = item.golden === true;
    const gained = (golden ? GOLDEN.score : EMBER.score) * state.combo;
    state.score += gained;
    state.embers += 1;
    state.light = Math.min(LIGHT.max, state.light + (golden ? GOLDEN.restore : LIGHT.emberRestore));
    state.combo = Math.min(COMBO.max, state.combo + 1);
    state.comboTimer = COMBO.windowSeconds;
    state.lastGolden = golden;
    burst(item.x, item.y, golden ? '#ffe98a' : '#ffc44d', golden ? 18 : 10, golden ? 190 : 130);
    addRing(item.x, item.y, golden ? '#ffe98a' : '#ffd76a');
    addFloat(item.x, item.y - 14, golden ? `GOLD +${gained}` : `+${gained}`, golden ? '#ffe98a' : '#ffd76a');
    if (state.embers >= state.level * LEVEL_EMBERS) {
      state.level += 1;
      state.score += LEVEL_BONUS * state.level;
      state.levelBanner = 2.2;
    }
  }

  function hitHazard(item) {
    if (state.ship.shield) {
      state.ship.shield = false;
      burst(item.x, item.y, '#4de3ff', 12, 160);
      addFloat(state.ship.x, state.ship.y - 30, 'SHIELD!', '#4de3ff');
      item.active = false;
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.light = Math.max(0, state.light - LIGHT.hitLoss);
    state.combo = 1;
    state.comboTimer = 0;
    state.ship.invuln = SHIP.invulnSeconds;
    state.shake = 0.45;
    burst(state.ship.x, state.ship.y, '#ff7a5c', 22, 240);
    burst(item.x, item.y, '#8a7f74', 10, 140);
    item.active = false;
    if (state.lives <= 0) {
      state.gameOver = true;
      state.overReason = 'struck';
      clearOverlays();
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function applyPower(item) {
    if (item.power === POWER_SHIELD) {
      state.ship.shield = true;
      addFloat(item.x, item.y - 16, 'SHIELD', '#4de3ff');
    } else if (item.power === POWER_MAGNET) {
      state.ship.magnet = POWER.magnetSeconds;
      addFloat(item.x, item.y - 16, 'MAGNET', '#ff5fd0');
    } else {
      let cleared = 0;
      for (const other of state.items) {
        if (!other.active || (other.kind !== KIND_ASTEROID && other.kind !== KIND_COMET)) continue;
        other.active = false;
        burst(other.x, other.y, '#ffffff', 8, 180);
        cleared += 1;
      }
      state.score += NOVA_POINTS * cleared;
      state.novaFlash = 0.5;
      state.shake = 0.3;
      addFloat(state.ship.x, state.ship.y - 30, cleared > 0 ? `NOVA +${NOVA_POINTS * cleared}` : 'NOVA', '#ffffff');
    }
    burst(item.x, item.y, '#ffffff', 12, 150);
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1 (keyboard, or the autopilot's
   * choice); `mouse` is a canvas point the ship eases toward, or null; `attract`
   * is false on the title screen, where the world only drifts. Returns events.
   */
  function step(dt, move, mouse, attract) {
    if (state.gameOver) return 0;
    state.time += dt;
    let events = 0;
    const ship = state.ship;

    // The ship: keyboard steers, the mouse pulls it, and it stays in the field.
    if (move.x !== 0 || move.y !== 0) {
      const len = Math.hypot(move.x, move.y) || 1;
      ship.x += (move.x / len) * SHIP.speed * dt;
      ship.y += (move.y / len) * SHIP.speed * dt;
    } else if (mouse !== null) {
      ship.x += (mouse.x - ship.x) * Math.min(1, SHIP.mouseEase * dt);
      ship.y += (mouse.y - ship.y) * Math.min(1, SHIP.mouseEase * dt);
    }
    ship.x = Math.max(ship.radius, Math.min(FIELD.width - ship.radius, ship.x));
    ship.y = Math.max(PLAY_TOP, Math.min(FIELD.height - ship.radius, ship.y));
    if (ship.invuln > 0) ship.invuln -= dt;
    if (ship.magnet > 0) ship.magnet -= dt;

    // The sky drifts, whatever the screen.
    for (const star of state.stars) {
      star.y += star.speed * dt;
      star.twinkle += dt * 2;
      if (star.y > FIELD.height + 2) {
        star.y = -2;
        star.x = random.range(0, FIELD.width);
      }
    }
    for (const nebula of state.nebulae) {
      nebula.x += nebula.drift * dt;
      nebula.phase += dt * 0.15;
      if (nebula.x < -nebula.radius) nebula.x = FIELD.width + nebula.radius;
      if (nebula.x > FIELD.width + nebula.radius) nebula.x = -nebula.radius;
    }
    // A shooting star now and then, so the sky itself feels alive.
    if (state.shooting === null) {
      if (random.next() < dt * 0.22) {
        state.shooting = {
          x: random.range(FIELD.width * 0.3, FIELD.width),
          y: random.range(20, FIELD.height * 0.3),
          vx: -random.range(380, 560),
          vy: random.range(140, 220),
          life: 0.8,
          max: 0.8,
        };
      }
    } else {
      state.shooting.x += state.shooting.vx * dt;
      state.shooting.y += state.shooting.vy * dt;
      state.shooting.life -= dt;
      if (state.shooting.life <= 0) state.shooting = null;
    }

    // A drifting title world (attract off): embers fall, nothing else happens.
    if (!attract) {
      emberTimer -= dt;
      if (emberTimer <= 0) {
        spawnEmber();
        emberTimer = EMBER.spawnSeconds;
      }
      for (const item of state.items) {
        if (!item.active) continue;
        item.y += item.vy * dt;
        if (item.y > FIELD.height + 30) item.active = false;
      }
      state.items = state.items.filter((item) => item.active);
      return 0;
    }

    // The light drains; an empty light ends the game.
    state.light -= (LIGHT.drainPerSecond + (state.level - 1) * LIGHT.drainPerLevel) * dt;
    if (state.light <= 0) {
      state.light = 0;
      state.gameOver = true;
      state.overReason = 'dark';
      clearOverlays();
      burst(ship.x, ship.y, '#ffd76a', 26, 200);
      return EVENT_OVER;
    }

    // Combo and banner timers.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (state.levelBanner > 0) state.levelBanner -= dt;
    if (state.novaFlash > 0) state.novaFlash -= dt;
    if (state.shake > 0) state.shake -= dt;

    // Spawning, faster as the levels climb.
    emberTimer -= dt;
    if (emberTimer <= 0) {
      spawnEmber();
      emberTimer = Math.max(EMBER.spawnMin, EMBER.spawnSeconds - (state.level - 1) * EMBER.spawnPerLevel);
    }
    asteroidTimer -= dt;
    if (asteroidTimer <= 0) {
      spawnAsteroid();
      asteroidTimer = Math.max(ASTEROID.spawnMin, ASTEROID.spawnSeconds - (state.level - 1) * ASTEROID.spawnPerLevel);
    }
    cometTimer -= dt;
    if (cometTimer <= 0) {
      spawnComet();
      cometTimer = Math.max(COMET.spawnMin, COMET.spawnSeconds - (state.level - 1) * COMET.spawnPerLevel);
    }
    powerTimer -= dt;
    if (powerTimer <= 0) {
      spawnPower();
      powerTimer = POWER.spawnSeconds;
    }

    // The magnet pulls embers toward the ship.
    for (const item of state.items) {
      if (!item.active) continue;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.rotation += item.rotSpeed * dt;
      if (item.kind === KIND_EMBER && ship.magnet > 0) {
        const dx = ship.x - item.x;
        const dy = ship.y - item.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < POWER.magnetRadius) {
          item.x += (dx / dist) * 260 * dt;
          item.y += (dy / dist) * 260 * dt;
        }
      }
      if (item.y > FIELD.height + 40 || item.x < -60 || item.x > FIELD.width + 60) item.active = false;
    }

    // Collisions with the ship.
    for (const item of state.items) {
      if (!item.active) continue;
      const dx = item.x - ship.x;
      const dy = item.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (item.kind === KIND_EMBER) {
        if (dist < ship.radius + item.radius + 4) {
          item.active = false;
          collectEmber(item);
          events |= EVENT_PICKUP;
        }
      } else if (item.kind === KIND_POWER) {
        if (dist < ship.radius + item.radius + 4) {
          item.active = false;
          applyPower(item);
          events |= EVENT_PICKUP;
        }
      } else if (dist < ship.radius + item.radius - 4) {
        if (ship.invuln > 0) {
          item.active = false;
          continue;
        }
        events |= hitHazard(item);
        if (events & EVENT_OVER) break;
      }
    }

    // Particles, rings and floating texts age out.
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const r of state.rings) r.life -= dt;
    state.rings = state.rings.filter((r) => r.life > 0);
    for (const f of state.floats) {
      f.y -= 46 * dt;
      f.life -= dt;
    }
    state.floats = state.floats.filter((f) => f.life > 0);
    state.items = state.items.filter((item) => item.active);

    if (state.levelBanner > 0) events |= EVENT_LEVEL;
    return events;
  }

  reset();

  return { state, reset, step, spawnPower };
}
