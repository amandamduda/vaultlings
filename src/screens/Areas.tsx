import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { ART } from '../art';
import {
  C, S, R, DWELLINGS, WEAR, DECOR, REAL, SPECIES, money, type SpeciesKey,
} from '../theme';
import { useGame, jarTotal, split, type Jar } from '../store';
import { Screen, Card, Row, Btn, Stepper, Switch, ParentGate, st, buzz, ok, nope, type GateReq } from '../ui';

/* ══════════════════════════════════════════════════════════════════════════
 * MY JARS
 *
 * Three jars, one rule: moving money between them never changes the total.
 * The child can see that in the header, which does not move while they drag
 * dollars around underneath it.
 * ══════════════════════════════════════════════════════════════════════════ */

const JARS: { k: Jar; n: string; e: string; blurb: string; color: string }[] = [
  { k: 'care', n: 'Care',  e: '💚', blurb: 'Food and looking after your Vaultling', color: C.money },
  { k: 'fun',  n: 'Fun',   e: '🎈', blurb: 'Treats, toys, whatever you like',        color: C.heart },
  { k: 'grow', n: 'Grow',  e: '🌱', blurb: 'Goes to the Deep Vault and stays there', color: C.teal },
];

const TREATS = [
  { n: 'Sky Berries', e: '🫐', cost: 2, jar: 'care' as Jar, note: '+18 Full' },
  { n: 'Tater tots',  e: '🥔', cost: 1, jar: 'care' as Jar, note: '+8 Full · +4 Happy' },
  { n: 'Sticker pack', e: '✨', cost: 1, jar: 'fun'  as Jar, note: 'Just because' },
];

export function Jars({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [from, setFrom] = useState<Jar>('fun');
  const [to, setTo] = useState<Jar>('grow');
  const [amt, setAmt] = useState(0.5);
  const [save, setSave] = useState(0.5);
  const total = jarTotal(g.jars);
  const goalPct = Math.min(100, (g.savings / g.goal.target) * 100);

  return (
    <Screen title="My Jars" sub={`${money(total)} split across three jars — plus ${money(g.savings)} locked away`} onBack={onBack}>
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

      <Card title="The Deep Vault">
        <Row left={g.goal.emoji + '  ' + g.goal.label} sub={`${money(g.savings)} of ${money(g.goal.target)}`}
          right={<Text style={[s.pct, { color: C.teal }]}>{Math.round(goalPct)}%</Text>} />
        <View style={s.bed}><View style={[s.fill, { width: `${goalPct}%`, backgroundColor: C.teal }]} /></View>
        <Text style={st.note}>
          Money in the Deep Vault cannot be spent in the app. It is yours in real life — a grown-up
          moves it for you when you get there.
        </Text>
        <View style={{ alignItems: 'center', marginTop: S.md }}>
          <Stepper value={save} max={g.jars.grow} onChange={setSave} />
        </View>
        <View style={{ marginTop: S.md }}>
          <Btn label={`Lock away ${money(save)}`} tone="teal" wide disabled={save <= 0 || g.jars.grow < save}
            onPress={() => { g.toSavings(save) ? ok() : nope(); setSave(0); }} />
        </View>
      </Card>

      <Card title="Spend a little">
        {TREATS.map(t => (
          <Row key={t.n} left={`${t.e}  ${t.n}`} sub={`${money(t.cost)} from ${t.jar} · ${t.note}`}
            right={<Btn label={money(t.cost)} disabled={g.jars[t.jar] < t.cost}
              onPress={() => { g.spend(t.jar, t.cost, t.n) ? ok() : nope(); }} />} />
        ))}
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
  const next = DWELLINGS[g.dwelling + 1];

  return (
    <>
      <Screen title="The Market" sub={`◆ ${g.gems} gems · ${money(jarTotal(g.jars))} real money`} onBack={onBack}>

        <Card title="Your home">
          <Image source={ART[`den-${species}` as 'den-orin']}
            style={{ width: '100%', height: 84, borderRadius: R.md, resizeMode: 'cover' }} />
          <Row left={DWELLINGS[g.dwelling].n} sub={DWELLINGS[g.dwelling].blurb} />
          {next ? (
            <>
              <Row left={`Next: ${next.n}`} sub={next.blurb}
                right={<Text style={[s.amt, { color: g.gems >= next.cost ? C.gold : C.coral }]}>◆{next.cost}</Text>} />
              <View style={{ marginTop: S.sm }}>
                <Btn label={g.gems >= next.cost ? `Move up to ${next.n}` : `Need ◆${next.cost - g.gems} more`}
                  wide disabled={g.gems < next.cost}
                  onPress={() => { g.upgradeHome() ? ok() : nope(); }} />
              </View>
            </>
          ) : (
            <Text style={st.body}>Sunspire. There is nowhere higher to go.</Text>
          )}
          <View style={s.ladder}>
            {DWELLINGS.map((d, i) => (
              <View key={d.n} style={[s.rung, { backgroundColor: i <= g.dwelling ? d.glow : 'rgba(255,255,255,0.10)' }]} />
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

        <Text style={st.aisle}>$  Real money · asks a grown-up</Text>
        <Card>
          <Text style={st.body}>
            These cost real money from a card, not from your jars and not with gems. A grown-up has
            to say yes every single time.
          </Text>
          {REAL.map(r => (
            <Row key={r.n} left={`${r.e}  ${r.n}`} sub="Looks only — changes nothing in the game"
              right={<Btn label={r.p} tone="ghost"
                onPress={() => setGate({
                  title: `Buy ${r.n}?`,
                  detail: `${r.p} from the card on file. This is a look, not an advantage.`,
                  run: () => {},
                })} />} />
          ))}
          <Text style={st.warn}>Nothing here can be bought with your jars, and gems can never be bought.</Text>
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

  return (
    <>
      <Screen title="Family" sub="Jobs, gifts and the people cheering you on" onBack={onBack}>

        <Card title="Jobs a grown-up set">
          {open.length === 0 && <Text style={st.body}>Every job is done and paid. Nice week.</Text>}
          {open.map(j => (
            <Row key={j.id} left={j.label}
              sub={`${money(j.pay)} · ${j.state === 'pending' ? 'waiting for a grown-up' : j.note}`}
              right={j.state === 'open'
                ? <Btn label="I did it" onPress={() => { g.jobDone(j.id) ? ok() : nope(); }} />
                : <Btn label="Approve" tone="teal"
                    onPress={() => setGate({
                      title: `Approve "${j.label}"?`,
                      detail: `${money(j.pay)} goes straight into the jars: ${money(split(j.pay).care)} Care, ${money(split(j.pay).fun)} Fun, ${money(split(j.pay).grow)} Grow.`,
                      run: () => { g.approveJob(j.id); },
                    })} />} />
          ))}
          <Text style={st.note}>
            Saying you did a job does not pay you. A grown-up has to agree — that is the whole point.
          </Text>
        </Card>

        {g.gifts.some(x => x.state === 'pending') && (
          <Card title="Something arrived">
            {g.gifts.filter(x => x.state === 'pending').map(gift => (
              <Row key={gift.id} left={`${gift.label} from ${gift.from}`}
                sub={`${money(gift.amount)} · splits ${money(split(gift.amount).care)} / ${money(split(gift.amount).fun)} / ${money(split(gift.amount).grow)}`}
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
          <Text style={st.note}>Answering someone earns ◆2, once each.</Text>
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
