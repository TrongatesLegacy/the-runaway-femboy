import { Rng } from './util';
import {
  ACC_COLORS,
  BINGUS_EYES,
  BINGUS_SKINS,
  type BingusKind,
  type BingusLook,
  type PowerKind,
} from './art/things';
import { DECOR_BY_STAGE, GY, type DecorKind } from './art/backgrounds';

export type EType =
  | 'lowpipe'
  | 'tallpipe'
  | 'overpipe'
  | 'vent'
  | 'puddle'
  | 'drop'
  | 'jar'
  | 'bottle'
  | 'blob'
  | 'bingus'
  | 'platform'
  | 'star'
  | 'power'
  | 'decor'
  | 'house';

export interface Ent {
  type: EType;
  x: number;
  y: number; // usually ground/feet y or centre for floating things
  w: number;
  h: number;
  vx: number;
  vy: number;
  seed: number;
  t: number;
  dead: boolean;
  hitDone: boolean;
  style?: string;
  // bingus
  kind?: BingusKind;
  look?: BingusLook;
  squash?: number;
  flying?: boolean;
  spin?: number;
  vr?: number;
  baseY?: number;
  boxOpen?: number;
  // misc
  big?: boolean;
  power?: PowerKind;
  decor?: DecorKind;
  nozzle?: boolean;
  timer?: number;
  phase?: number;
  hint?: string;
  hintShown?: boolean;
  rot?: number;
  stage?: number;
}

export function ent(type: EType, x: number, y: number, w: number, h: number, extra: Partial<Ent> = {}): Ent {
  return { type, x, y, w, h, vx: 0, vy: 0, seed: Math.floor(Math.random() * 1000), t: 0, dead: false, hitDone: false, ...extra };
}

export function randomLook(rng: Rng): BingusLook {
  const sk = rng.pick(BINGUS_SKINS);
  const accs: BingusLook['acc'][] = ['none', 'sweater', 'sweater', 'bow', 'bandana', 'hat', 'collar'];
  const [c1, c2] = rng.pick(ACC_COLORS);
  return { ...sk, eye: rng.pick(BINGUS_EYES), acc: rng.pick(accs), accColor: c1, accColor2: c2 };
}

export function makeBingus(rng: Rng, kind: BingusKind, x: number): Ent {
  const look = randomLook(rng);
  const e = ent('bingus', x, GY, 56, 46, { kind, look, squash: 0, flying: false, spin: 0, vr: 0, phase: rng.range(0, 6) });
  switch (kind) {
    case 'walk':
      e.vx = -rng.range(55, 95);
      break;
    case 'hop':
      e.vx = -rng.range(70, 110);
      e.timer = rng.range(0.2, 0.8);
      break;
    case 'chonk':
      e.vx = -35;
      e.w = 82;
      e.h = 66;
      break;
    case 'box':
      e.vx = 0;
      e.w = 66;
      e.h = 44;
      e.boxOpen = 0;
      break;
    case 'balloon':
      e.vx = -40;
      e.baseY = GY - rng.range(120, 150);
      e.y = e.baseY;
      e.h = 44;
      break;
  }
  return e;
}

/** A pattern spawns entities starting at x and returns how much world length it occupies. */
type Pattern = (x: number, ctx: GenCtx) => number;

export interface GenCtx {
  rng: Rng;
  stage: number;
  diff: number; // 0..1 over the whole run
  speed: number;
  out: Ent[];
}

const airLen = (speed: number) => speed * 0.78; // horizontal distance of one jump

function starArc(g: GenCtx, x: number, w: number, peak: number, n: number) {
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1);
    g.out.push(ent('star', x + k * w, GY - 60 - Math.sin(k * Math.PI) * peak, 26, 26));
  }
}
function starLine(g: GenCtx, x: number, y: number, n: number, gap = 52) {
  for (let i = 0; i < n; i++) g.out.push(ent('star', x + i * gap, y, 26, 26));
}

const P: Record<string, Pattern> = {
  lowpipe(x, g) {
    const w = g.rng.range(80, 150);
    const h = g.rng.range(56, 92 + g.diff * 18);
    g.out.push(ent('lowpipe', x, GY, w, h, { style: g.rng.pick(STYLE[g.stage]) }));
    starArc(g, x - 60, w + 120, h + 90, 5);
    return w + 120;
  },
  lowpipe2(x, g) {
    const a = P.lowpipe(x, g);
    const gap = airLen(g.speed) * g.rng.range(1.05, 1.5);
    const b = P.lowpipe(x + a + gap - 120, g);
    return a + gap + b - 120;
  },
  tall(x, g) {
    const w = g.rng.range(54, 70);
    const h = g.rng.range(165, 205);
    g.out.push(ent('tallpipe', x, GY, w, h, { style: g.rng.pick(STYLE[g.stage]) }));
    g.out.push(ent('star', x + w / 2, GY - h - 70, 40, 40, { big: g.rng.chance(0.35) }));
    return w + 160;
  },
  over(x, g) {
    const w = g.rng.range(200, 380);
    g.out.push(ent('overpipe', x, GY - 112, w, 600, { style: g.rng.pick(STYLE[g.stage]), nozzle: g.rng.chance(0.65), timer: g.rng.range(0, 1) }));
    starLine(g, x + 20, GY - 40, Math.floor(w / 55));
    return w + 120;
  },
  overPuddle(x, g) {
    const a = P.over(x, g);
    const pw = g.rng.range(90, 140);
    g.out.push(ent('puddle', x + a + 40, GY, pw, 14));
    return a + pw + 140;
  },
  bingus(x, g) {
    const n = 1 + (g.rng.chance(0.3 + g.diff * 0.4) ? 1 : 0) + (g.rng.chance(g.diff * 0.35) ? 1 : 0);
    const kinds: BingusKind[] = g.stage === 0 ? ['walk'] : g.stage === 1 ? ['walk', 'hop', 'walk'] : ['walk', 'hop', 'hop'];
    let cx = x;
    for (let i = 0; i < n; i++) {
      g.out.push(makeBingus(g.rng, g.rng.pick(kinds), cx + 40));
      cx += g.rng.range(230, 320);
    }
    return cx - x + 80;
  },
  chonk(x, g) {
    g.out.push(makeBingus(g.rng, 'chonk', x + 60));
    starLine(g, x - 20, GY - 330, 4, 50);
    return 300;
  },
  box(x, g) {
    g.out.push(makeBingus(g.rng, 'box', x + 30));
    starArc(g, x - 50, 180, 90, 3);
    return 220;
  },
  balloon(x, g) {
    const n = g.rng.int(1, 2);
    for (let i = 0; i < n; i++) g.out.push(makeBingus(g.rng, 'balloon', x + 60 + i * 260));
    return n * 260 + 120;
  },
  puddle(x, g) {
    const n = g.rng.int(1, 2);
    let cx = x;
    for (let i = 0; i < n; i++) {
      const w = g.rng.range(90, 150);
      g.out.push(ent('puddle', cx, GY, w, 14));
      cx += w + airLen(g.speed) * g.rng.range(0.9, 1.4);
    }
    return cx - x;
  },
  jars(x, g) {
    const n = g.rng.int(1, 1 + Math.round(g.diff * 2));
    for (let i = 0; i < n; i++) {
      g.out.push(ent('jar', x + 200 + i * 300, GY - 26, 48, 48, { vx: -g.rng.range(140, 220), rot: 0 }));
    }
    return n * 300 + 200;
  },
  vent(x, g) {
    const w = g.rng.range(70, 100);
    g.out.push(ent('vent', x, GY, w, 150, { phase: g.rng.range(0, 1), timer: 0 }));
    starArc(g, x - 40, w + 80, 120, 3);
    return w + 220;
  },
  bottle(x, g) {
    g.out.push(ent('bottle', x + 520, GY, 40, 70, { timer: g.rng.range(0.3, 0.9) }));
    return 640;
  },
  platforms(x, g) {
    const n = g.rng.int(2, 3);
    let cx = x;
    let y = GY - g.rng.range(150, 185);
    for (let i = 0; i < n; i++) {
      const w = g.rng.range(170, 260);
      g.out.push(ent('platform', cx, y, w, 18));
      starLine(g, cx + 25, y - 40, Math.floor(w / 60));
      cx += w + g.rng.range(110, 170);
      y = Math.max(GY - 300, Math.min(GY - 140, y + g.rng.range(-90, 60)));
    }
    // something underneath to make the high road worthwhile
    if (g.rng.chance(0.7)) g.out.push(makeBingus(g.rng, g.stage === 0 ? 'walk' : g.rng.pick(['walk', 'hop'] as BingusKind[]), x + (cx - x) * 0.5));
    if (g.rng.chance(0.5)) g.out.push(ent('puddle', x + (cx - x) * 0.25, GY, 120, 14));
    return cx - x;
  },
  pipeBingus(x, g) {
    const a = P.lowpipe(x, g);
    g.out.push(makeBingus(g.rng, 'walk', x + a + airLen(g.speed) * 0.9 + 120));
    return a + airLen(g.speed) * 0.9 + 260;
  },
  breather(x, g) {
    // calm stretch with a star wave
    const n = 7;
    for (let i = 0; i < n; i++) g.out.push(ent('star', x + i * 60, GY - 70 - Math.sin(i * 0.9) * 50, 26, 26));
    return 480;
  },
};

const STYLE: string[][] = [
  ['copper', 'steel', 'green'],
  ['red', 'copper', 'steel'],
  ['violet', 'steel', 'red'],
];

const WEIGHTS: Record<string, number[]> = {
  // stage 1, 2, 3
  lowpipe: [5, 3, 2],
  lowpipe2: [1, 2, 2],
  tall: [2, 2, 3],
  over: [3, 2, 2],
  overPuddle: [1, 2, 2],
  bingus: [4, 4, 4],
  chonk: [0, 2, 2],
  box: [1, 2, 1],
  balloon: [0, 1, 3],
  puddle: [2, 2, 2],
  jars: [1, 2, 2],
  vent: [2, 0, 2],
  bottle: [0, 2, 2],
  platforms: [2, 2, 3],
  pipeBingus: [1, 2, 3],
  breather: [1, 1, 1],
};

export function pickPattern(g: GenCtx, last: string): string {
  let total = 0;
  const entries: [string, number][] = [];
  for (const [k, w] of Object.entries(WEIGHTS)) {
    let wt = w[g.stage];
    if (k === last) wt *= 0.25;
    if (wt > 0) {
      entries.push([k, wt]);
      total += wt;
    }
  }
  let r = g.rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

export function runPattern(name: string, x: number, g: GenCtx) {
  return P[name](x, g);
}

/** Scripted opening teaching each verb. */
export const TUTORIAL: { pat: string; hint: string }[] = [
  { pat: 'lowpipe', hint: 'jump' },
  { pat: 'over', hint: 'slide' },
  { pat: 'bingus', hint: 'stomp' },
  { pat: 'puddle', hint: 'mayo' },
  { pat: 'tall', hint: 'double' },
];

export function decorFor(rng: Rng, stage: number, x: number): Ent {
  const kind = rng.pick(DECOR_BY_STAGE[stage]);
  return ent('decor', x, GY, 40, 40, { decor: kind, seed: rng.int(0, 999), stage });
}
