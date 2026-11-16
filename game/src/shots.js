// The screenshot scenes behind ?shot=start|play|surge|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// an autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The play pilot looks well ahead and keeps
// its lives; the end pilot looks only a moment ahead, so it is caught out once
// the rocks speed up, as a hurried player is.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, KIND_ASTEROID, KIND_COMET, KIND_EMBER, KIND_POWER, POWER_MAGNET } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const SURGE_SECONDS = 20;
const END_LIMIT_SECONDS = 600;
const HORIZON_PLAY = 0.7;
const HORIZON_END = 0.22;
const SAMPLE = 1 / 30;
/** Extra room the pilot keeps between the ship and a rock. */
const MARGIN = 14;
/** The 8 directions the pilot tries, plus staying put. */
const DIRECTIONS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

/** Seconds until moving in `dir` runs the ship into a rock; Infinity when it never does. */
function timeToHit(state, dir, horizon) {
  const ship = state.ship;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = Math.min(FIELD.width - ship.radius, Math.max(ship.radius, ship.x + dir.x * 430 * t));
    const y = Math.min(FIELD.height - ship.radius, Math.max(ship.radius, ship.y + dir.y * 430 * t));
    for (const item of state.items) {
      if (!item.active || (item.kind !== KIND_ASTEROID && item.kind !== KIND_COMET)) continue;
      const ix = item.x + item.vx * t;
      const iy = item.y + item.vy * t;
      const dx = ix - x;
      const dy = iy - y;
      if (Math.hypot(dx, dy) < ship.radius + item.radius + MARGIN - 4) return t;
    }
  }
  return Infinity;
}

/**
 * The pilot's choice. It chases the nearest ember (or a power-up, which it
 * values more) and only dodges when a rock is about to hit: among the
 * directions safe for the next moment it takes the one that closes fastest,
 * and when none is safe it takes the one that is hit last. A reckless pilot
 * skips the hazard check and just chases, so it gets caught.
 */
function autopilot(state, horizon, reckless = false) {
  const ship = state.ship;
  let target = null;
  let targetScore = Infinity;
  for (const item of state.items) {
    if (!item.active) continue;
    if (item.kind !== KIND_EMBER && item.kind !== KIND_POWER) continue;
    const dist = Math.hypot(item.x - ship.x, item.y - ship.y);
    const score = item.kind === KIND_POWER ? dist * 0.4 : dist;
    if (score < targetScore) {
      targetScore = score;
      target = item;
    }
  }
  const tx = target === null ? FIELD.width / 2 : target.x;
  const ty = target === null ? FIELD.height * 0.55 : target.y;
  let bestSafe = null;
  let bestSafeClosing = -Infinity;
  let bestAny = DIRECTIONS[0];
  let bestAnyHit = -Infinity;
  // The closing is read over a short lookahead, so the ship does not fly past
  // a nearby ember: a long lookahead overshoots and reads as getting further.
  const LOOK = 0.1;
  for (const dir of DIRECTIONS) {
    const nx = Math.min(FIELD.width - ship.radius, Math.max(ship.radius, ship.x + dir.x * 430 * LOOK));
    const ny = Math.min(FIELD.height - ship.radius, Math.max(ship.radius, ship.y + dir.y * 430 * LOOK));
    const closing = Math.hypot(tx - ship.x, ty - ship.y) - Math.hypot(tx - nx, ty - ny);
    if (reckless) {
      if (closing > bestSafeClosing) {
        bestSafeClosing = closing;
        bestSafe = dir;
      }
      continue;
    }
    const hit = timeToHit(state, dir, horizon);
    if (hit >= 0.35 && closing > bestSafeClosing) {
      bestSafeClosing = closing;
      bestSafe = dir;
    }
    if (hit > bestAnyHit) {
      bestAnyHit = hit;
      bestAny = dir;
    }
  }
  return bestSafe ?? bestAny;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Any other name is the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'surge' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, null, false);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'surge') {
    for (let i = 0; i < SURGE_SECONDS / STEP; i += 1) {
      if (world.step(STEP, autopilot(world.state, HORIZON_PLAY), null, true) & EVENT_OVER) break;
    }
    // Hand the pilot a magnet and a hot combo, then let it play a little more
    // so the ring and the combo bar show in the frame.
    world.state.ship.magnet = 5;
    world.state.combo = 6;
    world.state.comboTimer = 2.2;
    for (let i = 0; i < 1.5 / STEP; i += 1) {
      if (world.step(STEP, autopilot(world.state, HORIZON_PLAY), null, true) & EVENT_OVER) break;
    }
    return { screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  const reckless = name === 'end';
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.step(STEP, autopilot(world.state, horizon, reckless), null, true) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0 || world.state.light <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

/** The magnet power-up's name, for the surge scene's notes. */
export { POWER_MAGNET };
