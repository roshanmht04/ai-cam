import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AI_CATEGORIES,
  AI_EFFECTS,
  AiCategory,
  AiEffectDef,
  getFilter,
} from '../lib/catalog';
import { useApp } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import {
  Banner,
  Chip,
  GhostButton,
  GradientButton,
  ProcessingOverlay,
  SectionHeader,
} from '../components/UI';

/**
 * AI effect browser. Effects are data records, so shipping a new model is a
 * matter of adding an entry — no screen changes required.
 */
export default function AiEffectsScreen({ navigation }: { navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { selection, setSelection, settings, grantCloudConsent } = useApp();

  const [cat, setCat] = useState<AiCategory | 'all'>('all');
  const [running, setRunning] = useState<AiEffectDef | null>(null);
  const [stage, setStage] = useState(0);
  const [consentOpen, setConsentOpen] = useState(false);
  const [pending, setPending] = useState<AiEffectDef | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cardW = (width - 20 * 2 - 12) / 2;

  const list = useMemo(
    () => (cat === 'all' ? AI_EFFECTS : AI_EFFECTS.filter((e) => e.category === cat)),
    [cat]
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = useCallback(
    (effect: AiEffectDef) => {
      if (effect.runtime === 'cloud' && !settings.cloudConsent) {
        haptics.warning();
        setPending(effect);
        setConsentOpen(true);
        return;
      }
      haptics.medium();
      setRunning(effect);
      setStage(0);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const slice = effect.ms / effect.stages.length;
      effect.stages.forEach((_, i) => {
        timers.current.push(
          setTimeout(() => setStage(i + 1), slice * (i + 1))
        );
      });
      timers.current.push(
        setTimeout(() => {
          setSelection({ effectId: effect.id });
          setRunning(null);
          haptics.success();
          navigation.navigate('Camera');
        }, effect.ms + 260)
      );
    },
    [navigation, setSelection, settings.cloudConsent]
  );

  const active = useMemo(
    () => AI_EFFECTS.find((e) => e.id === selection.effectId) ?? null,
    [selection.effectId]
  );

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
          <Text style={[styles.title, { color: c.text }]}>AI Effects</Text>
          <Text style={[styles.subtitle, { color: c.textFaint }]}>Model-powered transformations</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ flexGrow: 0 }}
      >
        {AI_CATEGORIES.map((it) => (
          <Chip key={it.key} label={it.label} active={cat === it.key} onPress={() => setCat(it.key)} />
        ))}
      </ScrollView>

      {active ? (
        <Animated.View entering={FadeIn} style={{ paddingHorizontal: 20, marginBottom: 4 }}>
          <View style={[styles.activeCard, { backgroundColor: c.surface, borderColor: `${c.accent}66` }]}>
            <LinearGradient
              colors={active.swatch}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeArt}
            >
              <Ionicons name={active.glyph as keyof typeof Ionicons.glyphMap} size={22} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.cardTitle, { color: c.text }]}>
                {active.name} is live in the viewfinder
              </Text>
              <Text style={[styles.cardSub, { color: c.textFaint }]}>{active.tagline}</Text>
            </View>
            <Pressable
              onPress={() => {
                haptics.tap();
                setSelection({ effectId: null });
              }}
              style={[styles.removeBtn, { borderColor: c.borderStrong }]}
            >
              <Ionicons name="close" size={15} color={c.text} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title={cat === 'all' ? 'All models' : 'Filtered'} subtitle={`${list.length} available`} glyph="apps" />
        <View style={styles.grid}>
          {list.map((e, i) => {
            const locked = e.runtime === 'cloud' && !settings.cloudConsent;
            const applied = selection.effectId === e.id;
            return (
              <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(280)}>
                <Pressable
                  onPress={() => run(e)}
                  style={[
                    styles.card,
                    { width: cardW, backgroundColor: c.surface, borderColor: applied ? c.accent : c.border },
                  ]}
                >
                  <LinearGradient
                    colors={e.swatch}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.cardArt, { height: cardW * 0.55 }]}
                  >
                    <Ionicons name={e.glyph as keyof typeof Ionicons.glyphMap} size={28} color="rgba(255,255,255,0.95)" />
                    <View
                      style={[
                        styles.runtimePill,
                        { backgroundColor: e.runtime === 'cloud' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.24)' },
                      ]}
                    >
                      <Ionicons
                        name={e.runtime === 'cloud' ? 'cloud' : 'phone-portrait'}
                        size={9}
                        color="#fff"
                      />
                      <Text style={styles.runtimeText}>{e.runtime === 'cloud' ? 'Cloud' : 'On-device'}</Text>
                    </View>
                    {locked ? (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#fff" />
                      </View>
                    ) : null}
                  </LinearGradient>
                  <View style={{ padding: 12 }}>
                    <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={[styles.cardSub, { color: c.textFaint }]} numberOfLines={2}>
                      {e.tagline}
                    </Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="time-outline" size={10} color={c.textFaint} />
                      <Text style={[styles.cardMetaText, { color: c.textFaint }]}>
                        ~{(e.ms / 1000).toFixed(1)}s
                      </Text>
                      {applied ? (
                        <View style={[styles.liveDot, { backgroundColor: c.green }]} />
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={[styles.note, { borderColor: c.border }]}>
          <Ionicons name="information-circle" size={14} color={c.accentAlt} />
          <Text style={[styles.noteText, { color: c.textDim }]}>
            {getFilter(selection.filterId).name} is layered underneath. Run an AI effect and both
            looks are baked together when you capture.
          </Text>
        </View>
      </ScrollView>

      <ProcessingOverlay
        visible={!!running}
        title={running?.name ?? ''}
        stages={running?.stages ?? []}
        stageIndex={stage}
        hint={
          running?.runtime === 'cloud'
            ? 'Cloud consent is active for this run — the preview build still renders locally.'
            : 'Running on the neural engine. Keep the phone steady.'
        }
      />

      <Modal
        visible={consentOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setConsentOpen(false)}
      >
        <View style={styles.modalScrim}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.modal, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <View
              style={[
                styles.activeArt,
                { backgroundColor: c.accentSoft, alignSelf: 'flex-start', borderRadius: radius.md },
              ]}
            >
              <Ionicons name="cloud-upload" size={20} color={c.accent} />
            </View>
            <Text style={[styles.modalTitle, { color: c.text }]}>{pending?.name} needs consent</Text>
            <Text style={[styles.modalBody, { color: c.textDim }]}>
              This model normally runs on AURA's servers. Granting consent lets us send the single
              frame you tap — nothing else — and the frame is discarded right after rendering.
              Refusing keeps the effect locked; every on-device effect keeps working.
            </Text>
            <Banner
              text="Preview build: the pipeline is simulated on-device, so no frame leaves your phone."
              style={{ marginHorizontal: 0, marginTop: 14 }}
            />
            <GradientButton
              label="Grant consent for this run"
              icon="checkmark-circle"
              style={{ marginTop: 16 }}
              onPress={() => {
                grantCloudConsent();
                setConsentOpen(false);
                haptics.success();
                const target = pending;
                setPending(null);
                if (target) setTimeout(() => run(target), 240);
              }}
            />
            <GhostButton
              label="Keep it locked"
              onPress={() => setConsentOpen(false)}
              style={{ marginTop: 10 }}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
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
  chips: { paddingHorizontal: 20, paddingVertical: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  cardArt: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cardMetaText: { fontSize: 10.5, fontWeight: '700', marginLeft: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 8 },
  runtimePill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  runtimeText: { color: '#fff', fontSize: 9, fontWeight: '800', marginLeft: 4, letterSpacing: 0.3 },
  lockOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  activeArt: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 11.5, lineHeight: 17, marginLeft: 9 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 22,
    paddingBottom: 34,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginVertical: 12 },
  modalBody: { fontSize: 13, lineHeight: 20 },
});
