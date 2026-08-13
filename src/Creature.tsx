import React, { useEffect, useImperativeHandle, useRef, forwardRef, useState } from 'react';
import { View, Text, Image, StyleSheet, type ImageStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat,
  withDelay, Easing, cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import { pose as poseArt } from './art';
import type { SpeciesKey } from './theme';

export type PoseName = 'idle' | 'happy' | 'hungry' | 'eat' | 'sleep' | 'cheer';
export type ActKind = 'feed' | 'pet' | 'wash' | 'toy' | 'cheer';

export type CreatureHandle = { play: (kind: ActKind) => void };

/** Every pose ships on one 336x460 canvas, bottom-anchored, so the creature
 *  keeps its size and its footing when the frame changes. Lay it out with this
 *  ratio and `contain` never letterboxes. */
export const FRAME_RATIO = 460 / 336;

/** Each care action is a distinct little performance: its own frame from the
 *  pose sheet, its own motion, and its own particles. The frame and the motion
 *  are separate on purpose — if a pose frame is ever missing, the motion still
 *  reads. */
const ACT: Record<ActKind, { frame: PoseName; ms: number }> = {
  feed:  { frame: 'eat',   ms: 820 },
  pet:   { frame: 'happy', ms: 900 },
  wash:  { frame: 'happy', ms: 900 },
  toy:   { frame: 'cheer', ms: 950 },
  cheer: { frame: 'cheer', ms: 1000 },
};

type Props = {
  species: SpeciesKey;
  /** 0 asleep · 1 content · 2 delighted — picks the resting frame.
   *  Zero means nobody has been by yet this week, so the Vaultling is asleep.
   *  It is never sad, hungry or neglected: absence is not punished here. */
  mood: number;
  width: number;
  style?: ImageStyle;
};

/**
 * The Vaultling, animated.
 *
 * Reanimated drives everything on the UI thread, so the creature keeps moving
 * even while a screen is doing work. The idle bob never stops; an action
 * interrupts it, plays, and hands back.
 */
const Creature = forwardRef<CreatureHandle, Props>(function Creature(
  { species, mood, width, style }, ref
) {
  const [frame, setFrame] = useState<PoseName>('idle');
  const busy = useRef(false);

  const ty = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const rot = useSharedValue(0);
  const tx = useSharedValue(0);

  const restFrame: PoseName = mood === 0 ? 'sleep' : mood === 2 ? 'happy' : 'idle';

  // the resting bob — slower and lower when the creature is unhappy
  const startIdle = () => {
    cancelAnimation(ty);
    const amp = mood === 0 ? -3 : -9;      // sleeping breathes, awake bobs
    const dur = mood === 0 ? 3200 : 1800;
    ty.value = withRepeat(
      withSequence(
        withTiming(amp, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: dur, easing: Easing.inOut(Easing.quad) })
      ), -1, false);
    sx.value = withTiming(1, { duration: 200 });
    sy.value = withTiming(1, { duration: 200 });
    rot.value = withTiming(0, { duration: 200 });
    tx.value = withTiming(0, { duration: 200 });
  };

  useEffect(() => { if (!busy.current) { setFrame(restFrame); startIdle(); } }, [mood]);
  useEffect(() => { startIdle(); return () => cancelAnimation(ty); }, []);

  const done = () => { busy.current = false; setFrame(restFrame); startIdle(); };

  useImperativeHandle(ref, () => ({
    play(kind) {
      if (busy.current) return;
      busy.current = true;
      const a = ACT[kind];
      setFrame(a.frame);
      cancelAnimation(ty);

      const T = (v: number, d: number) => withTiming(v, { duration: d, easing: Easing.out(Easing.quad) });

      if (kind === 'feed') {
        // lean in, chomp, settle
        tx.value = withSequence(T(-8, 160), T(6, 200), T(0, 240));
        sy.value = withSequence(T(0.93, 160), T(1.07, 200), T(1, 240));
        sx.value = withSequence(T(1.07, 160), T(0.95, 200), T(1, 240));
        ty.value = withSequence(T(4, 160), T(-8, 200), T(0, 240));
      } else if (kind === 'pet') {
        // nuzzle side to side
        rot.value = withSequence(T(-7, 220), T(6, 260), T(-3, 200), T(0, 200));
        tx.value = withSequence(T(-6, 220), T(5, 260), T(0, 400));
      } else if (kind === 'wash') {
        rot.value = withSequence(T(-5, 200), T(5, 240), T(0, 240));
        sy.value = withSequence(T(1.04, 200), T(0.98, 240), T(1, 240));
      } else {
        // play / cheer — a real jump with squash and stretch
        ty.value = withSequence(T(8, 120), T(-62, 260), T(-10, 200), T(0, 220));
        sy.value = withSequence(T(0.86, 120), T(1.14, 260), T(1, 400));
        sx.value = withSequence(T(1.14, 120), T(0.9, 260), T(1, 400));
        rot.value = withSequence(T(-5, 260), T(4, 240), T(0, 220));
      }
      ty.value = withDelay(a.ms, withTiming(0, { duration: 1 }, f => { if (f) runOnJS(done)(); }));
    },
  }));

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value }, { translateY: ty.value },
      { scaleX: sx.value }, { scaleY: sy.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.Image
      source={poseArt(species, frame)}
      style={[{ width, height: width * FRAME_RATIO, resizeMode: 'contain' }, style as any, anim]}
      accessibilityIgnoresInvertColors
    />
  );
});
export default Creature;

/** Floating emoji and a rising number. Cheap, and it is most of what makes an
 *  action feel like it did something. */
export function Particles({ kind, seq }: { kind: ActKind; seq: number }) {
  const CHARS: Record<ActKind, string[]> = {
    feed: ['🍃', '✨', '🌰'], pet: ['💛', '💗', '✨'],
    wash: ['🫧', '✨'], toy: ['⭐', '✨', '🌟'], cheer: ['⭐', '🌟', '✨'],
  };
  const chars = CHARS[kind] ?? CHARS.cheer;
  if (!seq) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {chars.flatMap((ch, i) =>
        [0, 1, 2].map(j => (
          <Puff key={`${seq}-${i}-${j}`} char={ch} delay={(i * 3 + j) * 55} seq={seq} />
        ))
      )}
    </View>
  );
}

function Puff({ char, delay, seq }: { char: string; delay: number; seq: number }) {
  const y = useSharedValue(0), o = useSharedValue(0);
  const dx = useRef((Math.random() - 0.5) * 120).current;
  useEffect(() => {
    o.value = withDelay(delay, withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 780 })));
    y.value = withDelay(delay, withTiming(-110 - Math.random() * 50, { duration: 940, easing: Easing.out(Easing.quad) }));
  }, [seq]);
  const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: '50%', bottom: '42%', marginLeft: dx }, s]}>
      <Text style={{ fontSize: 16 + Math.random() * 12 }}>{char}</Text>
    </Animated.View>
  );
}

/** The number that changed, floating up in the colour of the meter it belongs
 *  to. Reads before the meter animation finishes. */
export function FloatText({ text, color, seq }: { text: string; color: string; seq: number }) {
  const y = useSharedValue(0), o = useSharedValue(0);
  useEffect(() => {
    if (!seq) return;
    o.value = withSequence(withTiming(1, { duration: 150 }), withDelay(420, withTiming(0, { duration: 480 })));
    y.value = withSequence(withTiming(0, { duration: 0 }), withTiming(-78, { duration: 1050, easing: Easing.out(Easing.quad) }));
  }, [seq]);
  const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  if (!seq) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: '48%', alignItems: 'center' }, s]}>
      <Text style={{ color, fontWeight: '800', fontSize: 15, textShadowColor: '#000', textShadowRadius: 8 }}>{text}</Text>
    </Animated.View>
  );
}
