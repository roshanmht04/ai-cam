import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FILTERS, STICKER_PACKS, TEXT_COLORS, EffectRecipe, getFilter, mergeRecipes } from '../lib/catalog';
import { useApp, useSceneResolver } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { clamp, uid } from '../lib/format';
import { saveToCameraRoll, shareMedia } from '../lib/media';
import { CompositeStill } from '../components/CompositeStill';
import { AppSlider, Banner, GradientButton, IconButton, ProcessingOverlay } from '../components/UI';

type Adjust = {
  exposure: number;
  contrast: number;
  warmth: number;
  tint: number;
  fade: number;
  vignette: number;
  grain: number;
};

type Sticker = { id: string; glyph: string; x: number; y: number; scale: number };
type Caption = { id: string; text: string; color: string; x: number; y: number; scale: number };
type RatioKey = 'orig' | '1:1' | '4:5' | '16:9' | '9:16';

type EditorState = {
  filterId: string;
  adjust: Adjust;
  ratio: RatioKey;
  rotation: number;
  stickers: Sticker[];
  captions: Caption[];
};

const ZERO_ADJUST: Adjust = {
  exposure: 0,
  contrast: 0,
  warmth: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
};

const RATIOS: { key: RatioKey; label: string; value: number | null }[] = [
  { key: 'orig', label: 'Original', value: 0.75 },
  { key: '1:1', label: '1:1', value: 1 },
  { key: '4:5', label: '4:5', value: 0.8 },
  { key: '16:9', label: '16:9', value: 16 / 9 },
  { key: '9:16', label: '9:16', value: 9 / 16 },
];

type Tool = 'look' | 'adjust' | 'crop' | 'sticker' | 'text';

export default function EditorScreen({ route, navigation }: { route: any; navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { gallery, addCapture, settings, selection } = useApp();
  const resolveScene = useSceneResolver();

  const item = useMemo(() => gallery.find((g) => g.id === route.params?.id) ?? null, [gallery, route.params?.id]);

  const [state, setState] = useState<EditorState>({
    filterId: item?.filterId ?? 'none',
    adjust: ZERO_ADJUST,
    ratio: 'orig',
    rotation: 0,
    stickers: [],
    captions: [],
  });
  const [history, setHistory] = useState<EditorState[]>([state]);
  const [pointer, setPointer] = useState(0);
  const [tool, setTool] = useState<Tool>('look');
  const [selected, setSelected] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'share' | 'export'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<View>(null);

  const scene = resolveScene(item?.sceneId ?? null);
  const rotated = state.rotation === 90 || state.rotation === 270;

  const commit = useCallback(
    (next: EditorState) => {
      setState(next);
      setHistory((prev) => [...prev.slice(0, pointer + 1), next].slice(-40));
      setPointer((p) => Math.min(p + 1, 39));
    },
    [pointer]
  );

  const patch = useCallback(
    (p: Partial<EditorState>) => {
      commit({ ...state, ...p });
    },
    [commit, state]
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ------------------------------------------------------------- geometry */
  const availW = width - 40;
  const availH = Math.min(height * 0.52, 460);
  const ratioValue = RATIOS.find((r) => r.key === state.ratio)?.value ?? 0.75;
  const box = useMemo(() => {
    let w = availW;
    let h = w / ratioValue;
    if (h > availH) {
      h = availH;
      w = h * ratioValue;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [availW, availH, ratioValue]);

  /* --------------------------------------------------------------- recipe */
  const recipe = useMemo<EffectRecipe>(() => {
    const base = getFilter(state.filterId).recipe;
    const a = state.adjust;
    const layers: EffectRecipe = {
      tints: [],
      vignette: 0,
      grain: 0,
      stickers: [],
    };
    if (a.exposure !== 0) {
      layers.tints.push({
        color: a.exposure > 0 ? '#FFFFFF' : '#000000',
        opacity: Math.abs(a.exposure) * 0.3,
      });
    }
    if (a.warmth !== 0) {
      layers.tints.push({
        color: a.warmth > 0 ? '#FF9A3C' : '#4DA3FF',
        opacity: Math.abs(a.warmth) * 0.22,
      });
    }
    if (a.tint !== 0) {
      layers.tints.push({
        color: a.tint > 0 ? '#FF4DC4' : '#4DFFA8',
        opacity: Math.abs(a.tint) * 0.16,
      });
    }
    if (a.fade !== 0) {
      layers.wash = { color: '#EDE7DC', opacity: a.fade * 0.32 };
    }
    layers.contrast = a.contrast;
    layers.vignette = a.vignette;
    layers.grain = a.grain;
    return mergeRecipes(base, layers);
  }, [state.adjust, state.filterId]);

  /* ----------------------------------------------------------------- save */
  const bake = useCallback(async (): Promise<string | null> => {
    if (!canvasRef.current) return item?.uri ?? null;
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const shot = await captureRef(canvasRef, {
        format: 'jpg',
        quality: settings.quality === 'max' ? 0.95 : 0.82,
        width: Math.round(box.width * 2),
        height: Math.round(box.height * 2),
      });
      return shot || item?.uri || null;
    } catch {
      return item?.uri ?? null;
    }
  }, [box.height, box.width, item?.uri, settings.quality]);

  const save = useCallback(async () => {
    setBusy('save');
    const uri = await bake();
    if (!uri) {
      setBusy(null);
      setToast('Could not render the edit');
      return;
    }
    const created = await addCapture({
      sourceUri: uri,
      kind: 'photo',
      width: box.width,
      height: box.height,
      filterId: state.filterId,
      sceneId: item?.sceneId ?? null,
      lookName: getFilter(state.filterId).name,
    });
    setBusy(null);
    haptics.success();
    setToast(created ? 'Saved as a new copy in your library' : 'Save failed');
  }, [addCapture, bake, box.height, box.width, item?.sceneId, state.filterId]);

  const share = useCallback(async () => {
    setBusy('share');
    const uri = await bake();
    setBusy(null);
    if (!uri) return;
    const res = await shareMedia(uri, 'photo');
    if (!res.ok && res.reason !== 'Cancelled') setToast(res.reason ?? 'Sharing unavailable');
  }, [bake]);

  const exportToRoll = useCallback(async () => {
    setBusy('export');
    const uri = await bake();
    setBusy(null);
    if (!uri) return;
    const res = await saveToCameraRoll(uri);
    haptics.success();
    setToast(res.ok ? 'Exported to your Photos' : res.reason ?? 'Export failed');
  }, [bake]);

  if (!item) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 40 }]}>
        <Banner text="That capture is no longer available." tone="warn" />
        <GradientButton label="Back" onPress={() => navigation.goBack()} style={{ margin: 20 }} />
      </View>
    );
  }

  /* --------------------------------------------------------------- tools */
  const addSticker = (glyph: string) => {
    haptics.light();
    const next: Sticker = { id: uid('st'), glyph, x: 0.5, y: 0.5, scale: 1 };
    patch({ stickers: [...state.stickers, next] });
    setSelected(next.id);
  };

  const addCaption = () => {
    const text = captionDraft.trim();
    if (!text) return;
    haptics.light();
    const next: Caption = {
      id: uid('tx'),
      text,
      color: TEXT_COLORS[0],
      x: 0.5,
      y: 0.78,
      scale: 1,
    };
    patch({ captions: [...state.captions, next] });
    setSelected(next.id);
    setCaptionDraft('');
  };

  const removeSelected = () => {
    haptics.warning();
    patch({
      stickers: state.stickers.filter((s) => s.id !== selected),
      captions: state.captions.filter((t) => t.id !== selected),
    });
    setSelected(null);
  };

  const scaleSelected = (delta: number) => {
    haptics.tap();
    patch({
      stickers: state.stickers.map((s) => (s.id === selected ? { ...s, scale: clamp(s.scale + delta, 0.4, 3) } : s)),
      captions: state.captions.map((t) => (t.id === selected ? { ...t, scale: clamp(t.scale + delta, 0.5, 3) } : t)),
    });
  };

  const undo = () => {
    if (pointer === 0) return;
    haptics.tap();
    const next = pointer - 1;
    setPointer(next);
    setState(history[next]);
  };

  const redo = () => {
    if (pointer >= history.length - 1) return;
    haptics.tap();
    const next = pointer + 1;
    setPointer(next);
    setState(history[next]);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bgDeep, paddingTop: insets.top + 4 }]}>
      {/* --------------------------------------------------------------- bar */}
      <View style={styles.bar}>
        <IconButton
          name="close"
          accessibilityLabel="Close editor"
          onPress={() => {
            haptics.tap();
            navigation.goBack();
          }}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.barTitle, { color: c.text }]}>Edit</Text>
          <Text style={[styles.barSub, { color: c.textFaint }]}>
            {getFilter(state.filterId).name}
            {item.lookName ? ` · ${item.lookName}` : ''}
          </Text>
        </View>
        <IconButton name="arrow-undo" disabled={pointer === 0} onPress={undo} style={{ opacity: pointer === 0 ? 0.35 : 1 }} />
        <IconButton
          name="arrow-redo"
          disabled={pointer >= history.length - 1}
          onPress={redo}
          style={{ opacity: pointer >= history.length - 1 ? 0.35 : 1, marginLeft: 8 }}
        />
      </View>

      {/* ------------------------------------------------------------- canvas */}
      <View style={styles.canvasArea}>
        <View
          ref={canvasRef}
          collapsable={false}
          style={[styles.canvas, { width: box.width, height: box.height, borderRadius: radius.lg }]}
        >
          <CompositeStill
            uri={item.uri}
            recipe={recipe}
            box={rotated ? { width: box.height, height: box.width } : box}
            scene={scene}
            style={
              rotated
                ? {
                    position: 'absolute',
                    left: (box.width - box.height) / 2,
                    top: (box.height - box.width) / 2,
                    width: box.height,
                    height: box.width,
                    borderRadius: radius.lg,
                    transform: [{ rotate: `${state.rotation}deg` }],
                  }
                : { width: box.width, height: box.height, borderRadius: radius.lg }
            }
          />

          {state.captions.map((cap) => (
            <Draggable
              key={cap.id}
              box={box}
              x={cap.x}
              y={cap.y}
              w={Math.max(60, cap.text.length * 12 * cap.scale)}
              h={34 * cap.scale}
              onMove={(x, y) => patch({ captions: state.captions.map((t) => (t.id === cap.id ? { ...t, x, y } : t)) })}
              onSelect={() => setSelected(cap.id)}
              selected={selected === cap.id}
            >
              <Text
                style={{
                  color: cap.color,
                  fontSize: 20 * cap.scale,
                  fontWeight: '800',
                  letterSpacing: 0.2,
                  textShadowColor: 'rgba(0,0,0,0.45)',
                  textShadowRadius: 5,
                  textShadowOffset: { width: 0, height: 1 },
                }}
              >
                {cap.text}
              </Text>
            </Draggable>
          ))}

          {state.stickers.map((st) => (
            <Draggable
              key={st.id}
              box={box}
              x={st.x}
              y={st.y}
              w={64 * st.scale}
              h={64 * st.scale}
              onMove={(x, y) => patch({ stickers: state.stickers.map((s) => (s.id === st.id ? { ...s, x, y } : s)) })}
              onSelect={() => setSelected(st.id)}
              selected={selected === st.id}
            >
              <Text style={{ fontSize: 52 * st.scale, lineHeight: 56 * st.scale }}>{st.glyph}</Text>
            </Draggable>
          ))}
        </View>

        {toast ? (
          <Animated.View entering={FadeIn} style={{ marginTop: 12, alignSelf: 'center' }}>
            <Banner text={toast} tone="success" />
          </Animated.View>
        ) : null}
      </View>

      {/* --------------------------------------------------------------- tool */}
      <View style={[styles.toolPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.toolTabs}>
          {(
            [
              { key: 'look', label: 'Look', icon: 'color-palette' },
              { key: 'adjust', label: 'Adjust', icon: 'options' },
              { key: 'crop', label: 'Crop', icon: 'crop' },
              { key: 'sticker', label: 'Stickers', icon: 'happy' },
              { key: 'text', label: 'Text', icon: 'text' },
            ] as { key: Tool; label: string; icon: keyof typeof Ionicons.glyphMap }[]
          ).map((t) => {
            const on = tool === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  haptics.tap();
                  setTool(t.key);
                }}
                style={[styles.toolTab, on && { backgroundColor: c.accentSoft }]}
              >
                <Ionicons name={t.icon} size={16} color={on ? c.accent : c.textFaint} />
                <Text style={[styles.toolTabText, { color: on ? c.accent : c.textFaint }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 132 }}>
          {tool === 'look' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, alignItems: 'center' }}>
              {FILTERS.map((f) => {
                const on = state.filterId === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      haptics.tap();
                      patch({ filterId: f.id });
                    }}
                    style={[styles.lookChip, { borderColor: on ? c.accent : c.border }]}
                  >
                    <View style={[styles.lookSwatch, { backgroundColor: f.swatch[0] }, { borderColor: on ? c.accent : 'transparent' }]}>
                      <Ionicons name={f.glyph as keyof typeof Ionicons.glyphMap} size={16} color="#fff" />
                    </View>
                    <Text style={[styles.lookName, { color: on ? c.accent : c.textDim }]} numberOfLines={1}>
                      {f.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {tool === 'adjust' ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4 }}>
              {(
                [
                  ['exposure', 'Exposure'],
                  ['contrast', 'Contrast'],
                  ['warmth', 'Warmth'],
                  ['tint', 'Tint'],
                  ['fade', 'Fade'],
                  ['vignette', 'Vignette'],
                  ['grain', 'Grain'],
                ] as [keyof Adjust, string][]
              ).map(([key, label]) => (
                <AppSlider
                  key={key}
                  label={label}
                  value={state.adjust[key]}
                  min={key === 'vignette' || key === 'grain' || key === 'fade' ? 0 : -1}
                  onChange={(v) =>
                    setState((s) => ({ ...s, adjust: { ...s.adjust, [key]: v } }))
                  }
                />
              ))}
              <GradientButton
                label="Reset adjustments"
                icon="refresh"
                small
                onPress={() => {
                  haptics.tap();
                  patch({ adjust: ZERO_ADJUST });
                }}
                style={{ marginVertical: 8, alignSelf: 'flex-start' }}
              />
            </ScrollView>
          ) : null}

          {tool === 'crop' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, alignItems: 'center' }}>
              {RATIOS.map((r) => {
                const on = state.ratio === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => {
                      haptics.tap();
                      patch({ ratio: r.key });
                    }}
                    style={[styles.ratioChip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface2 }]}
                  >
                    <Ionicons name="square-outline" size={16} color={on ? c.accent : c.textDim} />
                    <Text style={[styles.ratioText, { color: on ? c.accent : c.textDim }]}>{r.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  haptics.medium();
                  patch({ rotation: (state.rotation + 90) % 360 });
                }}
                style={[styles.ratioChip, { borderColor: c.border, backgroundColor: c.surface2, marginLeft: 6 }]}
              >
                <Ionicons name="refresh" size={16} color={c.textDim} />
                <Text style={[styles.ratioText, { color: c.textDim }]}>Rotate</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {tool === 'sticker' ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14 }}>
              {STICKER_PACKS.map((pack) => (
                <View key={pack.title} style={styles.packRow}>
                  {pack.glyphs.map((g) => (
                    <Pressable key={g} onPress={() => addSticker(g)} style={[styles.glyphBtn, { backgroundColor: c.surface2 }]}>
                      <Text style={{ fontSize: 22 }}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          ) : null}

          {tool === 'text' ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
              <View style={[styles.textRow, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <TextInput
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  placeholder="Add a caption…"
                  placeholderTextColor={c.textFaint}
                  style={{ flex: 1, color: c.text, fontSize: 14 }}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={addCaption}
                />
                <Pressable onPress={addCaption} style={[styles.addBtn, { backgroundColor: c.accent }]}>
                  <Ionicons name="add" size={16} color="#fff" />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' }}>
                {TEXT_COLORS.map((col) => {
                  const cap = state.captions.find((t) => t.id === selected);
                  return (
                    <Pressable
                      key={col}
                      onPress={() => {
                        haptics.tap();
                        if (!cap) return;
                        patch({ captions: state.captions.map((t) => (t.id === cap.id ? { ...t, color: col } : t)) });
                      }}
                      style={[styles.colorDot, { backgroundColor: col, borderColor: cap?.color === col ? c.accent : c.border }]}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        {selected ? (
          <View style={[styles.selBar, { borderTopColor: c.border }]}>
            <Text style={[styles.selText, { color: c.textDim }]}>Selected item</Text>
            <IconButton name="remove" onPress={() => scaleSelected(-0.15)} />
            <IconButton name="add" onPress={() => scaleSelected(0.15)} />
            <IconButton name="trash" color={c.red} onPress={removeSelected} />
          </View>
        ) : null}
      </View>

      {/* ------------------------------------------------------------- action */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: c.border }]}>
        <GradientButton label="Save copy" icon="download" onPress={save} style={{ flex: 1 }} />
        <Pressable
          onPress={exportToRoll}
          style={[styles.actionIcon, { backgroundColor: c.surface2, borderColor: c.border }]}
        >
          <Ionicons name="images" size={19} color={c.text} />
        </Pressable>
        <Pressable
          onPress={share}
          style={[styles.actionIcon, { backgroundColor: c.surface2, borderColor: c.border }]}
        >
          <Ionicons name="share-outline" size={19} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.tap();
            if (item.filterId) navigation.navigate('Camera');
          }}
          style={[styles.actionIcon, { backgroundColor: c.surface2, borderColor: c.border }]}
        >
          <Ionicons name="camera" size={19} color={c.text} />
        </Pressable>
      </View>

      {selection.filterId ? null : null}

      <ProcessingOverlay
        visible={!!busy}
        title={busy === 'share' ? 'Preparing share' : busy === 'export' ? 'Exporting' : 'Rendering copy'}
        stages={['Compositing layers', 'Applying grade', 'Writing file']}
        stageIndex={1}
        hint="Baked locally with the on-device compositor."
      />
    </View>
  );
}

/* ---------------------------------------------------------------- draggable */

function Draggable({
  box,
  x,
  y,
  w,
  h,
  onMove,
  onSelect,
  selected,
  children,
}: {
  box: { width: number; height: number };
  x: number;
  y: number;
  w: number;
  h: number;
  onMove: (x: number, y: number) => void;
  onSelect: () => void;
  selected: boolean;
  children: React.ReactNode;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      const nx = clamp(x + e.translationX / box.width, 0.05, 0.95);
      const ny = clamp(y + e.translationY / box.height, 0.05, 0.95);
      tx.value = withTiming(0, { duration: 140 });
      ty.value = withTiming(0, { duration: 140 });
      onMove(nx, ny);
    });

  const tap = Gesture.Tap().onEnd((_, ok) => {
    if (ok) onSelect();
  });

  const gesture = Gesture.Simultaneous(pan, tap);

  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: x * box.width - w / 2,
            top: y * box.height - h / 2,
            minWidth: w,
            minHeight: h,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            borderRadius: 8,
            borderWidth: selected ? 1 : 0,
            borderColor: '#FFFFFF',
          },
          st,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  barTitle: { fontSize: 15.5, fontWeight: '800' },
  barSub: { fontSize: 11, marginTop: 1 },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  canvas: { overflow: 'hidden', backgroundColor: '#000' },
  toolPanel: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingBottom: 6,
  },
  toolTabs: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 12, marginBottom: 10 },
  toolTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
  },
  toolTabText: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  lookChip: { alignItems: 'center', marginRight: 12, width: 62 },
  lookSwatch: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  lookName: { fontSize: 10, fontWeight: '600', marginTop: 5 },
  ratioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  ratioText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  packRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  glyphBtn: {
    width: 48,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
  },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    marginRight: 8,
    marginBottom: 8,
  },
  selBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selText: { flex: 1, fontSize: 11.5, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
