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
  biome: string; n: string; el: string; icon: string; tint: string; lore: string; env: [string, string];
}> = {
  fen:   { biome: 'Verdant Root', n: 'Fen',   el: 'The Verdant Vaultling', icon: '🌿', tint: '#8FBF5A',
           lore: 'Fen tends the Rootlight Groves, where ancient seeds sleep in the dark earth. They nurture growth and keep the underground forests in balance.',
           env: ['#2C4A21', '#0B1608'] },
  nix:   { biome: 'Tide Hollow', n: 'Nix',   el: 'The Tide Vaultling', icon: '💧', tint: '#5FB6E8',
           lore: 'Nix swims the subterranean seas and bubble-caves. They collect waters from hidden springs and bring calm to the shifting currents.',
           env: ['#123C5E', '#050F1C'] },
  pyrin: { biome: 'Ember Reach', n: 'Pyrin', el: 'The Ember Vaultling', icon: '🔥', tint: '#FF7A3C',
           lore: 'Pyrin lives in the Molten Veins, where they stoke the forges of the deep. Their embers craft and purify the metals of old.',
           env: ['#5E2408', '#170603'] },
  orin:  { biome: 'Crystal Depths', n: 'Orin',  el: 'The Crystal Vaultling', icon: '💎', tint: '#7FC8E8',
           lore: 'Orin guards the Crystal Chambers and listens to the songs of stone. They store memories and map the hidden passages below.',
           env: ['#12455C', '#040F17'] },
  gemmi: { biome: 'The Deep', n: 'Gemmi', el: 'The Geode Vaultling', icon: '🔮', tint: '#B98FE0',
           lore: 'Gemmi seeks out pressure and patience. They form geodes and refine raw minerals into treasures that shine from within.',
           env: ['#3A2358', '#100818'] },
};
export const SP_KEYS = Object.keys(SPECIES) as SpeciesKey[];

/**
 * The habitat ladder.
 *
 * Ten homes between the deep dark and daylight, and the depth figure is the
 * point: the ladder climbs toward the surface, which is the north star of the
 * whole product. Prices follow the economy spec — a decoration is 75 gems, so a
 * home is a real commitment measured in weeks, not an afternoon.
 *
 * Habitat is a secondary loop. Nothing here gates care, expeditions or money.
 */
export type Habitat = {
  n: string; cost: number; depth: number;
  glow: string; blurb: string;
};
export const HABITATS: Habitat[] = [
  { n: 'The Damp Hollow',   cost: 0,    depth: -120, glow: '#E31127', blurb: 'A wet crack in the rock. One dripping stalactite. It is yours.' },
  { n: 'Pebble Nook',       cost: 90,   depth: -108, glow: '#F23C31', blurb: 'You swept it out and found three shiny pebbles. Progress.' },
  { n: 'The Cinder Step',   cost: 170,  depth: -96,  glow: '#F76C22', blurb: 'A seam of ember-rock keeps the floor warm all night.' },
  { n: 'Firelight Ledge',   cost: 280,  depth: -84,  glow: '#F1945D', blurb: 'Wide enough to turn all the way around. The walls glow orange.' },
  { n: 'Crystal Pocket',    cost: 420,  depth: -70,  glow: '#5EE7D7', blurb: 'The walls hum. Teal crystals light this one for free.' },
  { n: 'The Singing Vault', cost: 600,  depth: -58,  glow: '#84ECCE', blurb: 'Every crystal rings a different note when your Vaultling taps it.' },
  { n: 'Mossy Alcove',      cost: 820,  depth: -44,  glow: '#D7E587', blurb: 'Something green is growing. Green means water. Water means life.' },
  { n: 'The Root Hall',     cost: 1080, depth: -30,  glow: '#E4E88C', blurb: 'Tree roots come through the ceiling. The surface is close now.' },
  { n: 'Skylight Terrace',  cost: 1400, depth: -16,  glow: '#FFE48A', blurb: 'A crack above lets real daylight in. The wind smells like rain.' },
  { n: 'Sunspire',          cost: 1800, depth: 0,    glow: '#FFED9A', blurb: 'Sunlight all day. Where a Vaultling first opens its wings.' },
];

/**
 * A Vaultling's life, measured in Bond.
 *
 * Bond only ever rises and is capped at six a day, so this ladder is weeks and
 * months of showing up — it cannot be bought and it cannot be rushed. The last
 * rung is not on the ladder at all: Surface Form is earned by getting your
 * Vaultling out of the cave, which is the whole point of the game.
 */
export type Stage = { k: string; n: string; at: number; blurb: string };
export const STAGES: Stage[] = [
  { k: 'hatchling',  n: 'Hatchling',    at: 0,   blurb: 'Just out of the vault. Tiny, loud, and yours.' },
  { k: 'youngling',  n: 'Youngling',    at: 40,  blurb: 'Starting to show you who they are.' },
  { k: 'adventurer', n: 'Adventurer',   at: 100, blurb: 'Old enough to come with you on expeditions.' },
  { k: 'guardian',   n: 'Guardian',     at: 190, blurb: 'Knows this cave better than you do.' },
  { k: 'elder',      n: 'Elder',        at: 320, blurb: 'Rare, and remembers everything.' },
  { k: 'surface',    n: 'Surface Form', at: 999, blurb: 'It saw the sky. It flew.' },
];

/** Cosmetics, priced to the spec: a rare cosmetic is 100–500 gems. None of
 *  these change how hard the game is; the Helm and the Lantern help in the cave
 *  but nothing here is required to finish anything. */
export const WEAR = [
  { k: 'scarf',  e: '🧣', n: 'Scarf',    cost: 60,  perk: 'Cosy. Purely cosy.' },
  { k: 'shades', e: '🕶️', n: 'Shades',   cost: 110, perk: 'Instantly 5 years cooler' },
  { k: 'hat',    e: '🎩', n: 'Top Hat',  cost: 150, perk: 'For formal excavating' },
  { k: 'helm',   e: '🪖', n: 'Helm',     cost: 200, perk: '+1 heart on an expedition' },
  { k: 'lamp',   e: '🏮', n: 'Lantern',  cost: 260, perk: 'Your light reaches further underground' },
  { k: 'crown',  e: '👑', n: 'Crown',    cost: 400, perk: 'A milestone. No effect at all, and that is the point.' },
];

/** Habitat decorations, base 75 gems per the spec. The habitat is the visual
 *  record of the journey, so these are earned rather than bought with money. */
export const DECOR = [
  { k: 'fern',     e: '🪴', n: 'Cave Fern',   cost: 60,  perk: 'Something alive down here' },
  { k: 'portrait', e: '🖼️', n: 'Portrait',    cost: 75,  perk: 'Your family, on the wall' },
  { k: 'lanterns', e: '🕯️', n: 'Lanterns',    cost: 95,  perk: 'Warmer light in the den' },
  { k: 'bed',      e: '🛏️', n: 'Cosy Bed',    cost: 130, perk: 'A proper place to sleep' },
  { k: 'chest',    e: '🧸', n: 'Toy Chest',   cost: 160, perk: 'Play gives a little more Bond' },
  { k: 'mirror',   e: '🪞', n: 'Gold Mirror', cost: 220, perk: 'Doubles the shine' },
];

/**
 * Real-money cosmetics — a preview, not a shop.
 *
 * The economy spec lists in-app Fun redemption as an open decision, pending the
 * financial architecture and partner rails. Until that is settled nothing here
 * charges anything: the grown-up gate opens onto an explanation, not a
 * purchase. Keeping it visible lets the concept be shown without a child ever
 * meeting a real payment.
 */
export const REAL = [
  { e: '✨', n: 'Star Aura',   p: '$1.99' },
  { e: '🌈', n: 'Prism Wings', p: '$2.99' },
  { e: '👟', n: 'Sky Boots',   p: '$0.99' },
];
export const REAL_LIVE = false;

/* ────────────────────────────────────────────────────────────────────────────
 * THE DEN
 *
 * Each Vaultling's home is one painting that fills the whole screen and runs
 * about fourteen screens wide. The child does not navigate a tab bar; they
 * walk their room. The camera rests at one of four stations and every
 * destination is an object that is actually painted there — the tunnel mouth,
 * the trading table, the shelf of wares, the family crest.
 *
 * The paintings arrive as a wide strip, so the ceiling above and the floor
 * below are grown from the painting's own edges before they ship. That is why
 * there is no flat colour anywhere: the cave reaches all four edges of the
 * glass.
 *
 * X positions are fractions of the painting's width, Y of its height, so they
 * hold for all five dens even though the paintings are not the same width.
 * ──────────────────────────────────────────────────────────────────────────── */

/** width ÷ height of each den painting, needed to size the pan */
export const DEN_ASPECT: Record<SpeciesKey, number> = {
  fen: 5.378, nix: 6.383, pyrin: 6.078, orin: 6.671, gemmi: 6.671,
};

/** Where the camera comes to rest. Swiping moves one station at a time, so a
 *  destination can never end up half off-screen. */
export const STATIONS = [
  { k: 'tunnel', x: 0.075, name: 'The Tunnel' },
  { k: 'nest',   x: 0.500, name: 'The Nest' },
  { k: 'shelf',  x: 0.831, name: 'The Shelf' },
  { k: 'crest',  x: 0.928, name: 'The Crest' },
] as const;
export type StationKey = typeof STATIONS[number]['k'];
export const HOME_STATION = 1;

/** Where the Vaultling stands, and the line its feet rest on. */
export const NEST = { x: 0.500, floor: 0.617 };

export const AREAS = [
  { k: 'dig',    icon: '⛏️', label: 'Expedition', station: 'tunnel', x: 0.075, y: 0.470,
    hint: 'the tunnel that leads up and out' },
  { k: 'market', icon: '🏺', label: 'Market',  station: 'shelf',  x: 0.819, y: 0.487,
    hint: 'the trading table' },
  { k: 'jars',   icon: '💰', label: 'My Jars', station: 'shelf',  x: 0.849, y: 0.497,
    hint: 'your three jars on the shelf' },
  { k: 'family', icon: '💌', label: 'Family',  station: 'crest',  x: 0.928, y: 0.415,
    hint: 'your family crest' },
] as const;
export type AreaKey = typeof AREAS[number]['k'];

export const money = (n: number) => '$' + Number(n).toFixed(2);
