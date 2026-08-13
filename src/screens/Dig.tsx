import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Group, Rect, Circle, RoundedRect, Blur } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { C, S, R, HIT } from '../theme';
import {
  useGame, RUNS_PER_DAY, GEM_CAP, starsTotal, STARS_POSSIBLE, levelsBeaten,
  type LevelReward,
} from '../store';
import { Screen, Card, Btn, st, buzz, ok, nope } from '../ui';
import {
  move, stepRocks, stepSnatchers, trySpawn, blast, layerAt,
  COLS, ROWS, EMPTY, ROCK, GEM, BIGGEM, HARD,
  type GameState, type Ev,
} from '../game/engine';
import {
  LEVELS, LEVEL_COUNT, PER_TIER, TIERS, levelAt, newLevel, gemPar, climbHeight,
  STAR_LABELS,
} from '../game/levels';

const { width: W, height: H } = Dimensions.get('window');
const TILE = Math.floor(W / COLS);
const BOARD_W = TILE * COLS;
const BOARD_H = Math.round(H * 0.60);
const VIS_ROWS = Math.ceil(BOARD_H / TILE) + 2;
/** How far the light reaches, in tiles. The Lantern buys one more. */
const LIGHT = 3.4;
const TICK = 460;

type Finished = {
  level: number; reward: LevelReward; found: number; par: number;
  escaped: boolean; hurt: boolean;
};

/* ══════════════════════════════════════════════════════════════════════════
 * THE LONG CLIMB
 *
 * Thirty levels. You go down, and you climb back out — deeper every time.
 * This screen is the map, the level, and the moment afterwards; the rules all
 * live in game/levels.ts and game/engine.ts, which are pure and were tested
 * before a pixel of this existed.
 * ══════════════════════════════════════════════════════════════════════════ */

export default function Dig({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [playing, setPlaying] = useState<number | null>(null);
  const [done, setDone] = useState<Finished | null>(null);
  const left = RUNS_PER_DAY - g.runsToday;

  const enter = (n: number) => {
    if (!g.startLevel(n)) { nope(); return; }
    setDone(null);
    setPlaying(n);
  };

  if (playing !== null) {
    return (
      <Board
        level={playing} streak={g.streak} lantern={!!g.worn.lamp} helm={!!g.worn.helm}
        onQuit={(o) => {
          const reward = g.endLevel(playing, o);
          setPlaying(null);
          setDone({ level: playing, reward, found: o.gems, par: o.par,
                    escaped: o.escaped, hurt: o.hurt });
          o.escaped ? ok() : buzz();
        }} />
    );
  }

  if (done) return <Result f={done} left={left} onAgain={enter} onMap={() => setDone(null)} />;

  return (
    <Screen title="The Long Climb"
      sub="You go down, and you climb back out. Further every time."
      onBack={onBack}>

      <Card title="Where you are">
        <View style={s.statRow}>
          <Stat n={`${levelsBeaten(g.stars)}/${LEVEL_COUNT}`} l="levels done" />
          <Stat n={`★ ${starsTotal(g.stars)}`} l={`of ${STARS_POSSIBLE}`} />
          <Stat n={String(left)} l={`escape${left === 1 ? '' : 's'} left today`} />
          <Stat n={`◆${g.gemsToday}`} l={`of ◆${GEM_CAP}`} />
        </View>
        <Text style={st.note}>
          Only getting out spends one of the day's five. Trying again after a hard time costs
          nothing and takes nothing away.
        </Text>
      </Card>

      {LEVELS.map(lv => {
        const stars = g.stars[lv.n] ?? 0;
        const locked = lv.n > g.unlocked;
        const isNext = lv.n === g.unlocked;
        const head = (lv.n - 1) % PER_TIER === 0;
        return (
          <View key={lv.n}>
            {head && (
              <View style={s.tierHead}>
                <View style={[s.tierBar, { backgroundColor: layerAt(lv.start).vein }]} />
                <Text style={s.tierT}>{TIERS[lv.tier].teaches}</Text>
              </View>
            )}
            <LevelRow lv={lv} stars={stars} locked={locked} next={isNext}
              canPlay={left > 0} onPress={() => enter(lv.n)} />
          </View>
        );
      })}

      <Card title="How the stars work">
        <Text style={st.body}>
          Every level asks the same three things, so you never have to read to know what is wanted:
          <Text style={{ color: C.gold, fontWeight: '800' }}> get out</Text>, bring treasure home, and
          come home whole.
        </Text>
        <Text style={st.note}>
          Run straight for daylight and you will miss the treasure. Linger for the treasure and you
          risk the third star. That choice is the game.
        </Text>
      </Card>
    </Screen>
  );
}

function LevelRow({ lv, stars, locked, next, canPlay, onPress }: {
  lv: typeof LEVELS[number]; stars: number; locked: boolean; next: boolean;
  canPlay: boolean; onPress: () => void;
}) {
  const L = layerAt(lv.start);
  const label = locked
    ? `Level ${lv.n}, ${lv.name}, locked`
    : `Level ${lv.n}, ${lv.name}, ${climbHeight(lv.n)} metres to climb, ${stars} of 3 stars`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: locked }} disabled={locked}
      onPress={() => { buzz(); onPress(); }}
      style={({ pressed }) => [
        s.lvl, { backgroundColor: locked ? 'rgba(16,26,52,0.55)' : L.d1 },
        next && !locked && { borderColor: C.gold, borderWidth: 2 },
        locked && { opacity: 0.5 },
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}>
      <View style={[s.lvlN, { backgroundColor: locked ? 'rgba(0,0,0,0.35)' : L.dark }]}>
        <Text style={[s.lvlNT, { color: locked ? C.mist : L.vein }]}>{locked ? '🔒' : lv.n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.lvlName}>{lv.name}</Text>
        <Text style={s.lvlSub}>
          {locked ? 'Finish the one before' : `${climbHeight(lv.n)}m to climb · ${L.name.toLowerCase()}`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={s.stars}>
          {[0, 1, 2].map(i => (stars > i ? '★' : '☆')).join('')}
        </Text>
        {next && !locked && (
          <Text style={[s.lvlGo, !canPlay && { color: C.mist }]}>
            {canPlay ? 'NEXT' : 'TOMORROW'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** What happened, in the order a child cares about it. */
function Result({ f, left, onAgain, onMap }: {
  f: Finished; left: number; onAgain: (n: number) => void; onMap: () => void;
}) {
  const lv = levelAt(f.level);
  const got = [f.escaped, f.found >= f.par, !f.hurt];
  const next = Math.min(LEVEL_COUNT, f.level + 1);
  return (
    <Screen title={f.escaped ? 'Daylight' : 'You turned back'}
      sub={`Level ${f.level} · ${lv.name}`} onBack={onMap}>

      <Card title={f.escaped ? (f.reward.improved ? 'A new best' : 'Home again') : 'Still yours'}>
        <Text style={s.starsBig}>
          {[0, 1, 2].map(i => (f.reward.stars > i ? '★' : '☆')).join(' ')}
        </Text>
        {STAR_LABELS.map((t, i) => (
          <Text key={t} style={[st.body, { color: got[i] && f.escaped ? C.teal : C.mist }]}>
            {f.escaped && got[i] ? '✓ ' : '· '}{t}
            {i === 1 ? `  (◆${f.found} of ◆${f.par})` : ''}
          </Text>
        ))}
      </Card>

      <Card title="Brought home">
        <Text style={s.bigNum}>◆ {f.reward.gems}</Text>
        <Text style={st.body}>
          {f.escaped
            ? 'Everything you carried, banked.'
            : `You found ◆${f.found} down there and brought half of it home. A hard time in a cave was never nothing.`}
        </Text>
        {f.reward.capped && (
          <Text style={st.note}>Today's cap is ◆{GEM_CAP}. The rest stays in the rock until tomorrow.</Text>
        )}
        <Text style={st.note}>+{f.reward.xp} XP</Text>
      </Card>

      <View style={{ gap: S.sm, marginTop: S.lg }}>
        {f.escaped && f.level < LEVEL_COUNT && (
          <Btn label={left > 0 ? `Go deeper — level ${next}` : 'Come back tomorrow'}
            wide disabled={left <= 0} onPress={() => onAgain(next)} />
        )}
        {f.escaped && f.level >= LEVEL_COUNT && (
          <Card title="Your Vaultling saw the sky">
            <Text style={st.body}>
              You climbed the whole world and came out the top. That is the last level, and the one
              thing care alone could never do.
            </Text>
          </Card>
        )}
        <Btn label={f.escaped ? 'Try it again for more stars' : 'Try again'} tone="ghost" wide
          onPress={() => onAgain(f.level)} />
        <Btn label="Back to the map" tone="ghost" wide onPress={onMap} />
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

export type QuitInfo = { escaped: boolean; gems: number; hurt: boolean; climbed: number; par: number };

function Board({ level, streak, lantern, helm, onQuit }: {
  level: number; streak: number; lantern: boolean; helm: boolean;
  onQuit: (o: QuitInfo) => void;
}) {
  const game = useRef<GameState | null>(null);
  const par = useRef(0);
  const fullHp = useRef(0);
  if (!game.current) {
    const gm = newLevel(level, streak);
    if (helm) gm.hp += 1;                     // the Helm, bought with gems, not money
    game.current = gm;
    par.current = gemPar(gm);
    fullHp.current = gm.hp;
  }
  const [, force] = useState(0);
  const redraw = useCallback(() => force(x => x + 1), []);
  const [flash, setFlash] = useState(0);
  const light = LIGHT + (lantern ? 1.3 : 0);

  const finish = (gm: GameState, escaped: boolean) => onQuit({
    escaped, gems: gm.gems, hurt: gm.hp < fullHp.current,
    climbed: gm.climb, par: par.current,
  });

  const fire = (evs: Ev[]) => {
    for (const e of evs) {
      if (e.kind === 'gem') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (e.kind === 'biggem') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (e.kind === 'hurt') { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); setFlash(f => f + 1); }
      if (e.kind === 'blast') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  };

  const go = (dc: number, dr: number) => {
    const gm = game.current!;
    if (gm.over) return;
    fire(move(gm, dc, dr));
    reveal(gm, light);
    redraw();
    if (gm.over) setTimeout(() => finish(gm, gm.won), 620);
  };

  const boom = () => {
    const gm = game.current!;
    if (gm.over || gm.blasts <= 0) { nope(); return; }
    fire(blast(gm));
    reveal(gm, light);
    redraw();
  };

  // the world keeps moving whether or not the child does
  useEffect(() => {
    reveal(game.current!, light);
    redraw();
    const id = setInterval(() => {
      const gm = game.current!;
      if (gm.over) return;
      fire(stepRocks(gm));
      fire(stepSnatchers(gm));
      trySpawn(gm);
      reveal(gm, light);
      redraw();
      if (gm.over) setTimeout(() => finish(gm, gm.won), 620);
    }, TICK);
    return () => clearInterval(id);
  }, []);

  const gm = game.current!;
  const lv = levelAt(level);
  const L = layerAt(gm.py);
  const camRow = Math.max(0, Math.min(ROWS - VIS_ROWS, gm.py - Math.floor(VIS_ROWS * 0.58)));
  const rows: React.ReactNode[] = [];

  for (let r = camRow; r < Math.min(ROWS, camRow + VIS_ROWS); r++) {
    const LR = layerAt(r);
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = c * TILE, y = (r - camRow) * TILE;
      const t = gm.grid[i];
      const d = Math.hypot(c - gm.px, r - gm.py);
      const lit = Math.max(0, 1 - d / light);

      if (gm.hidden[i] === 1) {
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
  const toGo = Math.max(0, gm.py - 2);

  return (
    <View style={s.wrap}>
      <View style={s.hud}>
        <Text style={s.layer}>{lv.n}. {lv.name.toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.hudT}>{'❤️'.repeat(Math.max(0, gm.hp))}</Text>
        <Text style={[s.hudT, { color: gm.gems >= par.current ? C.teal : C.gold }]}>
          ◆{gm.gems}/{par.current}
        </Text>
        <Text style={s.hudT}>↑{toGo}m</Text>
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
          <Pressable accessibilityRole="button" accessibilityLabel="Turn back, keeping half your gems"
            onPress={() => { buzz(); finish(gm, false); }} style={s.out}>
            <Text style={s.outT}>Turn back</Text>
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
  layer: { color: C.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
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
  statN: { color: C.ink, fontSize: 18, fontWeight: '800' },
  statL: { color: C.mist, fontSize: 9, marginTop: 2, textAlign: 'center' },

  tierHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm,
              marginTop: S.lg, marginBottom: S.xs },
  tierBar: { width: 3, height: 15, borderRadius: 2 },
  tierT: { color: C.mist, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3, flex: 1 },

  lvl: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 62,
         paddingVertical: S.sm, paddingHorizontal: S.md, marginTop: 6,
         borderRadius: R.md, borderWidth: 1, borderColor: C.line },
  lvlN: { width: 38, height: 38, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  lvlNT: { fontSize: 15, fontWeight: '800' },
  lvlName: { color: C.ink, fontSize: 15, fontWeight: '800' },
  lvlSub: { color: 'rgba(234,240,255,0.62)', fontSize: 10.5, marginTop: 2 },
  stars: { color: C.gold, fontSize: 13, letterSpacing: 1 },
  lvlGo: { color: C.gold, fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
  starsBig: { color: C.gold, fontSize: 34, letterSpacing: 4, marginBottom: S.sm },
});
