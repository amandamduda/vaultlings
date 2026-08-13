/**
 * THE LONG CLIMB — the campaign.
 *
 * Thirty levels, and the idea behind all of them is one sentence: **you go
 * down, and you climb back out.** Level 1 is a shallow scratch just under the
 * grass. Level 30 drops you at the floor of The Deep and asks you to climb the
 * entire world to get home. The campaign is not thirty caves; it is one journey
 * that gets longer and deeper every time you accept it.
 *
 * Levels are generated rather than hand-placed, but they are not random. Each
 * one carries a **recipe** saying what may exist in it and how much — no
 * boulders at all in level 3, hard stone from 11, snatchers from 16 — and the
 * computer fills the cave inside those rules. The seed comes from the level
 * number, so level 12 is the same cave for every child, every time, forever.
 *
 * Pure and React-free, like the engine it feeds. `scripts/verify-rules.mjs`
 * plays every level with a bot before any build ships.
 */
import {
  COLS, ROWS, SURFACE_ROW, GEM, BIGGEM, ROCK, HARD,
  newWorld, type GameState, type WorldOpts,
} from './engine';

/** Every level asks for the same three things, in the same order, always. A
 *  child should never have to read to know what is wanted. */
export const STAR_LABELS = [
  'You got out',
  'You brought treasure home',
  'You came home whole',
] as const;

export type Tier = {
  teaches: string;
  rockMul: number; sparkMul: number; hard: number;
  snatchMax: number; snatchMul: number;
  hearts: number;
  /** guaranteed blasts, so a child with no streak is never locked out */
  blastFloor: number;
};

/**
 * Six tiers of five. Each introduces exactly one idea and then gives four
 * levels of practice with it, which is how a child learns a rule without being
 * told one.
 *
 * Tiers 1–4 are beatable with zero blasts on purpose. From tier 5 the recipe
 * guarantees a floor, because by then the caves assume you have some. Blasts
 * are otherwise still earned only by real-world streak — one per four days —
 * and nothing in the campaign changes that.
 */
export const TIERS: Tier[] = [
  { teaches: 'Dig upward. Treasure is worth stopping for.',
    rockMul: 0,    sparkMul: 1.6, hard: 0,     snatchMax: 0, snatchMul: 0,    hearts: 3, blastFloor: 0 },
  { teaches: 'Boulders fall. Never stand under one you just freed.',
    rockMul: 0.65, sparkMul: 1.4, hard: 0,     snatchMax: 0, snatchMul: 0,    hearts: 3, blastFloor: 0 },
  { teaches: 'Some stone cannot be dug at all. Go around it.',
    rockMul: 0.8,  sparkMul: 1.25, hard: 0.03, snatchMax: 0, snatchMul: 0,    hearts: 3, blastFloor: 0 },
  { teaches: 'Something else lives down here.',
    rockMul: 0.9,  sparkMul: 1.1, hard: 0.02,  snatchMax: 2, snatchMul: 0.55, hearts: 3, blastFloor: 0 },
  // Depth buys hearts. A hundred-row climb through dense rock will cost you a
  // knock or two however carefully you play, and three hearts across that
  // distance is not difficulty, it is a coin flip.
  { teaches: 'All of it at once. This is what Resolve is for.',
    rockMul: 1,    sparkMul: 1,   hard: 0.02,  snatchMax: 3, snatchMul: 0.8,  hearts: 4, blastFloor: 2 },
  { teaches: 'The Deep. The richest ground there is, and it knows it.',
    rockMul: 1,    sparkMul: 1,   hard: 0.025, snatchMax: 4, snatchMul: 1,    hearts: 5, blastFloor: 3 },
];

export const LEVEL_COUNT = 30;
export const PER_TIER = LEVEL_COUNT / TIERS.length;

/** Names, because "Level 17" is not a place and children remember places. */
const NAMES = [
  'First Light',      'The Shallow Cut',   'Rootmouth',        'Two Steps Down',   'The Green Seam',
  'Loose Ground',     'Stonefall',         'The Rattle',       'Under the Weight', 'Boulder Run',
  'The Iron Vein',    'Blackstone',        'The Locked Way',   'Around the Anvil', 'Hardpan',
  'Something Stirs',  'The Watchers',      'Skitterhole',      'Nest of Eyes',     'The Long Chase',
  'Ember Reach',      'The Burning Seam',  'Crucible',         'All at Once',      'The Gauntlet',
  'Crystal Descent',  'The Singing Dark',  'Deepest Vein',     'The Sovereign',    'The Long Climb',
];

export type Level = {
  n: number;
  name: string;
  tier: number;
  teaches: string;
  /** the row you are dropped at; the climb home is this many rows */
  start: number;
  seed: number;
  opts: WorldOpts;
};

/** Where each level drops you: a smooth ramp from just under the grass to the
 *  floor of the world. The strata fall out of this naturally — the tiers land
 *  on the biomes without either being tuned to the other. */
const startRow = (n: number) =>
  Math.round(20 + ((n - 1) * (ROWS - 2 - 20)) / (LEVEL_COUNT - 1));

/** Fixed and derived from the level number, so a level is the same cave for
 *  every child forever. Odd multiplier keeps consecutive levels unalike. */
export const seedOf = (n: number) => n * 7919 + 104729;

export const LEVELS: Level[] = Array.from({ length: LEVEL_COUNT }, (_, i) => {
  const n = i + 1;
  const ti = Math.min(TIERS.length - 1, Math.floor(i / PER_TIER));
  const t = TIERS[ti];
  const start = startRow(n);
  return {
    n, name: NAMES[i], tier: ti, teaches: t.teaches, start, seed: seedOf(n),
    opts: {
      start,
      rockMul: t.rockMul, sparkMul: t.sparkMul, hard: t.hard,
      snatchMax: t.snatchMax, snatchMul: t.snatchMul,
      hearts: t.hearts, blasts: 0,       // filled in per child, see newLevel
    },
  };
});

export const levelAt = (n: number): Level =>
  LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, n - 1))];

/** The climb home, in rows. This is what the level's length actually is. */
export const climbHeight = (n: number) => levelAt(n).start - SURFACE_ROW;

/**
 * The route home, and the treasure lying on it.
 *
 * Gem par used to be a share of everything in the slab, which sounds fair and
 * is quietly impossible: you dig one tunnel through a cave eleven columns wide,
 * so most of that treasure was never yours to reach. Par is now measured
 * against the corridor you would actually clear — the safest route to daylight
 * plus the tiles you can see and step aside for.
 *
 * A cell is unsafe to stand in if there is a boulder directly above it, since
 * that boulder drops the moment you are underneath. The route prefers safe
 * cells and only accepts unsafe ones when there is no other way through.
 */
export function corridor(g: GameState): { path: number[]; gems: number } {
  const N = COLS * ROWS;
  const at = (c: number, r: number) => g.grid[r * COLS + c];
  const blocked = (c: number, r: number) => at(c, r) === HARD || at(c, r) === ROCK;
  const unsafe = (c: number, r: number) => r > 0 && at(c, r - 1) === ROCK;

  /**
   * Cheapest route home, where the cost of a step is the risk it carries.
   *
   * A safe cell costs nothing and a cell with a boulder overhead costs one, so
   * the route takes the fewest dangerous steps rather than the fewest steps. In
   * dense rock there is often no perfectly safe way up; refusing to plan
   * through risk at all meant falling back to a route that ignored risk
   * completely, which is how a careful player still arrived at the surface with
   * no hearts left. Fewest-risky-steps is what a person actually does.
   *
   * Cost is lexicographic — risk first, then distance — packed into one number
   * so a plain Dijkstra does both at once. Sorting on risk alone was not
   * enough: every risk-free route ties, and the tie can be a route that snakes
   * across the whole cave.
   */
  const RISK = 1 << 14;                       // dwarfs any possible path length
  const search = () => {
    const cost = new Int32Array(N).fill(0x7fffffff);
    const prev = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const from = g.py * COLS + g.px;
    cost[from] = 0;
    // binary heap over (cost, cell); the grid is small enough that this is free
    const heap: number[] = [from];
    const less = (a: number, b: number) => cost[a] < cost[b];
    const push = (v: number) => {
      heap.push(v);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1;
        if (!less(heap[i], heap[p])) break;
        [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) { heap[0] = last;
        let i = 0;
        for (;;) { const l = 2*i+1, r = l+1; let m = i;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } }
      return top;
    };

    let best = -1;
    while (heap.length) {
      const cur = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      const r = (cur / COLS) | 0, c = cur % COLS;
      if (r <= SURFACE_ROW) { best = cur; break; }
      for (const [dc, dr] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const i = nr * COLS + nc;
        if (done[i] || blocked(nc, nr)) continue;
        const w = 1 + (unsafe(nc, nr) && nr > SURFACE_ROW ? RISK : 0);
        if (cost[cur] + w >= cost[i]) continue;
        cost[i] = cost[cur] + w; prev[i] = cur;
        push(i);
      }
    }
    if (best < 0) return [];
    const path: number[] = []; let p = best;
    while (p !== -1) { path.push(p); p = prev[p]; }
    return path;
  };

  const path = search();
  // the tunnel plus what you can see from it and step aside for
  const near = new Set<number>();
  for (const p of path) {
    const r = (p / COLS) | 0, c = p % COLS;
    near.add(p);
    for (const [dc, dr] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) near.add(nr * COLS + nc);
    }
  }
  let gems = 0;
  for (const i of near) {
    const t = g.grid[i];
    if (t === GEM) gems += 1; else if (t === BIGGEM) gems += 5;
  }
  return { path, gems };
}

/**
 * How much treasure counts as bringing some home.
 *
 * Half of what is lying on your route. You cannot get it by running straight
 * home — you have to step aside for it — and stepping aside is what puts the
 * third star at risk. That tension is the entire point of the scoring.
 */
export const GEM_PAR_SHARE = 0.5;
export const gemPar = (g: GameState) =>
  Math.max(3, Math.round(corridor(g).gems * GEM_PAR_SHARE));

/** Blasts are still bought with real-world consistency and nothing else — one
 *  per four days of streak. The tier floor only ever adds. */
export const blastsFor = (n: number, streak: number) =>
  Math.max(TIERS[levelAt(n).tier].blastFloor, Math.min(5, Math.floor(streak / 4)));

/** Build the cave for a level. Deterministic given (level, streak). */
export function newLevel(n: number, streak: number): GameState {
  const lv = levelAt(n);
  return newWorld({ ...lv.opts, blasts: blastsFor(n, streak) }, mulberry(lv.seed));
}

/** Small deterministic PRNG. Same level, same cave, on every device. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Outcome = { escaped: boolean; gems: number; hurt: boolean; par: number };

/**
 * Stars, and they mean the same thing on all thirty levels.
 *
 * Getting out is the level; the other two are the tension. Linger for treasure
 * and you risk coming home hurt, run straight for daylight and you leave the
 * treasure behind. That is the whole risk/reward axis, expressed as two stars
 * instead of a paragraph a child would not read.
 */
export const starsFor = (o: Outcome): 0 | 1 | 2 | 3 => {
  if (!o.escaped) return 0;
  return (1 + (o.gems >= o.par ? 1 : 0) + (o.hurt ? 0 : 1)) as 1 | 2 | 3;
};

/** What a level pays. Escaping brings it all home; a hard time in a cave still
 *  comes home with half, because it was never nothing. */
export const gemsBanked = (gems: number, escaped: boolean) =>
  escaped ? gems : Math.ceil(gems / 2);

/** XP for the attempt. Effort counts even when the climb did not finish. */
export const xpFor = (climbed: number, escaped: boolean) =>
  Math.round(climbed) + (escaped ? 120 : 0);

export const tierOf = (n: number) => TIERS[levelAt(n).tier];
export const isTierStart = (n: number) => (n - 1) % PER_TIER === 0;
