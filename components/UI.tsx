import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';

/* ------------------------------------------------------------------- glass */

export function Glass({
  children,
  style,
  intensity = 28,
  dark = true,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  dark?: boolean;
  padded?: boolean;
}) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: dark ? 'rgba(8,10,16,0.35)' : 'rgba(255,255,255,0.35)',
            borderRadius: radius.lg,
          },
        ]}
      />
      <View style={padded ? styles.glassInner : undefined}>{children}</View>
    </View>
  );
}

/* -------------------------------------------------------------- icon button */

export function IconButton({
  name,
  onPress,
  active = false,
  size = 20,
  color,
  background = true,
  style,
  hitSlop = 8,
  accessibilityLabel,
  tintActive,
  disabled = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  active?: boolean;
  size?: number;
  color?: string;
  background?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  tintActive?: string;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? String(name)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => haptics.light()}
      onPress={() => onPress?.()}
      style={({ pressed }) => [
        disabled && { opacity: 0.35 },
        background && {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? tintActive ?? c.accentSoft : c.glass,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: active ? tintActive ?? c.accent : c.glassBorder,
        },
        pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? (active ? tintActive ?? c.accent : c.text)} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------- chip */

export function Chip({
  label,
  glyph,
  active = false,
  onPress,
  style,
}: {
  label: string;
  glyph?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.accent : c.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(10,16,30,0.05)',
          borderColor: active ? c.accent : c.border,
        },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {glyph ? (
        <Ionicons name={glyph} size={13} color={active ? '#fff' : c.textDim} style={{ marginRight: 6 }} />
      ) : null}
      <Text style={[styles.chipText, { color: active ? '#fff' : c.textDim }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ----------------------------------------------------------- section header */

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  glyph,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  glyph?: keyof typeof Ionicons.glyphMap;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {glyph ? <Ionicons name={glyph} size={16} color={c.accent} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
        </View>
        {subtitle ? <Text style={[styles.sectionSub, { color: c.textFaint }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            haptics.tap();
            onAction();
          }}
          hitSlop={10}
        >
          <Text style={[styles.sectionAction, { color: c.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- empty state */

export function EmptyState({
  glyph,
  title,
  subtitle,
  actionLabel,
  onAction,
  compact = false,
}: {
  glyph: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.empty, compact && { paddingVertical: 24 }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft, borderColor: `${c.accent}33` }]}>
        <Ionicons name={glyph} size={compact ? 22 : 28} color={c.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: c.textDim }]}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <GradientButton label={actionLabel} onPress={onAction} style={{ marginTop: 16 }} icon="camera" />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ buttons */

export function GradientButton({
  label,
  onPress,
  icon,
  style,
  disabled = false,
  small = false,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  small?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      onPressIn={() => haptics.light()}
      onPress={() => onPress?.()}
      style={({ pressed }) => [style, disabled && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <LinearGradient
        colors={
          c.mode === 'dark'
            ? (['#8B5CFF', '#5B7CFF', '#35E1FF'] as [string, string, string])
            : (['#6D3DF5', '#4F63E8', '#0FA6D1'] as [string, string, string])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBtn, small && { paddingVertical: 9, paddingHorizontal: 14 }]}
      >
        {icon ? <Ionicons name={icon} size={small ? 15 : 18} color="#fff" style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.gradientBtnText, small && { fontSize: 13 }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  style,
  danger = false,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  danger?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.ghostBtn,
        {
          backgroundColor: danger
            ? `${c.red}18`
            : c.mode === 'dark'
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(10,16,30,0.05)',
          borderColor: danger ? `${c.red}55` : c.border,
        },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={danger ? c.red : c.text} style={{ marginRight: 8 }} /> : null}
      <Text style={[styles.ghostBtnText, { color: danger ? c.red : c.text }]}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ slider */

export function AppSlider({
  label,
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const { c } = useTheme();
  const pct = (value - min) / (max - min || 1);
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHead}>
        <Text style={[styles.sliderLabel, { color: c.textDim }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: c.text }]}>
          {format ? format(value) : `${Math.round(pct * 100)}`}
        </Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        onSlidingStart={() => haptics.tap()}
        minimumTrackTintColor={c.accent}
        maximumTrackTintColor={c.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(10,16,30,0.14)'}
        thumbTintColor={c.accent}
        style={{ width: '100%', height: 34 }}
      />
    </View>
  );
}

/* --------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  compact = false,
}: {
  items: { key: T; label: string; glyph?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.segmented,
        {
          backgroundColor: c.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(10,16,30,0.05)',
          borderColor: c.border,
        },
      ]}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.tap();
              onChange(it.key);
            }}
            style={[styles.segmentItem, compact && { paddingVertical: 6 }]}
          >
            {active ? (
              <Animated.View
                entering={FadeIn.duration(160)}
                style={[StyleSheet.absoluteFill, styles.segmentActiveWrap]}
              >
                <LinearGradient
                  colors={
                    c.mode === 'dark'
                      ? (['rgba(139,92,255,0.95)', 'rgba(91,124,255,0.95)'] as [string, string])
                      : (['#6D3DF5', '#4F63E8'] as [string, string])
                  }
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}
            {it.glyph ? (
              <Ionicons name={it.glyph} size={14} color={active ? '#fff' : c.textDim} style={{ marginRight: 6 }} />
            ) : null}
            <Text style={[styles.segmentText, { color: active ? '#fff' : c.textDim }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------ processing overlay */

export function ProcessingOverlay({
  visible,
  title,
  stages,
  stageIndex,
  hint,
}: {
  visible: boolean;
  title: string;
  stages: string[];
  stageIndex: number;
  hint?: string;
}) {
  const { c } = useTheme();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    }
  }, [visible, spin]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  if (!visible) return null;

  const pct = stages.length ? Math.min(1, (stageIndex + 0.35) / stages.length) : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, zIndex: 60 }]}
    >
      <View style={styles.center}>
        <View style={styles.procCard}>
          <Animated.View style={[styles.procRing, ring]}>
            <LinearGradient
              colors={[c.accent, c.accentAlt, c.pink, c.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={[styles.procCore, { backgroundColor: c.surface2 }]}>
            <Ionicons name="sparkles" size={20} color={c.accent} />
          </View>

          <Text style={[styles.procTitle, { color: c.text }]}>{title}</Text>

          <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
            {stages.map((s, i) => {
              const done = i < stageIndex;
              const active = i === stageIndex;
              return (
                <View key={s} style={styles.stageRow}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : active ? 'ellipse' : 'ellipse-outline'}
                    size={14}
                    color={done ? c.green : active ? c.accent : c.textFaint}
                  />
                  <Text
                    style={[styles.stageText, { color: done ? c.textDim : active ? c.text : c.textFaint }]}
                  >
                    {s}
                  </Text>
                </View>
              );
            })}
          </View>

          <View
            style={[
              styles.procTrack,
              { backgroundColor: c.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(10,16,30,0.1)' },
            ]}
          >
            <View
              style={{
                width: `${Math.round(pct * 100)}%`,
                height: '100%',
                backgroundColor: c.accent,
                borderRadius: 4,
              }}
            />
          </View>

          {hint ? <Text style={[styles.procHint, { color: c.textFaint }]}>{hint}</Text> : null}
          <ActivityIndicator color={c.accent} style={{ marginTop: 14 }} />
        </View>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ banner */

export function Banner({
  text,
  glyph = 'information-circle',
  tone = 'info',
  style,
}: {
  text: string;
  glyph?: keyof typeof Ionicons.glyphMap;
  tone?: 'info' | 'success' | 'warn' | 'error';
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const color = tone === 'success' ? c.green : tone === 'warn' ? c.amber : tone === 'error' ? c.red : c.accentAlt;
  return (
    <View style={[styles.banner, { backgroundColor: `${color}1A`, borderColor: `${color}44` }, style]}>
      <Ionicons name={glyph} size={15} color={color} style={{ marginRight: 8 }} />
      <Text style={[styles.bannerText, { color: c.text }]}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  glassWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  glassInner: { padding: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, marginTop: 3 },
  sectionAction: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingHorizontal: 34, paddingVertical: 40 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
  },
  gradientBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600' },
  sliderRow: { marginBottom: 4 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontSize: 12.5, fontWeight: '600' },
  sliderValue: { fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segmentActiveWrap: { borderRadius: radius.pill, overflow: 'hidden' },
  segmentText: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  procCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,20,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  procRing: {
    width: 74,
    height: 74,
    borderRadius: 74,
    overflow: 'hidden',
    marginBottom: 16,
  },
  procCore: {
    position: 'absolute',
    top: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  procTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  stageText: { fontSize: 13, marginLeft: 9, fontWeight: '500' },
  procTrack: {
    height: 5,
    borderRadius: 4,
    alignSelf: 'stretch',
    marginTop: 16,
    overflow: 'hidden',
  },
  procHint: { fontSize: 11.5, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
});
