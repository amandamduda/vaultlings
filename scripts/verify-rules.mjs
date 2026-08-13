#!/usr/bin/env node
/**
 * The guard on the two files that can silently hurt a child.
 *
 *   src/logic/day.ts    — streaks, allowance, the week
 *   src/game/engine.ts  — the expedition
 *
 * Both are pure and React-free, so they can be checked without a simulator, a
 * device or a test framework. This script transpiles them with the project's
 * own tsc and asserts the product rules that must never drift — not that the
 * code does what it currently does, but that it does what Vaultlings promises.
 *
 * Run it before every build:   node scripts/verify-rules.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = mkdtempSync(join(tmpdir(), 'vaultlings-rules-'));

let passed = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) { passed++; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── transpile ───────────────────────────────────────────────────────────────
writeFileSync(join(OUT, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'es2022', module: 'es2022', moduleResolution: 'bundler',
    strict: true, skipLibCheck: true, outDir: OUT, rootDir: join(ROOT, 'src'),
  },
  files: [join(ROOT, 'src/logic/day.ts'), join(ROOT, 'src/game/engine.ts'),
          join(ROOT, 'src/game/levels.ts')],
}));
try {
  execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(OUT, 'tsconfig.json')], {
    stdio: 'pipe', cwd: ROOT,
  });
} catch (e) {
  console.error('tsc failed before any rule could be checked:\n' + (e.stdout || e).toString());
  process.exit(1);
}
writeFileSync(join(OUT, 'package.json'), '{"type":"module"}');
// TypeScript emits extensionless relative imports; Node's ESM loader wants the
// extension. Patch the emitted files rather than contorting the source.
for (const f of ['logic/day.js', 'game/engine.js', 'game/levels.js']) {
  const p = join(OUT, f);
  writeFileSync(p, readFileSync(p, 'utf8').replace(
    /(from\s+')(\.[^']*?)(')/g, (m, a, spec, z) => spec.endsWith('.js') ? m : a + spec + '.js' + z));
}
const day = await import(pathToFileURL(join(OUT, 'logic/day.js')).href);
const eng = await import(pathToFileURL(join(OUT, 'game/engine.js')).href);
const lvl = await import(pathToFileURL(join(OUT, 'game/levels.js')).href);

// ── fixtures ────────────────────────────────────────────────────────────────
const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h, 0, 0, 0).getTime();
const clock = (over = {}) => ({
  lastSeen: at(2026, 8, 10), lastDay: '2026-08-10', lastPaid: '2026-08-10',
  weekStart: '2026-08-10', streak: 4, allowance: 5, allowanceDay: 1,
  jars: { save: 0, goal: 0, fun: 0 }, ledger: [],
  runsToday: 3, gemsToday: 90, bondToday: 4, careCount: 2,
  careDays: ['2026-08-10'], funSpentWeek: 1.5, ...over,
});
const total = j => day.round2(j.save + j.goal + j.fun);
/** deterministic PRNG so an expedition assertion can never flake */
const seeded = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

// ═══ MONEY ══════════════════════════════════════════════════════════════════
// A split that loses a cent loses a child's money. It has to be exact.
for (const amount of [0.01, 0.05, 1, 3.33, 5, 7.77, 10, 12.5, 20, 99.99, 100]) {
  const s = day.splitOf(amount);
  ok(`split of ${amount} sums to the cent`, near(total(s), day.round2(amount)),
     `got ${total(s)}, expected ${day.round2(amount)}`);
  ok(`split of ${amount} has no negative jar`, s.save >= 0 && s.goal >= 0 && s.fun >= 0);
}
ok('the split leans to savings', day.SPLIT.save >= day.SPLIT.fun * 2);
ok('the three shares are the whole amount',
   near(day.SPLIT.save + day.SPLIT.goal + day.SPLIT.fun, 1));
ok('Fun is the smallest slice',
   day.SPLIT.fun < day.SPLIT.save && day.SPLIT.fun < day.SPLIT.goal);

// ═══ TIME NEVER TAKES ═══════════════════════════════════════════════════════
// Six weeks away. Nothing may shrink, and the streak may never read zero.
{
  const before = clock({ allowance: 0 });
  const out = day.tick(before, at(2026, 9, 21)) ?? {};
  const after = { ...before, ...out };
  ok('six weeks away: savings do not shrink', after.jars.save >= before.jars.save);
  ok('six weeks away: goals do not shrink',   after.jars.goal >= before.jars.goal);
  ok('six weeks away: fun does not shrink',   after.jars.fun  >= before.jars.fun);
  ok('six weeks away: the streak restarts at 1, never 0', after.streak === 1,
     `streak was ${after.streak}`);
  ok('six weeks away: the ledger is not emptied', after.ledger.length >= before.ledger.length);
}
// day.ts must not even mention the decay it used to have
{
  const src = execFileSync('cat', [join(ROOT, 'src/logic/day.ts')]).toString();
  const body = src.slice(src.indexOf('export type Jar'));
  ok('no hunger decay survives in day.ts', !/\bhunger\b/i.test(body));
  ok('no happiness decay survives in day.ts', !/\bhappiness\b/i.test(body));
}
// Coming back the next day builds the streak; two days away restarts it kindly.
{
  const a = { ...clock(), ...day.tick(clock(), at(2026, 8, 11)) };
  ok('one day away continues the streak', a.streak === 5, `streak was ${a.streak}`);
  const b = { ...clock(), ...day.tick(clock(), at(2026, 8, 13)) };
  ok('three days away restarts at 1, not 0', b.streak === 1, `streak was ${b.streak}`);
}
// A day roll clears the daily caps so tomorrow is a fresh start.
{
  const a = day.tick(clock(), at(2026, 8, 11)) ?? {};
  ok('a new day clears runs', a.runsToday === 0);
  ok('a new day clears the gem cap', a.gemsToday === 0);
  ok('a new day clears the bond cap', a.bondToday === 0);
}
// A week roll clears the care week and the Fun allowance, and only on Monday.
{
  const a = day.tick(clock(), at(2026, 8, 17)) ?? {};   // the following Monday
  ok('a new week clears care count', a.careCount === 0);
  ok('a new week clears the Fun spend', a.funSpentWeek === 0);
  const b = day.tick(clock(), at(2026, 8, 14)) ?? {};   // still the same week
  ok('mid-week does not clear the care week', b.careCount === undefined);
  // Parsed at local noon, the way day.ts itself does it. A bare `new Date('…')`
  // on an ISO day is parsed as UTC midnight, which reads as Sunday for every
  // child west of Greenwich — the exact bug this suite exists to catch.
  ok('the week starts on Monday',
     new Date(day.weekOf(at(2026, 8, 14)) + 'T12:00:00').getDay() === 1,
     `weekOf gave ${day.weekOf(at(2026, 8, 14))}`);
}
{
  // The rule behind that: day.ts must never bare-parse an ISO day string.
  const src = execFileSync('cat', [join(ROOT, 'src/logic/day.ts')]).toString();
  const bare = [...src.matchAll(/new Date\(\s*[A-Za-z0-9_.]*(?:Day|day|weekStart)\b(?!\s*\+\s*'T)/g)];
  ok('day.ts never parses an ISO day without anchoring the time', bare.length === 0,
     `unanchored: ${bare.map(m => m[0]).join(', ')}`);
}

// ═══ ALLOWANCE ══════════════════════════════════════════════════════════════
// This is money. It pays once, and it never pays twice.
{
  const s = clock({ lastPaid: '2026-08-03' });
  const first = day.tick(s, at(2026, 8, 11)) ?? {};
  ok('allowance pays on the pay day', first.ledger?.length === 1);
  ok('allowance credits the full amount', near(total(first.jars), 5));
  const s2 = { ...s, ...first };
  const second = day.tick(s2, at(2026, 8, 11, 18)) ?? {};
  ok('allowance does not pay twice the same day', second.ledger === undefined,
     `a second ledger entry appeared: ${JSON.stringify(second.ledger?.[0])}`);
  const third = day.tick({ ...s2, lastPaid: 'corrupted' }, at(2026, 8, 11, 20)) ?? {};
  ok('a corrupted lastPaid still cannot double-pay', third.ledger === undefined);
}
{
  // Three weeks away is one payment, not three. Allowance is a rhythm.
  const out = day.tick(clock({ lastPaid: '2026-07-20' }), at(2026, 8, 11)) ?? {};
  ok('three weeks away pays once, not three times', out.ledger?.length === 1,
     `ledger got ${out.ledger?.length} entries`);
}
{
  const out = day.tick(clock({ allowance: 0, lastPaid: '2026-07-20' }), at(2026, 8, 11)) ?? {};
  ok('no allowance set means no phantom payment', out.ledger === undefined);
}
{
  // Ledger ids are unique, which is what stopped the duplicate-key crash.
  // Anchored back in July so every one of these Mondays is in the future.
  let s = clock({
    lastSeen: at(2026, 7, 28), lastDay: '2026-07-28',
    lastPaid: '2026-07-27', weekStart: '2026-07-27',
  });
  for (const d of [3, 10, 17, 24]) s = { ...s, ...(day.tick(s, at(2026, 8, d)) ?? {}) };
  const ids = s.ledger.map(e => e.id);
  ok('every ledger id is unique', new Set(ids).size === ids.length,
     `ids: ${ids.join(', ')}`);
  ok('four pay days produce four payments', s.ledger.length === 4);
  ok('four weeks of $5 is $20 in the jars', near(total(s.jars), 20),
     `jars total ${total(s.jars)}`);
}

// ═══ THE CLOCK CANNOT BE FARMED ═════════════════════════════════════════════
{
  const s = clock();
  ok('a clock rolled backwards only re-anchors',
     Object.keys(day.tick(s, at(2026, 8, 1)) ?? {}).join() === 'lastSeen');
  ok('the same instant changes nothing', day.tick(s, s.lastSeen) === null);
  const fresh = day.tick(clock({ lastSeen: 0 }), at(2026, 8, 11)) ?? {};
  ok('a first run adopts now without paying anything', fresh.ledger === undefined);
}

// ═══ WELLBEING IS A WEEK, NOT AN HOUR ═══════════════════════════════════════
{
  ok('wellbeing starts at zero, not at a deficit', day.wellbeing(0) === 0);
  ok('wellbeing is capped at one', day.wellbeing(999) === 1);
  ok('wellbeing only counts up',
     [0, 1, 2, 3, 4, 5, 6].every((n, i, a) => i === 0 || day.wellbeing(n) >= day.wellbeing(a[i - 1])));
  ok('a quiet week reads as waiting, not failing',
     !/fail|bad|poor|neglect|sad/i.test(day.wellbeingLabel(0)),
     `label was "${day.wellbeingLabel(0)}"`);
  ok('a full week reads as cared for', /cared/i.test(day.wellbeingLabel(day.CARE_TARGET)));
  ok('the care target forgives a missed day or two', day.CARE_TARGET <= 5);
}

// ═══ THE EXPEDITION CLIMBS ══════════════════════════════════════════════════
{
  const g = eng.newGame(8, seeded(42));
  ok('you start at the bottom of the world', g.py >= eng.ROWS - 3,
     `started at row ${g.py} of ${eng.ROWS}`);
  ok('you start with climb at zero', g.climb === 0);
  ok('the surface is the top of the world', eng.SURFACE_ROW <= 2);
  ok('the deepest layer is the richest',
     eng.LAYERS.at(-1).spark > eng.LAYERS[0].spark);
  ok('the deepest layer is the most dangerous',
     eng.LAYERS.at(-1).snatch > eng.LAYERS[0].snatch);
  ok('the surface is safe', eng.LAYERS[0].snatch === 0);
}
{
  /**
   * Every world must be winnable.
   *
   * Straight up is deliberately not always open — a rock cannot be pushed
   * vertically, so the climb is a weave rather than a shaft. But hard rock is
   * the only thing a child can never get through, so a route to daylight has to
   * exist over the non-hard tiles of every world we generate. Checked across
   * many seeds, because an unwinnable world is a child stuck forever.
   */
  const reachesDaylight = (g) => {
    const seen = new Uint8Array(eng.COLS * eng.ROWS);
    const q = [[g.px, g.py]];
    seen[g.py * eng.COLS + g.px] = 1;
    while (q.length) {
      const [c, r] = q.shift();
      if (r <= eng.SURFACE_ROW) return true;
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= eng.COLS || nr < 0 || nr >= eng.ROWS) continue;
        const i = nr * eng.COLS + nc;
        if (seen[i] || g.grid[i] === eng.HARD) continue;
        seen[i] = 1; q.push([nc, nr]);
      }
    }
    return false;
  };
  const seeds = Array.from({ length: 30 }, (_, i) => 1000 + i * 37);
  const dead = seeds.filter(s => !reachesDaylight(eng.newGame(8, seeded(s))));
  ok('every generated world has a route to daylight', dead.length === 0,
     `unwinnable seeds: ${dead.join(', ')}`);
}
{
  // The win itself: a clear shaft, walked to the top, ends the run in daylight.
  const g = eng.newGame(8, seeded(7));
  for (let r = 0; r < eng.ROWS; r++) g.grid[r * eng.COLS + g.px] = eng.EMPTY;
  let last = 0, monotonic = true;
  for (let i = 0; i < eng.ROWS + 5 && !g.over; i++) {
    eng.move(g, 0, -1);
    if (g.climb < last) monotonic = false;
    last = g.climb;
  }
  ok('climbing never reduces the climb figure', monotonic);
  ok('reaching the top ends the run in daylight', g.over && g.won,
     `over=${g.over} won=${g.won}, stopped at row ${g.py}`);
  ok('the climb figure reaches nearly the full world', g.climb >= eng.ROWS - 5,
     `climb was ${g.climb}`);
}
{
  // The reason the weave is necessary, stated as a rule so it cannot drift.
  const g = eng.newGame(8, seeded(64));
  const r = g.py - 1;
  g.grid[r * eng.COLS + g.px] = eng.ROCK;
  eng.move(g, 0, -1);
  ok('a rock cannot be pushed straight up', g.py !== r);
  const g2 = eng.newGame(8, seeded(64));
  const c = g2.px + 1;
  g2.grid[g2.py * eng.COLS + c] = eng.ROCK;
  g2.grid[g2.py * eng.COLS + c + 1] = eng.EMPTY;
  eng.move(g2, 1, 0);
  ok('a rock can be pushed sideways out of the way', g2.px === c);
}
{
  // Descending is allowed — that is the risk/reward — but must not score a climb.
  const g = eng.newGame(8, seeded(99));
  const start = g.climb;
  eng.move(g, 0, 1); eng.move(g, 0, 1);
  ok('going back down does not raise the climb figure', g.climb === start);
  ok('going back down does not win', !g.won);
}
{
  const g = eng.newGame(8, seeded(3));
  g.hp = 1;
  eng.hurt(g);
  ok('running out of hearts ends the run as a loss', g.over && !g.won);
  ok('a hit can never take gems below zero', g.gems >= 0);
}
{
  // Snatchers come from above — you are climbing toward them, not fleeing down.
  const g = eng.newGame(8, seeded(11));
  for (let r = g.py - 14; r < g.py; r++)
    for (let c = 0; c < eng.COLS; c++) g.grid[r * eng.COLS + c] = eng.EMPTY;
  let above = 0, below = 0;
  for (let i = 0; i < 40; i++) {
    g.snatchers = [];
    eng.trySpawn(g, seeded(200 + i));
    for (const s of g.snatchers) (s.r < g.py ? above++ : below++);
  }
  ok('snatchers spawn above you, in your path', above > 0 && below === 0,
     `${above} above, ${below} below`);
}
{
  const g = eng.newGame(0, seeded(5));
  ok('a child with no streak still gets at least one blast', g.blasts >= 1);
  const veteran = eng.newGame(40, seeded(5));
  ok('blasts are capped so a long streak is not a cheat code', veteran.blasts <= 5);
  const spent = eng.newGame(8, seeded(5));
  spent.blasts = 0;
  ok('a spent blast cannot be used', eng.blast(spent).length === 0);
}
{
  const g = eng.newGame(8, seeded(21));
  ok('hard rock is impassable',
     (() => { const r = g.py - 1; g.grid[r * eng.COLS + g.px] = eng.HARD;
              eng.move(g, 0, -1); return g.py !== r; })());
}

// ═══ THE CAMPAIGN ═══════════════════════════════════════════════════════════
// Thirty levels a child cannot finish is thirty levels of being told no. Every
// one of them is played here, by a bot, before any build ships.
{
  ok('the campaign is thirty levels', lvl.LEVELS.length === 30);
  ok('every level has a name a child could remember',
     lvl.LEVELS.every(l => l.name && l.name.length > 2));
  ok('levels get longer, never shorter',
     lvl.LEVELS.every((l, i) => i === 0 || l.start > lvl.LEVELS[i - 1].start));
  ok('the first level is a gentle one',
     lvl.LEVELS[0].opts.rockMul === 0 && lvl.LEVELS[0].opts.hard === 0 &&
     lvl.LEVELS[0].opts.snatchMax === 0,
     'level 1 must contain nothing that can hurt a child who has never played');
  ok('the last level starts at the floor of the world',
     lvl.LEVELS.at(-1).start >= eng.ROWS - 3);
  ok('nothing is learned before it is taught',
     lvl.LEVELS.findIndex(l => l.opts.rockMul > 0) <
     lvl.LEVELS.findIndex(l => l.opts.hard > 0) &&
     lvl.LEVELS.findIndex(l => l.opts.hard > 0) <
     lvl.LEVELS.findIndex(l => l.opts.snatchMax > 0));
  ok('the first four tiers need no blasts at all',
     lvl.LEVELS.slice(0, 20).every(l => lvl.TIERS[l.tier].blastFloor === 0),
     'a child with no streak must be able to learn every mechanic');
  ok('the deep hands out blasts so nobody is locked out',
     lvl.LEVELS.slice(20).every(l => lvl.blastsFor(l.n, 0) > 0));
  ok('blasts are still bought with streak alone',
     lvl.blastsFor(1, 40) === 5 && lvl.blastsFor(1, 0) === 0,
     'one per four days, capped at five, and money buys none of it');
}
{
  // Same level, same cave, forever — on every device and every install.
  const a = lvl.newLevel(13, 3), b = lvl.newLevel(13, 3);
  ok('a level is the same cave every time',
     a.grid.every((v, i) => v === b.grid[i]) && a.start === b.start);
  const c = lvl.newLevel(14, 3);
  ok('two levels are not the same cave', !a.grid.every((v, i) => v === c.grid[i]));
  ok('streak changes your blasts and nothing else about the world',
     lvl.newLevel(13, 40).grid.every((v, i) => v === a.grid[i]));
}
{
  /**
   * Play all thirty, twice: once running for daylight, once stopping for
   * treasure. Both must get out; only the second should earn the treasure star.
   */
  const walk = (g, loot) => {
    const K = (c, r) => r * eng.COLS + c;
    let guard = eng.ROWS * 8;
    while (!g.over && guard-- > 0) {
      if (loot) {
        for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1]]) {
          const nc = g.px + dc, nr = g.py + dr;
          if (nc < 0 || nc >= eng.COLS || nr < 1 || nr >= eng.ROWS) continue;
          const t = g.grid[K(nc, nr)];
          if ((t === eng.GEM || t === eng.BIGGEM) && g.grid[K(nc, nr - 1)] !== eng.ROCK) {
            eng.move(g, dc, dr); eng.stepRocks(g);
            if (!g.over) { eng.move(g, -dc, -dr); eng.stepRocks(g); }
            break;
          }
        }
      }
      if (g.over) break;
      const path = lvl.corridor(g).path;
      if (path.length < 2) break;
      const next = path[path.length - 2];
      eng.move(g, Math.sign(next % eng.COLS - g.px), Math.sign(((next / eng.COLS) | 0) - g.py));
      eng.stepRocks(g); eng.stepSnatchers(g, () => 0.5); eng.trySpawn(g, () => 0.99);
    }
    return { escaped: g.won, gems: g.gems, hp: g.hp };
  };

  const stuck = [], short = [], impossible = [];
  let rushEarnsTreasure = 0;
  for (const l of lvl.LEVELS) {
    const par = lvl.gemPar(lvl.newLevel(l.n, 8));
    if (par < 3) impossible.push(l.n);
    const rush = walk(lvl.newLevel(l.n, 8), false);
    const loot = walk(lvl.newLevel(l.n, 8), true);
    if (!rush.escaped || !loot.escaped) stuck.push(l.n);
    if (loot.gems < par) short.push(`L${l.n} got ${loot.gems}, par ${par}`);
    if (rush.gems >= par) rushEarnsTreasure++;
  }
  ok('every level can be escaped', stuck.length === 0, `stuck on: ${stuck.join(', ')}`);
  ok('every level\'s treasure star is reachable', short.length === 0, short.join('; '));
  ok('no level ships an impossible par', impossible.length === 0);
  ok('running straight home does not usually earn the treasure',
     rushEarnsTreasure <= 8,
     `rushing earned it on ${rushEarnsTreasure}/30 — the second star has stopped costing anything`);
}
{
  // Stars mean the same thing on all thirty, and never lie.
  const S = (escaped, gems, hurt, par) => lvl.starsFor({ escaped, gems, hurt, par });
  ok('not getting out is no stars', S(false, 999, false, 10) === 0);
  ok('getting out is always at least one star', S(true, 0, true, 10) === 1);
  ok('treasure adds a star', S(true, 10, true, 10) === 2);
  ok('coming home whole adds a star', S(true, 0, false, 10) === 2);
  ok('all three is three stars', S(true, 10, false, 10) === 3);
  ok('there is no fourth star', S(true, 9999, false, 1) === 3);
  ok('the star labels say what is wanted, in order',
     lvl.STAR_LABELS.length === 3 && /out/i.test(lvl.STAR_LABELS[0]));
}
{
  // Failing costs a child nothing they were carrying.
  ok('a failed climb still comes home with something', lvl.gemsBanked(7, false) === 4);
  ok('a failed climb never comes home with nothing', lvl.gemsBanked(1, false) >= 1);
  ok('escaping always pays at least as much as failing',
     [0, 1, 5, 40, 199].every(n => lvl.gemsBanked(n, true) >= lvl.gemsBanked(n, false)));
  ok('effort counts even when the climb did not finish', lvl.xpFor(30, false) > 0);
  ok('getting out counts for more', lvl.xpFor(30, true) > lvl.xpFor(30, false));
}

// ── report ──────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
const total_ = passed + failures.length;
const where = process.env.VAULTLINGS_TZ ? ` (${process.env.VAULTLINGS_TZ})` : '';
if (failures.length) {
  console.error(`\n  ${failures.length} of ${total_} rules broken${where}:\n`);
  for (const f of failures) console.error(`    ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log(`  ${passed} product rules hold${where}.`);

/**
 * Now do it again in other timezones.
 *
 * Allowance, streaks and the care week are all date arithmetic, and date
 * arithmetic is where money bugs hide. A child in Auckland must get paid on the
 * same Monday as a child in Los Angeles, and neither may lose a streak to a
 * daylight-saving jump. The machine that runs this is usually in one timezone,
 * so the suite runs itself in several.
 */
if (!process.env.VAULTLINGS_TZ) {
  const zones = ['UTC', 'America/Los_Angeles', 'America/New_York',
                 'Europe/London', 'Asia/Kolkata', 'Pacific/Auckland'];
  const broken = [];
  for (const tz of zones) {
    try {
      execFileSync(process.execPath, [import.meta.filename], {
        env: { ...process.env, TZ: tz, VAULTLINGS_TZ: tz }, stdio: 'pipe',
      });
    } catch (e) {
      broken.push(`${tz}\n${(e.stdout || '').toString().trimEnd()}`);
    }
  }
  if (broken.length) {
    console.error(`\n  Rules that hold here but break elsewhere in the world:\n`);
    for (const b of broken) console.error(`    ${b}\n`);
    process.exit(1);
  }
  console.log(`  Holds in all ${zones.length} timezones checked.`);
}
