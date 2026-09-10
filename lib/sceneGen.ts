import { hashString } from './format';

/**
 * Procedural background scenes.
 *
 * Scenes are pure data (a style + a palette + a seed) and are rendered by
 * <SceneView/>. The generator turns a text prompt into a deterministic scene,
 * which is why the same prompt always produces the same artwork — nothing is
 * uploaded anywhere.
 */

export type SceneStyle =
  | 'aurora'
  | 'studio'
  | 'city'
  | 'waves'
  | 'cosmic'
  | 'forest'
  | 'dunes'
  | 'neon';

export type SceneSpec = {
  id: string;
  name: string;
  style: SceneStyle;
  seed: number;
  /** [top, mid, bottom, glow] */
  colors: string[];
  prompt?: string;
  imageUri?: string;
  /** true when the scene came from the user's prompt or library */
  userMade?: boolean;
};

export const SCENE_PRESETS: SceneSpec[] = [
  { id: 'sc-sunset-dunes', name: 'Sunset Dunes', style: 'dunes', seed: 3, colors: ['#FF9A3C', '#FF4D6D', '#3A1030', '#FFD08A'] },
  { id: 'sc-neon-tokyo', name: 'Neon Tokyo', style: 'city', seed: 7, colors: ['#12102A', '#3A1160', '#07060F', '#FF2E97'] },
  { id: 'sc-cosmic-drift', name: 'Cosmic Drift', style: 'cosmic', seed: 11, colors: ['#1B1140', '#3B1E7A', '#05040E', '#35E1FF'] },
  { id: 'sc-softbox', name: 'Studio Softbox', style: 'studio', seed: 2, colors: ['#F3EEE7', '#D8CFC2', '#8C8375', '#FFFFFF'] },
  { id: 'sc-ocean-glass', name: 'Ocean Glass', style: 'waves', seed: 5, colors: ['#0E4C6B', '#0A7EA4', '#03222F', '#8FE9FF'] },
  { id: 'sc-forest-mist', name: 'Forest Mist', style: 'forest', seed: 9, colors: ['#173B2B', '#2E6B4A', '#08150F', '#B8F2C9'] },
  { id: 'sc-aurora-ice', name: 'Aurora Ice', style: 'aurora', seed: 13, colors: ['#0B1A3A', '#123A6B', '#04060F', '#7CFFE4'] },
  { id: 'sc-vapor-grid', name: 'Vapor Grid', style: 'neon', seed: 17, colors: ['#2A0B45', '#5B1E8A', '#0A0416', '#35E1FF'] },
];

const PALETTES: Record<SceneStyle, string[][]> = {
  aurora: [
    ['#0B1A3A', '#123A6B', '#04060F', '#7CFFE4'],
    ['#2B0B4A', '#5B1E8A', '#0A0416', '#FF7AD9'],
    ['#03202E', '#0A5A6B', '#020A0E', '#9BFFD8'],
  ],
  studio: [
    ['#F6F2EC', '#DCD3C6', '#8F877A', '#FFFFFF'],
    ['#E9EEF6', '#C6D2E4', '#6E7A90', '#FFFFFF'],
    ['#F3E9F0', '#DCC6D6', '#8A7482', '#FFFFFF'],
  ],
  city: [
    ['#12102A', '#3A1160', '#07060F', '#FF2E97'],
    ['#071A2E', '#0E3A5B', '#030A12', '#35E1FF'],
    ['#1A0B12', '#4A1024', '#0A0407', '#FFB547'],
  ],
  waves: [
    ['#0E4C6B', '#0A7EA4', '#03222F', '#8FE9FF'],
    ['#0B3D5C', '#1B6FA8', '#04161F', '#B8E6FF'],
    ['#123B4E', '#2E8C8C', '#06171C', '#9BFFE4'],
  ],
  cosmic: [
    ['#1B1140', '#3B1E7A', '#05040E', '#35E1FF'],
    ['#2A0A3D', '#6A1B7A', '#0A0410', '#FFD166'],
    ['#0A1030', '#20308A', '#03040A', '#FF4D9D'],
  ],
  forest: [
    ['#173B2B', '#2E6B4A', '#08150F', '#B8F2C9'],
    ['#22331A', '#4A6B2A', '#0D1208', '#E4FFB8'],
    ['#0F3330', '#1F6B5E', '#061412', '#9BF2D8'],
  ],
  dunes: [
    ['#FF9A3C', '#FF4D6D', '#3A1030', '#FFD08A'],
    ['#FFC46B', '#E8557A', '#3A1A2E', '#FFE9C7'],
    ['#F2764B', '#8A2E5B', '#2A0F22', '#FFD9A8'],
  ],
  neon: [
    ['#2A0B45', '#5B1E8A', '#0A0416', '#35E1FF'],
    ['#3D0B2E', '#7A1E5B', '#12040C', '#FF2E97'],
    ['#0B2A45', '#1E5B8A', '#040A12', '#C6FF4A'],
  ],
};

const STYLE_KEYWORDS: [SceneStyle, string[]][] = [
  ['city', ['city', 'tokyo', 'urban', 'street', 'skyline', 'downtown', 'neon city', 'building']],
  ['cosmic', ['space', 'galaxy', 'cosmic', 'stars', 'nebula', 'universe', 'planet', 'astro']],
  ['waves', ['ocean', 'sea', 'water', 'beach', 'wave', 'underwater', 'lake', 'pool']],
  ['forest', ['forest', 'tree', 'jungle', 'nature', 'wood', 'moss', 'leaf', 'green']],
  ['dunes', ['sunset', 'sunrise', 'desert', 'dune', 'golden', 'amber', 'dusk', 'warm']],
  ['aurora', ['aurora', 'ice', 'arctic', 'snow', 'winter', 'glacier', 'cold', 'nordic']],
  ['neon', ['neon', 'synthwave', 'retro', 'vaporwave', '80s', 'arcade', 'cyber']],
  ['studio', ['studio', 'portrait', 'white', 'clean', 'minimal', 'softbox', 'gradient backdrop', 'professional']],
];

const COLOR_KEYWORDS: [string, string[]][] = [
  ['#FF4D9D', ['pink', 'rose', 'magenta', 'bubblegum']],
  ['#35E1FF', ['cyan', 'blue', 'azure', 'teal']],
  ['#C6FF4A', ['lime', 'green', 'neon green']],
  ['#8B5CFF', ['purple', 'violet', 'lavender', 'lilac']],
  ['#FFB547', ['orange', 'amber', 'gold', 'tangerine']],
  ['#FF5A6A', ['red', 'crimson', 'scarlet']],
  ['#3DDC97', ['mint', 'emerald', 'jade']],
  ['#FFFFFF', ['white', 'bright', 'light']],
];

function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Deterministically turns a free-form prompt into a rendered scene. */
export function sceneFromPrompt(prompt: string): SceneSpec {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();
  const seed = hashString(lower || 'aura');

  let style: SceneStyle = 'aurora';
  let bestHits = 0;
  for (const [candidate, words] of STYLE_KEYWORDS) {
    if (!words.length) continue;
    const hits = words.reduce((acc, w) => (lower.includes(w) ? acc + 1 : acc), 0);
    if (hits > bestHits) {
      bestHits = hits;
      style = candidate;
    }
  }
  if (bestHits === 0) {
    const all = Object.keys(PALETTES) as SceneStyle[];
    style = all[seed % all.length];
  }

  const bank = PALETTES[style];
  const colors = [...bank[seed % bank.length]];

  for (const [hex, words] of COLOR_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) {
      colors[3] = hex; // accent glow
      break;
    }
  }

  if (/dark|night|moody|black/.test(lower)) {
    colors[0] = shade(colors[0], -0.25);
    colors[1] = shade(colors[1], -0.2);
  }
  if (/bright|airy|pastel|soft/.test(lower)) {
    colors[0] = shade(colors[0], 0.18);
    colors[1] = shade(colors[1], 0.14);
  }

  return {
    id: `gen-${seed.toString(36)}`,
    name: titleCase(clean) || 'Generated Scene',
    style,
    seed,
    colors,
    prompt: clean,
    userMade: true,
  };
}

/** Lighten (amt>0) or darken (amt<0) a hex colour. */
export function shade(hex: string, amt: number) {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  r = f(r);
  g = f(g);
  b = f(b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const SCENE_SUGGESTIONS = [
  'Tokyo alley at night in the rain',
  'Golden hour dunes',
  'Minimal studio, cream backdrop',
  'Deep space nebula',
  'Aurora over a frozen lake',
  'Neon Miami vaporwave grid',
  'Misty pine forest',
  'Underwater caustics',
];

/** Small deterministic PRNG for decorative elements. */
export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
