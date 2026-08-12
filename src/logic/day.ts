/**
 * Elapsed-time settlement. Pure, dependency-free, and unit-tested — this is
 * the one piece of the app where a bug silently steals a child's streak or
 * their allowance, so it lives away from React and gets its own tests.
 *
 * Called on every foreground. Idempotent within the same minute, never runs
 * backwards, and clamps absurd jumps (device clock changes, restores from a
 * year-old backup) so nothing can be farmed by moving the clock forward.
 */

export type Jar = 'care' | 'fun' | 'grow';

export type Clock = {
  lastSeen: number;
  lastDay: string;
  lastPaid: string;
  need: { happy: number; full: number };
  streak: number;
  allowance: number;
  allowanceDay: number;
  jars: Record<Jar, number>;
  ledger: { id: string; label: string; jar: Jar | 'in'; amount: number; when: string }[];
  runsToday: number;
  gemsToday: number;
};

/** Needs drain slowly enough that a child who checks in once a day is always
 *  able to recover, and fast enough that two days away is visible. Full drains
 *  faster than Happy because hunger is the more legible need for a young
 *  child, and it is the one tied to spending real money on food. */
export const DECAY_PER_HOUR = { happy: 1.1, full: 1.7 };

/** Two days of decay is the most that can ever be applied at once. A child who
 *  comes back after a fortnight should find a sad Vaultling, not a dead one. */
export const MAX_DECAY_HOURS = 48;

export const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayNumber = (t: number) => {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};

/** Whole days between two timestamps, by local calendar date. */
export const daysBetween = (a: number, b: number) => dayNumber(b) - dayNumber(a);

export const round2 = (n: number) => Math.round(n * 100) / 100;

const splitOf = (amount: number) => {
  const care = round2(amount * 0.4);
  const fun = round2(amount * 0.3);
  return { care, fun, grow: round2(amount - care - fun) };
};

/** The most recent occurrence of `weekday` (0=Sun … 6=Sat) at or before `t`. */
export function lastWeekdayOnOrBefore(t: number, weekday: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const delta = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d.getTime();
}

/**
 * Returns the fields that changed, or null if nothing did.
 *
 * Order matters: needs decay over the true elapsed time first, then the day
 * rolls (resetting daily caps and moving the streak), then allowance is paid
 * for any missed pay day. Paying before the roll would let a child open the
 * app on Saturday and get paid twice.
 */
export function tick(s: Clock, now: number): Partial<Clock> | null {
  // First ever run, or a restored backup with no timestamp: adopt now and
  // change nothing else, so a fresh install never starts with a sad creature.
  if (!s.lastSeen) {
    return { lastSeen: now, lastDay: isoDay(now), lastPaid: s.lastPaid || isoDay(now) };
  }
  // Clock moved backwards (timezone change, manual set). Re-anchor, don't punish.
  if (now <= s.lastSeen) {
    return now < s.lastSeen ? { lastSeen: now } : null;
  }

  const out: Partial<Clock> = { lastSeen: now };
  let changed = false;

  // ── needs ──
  const hours = Math.min(MAX_DECAY_HOURS, (now - s.lastSeen) / 3_600_000);
  if (hours >= 0.25) {
    const happy = Math.max(0, round2(s.need.happy - hours * DECAY_PER_HOUR.happy));
    const full  = Math.max(0, round2(s.need.full  - hours * DECAY_PER_HOUR.full));
    if (happy !== s.need.happy || full !== s.need.full) { out.need = { happy, full }; changed = true; }
  }

  // ── day roll ──
  const today = isoDay(now);
  if (today !== s.lastDay) {
    const gap = s.lastDay ? daysBetween(new Date(s.lastDay + 'T12:00:00').getTime(), now) : 1;
    out.lastDay = today;
    out.runsToday = 0;
    out.gemsToday = 0;
    // One day away keeps the streak going and adds to it. Two or more breaks
    // it back to today's single day — never to zero, because zero reads as
    // punishment and the point is to come back.
    out.streak = gap === 1 ? s.streak + 1 : 1;
    changed = true;
  }

  // ── allowance ──
  // Pay for the most recent pay day that has not been paid yet. A child who is
  // away for three weeks gets one payment, not three: allowance is a rhythm,
  // not an accrual, and back-paying would teach the wrong lesson.
  // The id is the pay day itself, and a pay day that is already in the ledger
  // is never paid again. Belt and braces on top of lastPaid: this is money, and
  // two code paths calling tick() in the same instant must not double-pay.
  const payDay = isoDay(lastWeekdayOnOrBefore(now, s.allowanceDay));
  const alreadyPaid = s.ledger.some(e => e.id === 'a' + payDay);
  if (s.allowance > 0 && s.lastPaid !== payDay && payDay <= today && !alreadyPaid) {
    const split = splitOf(s.allowance);
    const jars = out.jars ?? s.jars;
    out.jars = {
      care: round2(jars.care + split.care),
      fun:  round2(jars.fun  + split.fun),
      grow: round2(jars.grow + split.grow),
    };
    out.ledger = [
      { id: 'a' + payDay, label: 'Allowance', jar: 'in' as const, amount: s.allowance, when: 'Pay day' },
      ...s.ledger,
    ].slice(0, 60);
    out.lastPaid = payDay;
    changed = true;
  }

  return changed || out.lastSeen !== s.lastSeen ? out : null;
}

/** Mood the creature should show, derived once so every screen agrees. */
export function moodOf(need: { happy: number; full: number }): 0 | 1 | 2 {
  if (need.full < 35 || need.happy < 30) return 0;
  if (need.happy > 80 && need.full > 60) return 2;
  return 1;
}

export function moodLabel(need: { happy: number; full: number }): string {
  const m = moodOf(need);
  return m === 0 ? (need.full < 35 ? 'Hungry' : 'Lonely') : m === 2 ? 'Radiant' : 'Happy';
}
