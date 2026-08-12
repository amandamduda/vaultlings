import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tick, type Clock } from './logic/day';
import { DWELLINGS, type SpeciesKey } from './theme';

export type Jar = 'care' | 'fun' | 'grow';
export type Txn = { id: string; label: string; amount: number; when: string };
export type Job = { id: string; label: string; note: string; pay: number; state: 'open' | 'pending' | 'paid' };
export type Praise = { id: string; from: string; text: string; loved: boolean };
export type Gift = { id: string; from: string; label: string; amount: number; state: 'pending' | 'accepted' };
export type Member = { n: string; role: string; pet?: string; streak?: number; note: string };
export type Goal = { label: string; emoji: string; target: number };

export const RUNS_PER_DAY = 5;
export const GEM_CAP = 60;
export const FEED_COST = 3;

export const r2 = (n: number) => Math.round(n * 100) / 100;
/** The default 40 / 30 / 30 split. Care first because the creature depends on
 *  it; Grow last but never zero, so saving is always visible. */
export const split = (a: number) => {
  const care = r2(a * 0.4), fun = r2(a * 0.3);
  return { care, fun, grow: r2(a - care - fun) };
};

type Persisted = {
  v: number;
  onboarded: boolean; kidName: string; age: number | null;
  petName: string; species: SpeciesKey | null;
  gems: number; streak: number; happy: number; full: number; dwelling: number;
  lastSeen: number; lastDay: string; lastPaid: string;
  allowance: number; allowanceDay: number;
  jars: Record<Jar, number>; savings: number; goal: Goal; ledger: Txn[];
  worn: Record<string, boolean>; decor: Record<string, boolean>;
  jobs: Job[]; praise: Praise[]; gifts: Gift[]; circle: Member[];
  compare: boolean; seen: Record<string, boolean>;
  runsToday: number; gemsToday: number;
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
  { n: 'Mom', role: 'Grown-up', note: 'Sets your jobs and approves things' },
  { n: 'Dad', role: 'Grown-up', note: 'Cheered you on twice this week' },
  { n: 'Grandma Rose', role: 'Tribe', note: 'Sends the most praise of anyone' },
  { n: 'Tucker', role: 'Brother', pet: 'Pebble', streak: 4, note: 'Pebble is a Geode Vaultling at Mossy Alcove' },
  { n: 'Ada', role: 'Cousin', pet: 'Wisp', streak: 9, note: 'Wisp just reached Crystal Pocket' },
];

const initial: Persisted = {
  v: 3,
  onboarded: false, kidName: '', age: null, petName: '', species: null,
  gems: 86, streak: 12, happy: 88, full: 64, dwelling: 1,
  lastSeen: 0, lastDay: '', lastPaid: '',
  allowance: 5, allowanceDay: 6,
  jars: { care: 2, fun: 1, grow: 2 }, savings: 47.5,
  goal: { label: 'Headphones', emoji: '🎧', target: 80 },
  ledger: [
    { id: 't1', label: 'Allowance from Mom', amount: 5, when: 'Sat' },
    { id: 't2', label: 'Sky Berries', amount: -2, when: 'Sat' },
    { id: 't3', label: 'Sticker pack', amount: -1, when: 'Sun' },
    { id: 't4', label: 'Into the Deep Vault', amount: -2, when: 'Sun' },
  ],
  worn: {}, decor: {},
  jobs: seedJobs(), praise: seedPraise(),
  gifts: [{ id: 'g1', from: 'Grandma Rose', label: 'Birthday gift', amount: 10, state: 'pending' }],
  circle: seedCircle(), compare: false, seen: {},
  runsToday: 0, gemsToday: 0,
};

type Actions = {
  sync: (now?: number) => void;
  setKid: (n: string, a: number | null) => void;
  chooseSpecies: (s: SpeciesKey) => void;
  finish: (petName: string) => void;
  care: (kind: 'feed' | 'pet' | 'wash' | 'toy') => number | null;
  buyWear: (k: string, cost: number) => boolean;
  buyDecor: (k: string, cost: number) => boolean;
  upgradeHome: () => boolean;
  spend: (jar: Jar, amount: number, label: string) => boolean;
  moveJar: (from: Jar, to: Jar, amount: number) => boolean;
  toSavings: (amount: number) => boolean;
  jobDone: (id: string) => boolean;
  approveJob: (id: string) => boolean;
  acceptGift: (id: string) => boolean;
  loveBack: (id: string) => boolean;
  setCompare: (on: boolean) => void;
  markSeen: (k: string) => void;
  startRun: () => boolean;
  endRun: (earned: number) => number;
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
      need: { happy: st.happy, full: st.full },
      streak: st.streak, allowance: st.allowance, allowanceDay: st.allowanceDay,
      jars: st.jars, ledger: st.ledger as any,
      runsToday: st.runsToday, gemsToday: st.gemsToday,
    } as Clock, now);
    if (!next) return;
    const patch: any = { ...next };
    if (next.need) { patch.happy = next.need.happy; patch.full = next.need.full; delete patch.need; }
    set(patch);
  },

  setKid: (n, a) => set({ kidName: n, age: a }),
  chooseSpecies: s => set({ species: s }),
  finish: petName => set({
    petName, onboarded: true,
    lastSeen: Date.now(), lastDay: isoDay(), lastPaid: isoDay(),
  }),

  /** Returns the amount gained, or null when the action was refused. */
  care: kind => {
    const st = get();
    if (kind === 'feed' && st.gems < FEED_COST) return null;
    if (kind === 'feed') { set({ full: Math.min(100, st.full + 12), gems: st.gems - FEED_COST }); return 12; }
    if (kind === 'pet')  { set({ happy: Math.min(100, st.happy + 6) }); return 6; }
    if (kind === 'wash') { set({ happy: Math.min(100, st.happy + 4) }); return 4; }
    const n = st.decor.chest ? 7 : 5;
    set({ happy: Math.min(100, st.happy + n) });
    return n;
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
  upgradeHome: () => {
    const st = get(), next = DWELLINGS[st.dwelling + 1];
    if (!next || st.gems < next.cost) return false;
    set({ gems: st.gems - next.cost, dwelling: st.dwelling + 1 });
    return true;
  },

  spend: (jar, amount, label) => {
    const st = get();
    if (amount <= 0 || st.jars[jar] < amount) return false;
    const patch: any = {
      jars: { ...st.jars, [jar]: r2(st.jars[jar] - amount) },
      ledger: [{ id: rid(), label, amount: -amount, when: 'Today' }, ...st.ledger].slice(0, 40),
    };
    if (label === 'Sky Berries') patch.full = Math.min(100, st.full + 18);
    if (label === 'Tater tots') { patch.full = Math.min(100, st.full + 8); patch.happy = Math.min(100, st.happy + 4); }
    set(patch);
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
  toSavings: amount => {
    const st = get();
    if (amount <= 0 || st.jars.grow < amount) return false;
    set({
      jars: { ...st.jars, grow: r2(st.jars.grow - amount) },
      savings: r2(st.savings + amount),
      ledger: [{ id: rid(), label: 'Into the Deep Vault', amount: -amount, when: 'Today' }, ...st.ledger].slice(0, 40),
    });
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
    const s = split(j.pay);
    set({
      jobs: st.jobs.map(x => x.id === id ? { ...x, state: 'paid' } : x),
      jars: { care: r2(st.jars.care + s.care), fun: r2(st.jars.fun + s.fun), grow: r2(st.jars.grow + s.grow) },
      ledger: [{ id: rid(), label: 'Job: ' + j.label, amount: j.pay, when: 'Today' }, ...st.ledger].slice(0, 40),
    });
    return true;
  },
  acceptGift: id => {
    const st = get(), g = st.gifts.find(x => x.id === id);
    if (!g || g.state !== 'pending') return false;
    const s = split(g.amount);
    set({
      gifts: st.gifts.map(x => x.id === id ? { ...x, state: 'accepted' } : x),
      jars: { care: r2(st.jars.care + s.care), fun: r2(st.jars.fun + s.fun), grow: r2(st.jars.grow + s.grow) },
      ledger: [{ id: rid(), label: g.label, amount: g.amount, when: 'Today' }, ...st.ledger].slice(0, 40),
    });
    return true;
  },
  /** Answering praise pays gems, once per message. Gems are earned, never
   *  bought, and this is one of the few places they come from. */
  loveBack: id => {
    const st = get(), p = st.praise.find(x => x.id === id);
    if (!p || p.loved) return false;
    set({ praise: st.praise.map(x => x.id === id ? { ...x, loved: true } : x), gems: st.gems + 2 });
    return true;
  },
  setCompare: on => set({ compare: on }),
  markSeen: k => set({ seen: { ...get().seen, [k]: true } }),

  startRun: () => {
    const st = get();
    if (st.runsToday >= RUNS_PER_DAY) return false;
    set({ runsToday: st.runsToday + 1 });
    return true;
  },
  /** Returns the gems actually credited. Hitting the cap never voids a run —
   *  the child keeps what the cap allows. */
  endRun: earned => {
    const st = get();
    const credited = Math.max(0, Math.min(earned, Math.max(0, GEM_CAP - st.gemsToday)));
    set({ gems: st.gems + credited, gemsToday: st.gemsToday + credited });
    return credited;
  },

  reset: () => set({ ...initial, jobs: seedJobs(), praise: seedPraise(), circle: seedCircle() }),
}), {
  name: 'vaultlings-v3',
  storage: createJSONStorage(() => AsyncStorage),
  version: 3,
  partialize: (s: State) => {
    const { sync, setKid, chooseSpecies, finish, care, buyWear, buyDecor, upgradeHome,
      spend, moveJar, toSavings, jobDone, approveJob, acceptGift, loveBack, setCompare,
      markSeen, startRun, endRun, reset, ...rest } = s;
    return rest as Persisted;
  },
  migrate: () => ({ ...initial }) as Persisted,   // v1/v2 used a different roster
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

function isoDay(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const jarTotal = (j: Record<Jar, number>) => r2(j.care + j.fun + j.grow);
export const moodOf = (happy: number, full: number): 0 | 1 | 2 =>
  (full < 35 || happy < 30) ? 0 : (happy > 80 && full > 60) ? 2 : 1;
export const moodLabel = (happy: number, full: number) =>
  moodOf(happy, full) === 0 ? (full < 35 ? 'Hungry' : 'Lonely')
  : moodOf(happy, full) === 2 ? 'Radiant' : 'Happy';
