import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { radius, useTheme } from '../lib/theme';
import { GhostButton, GradientButton } from './UI';

/**
 * Full-bleed permission primer. Explains *why* access is needed before the
 * OS dialog appears, which dramatically improves grant rates — and makes the
 * privacy stance explicit up front.
 */
export function PermissionGate({
  icon,
  title,
  headline,
  bullets,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  headline: string;
  bullets: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={[`${c.accent}33`, 'transparent']}
        style={styles.glowTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', `${c.accentAlt}22`]}
        style={styles.glowBottom}
        pointerEvents="none"
      />

      <Animated.View entering={FadeInDown.duration(420)} style={{ alignItems: 'center' }}>
        <View style={[styles.badge, { backgroundColor: c.surface2, borderColor: `${c.accent}55` }]}>
          <LinearGradient
            colors={[c.accent, c.accentAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name={icon} size={34} color="#fff" />
        </View>
        <Text style={[styles.kicker, { color: c.accent }]}>{title}</Text>
        <Text style={[styles.headline, { color: c.text }]}>{headline}</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120).duration(420)} style={{ marginTop: 28 }}>
        {bullets.map((b, i) => (
          <View key={b.text} style={[styles.bullet, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.bulletIcon, { backgroundColor: c.accentSoft }]}>
              <Ionicons name={b.icon} size={16} color={c.accent} />
            </View>
            <Text style={[styles.bulletText, { color: c.textDim }]}>{b.text}</Text>
            {i === bullets.length - 1 ? null : <View style={[styles.sep, { backgroundColor: c.border }]} />}
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(220).duration(420)} style={styles.actions}>
        <GradientButton label={primaryLabel} onPress={onPrimary} icon="lock-open" />
        {secondaryLabel && onSecondary ? (
          <GhostButton label={secondaryLabel} onPress={onSecondary} style={{ marginTop: 12 }} />
        ) : null}
        <Text style={[styles.footnote, { color: c.textFaint }]}>
          Captures stay in your private library. Nothing is uploaded unless you switch on cloud
          processing yourself.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 26, paddingTop: 40, justifyContent: 'center' },
  glowTop: { position: 'absolute', top: -120, left: -60, right: -60, height: 300, opacity: 0.7 },
  glowBottom: { position: 'absolute', bottom: -140, left: -60, right: -60, height: 320, opacity: 0.6 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 22,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  headline: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
    textAlign: 'center',
    lineHeight: 33,
    paddingHorizontal: 10,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10,
  },
  bulletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  sep: { position: 'absolute', left: 58, right: 12, bottom: 0, height: StyleSheet.hairlineWidth },
  actions: { marginTop: 26 },
  footnote: { fontSize: 11.5, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
