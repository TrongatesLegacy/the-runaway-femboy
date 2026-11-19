/** Wardrobe: every outfit is a colour/accessory style on top of the maid rig (or the regular clothes). */
export type OutfitId =
  | 'maid'
  | 'regular'
  | 'sky'
  | 'goth'
  | 'sakura'
  | 'sleepy'
  | 'mold'
  | 'mayo'
  | 'bingus'
  | 'pickle'
  | 'pie'
  | 'pear'
  | 'pipe'
  | 'princess';

export type HeadWear =
  | 'maidband'
  | 'none'
  | 'moldhood'
  | 'jarlid'
  | 'bingushood'
  | 'picklehood'
  | 'chefhat'
  | 'leaf'
  | 'valve'
  | 'nightcap'
  | 'tophat'
  | 'sakurapin'
  | 'beret'
  | 'tiara';
export type Pattern = 'none' | 'spores' | 'bumps' | 'stars' | 'wrinkles' | 'petals';
export type BodyKind = 'maid' | 'regular' | 'sailor' | 'goth' | 'wa' | 'pajama' | 'hoodie' | 'onesie' | 'pickle' | 'pear' | 'jar' | 'pipe' | 'baker' | 'princess';
export type LegKind = 'stock' | 'socks' | 'tights' | 'stripes' | 'pants' | 'onesie' | 'pipe';
export type FeetKind = 'mary' | 'sneaker' | 'loafer' | 'geta' | 'slipper' | 'paw' | 'boot';
export type SleeveKind = 'puff' | 'jacket' | 'short' | 'bell' | 'wide' | 'long' | 'paw' | 'none' | 'stub' | 'pipe';

export interface OutfitStyle {
  base: 'maid' | 'regular';
  body: BodyKind;
  // main palette (meaning depends on the body)
  dress: string;
  dressDark: string;
  dressHL: string;
  apron: string;
  apronShade: string;
  stripe: string;
  trim: string;
  bow: string;
  // limbs
  legs: LegKind;
  legA: string;
  legB: string;
  feet: FeetKind;
  feetA: string;
  feetB: string;
  sleeve: SleeveKind;
  sleeveA: string;
  sleeveB: string;
  head: HeadWear;
  headA?: string;
  headB?: string;
  pattern: Pattern;
  patternColor?: string;
  tail?: string;
}

const CLASSIC: OutfitStyle = {
  base: 'maid',
  body: 'maid',
  dress: '#211c2e',
  dressDark: '#16121f',
  dressHL: '#3a3352',
  apron: '#fdfbff',
  apronShade: '#efeaf8',
  stripe: '#211c2e',
  trim: '#fdfbff',
  bow: '#d4283f',
  legs: 'stock',
  legA: '#fbf8ff',
  legB: '#f59cbe',
  feet: 'mary',
  feetA: '#2b2438',
  feetB: '#5b4f73',
  sleeve: 'puff',
  sleeveA: '#211c2e',
  sleeveB: '#fdfbff',
  head: 'maidband',
  pattern: 'none',
};

// princess: tiered pink ball gown, gold trim, pearl necklace, puff sleeves and a jewelled tiara
const PRINCESS: OutfitStyle = {
  ...CLASSIC,
  body: 'princess',
  dress: '#ff9fd0',
  dressDark: '#e0679f',
  dressHL: '#ffd6ea',
  apron: '#ffc2e0',
  apronShade: '#f39ac4',
  stripe: '#f2c14e',
  trim: '#fff4fa',
  bow: '#c2347a',
  legs: 'stock',
  legA: '#fff4fa',
  legB: '#ffc2e0',
  feet: 'mary',
  feetA: '#f2c14e',
  feetB: '#ff9fd0',
  sleeve: 'puff',
  sleeveA: '#ffc2e0',
  sleeveB: '#fff4fa',
  head: 'tiara',
  headA: '#f2c14e',
  headB: '#6fd3ff',
};

export const STYLES: Record<OutfitId, OutfitStyle> = {
  maid: CLASSIC,
  regular: { ...CLASSIC, base: 'regular', body: 'regular', legs: 'pants', legA: '#272434', feet: 'sneaker', sleeve: 'jacket', head: 'none' },
  // sailor-uniform maid: pleated blue skirt, sailor collar, red scarf, knee socks & loafers
  sky: {
    ...CLASSIC,
    body: 'sailor',
    dress: '#5d8fd8',
    dressDark: '#3c66b0',
    dressHL: '#9fc4f5',
    apron: '#fdfbff',
    apronShade: '#e6eefa',
    stripe: '#1f3a78',
    trim: '#fdfbff',
    bow: '#e8384f',
    legs: 'socks',
    legA: '#1f2a4a',
    legB: '#fdfbff',
    feet: 'loafer',
    feetA: '#4a2a1e',
    feetB: '#2a160f',
    sleeve: 'short',
    sleeveA: '#fdfbff',
    sleeveB: '#1f3a78',
    head: 'beret',
    headA: '#1f3a78',
    headB: '#e8384f',
  },
  // goth lolita: corset, tiered ruffles, bat wings, striped stockings, mini top hat
  goth: {
    ...CLASSIC,
    body: 'goth',
    dress: '#1a1020',
    dressDark: '#0c070f',
    dressHL: '#3a2440',
    apron: '#2a1a30',
    apronShade: '#1f1424',
    stripe: '#c0183a',
    trim: '#e9e2ef',
    bow: '#c0183a',
    legs: 'stripes',
    legA: '#18101c',
    legB: '#c0183a',
    feet: 'boot',
    feetA: '#140c18',
    feetB: '#c0183a',
    sleeve: 'bell',
    sleeveA: '#1a1020',
    sleeveB: '#e9e2ef',
    head: 'tophat',
    headA: '#140c18',
    headB: '#c0183a',
  },
  // wa-maid: kimono top with obi, pleated hakama, tabi + geta
  sakura: {
    ...CLASSIC,
    body: 'wa',
    dress: '#ffb3cf',
    dressDark: '#e8869f',
    dressHL: '#ffd8e6',
    apron: '#fdfbff',
    apronShade: '#ffeef4',
    stripe: '#b8204a',
    trim: '#fdfbff',
    bow: '#e8304a',
    legs: 'socks',
    legA: '#fdfbff',
    legB: '#fdfbff',
    feet: 'geta',
    feetA: '#c4864a',
    feetB: '#e8304a',
    sleeve: 'wide',
    sleeveA: '#ffb3cf',
    sleeveB: '#e8869f',
    head: 'sakurapin',
    pattern: 'petals',
    patternColor: '#ffffff',
  },
  // star pyjamas, nightcap and fluffy slippers
  sleepy: {
    ...CLASSIC,
    body: 'pajama',
    dress: '#a99ae0',
    dressDark: '#7f6fc0',
    dressHL: '#cfc4ff',
    trim: '#fdfbff',
    bow: '#ffd84a',
    legs: 'pants',
    legA: '#a99ae0',
    legB: '#ffe98a',
    feet: 'slipper',
    feetA: '#fff3f8',
    feetB: '#ff9fc4',
    sleeve: 'long',
    sleeveA: '#a99ae0',
    sleeveB: '#fdfbff',
    head: 'nightcap',
    headA: '#a99ae0',
    headB: '#fdfbff',
    pattern: 'stars',
    patternColor: '#ffe98a',
  },
  // oversized fuzzy mold hoodie with eyes on the hood
  mold: {
    ...CLASSIC,
    body: 'hoodie',
    dress: '#3f8a35',
    dressDark: '#1f4a1c',
    dressHL: '#7fc24a',
    apron: '#2d6a2a',
    trim: '#b6ee6c',
    bow: '#e2f04a',
    legs: 'socks',
    legA: '#2d6a2a',
    legB: '#b6ee6c',
    feet: 'sneaker',
    feetA: '#1f4a1c',
    feetB: '#e2f04a',
    sleeve: 'long',
    sleeveA: '#3f8a35',
    sleeveB: '#b6ee6c',
    head: 'moldhood',
    pattern: 'spores',
    patternColor: '#1f4a1c',
  },
  // walking mayo jar
  mayo: {
    ...CLASSIC,
    body: 'jar',
    dress: '#fff4cf',
    dressDark: '#efdc9c',
    dressHL: '#ffffff',
    stripe: '#2f5fd0',
    bow: '#e8384f',
    legs: 'tights',
    legA: '#fffaf0',
    legB: '#ece2c8',
    feet: 'boot',
    feetA: '#2f5fd0',
    feetB: '#1f448f',
    sleeve: 'long',
    sleeveA: '#fffaf0',
    sleeveB: '#2f5fd0',
    head: 'jarlid',
  },
  // bingus kigurumi onesie
  bingus: {
    ...CLASSIC,
    body: 'onesie',
    dress: '#f4bfb0',
    dressDark: '#dc9a8b',
    dressHL: '#ffe0d6',
    apron: '#ffe6dc',
    trim: '#ffe6dc',
    bow: '#e8455f',
    legs: 'onesie',
    legA: '#f4bfb0',
    legB: '#dc9a8b',
    feet: 'paw',
    feetA: '#f4bfb0',
    feetB: '#f08a9a',
    sleeve: 'paw',
    sleeveA: '#f4bfb0',
    sleeveB: '#f08a9a',
    head: 'bingushood',
    headA: '#f4bfb0',
    headB: '#f08a9a',
    pattern: 'wrinkles',
    patternColor: '#dc9a8b',
    tail: '#f4bfb0',
  },
  // pickle suit
  pickle: {
    ...CLASSIC,
    body: 'pickle',
    dress: '#5aa83a',
    dressDark: '#2f6b1f',
    dressHL: '#a6e070',
    patternColor: '#d6f5a8',
    legs: 'tights',
    legA: '#3f7f2c',
    legB: '#2c5f20',
    feet: 'sneaker',
    feetA: '#f2f2f2',
    feetB: '#5aa83a',
    sleeve: 'stub',
    sleeveA: '#5aa83a',
    sleeveB: '#2f6b1f',
    head: 'picklehood',
    pattern: 'bumps',
  },
  // baker with a pie-crust tutu
  pie: {
    ...CLASSIC,
    body: 'baker',
    dress: '#fdfbff',
    dressDark: '#dcd7ec',
    dressHL: '#ffffff',
    apron: '#e8a85a',
    apronShade: '#b8783a',
    stripe: '#c0183a',
    trim: '#fdfbff',
    bow: '#e8304a',
    legs: 'stripes',
    legA: '#fdfbff',
    legB: '#e8384f',
    feet: 'mary',
    feetA: '#8a5a2a',
    feetB: '#b8783a',
    sleeve: 'short',
    sleeveA: '#fdfbff',
    sleeveB: '#e8384f',
    head: 'chefhat',
  },
  // pear costume
  pear: {
    ...CLASSIC,
    body: 'pear',
    dress: '#ecd040',
    dressDark: '#b49a12',
    dressHL: '#fff6a8',
    patternColor: '#9a7f10',
    legs: 'tights',
    legA: '#7a5a2a',
    legB: '#5a3a14',
    feet: 'boot',
    feetA: '#5ec24a',
    feetB: '#3a8a2a',
    sleeve: 'none',
    sleeveA: '#5ec24a',
    sleeveB: '#3a8a2a',
    head: 'leaf',
  },
  // copper pipe suit with a pressure gauge
  pipe: {
    ...CLASSIC,
    body: 'pipe',
    dress: '#b8693c',
    dressDark: '#5e2f17',
    dressHL: '#f0a774',
    trim: '#8a4a28',
    bow: '#d9363e',
    legs: 'pipe',
    legA: '#b8693c',
    legB: '#8a4a28',
    feet: 'boot',
    feetA: '#2f3647',
    feetB: '#5a6680',
    sleeve: 'pipe',
    sleeveA: '#9aa6bd',
    sleeveB: '#5a6680',
    head: 'valve',
  },
  princess: PRINCESS,
};

export interface OutfitDef {
  id: OutfitId;
  name: string;
  how: string; // unlock hint
}

/** Display order in the wardrobe. */
export const OUTFITS: OutfitDef[] = [
  { id: 'maid', name: 'Classic Maid', how: 'Default' },
  { id: 'regular', name: 'His Regular Clothes', how: 'Make it home' },
  { id: 'sky', name: 'Sky Maid', how: 'Collect 150 ☆ in total' },
  { id: 'goth', name: 'Goth Maid', how: 'Stomp 30 binguses in total' },
  { id: 'pickle', name: 'Pickle Fit', how: 'Eat 8 pickles in total' },
  { id: 'pie', name: 'Pie Fit', how: 'Land 25 slaps in total' },
  { id: 'pear', name: 'Pear Fit', how: 'Smash 15 things with Pear Power' },
  { id: 'pipe', name: 'Pipe Fit', how: 'Clear 75 pipes in total' },
  { id: 'mold', name: 'Mold Fit', how: 'Get Molded' },
  { id: 'mayo', name: 'Mayo Maid', how: "Get Mayo'd" },
  { id: 'bingus', name: 'Bingus Onesie', how: 'Find the bingus ending' },
  { id: 'sleepy', name: 'Sleepy Maid', how: 'Find the food coma ending' },
  { id: 'sakura', name: 'Sakura Maid', how: 'Find the secret ending' },
  { id: 'princess', name: 'Princess Gown', how: 'Find all 6 endings' },
];

export const styleOf = (id: string): OutfitStyle => STYLES[id as OutfitId] ?? CLASSIC;
