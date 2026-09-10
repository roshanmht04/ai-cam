import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SCENE_PRESETS, SCENE_SUGGESTIONS, SceneSpec, sceneFromPrompt } from '../lib/sceneGen';
import { useApp } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { uid } from '../lib/format';
import { SceneView } from '../components/SceneView';
import { AppSlider, Banner, GhostButton, GradientButton, ProcessingOverlay } from '../components/UI';

type Tab = 'scenes' | 'photos' | 'generator';

/** Live background replacement studio: presets, library import and a prompt generator. */
export default function BackgroundStudioScreen({ navigation }: { navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    selection,
    setSelection,
    subject,
    setSubject,
    generatedScenes,
    addGeneratedScene,
    removeGeneratedScene,
    gallery,
  } = useApp();

  const [tab, setTab] = useState<Tab>('scenes');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const scene = useMemo<SceneSpec | null>(() => {
    if (!selection.sceneId) return null;
    return (
      generatedScenes.find((s) => s.id === selection.sceneId) ??
      SCENE_PRESETS.find((s) => s.id === selection.sceneId) ??
      null
    );
  }, [generatedScenes, selection.sceneId]);

  const mine = generatedScenes;
  const cardW = (width - 20 * 2 - 12) / 2;
  const previewH = Math.min(300, width * 0.86);

  const applyScene = (spec: SceneSpec | null) => {
    haptics.medium();
    setSelection({ sceneId: spec?.id ?? null });
  };

  const importFromLibrary = async () => {
    haptics.tap();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setNotice('Photo library access is needed to import a background.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      const asset = res.assets?.[0];
      if (!asset) return;
      const spec: SceneSpec = {
        id: uid('lib'),
        name: 'From your library',
        style: 'studio',
        seed: Date.now() % 99991,
        colors: ['#2A2F3A', '#151A22', '#05070B', c.accent],
        imageUri: asset.uri,
        userMade: true,
      };
      addGeneratedScene(spec);
      applyScene(spec);
      setNotice(null);
    } catch {
      setNotice('That photo could not be loaded. Try another one.');
    }
  };

  const generate = () => {
    if (!prompt.trim()) return;
    haptics.medium();
    setGenerating(true);
    setTimeout(() => {
      const spec = sceneFromPrompt(prompt);
      addGeneratedScene(spec);
      applyScene(spec);
      setGenerating(false);
      haptics.success();
      setPrompt('');
    }, 1400);
  };

  const renderTile = (spec: SceneSpec, index: number) => {
    const active = selection.sceneId === spec.id;
    return (
      <Animated.View key={spec.id} entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(260)}>
        <Pressable
          onPress={() => applyScene(spec)}
          onLongPress={() => {
            if (!spec.userMade) return;
            haptics.warning();
            removeGeneratedScene(spec.id);
            if (selection.sceneId === spec.id) setSelection({ sceneId: null });
          }}
          style={[
            styles.tile,
            { width: cardW, height: cardW * 1.25, borderColor: active ? c.accent : c.border },
          ]}
        >
          <SceneView spec={spec} animated={active} style={StyleSheet.absoluteFill} />
          <View style={styles.tileShade} />
          <View style={styles.tileBody}>
            <Text style={styles.tileName} numberOfLines={1}>
              {spec.name}
            </Text>
            <View style={styles.tileMeta}>
              <Ionicons
                name={spec.userMade ? 'color-wand' : 'albums'}
                size={9}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.tileMetaText}>
                {spec.imageUri ? 'Imported' : spec.userMade ? 'Generated' : 'Preset'}
              </Text>
            </View>
          </View>
          {active ? (
            <View style={[styles.check, { backgroundColor: c.accent }]}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Close"
          onPress={() => {
            haptics.tap();
            navigation.goBack();
          }}
          style={[styles.close, { backgroundColor: c.surface2, borderColor: c.border }]}
        >
          <Ionicons name="chevron-down" size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.text }]}>AI Background</Text>
          <Text style={[styles.subtitle, { color: c.textFaint }]}>Replace your backdrop live</Text>
        </View>
        <Pressable
          accessibilityLabel="Done"
          onPress={() => {
            haptics.success();
            navigation.navigate('Camera');
          }}
          style={[styles.close, { backgroundColor: c.accent, borderColor: c.accent }]}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------------------------------------------------------- preview */}
        <View style={[styles.previewWrap, { height: previewH }]}>
          {scene ? (
            <SceneView spec={scene} animated />
          ) : (
            <LinearGradient
              colors={[c.surface2, c.surface]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            style={[
              styles.subjectWindow,
              {
                width: width * 0.42 * subject.scale,
                height: previewH * 0.62 * subject.scale,
                borderRadius: width * 0.42 * subject.scale * 0.42,
                transform: [{ translateY: subject.offsetY }],
              },
            ]}
          >
            {gallery[0]?.uri ? (
              <Image source={{ uri: gallery[0].uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="person" size={54} color="rgba(255,255,255,0.55)" style={{ marginTop: 40, alignSelf: 'center' }} />
              </View>
            )}
          </View>
          <View style={styles.previewTag}>
            <Ionicons name="scan" size={11} color="#fff" />
            <Text style={styles.previewTagText}>
              {scene ? scene.name : 'Original background'}
            </Text>
          </View>
        </View>

        {notice ? (
          <Banner text={notice} tone="warn" style={{ marginTop: 14 }} />
        ) : null}

        {/* ------------------------------------------------------------ tabs */}
        <View style={styles.tabs}>
          {(
            [
              { key: 'scenes', label: 'Scenes', icon: 'albums' },
              { key: 'photos', label: 'My photos', icon: 'images' },
              { key: 'generator', label: 'Generator', icon: 'color-wand' },
            ] as { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[]
          ).map((t) => {
            const activeTab = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  haptics.tap();
                  setTab(t.key);
                }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: activeTab ? c.accent : c.surface,
                    borderColor: activeTab ? c.accent : c.border,
                  },
                ]}
              >
                <Ionicons name={t.icon} size={14} color={activeTab ? '#fff' : c.textDim} />
                <Text style={[styles.tabText, { color: activeTab ? '#fff' : c.textDim }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'scenes' ? (
          <View style={styles.grid}>
            <Animated.View entering={FadeIn}>
              <Pressable
                onPress={() => applyScene(null)}
                style={[
                  styles.tile,
                  { width: cardW, height: cardW * 1.25, borderColor: !scene ? c.accent : c.border },
                ]}
              >
                <LinearGradient colors={[c.surface2, c.surface3]} style={StyleSheet.absoluteFill} />
                <View style={[styles.centerFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="eye-off" size={22} color={c.textDim} />
                  <Text style={[styles.tileName, { color: c.textDim, marginTop: 8 }]}>Background off</Text>
                </View>
              </Pressable>
            </Animated.View>
            {SCENE_PRESETS.map(renderTile)}
          </View>
        ) : null}

        {tab === 'photos' ? (
          <View style={{ paddingHorizontal: 20 }}>
            <GradientButton
              label="Choose from your library"
              icon="images"
              onPress={importFromLibrary}
            />
            <Text style={[styles.hint, { color: c.textFaint }]}>
              AURA reads the single photo you pick and keeps it inside the app sandbox. It is never
              uploaded or added to any album.
            </Text>
            {mine.length ? (
              <>
                <Text style={[styles.sectionLabel, { color: c.text }]}>Your backgrounds</Text>
                <View style={styles.grid}>
                  {mine.map(renderTile)}
                </View>
              </>
            ) : (
              <View style={[styles.emptyBox, { borderColor: c.border }]}>
                <Ionicons name="image-outline" size={26} color={c.textFaint} />
                <Text style={[styles.hint, { color: c.textDim, marginTop: 10 }]}>
                  No imported backgrounds yet.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {tab === 'generator' ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={[styles.sectionLabel, { color: c.text }]}>Describe your backdrop</Text>
            <View style={[styles.promptBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Ionicons name="sparkles" size={16} color={c.accent} style={{ marginTop: 3 }} />
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Neon Tokyo alley, rain-soaked, magenta glow…"
                placeholderTextColor={c.textFaint}
                style={[styles.promptInput, { color: c.text }]}
                multiline
                maxLength={120}
                returnKeyType="done"
              />
            </View>
            <GradientButton label="Generate background" icon="color-wand" onPress={generate} style={{ marginTop: 12 }} />

            <Text style={[styles.sectionLabel, { color: c.text, marginTop: 22 }]}>Try one of these</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SCENE_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    haptics.tap();
                    setPrompt(s);
                  }}
                  style={[styles.suggestion, { backgroundColor: c.surface2, borderColor: c.border }]}
                >
                  <Text style={{ color: c.textDim, fontSize: 11.5 }}>{s}</Text>
                </Pressable>
              ))}
            </View>

            {mine.length ? (
              <>
                <Text style={[styles.sectionLabel, { color: c.text, marginTop: 22 }]}>Recent generations</Text>
                <View style={styles.grid}>{mine.map(renderTile)}</View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* --------------------------------------------------------- subject */}
        <Text style={[styles.sectionLabel, { color: c.text, marginTop: 26, paddingHorizontal: 20 }]}>
          Subject cutout
        </Text>
        <View style={{ paddingHorizontal: 20 }}>
          <AppSlider
            label="Subject size"
            min={0.7}
            max={1.3}
            value={subject.scale}
            onChange={(v) => setSubject({ scale: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <AppSlider
            label="Vertical position"
            min={-90}
            max={90}
            step={1}
            value={subject.offsetY}
            onChange={(v) => setSubject({ offsetY: v })}
            format={(v) => `${Math.round(v)}pt`}
          />
          <AppSlider
            label="Edge feather"
            min={0}
            max={1}
            value={subject.softness}
            onChange={(v) => setSubject({ softness: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <GhostButton
            label="Reset cutout"
            icon="refresh"
            onPress={() => {
              haptics.tap();
              setSubject({ scale: 1, offsetY: 0, softness: 0.5 });
            }}
            style={{ marginTop: 12 }}
          />
        </View>

        <View style={[styles.privacy, { borderColor: c.border }]}>
          <Ionicons name="lock-closed" size={13} color={c.green} />
          <Text style={[styles.privacyText, { color: c.textDim }]}>
            Segmentation runs on-device in the compositor. Your preview frames never leave the
            device, and backgrounds stay in your local library.
          </Text>
        </View>
      </ScrollView>

      <ProcessingOverlay
        visible={generating}
        title="Generating backdrop"
        stages={['Parsing prompt', 'Sampling palette', 'Compositing scene']}
        stageIndex={generating ? 1 : 0}
        hint="Rendering locally from your prompt — deterministic, private, instant to reuse."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 11.5, marginTop: 2 },
  previewWrap: {
    marginHorizontal: 20,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectWindow: {
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  previewTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewTagText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 6 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 18, marginBottom: 16 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  tabText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  tile: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#000',
  },
  tileShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.16)' },
  tileBody: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  tileName: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  tileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  tileMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '600', marginLeft: 4 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hint: { fontSize: 11.5, lineHeight: 17, marginTop: 10 },
  sectionLabel: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2, marginBottom: 10 },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 16,
  },
  promptBox: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    minHeight: 92,
  },
  promptInput: { flex: 1, marginLeft: 10, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 26,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  privacyText: { flex: 1, fontSize: 11.5, lineHeight: 17, marginLeft: 9 },
});
