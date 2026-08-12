import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat,
  withDelay, Easing, cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import { ART, CRUST } from '../art';
import { C, S, R, SPECIES, type SpeciesKey } from '../theme';
import { Btn, st } from '../ui';

const { width: W, height: H } = Dimensions.get('window');

/** How many strikes it takes. Low enough that a six-year-old gets there,
 *  high enough that arriving feels earned. */
const HITS = 18;
/** The shell visibly splits at this point — the halfway payoff that stops a
 *  child abandoning the interaction. */
const CRACK = 0.55;

/** The line under the vault changes as the child digs, so the screen is
 *  narrating rather than counting. */
const BEATS = [
  { at: 0.00, t: 'Something is buried here.', s: 'Tap the vault. Keep tapping.' },
  { at: 0.18, t: 'It moved.',                 s: 'Do not stop now.' },
  { at: 0.40, t: 'The rock is giving way.',   s: 'Almost through the crust.' },
  { at: 0.62, t: 'A crack. Light inside.',    s: 'Something in there is awake.' },
  { at: 0.84, t: 'It is pushing back!',       s: 'One more. One more!' },
];
const beatFor = (p: number) => BEATS.reduce((b, x) => (p >= x.at ? x : b), BEATS[0]);

export default function Excavate({ species, onDone }: {
  species: SpeciesKey; onDone: () => void;
}) {
  const sp = SPECIES[species];
  const [hits, setHits] = useState(0);
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const p = Math.min(1, hits / HITS);
  const beat = beatFor(p);
  /** How much rock is still on top. One layer comes off every few strikes, so
   *  the child sees the burial giving way rather than a number going up. */
  const layer = Math.min(CRUST.length, Math.floor(hits / (HITS / CRUST.length)));

  // egg transform
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  // the seam of light that widens as the shell fails
  const seam = useSharedValue(0);
  // the flash at the moment of the reveal
  const flash = useSharedValue(0);
  const halo = useSharedValue(0);

  // a slow breathing pulse the whole time, so the vault reads as alive
  useEffect(() => {
    halo.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                   withTiming(0.35, { duration: 1500, easing: Easing.inOut(Easing.quad) })),
      -1, false);
    return () => cancelAnimation(halo);
  }, []);

  const finish = () => { setOpen(true); setBurst(b => b + 1); };

  const strike = () => {
    if (open) return;
    const n = hits + 1;
    setHits(n);
    const q = n / HITS;

    // the phone hits harder the closer it gets
    Haptics.impactAsync(
      q > 0.84 ? Haptics.ImpactFeedbackStyle.Heavy
      : q > 0.5 ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const power = 5 + q * 16;
    shake.value = withSequence(
      withTiming(-power, { duration: 42 }), withTiming(power * 0.8, { duration: 52 }),
      withTiming(-power * 0.45, { duration: 52 }), withTiming(0, { duration: 74 }));
    scale.value = withSequence(
      withTiming(0.94, { duration: 60 }), withTiming(1.05, { duration: 90 }),
      withTiming(1, { duration: 130 }));
    seam.value = withTiming(Math.max(0, (q - CRACK) / (1 - CRACK)), { duration: 180 });
    setBurst(b => b + 1);

    if (n >= HITS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flash.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 620 }));
      lift.value = withDelay(90, withTiming(-34, { duration: 620, easing: Easing.out(Easing.back(2)) }));
      scale.value = withDelay(90, withTiming(1.16, { duration: 620, easing: Easing.out(Easing.quad) }));
      shake.value = withDelay(700, withTiming(0, { duration: 1 }, f => { if (f) runOnJS(finish)(); }));
    }
  };

  const eggS = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value }, { translateY: lift.value },
      { scale: scale.value }, { rotate: `${shake.value * 0.16}deg` },
    ],
  }));
  const seamS = useAnimatedStyle(() => ({ opacity: seam.value * 0.95 }));
  const flashS = useAnimatedStyle(() => ({ opacity: flash.value }));
  const haloS = useAnimatedStyle(() => ({
    opacity: 0.18 + halo.value * 0.34 + p * 0.3,
    transform: [{ scale: 0.9 + halo.value * 0.12 + p * 0.2 }],
  }));

  const eggW = Math.min(W * 0.68, 290);

  return (
    <View style={s.wrap}>
      <LinearGradient colors={[sp.env[0], sp.env[1], '#04070F']} locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill} />

      {!open ? (
        <>
          <View style={s.head}>
            <Text style={st.kick}>UNBURY YOUR VAULTLING</Text>
            <Text style={s.title}>{beat.t}</Text>
            <Text style={s.sub}>{beat.s}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Strike the vault. ${Math.round(p * 100)} percent free.`}
            onPress={strike} style={s.stage}>
            <Animated.Image source={ART.glow} tintColor={sp.tint} style={[s.halo, haloS]} />

            <Animated.View style={eggS}>
              <Image source={ART[`egg-${species}` as 'egg-fen']}
                style={{ width: eggW, height: eggW * 1.22, resizeMode: 'contain' }} />
              {/* the same vault, already broken, faded in through the seam */}
              <Animated.Image
                source={ART[`eggopen-${species}` as 'eggopen-fen']}
                style={[StyleSheet.absoluteFill,
                        { width: eggW, height: eggW * 1.22, resizeMode: 'contain' }, seamS]} />
            </Animated.View>

            {/* the rock on top of it, coming off a layer at a time */}
            <Crust layer={layer} size={eggW * 1.42} />

            <Shards seq={burst} tint={sp.tint} power={p} />
          </Pressable>

          <View style={s.foot}>
            <View style={s.barBed}>
              <View style={[s.barFill, { width: `${p * 100}%`, backgroundColor: sp.tint }]} />
            </View>
            <Text style={s.hint}>
              {p < 1 ? `${HITS - hits} more` : 'It is coming out!'}
            </Text>
          </View>
        </>
      ) : (
        <Reveal species={species} onDone={onDone} />
      )}

      <Animated.View pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF' }, flashS]} />
    </View>
  );
}

/** The held breath after the shell gives way: the creature rises out of the
 *  broken vault, gets its name announced, and only then does a button appear.
 *  Nothing here is skippable-by-accident. */
function Reveal({ species, onDone }: { species: SpeciesKey; onDone: () => void }) {
  const sp = SPECIES[species];
  const rise = useSharedValue(70);
  const fade = useSharedValue(0);
  const textIn = useSharedValue(0);
  const btnIn = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 520 });
    rise.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.back(1.4)) });
    textIn.value = withDelay(620, withTiming(1, { duration: 520 }));
    btnIn.value = withDelay(1400, withTiming(1, { duration: 420 }));
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return () => cancelAnimation(spin);
  }, []);

  const creatureS = useAnimatedStyle(() => ({
    opacity: fade.value, transform: [{ translateY: rise.value }],
  }));
  const textS = useAnimatedStyle(() => ({
    opacity: textIn.value, transform: [{ translateY: (1 - textIn.value) * 16 }],
  }));
  const btnS = useAnimatedStyle(() => ({ opacity: btnIn.value }));
  const rayS = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const cw = Math.min(W * 0.62, 270);

  return (
    <View style={s.revealWrap}>
      <View style={s.stage}>
        <Animated.Image source={ART.glow} tintColor={sp.tint}
          style={[s.rays, { opacity: 0.5 }]} />
        <Animated.View style={[s.raysRing, { borderColor: sp.tint }, rayS]} />
        <Animated.View style={[{ alignItems: 'center' }, creatureS]}>
          <Image source={ART[`${species}-cheer` as 'fen-cheer']}
            style={{ width: cw, height: cw * 1.18, resizeMode: 'contain' }} />
          <Image source={ART[`eggopen-${species}` as 'eggopen-fen']}
            style={{ width: cw * 0.92, height: cw * 0.42, resizeMode: 'contain', marginTop: -18 }} />
        </Animated.View>
        <Shards seq={1} tint={sp.tint} power={1} big />
      </View>

      <Animated.View style={[s.revealText, textS]}>
        <Text style={st.kick}>{sp.el.toUpperCase()}</Text>
        <Text style={s.big}>{sp.n}</Text>
        <Text style={s.lore}>{sp.lore}</Text>
      </Animated.View>

      <Animated.View style={[{ paddingHorizontal: S.xl, paddingBottom: 46 }, btnS]}>
        <Btn label={`Give ${sp.n} a name`} wide onPress={onDone} />
      </Animated.View>
    </View>
  );
}

/**
 * The crust.
 *
 * Six layers of rock lie over the vault, each with a wider hole broken through
 * it than the last. Only the topmost intact layer is drawn; when a strike takes
 * it off, that layer shatters outward and the next — with more of the vault
 * showing through — settles into place. That is the whole trick: the reveal is
 * the rock leaving, not the vault arriving.
 */
function Crust({ layer, size }: { layer: number; size: number }) {
  const [shed, setShed] = useState<number[]>([]);
  const prev = useRef(layer);

  useEffect(() => {
    if (layer > prev.current) setShed(x => [...x.slice(-2), prev.current]);
    prev.current = layer;
  }, [layer]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {layer < CRUST.length && <CrustLayer key={`on-${layer}`} src={CRUST[layer]} size={size} />}
      {shed.map(i => <CrustLayer key={`off-${i}`} src={CRUST[i]} size={size} shattering />)}
    </View>
  );
}

function CrustLayer({ src, size, shattering }: {
  src: number; size: number; shattering?: boolean;
}) {
  const t = useSharedValue(shattering ? 0 : 1);
  useEffect(() => {
    t.value = shattering
      ? withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) })
      : withTiming(1, { duration: 260 });
  }, []);

  const style = useAnimatedStyle(() =>
    shattering
      ? { opacity: 1 - t.value, transform: [{ scale: 1 + t.value * 0.34 }, { rotate: `${t.value * 5}deg` }] }
      : { opacity: t.value, transform: [{ scale: 1.06 - t.value * 0.06 }] });

  return (
    <Animated.Image source={src}
      style={[{ position: 'absolute', width: size, height: size, resizeMode: 'contain' }, style]} />
  );
}

/** Chips of rock thrown off by a strike. Sized by how far along the dig is, so
 *  the last hits visibly throw more material than the first. */
function Shards({ seq, tint, power, big }: {
  seq: number; tint: string; power: number; big?: boolean;
}) {
  const n = big ? 18 : 9;
  if (!seq) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: n }, (_, i) => (
        <Shard key={`${seq}-${i}`} i={i} n={n} tint={tint} power={power} big={!!big} />
      ))}
    </View>
  );
}

function Shard({ i, n, tint, power, big }: {
  i: number; n: number; tint: string; power: number; big: boolean;
}) {
  const t = useSharedValue(0);
  const geom = useRef({
    a: (i / n) * Math.PI * 2 + Math.random() * 0.6,
    d: (big ? 150 : 60) + Math.random() * (big ? 130 : 70) * (0.5 + power),
    sz: (big ? 7 : 4) + Math.random() * (big ? 9 : 6),
    r: Math.random() * 540 - 270,
  }).current;

  useEffect(() => { t.value = withTiming(1, { duration: big ? 1100 : 620, easing: Easing.out(Easing.quad) }); }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(geom.a) * geom.d * t.value },
      { translateY: Math.sin(geom.a) * geom.d * t.value + t.value * t.value * 70 },
      { rotate: `${geom.r * t.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[{
      position: 'absolute', left: '50%', top: '50%',
      width: geom.sz, height: geom.sz * 0.7, borderRadius: 2,
      backgroundColor: i % 4 === 0 ? tint : i % 2 ? '#4A423C' : '#6C5A48',
    }, style]} />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { paddingTop: H * 0.11, paddingHorizontal: S.xl, alignItems: 'center' },
  title: { color: C.ink, fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  sub: { color: C.mist, fontSize: 13, textAlign: 'center', marginTop: 5 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: W * 1.15, height: W * 1.15, resizeMode: 'contain' },
  foot: { paddingHorizontal: S.xl, paddingBottom: 54, alignItems: 'center' },
  barBed: { height: 10, width: '100%', borderRadius: R.pill, overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.10)' },
  barFill: { height: '100%', borderRadius: R.pill },
  hint: { color: C.mist, fontSize: 11.5, fontWeight: '700', marginTop: 9, letterSpacing: 0.6 },
  revealWrap: { flex: 1 },
  revealText: { paddingHorizontal: S.xl, alignItems: 'center' },
  big: { color: C.ink, fontSize: 42, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  lore: { color: C.mist, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  rays: { position: 'absolute', width: W * 1.35, height: W * 1.35, resizeMode: 'contain' },
  raysRing: { position: 'absolute', width: W * 1.1, height: W * 1.1, borderRadius: W,
              borderWidth: 60, opacity: 0.10 },
});
