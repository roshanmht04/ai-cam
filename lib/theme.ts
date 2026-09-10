import { useColorScheme } from 'react-native';
import { useApp } from './store';

/**
 * AURA design tokens — premium, modern dark with a light counterpart.
 * Every screen reads colors through `useTheme()` so appearance switching is instant.
 */

export const gradients = {
  brand: ['#8B5CFF', '#5B7CFF', '#35E1FF'] as const,
  sunset: ['#FF7A45', '#FF4D9D', '#8B5CFF'] as const,
  neon: ['#35E1FF', '#8B5CFF', '#FF4D9D'] as const,
  mint: ['#3DDC97', '#35E1FF'] as const,
  gold: ['#FFD166', '#FF9F1C'] as const,
  ice: ['#E8F1FF', '#9FC5FF'] as const,
  night: ['#0B0D14', '#141826'] as const,
};

export type Palette = {
  mode: 'dark' | 'light';
  bg: string;
  bgDeep: string;
  surface: string;
  surface2: string;
  surface3: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentAlt: string;
  accentSoft: string;
  cyan: string;
  pink: string;
  lime: string;
  amber: string;
  red: string;
  green: string;
  glass: string;
  glassBorder: string;
  scrim: string;
  shadow: string;
  overlayText: string;
};

const dark: Palette = {
  mode: 'dark',
  bg: '#05060A',
  bgDeep: '#000000',
  surface: '#0D0F15',
  surface2: '#151922',
  surface3: '#1D222E',
  elevated: '#232936',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F3F5F9',
  textDim: '#98A0B3',
  textFaint: '#5E6779',
  accent: '#8B5CFF',
  accentAlt: '#35E1FF',
  accentSoft: 'rgba(139,92,255,0.18)',
  cyan: '#35E1FF',
  pink: '#FF4D9D',
  lime: '#C6FF4A',
  amber: '#FFB547',
  red: '#FF5A6A',
  green: '#3DDC97',
  glass: 'rgba(10,12,18,0.55)',
  glassBorder: 'rgba(255,255,255,0.12)',
  scrim: 'rgba(0,0,0,0.62)',
  shadow: '#000000',
  overlayText: '#FFFFFF',
};

const light: Palette = {
  mode: 'light',
  bg: '#F5F7FB',
  bgDeep: '#EAEEF6',
  surface: '#FFFFFF',
  surface2: '#F1F4FA',
  surface3: '#E5EAF3',
  elevated: '#FFFFFF',
  border: 'rgba(10,16,30,0.08)',
  borderStrong: 'rgba(10,16,30,0.16)',
  text: '#0C1220',
  textDim: '#5A6478',
  textFaint: '#939CB0',
  accent: '#6D3DF5',
  accentAlt: '#0FA6D1',
  accentSoft: 'rgba(109,61,245,0.12)',
  cyan: '#0FA6D1',
  pink: '#E23E85',
  lime: '#6FA80B',
  amber: '#C97C05',
  red: '#DC3545',
  green: '#12A46B',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(10,16,30,0.10)',
  scrim: 'rgba(8,12,22,0.45)',
  shadow: '#1A2340',
  overlayText: '#FFFFFF',
};

export const palettes = { dark, light };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

/** Soft elevation used across cards. */
export function elevation(c: Palette, level: 1 | 2 | 3 = 1) {
  const base = level === 1 ? 2 : level === 2 ? 6 : 14;
  return {
    shadowColor: c.shadow,
    shadowOpacity: c.mode === 'dark' ? 0.45 : 0.14,
    shadowRadius: base * 2,
    shadowOffset: { width: 0, height: base },
    elevation: base,
  };
}

/** Resolved theme for the current appearance setting. */
export function useTheme() {
  const scheme = useColorScheme();
  const { settings } = useApp();
  const pref = settings.appearance;
  const mode: 'dark' | 'light' =
    pref === 'system' ? (scheme === 'light' ? 'light' : 'dark') : pref;
  return { c: palettes[mode], isDark: mode === 'dark' };
}
