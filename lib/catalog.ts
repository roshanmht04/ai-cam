/**
 * AURA effect catalogue.
 *
 * Every look is described as a declarative {@link EffectRecipe} so the exact same
 * recipe can be rendered live over the camera preview AND baked into the editor.
 * No network calls — the whole catalogue ships with the app and can be extended
 * by simply appending entries (see `registerAiEffect`).
 */

export type TintLayer = { color: string; opacity: number };

export type StickerSpec = {
  id: string;
  glyph: string;
  /** offsets expressed in units of the face box size */
  dx: number;
  dy: number;
  /** size expressed as a fraction of the face box size */
  size: number;
  rotate?: number;
  opacity?: number;
  space?: 'face' | 'frame';
  /** frame-relative coordinates (0..1) when space === 'frame' */
  fx?: number;
  fy?: number;
  /** frame-relative size (fraction of frame width) */
  fsize?: number;
};

export type EffectRecipe = {
  tints: TintLayer[];
  wash?: TintLayer | null;
  /** -1..1, approximated with paired dark/light composites */
  contrast?: number;
  vignette: number;
  grain: number;
  scanlines?: number;
  frame?: { color: string; width: number } | null;
  stickers: StickerSpec[];
  stamp?: string | null;
  /** "tiny face" style occlusion disc placed over the tracked face */
  faceDisc?: { scale: number; color: string; opacity: number } | null;
  /** soft bloom overlay strength 0..1 */
  bloom?: number;
};

export const NEUTRAL: EffectRecipe = {
  tints: [],
  vignette: 0,
  grain: 0,
  stickers: [],
};

function r(partial: Partial<EffectRecipe>): EffectRecipe {
  return { ...NEUTRAL, ...partial };
}

export type FilterCat =
  | 'faces'
  | 'color'
  | 'film'
  | 'frames'
  | 'fun';

export type FilterDef = {
  id: string;
  name: string;
  glyph: string;
  cat: FilterCat;
  swatch: [string, string];
  blurb: string;
  hot?: boolean;
  faceTracked?: boolean;
  recipe: EffectRecipe;
};

export const FILTER_CATEGORIES: { key: FilterCat | 'all'; label: string; glyph: string }[] = [
  { key: 'all', label: 'All', glyph: 'sparkles' },
  { key: 'faces', label: 'Face FX', glyph: 'happy' },
  { key: 'color', label: 'Color', glyph: 'color-palette' },
  { key: 'film', label: 'Film', glyph: 'film' },
  { key: 'frames', label: 'Frames', glyph: 'crop' },
  { key: 'fun', label: 'Party', glyph: 'gift' },
];

export const FILTERS: FilterDef[] = [
  {
    id: 'none',
    name: 'Original',
    glyph: 'ellipse',
    cat: 'color',
    swatch: ['#2A2F3A', '#4A5162'],
    blurb: 'No processing — the raw sensor pipeline.',
    recipe: NEUTRAL,
  },
  // ---------------------------------------------------------------- face FX
  {
    id: 'big-eyes',
    name: 'Big Eyes',
    glyph: 'eye',
    cat: 'faces',
    swatch: ['#FF7AB8', '#8B5CFF'],
    blurb: 'Anime-scale eyes locked to your face with the on-device tracker.',
    hot: true,
    faceTracked: true,
    recipe: r({
      tints: [{ color: '#FFB6D9', opacity: 0.1 }],
      bloom: 0.18,
      stickers: [
        { id: 'le', glyph: '👁', dx: -0.42, dy: -0.16, size: 0.72 },
        { id: 're', glyph: '👁', dx: 0.42, dy: -0.16, size: 0.72, rotate: 0 },
      ],
    }),
  },
  {
    id: 'tiny-face',
    name: 'Tiny Face',
    glyph: 'contract',
    cat: 'faces',
    swatch: ['#35E1FF', '#2B6BFF'],
    blurb: 'Shrinks you down to a pocket-sized portrait.',
    hot: true,
    faceTracked: true,
    recipe: r({
      tints: [{ color: '#7FE7FF', opacity: 0.06 }],
      faceDisc: { scale: 0.46, color: '#F3C9A8', opacity: 0.96 },
      stickers: [
        { id: 'tiny', glyph: '😄', dx: 0, dy: 0, size: 0.42 },
      ],
    }),
  },
  {
    id: 'dog',
    name: 'Puppy',
    glyph: 'paw',
    cat: 'faces',
    swatch: ['#C98A4B', '#6B4226'],
    blurb: 'Floppy ears, wet nose and a very good boy energy.',
    hot: true,
    faceTracked: true,
    recipe: r({
      tints: [{ color: '#D9A15B', opacity: 0.1 }],
      stickers: [
        { id: 'el', glyph: '🐕', dx: -0.55, dy: -0.62, size: 0.75, rotate: -18 },
        { id: 'er', glyph: '🐕', dx: 0.55, dy: -0.62, size: 0.75, rotate: 18 },
        { id: 'nose', glyph: '🐶', dx: 0, dy: 0.34, size: 0.62 },
      ],
    }),
  },
  {
    id: 'cat',
    name: 'Kitty',
    glyph: 'happy',
    cat: 'faces',
    swatch: ['#FFC3D8', '#B15CD1'],
    blurb: 'Pointy ears, whiskers and impeccable attitude.',
    faceTracked: true,
    recipe: r({
      tints: [{ color: '#FFC9E2', opacity: 0.09 }],
      stickers: [
        { id: 'el', glyph: '🐱', dx: -0.5, dy: -0.66, size: 0.72, rotate: -14 },
        { id: 'er', glyph: '🐱', dx: 0.5, dy: -0.66, size: 0.72, rotate: 14 },
        { id: 'nose', glyph: '😸', dx: 0, dy: 0.28, size: 0.6 },
      ],
    }),
  },
  {
    id: 'bear',
    name: 'Cub',
    glyph: 'paw',
    cat: 'faces',
    swatch: ['#B98A5E', '#4E3524'],
    blurb: 'Round teddy ears with a huggable warm grade.',
    faceTracked: true,
    recipe: r({
      tints: [{ color: '#C08A57', opacity: 0.12 }],
      stickers: [
        { id: 'el', glyph: '🐻', dx: -0.52, dy: -0.64, size: 0.66 },
        { id: 'er', glyph: '🐻', dx: 0.52, dy: -0.64, size: 0.66 },
        { id: 'm', glyph: '🧸', dx: 0, dy: 0.3, size: 0.55 },
      ],
    }),
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    glyph: 'color-wand',
    cat: 'faces',
    swatch: ['#FFE45E', '#FF5E8A'],
    blurb: 'Posterised ink-and-paint look with bouncing sparkles.',
    hot: true,
    recipe: r({
      tints: [
        { color: '#FFF1A8', opacity: 0.14 },
        { color: '#3B1D6E', opacity: 0.12 },
      ],
      contrast: 0.45,
      bloom: 0.2,
      stickers: [
        { id: 's1', glyph: '✨', dx: -0.9, dy: -0.85, size: 0.4, space: 'frame', fx: 0.16, fy: 0.2, fsize: 0.09 },
        { id: 's2', glyph: '⭐', dx: 0.9, dy: 0.8, size: 0.4, space: 'frame', fx: 0.84, fy: 0.32, fsize: 0.07 },
        { id: 's3', glyph: '✨', space: 'frame', fx: 0.78, fy: 0.72, fsize: 0.08, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  {
    id: 'anime',
    name: 'Anime Glow',
    glyph: 'sparkles',
    cat: 'faces',
    swatch: ['#FF9AD5', '#7A5CFF'],
    blurb: 'Soft cel light, cherry-blossom bloom and sparkle dust.',
    faceTracked: true,
    recipe: r({
      tints: [
        { color: '#FFC2EA', opacity: 0.16 },
        { color: '#6E5BFF', opacity: 0.08 },
      ],
      bloom: 0.3,
      stickers: [
        { id: 'b1', glyph: '🌸', space: 'frame', fx: 0.14, fy: 0.28, fsize: 0.1, dx: 0, dy: 0, size: 0.4, opacity: 0.9 },
        { id: 'b2', glyph: '🌸', space: 'frame', fx: 0.86, fy: 0.62, fsize: 0.08, dx: 0, dy: 0, size: 0.4, opacity: 0.8 },
        { id: 'b3', glyph: '💫', space: 'frame', fx: 0.72, fy: 0.16, fsize: 0.07, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  {
    id: 'gentleman',
    name: 'Gentleman',
    glyph: 'glasses',
    cat: 'faces',
    swatch: ['#3A3F51', '#C9A227'],
    blurb: 'Top hat, moustache and a dapper sepia press.',
    faceTracked: true,
    recipe: r({
      tints: [{ color: '#D8B36A', opacity: 0.14 }],
      stickers: [
        { id: 'hat', glyph: '🎩', dx: 0, dy: -0.95, size: 1 },
        { id: 'st', glyph: '🥸', dx: 0, dy: 0.3, size: 0.66 },
      ],
    }),
  },
  {
    id: 'alien',
    name: 'Visitor',
    glyph: 'planet',
    cat: 'faces',
    swatch: ['#7CF5B4', '#0E6E5C'],
    blurb: 'Almond eyes and an otherworldly emerald grade.',
    faceTracked: true,
    recipe: r({
      tints: [
        { color: '#57E39B', opacity: 0.16 },
        { color: '#0B3D2E', opacity: 0.14 },
      ],
      contrast: 0.2,
      stickers: [
        { id: 'le', glyph: '👽', dx: -0.4, dy: -0.14, size: 0.62 },
        { id: 're', glyph: '👽', dx: 0.4, dy: -0.14, size: 0.62 },
      ],
    }),
  },
  {
    id: 'clown',
    name: 'Party Pop',
    glyph: 'happy',
    cat: 'fun',
    swatch: ['#FF5E8A', '#35E1FF'],
    blurb: 'Confetti frame, red nose and maximum dopamine.',
    hot: true,
    recipe: r({
      tints: [{ color: '#FF7BC8', opacity: 0.1 }],
      stickers: [
        { id: 'nose', glyph: '🔴', dx: 0, dy: 0.18, size: 0.42 },
        { id: 'c1', glyph: '🎉', space: 'frame', fx: 0.12, fy: 0.18, fsize: 0.12, dx: 0, dy: 0, size: 0.4 },
        { id: 'c2', glyph: '🎈', space: 'frame', fx: 0.88, fy: 0.24, fsize: 0.11, dx: 0, dy: 0, size: 0.4 },
        { id: 'c3', glyph: '🎊', space: 'frame', fx: 0.2, fy: 0.82, fsize: 0.1, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  // ------------------------------------------------------------------ color
  {
    id: 'noir',
    name: 'Noir',
    glyph: 'contrast',
    cat: 'color',
    swatch: ['#0B0B0C', '#8E95A3'],
    blurb: 'Crushed blacks, silver highlights, pure monochrome.',
    recipe: r({
      tints: [{ color: '#0A0A0C', opacity: 0.42 }],
      contrast: 0.6,
      vignette: 0.45,
    }),
  },
  {
    id: 'chrome',
    name: 'Chrome',
    glyph: 'hardware-chip',
    cat: 'color',
    swatch: ['#9BE7FF', '#2B4C7E'],
    blurb: 'Cold steel blues with a specular cyan kick.',
    recipe: r({
      tints: [
        { color: '#8FD8FF', opacity: 0.16 },
        { color: '#13243B', opacity: 0.14 },
      ],
      contrast: 0.28,
    }),
  },
  {
    id: 'sunset',
    name: 'Sunset',
    glyph: 'partly-sunny',
    cat: 'color',
    swatch: ['#FF9A3C', '#FF3D77'],
    blurb: 'Golden hour all day long.',
    hot: true,
    recipe: r({
      tints: [
        { color: '#FF9A3C', opacity: 0.2 },
        { color: '#FF3D77', opacity: 0.1 },
      ],
      vignette: 0.2,
    }),
  },
  {
    id: 'cyber',
    name: 'Cyberpunk',
    glyph: 'flash',
    cat: 'color',
    swatch: ['#FF2E97', '#21E6FF'],
    blurb: 'Neon magenta shadows, electric cyan highlights.',
    hot: true,
    recipe: r({
      tints: [
        { color: '#FF2E97', opacity: 0.16 },
        { color: '#21E6FF', opacity: 0.14 },
      ],
      contrast: 0.35,
      vignette: 0.3,
      bloom: 0.14,
    }),
  },
  {
    id: 'arctic',
    name: 'Arctic',
    glyph: 'snow',
    cat: 'color',
    swatch: ['#E6F4FF', '#5C8FD6'],
    blurb: 'Glacial blues and crisp, clean whites.',
    recipe: r({
      tints: [{ color: '#B7DBFF', opacity: 0.18 }],
      contrast: 0.12,
    }),
  },
  {
    id: 'blossom',
    name: 'Blossom',
    glyph: 'flower',
    cat: 'color',
    swatch: ['#FFC2D8', '#C084FC'],
    blurb: 'Petal pinks with a dreamy rose haze.',
    recipe: r({
      tints: [{ color: '#FFB4D4', opacity: 0.18 }],
      bloom: 0.22,
    }),
  },
  {
    id: 'mint',
    name: 'Mint Tea',
    glyph: 'leaf',
    cat: 'color',
    swatch: ['#9BFFD8', '#1F8A70'],
    blurb: 'Fresh greens, calm contrast.',
    recipe: r({
      tints: [{ color: '#8CF2CE', opacity: 0.16 }],
    }),
  },
  {
    id: 'teal-orange',
    name: 'Blockbuster',
    glyph: 'film',
    cat: 'color',
    swatch: ['#0E7C86', '#FF8A3D'],
    blurb: 'The teal-and-orange grade that runs Hollywood.',
    recipe: r({
      tints: [
        { color: '#0E7C86', opacity: 0.14 },
        { color: '#FF8A3D', opacity: 0.12 },
      ],
      contrast: 0.3,
      vignette: 0.26,
    }),
  },
  // ------------------------------------------------------------------- film
  {
    id: 'film400',
    name: 'Film 400',
    glyph: 'camera',
    cat: 'film',
    swatch: ['#E7D3B3', '#6C5B45'],
    blurb: 'Warm halide fade with soft grain — pushed two stops.',
    recipe: r({
      tints: [
        { color: '#E7C79B', opacity: 0.14 },
        { color: '#2A2318', opacity: 0.1 },
      ],
      wash: { color: '#D9C2A0', opacity: 0.12 },
      grain: 0.35,
      vignette: 0.24,
    }),
  },
  {
    id: 'lomo',
    name: 'Lomo',
    glyph: 'aperture',
    cat: 'film',
    swatch: ['#FF5E5E', '#2E5BFF'],
    blurb: 'Cross-processed chaos, vignette, happy accidents.',
    recipe: r({
      tints: [
        { color: '#FF5E5E', opacity: 0.12 },
        { color: '#2E5BFF', opacity: 0.14 },
      ],
      contrast: 0.4,
      vignette: 0.5,
      grain: 0.28,
    }),
  },
  {
    id: 'vhs',
    name: 'VHS 1994',
    glyph: 'tv',
    cat: 'film',
    swatch: ['#3AE374', '#8A2BE2'],
    blurb: 'Tracking noise, scanlines and a date stamp.',
    hot: true,
    recipe: r({
      tints: [
        { color: '#3AE374', opacity: 0.07 },
        { color: '#8A2BE2', opacity: 0.09 },
      ],
      scanlines: 0.5,
      grain: 0.3,
      stamp: '12 SEP 1994',
      vignette: 0.22,
    }),
  },
  {
    id: 'polaroid',
    name: 'Instant',
    glyph: 'image',
    cat: 'film',
    swatch: ['#F6F1E7', '#B9AE99'],
    blurb: 'Soft instant-film border with milky lifted blacks.',
    recipe: r({
      tints: [{ color: '#F2E4CC', opacity: 0.12 }],
      wash: { color: '#FFF6E6', opacity: 0.14 },
      frame: { color: '#F7F3EA', width: 22 },
      grain: 0.16,
    }),
  },
  // ----------------------------------------------------------------- frames
  {
    id: 'neon',
    name: 'Neon Ring',
    glyph: 'radio',
    cat: 'frames',
    swatch: ['#35E1FF', '#FF4D9D'],
    blurb: 'Pulsing neon border with a bloom halo.',
    recipe: r({
      frame: { color: '#35E1FF', width: 8 },
      bloom: 0.24,
      vignette: 0.28,
      tints: [{ color: '#35E1FF', opacity: 0.06 }],
    }),
  },
  {
    id: 'hearts',
    name: 'Heart Pop',
    glyph: 'heart',
    cat: 'frames',
    swatch: ['#FF6FA5', '#FFD1E3'],
    blurb: 'Floating hearts around a rosy frame.',
    recipe: r({
      frame: { color: '#FF6FA5', width: 5 },
      tints: [{ color: '#FF9EC4', opacity: 0.1 }],
      stickers: [
        { id: 'h1', glyph: '❤️', space: 'frame', fx: 0.1, fy: 0.16, fsize: 0.1, dx: 0, dy: 0, size: 0.4 },
        { id: 'h2', glyph: '💖', space: 'frame', fx: 0.9, fy: 0.22, fsize: 0.09, dx: 0, dy: 0, size: 0.4 },
        { id: 'h3', glyph: '💕', space: 'frame', fx: 0.16, fy: 0.86, fsize: 0.08, dx: 0, dy: 0, size: 0.4 },
        { id: 'h4', glyph: '✨', space: 'frame', fx: 0.84, fy: 0.82, fsize: 0.08, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  {
    id: 'retro-cam',
    name: 'Camcorder',
    glyph: 'videocam',
    cat: 'frames',
    swatch: ['#1C1F26', '#C7CDD9'],
    blurb: 'REC overlay, battery icon and 90s OSD type.',
    recipe: r({
      scanlines: 0.28,
      tints: [{ color: '#0F1116', opacity: 0.14 }],
      stamp: 'REC ● 00:00',
      vignette: 0.3,
    }),
  },
  {
    id: 'bloom',
    name: 'Bloom',
    glyph: 'sunny',
    cat: 'frames',
    swatch: ['#FFF3C4', '#FFB3D1'],
    blurb: 'Diffused highlight bloom, gentle halation.',
    recipe: r({
      bloom: 0.42,
      tints: [{ color: '#FFE9C7', opacity: 0.1 }],
    }),
  },
];

// ---------------------------------------------------------------- AI effects

export type AiCategory = 'transform' | 'portrait' | 'utility' | 'world';

export type AiEffectDef = {
  id: string;
  name: string;
  tagline: string;
  category: AiCategory;
  /** 'device' renders fully on-device, 'cloud' needs explicit opt-in consent */
  runtime: 'device' | 'cloud';
  swatch: [string, string];
  glyph: string;
  /** simulated pipeline stages shown while the effect resolves */
  stages: string[];
  /** approximate wall-clock time for the local preview pipeline */
  ms: number;
  /** result recipe applied to the live preview / editor */
  apply: EffectRecipe;
  /** the face tracker is required before this effect can run */
  needsFace?: boolean;
};

export const AI_CATEGORIES: { key: AiCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'transform', label: 'Transform' },
  { key: 'portrait', label: 'Portrait' },
  { key: 'world', label: 'World' },
  { key: 'utility', label: 'Utility' },
];

export const AI_EFFECTS: AiEffectDef[] = [
  {
    id: 'ai-anime',
    name: 'Anime Me',
    tagline: 'Full cel-shaded anime portraiture',
    category: 'transform',
    runtime: 'device',
    swatch: ['#FF7AB8', '#7A5CFF'],
    glyph: 'color-wand',
    stages: ['Detecting face', 'Segmenting subject', 'Applying style net', 'Compositing'],
    ms: 1500,
    needsFace: true,
    apply: r({
      tints: [
        { color: '#FFC2EA', opacity: 0.18 },
        { color: '#4B2C8F', opacity: 0.12 },
      ],
      contrast: 0.4,
      bloom: 0.26,
      stickers: [
        { id: 's1', glyph: '✨', space: 'frame', fx: 0.14, fy: 0.22, fsize: 0.09, dx: 0, dy: 0, size: 0.4 },
        { id: 's2', glyph: '⭐', space: 'frame', fx: 0.85, fy: 0.7, fsize: 0.08, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  {
    id: 'ai-oil',
    name: 'Oil Painting',
    tagline: 'Impasto brushwork, museum grade',
    category: 'transform',
    runtime: 'device',
    swatch: ['#E8B25A', '#7A3B1E'],
    glyph: 'brush',
    stages: ['Building depth map', 'Brush simulation', 'Canvas weave', 'Varnish pass'],
    ms: 1800,
    apply: r({
      tints: [
        { color: '#E8B25A', opacity: 0.16 },
        { color: '#5A2A12', opacity: 0.14 },
      ],
      contrast: 0.32,
      grain: 0.22,
      vignette: 0.3,
      wash: { color: '#F2DDB4', opacity: 0.08 },
    }),
  },
  {
    id: 'ai-watercolor',
    name: 'Watercolour',
    tagline: 'Bleeding pigment on cold-press paper',
    category: 'transform',
    runtime: 'device',
    swatch: ['#9FD8FF', '#FFB3C7'],
    glyph: 'water',
    stages: ['Pigment separation', 'Edge bleed', 'Paper grain', 'Dry pass'],
    ms: 1600,
    apply: r({
      tints: [
        { color: '#9FD8FF', opacity: 0.2 },
        { color: '#FFB3C7', opacity: 0.14 },
      ],
      wash: { color: '#FDFBF6', opacity: 0.16 },
      grain: 0.3,
      bloom: 0.2,
    }),
  },
  {
    id: 'ai-toy',
    name: '3D Toy',
    tagline: 'Glossy vinyl figure render',
    category: 'transform',
    runtime: 'device',
    swatch: ['#FFD166', '#FF6B6B'],
    glyph: 'game-controller',
    stages: ['Normal estimation', 'Specular pass', 'Subsurface tint'],
    ms: 1400,
    apply: r({
      tints: [
        { color: '#FFD166', opacity: 0.14 },
        { color: '#2B2140', opacity: 0.12 },
      ],
      contrast: 0.5,
      bloom: 0.3,
    }),
  },
  {
    id: 'ai-cyberskin',
    name: 'Cyber Skin',
    tagline: 'Chrome plating with circuit glow',
    category: 'transform',
    runtime: 'cloud',
    swatch: ['#35E1FF', '#8B5CFF'],
    glyph: 'hardware-chip',
    stages: ['Uploading frame (consented)', 'Mesh refinement', 'Shader compile', 'Render'],
    ms: 2100,
    needsFace: true,
    apply: r({
      tints: [
        { color: '#35E1FF', opacity: 0.18 },
        { color: '#101A33', opacity: 0.18 },
      ],
      contrast: 0.5,
      bloom: 0.24,
      stickers: [
        { id: 'c1', glyph: '💠', space: 'frame', fx: 0.16, fy: 0.3, fsize: 0.08, dx: 0, dy: 0, size: 0.4 },
        { id: 'c2', glyph: '💠', space: 'frame', fx: 0.84, fy: 0.66, fsize: 0.07, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  {
    id: 'ai-relight',
    name: 'Studio Relight',
    tagline: 'Rembrandt key with soft fill',
    category: 'portrait',
    runtime: 'device',
    swatch: ['#FFE6C7', '#3A2E4D'],
    glyph: 'bulb',
    stages: ['Depth estimation', 'Light transport', 'Shadow merge'],
    ms: 1200,
    apply: r({
      tints: [
        { color: '#FFE6C7', opacity: 0.12 },
        { color: '#1A1426', opacity: 0.16 },
      ],
      contrast: 0.3,
      vignette: 0.42,
    }),
  },
  {
    id: 'ai-retouch',
    name: 'Airbrush',
    tagline: 'Frequency-separation skin retouch',
    category: 'portrait',
    runtime: 'device',
    swatch: ['#FFD9E8', '#FF9EC4'],
    glyph: 'sparkles',
    stages: ['Face mesh', 'Texture separation', 'Dodge & burn'],
    ms: 1000,
    needsFace: true,
    apply: r({
      tints: [{ color: '#FFD9E8', opacity: 0.1 }],
      bloom: 0.3,
      wash: { color: '#FFF0F6', opacity: 0.08 },
    }),
  },
  {
    id: 'ai-glam',
    name: 'Red Carpet',
    tagline: 'Evening glamour grade + sparkle dust',
    category: 'portrait',
    runtime: 'device',
    swatch: ['#FF4D9D', '#2A0E20'],
    glyph: 'diamond',
    stages: ['Skin tone map', 'Highlight sculpt', 'Dust compositing'],
    ms: 1300,
    apply: r({
      tints: [
        { color: '#FF4D9D', opacity: 0.12 },
        { color: '#231026', opacity: 0.16 },
      ],
      contrast: 0.36,
      vignette: 0.36,
      bloom: 0.2,
      stickers: [
        { id: 'd1', glyph: '💎', space: 'frame', fx: 0.2, fy: 0.2, fsize: 0.07, dx: 0, dy: 0, size: 0.4 },
        { id: 'd2', glyph: '✨', space: 'frame', fx: 0.8, fy: 0.78, fsize: 0.08, dx: 0, dy: 0, size: 0.4 },
      ],
    }),
  },
  {
    id: 'ai-sky',
    name: 'Sky Swap',
    tagline: 'Replace blown-out skies at depth',
    category: 'world',
    runtime: 'cloud',
    swatch: ['#FF8A3D', '#3A2CC7'],
    glyph: 'cloudy',
    stages: ['Uploading frame (consented)', 'Sky segmentation', 'Horizon match', 'Grade blend'],
    ms: 2000,
    apply: r({
      tints: [
        { color: '#FF8A3D', opacity: 0.14 },
        { color: '#3A2CC7', opacity: 0.14 },
      ],
      contrast: 0.24,
      bloom: 0.16,
    }),
  },
  {
    id: 'ai-blur-bg',
    name: 'Portrait Blur',
    tagline: 'DSLR-depth bokeh from a single frame',
    category: 'world',
    runtime: 'device',
    swatch: ['#9BE7FF', '#274060'],
    glyph: 'aperture',
    stages: ['Depth estimation', 'Bokeh kernel', 'Edge feather'],
    ms: 1250,
    apply: r({
      tints: [{ color: '#0E1B2E', opacity: 0.16 }],
      vignette: 0.34,
      bloom: 0.18,
    }),
  },
  {
    id: 'ai-age',
    name: 'Time Shift',
    tagline: 'Age progression across 40 years',
    category: 'portrait',
    runtime: 'cloud',
    swatch: ['#C9A227', '#3D3016'],
    glyph: 'hourglass',
    stages: ['Uploading frame (consented)', 'Identity embedding', 'Age diffusion', 'Restore detail'],
    ms: 2300,
    needsFace: true,
    apply: r({
      tints: [
        { color: '#D8C08A', opacity: 0.16 },
        { color: '#2A2318', opacity: 0.12 },
      ],
      grain: 0.26,
      contrast: 0.2,
    }),
  },
  {
    id: 'ai-eraser',
    name: 'Object Eraser',
    tagline: 'Remove photobombers, generative fill',
    category: 'utility',
    runtime: 'cloud',
    swatch: ['#3DDC97', '#0F3D33'],
    glyph: 'backspace',
    stages: ['Uploading frame (consented)', 'Mask proposal', 'Inpaint region'],
    ms: 1900,
    apply: r({
      tints: [{ color: '#3DDC97', opacity: 0.06 }],
      wash: { color: '#EAFFF6', opacity: 0.05 },
    }),
  },
  {
    id: 'ai-upscale',
    name: 'Ultra HD',
    tagline: '4× detail reconstruction',
    category: 'utility',
    runtime: 'device',
    swatch: ['#E8F1FF', '#5C8FD6'],
    glyph: 'expand',
    stages: ['Tile split', 'Detail reconstruction', 'Seam blend'],
    ms: 1100,
    apply: r({
      contrast: 0.16,
      tints: [{ color: '#EAF2FF', opacity: 0.05 }],
    }),
  },
  {
    id: 'ai-noise',
    name: 'Night Clean',
    tagline: 'Low-light denoise & tone recovery',
    category: 'utility',
    runtime: 'device',
    swatch: ['#8B5CFF', '#150E2E'],
    glyph: 'moon',
    stages: ['Noise profile', 'Temporal merge', 'Tone recovery'],
    ms: 1150,
    apply: r({
      tints: [
        { color: '#8B5CFF', opacity: 0.08 },
        { color: '#0B0F1E', opacity: 0.08 },
      ],
      bloom: 0.16,
      grain: 0.06,
    }),
  },
];

/** Effects are intentionally data-driven so new models can be dropped in at runtime. */
export function registerAiEffect(def: AiEffectDef) {
  const idx = AI_EFFECTS.findIndex((e) => e.id === def.id);
  if (idx >= 0) AI_EFFECTS[idx] = def;
  else AI_EFFECTS.unshift(def);
}

export function getFilter(id: string | null | undefined) {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

export function getAiEffect(id: string | null | undefined) {
  return AI_EFFECTS.find((e) => e.id === id) ?? null;
}

/** Sticker glyphs used by the editor's sticker tray. */
export const STICKER_PACKS: { title: string; glyphs: string[] }[] = [
  { title: 'Sparkle', glyphs: ['✨', '⭐', '🌟', '💫', '⚡', '🔥'] },
  { title: 'Love', glyphs: ['❤️', '💖', '💕', '😍', '😘', '🥰'] },
  { title: 'Party', glyphs: ['🎉', '🎈', '🎊', '🥳', '🥂', '🎁'] },
  { title: 'Creature', glyphs: ['🐶', '🐱', '🐻', '🦊', '🐼', '🦄'] },
  { title: 'Mood', glyphs: ['😎', '🤯', '🫠', '👻', '💀', '🤡'] },
  { title: 'Sign', glyphs: ['✅', '❌', '❗', '💬', '👑', '🌈'] },
];

export const TEXT_COLORS = ['#FFFFFF', '#0B0B0C', '#FF4D9D', '#35E1FF', '#C6FF4A', '#FFD166', '#8B5CFF'];

/** Layers a filter look with an AI effect look into a single renderable recipe. */
export function mergeRecipes(a: EffectRecipe, b: EffectRecipe | null | undefined): EffectRecipe {
  if (!b) return a;
  return {
    tints: [...a.tints, ...b.tints],
    wash: b.wash ?? a.wash ?? null,
    contrast: Math.max(a.contrast ?? 0, b.contrast ?? 0),
    vignette: Math.max(a.vignette, b.vignette),
    grain: Math.max(a.grain, b.grain),
    scanlines: Math.max(a.scanlines ?? 0, b.scanlines ?? 0) || undefined,
    frame: b.frame ?? a.frame ?? null,
    stickers: [...a.stickers, ...b.stickers],
    stamp: b.stamp ?? a.stamp ?? null,
    faceDisc: b.faceDisc ?? a.faceDisc ?? null,
    bloom: Math.max(a.bloom ?? 0, b.bloom ?? 0) || undefined,
  };
}
