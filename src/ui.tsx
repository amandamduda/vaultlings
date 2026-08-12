import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView, type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, S, R, HIT } from './theme';

export const buzz = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
  Haptics.impactAsync(style).catch(() => {});
export const ok = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const nope = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

export function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[st.card, style]}>
      {title ? <Text style={st.cardT}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Row({ left, sub, right }: { left: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={st.row}>
      <View style={{ flex: 1 }}>
        <Text style={st.rowL}>{left}</Text>
        {sub ? <Text style={st.rowS}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Every pressable meets the 44pt HIG minimum. A disabled button keeps its
 *  label — a child needs to see what they cannot afford yet, not have it
 *  vanish. */
export function Btn({ label, onPress, tone = 'gold', wide, disabled, color }: {
  label: string; onPress: () => void;
  tone?: 'gold' | 'ghost' | 'teal'; wide?: boolean; disabled?: boolean; color?: string;
}) {
  const bg = color ?? (tone === 'gold' ? C.gold : tone === 'teal' ? '#0d4a44' : 'rgba(38,54,96,0.92)');
  const fg = color ? '#0A1018' : tone === 'gold' ? '#14203D' : tone === 'teal' ? C.teal : C.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }} disabled={disabled}
      onPress={() => { buzz(); onPress(); }}
      style={({ pressed }) => [
        st.btn, { backgroundColor: bg, transform: [{ scale: pressed && !disabled ? 0.96 : 1 }] },
        wide && { alignSelf: 'stretch', paddingVertical: 15 },
        disabled && { opacity: 0.42 },
      ]}>
      <Text style={[st.btnT, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A plus/minus picker. Typing a number is a worse interaction for an
 *  eight-year-old than nudging one, and it makes an impossible amount
 *  impossible to enter. */
export function Stepper({ value, max, step = 0.5, onChange }: {
  value: number; max: number; step?: number; onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(max, Math.round(n * 100) / 100));
  const go = (d: number) => { const n = clamp(value + d); if (n !== value) { Haptics.selectionAsync().catch(() => {}); onChange(n); } };
  return (
    <View style={st.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Less" onPress={() => go(-step)} disabled={value <= 0}
        style={({ pressed }) => [st.stepB, value <= 0 && { opacity: 0.35 }, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
        <Text style={st.stepT}>−</Text>
      </Pressable>
      <Text style={st.stepV}>${value.toFixed(2)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => go(step)} disabled={value >= max}
        style={({ pressed }) => [st.stepB, value >= max && { opacity: 0.35 }, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
        <Text style={st.stepT}>+</Text>
      </Pressable>
    </View>
  );
}

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggle(); }}
      style={[st.sw, on && { backgroundColor: C.gold }]}>
      <View style={[st.swKnob, on && { transform: [{ translateX: 20 }] }]} />
    </Pressable>
  );
}

export type GateReq = { title: string; detail?: string; run: () => void } | null;

/**
 * The grown-up check.
 *
 * A two-digit multiplication, regenerated every open. Reliably past a
 * seven-year-old and trivial for an adult — the same bar Apple's own parental
 * gates use. Deliberately not a PIN: a PIN a child watches their parent type
 * is not a gate, and a family that never set one would be locked out of their
 * own money. Three wrong answers closes it.
 */
export function ParentGate({ req, onClose }: { req: GateReq; onClose: () => void }) {
  const [nonce, setNonce] = useState(0);
  const [wrong, setWrong] = useState(0);

  const { a, b, answer, options } = useMemo(() => {
    const a = 4 + Math.floor(Math.random() * 8);
    const b = 4 + Math.floor(Math.random() * 8);
    const answer = a * b;
    const set = new Set<number>([answer]);
    let k = 1;
    while (set.size < 4) { set.add(answer + (k % 2 ? k : -k) * (1 + (k % 3))); k++; }
    return { a, b, answer, options: [...set].sort(() => Math.random() - 0.5) };
  }, [nonce, req]);

  const choose = (n: number) => {
    if (n === answer) { ok(); setWrong(0); setNonce(x => x + 1); req?.run(); onClose(); return; }
    nope();
    const w = wrong + 1;
    setWrong(w); setNonce(x => x + 1);
    if (w >= 3) { setWrong(0); onClose(); }
  };

  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.scrim}>
        <View style={st.sheet} accessibilityViewIsModal accessibilityLabel="Grown-up check">
          <Text style={st.kick}>GROWN-UP CHECK</Text>
          <Text style={st.h2}>{req?.title ?? ''}</Text>
          {!!req?.detail && <Text style={st.sub}>{req.detail}</Text>}
          <Text style={st.sum} accessibilityLabel={`What is ${a} times ${b}?`}>{a} × {b} = ?</Text>
          <View style={st.opts}>
            {options.map(n => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={String(n)}
                onPress={() => choose(n)}
                style={({ pressed }) => [st.opt, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
                <Text style={st.optT}>{n}</Text>
              </Pressable>
            ))}
          </View>
          {wrong > 0 && (
            <Text style={st.err}>Not quite — {3 - wrong} {3 - wrong === 1 ? 'try' : 'tries'} left.</Text>
          )}
          <Btn label="Cancel" tone="ghost" wide onPress={() => { setWrong(0); onClose(); }} />
          <Text style={[st.note, { textAlign: 'center' }]}>
            This keeps real money in a grown-up's hands. Nothing here can be bought with it.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export function Screen({ title, sub, children, onBack }: {
  title: string; sub?: string; children: React.ReactNode; onBack?: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={st.pad} showsVerticalScrollIndicator={false}>
        <Text style={st.h1}>{title}</Text>
        {!!sub && <Text style={st.sub}>{sub}</Text>}
        {children}
      </ScrollView>
      {onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the den"
          onPress={() => { buzz(); onBack(); }} style={st.back}>
          <Text style={st.backT}>◀  Den</Text>
        </Pressable>
      )}
    </View>
  );
}

export const st = StyleSheet.create({
  pad: { padding: S.lg, paddingTop: 78, paddingBottom: 120 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: C.ink, fontSize: 21, fontWeight: '800', marginTop: S.xs },
  kick: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  sub: { color: C.mist, fontSize: 12, lineHeight: 17, marginTop: 3 },
  body: { color: C.ink, fontSize: 13.5, lineHeight: 21 },
  note: { color: C.mist, fontSize: 11, lineHeight: 16, marginTop: S.sm },
  warn: { color: C.coral, fontSize: 11.5, marginTop: S.sm },
  card: { backgroundColor: 'rgba(10,17,36,0.72)', borderColor: C.line, borderWidth: 1,
          borderRadius: R.lg, padding: S.lg, marginTop: S.md },
  cardT: { color: C.mist, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6,
           textTransform: 'uppercase', marginBottom: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 9,
         borderBottomColor: C.line, borderBottomWidth: StyleSheet.hairlineWidth },
  rowL: { color: C.ink, fontSize: 13.5 },
  rowS: { color: C.mist, fontSize: 10.5, marginTop: 1 },
  btn: { minHeight: HIT, borderRadius: R.md, paddingHorizontal: 18,
         alignItems: 'center', justifyContent: 'center' },
  btnT: { fontWeight: '800', fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepB: { width: HIT, height: HIT, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
           backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.line },
  stepT: { color: C.ink, fontSize: 20, fontWeight: '800' },
  stepV: { color: C.ink, fontSize: 15, fontWeight: '800', minWidth: 68, textAlign: 'center' },
  sw: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#2a3557', padding: 3 },
  swKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EAF0FF' },
  scrim: { flex: 1, backgroundColor: 'rgba(3,6,16,0.86)', justifyContent: 'center', padding: S.lg },
  sheet: { backgroundColor: C.surface, borderRadius: R.lg, padding: S.xl, borderWidth: 1, borderColor: C.line },
  sum: { color: C.ink, fontSize: 32, fontWeight: '800', textAlign: 'center', marginVertical: S.lg },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, justifyContent: 'center' },
  opt: { minWidth: 76, minHeight: HIT, paddingHorizontal: S.lg, borderRadius: R.md,
         alignItems: 'center', justifyContent: 'center',
         backgroundColor: C.surface2, borderWidth: 1.5, borderColor: C.line },
  optT: { color: C.ink, fontSize: 17, fontWeight: '800' },
  err: { color: C.coral, fontSize: 12, textAlign: 'center', marginTop: S.md },
  back: { position: 'absolute', top: 52, left: S.lg, paddingHorizontal: 15, paddingVertical: 9,
          borderRadius: R.pill, backgroundColor: 'rgba(8,14,30,0.9)', borderWidth: 1, borderColor: C.line },
  backT: { color: C.ink, fontWeight: '800', fontSize: 12.5 },
  aisle: { color: C.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.6,
           textTransform: 'uppercase', marginTop: S.lg, marginBottom: S.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tile: { width: '31.5%', backgroundColor: 'rgba(16,27,56,0.7)', borderColor: C.line, borderWidth: 1.5,
          borderRadius: R.md, padding: 9, alignItems: 'center', minHeight: 106 },
  big: { color: C.ink, fontSize: 34, fontWeight: '800' },
  chip: { backgroundColor: 'rgba(255,201,77,0.14)', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipT: { color: C.gold, fontWeight: '800', fontSize: 11 },
});
