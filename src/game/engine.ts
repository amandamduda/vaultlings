/**
 * The Expedition — pure logic, zero rendering. Unit-testable on any renderer.
 *
 * You start at the bottom of the world and dig UPWARD toward daylight. That
 * direction is the whole product: get to the surface, help your Vaultling grow,
 * learn to fly. The strata are the biomes from the world bible, richest and
 * most dangerous at the bottom where you begin, easing as you climb — so
 * lingering in the deep pays better and getting out is the safe play.
 */
export const COLS = 11, ROWS = 170;
export const EMPTY=0, DIRT=1, ROCK=2, GEM=3, BIGGEM=4, HARD=5;

export type Layer = {
  y:number; name:string;
  /** dirt tone A / B — checkerboard shading */ d1:string; d2:string;
  /** colour of tunnel the player has already dug out */ dark:string;
  /** glowing mineral seam of this stratum */   vein:string;
  spark:number; rock:number; snatch:number;
};
/** Six strata, colours sampled from the locked concept art. Surface at r=0;
 *  the Sovereign Vein at the very bottom is the risk/reward payoff seam. */
export const LAYERS: Layer[] = [
  { y:0,   name:'SURFACE LIGHT',   d1:'#703E17', dark:'#200900', d2:'#8C5A2E', vein:'#FCDE84', spark:0.06, rock:0.05, snatch:0.00 },
  { y:26,  name:'VERDANT ROOT',    d1:'#2C371A', dark:'#060A01', d2:'#45502E', vein:'#C0CD70', spark:0.10, rock:0.09, snatch:0.15 },
  { y:56,  name:'TIDE HOLLOW',     d1:'#13403A', dark:'#000D0B', d2:'#285C54', vein:'#5EE7D7', spark:0.15, rock:0.13, snatch:0.32 },
  { y:90,  name:'EMBER REACH',     d1:'#54160F', dark:'#160000', d2:'#712B1E', vein:'#F76C22', spark:0.21, rock:0.16, snatch:0.48 },
  { y:126, name:'CRYSTAL DEPTHS',  d1:'#450A14', dark:'#110001', d2:'#611A22', vein:'#E31127', spark:0.29, rock:0.20, snatch:0.66 },
  { y:156, name:'THE DEEP',        d1:'#6B4A12', dark:'#1D0F00', d2:'#86652C', vein:'#FFE48A', spark:0.44, rock:0.23, snatch:0.80 },
];
export const layerAt = (r:number) => LAYERS.reduce((a,l)=> r>=l.y ? l : a, LAYERS[0]);

export type Snatcher = { c:number; r:number };
export type GameState = {
  grid: Uint8Array; hidden: Uint8Array;
  px:number; py:number; dx:number; dy:number;
  gems:number; hp:number; blasts:number; climb:number;
  snatchers: Snatcher[]; over:boolean; won:boolean;
};

const idx = (c:number,r:number)=> r*COLS+c;
const inb = (c:number,r:number)=> c>=0 && c<COLS && r>=0 && r<ROWS;

export function newGame(streak:number, rnd:()=>number = Math.random): GameState {
  const grid = new Uint8Array(COLS*ROWS), hidden = new Uint8Array(COLS*ROWS).fill(1);
  for(let r=0;r<ROWS;r++){
    const L = layerAt(r);
    for(let c=0;c<COLS;c++){
      let t:number = DIRT;
      if(r>2){
        const q = rnd();
        if(q < L.rock) t = ROCK;
        else if(q < L.rock + L.spark*0.22) t = BIGGEM;
        else if(q < L.rock + L.spark) t = GEM;
      }
      if(r>4 && rnd()<0.02) t = HARD;
      grid[idx(c,r)] = t;
    }
  }
  // you start at the bottom of the world, in a small pocket of cleared rock
  for(let r=ROWS-3;r<ROWS;r++) for(let c=0;c<COLS;c++){ grid[idx(c,r)]=EMPTY; hidden[idx(c,r)]=0; }
  return { grid, hidden, px:COLS>>1, py:ROWS-2, dx:0, dy:0,
           gems:0, hp:3, blasts:Math.max(1,Math.min(5,Math.floor(streak/4))),
           climb:0, snatchers:[], over:false, won:false };
}

/** Returns events so the renderer can spawn particles / haptics without owning logic. */
export type Ev = { kind:'gem'|'biggem'|'hurt'|'blast'|'win'; c?:number; r?:number };

/** How far above the start you have to get before daylight. */
export const SURFACE_ROW = 2;

export function move(g:GameState, dc:number, dr:number): Ev[] {
  const ev:Ev[] = [];
  const nc=g.px+dc, nr=g.py+dr;
  if(!inb(nc,nr)) return ev;
  const t = g.grid[idx(nc,nr)];
  if(t===HARD) return ev;
  if(t===ROCK){
    if(dr!==0) return ev;                       // can't push a rock vertically
    const bc = nc+dc;
    if(!inb(bc,nr) || g.grid[idx(bc,nr)]!==EMPTY) return ev;
    g.grid[idx(bc,nr)]=ROCK; g.hidden[idx(bc,nr)]=0; g.grid[idx(nc,nr)]=EMPTY;
  }
  if(t===GEM || t===BIGGEM){
    g.gems += t===BIGGEM ? 5 : 1;
    ev.push({ kind: t===BIGGEM?'biggem':'gem', c:nc, r:nr });
  }
  g.grid[idx(nc,nr)]=EMPTY; g.hidden[idx(nc,nr)]=0;
  g.px=nc; g.py=nr;
  // climb is measured from where you started, so it only ever goes up
  g.climb = Math.max(g.climb, (ROWS-2) - nr);
  if(nr<=2){ g.over=true; g.won=true; ev.push({kind:'win'}); }   // daylight
  return ev;
}

/** Gravity: an unsupported rock falls one tile. Dig under it at your own risk. */
export function stepRocks(g:GameState): Ev[] {
  const ev:Ev[]=[];
  for(let r=ROWS-2;r>=0;r--) for(let c=0;c<COLS;c++){
    if(g.grid[idx(c,r)]!==ROCK) continue;
    if(g.grid[idx(c,r+1)]===EMPTY){
      g.grid[idx(c,r)]=EMPTY; g.grid[idx(c,r+1)]=ROCK; g.hidden[idx(c,r+1)]=0;
      if(c===g.px && r+1===g.py) ev.push(...hurt(g));
      g.snatchers = g.snatchers.filter(s=>!(s.c===c && s.r===r+1));
    }
  }
  return ev;
}

export function hurt(g:GameState): Ev[] {
  g.hp--; g.gems = Math.max(0, g.gems-3);
  if(g.hp<=0){ g.over=true; g.won=false; }
  return [{ kind:'hurt', c:g.px, r:g.py }];
}

export function stepSnatchers(g:GameState, rnd:()=>number = Math.random): Ev[] {
  const ev:Ev[]=[];
  for(const s of g.snatchers){
    const dc=Math.sign(g.px-s.c), dr=Math.sign(g.py-s.r), opts:[number,number][]=[];
    if(dc && inb(s.c+dc,s.r) && g.grid[idx(s.c+dc,s.r)]===EMPTY) opts.push([dc,0]);
    if(dr && inb(s.c,s.r+dr) && g.grid[idx(s.c,s.r+dr)]===EMPTY) opts.push([0,dr]);
    if(opts.length){ const [a,b]=opts[Math.floor(rnd()*opts.length)]; s.c+=a; s.r+=b; }
    if(s.c===g.px && s.r===g.py) ev.push(...hurt(g));
  }
  return ev;
}

export function trySpawn(g:GameState, rnd:()=>number = Math.random){
  const L = layerAt(g.py);
  if(rnd() > L.snatch || g.snatchers.length >= 4) return;
  for(let a=0;a<26;a++){
    const r = g.py - 4 - Math.floor(rnd()*10), c = Math.floor(rnd()*COLS);
    if(inb(c,r) && g.grid[idx(c,r)]===EMPTY){ g.snatchers.push({c,r}); return; }
  }
}

export function blast(g:GameState): Ev[] {
  if(g.blasts<=0) return [];
  g.blasts--;
  const R=2.4;
  for(let r=Math.max(0,g.py-3); r<=Math.min(ROWS-1,g.py+3); r++)
    for(let c=Math.max(0,g.px-3); c<=Math.min(COLS-1,g.px+3); c++){
      if(Math.hypot(c-g.px,r-g.py)>R) continue;
      const t=g.grid[idx(c,r)];
      if(t===GEM) g.gems++; else if(t===BIGGEM) g.gems+=5;
      if(t!==HARD){ g.grid[idx(c,r)]=EMPTY; }
      g.hidden[idx(c,r)]=0;
    }
  g.snatchers = g.snatchers.filter(s=>Math.hypot(s.c-g.px,s.r-g.py)>R+1);
  return [{ kind:'blast' }];
}
