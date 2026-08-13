import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  tick, isoDay, weekOf, splitOf, round2, wellbeing, wellbeingLabel,
  CARE_TARGET, type Clock, type Jar,
} from './logic/day';
import { HABITATS, STAGES, type SpeciesKey } from './theme';
import { LEVEL_COUNT, starsFor, gemsBanked, xpFor } from './game/levels';

export type { Jar };
export { CARE_TARGET, wellbeing, wellbeingLabel };

export type Txn = { id: string; label: string; amount: number; when: string };
export type Job = { id: string; label: string; note: string; pay: number; state: 'open' | 'pending' | 'paid' };
export type Praise = { id: string; from: string; text: string; loved: boolean };
export type Gift = { id: string; from: string; label: string; amount: number; state: 'pending' | 'accepted' };
export type Member = { n: string; role: string; pet?: string; streak?: number; note: string };
export type Goal = { label: string; emoji: string; target: number };
export type CareKind = 'feed' | 'pet' | 'wash' | 'toy';

/* ── the numbers ───────────────────────────────────────────────────────────
 * Gem prices follow the economy spec: a snack is 10, a toy 30, a habitat
 * decoration 75, a rare cosmetic 100–500. An expedition pays enough for a
 * snack or two, so a decoration is a day or two of play and a rare cosmetic a
 * week. Creature stages are meant to take months, so Bond is capped per day and
 * cannot be rushed by grinding.
 * ────────────────────────────────────────────────────────────────────────── */
export const RUNS_PER_DAY = 5;
export const GEM_CAP = 180;         // per day, across all expeditions
export const SNACK_COST = 10;       // feeding costs gems, per the spec
export const BOND_CAP = 6;          // per day — this is why stages take months
export const XP_PER_CARE = 4;

export const r2 = round2;
export const split = splitOf;

type Persisted = {
  v: number;
  onboarded: boolean; kidName: string; age: number | null;
  petName: string; species: SpeciesKey | null;

  gems: number; xp: number; bond: number; streak: number;
  habitat: number; reachedSurface: boolean;

  /** care is judged over a week, never by the hour */
  careCount: number; careDays: string[]; bondToday: number;

  lastSeen: number; lastDay: string; lastPaid: string; weekStart: string;
  allowance: number; allowanceDay: number;
  /** a grown-up's weekly ceiling on Fun spending */
  funLimit: number; funSpentWeek: number;

  jars: Record<Jar, number>; goal: Goal; ledger: Txn[];
  worn: Record<string, boolean>; decor: Record<string, boolean>;
  jobs: Job[]; praise: Praise[]; gifts: Gift[]; circle: Member[];
  compare: boolean; seen: Record<string, boolean>;
  runsToday: number; gemsToday: number; bestClimb: number;

  /** The Long Climb. `unlocked` is the highest level that may be entered;
   *  `stars` is the best ever earned on each and can only go up. */
  unlocked: number; stars: Record<string, number>;
};

const seedJobs = (): Job[] => [
  { id: 'j1', label: 'Water the plants', note: 'Mom added this on Monday', pay: 1, state: 'open' },
  { id: 'j2', label: 'Fold the laundry', note: 'Worth the most this week', pay: 2, state: 'open' },
  { id: 'j3', label: 'Read 20 minutes',  note: 'A grown-up has to check',  pay: 0.5, state: 'open' },
];
const seedPraise = (): Praise[] => [
  { id: 'p1', from: 'Grandma Rose', text: 'So proud of your streak, sweetheart!', loved: false },
  { id: 'p2', from: 'Dad', text: 'You fixed your jar split all by yourself.', loved: false },
];
const seedCircle = (): Member[] => [
  { n: 'Mom', role: 'Grown-up', note: 'Sets your quests and approves things' },
  { n: 'Dad', role: 'Grown-up', note: 'Cheered you on twice this week' },
  { n: 'Grandma Rose', role: 'Tribe', note: 'Sends the most praise of anyone' },
  { n: 'Tucker', role: 'Brother', pet: 'Pebble', streak: 4, note: 'Pebble is a Geode Vaultling in the Root Hall' },
  { n: 'Ada', role: 'Cousin', pet: 'Wisp', streak: 9, note: 'Wisp just reached the Crystal Pocket' },
];

const initial: Persisted = {
  v: 5,
  onboarded: false, kidName: '', age: null, petName: '', species: null,
  gems: 120, xp: 0, bond: 8, streak: 1,
  habitat: 1, reachedSurface: false,
  careCount: 0, careDays: [], bondToday: 0,
  lastSeen: 0, lastDay: '', lastPaid: '', weekStart: '',
  allowance: 5, allowanceDay: 6,
  funLimit: 5, funSpentWeek: 0,
  jars: { save: 6, goal: 5, fun: 2 },
  goal: { label: 'Headphones', emoji: '🎧', target: 50 },
  ledger: [
    { id: 't1', label: 'Allowance from Mom', amount: 5, when: 'Sat' },
    { id: 't2', label: 'Sticker pack', amount: -1, when: 'Sun' },
  ],
  worn: {}, decor: {},
  jobs: seedJobs(), praise: seedPraise(),
  gifts: [{ id: 'g1', from: 'Grandma Rose', label: 'Birthday gift', amount: 10, state: 'pending' }],
  circle: seedCircle(), compare: false, seen: {},
  runsToday: 0, gemsToday: 0, bestClimb: 0,
  unlocked: 1, stars: {},
};

/** What a care action gives back. Every one of these is a gain — there is no
 *  code path in this app where looking after your Vaultling costs you Bond. */
const CARE_VALUE: Record<CareKind, { bond: number; gems: number }> = {
  feed: { bond: 2, gems: SNACK_COST },
  pet:  { bond: 2, gems: 0 },
  wash: { bond: 1, gems: 0 },
  toy:  { bond: 3, gems: 0 },
};

export type CareResult = { bond: number; xp: number; gems: number; capped: boolean };

export type LevelResult = {
  escaped: boolean; gems: number; hurt: boolean; climbed: number; par: number;
};
export type LevelReward = {
  gems: number; xp: number; stars: number; best: number;
  improved: boolean; capped: boolean;
};

type Actions = {
  sync: (now?: number) => void;
  setKid: (n: string, a: number | null) => void;
  chooseSpecies: (s: SpeciesKey) => void;
  finish: (petName: string) => void;
  care: (kind: CareKind) => CareResult | null;
  buyWear: (k: string, cost: number) => boolean;
  buyDecor: (k: string, cost: number) => boolean;
  upgradeHabitat: () => boolean;
  spendFun: (amount: number, label: string) => boolean;
  moveJar: (from: Jar, to: Jar, amount: number) => boolean;
  jobDone: (id: string) => boolean;
  approveJob: (id: string) => boolean;
  acceptGift: (id: string) => boolean;
  loveBack: (id: string) => boolean;
  setCompare: (on: boolean) => void;
  setFunLimit: (n: number) => void;
  markSeen: (k: string) => void;
  startLevel: (n: number) => boolean;
  endLevel: (n: number, o: LevelResult) => LevelReward;
  reset: () => void;
};
export type State = Persisted & Actions;

const rid = () => Math.random().toString(36).slice(2, 9);

export const useGame = create<State>()(persist((set, get) => ({
  ...initial,

  sync: (now = Date.now()) => {
    const st = get();
    const next = tick({
      lastSeen: st.lastSeen, lastDay: st.lastDay, lastPaid: st.lastPaid,
      weekStart: st.weekStart, streak: st.streak,
      allowance: st.allowance, allowanceDay: st.allowanceDay,
      jars: st.jars, ledger: st.ledger,
      runsToday: st.runsToday, gemsToday: st.gemsToday, bondToday: st.bondToday,
      careCount: st.careCount, careDays: st.careDays, funSpentWeek: st.funSpentWeek,
    } as Clock, now);
    if (next) set(next as any);
  },

  setKid: (n, a) => set({ kidName: n, age: a }),
  chooseSpecies: s => set({ species: s }),
  finish: petName => set({
    petName, onboarded: true,
    lastSeen: Date.now(), lastDay: isoDay(Date.now()),
    lastPaid: isoDay(Date.now()), weekStart: weekOf(Date.now()),
  }),

  /**
   * Look after your Vaultling.
   *
   * Returns what was gained, or null only when a snack cannot be afforded.
   * Bond is capped per day so stages take months rather than an afternoon —
   * hitting the cap still counts the interaction and still plays the animation,
   * it just stops the number moving. Nothing here can ever go down.
   */
  care: kind => {
    const st = get();
    const v = CARE_VALUE[kind];
    if (v.gems > 0 && st.gems < v.gems) return null;

    const room = Math.max(0, BOND_CAP - st.bondToday);
    const bond = Math.min(v.bond, room);
    const today = isoDay(Date.now());

    set({
      gems: st.gems - v.gems,
      bond: st.bond + bond,
      bondToday: st.bondToday + bond,
      xp: st.xp + XP_PER_CARE,
      careCount: st.careCount + 1,
      careDays: st.careDays.includes(today) ? st.careDays : [...st.careDays, today],
    });
    return { bond, xp: XP_PER_CARE, gems: v.gems, capped: bond < v.bond };
  },

  buyWear: (k, cost) => {
    const st = get();
    if (st.worn[k] !== undefined) { set({ worn: { ...st.worn, [k]: !st.worn[k] } }); return true; }
    if (st.gems < cost) return false;
    set({ gems: st.gems - cost, worn: { ...st.worn, [k]: true } });
    return true;
  },
  buyDecor: (k, cost) => {
    const st = get();
    if (st.decor[k] !== undefined) { set({ decor: { ...st.decor, [k]: !st.decor[k] } }); return true; }
    if (st.gems < cost) return false;
    set({ gems: st.gems - cost, decor: { ...st.decor, [k]: true } });
    return true;
  },
  upgradeHabitat: () => {
    const st = get(), next = HABITATS[st.habitat + 1];
    if (!next || st.gems < next.cost) return false;
    set({ gems: st.gems - next.cost, habitat: st.habitat + 1, xp: st.xp + 40 });
    return true;
  },

  /** The only place real money leaves the child's hands, and it stops at the
   *  weekly ceiling a grown-up set. */
  spendFun: (amount, label) => {
    const st = get();
    if (amount <= 0 || st.jars.fun < amount) return false;
    if (st.funSpentWeek + amount > st.funLimit) return false;
    set({
      jars: { ...st.jars, fun: r2(st.jars.fun - amount) },
      funSpentWeek: r2(st.funSpentWeek + amount),
      ledger: [{ id: rid(), label, amount: -amount, when: 'Today' }, ...st.ledger].slice(0, 60),
    });
    return true;
  },

  /** Moving money is never a gain or a loss — the total is unchanged. That is
   *  the entire lesson, turned into an interaction. */
  moveJar: (from, to, amount) => {
    const st = get();
    if (from === to || amount <= 0 || st.jars[from] < amount) return false;
    set({ jars: { ...st.jars, [from]: r2(st.jars[from] - amount), [to]: r2(st.jars[to] + amount) } });
    return true;
  },

  jobDone: id => {
    const st = get(), j = st.jobs.find(x => x.id === id);
    if (!j || j.state !== 'open') return false;
    set({ jobs: st.jobs.map(x => x.id === id ? { ...x, state: 'pending' } : x) });
    return true;
  },
  approveJob: id => {
    const st = get(), j = st.jobs.find(x => x.id === id);
    if (!j || j.state !== 'pending') return false;
    const s = splitOf(j.pay);
    set({
      jobs: st.jobs.map(x => x.id === id ? { ...x, state: 'paid' } : x),
      jars: { save: r2(st.jars.save + s.save), goal: r2(st.jars.goal + s.goal), fun: r2(st.jars.fun + s.fun) },
      ledger: [{ id: rid(), label: 'Quest: ' + j.label, amount: j.pay, when: 'Today' }, ...st.ledger].slice(0, 60),
    });
    return true;
  },
  acceptGift: id => {
    const st = get(), g = st.gifts.find(x => x.id === id);
    if (!g || g.state !== 'pending') return false;
    const s = splitOf(g.amount);
    set({
      gifts: st.gifts.map(x => x.id === id ? { ...x, state: 'accepted' } : x),
      jars: { save: r2(st.jars.save + s.save), goal: r2(st.jars.goal + s.goal), fun: r2(st.jars.fun + s.fun) },
      ledger: [{ id: rid(), label: g.label, amount: g.amount, when: 'Today' }, ...st.ledger].slice(0, 60),
    });
    return true;
  },
  /** Answering someone who cheered you on pays gems, once per message. Gems are
   *  earned, never bought, and this is one of the few places they come from. */
  loveBack: id => {
    const st = get(), p = st.praise.find(x => x.id === id);
    if (!p || p.loved) return false;
    set({ praise: st.praise.map(x => x.id === id ? { ...x, loved: true } : x), gems: st.gems + 15 });
    return true;
  },
  setCompare: on => set({ compare: on }),
  setFunLimit: n => set({ funLimit: Math.max(0, Math.min(50, n)) }),
  markSeen: k => set({ seen: { ...get().seen, [k]: true } }),

  /** May this level be entered? Locked levels and the daily ceiling are the
   *  only two noes, and the ceiling counts escapes, not attempts. */
  startLevel: n => {
    const st = get();
    if (n < 1 || n > LEVEL_COUNT || n > st.unlocked) return false;
    return st.runsToday < RUNS_PER_DAY;
  },

  /**
   * Settle a level.
   *
   * Escaping banks the treasure, opens the next level and spends one of the
   * day's five. A hard time in a cave banks half the treasure, costs nothing,
   * and locks nothing — the child can go straight back in. Stars are the best
   * ever earned and cannot be lost by replaying.
   */
  endLevel: (n, o) => {
    const st = get();
    const raw = gemsBanked(o.gems, o.escaped);
    const credited = Math.max(0, Math.min(raw, Math.max(0, GEM_CAP - st.gemsToday)));
    const xp = xpFor(o.climbed, o.escaped);
    const stars = starsFor({ escaped: o.escaped, gems: o.gems, hurt: o.hurt, par: o.par });
    const was = st.stars[n] ?? 0;
    const best = Math.max(was, stars);

    set({
      gems: st.gems + credited,
      gemsToday: st.gemsToday + credited,
      xp: st.xp + xp,
      bestClimb: Math.max(st.bestClimb, o.climbed),
      runsToday: st.runsToday + (o.escaped ? 1 : 0),
      stars: best !== was ? { ...st.stars, [n]: best } : st.stars,
      unlocked: o.escaped ? Math.max(st.unlocked, Math.min(LEVEL_COUNT, n + 1)) : st.unlocked,
      // The last level is the one that gets your Vaultling out of the cave.
      reachedSurface: st.reachedSurface || (o.escaped && n >= LEVEL_COUNT),
    });
    return { gems: credited, xp, stars, best, improved: best > was, capped: raw > credited };
  },

  reset: () => set({ ...initial, jobs: seedJobs(), praise: seedPraise(), circle: seedCircle() }),
}), {
  // The storage key is historical and must never change again — renaming it
  // orphans every existing save, because `migrate` only ever sees data stored
  // under this exact key. Schema changes go through `version` alone.
  name: 'vaultlings-v4',
  storage: createJSONStorage(() => AsyncStorage),
  version: 5,
  partialize: (s: State) => {
    const {
      sync, setKid, chooseSpecies, finish, care, buyWear, buyDecor, upgradeHabitat,
      spendFun, moveJar, jobDone, approveJob, acceptGift, loveBack, setCompare,
      setFunLimit, markSeen, startLevel, endLevel, reset, ...rest
    } = s;
    return rest as Persisted;
  },
  /**
   * v4 saves keep everything they earned — money, Bond, habitat, cosmetics —
   * and simply start the campaign at level 1. There was no campaign to lose.
   * v1–v3 predate the current economy and are reset.
   */
  migrate: (prev: any, from: number) => {
    if (from === 4 && prev) return { ...initial, ...prev, v: 5, unlocked: 1, stars: {} } as Persisted;
    return { ...initial } as Persisted;
  },
  onRehydrateStorage: () => st => {
    if (!st) return;
    // Heal a ledger that collected a duplicate before the guard existed. Money
    // rows are keyed by id; two rows with one id is a bug we do not carry.
    const seen = new Set<string>();
    const clean = st.ledger.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
    if (clean.length !== st.ledger.length) useGame.setState({ ledger: clean });
    st.sync();
  },
}));

/* ── derived ─────────────────────────────────────────────────────────────── */

export const jarTotal = (j: Record<Jar, number>) => r2(j.save + j.goal + j.fun);

/** XP levels, slow and flat — this is progression, not power. */
export const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
export const levelProgress = (xp: number) => {
  const l = levelOf(xp), lo = (l - 1) ** 2 * 40, hi = l ** 2 * 40;
  return { level: l, into: xp - lo, need: hi - lo, pct: (xp - lo) / Math.max(1, hi - lo) };
};

/** Which stage of its life your Vaultling is in. Bond is capped at six a day,
 *  so this ladder is measured in weeks and months, not sittings. The last rung
 *  cannot be reached by care at all — you have to get it to the surface. */
export const stageOf = (bond: number, reachedSurface: boolean) =>
  reachedSurface
    ? STAGES[STAGES.length - 1]
    : STAGES.slice(0, -1).reduce((a, s) => (bond >= s.at ? s : a), STAGES[0]);

/** How the creature should be drawn. There is no unhappy resting state: a
 *  Vaultling that has not been visited is asleep, not miserable. */
export const moodOf = (careCount: number, bondToday: number): 0 | 1 | 2 =>
  bondToday > 0 ? 2 : careCount > 0 ? 1 : 0;

export const moodLabel = (careCount: number, bondToday: number) =>
  bondToday > 0 ? 'Delighted' : careCount > 0 ? 'Content' : 'Waiting for you';

/* ── the campaign, read back ─────────────────────────────────────────────── */

export const starsTotal = (stars: Record<string, number>) =>
  Object.values(stars).reduce((a, b) => a + b, 0);
export const STARS_POSSIBLE = LEVEL_COUNT * 3;
export const levelsBeaten = (stars: Record<string, number>) =>
  Object.values(stars).filter(s => s > 0).length;
/** The one a child taps by default: the furthest level they have opened. */
export const currentLevel = (unlocked: number) => Math.min(LEVEL_COUNT, unlocked);
