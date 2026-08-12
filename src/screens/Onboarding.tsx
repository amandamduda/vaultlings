import React, { useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, ScrollView, Pressable, StyleSheet,
  useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { ART } from '../art';
import { C, S, R, SPECIES, SP_KEYS, type SpeciesKey } from '../theme';
import { Btn, st, buzz, ok } from '../ui';
import { useGame } from '../store';
import Excavate from './Excavate';

type Step = 0 | 1 | 2 | 3 | 'hall' | 'dig' | 'name';

export default function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [kid, setKid] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [picked, setPicked] = useState<SpeciesKey | null>(null);
  const setKidStore = useGame(s => s.setKid);
  const chooseSpecies = useGame(s => s.chooseSpecies);

  const next = () => { buzz(); setStep(s => (typeof s === 'number' ? (s + 1) as Step : s)); };

  if (step === 'hall') {
    return (
      <Hall
        onBack={() => setStep(3)}
        onWake={k => { setPicked(k); chooseSpecies(k); setStep('dig'); }}
      />
    );
  }
  if (step === 'dig' && picked) {
    return <Excavate species={picked} onDone={() => { ok(); setStep('name'); }} />;
  }
  if (step === 'name' && picked) {
    return <NameIt species={picked} kid={kid} />;
  }

  const dots = [0, 1, 2, 3, 4, 5];
  const stepIndex = typeof step === 'number' ? step : 4;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#0a0f22', C.bg]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[st.pad, { paddingTop: 72 }]} showsVerticalScrollIndicator={false}>
        {step === 0 && (<>
          <Text style={st.kick}>SOMEWHERE VERY DEEP DOWN</Text>
          <Text style={[st.h1, { color: C.gold, marginTop: 8 }]}>Something is waking up.</Text>
          <Text style={[st.body, { marginTop: 14, color: '#DCE6FA' }]}>
            Far below the world there are old, forgotten vaults. Inside each one sleeps a tiny
            creature made of starlight and stubbornness.
          </Text>
          <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>
            They're called <Text style={s.b}>Vaultlings</Text>. They sleep until somebody worth
            waking up for comes along.
          </Text>
          <View style={s.lore}>
            <Text style={s.loreT}>
              "A Vaultling will not wake for gold. It wakes for a person who keeps their promises."
            </Text>
            <Text style={s.loreS}>— The Ancient Ledger, page 1</Text>
          </View>
          <Btn label="Is it me?  →" wide onPress={next} />
        </>)}

        {step === 1 && (<>
          <Text style={st.kick}>STEP 1 · WHO'S THERE?</Text>
          <Text style={[st.h1, { color: C.gold, marginTop: 8 }]}>What should we call you?</Text>
          <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>The vaults need to know who's knocking.</Text>
          <TextInput value={kid} onChangeText={setKid} placeholder="Type your first name"
            placeholderTextColor="#5a6b96" style={s.input} autoCorrect={false} returnKeyType="done"
            accessibilityLabel="Your first name" />
          <Btn label="That's me" wide onPress={() => { setKidStore(kid.trim() || 'friend', age); next(); }} />
        </>)}

        {step === 2 && (<>
          <Text style={st.kick}>STEP 2 · HOW MANY CANDLES?</Text>
          <Text style={[st.h1, { color: C.gold, marginTop: 8 }]}>
            How old are you{kid ? `, ${kid}` : ''}?
          </Text>
          <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>
            This just helps us pick the right size adventure. No wrong answers.
          </Text>
          <View style={s.ages}>
            {[7, 8, 9, 10, 11, 12, 13, 14, 15].map(a => (
              <Pressable key={a} accessibilityRole="button" accessibilityLabel={`${a} years old`}
                onPress={() => { buzz(); setAge(a); setKidStore(kid.trim() || 'friend', a); }}
                style={[s.age, age === a && s.ageOn]}>
                <Text style={[s.ageT, age === a && { color: C.gold }]}>{a === 15 ? '15+' : a}</Text>
              </Pressable>
            ))}
          </View>
          {age !== null && <Btn label="Next" wide onPress={next} />}
        </>)}

        {step === 3 && (<>
          <Text style={st.kick}>STEP 3 · THE STORY SO FAR</Text>
          <Text style={[st.h1, { color: C.gold, marginTop: 8 }]}>Here's the deal{kid ? `, ${kid}` : ''}.</Text>
          <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>
            Every Vaultling wakes at the <Text style={s.b}>very bottom</Text> of a dark shaft, in a
            damp little hollow. Nobody starts at the top. Not one.
          </Text>
          <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>
            The way up isn't magic. It's <Text style={s.b}>looking after them</Text> — feeding,
            playing, and being smart with the money your grown-ups send you.
          </Text>
          <Image source={ART.strata} style={{ width: '100%', height: 260, resizeMode: 'contain', marginTop: S.lg, borderRadius: R.lg }} />
          <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>
            Five vaults are still sealed down there. One of them has been waiting for <Text style={s.b}>you</Text>.
          </Text>
          <Btn label="Go to the Hall of Vaults  →" wide onPress={() => { buzz(); setStep('hall'); }} />
        </>)}

        <View style={s.dots}>
          {dots.map(i => <View key={i} style={[s.dot, i === stepIndex && s.dotOn]} />)}
        </View>
      </ScrollView>
    </View>
  );
}

/* ══════════════════ The Hall of Vaults ══════════════════
   Full-bleed, one sealed vault per screen. The creature is only a shape behind
   the stone; choosing does not hand it over. */
function Hall({ onBack, onWake }: { onBack: () => void; onWake: (k: SpeciesKey) => void }) {
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const ref = useRef<ScrollView>(null);
  const sp = SPECIES[SP_KEYS[i]];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = Math.round(e.nativeEvent.contentOffset.x / width);
    if (n !== i && n >= 0 && n < SP_KEYS.length) { setI(n); buzz(); }
  };
  const go = (n: number) => {
    const k = Math.max(0, Math.min(SP_KEYS.length - 1, n));
    setI(k); buzz();
    ref.current?.scrollTo({ x: k * width, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#04060E' }}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll} scrollEventThrottle={16}>
        {SP_KEYS.map(k => {
          const s2 = SPECIES[k];
          return (
            <View key={k} style={{ width, height }}>
              <LinearGradient colors={s2.env} style={StyleSheet.absoluteFill} />
              <EggPulse source={ART[('egg-' + k) as keyof typeof ART]} width={width} />
              <View style={s.info}>
                <Text style={[s.nm, { color: s2.tint }]}>{s2.n.toUpperCase()}</Text>
                <Text style={[s.el, { color: s2.tint }]}>{s2.icon}   {s2.el.toUpperCase()}</Text>
                <Text style={s.lore2}>{s2.lore}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { buzz(); onBack(); }} style={s.hallBack}>
        <Text style={st.backT}>◀  Back</Text>
      </Pressable>

      {i > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Previous vault"
          onPress={() => go(i - 1)} style={[s.arrow, { left: 12 }]}><Text style={s.arrowT}>‹</Text></Pressable>
      )}
      {i < SP_KEYS.length - 1 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Next vault"
          onPress={() => go(i + 1)} style={[s.arrow, { right: 12 }]}><Text style={s.arrowT}>›</Text></Pressable>
      )}

      {i === 0 && <Text style={s.hint}>SWIPE TO SEE THE OTHER VAULTS</Text>}

      <View style={s.foot}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {SP_KEYS.map((_, n) => (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Vault ${n + 1}`}
              onPress={() => go(n)} hitSlop={10}>
              <View style={[s.hdot, n === i && s.hdotOn]} />
            </Pressable>
          ))}
        </View>
        <Btn label={`Wake ${sp.n}`} wide color={sp.tint} onPress={() => onWake(SP_KEYS[i])} />
      </View>
    </View>
  );
}

/** The sealed vault breathes, so it reads as containing something alive. */
function EggPulse({ source, width }: { source: any; width: number }) {
  const k = useSharedValue(1);
  React.useEffect(() => {
    k.value = withRepeat(withSequence(
      withTiming(1.02, { duration: 2100, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.quad) })), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  return (
    <Animated.Image source={source} style={[{
      position: 'absolute', top: '8%', alignSelf: 'center',
      width: width * 0.96, height: width * 0.96, resizeMode: 'contain',
    }, a]} />
  );
}

function NameIt({ species, kid }: { species: SpeciesKey; kid: string }) {
  const sp = SPECIES[species];
  const [name, setName] = useState(sp.n);
  const finish = useGame(s => s.finish);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#0a0f22', C.bg]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[st.pad, { paddingTop: 68 }]} showsVerticalScrollIndicator={false}>
        <Text style={st.kick}>IT'S AWAKE</Text>
        <Text style={[st.h1, { color: sp.tint, marginTop: 8, fontSize: 34 }]}>You found {sp.n}.</Text>
        <Text style={[st.body, { marginTop: 12, color: '#DCE6FA' }]}>
          {sp.el}. Nobody else dug this one out. It is looking right at you.
        </Text>
        <Image source={ART[(species + '-happy') as keyof typeof ART] ?? ART[(species + '-idle') as keyof typeof ART]}
          style={{ width: '68%', height: 250, resizeMode: 'contain', alignSelf: 'center', marginTop: 6 }} />
        <TextInput value={name} onChangeText={setName} placeholder="Give them a name"
          placeholderTextColor="#5a6b96" style={s.input} returnKeyType="done"
          accessibilityLabel="Name your Vaultling" />
        <View style={s.lore}>
          <Text style={s.loreT}>
            Whatever you name them, that's their name forever. Choose something you'd shout across a playground.
          </Text>
        </View>
        <Btn label={`Take ${sp.n} home  ✦`} wide color={sp.tint}
          onPress={() => { ok(); finish(name.trim().slice(0, 18) || sp.n); }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  b: { color: C.gold, fontWeight: '800' },
  input: { backgroundColor: 'rgba(16,27,56,0.85)', borderColor: 'rgba(160,180,220,0.32)', borderWidth: 1.5,
           borderRadius: R.md, padding: 15, color: C.ink, fontWeight: '800', fontSize: 17, marginVertical: 16 },
  lore: { backgroundColor: 'rgba(16,27,56,0.7)', borderLeftColor: C.gold, borderLeftWidth: 3,
          borderRadius: R.md, padding: 14, marginVertical: 16 },
  loreT: { color: '#DCE6FA', fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  loreS: { color: C.mist, fontSize: 10.5, marginTop: 6 },
  ages: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 16 },
  age: { width: '31%', paddingVertical: 15, borderRadius: R.md, alignItems: 'center',
         backgroundColor: 'rgba(16,27,56,0.85)', borderWidth: 1.5, borderColor: 'rgba(160,180,220,0.28)' },
  ageOn: { borderColor: C.gold, backgroundColor: 'rgba(255,201,77,0.16)' },
  ageT: { color: C.ink, fontSize: 19, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(160,180,220,0.3)' },
  dotOn: { width: 18, backgroundColor: C.gold },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 150, paddingTop: 26,
          backgroundColor: 'rgba(3,6,14,0.72)' },
  nm: { fontSize: 38, fontWeight: '800', letterSpacing: 5 },
  el: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 6, marginBottom: 10 },
  lore2: { color: '#D8E4F7', fontSize: 13.5, lineHeight: 21, maxWidth: 330 },
  hallBack: { position: 'absolute', top: 52, left: 16, paddingHorizontal: 15, paddingVertical: 10,
              borderRadius: R.pill, backgroundColor: 'rgba(6,10,20,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  arrow: { position: 'absolute', top: '34%', width: 46, height: 46, borderRadius: 23,
           alignItems: 'center', justifyContent: 'center',
           backgroundColor: 'rgba(6,10,20,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)' },
  arrowT: { color: C.ink, fontSize: 22, fontWeight: '800', marginTop: -3 },
  hint: { position: 'absolute', top: 108, left: 0, right: 0, textAlign: 'center',
          color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  foot: { position: 'absolute', left: 20, right: 20, bottom: 34, alignItems: 'center' },
  hdot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.26)' },
  hdotOn: { width: 22, backgroundColor: C.gold },
});
