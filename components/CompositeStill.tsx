import React, { forwardRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { EffectRecipe } from '../lib/catalog';
import { SceneSpec } from '../lib/sceneGen';
import { SubjectShape } from '../lib/store';
import { SceneView } from './SceneView';
import { EffectStack } from './EffectStack';

export type Box = { width: number; height: number };

/**
 * The "final look" renderer. Used both for the editor canvas and for baking a
 * still at capture time (via react-native-view-shot) so the saved file matches
 * exactly what the user saw in the viewfinder.
 */
export const CompositeStill = forwardRef<
  View,
  {
    uri: string;
    recipe: EffectRecipe;
    box: Box;
    scene?: SceneSpec | null;
    subject?: SubjectShape;
    mirror?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(function CompositeStill({ uri, recipe, box, scene, subject, mirror = false, style }, ref) {
  const shape = subject ?? { scale: 1, offsetY: 0, softness: 0.5 };
  const winW = box.width * (scene ? 0.66 * shape.scale : 1);
  const winH = box.height * (scene ? 0.58 * shape.scale : 1);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        { width: box.width, height: box.height, backgroundColor: '#000000', overflow: 'hidden' },
        style,
      ]}
    >
      {scene ? <SceneView spec={scene} animated={false} /> : null}

      <View
        style={{
          position: 'absolute',
          left: (box.width - winW) / 2,
          top: (box.height - winH) / 2 + shape.offsetY,
          width: winW,
          height: winH,
          borderRadius: scene ? winW * 0.42 : 0,
          overflow: 'hidden',
          opacity: 1 - shape.softness * 0.12,
        }}
      >
        <Image
          source={{ uri }}
          contentFit="cover"
          style={[
            { width: '100%', height: '100%' },
            mirror ? { transform: [{ scaleX: -1 }] } : undefined,
          ]}
        />
      </View>

      {scene ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          style={{
            position: 'absolute',
            left: (box.width - winW) / 2,
            top: (box.height - winH) / 2 + shape.offsetY,
            width: winW,
            height: winH,
            borderRadius: winW * 0.42,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.35)',
          }}
        />
      ) : null}

      <EffectStack recipe={recipe} box={box} followFace={false} />
    </View>
  );
});
