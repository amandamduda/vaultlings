/**
 * Elapsed-time settlement. Pure, dependency-free, and unit-tested — this is
 * the one piece of the app where a bug silently steals a child's streak or
 * their allowance, so it lives away from React and gets its own tests.
 *
 * Called on every foreground. Idempotent within the same minute, never runs
 * backwards, and clamps absurd jumps (device clock changes, restores from a
 * year-old backup) so nothing can be farmed by moving the clock forward.
 *
 * NOTHING IN HERE TAKES ANYTHING AWAY FROM THE CHILD.
 *
 * There used to be an hourly decay on the creature's happiness and hunger.
 * It is gone, deliberately and permanently. The product rules are explicit:
 * never punish absence with irreversible loss, no punitive neglect state, and
 * wellbeing is judged over a week rather than by the hour. A meter that falls
 * while a child is at school is a guilt mechanic, and guilt is not what this
 * product sells. Time now only ever rolls the week over, moves the streak, and
 * pays allowance.
 */

export type Jar = 'save' | 'goal' | 'fun';

export type Clock = {
  lastSeen: number;
  lastDay: string;
  lastPaid: string;
  weekStart: string;
  streak: number;
  allowance: number;
  allowanceDay: number;
  jars: Record<Jar, number>;
  ledger: { id: string; label: string; amount: number; when: string }[];
  runsToday: number;
  gemsToday: number;
  bondToday: number;
  careCount: number;
  careDays: string[];
  funSpentWeek: number;
};

/** How many care moments a week counts as looking after your Vaultling well.
 *  Five, so missing a day or two still lands inside a good week. */
export const CARE_TARGET = 5;

export const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayNumber = (t: number) => {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};
export const daysBetween = (a: number, b: number) => dayNumber(b) - dayNumber(a);
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Savings-leaning by design: most of what a grown-up puts in should still be
 *  there at the end of the month. Fun is the smallest slice on purpose. */
export const SPLIT = { save: 0.4, goal: 0.4, fun: 0.2 };
export const splitOf = (amount: number) => {
  const save = round2(amount * SPLIT.save);
  const goal = round2(amount * SPLIT.goal);
  return { save, goal, fun: round2(amount - save - goal) };
};

/** The most recent occurrence of `weekday` (0=Sun … 6=Sat) at or before `t`. */
export function lastWeekdayOnOrBefore(t: number, weekday: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const delta = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d.getTime();
}

/** Monday of the week containing `t`. The care week and the Fun allowance both
 *  reset here, so a child who had a quiet week starts clean rather than behind. */
export const weekOf = (t: number) => isoDay(lastWeekdayOnOrBefore(t, 1));

/**
 * Returns the fields that changed, or null if nothing did.
 *
 * Order matters: the week rolls first, then the day, then allowance is paid for
 * any missed pay day. Paying before the roll would let a child open the app on
 * Saturday and get paid twice.
 */
export function tick(s: Clock, now: number): Partial<Clock> | null {
  // First ever run, or a restored backup with no timestamp: adopt now and
  // change nothing else.
  if (!s.lastSeen) {
    return {
      lastSeen: now, lastDay: isoDay(now), weekStart: weekOf(now),
      lastPaid: s.lastPaid || isoDay(now),
    };
  }
  // Clock moved backwards (timezone change, manual set). Re-anchor, don't punish.
  if (now <= s.lastSeen) return now < s.lastSeen ? { lastSeen: now } : null;

  const out: Partial<Clock> = { lastSeen: now };
  let changed = false;

  // ── week roll ──
  const week = weekOf(now);
  if (week !== s.weekStart) {
    out.weekStart = week;
    out.careCount = 0;
    out.careDays = [];
    out.funSpentWeek = 0;
    changed = true;
  }

  // ── day roll ──
  const today = isoDay(now);
  if (today !== s.lastDay) {
    const gap = s.lastDay ? daysBetween(new Date(s.lastDay + 'T12:00:00').getTime(), now) : 1;
    out.lastDay = today;
    out.runsToday = 0;
    out.gemsToday = 0;
    out.bondToday = 0;
    // One day away keeps the streak going and adds to it. Two or more resets to
    // today's single day — never to zero, because zero reads as punishment and
    // the point is to come back.
    out.streak = gap === 1 ? s.streak + 1 : 1;
    changed = true;
  }

  // ── allowance ──
  // Pay for the most recent pay day that has not been paid yet. A child away for
  // three weeks gets one payment, not three: allowance is a rhythm, not an
  // accrual. The id is the pay day itself and a pay day already in the ledger is
  // never paid twice — belt and braces on top of lastPaid, because this is money.
  const payDay = isoDay(lastWeekdayOnOrBefore(now, s.allowanceDay));
  const alreadyPaid = s.ledger.some(e => e.id === 'a' + payDay);
  if (s.allowance > 0 && s.lastPaid !== payDay && payDay <= today && !alreadyPaid) {
    const split = splitOf(s.allowance);
    const jars = out.jars ?? s.jars;
    out.jars = {
      save: round2(jars.save + split.save),
      goal: round2(jars.goal + split.goal),
      fun:  round2(jars.fun  + split.fun),
    };
    out.ledger = [
      { id: 'a' + payDay, label: 'Allowance', amount: s.allowance, when: 'Pay day' },
      ...s.ledger,
    ].slice(0, 60);
    out.lastPaid = payDay;
    changed = true;
  }

  return changed || out.lastSeen !== s.lastSeen ? out : null;
}

/** How the week is going, 0..1. Only ever counts up; a quiet week is a quiet
 *  week, not a failure. */
export const wellbeing = (careCount: number) => Math.min(1, careCount / CARE_TARGET);

export function wellbeingLabel(careCount: number): string {
  const n = careCount;
  if (n === 0) return 'Waiting for you';
  if (n < CARE_TARGET) return `${n} of ${CARE_TARGET} this week`;
  return 'Cared for this week';
}
