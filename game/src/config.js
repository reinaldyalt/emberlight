// Emberlight — the numbers that tune the game. One place for every constant so the
// balance (drain, speeds, spawn rates, scores) is easy to read and to change.
export const FIELD = { width: 960, height: 640 };
/** The top of the play area, below the HUD strip, so the wisp and its glow never wash out the score text. */
export const PLAY_TOP = 120;
export const STEP = 1 / 60;
export const BEST_KEY = 'emberlight-best';

/** The ship. */
export const SHIP = {
  radius: 14,
  /** Keyboard speed, pixels per second. */
  speed: 430,
  /** How fast the ship eases toward the mouse (1 = instant). */
  mouseEase: 14,
  /** Seconds of mercy after a hit. */
  invulnSeconds: 2,
};

/** The light the ship carries: it drains, and embers refill it. */
export const LIGHT = {
  start: 112,
  max: 132,
  /** Drained per second at level 1, plus this much per level. */
  drainPerSecond: 1.05,
  drainPerLevel: 0.09,
  /** Restored by one ember. */
  emberRestore: 14,
  /** Lost on a hit. */
  hitLoss: 18,
};

/** Lives and the combo. */
export const LIVES = 3;
export const COMBO = {
  /** Seconds between pickups before the chain breaks. */
  windowSeconds: 2.5,
  max: 8,
};

/** An ember: the thing you collect. */
export const EMBER = {
  radius: 9,
  score: 10,
  fallMin: 55,
  fallMax: 95,
  /** Seconds between ember spawns at level 1; shrinks per level. */
  spawnSeconds: 0.72,
  spawnPerLevel: 0.05,
  spawnMin: 0.4,
};

/** A golden ember: rare, bright, worth chasing. */
export const GOLDEN = {
  /** Chance that a spawned ember is golden. */
  chance: 0.08,
  radius: 12,
  score: 50,
  /** Light restored by a golden ember. */
  restore: 22,
};

/** An asteroid: the thing you dodge. */
export const ASTEROID = {
  radiusMin: 16,
  radiusMax: 34,
  /** Small rocks fall fast, big boulders fall slow. */
  fallSmall: [130, 180],
  fallMid: [85, 140],
  fallBig: [60, 100],
  /** Extra fall speed per level. */
  fallPerLevel: 9,
  spawnSeconds: 1.35,
  spawnPerLevel: 0.09,
  spawnMin: 0.62,
};

/** The three rock looks: slate, rust and ash. */
export const ASTEROID_TINTS = [
  { fill: '#454554', stroke: '#7d86a0' },
  { fill: '#5d4238', stroke: '#a8765e' },
  { fill: '#5d534b', stroke: '#8a7f74' },
];

/** A comet: fast, diagonal, rare. */
export const COMET = {
  radius: 12,
  speedMin: 320,
  speedMax: 430,
  /** Seconds between comet spawns at level 1; shrinks per level. */
  spawnSeconds: 7,
  spawnPerLevel: 0.4,
  spawnMin: 3.2,
};

/** Power-ups: shield, magnet, nova. */
export const POWER = {
  radius: 13,
  fallSpeed: 46,
  /** Seconds between power-up spawns. */
  spawnSeconds: 17,
  /** Magnet pulls embers for this long. */
  magnetSeconds: 6,
  /** How far the magnet reaches, in pixels. */
  magnetRadius: 190,
};

/** A level is this many embers. */
export const LEVEL_EMBERS = 15;
/** Score bonus on a level-up, times the new level. */
export const LEVEL_BONUS = 50;
/** Points per hazard cleared by a nova. */
export const NOVA_POINTS = 25;

/** The colours of the game, so the palette lives in one place. */
export const COLORS = {
  ember: '#ffc44d',
  emberCore: '#fff3c4',
  golden: '#ffd94d',
  goldenCore: '#fffbe0',
  asteroid: '#8a7f74',
  asteroidDark: '#5d534b',
  comet: '#9fe8ff',
  shield: '#4de3ff',
  magnet: '#ff5fd0',
  nova: '#ffffff',
  shipCore: '#fff8e0',
  shipGlow: '#ffd76a',
  text: '#f5f1e6',
  dim: '#b9b3a4',
};

/** Below this much light the dark starts to close in and warn the player. */
export const LOW_LIGHT = 28;
