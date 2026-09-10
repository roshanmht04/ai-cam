import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { EffectRecipe, StickerSpec } from '../lib/catalog';
import { useFaceLock } from '../lib/face';

const EMOJI_BASE = 64;

type Box = { width: number; height: number };

/**
 * Renders a declarative {@link EffectRecipe} on top of any surface.
 *
 * Every layer is a plain (or worklet-animated) view, so the whole stack is
 * composited by the render thread — the JS thread never runs per frame.
 */
export function EffectStack({
  recipe,
  box,
  followFace = true,
  style,
}: {
  recipe: EffectRecipe;
  box: Box;
  followFace?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { tints, wash, contrast = 0, vignette, grain, scanlines, frame, stamp, faceDisc } = recipe;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {tints.map((t, i) => (
        <View
          key={`t${i}`}
          style={[StyleSheet.absoluteFill, { backgroundColor: t.color, opacity: t.opacity }]}
        />
      ))}

      {contrast !== 0 ? (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#05070C', opacity: Math.max(0, contrast) * 0.2 },
            ]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#FFFFFF', opacity: Math.max(0, contrast) * 0.1 },
            ]}
          />
        </>
      ) : null}

      {wash ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: wash.color, opacity: wash.opacity }]} />
      ) : null}

      {recipe.bloom ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: recipe.bloom * 0.14 }]} />
      ) : null}

      {vignette > 0 ? <Vignette strength={vignette} /> : null}

      {scanlines ? <Scanlines strength={scanlines} /> : null}

      {grain > 0 ? <Grain strength={grain} /> : null}

      {frame ? (
        <View
          style={{
            position: 'absolute',
            top: frame.width / 2,
            left: frame.width / 2,
            right: frame.width / 2,
            bottom: frame.width / 2,
            borderWidth: frame.width,
            borderColor: frame.color,
            opacity: 0.9,
          }}
        />
      ) : null}

      {stamp ? (
        <Text
          style={{
            position: 'absolute',
            left: 18,
            bottom: 22,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 1.4,
            textShadowColor: 'rgba(0,0,0,0.6)',
            textShadowRadius: 4,
            textShadowOffset: { width: 0, height: 1 },
            fontVariant: ['tabular-nums'],
          }}
        >
          {stamp}
        </Text>
      ) : null}

      {faceDisc && followFace ? <FaceDisc spec={faceDisc} box={box} /> : null}

      {recipe.stickers.map((s) =>
        s.space === 'frame' ? (
          <FrameSticker key={s.id} spec={s} box={box} />
        ) : (
          <FaceSticker key={s.id} spec={s} box={box} />
        )
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ vignette */

function Vignette({ strength }: { strength: number }) {
  const o = Math.min(0.85, strength);
  return (
    <>
      <LinearGradient
        colors={[`rgba(0,0,0,${o})`, 'rgba(0,0,0,0)']}
        style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', `rgba(0,0,0,${o * 0.9})`]}
        style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
      />
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={[`rgba(0,0,0,${o * 0.8})`, 'rgba(0,0,0,0)', `rgba(0,0,0,${o * 0.8})`]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

/* ----------------------------------------------------------------- scanlines */

function Scanlines({ strength }: { strength: number }) {
  const stops = 14;
  const colors: string[] = [];
  const locations: number[] = [];
  for (let i = 0; i < stops; i++) {
    const dark = i % 2 === 0;
    colors.push(dark ? `rgba(0,0,0,${0.42 * strength})` : 'rgba(0,0,0,0)');
    locations.push(i / (stops - 1));
  }
  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      locations={locations as [number, number, ...number[]]}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
    />
  );
}

/* -------------------------------------------------------------------- grain */

const DOTS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 61) % 100,
  s: 1 + ((i * 13) % 3),
  light: i % 3 === 0,
}));

function Grain({ strength }: { strength: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: strength * 0.5 }]}>
      {DOTS.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.s,
            height: d.s,
            borderRadius: d.s,
            backgroundColor: d.light ? '#FFFFFF' : '#000000',
            opacity: 0.55,
          }}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ stickers */

function FaceSticker({ spec, box }: { spec: StickerSpec; box: Box }) {
  const lock = useFaceLock();
  const minDim = Math.min(box.width, box.height) || 1;

  const animated = useAnimatedStyle(() => {
    const face = lock.size.value * minDim;
    const fs = Math.max(8, spec.size * face);
    const cx = lock.x.value * box.width + spec.dx * face;
    const cy = lock.y.value * box.height + spec.dy * face;
    return {
      transform: [
        { translateX: cx - box.width / 2 },
        { translateY: cy - box.height / 2 },
        { scale: fs / EMOJI_BASE },
        { rotate: `${spec.rotate ?? 0}deg` },
      ],
    };
  });

  return (
    <Animated.Text
      style={[
        styles.emoji,
        { left: box.width / 2 - EMOJI_BASE / 2, top: box.height / 2 - EMOJI_BASE / 2 },
        { opacity: spec.opacity ?? 1 },
        animated,
      ]}
    >
      {spec.glyph}
    </Animated.Text>
  );
}

function FrameSticker({ spec, box }: { spec: StickerSpec; box: Box }) {
  const size = (spec.fsize ?? 0.08) * box.width;
  return (
    <Text
      style={{
        position: 'absolute',
        left: (spec.fx ?? 0.5) * box.width - size / 2,
        top: (spec.fy ?? 0.5) * box.height - size / 2,
        fontSize: size,
        lineHeight: size * 1.05,
        opacity: spec.opacity ?? 1,
        transform: [{ rotate: `${spec.rotate ?? 0}deg` }],
      }}
    >
      {spec.glyph}
    </Text>
  );
}

function FaceDisc({
  spec,
  box,
}: {
  spec: NonNullable<EffectRecipe['faceDisc']>;
  box: Box;
}) {
  const lock = useFaceLock();
  const minDim = Math.min(box.width, box.height) || 1;

  const animated = useAnimatedStyle(() => {
    const face = lock.size.value * minDim;
    const d = face * spec.scale;
    const cx = lock.x.value * box.width;
    const cy = lock.y.value * box.height;
    return {
      width: d,
      height: d,
      borderRadius: d / 2,
      left: cx - d / 2,
      top: cy - d / 2,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          backgroundColor: spec.color,
          opacity: spec.opacity,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.35)',
        },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  emoji: {
    position: 'absolute',
    width: EMOJI_BASE,
    height: EMOJI_BASE,
    fontSize: EMOJI_BASE,
    lineHeight: EMOJI_BASE * 1.02,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 2 },
  },
});
