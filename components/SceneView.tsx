import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SceneSpec, seededRandom, shade } from '../lib/sceneGen';

type Props = {
  spec: SceneSpec;
  /** pause animation while capturing so stills stay deterministic */
  animated?: boolean;
  style?: ViewStyle | ViewStyle[];
  dim?: number;
};

/**
 * Renders a procedural scene. Everything is drawn with plain views + gradients,
 * which keeps the compositor on the GPU thread — no image decoding, no network.
 */
export function SceneView({ spec, animated = true, style, dim = 0 }: Props) {
  const rand = useMemo(() => seededRandom(spec.seed), [spec.seed]);

  if (spec.imageUri) {
    return (
      <View style={[styles.fill, style]}>
        <Image source={{ uri: spec.imageUri }} style={styles.fill} contentFit="cover" transition={180} />
        <LinearGradient
          colors={[`${spec.colors[0]}55`, `${spec.colors[1]}33`]}
          style={styles.fill}
          pointerEvents="none"
        />
        {dim > 0 ? <View pointerEvents="none" style={[styles.fill, { backgroundColor: `rgba(0,0,0,${dim})` }]} /> : null}
      </View>
    );
  }

  return (
    <View style={[styles.fill, style]}>
      <LinearGradient
        colors={[spec.colors[0], spec.colors[1], spec.colors[2]]}
        locations={[0, 0.55, 1]}
        style={styles.fill}
      />
      <Decorations spec={spec} animated={animated} rand={rand} />
      {dim > 0 ? <View pointerEvents="none" style={[styles.fill, { backgroundColor: `rgba(0,0,0,${dim})` }]} /> : null}
    </View>
  );
}

function Decorations({
  spec,
  animated,
  rand,
}: {
  spec: SceneSpec;
  animated: boolean;
  rand: () => number;
}) {
  switch (spec.style) {
    case 'aurora':
      return <Aurora spec={spec} animated={animated} />;
    case 'cosmic':
      return <Cosmic spec={spec} animated={animated} rand={rand} />;
    case 'city':
      return <City spec={spec} rand={rand} />;
    case 'waves':
      return <Waves spec={spec} animated={animated} />;
    case 'forest':
      return <Forest spec={spec} rand={rand} />;
    case 'dunes':
      return <Dunes spec={spec} />;
    case 'neon':
      return <NeonGrid spec={spec} animated={animated} />;
    case 'studio':
    default:
      return <Studio spec={spec} />;
  }
}

/* ------------------------------------------------------------------ motion */

function Blob({
  color,
  size,
  left,
  top,
  duration,
  animated,
  radius = 999,
  opacity = 0.5,
  rotate = 0,
}: {
  color: string;
  size: number;
  left: number;
  top: number;
  duration: number;
  animated: boolean;
  radius?: number;
  opacity?: number;
  rotate?: number;
}) {
  const p = useSharedValue(0.2);

  useEffect(() => {
    if (animated) {
      p.value = withRepeat(withTiming(0.9, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      p.value = withTiming(0.55, { duration: 120 });
    }
  }, [animated, duration, p]);

  const st = useAnimatedStyle(() => ({
    opacity: (opacity ?? 0.5) * (0.55 + p.value * 0.6),
    transform: [
      { translateX: (p.value - 0.5) * 46 },
      { translateY: (p.value - 0.5) * -34 },
      { scale: 0.9 + p.value * 0.28 },
      { rotate: `${rotate + (p.value - 0.5) * 14}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: radius, backgroundColor: color, left, top },
        st,
      ]}
    />
  );
}

/* ----------------------------------------------------------------- styles */

function Aurora({ spec, animated }: { spec: SceneSpec; animated: boolean }) {
  const accent = spec.colors[3];
  return (
    <View style={styles.fill}>
      <Blob color={accent} size={260} left={-60} top={-40} duration={7200} animated={animated} opacity={0.55} radius={140} rotate={-24} />
      <Blob color={shade(accent, 0.3)} size={220} left={120} top={20} duration={9000} animated={animated} opacity={0.4} radius={120} rotate={18} />
      <Blob color={spec.colors[1]} size={300} left={-20} top={330} duration={11000} animated={animated} opacity={0.5} radius={160} rotate={8} />
      <View pointerEvents="none" style={[styles.horizonGlow, { backgroundColor: `${accent}22` }]} />
    </View>
  );
}

function Cosmic({ spec, animated, rand }: { spec: SceneSpec; animated: boolean; rand: () => number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, () => ({
        x: rand() * 100,
        y: rand() * 100,
        s: 1 + rand() * 2.2,
        d: 1800 + rand() * 3600,
      })),
    [rand]
  );
  const twinkle = useSharedValue(0);
  useEffect(() => {
    if (animated) {
      twinkle.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [animated, twinkle]);
  const tw = useAnimatedStyle(() => ({ opacity: 0.35 + twinkle.value * 0.65 }));

  return (
    <View style={styles.fill}>
      <Animated.View style={[styles.fill, tw]} pointerEvents="none">
        {stars.map((s, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              borderRadius: s.s,
              backgroundColor: i % 5 === 0 ? spec.colors[3] : '#FFFFFF',
            }}
          />
        ))}
      </Animated.View>
      <Blob color={spec.colors[1]} size={280} left={-70} top={200} duration={12000} animated={animated} opacity={0.55} />
      <Blob color={`${spec.colors[3]}`} size={130} left={180} top={70} duration={9000} animated={animated} opacity={0.35} />
      <View
        pointerEvents="none"
        style={[styles.planet, { borderColor: `${spec.colors[3]}33`, backgroundColor: `${spec.colors[1]}55`, bottom: -70 }]}
      />
    </View>
  );
}

function City({ spec, rand }: { spec: SceneSpec; rand: () => number }) {
  const towers = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        x: i * 9.4 - 2,
        w: 6 + rand() * 4,
        h: 18 + rand() * 30,
      })),
    [rand]
  );
  const windows = useMemo(
    () => Array.from({ length: 30 }, () => ({ x: rand() * 100, y: 40 + rand() * 40 })),
    [rand]
  );
  return (
    <View style={styles.fill} pointerEvents="none">
      {towers.map((t, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${t.x}%`,
            bottom: 0,
            width: `${t.w}%`,
            height: `${t.h}%`,
            backgroundColor: '#05040C',
            borderTopWidth: 1,
            borderColor: `${spec.colors[3]}44`,
            opacity: 0.92,
          }}
        />
      ))}
      {windows.map((w, i) => (
        <View
          key={`w${i}`}
          style={{
            position: 'absolute',
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: 3,
            height: 3,
            backgroundColor: i % 3 === 0 ? spec.colors[3] : '#FFE9A8',
            opacity: 0.8,
          }}
        />
      ))}
      <LinearGradient
        colors={['transparent', `${spec.colors[3]}22`]}
        style={styles.fill}
      />
    </View>
  );
}

function Waves({ spec, animated }: { spec: SceneSpec; animated: boolean }) {
  return (
    <View style={styles.fill} pointerEvents="none">
      <Blob color={`${spec.colors[3]}`} size={200} left={60} top={40} duration={8000} animated={animated} opacity={0.28} />
      {[0, 1, 2].map((i) => (
        <LinearGradient
          key={i}
          colors={['transparent', `${shade(spec.colors[3], 0.1)}${i === 0 ? '55' : '33'}`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.4 }}
          style={{
            position: 'absolute',
            left: -40,
            right: -40,
            top: 300 + i * 130,
            height: 120,
            opacity: 0.6 - i * 0.12,
            transform: [{ rotate: `${-4 + i * 3}deg` }],
            borderRadius: 120,
          }}
        />
      ))}
    </View>
  );
}

function Forest({ spec, rand }: { spec: SceneSpec; rand: () => number }) {
  const trunks = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: i * 11.5 - 3,
        w: 3 + rand() * 3,
        h: 55 + rand() * 35,
        o: 0.5 + rand() * 0.45,
      })),
    [rand]
  );
  return (
    <View style={styles.fill} pointerEvents="none">
      {trunks.map((t, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${t.x}%`,
            bottom: 0,
            width: t.w,
            height: `${t.h}%`,
            backgroundColor: '#04120B',
            opacity: t.o,
            borderRadius: 6,
          }}
        />
      ))}
      <LinearGradient colors={['transparent', `${spec.colors[3]}22`, `${spec.colors[3]}44`]} style={styles.fill} />
    </View>
  );
}

function Dunes({ spec }: { spec: SceneSpec }) {
  return (
    <View style={styles.fill} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: 200,
          backgroundColor: spec.colors[3],
          opacity: 0.5,
          right: -30,
          top: 60,
        }}
      />
      <LinearGradient
        colors={['transparent', `${spec.colors[2]}CC`]}
        style={{ position: 'absolute', left: -20, right: -20, bottom: -30, height: 240, borderRadius: 200, opacity: 0.9 }}
      />
      <LinearGradient
        colors={['transparent', spec.colors[2]]}
        style={{ position: 'absolute', left: -60, right: -60, bottom: -80, height: 200, borderRadius: 200 }}
      />
    </View>
  );
}

function NeonGrid({ spec, animated }: { spec: SceneSpec; animated: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (animated) {
      p.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, true);
    }
  }, [animated, p]);
  const st = useAnimatedStyle(() => ({ opacity: 0.25 + p.value * 0.5 }));
  return (
    <View style={styles.fill} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          alignSelf: 'center',
          top: 90,
          width: 150,
          height: 150,
          borderRadius: 150,
          backgroundColor: spec.colors[3],
          opacity: 0.55,
        }}
      />
      <Animated.View style={[styles.fill, st]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: -30,
              right: -30,
              top: 300 + i * i * 12,
              height: 1,
              backgroundColor: spec.colors[3],
              opacity: 0.6,
            }}
          />
        ))}
        {[-2, -1, 0, 1, 2].map((i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              top: 300,
              bottom: 0,
              left: `${50 + i * 22}%`,
              width: 1,
              backgroundColor: spec.colors[3],
              opacity: 0.45,
              transform: [{ skewX: `${i * 6}deg` }],
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function Studio({ spec }: { spec: SceneSpec }) {
  return (
    <View style={styles.fill} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          alignSelf: 'center',
          top: 60,
          width: 320,
          height: 320,
          borderRadius: 320,
          backgroundColor: spec.colors[3],
          opacity: 0.28,
        }}
      />
      <LinearGradient
        colors={['transparent', `${spec.colors[2]}88`]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  horizonGlow: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: 120,
    height: 180,
    opacity: 0.5,
  },
  planet: {
    position: 'absolute',
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 260,
    borderWidth: 1,
  },
});
