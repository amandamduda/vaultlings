/** Vaultlings design tokens — Midnight Sapphire.
 *  Chrome stays constant; only the cave changes colour as the child climbs. */
export const C = {
  bg: '#060B18', surface: '#0F1B3D', surface2: '#1D2F5E',
  line: 'rgba(160,180,220,0.20)', ink: '#EAF0FF', mist: '#93A5CF',
  gold: '#FFC94D', teal: '#4FD8C4', money: '#8FE3B0',
  coral: '#FF7A59', heart: '#FF7A93',
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const R = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
/** Apple HIG minimum interactive size. Enforced on every pressable. */
export const HIT = 44;

export const F = {
  /** System rounded reads as friendly without shipping a font file. */
  display: undefined as string | undefined,
} as const;

export type SpeciesKey = 'fen' | 'nix' | 'pyrin' | 'orin' | 'gemmi';

export const SPECIES: Record<SpeciesKey, {
  n: string; el: string; icon: string; tint: string; lore: string; env: [string, string];
}> = {
  fen:   { n: 'Fen',   el: 'The Verdant Vaultling', icon: '🌿', tint: '#8FBF5A',
           lore: 'Fen tends the Rootlight Groves, where ancient seeds sleep in the dark earth. They nurture growth and keep the underground forests in balance.',
           env: ['#2C4A21', '#0B1608'] },
  nix:   { n: 'Nix',   el: 'The Tide Vaultling', icon: '💧', tint: '#5FB6E8',
           lore: 'Nix swims the subterranean seas and bubble-caves. They collect waters from hidden springs and bring calm to the shifting currents.',
           env: ['#123C5E', '#050F1C'] },
  pyrin: { n: 'Pyrin', el: 'The Ember Vaultling', icon: '🔥', tint: '#FF7A3C',
           lore: 'Pyrin lives in the Molten Veins, where they stoke the forges of the deep. Their embers craft and purify the metals of old.',
           env: ['#5E2408', '#170603'] },
  orin:  { n: 'Orin',  el: 'The Crystal Vaultling', icon: '💎', tint: '#7FC8E8',
           lore: 'Orin guards the Crystal Chambers and listens to the songs of stone. They store memories and map the hidden passages below.',
           env: ['#12455C', '#040F17'] },
  gemmi: { n: 'Gemmi', el: 'The Geode Vaultling', icon: '🔮', tint: '#B98FE0',
           lore: 'Gemmi seeks out pressure and patience. They form geodes and refine raw minerals into treasures that shine from within.',
           env: ['#3A2358', '#100818'] },
};
export const SP_KEYS = Object.keys(SPECIES) as SpeciesKey[];

export type Dwelling = {
  n: string; cost: number; depth: number;
  /** applied to the one room photograph, so ten homes need no extra art */
  hue: number; sat: number; bri: number;
  glow: string; blurb: string;
};
export const DWELLINGS: Dwelling[] = [
  { n: 'The Damp Hollow',   cost: 0,   depth: -120, hue: -42, sat: 0.80, bri: 0.40, glow: '#E31127', blurb: 'A wet crack in the rock. One dripping stalactite. It is yours.' },
  { n: 'Pebble Nook',       cost: 40,  depth: -108, hue: -34, sat: 0.85, bri: 0.48, glow: '#F23C31', blurb: 'You swept it out and found three shiny pebbles. Progress.' },
  { n: 'The Cinder Step',   cost: 70,  depth: -96,  hue: -16, sat: 0.95, bri: 0.57, glow: '#F76C22', blurb: 'A seam of ember-rock keeps the floor warm all night.' },
  { n: 'Firelight Ledge',   cost: 110, depth: -84,  hue: -8,  sat: 1.00, bri: 0.66, glow: '#F1945D', blurb: 'Wide enough to turn all the way around. The walls glow orange.' },
  { n: 'Crystal Pocket',    cost: 160, depth: -70,  hue: 140, sat: 0.85, bri: 0.74, glow: '#5EE7D7', blurb: 'The walls hum. Teal crystals light this one for free.' },
  { n: 'The Singing Vault', cost: 220, depth: -58,  hue: 132, sat: 0.90, bri: 0.82, glow: '#84ECCE', blurb: 'Every crystal rings a different note when your Vaultling taps it.' },
  { n: 'Mossy Alcove',      cost: 300, depth: -44,  hue: 34,  sat: 0.78, bri: 0.88, glow: '#D7E587', blurb: 'Something green is growing. Green means water. Water means life.' },
  { n: 'The Root Hall',     cost: 400, depth: -30,  hue: 26,  sat: 0.84, bri: 0.94, glow: '#E4E88C', blurb: 'Tree roots come through the ceiling. The surface is close now.' },
  { n: 'Skylight Terrace',  cost: 520, depth: -16,  hue: 10,  sat: 1.00, bri: 1.00, glow: '#FFE48A', blurb: 'A crack above lets real daylight in. The wind smells like rain.' },
  { n: 'Sunspire',          cost: 700, depth: 0,    hue: 14,  sat: 1.06, bri: 1.10, glow: '#FFED9A', blurb: 'Sunlight all day. Where a Vaultling becomes a Sovereign.' },
];

export const WEAR = [
  { k: 'crown',  e: '👑', n: 'Crown',    cost: 30, perk: 'Milestone flex — no gameplay effect' },
  { k: 'shades', e: '🕶️', n: 'Shades',   cost: 25, perk: 'Instantly 5 years cooler' },
  { k: 'scarf',  e: '🧣', n: 'Scarf',    cost: 15, perk: 'Cosy. Purely cosy.' },
  { k: 'hat',    e: '🎩', n: 'Top Hat',  cost: 22, perk: 'For formal digging' },
  { k: 'helm',   e: '🪖', n: 'Helm',     cost: 28, perk: '+1 heart in the Dig' },
  { k: 'lamp',   e: '🏮', n: 'Lantern',  cost: 35, perk: 'Wider light underground' },
];
export const DECOR = [
  { k: 'bed',      e: '🛏️', n: 'Cosy Bed',    cost: 20, perk: 'Happy drains 20% slower' },
  { k: 'fern',     e: '🪴', n: 'Cave Fern',   cost: 14, perk: 'Looks lovely' },
  { k: 'lanterns', e: '🕯️', n: 'Lanterns',    cost: 18, perk: 'Brightens the room a level early' },
  { k: 'portrait', e: '🖼️', n: 'Portrait',    cost: 16, perk: 'Family photo on the wall' },
  { k: 'mirror',   e: '🪞', n: 'Gold Mirror', cost: 26, perk: 'Doubles the shine' },
  { k: 'chest',    e: '🧸', n: 'Toy Chest',   cost: 22, perk: 'Play gives +2 Happy' },
];
export const REAL = [
  { e: '✨', n: 'Star Aura', p: '$1.99' },
  { e: '🌈', n: 'Prism Wings', p: '$2.99' },
  { e: '👟', n: 'Sky Boots', p: '$0.99' },
];

/* ────────────────────────────────────────────────────────────────────────────
 * THE DEN
 *
 * Each Vaultling's home is one ultra-wide painting, roughly nine screens
 * across. The child does not navigate a tab bar; they walk their room. The
 * camera rests at one of three stations and every destination is an object
 * that is actually painted there — the tunnel mouth, the shelf of jars, the
 * family banner.
 *
 * All positions are fractions of the panorama's width and height, so they hold
 * for all five dens even though the paintings are not the same width.
 * ──────────────────────────────────────────────────────────────────────────── */

/** width ÷ height of each den painting, needed to size the pan */
export const DEN_ASPECT: Record<SpeciesKey, number> = {
  fen: 7.706, nix: 8.250, pyrin: 9.029, orin: 9.534, gemmi: 8.771,
};

/** Where the camera comes to rest. Swiping moves one station at a time, so a
 *  destination can never end up half off-screen. */
export const STATIONS = [
  { k: 'tunnel', x: 0.085, name: 'The Tunnel' },
  { k: 'nest',   x: 0.490, name: 'The Nest' },
  { k: 'shelf',  x: 0.897, name: 'The Shelf' },
] as const;
export type StationKey = typeof STATIONS[number]['k'];
export const HOME_STATION = 1;

/** Where the Vaultling sleeps, in panorama fractions. */
export const NEST = { x: 0.490, floor: 0.885 };

export const AREAS = [
  { k: 'dig',    icon: '⛏️', label: 'Dig',     station: 'tunnel', x: 0.085, y: 0.56,
    hint: 'the tunnel out of the den' },
  { k: 'jars',   icon: '💰', label: 'My Jars', station: 'shelf',  x: 0.850, y: 0.62,
    hint: 'three jars on the shelf' },
  { k: 'market', icon: '🏺', label: 'Market',  station: 'shelf',  x: 0.897, y: 0.50,
    hint: 'the trading table' },
  { k: 'family', icon: '💌', label: 'Family',  station: 'shelf',  x: 0.945, y: 0.34,
    hint: 'your family banner' },
] as const;
export type AreaKey = typeof AREAS[number]['k'];

/** How much of the screen height the sharp painting occupies. Everything
 *  outside it is the same painting, blown up and blurred, so the light in the
 *  room reaches the edges of the phone. */
export const BAND_H = 0.42;
export const BAND_BOTTOM = 0.735;

export const money = (n: number) => '$' + Number(n).toFixed(2);
