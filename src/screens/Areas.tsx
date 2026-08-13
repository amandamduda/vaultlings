import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { ART } from '../art';
import {
  C, S, R, HABITATS, WEAR, DECOR, REAL, REAL_LIVE, STAGES, money, type SpeciesKey,
} from '../theme';
import { useGame, jarTotal, split, stageOf, levelProgress, type Jar } from '../store';
import { Screen, Card, Row, Btn, Stepper, Switch, ParentGate, st, buzz, ok, nope, type GateReq } from '../ui';

/* ══════════════════════════════════════════════════════════════════════════
 * MY JARS
 *
 * Three jars, one rule: moving money between them never changes the total.
 * The child can see that in the header, which does not move while they drag
 * dollars around underneath it.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The three buckets from the economy spec. Keeping all three visible is the
 *  point: the child sees a tradeoff rather than one opaque balance. */
const JARS: { k: Jar; n: string; e: string; blurb: string; color: string }[] = [
  { k: 'save', n: 'Savings', e: '🏦', blurb: 'Money that stays put', color: C.teal },
  { k: 'goal', n: 'Goals',   e: '🎯', blurb: 'Money going toward the thing you want', color: C.money },
  { k: 'fun',  n: 'Fun',     e: '🎈', blurb: 'Yours to spend, up to this week\'s limit', color: C.heart },
];

/** Fun spending. Small, real, and capped weekly by a grown-up. */
const TREATS = [
  { n: 'Sticker pack', e: '✨', cost: 1 },
  { n: 'Comic',        e: '📚', cost: 2 },
  { n: 'Ice cream',    e: '🍦', cost: 3 },
];

export function Jars({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [from, setFrom] = useState<Jar>('fun');
  const [to, setTo] = useState<Jar>('save');
  const [amt, setAmt] = useState(0.5);
  const total = jarTotal(g.jars);
  const goalPct = Math.min(100, (g.jars.goal / g.goal.target) * 100);
  const funLeft = Math.max(0, g.funLimit - g.funSpentWeek);

  return (
    <Screen title="My Money" sub={`${money(total)} in three buckets. Nothing here is game money.`} onBack={onBack}>
      <View style={s.jarRow}>
        {JARS.map(j => (
          <View key={j.k} style={s.jar}>
            <Text style={{ fontSize: 26 }}>{j.e}</Text>
            <Text style={[s.jarV, { color: j.color }]}>{money(g.jars[j.k])}</Text>
            <Text style={s.jarN}>{j.n}</Text>
          </View>
        ))}
      </View>

      <Card title="Move money">
        <Text style={st.body}>
          Moving money between jars never makes you richer or poorer. The total stays {money(total)}.
        </Text>
        <View style={s.pickRow}>
          <Picks label="From" value={from} onChange={v => { setFrom(v); if (v === to) setTo(JARS.find(j => j.k !== v)!.k); }} />
          <Text style={s.arrow}>→</Text>
          <Picks label="To" value={to} onChange={v => { setTo(v); if (v === from) setFrom(JARS.find(j => j.k !== v)!.k); }} />
        </View>
        <View style={{ alignItems: 'center', marginTop: S.md }}>
          <Stepper value={amt} max={g.jars[from]} onChange={setAmt} />
        </View>
        <View style={{ marginTop: S.md }}>
          <Btn label={`Move ${money(amt)}`} wide disabled={amt <= 0 || g.jars[from] < amt}
            onPress={() => { g.moveJar(from, to, amt) ? ok() : nope(); setAmt(0); }} />
        </View>
      </Card>

      <Card title="What you are saving for">
        <Row left={g.goal.emoji + '  ' + g.goal.label} sub={`${money(g.jars.goal)} of ${money(g.goal.target)}`}
          right={<Text style={[s.pct, { color: C.money }]}>{Math.round(goalPct)}%</Text>} />
        <View style={s.bed}><View style={[s.fill, { width: `${goalPct}%`, backgroundColor: C.money }]} /></View>
        <Text style={st.note}>
          Every time you move money into Goals this bar gets longer. It is real money, kept for you in
          real life — a grown-up hands it over when you get there.
        </Text>
      </Card>

      <Card title="Fun spending">
        <Text style={st.body}>
          You have {money(funLeft)} of Fun left this week. A grown-up set that limit, and it starts
          again every Monday.
        </Text>
        {TREATS.map(t => {
          const blocked = g.jars.fun < t.cost || funLeft < t.cost;
          return (
            <Row key={t.n} left={`${t.e}  ${t.n}`}
              sub={funLeft < t.cost ? 'Over this week\'s Fun limit' : `${money(t.cost)} from Fun`}
              right={<Btn label={money(t.cost)} disabled={blocked}
                onPress={() => { g.spendFun(t.cost, t.n) ? ok() : nope(); }} />} />
          );
        })}
        <Text style={st.note}>
          Spending Fun money is allowed and normal. It is the only bucket you can spend from, and it
          is meant to run out sometimes.
        </Text>
      </Card>

      <Card title="What happened">
        {g.ledger.slice(0, 8).map(t => (
          <Row key={t.id} left={t.label} sub={t.when}
            right={<Text style={[s.amt, { color: t.amount >= 0 ? C.money : C.mist }]}>
              {t.amount >= 0 ? '+' : '−'}{money(Math.abs(t.amount))}</Text>} />
        ))}
      </Card>
    </Screen>
  );
}

function Picks({ label, value, onChange }: { label: string; value: Jar; onChange: (v: Jar) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.pickL}>{label}</Text>
      <View style={{ gap: 5, marginTop: 5 }}>
        {JARS.map(j => (
          <Pressable key={j.k} accessibilityRole="radio" accessibilityState={{ selected: value === j.k }}
            accessibilityLabel={`${label} ${j.n}`}
            onPress={() => { buzz(); onChange(j.k); }}
            style={[s.pick, value === j.k && { borderColor: C.gold, backgroundColor: 'rgba(255,201,77,0.14)' }]}>
            <Text style={[s.pickT, value === j.k && { color: C.gold }]}>{j.e} {j.n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE MARKET
 *
 * Two currencies that never touch. Gems are earned in the Dig and by
 * answering praise; dollars are real and every dollar path stops at a
 * grown-up. No screen in this app converts one into the other.
 * ══════════════════════════════════════════════════════════════════════════ */

export function Market({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [gate, setGate] = useState<GateReq>(null);
  const species = (g.species ?? 'orin') as SpeciesKey;
  const next = HABITATS[g.habitat + 1];
  const stage = stageOf(g.bond, g.reachedSurface);
  const lvl = levelProgress(g.xp);

  return (
    <>
      <Screen title="The Market" sub={`◆ ${g.gems} gems earned · everything here is bought with gems`} onBack={onBack}>

        <Card title="Your Vaultling">
          {/* Creature progression is the long game — months, not sittings — so it
              needs somewhere the child can see it moving. */}
          <Row left={`${stage.n} · ${g.petName || 'your Vaultling'}`} sub={stage.blurb}
            right={<Text style={[s.amt, { color: C.heart }]}>❤️ {g.bond}</Text>} />
          <View style={s.ladder}>
            {STAGES.map((t, i) => (
              <View key={t.k} style={[s.rung, {
                backgroundColor: STAGES.indexOf(stage) >= i ? C.heart : 'rgba(255,255,255,0.10)' }]} />
            ))}
          </View>
          <Row left={`Level ${lvl.level}`} sub={`${lvl.into} of ${lvl.need} XP to the next one`}
            right={<Text style={[s.amt, { color: C.gold }]}>⭐ {g.xp}</Text>} />
          <Text style={st.note}>
            Bond grows a little each day, however much you play — that is why becoming an Elder takes
            months. It cannot be bought, and it never goes down. The last stage is not on this ladder:
            your Vaultling earns it by reaching the surface.
          </Text>
        </Card>

        <Card title="Your home">
          <Image source={ART[`den-${species}` as 'den-orin']}
            style={{ width: '100%', height: 84, borderRadius: R.md, resizeMode: 'cover' }} />
          <Row left={HABITATS[g.habitat].n} sub={HABITATS[g.habitat].blurb} />
          {next ? (
            <>
              <Row left={`Next: ${next.n}`} sub={next.blurb}
                right={<Text style={[s.amt, { color: g.gems >= next.cost ? C.gold : C.coral }]}>◆{next.cost}</Text>} />
              <View style={{ marginTop: S.sm }}>
                <Btn label={g.gems >= next.cost ? `Move up to ${next.n}` : `Need ◆${next.cost - g.gems} more`}
                  wide disabled={g.gems < next.cost}
                  onPress={() => { g.upgradeHabitat() ? ok() : nope(); }} />
              </View>
            </>
          ) : (
            <Text style={st.body}>Sunspire. There is nowhere higher to go — the next step is the sky.</Text>
          )}
          <View style={s.ladder}>
            {HABITATS.map((d, i) => (
              <View key={d.n} style={[s.rung, { backgroundColor: i <= g.habitat ? d.glow : 'rgba(255,255,255,0.10)' }]} />
            ))}
          </View>
        </Card>

        <Text style={st.aisle}>◆  Earned with gems</Text>
        <View style={st.grid}>
          {WEAR.map(w => (
            <Buyable key={w.k} e={w.e} n={w.n} cost={w.cost} perk={w.perk}
              owned={g.worn[w.k] !== undefined} on={!!g.worn[w.k]} gems={g.gems}
              onPress={() => { g.buyWear(w.k, w.cost) ? ok() : nope(); }} />
          ))}
        </View>

        <Text style={st.aisle}>◆  Decorate this room</Text>
        <View style={st.grid}>
          {DECOR.map(d => (
            <Buyable key={d.k} e={d.e} n={d.n} cost={d.cost} perk={d.perk}
              owned={g.decor[d.k] !== undefined} on={!!g.decor[d.k]} gems={g.gems}
              onPress={() => { g.buyDecor(d.k, d.cost) ? ok() : nope(); }} />
          ))}
        </View>

        <Text style={st.aisle}>$  Real money · preview only</Text>
        <Card>
          <Text style={st.body}>
            {REAL_LIVE
              ? 'These cost real money and need a grown-up every single time.'
              : 'These are a preview of what optional paid cosmetics might look like one day. Nothing '
              + 'here charges anything, and nothing here is for sale yet.'}
          </Text>
          {REAL.map(r => (
            <Row key={r.n} left={`${r.e}  ${r.n}`} sub="Looks only — would change nothing in the game"
              right={<Btn label={r.p} tone="ghost"
                onPress={() => setGate({
                  title: `${r.n} — not for sale yet`,
                  detail: 'Real-money items are switched off while the money side is being built. '
                        + 'Nothing has been charged and no card is on file.',
                  run: () => {},
                })} />} />
          ))}
          <Text style={st.warn}>
            Gems can never be bought with money, and money can never be bought with gems. Nothing in
            the game needs either to progress.
          </Text>
        </Card>
      </Screen>
      <ParentGate req={gate} onClose={() => setGate(null)} />
    </>
  );
}

function Buyable({ e, n, cost, perk, owned, on, gems, onPress }: {
  e: string; n: string; cost: number; perk: string; owned: boolean; on: boolean;
  gems: number; onPress: () => void;
}) {
  const afford = gems >= cost;
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={owned ? `${n}, owned, ${on ? 'on' : 'off'}` : `${n}, ${cost} gems. ${perk}`}
      accessibilityState={{ disabled: !owned && !afford }}
      disabled={!owned && !afford} onPress={onPress}
      style={({ pressed }) => [st.tile,
        on && { borderColor: C.gold, backgroundColor: 'rgba(255,201,77,0.12)' },
        !owned && !afford && { opacity: 0.42 },
        { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Text style={{ fontSize: 24 }}>{e}</Text>
      <Text style={s.tileN}>{n}</Text>
      <Text style={s.tileP} numberOfLines={2}>{perk}</Text>
      <Text style={[s.tileC, { color: owned ? (on ? C.gold : C.mist) : afford ? C.gold : C.coral }]}>
        {owned ? (on ? 'ON' : 'OFF') : `◆${cost}`}
      </Text>
    </Pressable>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * FAMILY
 *
 * Money in a child's life arrives from people. Jobs are set by a grown-up and
 * approved by a grown-up; gifts arrive and get split the moment they land;
 * praise is answered, not just received. Comparing streaks is off by default.
 * ══════════════════════════════════════════════════════════════════════════ */

export function Family({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [gate, setGate] = useState<GateReq>(null);
  const open = g.jobs.filter(j => j.state !== 'paid');
  const prompt = conversationPrompt(g);

  return (
    <>
      <Screen title="Family" sub="Jobs, gifts and the people cheering you on" onBack={onBack}>

        <Card title="Quests a grown-up set">
          {open.length === 0 && <Text style={st.body}>Every job is done and paid. Nice week.</Text>}
          {open.map(j => (
            <Row key={j.id} left={j.label}
              sub={`${money(j.pay)} · ${j.state === 'pending' ? 'waiting for a grown-up' : j.note}`}
              right={j.state === 'open'
                ? <Btn label="I did it" onPress={() => { g.jobDone(j.id) ? ok() : nope(); }} />
                : <Btn label="Approve" tone="teal"
                    onPress={() => setGate({
                      title: `Approve "${j.label}"?`,
                      detail: `${money(j.pay)} splits into the buckets: ${money(split(j.pay).save)} Savings, ${money(split(j.pay).goal)} Goals, ${money(split(j.pay).fun)} Fun.`,
                      run: () => { g.approveJob(j.id); },
                    })} />} />
          ))}
          <Text style={st.note}>
            Saying you did a quest does not pay you. A grown-up has to agree — that is the whole point.
          </Text>
        </Card>

        {g.gifts.some(x => x.state === 'pending') && (
          <Card title="Something arrived">
            {g.gifts.filter(x => x.state === 'pending').map(gift => (
              <Row key={gift.id} left={`${gift.label} from ${gift.from}`}
                sub={`${money(gift.amount)} · splits ${money(split(gift.amount).save)} / ${money(split(gift.amount).goal)} / ${money(split(gift.amount).fun)}`}
                right={<Btn label="Open it" onPress={() => { g.acceptGift(gift.id) ? ok() : nope(); }} />} />
            ))}
          </Card>
        )}

        <Card title="People said things">
          {g.praise.map(p => (
            <Row key={p.id} left={`“${p.text}”`} sub={p.from}
              right={<Btn label={p.loved ? '💛' : 'Love back'} tone={p.loved ? 'ghost' : 'gold'}
                disabled={p.loved} onPress={() => { g.loveBack(p.id) ? ok() : nope(); }} />} />
          ))}
          <Text style={st.note}>Answering someone earns ◆15, once each.</Text>
        </Card>

        <Card title="For a grown-up">
          <Text style={st.body}>{prompt}</Text>
          <Text style={st.note}>
            One thing worth talking about this week. Not a report card — a conversation starter.
          </Text>
        </Card>

        <Card title="Your circle">
          {g.circle.map(m => (
            <Row key={m.n} left={`${m.n} · ${m.role}`}
              sub={g.compare || !m.streak ? m.note : 'Streaks are hidden while comparing is off'}
              right={g.compare && m.streak ? <Text style={s.amt}>🔥{m.streak}</Text> : undefined} />
          ))}
          <Row left="Compare streaks" sub="Off by default. A seven-year-old does not need a leaderboard."
            right={<Switch on={g.compare} label="Compare streaks"
              onToggle={() => setGate({
                title: g.compare ? 'Turn comparing off?' : 'Turn comparing on?',
                detail: 'This shows other children’s streaks next to your own.',
                run: () => g.setCompare(!g.compare),
              })} />} />
        </Card>
      </Screen>
      <ParentGate req={gate} onClose={() => setGate(null)} />
    </>
  );
}

const s = StyleSheet.create({
  jarRow: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  jar: { flex: 1, alignItems: 'center', paddingVertical: S.lg, borderRadius: R.lg,
         backgroundColor: 'rgba(10,17,36,0.72)', borderWidth: 1, borderColor: C.line },
  jarV: { fontSize: 17, fontWeight: '800', marginTop: 5 },
  jarN: { color: C.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 2 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.md },
  pickL: { color: C.mist, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
  pick: { paddingVertical: 9, paddingHorizontal: 9, borderRadius: R.sm,
          borderWidth: 1.5, borderColor: C.line, backgroundColor: 'rgba(16,27,56,0.7)' },
  pickT: { color: C.ink, fontSize: 12, fontWeight: '700' },
  arrow: { color: C.mist, fontSize: 17, marginTop: 18 },
  bed: { height: 9, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.10)',
         overflow: 'hidden', marginTop: S.sm },
  fill: { height: '100%', borderRadius: R.pill },
  pct: { fontWeight: '800', fontSize: 14 },
  amt: { color: C.ink, fontWeight: '800', fontSize: 12.5 },
  ladder: { flexDirection: 'row', gap: 3, marginTop: S.md },
  rung: { flex: 1, height: 5, borderRadius: 3 },
  tileN: { color: C.ink, fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  tileP: { color: C.mist, fontSize: 8.5, lineHeight: 11, textAlign: 'center', marginTop: 2 },
  tileC: { fontSize: 11, fontWeight: '800', marginTop: 4 },
});


/**
 * A prompt for the grown-up.
 *
 * From the parent doc: raise these when there is something worth talking about,
 * never because the child 'failed'. Every branch below is either a celebration
 * or a neutral observation — none of them is a complaint.
 */
function conversationPrompt(g: ReturnType<typeof useGame.getState>): string {
  const total = jarTotal(g.jars);
  const goalPct = g.goal.target ? g.jars.goal / g.goal.target : 0;
  if (goalPct >= 1) return `They reached their ${g.goal.label} goal. Celebrate it, and ask what they want to work toward next.`;
  if (g.funSpentWeek >= g.funLimit && g.funLimit > 0) return 'They spent all of their Fun money this week. Ask how they feel about what they chose.';
  if (goalPct >= 0.5) return `They are over halfway to ${g.goal.label}. Ask what they are picturing when they get there.`;
  if (g.careCount >= 5) return `They have looked after ${g.petName || 'their Vaultling'} every day this week. Ask what it has learned to do.`;
  if (g.jars.save > total * 0.5) return 'Most of their money is sitting in Savings. Ask what they are keeping it for.';
  if (g.streak >= 7) return `${g.streak} days in a row. Ask them to show you how far they have climbed.`;
  return 'Ask what they are saving for, and why that one.';
}
