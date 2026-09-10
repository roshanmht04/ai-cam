import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AI_CATEGORIES,
  AI_EFFECTS,
  FILTERS,
  FILTER_CATEGORIES,
  FilterCat,
  FilterDef,
} from '../lib/catalog';
import { SCENE_PRESETS } from '../lib/sceneGen';
import { useApp } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { Chip, EmptyState, SectionHeader } from '../components/UI';

/** Filter browser — the place to explore every look the engine ships with. */
export default function DiscoverScreen({ navigation }: { navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { setSelection, selection, generatedScenes } = useApp();

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FilterCat | 'all'>('all');

  const cardW = (width - 20 * 2 - 12) / 2;
  const featuredW = Math.min(240, width - 60);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FILTERS.filter((f) => {
      if (f.id === 'none') return false;
      const catOk = cat === 'all' || f.cat === cat;
      const qOk =
        !q || f.name.toLowerCase().includes(q) || f.blurb.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [cat, query]);

  const hot = useMemo(() => FILTERS.filter((f) => f.hot), []);
  const faces = useMemo(() => FILTERS.filter((f) => f.cat === 'faces'), []);
  const colors = useMemo(() => FILTERS.filter((f) => f.cat === 'color' && f.id !== 'none'), []);
  const scenes = useMemo(() => [...generatedScenes, ...SCENE_PRESETS].slice(0, 10), [generatedScenes]);

  const applyFilter = (f: FilterDef) => {
    haptics.medium();
    setSelection({ filterId: f.id, effectId: null });
    navigation.navigate('Camera');
  };

  const applyScene = (id: string) => {
    haptics.medium();
    setSelection({ sceneId: id });
    navigation.navigate('Camera');
  };

  const searching = query.trim().length > 0;

  const renderFilterCard = (f: FilterDef, w: number, i: number) => {
    const active = selection.filterId === f.id;
    return (
      <Animated.View key={f.id} entering={FadeInDown.delay(i * 30).duration(300)}>
        <Pressable
          onPress={() => applyFilter(f)}
          style={[
            styles.card,
            {
              width: w,
              backgroundColor: c.surface,
              borderColor: active ? c.accent : c.border,
            },
          ]}
        >
          <LinearGradient
            colors={f.swatch}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cardArt, { height: w * 0.62 }]}
          >
            <Ionicons
              name={f.glyph as keyof typeof Ionicons.glyphMap}
              size={26}
              color="rgba(255,255,255,0.92)"
            />
            {active ? (
              <View style={[styles.appliedPill, { backgroundColor: c.accent }]}>
                <Ionicons name="checkmark" size={11} color="#fff" />
                <Text style={styles.appliedText}>Applied</Text>
              </View>
            ) : f.hot ? (
              <View style={[styles.hotPill, { backgroundColor: c.pink }]}>
                <Ionicons name="flame" size={10} color="#fff" />
              </View>
            ) : null}
          </LinearGradient>
          <View style={{ padding: 12 }}>
            <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
              {f.name}
            </Text>
            <Text style={[styles.cardSub, { color: c.textFaint }]} numberOfLines={2}>
              {f.blurb}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: c.accent }]}>EFFECT LIBRARY</Text>
          <Text style={[styles.title, { color: c.text }]}>Discover</Text>
        </View>
        <Pressable
          accessibilityLabel="AI effects"
          onPress={() => {
            haptics.tap();
            navigation.navigate('AIFx');
          }}
          style={[styles.roundBtn, { backgroundColor: c.surface2, borderColor: c.border }]}
        >
          <Ionicons name="color-wand" size={19} color={c.accent} />
        </Pressable>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: c.surface2, borderColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search looks, moods, effects…"
          placeholderTextColor={c.textFaint}
          style={[styles.search, { color: c.text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {searching ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={c.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ flexGrow: 0 }}
      >
        {FILTER_CATEGORIES.map((catItem) => (
          <Chip
            key={catItem.key}
            label={catItem.label}
            glyph={catItem.glyph as keyof typeof Ionicons.glyphMap}
            active={cat === catItem.key}
            onPress={() => setCat(catItem.key)}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {searching || cat !== 'all' ? (
          results.length ? (
            <View style={styles.grid}>
              {results.map((f, i) => renderFilterCard(f, cardW, i))}
            </View>
          ) : (
            <EmptyState
              glyph="sparkles"
              title="Nothing matches yet"
              subtitle={`No looks found for “${query}”. Try “anime”, “film”, “neon” or browse a category above.`}
              actionLabel="Clear search"
              onAction={() => {
                setQuery('');
                setCat('all');
              }}
            />
          )
        ) : (
          <>
            <SectionHeader title="Trending now" subtitle="What everyone is shooting with" glyph="flame" />
            <FlatList
              data={hot}
              horizontal
              keyExtractor={(f) => f.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 40).duration(320)}>
                  <Pressable
                    onPress={() => applyFilter(item)}
                    style={[
                      styles.featureCard,
                      { borderColor: selection.filterId === item.id ? c.accent : c.border },
                    ]}
                  >
                    <LinearGradient
                      colors={item.swatch}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.featureArt}
                    >
                      <Ionicons
                        name={item.glyph as keyof typeof Ionicons.glyphMap}
                        size={34}
                        color="rgba(255,255,255,0.95)"
                      />
                      <View style={styles.featureOverlay} />
                    </LinearGradient>
                    <View style={styles.featureBody}>
                      <Text style={[styles.cardTitle, { color: c.text }]}>{item.name}</Text>
                      <Text style={[styles.cardSub, { color: c.textFaint }]} numberOfLines={2}>
                        {item.blurb}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              )}
            />

            <SectionHeader
              title="AI effects"
              subtitle="Model-powered transformations"
              glyph="color-wand"
              actionLabel="See all"
              onAction={() => navigation.navigate('AIFx')}
            />
            <FlatList
              data={AI_EFFECTS.slice(0, 6)}
              horizontal
              keyExtractor={(e) => e.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    navigation.navigate('AIFx');
                  }}
                  style={[styles.aiCard, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <LinearGradient
                    colors={item.swatch}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.aiArt}
                  >
                    <Ionicons
                      name={item.glyph as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color="rgba(255,255,255,0.95)"
                    />
                    <View
                      style={[
                        styles.runtimePill,
                        { backgroundColor: item.runtime === 'cloud' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.22)' },
                      ]}
                    >
                      <Ionicons
                        name={item.runtime === 'cloud' ? 'cloud' : 'phone-portrait'}
                        size={9}
                        color="#fff"
                      />
                      <Text style={styles.runtimeText}>
                        {item.runtime === 'cloud' ? 'Cloud' : 'On-device'}
                      </Text>
                    </View>
                  </LinearGradient>
                  <View style={{ padding: 12 }}>
                    <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.cardSub, { color: c.textFaint }]} numberOfLines={2}>
                      {item.tagline}
                    </Text>
                  </View>
                </Pressable>
              )}
            />

            <SectionHeader
              title="Face FX"
              subtitle="Tracker-locked character looks"
              glyph="happy"
              actionLabel="Filters"
              onAction={() => setCat('faces')}
            />
            <View style={styles.grid}>
              {faces.map((f, i) => renderFilterCard(f, cardW, i))}
            </View>

            <SectionHeader
              title="Backgrounds"
              subtitle="Live replacement scenes"
              glyph="image"
              actionLabel="Studio"
              onAction={() => navigation.navigate('Backgrounds')}
            />
            <FlatList
              data={scenes}
              horizontal
              keyExtractor={(s) => s.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => applyScene(item.id)}
                  style={[
                    styles.sceneCard,
                    { borderColor: selection.sceneId === item.id ? c.accent : c.border },
                  ]}
                >
                  <LinearGradient
                    colors={[item.colors[0], item.colors[1], item.colors[2]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.sceneShade]} />
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : null}
                  <View style={styles.sceneBody}>
                    <Text style={styles.sceneName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.sceneMeta}>
                      <Ionicons
                        name={item.userMade ? 'color-wand' : 'albums'}
                        size={10}
                        color="rgba(255,255,255,0.8)"
                      />
                      <Text style={styles.sceneMetaText}>
                        {item.userMade ? 'Generated' : 'Preset'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
            />

            <SectionHeader title="Color grades" subtitle="Cinematic looks, zero render cost" glyph="color-palette" />
            <View style={styles.grid}>
              {colors.map((f, i) => renderFilterCard(f, cardW, i))}
            </View>

            <View style={[styles.privacyNote, { borderColor: c.border }]}>
              <Ionicons name="lock-closed" size={13} color={c.green} />
              <Text style={[styles.privacyNoteText, { color: c.textDim }]}>
                Every effect in this library renders locally. AURA never uploads your frames — cloud
                models only run after you switch them on in Settings.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2.2 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.9, marginTop: 2 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 13,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  search: { flex: 1, marginHorizontal: 9, fontSize: 14.5, paddingVertical: 0 },
  chips: { paddingHorizontal: 20, paddingVertical: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardArt: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  hotPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  appliedText: { color: '#fff', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  featureCard: {
    width: 240,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginRight: 14,
  },
  featureArt: { height: 150, alignItems: 'center', justifyContent: 'center' },
  featureOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  featureBody: { padding: 12 },
  aiCard: {
    width: 172,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 12,
  },
  aiArt: { height: 92, alignItems: 'center', justifyContent: 'center' },
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
  sceneCard: {
    width: 132,
    height: 176,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 12,
  },
  sceneShade: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  sceneBody: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  sceneName: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  sceneMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  sceneMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '600', marginLeft: 4 },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  privacyNoteText: { flex: 1, fontSize: 11.5, lineHeight: 17, marginLeft: 9 },
});
