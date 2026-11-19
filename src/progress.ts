import { storage } from './util';
import { OUTFITS, type OutfitId } from './art/outfits';

export type EndingId = 'win' | 'molded' | 'mayo' | 'secret' | 'furry' | 'coma';

export interface Totals {
  stars: number;
  stomps: number;
  slaps: number;
  pearSmashes: number;
  pickles: number;
  pipes: number;
  rice: number;
  runs: number;
}

export interface Profile {
  totals: Totals;
  endings: Partial<Record<EndingId, number>>;
  unlocked: OutfitId[];
  outfit: OutfitId;
}

const KEY = 'trf.profile.v1';

const blank = (): Profile => ({
  totals: { stars: 0, stomps: 0, slaps: 0, pearSmashes: 0, pickles: 0, pipes: 0, rice: 0, runs: 0 },
  endings: {},
  unlocked: ['maid'],
  outfit: 'maid',
});

export const ENDINGS: { id: EndingId; name: string; hint: string }[] = [
  { id: 'win', name: 'Home Safe', hint: 'Make it all the way home' },
  { id: 'molded', name: 'Molded', hint: 'Let the mold catch you' },
  { id: 'mayo', name: "Mayo'd", hint: 'Fill up the mayo meter' },
  { id: 'coma', name: 'Food Coma', hint: 'Some say brothy rice is very filling…' },
  { id: 'furry', name: 'Secretly a Furry', hint: 'The binguses seem to like you…' },
  { id: 'secret', name: 'Secret Ending', hint: 'Somewhere out there is a golden key…' },
];

/** Unlock rules: [current, target] progress for each outfit. */
export function outfitProgress(p: Profile, id: OutfitId): [number, number] {
  const t = p.totals;
  const seen = (e: EndingId) => ((p.endings[e] ?? 0) > 0 ? 1 : 0);
  switch (id) {
    case 'maid':
      return [1, 1];
    case 'regular':
      return [seen('win'), 1];
    case 'sky':
      return [t.stars, 150];
    case 'goth':
      return [t.stomps, 30];
    case 'pickle':
      return [t.pickles, 8];
    case 'pie':
      return [t.slaps, 25];
    case 'pear':
      return [t.pearSmashes, 15];
    case 'pipe':
      return [t.pipes, 75];
    case 'mold':
      return [seen('molded'), 1];
    case 'mayo':
      return [seen('mayo'), 1];
    case 'bingus':
      return [seen('furry'), 1];
    case 'sleepy':
      return [seen('coma'), 1];
    case 'sakura':
      return [seen('secret'), 1];
  }
}

class Progress {
  data: Profile;
  constructor() {
    const saved = storage.get<Partial<Profile>>(KEY, {});
    const b = blank();
    this.data = {
      totals: { ...b.totals, ...(saved.totals ?? {}) },
      endings: { ...(saved.endings ?? {}) },
      unlocked: Array.from(new Set([...(saved.unlocked ?? []), 'maid'])) as OutfitId[],
      outfit: (saved.outfit as OutfitId) ?? 'maid',
    };
    if (!this.data.unlocked.includes(this.data.outfit)) this.data.outfit = 'maid';
  }
  save() {
    storage.set(KEY, this.data);
  }
  get outfit() {
    return this.data.outfit;
  }
  setOutfit(id: OutfitId) {
    if (!this.data.unlocked.includes(id)) return;
    this.data.outfit = id;
    this.save();
  }
  isUnlocked(id: OutfitId) {
    return this.data.unlocked.includes(id);
  }
  /** Fold a finished run into the profile; returns outfits newly unlocked. */
  commitRun(run: Omit<Totals, 'runs'>, ending: EndingId): OutfitId[] {
    const t = this.data.totals;
    for (const k of Object.keys(run) as (keyof typeof run)[]) t[k] += run[k];
    t.runs++;
    this.data.endings[ending] = (this.data.endings[ending] ?? 0) + 1;
    const fresh: OutfitId[] = [];
    for (const o of OUTFITS) {
      if (this.data.unlocked.includes(o.id)) continue;
      const [cur, max] = outfitProgress(this.data, o.id);
      if (cur >= max) {
        this.data.unlocked.push(o.id);
        fresh.push(o.id);
      }
    }
    this.save();
    return fresh;
  }
}

export const progress = new Progress();
