import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Group, Rect, Circle, RoundedRect, Blur, Paint } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { C, S, R, HIT } from '../theme';
import { useGame, RUNS_PER_DAY, GEM_CAP } from '../store';
import { Screen, Card, Btn, st, buzz, ok, nope } from '../ui';
import {
  newGame, move, stepRocks, stepSnatchers, trySpawn, blast, layerAt,
  COLS, ROWS, EMPTY, DIRT, ROCK, GEM, BIGGEM, HARD,
  type GameState, type Ev,
} from '../game/engine';

const { width: W, height: H } = Dimensions.get('window');
const TILE = Math.floor(W / COLS);
const BOARD_W = TILE * COLS;
const BOARD_H = Math.round(H * 0.60);
const VIS_ROWS = Math.ceil(BOARD_H / TILE) + 2;
/** How far the light reaches, in tiles. The Lantern buys one more. */
const LIGHT = 3.4;
const TICK = 460;

export default function Dig({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<{ gems: number; credited: number; won: boolean } | null>(null);
  const left = RUNS_PER_DAY - g.runsToday;

  if (playing) {
    return (
      <Board
        streak={g.streak} lantern={!!g.worn.lamp} helm={!!g.worn.helm}
        onQuit={(gems, won) => {
          const credited = g.endRun(gems);
          setPlaying(false);
          setResult({ gems, credited, won });
          credited > 0 ? ok() : nope();
        }} />
    );
  }

  return (
    <Screen title="The Dig" sub="Down through six strata. Bring gems back up." onBack={onBack}>
      {result && (
        <Card title={result.won ? 'You reached the Sovereign Vein' : 'Back to the surface'}>
          <Text style={s.bigNum}>◆ {result.credited}</Text>
          <Text style={st.body}>
            {result.credited < result.gems
              ? `You dug up ◆${result.gems}, but the cap for today is ◆${GEM_CAP}. The rest stays in the ground.`
              : result.won
                ? 'All the way down. Nobody does that on their first try.'
                : 'Everything you carried is banked. Nothing is lost by stopping.'}
          </Text>
        </Card>
      )}

      <Card title="How it works">
        <Text style={st.body}>
          Dig down with the arrows. Gems are worth ◆1, big gems ◆5. Rocks fall if you dig underneath
          them, and something down there wants what you are carrying. Three hearts, then you are out —
          but you keep every gem you found.
        </Text>
        <Text style={st.note}>
          Gems buy hats, furniture and better rooms. They can never be bought with money, and money
          can never be bought with them.
        </Text>
      </Card>

      <Card title="Today">
        <View style={s.statRow}>
          <Stat n={String(left)} l={`run${left === 1 ? '' : 's'} left`} />
          <Stat n={`◆${g.gemsToday}`} l={`of ◆${GEM_CAP} cap`} />
          <Stat n={`🔥${g.streak}`} l="day streak" />
          <Stat n={String(Math.max(1, Math.min(5, Math.floor(g.streak / 4))))} l="blasts" />
        </View>
        <Text style={st.note}>
          Five runs a day, and a gem cap. A game a child cannot grind is a game a child can put down.
        </Text>
      </Card>

      <View style={{ marginTop: S.lg }}>
        <Btn label={left > 0 ? 'Go down' : 'Come back tomorrow'} wide disabled={left <= 0}
          onPress={() => { if (g.startRun()) { setResult(null); setPlaying(true); } else nope(); }} />
      </View>
    </Screen>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statL}>{l}</Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE BOARD
 *
 * The engine is pure and lives in game/engine.ts. This draws it and nothing
 * more — which is why the rules could be unit-tested before a single pixel
 * existed.
 * ══════════════════════════════════════════════════════════════════════════ */

function Board({ streak, lantern, helm, onQuit }: {
  streak: number; lantern: boolean; helm: boolean;
  onQuit: (gems: number, won: boolean) => void;
}) {
  const game = useRef<GameState>(newGame(streak));
  if (helm && game.current.hp === 3) game.current.hp = 4;
  const [, force] = useState(0);
  const redraw = useCallback(() => force(x => x + 1), []);
  const [flash, setFlash] = useState(0);

  const light = LIGHT + (lantern ? 1.3 : 0);

  const fire = (evs: Ev[]) => {
    for (const e of evs) {
      if (e.kind === 'gem') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (e.kind === 'biggem') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (e.kind === 'hurt') { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); setFlash(f => f + 1); }
      if (e.kind === 'blast') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  };

  const go = (dc: number, dr: number) => {
    const gm = game.current;
    if (gm.over) return;
    fire(move(gm, dc, dr));
    reveal(gm, light);
    redraw();
    if (gm.over) setTimeout(() => onQuit(gm.gems, gm.won), 620);
  };

  const boom = () => {
    const gm = game.current;
    if (gm.over || gm.blasts <= 0) { nope(); return; }
    fire(blast(gm));
    reveal(gm, light);
    redraw();
  };

  // the world keeps moving whether or not the child does
  useEffect(() => {
    reveal(game.current, light);
    redraw();
    const id = setInterval(() => {
      const gm = game.current;
      if (gm.over) return;
      fire(stepRocks(gm));
      fire(stepSnatchers(gm));
      trySpawn(gm);
      reveal(gm, light);
      redraw();
      if (gm.over) setTimeout(() => onQuit(gm.gems, gm.won), 620);
    }, TICK);
    return () => clearInterval(id);
  }, []);

  const gm = game.current;
  const L = layerAt(gm.py);
  const camRow = Math.max(0, Math.min(ROWS - VIS_ROWS, gm.py - Math.floor(VIS_ROWS * 0.42)));
  const rows: React.ReactNode[] = [];

  for (let r = camRow; r < Math.min(ROWS, camRow + VIS_ROWS); r++) {
    const LR = layerAt(r);
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = c * TILE, y = (r - camRow) * TILE;
      const hid = gm.hidden[i] === 1;
      const t = gm.grid[i];
      const d = Math.hypot(c - gm.px, r - gm.py);
      const lit = Math.max(0, 1 - d / light);

      if (hid) {
        rows.push(<Rect key={`h${i}`} x={x} y={y} width={TILE} height={TILE} color="#04060C" />);
        continue;
      }
      const base = t === EMPTY ? LR.dark
        : t === ROCK ? '#4A4A52'
        : t === HARD ? '#23232A'
        : (c + r) % 2 ? LR.d1 : LR.d2;
      rows.push(<Rect key={`t${i}`} x={x} y={y} width={TILE} height={TILE} color={base} />);

      if (t === GEM || t === BIGGEM) {
        const rad = t === BIGGEM ? TILE * 0.34 : TILE * 0.21;
        rows.push(<Circle key={`g${i}`} cx={x + TILE / 2} cy={y + TILE / 2} r={rad} color={LR.vein} />);
      }
      if (t === ROCK) {
        rows.push(<RoundedRect key={`r${i}`} x={x + 2} y={y + 2} width={TILE - 4} height={TILE - 4}
          r={4} color="#6A6A74" />);
      }
      // the lantern: everything outside its reach falls back into the dark
      if (lit < 1) {
        rows.push(<Rect key={`s${i}`} x={x} y={y} width={TILE} height={TILE}
          color="#04060C" opacity={Math.min(0.88, (1 - lit) * 0.95)} />);
      }
    }
  }

  const px = gm.px * TILE, py = (gm.py - camRow) * TILE;

  return (
    <View style={s.wrap}>
      <View style={s.hud}>
        <Text style={s.layer}>{L.name}</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.hudT}>{'❤️'.repeat(Math.max(0, gm.hp))}</Text>
        <Text style={[s.hudT, { color: C.gold }]}>◆{gm.gems}</Text>
        <Text style={s.hudT}>{gm.depth}m</Text>
      </View>

      <Canvas style={{ width: BOARD_W, height: BOARD_H, alignSelf: 'center' }}>
        <Group>{rows}</Group>
        {/* the warm pool the player carries with them */}
        <Circle cx={px + TILE / 2} cy={py + TILE / 2} r={TILE * light * 0.6} color="#FFD27A" opacity={0.13}>
          <Blur blur={TILE * 0.9} />
        </Circle>
        {gm.snatchers.filter(sn => sn.r >= camRow && sn.r < camRow + VIS_ROWS).map((sn, k) => (
          <Circle key={`sn${k}`} cx={sn.c * TILE + TILE / 2} cy={(sn.r - camRow) * TILE + TILE / 2}
            r={TILE * 0.3} color="#FF4D6D" />
        ))}
        <Circle cx={px + TILE / 2} cy={py + TILE / 2} r={TILE * 0.34} color="#FFE9B0" />
        <Circle cx={px + TILE / 2} cy={py + TILE / 2} r={TILE * 0.19} color="#12203D" />
      </Canvas>

      {flash > 0 && <Hit key={flash} />}

      <View style={s.pad}>
        <View style={s.dpad}>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Key label="▲" a="Up" onPress={() => go(0, -1)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 46 }}>
            <Key label="◀" a="Left" onPress={() => go(-1, 0)} />
            <Key label="▶" a="Right" onPress={() => go(1, 0)} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Key label="▼" a="Down" onPress={() => go(0, 1)} big />
          </View>
        </View>

        <View style={{ gap: S.sm, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Blast, ${gm.blasts} left`}
            onPress={boom} disabled={gm.blasts <= 0}
            style={({ pressed }) => [s.boom, gm.blasts <= 0 && { opacity: 0.35 },
                                     { transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
            <Text style={{ fontSize: 26 }}>💥</Text>
            <Text style={s.boomN}>{gm.blasts}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Climb out and keep your gems"
            onPress={() => { buzz(); onQuit(gm.gems, false); }} style={s.out}>
            <Text style={s.outT}>Climb out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Everything within the lantern's reach stops being a mystery. */
function reveal(g: GameState, light: number) {
  const rad = Math.ceil(light);
  for (let r = Math.max(0, g.py - rad); r <= Math.min(ROWS - 1, g.py + rad); r++)
    for (let c = Math.max(0, g.px - rad); c <= Math.min(COLS - 1, g.px + rad); c++)
      if (Math.hypot(c - g.px, r - g.py) <= light) g.hidden[r * COLS + c] = 0;
}

function Key({ label, a, onPress, big }: { label: string; a: string; onPress: () => void; big?: boolean }) {
  const rep = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (rep.current) { clearInterval(rep.current); rep.current = null; } };
  useEffect(() => stop, []);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a}
      onPressIn={() => { onPress(); stop(); rep.current = setInterval(onPress, 200); }}
      onPressOut={stop}
      style={({ pressed }) => [s.key, big && { backgroundColor: '#204a7a' },
                               { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      <Text style={s.keyT}>{label}</Text>
    </Pressable>
  );
}

function Hit() {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 190); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,60,90,0.30)' }]} />;
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#04060C' },
  hud: { flexDirection: 'row', alignItems: 'center', gap: S.md,
         paddingHorizontal: S.lg, paddingTop: 58, paddingBottom: S.sm },
  layer: { color: C.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  hudT: { color: C.ink, fontSize: 13, fontWeight: '800' },
  pad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
         paddingHorizontal: S.lg },
  dpad: { alignItems: 'center', gap: 6 },
  key: { width: 58, height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
         backgroundColor: '#1D2F5E', borderWidth: 1, borderColor: C.line },
  keyT: { color: C.ink, fontSize: 19, fontWeight: '800' },
  boom: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,122,89,0.18)', borderWidth: 2, borderColor: C.coral },
  boomN: { color: C.coral, fontWeight: '800', fontSize: 11 },
  out: { minHeight: HIT, paddingHorizontal: 16, justifyContent: 'center', borderRadius: R.pill,
         backgroundColor: 'rgba(38,54,96,0.92)' },
  outT: { color: C.ink, fontWeight: '800', fontSize: 12.5 },
  bigNum: { color: C.gold, fontSize: 40, fontWeight: '800', marginBottom: S.sm },
  statRow: { flexDirection: 'row', marginTop: S.sm },
  statN: { color: C.ink, fontSize: 19, fontWeight: '800' },
  statL: { color: C.mist, fontSize: 9.5, marginTop: 2, textAlign: 'center' },
});
