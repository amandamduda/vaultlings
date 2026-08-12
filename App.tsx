import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useGame } from './src/store';
import { C, type AreaKey, type SpeciesKey } from './src/theme';
import Onboarding from './src/screens/Onboarding';
import Den from './src/screens/Den';
import { Jars, Market, Family } from './src/screens/Areas';
import Dig from './src/screens/Dig';
import Excavate from './src/screens/Excavate';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Vaultlings.
 *
 * There is no tab bar and no stack navigator. The den *is* the navigator: the
 * child walks their room and taps the thing they want. An area is a room they
 * stepped into, and the only way out is back to the den — which is why every
 * area screen takes an onBack and nothing else.
 */
export default function App() {
  const onboarded = useGame(s => s.onboarded);
  const hydrated = useHydrated();
  const [area, setArea] = useState<AreaKey | null>(null);
  const [station, setStation] = useState<number | undefined>(undefined);
  const [reveal, setReveal] = useState<SpeciesKey | null>(null);

  useEffect(() => { if (hydrated) SplashScreen.hideAsync().catch(() => {}); }, [hydrated]);
  useDevRoutes(setArea, setStation, setReveal);

  if (!hydrated) return <View style={styles.root} />;

  const back = () => setArea(null);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle="light-content" />
      {reveal ? <Excavate species={reveal} onDone={() => setReveal(null)} />
        : !onboarded ? <Onboarding />
        : area === 'jars' ? <Jars onBack={back} />
        : area === 'market' ? <Market onBack={back} />
        : area === 'family' ? <Family onBack={back} />
        : area === 'dig' ? <Dig onBack={back} />
        : <Den key={`den-${station ?? 'h'}`} onEnter={setArea} initialStation={station} />}
    </GestureHandlerRootView>
  );
}

/**
 * A door for the simulator, open only in development.
 *
 *   xcrun simctl openurl booted "com.vaultlings.app://go/market"
 *   xcrun simctl openurl booted "com.vaultlings.app://go/den?seed=1"
 *
 * It jumps to a screen so every state can be photographed without a human
 * tapping through five minutes of onboarding. Stripped from release builds by
 * the __DEV__ guard, and it can only reach screens a child can already reach.
 */
function useDevRoutes(setArea: (a: AreaKey | null) => void,
                      setStation: (n: number | undefined) => void,
                      setReveal: (s: SpeciesKey | null) => void) {
  useEffect(() => {
    if (!__DEV__) return;
    const handle = (url: string | null) => {
      if (!url) return;
      const m = /:\/\/go\/([a-z]+)/.exec(url);
      if (!m) return;
      const g = useGame.getState();
      if (url.includes('seed=1') && !g.onboarded) {
        g.setKid('Amanda', 9); g.chooseSpecies('orin'); g.finish('Pip');
      }
      if (url.includes('reset=1')) { g.reset(); setArea(null); return; }
      const rv = /[?&]reveal=([a-z]+)/.exec(url);
      setReveal(rv ? (rv[1] as SpeciesKey) : null);
      const st = /[?&]st=(\d)/.exec(url);
      setStation(st ? Number(st[1]) : undefined);
      const k = m[1];
      setArea(k === 'den' ? null : (k as AreaKey));
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', e => handle(e.url));
    return () => sub.remove();
  }, []);
}

/** Nothing may render off a half-loaded save — a child seeing their gems at
 *  zero for one frame is a child who thinks they lost them. */
function useHydrated() {
  const [ready, setReady] = useState(useGame.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    const un = useGame.persist.onFinishHydration(() => setReady(true));
    // a save that never resolves must not trap the app on a blank screen
    const t = setTimeout(() => setReady(true), 2500);
    return () => { un(); clearTimeout(t); };
  }, [ready]);
  return ready;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});
