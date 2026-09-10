import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin wrapper so every call site can fire-and-forget without try/catch noise.
 * On web there is no haptics API — we no-op (optionally still animating UI).
 */

let enabled = true;
let level: 'light' | 'medium' | 'off' = 'medium';

export function configureHaptics(on: boolean, l: 'light' | 'medium' | 'off') {
  enabled = on;
  level = l;
}

function supported() {
  return Platform.OS !== 'web' && enabled && level !== 'off';
}

export const haptics = {
  tap() {
    if (!supported()) return;
    Haptics.selectionAsync().catch(() => {});
  },
  light() {
    if (!supported()) return;
    Haptics.impactAsync(
      level === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    ).catch(() => {});
  },
  medium() {
    if (!supported()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  heavy() {
    if (!supported()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  success() {
    if (!supported()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (!supported()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
