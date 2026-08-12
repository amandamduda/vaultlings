import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Dimensions, ScrollView,
  AccessibilityInfo, AppState, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DeviceMotion } from 'expo-sensors';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
  Easing, cancelAnimation, withSpring,
} from 'react-native-reanimated';
import { den as denArt } from '../art';
import {
  C, S, R, HIT, SPECIES, DWELLINGS, AREAS, STATIONS, DEN_ASPECT,
  NEST, BAND_H, BAND_BOTTOM, HOME_STATION, money,
  type AreaKey, type SpeciesKey,
} from '../theme';
import { useGame, moodOf, moodLabel, jarTotal, FEED_COST } from '../store';
import Creature, { Particles, FloatText, type CreatureHandle, type ActKind } from '../Creature';
import { buzz, nope, st } from '../ui';

const { width: W, height: H } = Dimensions.get('window');

const BAND = Math.round(H * BAND_H);
const BAND_TOP = Math.round(H * BAND_BOTTOM) - BAND;

/** How far the room slides when the phone is tilted. Small on purpose — this
 *  is a peek into the room, not a second control scheme. */
const TILT_BAND = 24;
const TILT_BACK = 40;
const TILT_CREATURE = 9;

/** Cheer is a reward the game plays, not a button — so the dock is a strict
 *  subset of what the creature knows how to perform. */
type CareKind = Extract<ActKind, 'feed' | 'pet' | 'wash' | 'toy'>;
type CareDef = { k: CareKind; icon: string; label: string; cost?: number };
const CARE: CareDef[] = [
  { k: 'feed', icon: '🍎', label: 'Feed', cost: FEED_COST },
  { k: 'pet',  icon: '🤚', label: 'Pet' },
  { k: 'wash', icon: '🫧', label: 'Wash' },
  { k: 'toy',  icon: '🪀', label: 'Play' },
];

export default function Den({ onEnter, initialStation = HOME_STATION }: {
  onEnter: (k: AreaKey) => void; initialStation?: number;
}) {
  const g = useGame();
  const species = (g.species ?? 'orin') as SpeciesKey;
  const sp = SPECIES[species];
  const dw = DWELLINGS[Math.max(0, Math.min(DWELLINGS.length - 1, g.dwelling))];

  const panoW = Math.round(BAND * DEN_ASPECT[species]);
  const maxScroll = Math.max(0, panoW - W);
  /** The backdrop is the same painting at 3.2x, so it stays undistorted and
   *  the blur has real shapes to work with. It tracks the camera at a slower
   *  rate, which is what makes the room feel like it has depth. */
  const backW = Math.round(H * 1.36 * DEN_ASPECT[species]);
  const offsets = useMemo(
    () => STATIONS.map(s => Math.max(0, Math.min(maxScroll, Math.round(s.x * panoW - W / 2)))),
    [panoW, maxScroll]);

  const scroller = useRef<ScrollView>(null);
  const [station, setStation] = useState(initialStation);
  const [scrollX, setScrollX] = useState(offsets[initialStation]);

  const creature = useRef<CreatureHandle>(null);
  const [fx, setFx] = useState<{ seq: number; kind: ActKind; text: string; color: string }>(
    { seq: 0, kind: 'pet', text: '', color: C.gold });

  const tilt = useSharedValue(0);

  // keep the clock honest whenever the app comes back to the foreground
  useEffect(() => {
    g.sync();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') useGame.getState().sync(); });
    return () => sub.remove();
  }, []);

  // ── the tilt-to-peek parallax ────────────────────────────────────────────
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (reduce || cancelled) return;
      const has = await DeviceMotion.isAvailableAsync().catch(() => false);
      if (!has || cancelled) return;

      DeviceMotion.setUpdateInterval(60);
      let smooth = 0;
      sub = DeviceMotion.addListener(d => {
        // gamma is the left/right roll of the device, in radians
        const raw = d?.rotation?.gamma ?? 0;
        const clamped = Math.max(-0.55, Math.min(0.55, raw)) / 0.55;
        smooth = smooth * 0.86 + clamped * 0.14;      // low-pass, or it jitters
        tilt.value = withTiming(smooth, { duration: 90, easing: Easing.linear });
      });
    })();

    return () => { cancelled = true; sub?.remove(); };
  }, []);

  const bandTilt = useAnimatedStyle(() => ({ transform: [{ translateX: tilt.value * TILT_BAND }] }));
  const backTilt = useAnimatedStyle(() => ({ transform: [{ translateX: -tilt.value * TILT_BACK }] }));
  const creatureTilt = useAnimatedStyle(() => ({ transform: [{ translateX: tilt.value * TILT_CREATURE }] }));

  // ── care ─────────────────────────────────────────────────────────────────
  const doCare = (c: CareDef) => {
    const gained = g.care(c.k);
    if (gained == null) { nope(); return; }
    buzz();
    creature.current?.play(c.k);
    setFx(f => ({
      seq: f.seq + 1, kind: c.k,
      text: c.k === 'feed' ? `+${gained} Full  −${FEED_COST}◆` : `+${gained} Happy`,
      color: c.k === 'feed' ? C.money : C.heart,
    }));
    if (station !== HOME_STATION) goStation(HOME_STATION);
  };

  const goStation = (i: number) => {
    const n = Math.max(0, Math.min(STATIONS.length - 1, i));
    setStation(n);
    scroller.current?.scrollTo({ x: offsets[n], animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setScrollX(x);
  };
  const onSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    let best = 0;
    offsets.forEach((o, i) => { if (Math.abs(o - x) < Math.abs(offsets[best] - x)) best = i; });
    if (best !== station) { buzz(); setStation(best); }
  };

  const mood = moodOf(g.happy, g.full);
  const canFeed = g.gems >= FEED_COST;
  const backLeft = W / 2 - (scrollX + W / 2) * (backW / panoW);

  return (
    <View style={s.wrap}>
      {/* The room's own light, filling the screen. The painting is nine screens
          wide, so a cover-fit would show 7% of it and read as flat colour —
          stretching the whole room across the glass and blurring it hard gives
          the real distribution of light in the room instead. */}
      <Animated.View style={[StyleSheet.absoluteFill, backTilt]}>
        <Image source={denArt(species)} blurRadius={46}
          style={{ position: 'absolute', top: -H * 0.18, left: backLeft,
                   width: backW, height: H * 1.36, resizeMode: 'stretch', opacity: 0.95 }} />
      </Animated.View>
      <LinearGradient
        colors={[sp.env[1], 'transparent', 'transparent', '#04070F']}
        locations={[0, 0.26, 0.58, 0.95]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* ── the room ─────────────────────────────────────────────────────── */}
      <Animated.View style={[s.band, bandTilt]}>
        <ScrollView
          ref={scroller} horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToOffsets={offsets}
          snapToStart={false} snapToEnd={false}
          contentOffset={{ x: offsets[initialStation], y: 0 }}
          onScroll={onScroll} scrollEventThrottle={16}
          onMomentumScrollEnd={onSettled} onScrollEndDrag={onSettled}
          contentContainerStyle={{ width: panoW, height: BAND }}>

          <Image source={denArt(species)}
            style={{ width: panoW, height: BAND, resizeMode: 'cover' }} />

          {/* how bright the home is — the ten dwellings, as light rather than art */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            backgroundColor: '#050A16', opacity: 0.40 - (g.dwelling / 9) * 0.40 }]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
            backgroundColor: dw.glow, opacity: 0.03 + (g.dwelling / 9) * 0.13 }]} />

          {/* the Vaultling, asleep on its nest */}
          <Animated.View pointerEvents="none" style={[{
            position: 'absolute', left: NEST.x * panoW - W * 0.18,
            top: NEST.floor * BAND - W * 0.36 * 1.18, width: W * 0.36, alignItems: 'center',
          }, creatureTilt]}>
            <Creature ref={creature} species={species} mood={mood} width={W * 0.36} />
            <Particles kind={fx.kind} seq={fx.seq} />
            <FloatText text={fx.text} color={fx.color} seq={fx.seq} />
          </Animated.View>

          {AREAS.map(a => (
            <Hotspot key={a.k} a={a} panoW={panoW} unseen={!g.seen[a.k]}
              onPress={() => { buzz(); g.markSeen(a.k); onEnter(a.k); }} />
          ))}
        </ScrollView>
      </Animated.View>

      {/* soft edges so the painting does not end on a hard line */}
      <LinearGradient pointerEvents="none" colors={['#04070F', 'rgba(4,7,15,0.5)', 'transparent']}
        locations={[0, 0.38, 1]}
        style={{ position: 'absolute', top: BAND_TOP - 30, left: 0, right: 0, height: BAND * 0.30 }} />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(4,7,15,0.9)', '#04070F']}
        locations={[0, 0.35, 0.62]}
        style={{ position: 'absolute', top: BAND_TOP + BAND * 0.86, left: 0, right: 0, height: BAND * 0.40 }} />

      {/* ── who lives here ───────────────────────────────────────────────── */}
      <View style={s.hud} pointerEvents="box-none">
        <View style={s.hudTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.petName} numberOfLines={1}>{g.petName || sp.n}</Text>
            <Text style={s.petSub}>{moodLabel(g.happy, g.full)} · {dw.n}</Text>
          </View>
          <View style={s.gemChip}>
            <Text style={s.gemT}>◆ {g.gems}</Text>
          </View>
          <View style={[s.gemChip, { backgroundColor: 'rgba(143,227,176,0.14)' }]}>
            <Text style={[s.gemT, { color: C.money }]}>{money(jarTotal(g.jars))}</Text>
          </View>
        </View>
        <View style={s.meters}>
          <Meter label="Happy" v={g.happy} color={C.heart} />
          <Meter label="Full" v={g.full} color={C.money} />
        </View>
      </View>

      {/* ── where in the room you are ────────────────────────────────────── */}
      <View style={s.stations} pointerEvents="box-none">
        {STATIONS.map((stn, i) => (
          <Pressable key={stn.k} accessibilityRole="button" accessibilityLabel={`Go to ${stn.name}`}
            onPress={() => goStation(i)} hitSlop={12}
            style={[s.dot, i === station && { backgroundColor: C.gold, width: 22 }]} />
        ))}
      </View>
      <Text style={s.stationName} pointerEvents="none">{STATIONS[station].name}</Text>

      {scrollX > 12 && <Chevron dir="left" onPress={() => goStation(station - 1)} />}
      {scrollX < maxScroll - 12 && <Chevron dir="right" onPress={() => goStation(station + 1)} />}

      {/* ── looking after it ─────────────────────────────────────────────── */}
      <View style={s.dock}>
        {CARE.map(c => {
          const off = c.k === 'feed' && !canFeed;
          return (
            <Pressable key={c.k} accessibilityRole="button"
              accessibilityLabel={c.cost ? `${c.label}, costs ${c.cost} gems` : c.label}
              accessibilityState={{ disabled: off }}
              onPress={() => doCare(c)}
              style={({ pressed }) => [s.care, off && { opacity: 0.42 },
                                       { transform: [{ scale: pressed && !off ? 0.93 : 1 }] }]}>
              <Text style={s.careIcon}>{c.icon}</Text>
              <Text style={s.careLabel}>{c.label}</Text>
              {c.cost ? <Text style={[s.careCost, !canFeed && { color: C.coral }]}>◆{c.cost}</Text>
                      : <Text style={s.careCost}>free</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A destination that is a thing in the room. It breathes until the child has
 *  been there once, then goes quiet and stops competing for attention. */
function Hotspot({ a, panoW, unseen, onPress }: {
  a: typeof AREAS[number]; panoW: number; unseen: boolean; onPress: () => void;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!unseen) { cancelAnimation(pulse); pulse.value = withTiming(0, { duration: 300 }); return; }
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1150, easing: Easing.out(Easing.quad) }),
                   withTiming(0, { duration: 950, easing: Easing.in(Easing.quad) })), -1, false);
    return () => cancelAnimation(pulse);
  }, [unseen]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.85 }],
  }));

  return (
    <View style={{ position: 'absolute', left: a.x * panoW - 44, top: a.y * BAND - 44,
                   width: 88, alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${a.label} — ${a.hint}`}
        onPress={onPress} style={({ pressed }) => [s.hot, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
        <Animated.View style={[s.hotRing, ring]} />
        <Text style={s.hotIcon}>{a.icon}</Text>
      </Pressable>
      <Text style={s.hotLabel} numberOfLines={1}>{a.label}</Text>
    </View>
  );
}

function Chevron({ dir, onPress }: { dir: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={dir === 'left' ? 'Look left' : 'Look right'}
      onPress={onPress} hitSlop={10}
      style={[s.chev, dir === 'left' ? { left: 6 } : { right: 6 }]}>
      <Text style={s.chevT}>{dir === 'left' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

function Meter({ label, v, color }: { label: string; v: number; color: string }) {
  const w = useSharedValue(v);
  useEffect(() => { w.value = withSpring(v, { damping: 16, stiffness: 120 }); }, [v]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, w.value))}%` }));
  return (
    <View style={{ flex: 1 }} accessibilityLabel={`${label} ${Math.round(v)} of 100`}>
      <View style={s.meterTop}>
        <Text style={s.meterL}>{label}</Text>
        <Text style={[s.meterV, { color }]}>{Math.round(v)}</Text>
      </View>
      <View style={s.meterBed}>
        <Animated.View style={[s.meterFill, { backgroundColor: color }, fill]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#04070F' },
  band: { position: 'absolute', top: BAND_TOP, left: 0, right: 0, height: BAND },

  hud: { position: 'absolute', top: 56, left: S.lg, right: S.lg },
  hudTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  petName: { color: C.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.3,
             textShadowColor: '#000', textShadowRadius: 10 },
  petSub: { color: C.mist, fontSize: 11, marginTop: 1, textShadowColor: '#000', textShadowRadius: 8 },
  gemChip: { backgroundColor: 'rgba(255,201,77,0.16)', borderRadius: R.pill,
             paddingHorizontal: 11, paddingVertical: 6,
             borderWidth: 1, borderColor: 'rgba(255,201,77,0.28)' },
  gemT: { color: C.gold, fontWeight: '800', fontSize: 12.5 },
  meters: { flexDirection: 'row', gap: S.md, marginTop: S.md },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  meterL: { color: C.mist, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  meterV: { fontSize: 10.5, fontWeight: '800' },
  meterBed: { height: 7, borderRadius: R.pill, backgroundColor: 'rgba(4,8,20,0.72)',
              overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(160,180,220,0.18)' },
  meterFill: { height: '100%', borderRadius: R.pill },

  hot: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center',
         backgroundColor: C.gold, borderWidth: 2.5, borderColor: 'rgba(20,32,61,0.9)',
         shadowColor: '#000', shadowOpacity: 0.65, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  hotRing: { position: 'absolute', width: 54, height: 54, borderRadius: 27,
             borderWidth: 2, borderColor: C.gold },
  hotIcon: { fontSize: 24 },
  hotLabel: { color: C.ink, fontSize: 10.5, fontWeight: '800', marginTop: 5,
              textShadowColor: '#000', textShadowRadius: 8 },

  stations: { position: 'absolute', bottom: 172, left: 0, right: 0,
              flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(234,240,255,0.34)' },
  stationName: { position: 'absolute', bottom: 188, left: 0, right: 0, textAlign: 'center',
                 color: C.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  chev: { position: 'absolute', top: BAND_TOP + BAND / 2 - 22, width: HIT, height: HIT,
          alignItems: 'center', justifyContent: 'center', borderRadius: 22,
          backgroundColor: 'rgba(8,14,30,0.55)' },
  chevT: { color: C.ink, fontSize: 26, fontWeight: '800', marginTop: -4 },

  dock: { position: 'absolute', left: S.md, right: S.md, bottom: 34,
          flexDirection: 'row', gap: 7, padding: 9,
          backgroundColor: 'rgba(8,14,30,0.90)', borderRadius: R.lg,
          borderWidth: 1, borderColor: C.line },
  care: { flex: 1, minHeight: 68, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(29,47,94,0.92)', borderWidth: 1, borderColor: C.line },
  careIcon: { fontSize: 22 },
  careLabel: { color: C.ink, fontSize: 11, fontWeight: '800', marginTop: 2 },
  careCost: { color: C.mist, fontSize: 9, fontWeight: '700', marginTop: 1 },
});
