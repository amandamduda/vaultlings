# Vaultlings

A kids' financial-literacy game for iOS. A child raises a mythological creature
whose wellbeing responds to real money habits — allowance arrives, gets split
across three jars, and the creature's home climbs out of the dark as they save.

Ages 8–14. Built for Apple's Kids Category: no third-party analytics, no ads,
no data collection, and a grown-up gate in front of anything involving real money.

## The shape of it

There is no tab bar. The den **is** the navigator. Each Vaultling's home is one
ultra-wide painting about nine screens across; the child swipes along it and taps
the thing they want. The tunnel mouth is the Dig. The shelf holds the jars. The
banner on the wall is Family. Tilting the phone shifts the room a little, so it
reads as a place rather than a screen.

```
Onboarding ──▶ Hall of Vaults ──▶ Excavate ──▶ Name it ──▶ THE DEN
                (pick a vault)     (unbury it)              │
                                                            ├─ ⛏  Dig     (the minigame)
                                                            ├─ 💰 My Jars (Care / Fun / Grow)
                                                            ├─ 🏺 Market  (gems, homes, real money)
                                                            └─ 💌 Family  (jobs, gifts, praise)
```

## Two currencies that never touch

Gems (`◆`) are earned in the Dig and by answering the people who cheered you on.
Dollars (`$`) are real, arrive from a grown-up, and every path that spends them
stops at a parental gate. **No code path converts one into the other**, in either
direction — that fence is the product, and it is worth protecting in review.

## Layout

```
App.tsx               root; the den is the navigator, areas are rooms you step into
src/theme.ts          design tokens, the five species, ten dwellings, den geometry
src/store.ts          zustand + persist, all game state and every mutation
src/logic/day.ts      elapsed-time settlement — needs decay, streaks, allowance
src/game/engine.ts    Deep Dig rules; pure, no rendering, unit-testable
src/Creature.tsx      the animated Vaultling: pose sheet + reanimated performances
src/ui.tsx            Card / Row / Btn / Stepper / ParentGate and shared styles
src/screens/          Onboarding · Excavate · Den · Areas · Dig
assets/art/           66 images — 30 poses, 10 vaults, 5 silhouettes, 5 dens
```

`logic/day.ts` and `game/engine.ts` are deliberately free of React. They are the
two places where a bug quietly costs a child their streak or their allowance, so
they are pure functions that can be tested without a renderer.

## Running it

```bash
npm install
npx expo prebuild -p ios      # first time, or after adding a native dependency
npx expo run:ios              # builds and launches on the simulator
```

During development the app answers a few URLs so any screen can be reached
without tapping through onboarding. These are `__DEV__`-only:

```bash
xcrun simctl openurl booted "com.vaultlings.app://go/den?seed=1"   # skip onboarding
xcrun simctl openurl booted "com.vaultlings.app://go/den?st=2"     # den, at the shelf
xcrun simctl openurl booted "com.vaultlings.app://go/market"       # any area
xcrun simctl openurl booted "com.vaultlings.app://go/den?reveal=pyrin"
xcrun simctl openurl booted "com.vaultlings.app://go/den?reset=1"  # wipe the save
```

## Before submission

- Privacy policy URL (required for the Kids Category — the manifest is already in `app.json`)
- Age rating set to 9+, "Made for Kids" declared
- Re-render Pyrin's pose sheet: three frames currently fall back to idle
