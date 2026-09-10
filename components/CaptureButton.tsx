import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { formatDuration } from '../lib/format';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 78;
const RING = SIZE + 16;
const RADIUS = RING / 2;
const CIRC = 2 * Math.PI * (RADIUS - 5);

/**
 * Shutter control.
 * Tap → still. Press & hold → video, with a live progress ring and a morphing
 * stop square. Every state change fires haptics where the platform supports it.
 */
export function CaptureButton({
  mode,
  recording,
  disabled = false,
  maxMs = 60000,
  elapsedMs = 0,
  onCapture,
  onRecordStart,
  onRecordEnd,
}: {
  mode: 'photo' | 'video';
  recording: boolean;
  disabled?: boolean;
  maxMs?: number;
  elapsedMs?: number;
  onCapture: () => void;
  onRecordStart: () => void;
  onRecordEnd: () => void;
}) {
  const { c } = useTheme();
  const press = useSharedValue(0);
  const pulse = useSharedValue(0);
  const flash = useSharedValue(0);

  React.useEffect(() => {
    if (recording) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 180 });
    }
  }, [recording, pulse]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.1 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: recording ? 0.18 + pulse.value * 0.28 : 0,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    width: recording ? 30 : SIZE - 16,
    height: recording ? 30 : SIZE - 16,
    borderRadius: recording ? 9 : (SIZE - 16) / 2,
  }));

  const props = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - Math.min(1, elapsedMs / maxMs)),
  }));

  const triggerFlash = () => {
    flash.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 220 }));
  };

  const flashStyle = useAnimatedStyle(() => ({ opacity: 1 - flash.value }));

  const ringColor = recording ? c.red : c.mode === 'dark' ? '#FFFFFF' : '#0C1220';

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          { backgroundColor: recording ? c.red : c.accent },
          haloStyle,
        ]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          recording ? 'Stop recording' : mode === 'video' ? 'Record video' : 'Take photo'
        }
        disabled={disabled}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: 140 });
          if (recording) onRecordEnd();
        }}
        onPress={() => {
          if (disabled || recording) return;
          haptics.heavy();
          triggerFlash();
          onCapture();
        }}
        onLongPress={() => {
          if (disabled) return;
          haptics.medium();
          onRecordStart();
        }}
        delayLongPress={330}
        style={({ pressed }) => [
          { width: RING, height: RING, opacity: disabled ? 0.4 : 1 },
          pressed && !recording ? { opacity: 0.9 } : undefined,
        ]}
      >
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RADIUS}
            cy={RADIUS}
            r={RADIUS - 5}
            stroke={ringColor}
            strokeOpacity={recording ? 0.25 : 0.35}
            strokeWidth={4}
            fill="none"
          />
          {recording ? (
            <AnimatedCircle
              cx={RADIUS}
              cy={RADIUS}
              r={RADIUS - 5}
              stroke={c.red}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              animatedProps={props}
              transform={`rotate(-90 ${RADIUS} ${RADIUS})`}
            />
          ) : null}
        </Svg>

        <Animated.View style={[styles.ringPulse, pressStyle]}>
          <Animated.View style={[styles.ringPulse, StyleSheet.absoluteFill]}>
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', borderRadius: RING / 2 }, flashStyle]}
            />
          </Animated.View>
          <Animated.View style={[styles.innerWrap]}>
            <Animated.View style={[styles.inner, innerStyle]}>
              <LinearGradient
                colors={
                  recording
                    ? ([c.red, '#FF2E4D'] as [string, string])
                    : c.mode === 'dark'
                      ? (['#FFFFFF', '#D8DEEA'] as [string, string])
                      : (['#FFFFFF', '#E6EAF3'] as [string, string])
                }
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Pressable>

      {recording ? (
        <View style={[styles.timerPill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.recDot, { backgroundColor: c.red }]} />
          <Text style={styles.timerText}>{formatDuration(elapsedMs)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: RING + 26,
    height: RING + 26,
    borderRadius: (RING + 26) / 2,
  },
  ringPulse: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerWrap: { alignItems: 'center', justifyContent: 'center' },
  inner: { overflow: 'hidden' },
  timerPill: {
    position: 'absolute',
    top: -34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  recDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  timerText: { color: '#fff', fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
