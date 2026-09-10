import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../lib/store';
import { MediaItem } from '../lib/media';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { formatBytes, formatDuration } from '../lib/format';
import { EmptyState, Segmented } from '../components/UI';

type Filter = 'all' | 'photo' | 'video';

export default function GalleryScreen({ navigation }: { navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { gallery, deleteCapture, clearCaptures } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const data = useMemo(() => {
    if (filter === 'all') return gallery;
    if (filter === 'photo') return gallery.filter((i) => i.kind === 'photo');
    return gallery.filter((i) => i.kind !== 'photo');
  }, [filter, gallery]);

  const totalBytes = useMemo(
    () => gallery.reduce((acc, i) => acc + (i.bytes ?? 0), 0),
    [gallery]
  );

  const size = 122;

  const confirmDelete = useCallback(
    (item: MediaItem) => {
      haptics.warning();
      Alert.alert('Delete capture?', 'This removes the file from this device. It cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCapture(item.id);
          },
        },
      ]);
    },
    [deleteCapture]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)}>
        <Pressable
          accessibilityLabel={`Open capture ${index + 1}`}
          onPress={() => navigation.navigate('Viewer', { id: item.id })}
          onLongPress={() => confirmDelete(item)}
          style={[styles.cell, { width: size, height: size }]}
        >
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.missing, { backgroundColor: c.surface2 }]}>
              <Ionicons name="image-outline" size={20} color={c.textFaint} />
            </View>
          )}

          {item.filterId && item.filterId !== 'none' ? (
            <LinearGradient
              colors={[
                'rgba(0,0,0,0.45)',
                'rgba(0,0,0,0)',
              ]}
              style={styles.cellTop}
            />
          ) : null}

          {item.kind !== 'photo' ? (
            <View style={styles.badge}>
              <Ionicons name={item.kind === 'video' ? 'play' : 'flash'} size={8} color="#fff" />
              {item.durationMs ? (
                <Text style={styles.badgeText}>{formatDuration(item.durationMs)}</Text>
              ) : null}
            </View>
          ) : null}

          {item.lookName ? (
            <View style={[styles.lookChip, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
              <Text style={styles.lookText} numberOfLines={1}>
                {item.lookName}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    ),
    [c.surface2, confirmDelete, navigation, size]
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: c.accent }]}>PRIVATE ON THIS DEVICE</Text>
          <Text style={[styles.title, { color: c.text }]}>Library</Text>
        </View>
        {gallery.length ? (
          <Pressable
            accessibilityLabel="Delete all captures"
            onPress={() => {
              haptics.warning();
              Alert.alert('Clear library?', `This permanently deletes ${gallery.length} capture(s) stored in AURA.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete all', style: 'destructive', onPress: () => clearCaptures() },
              ]);
            }}
            style={[styles.roundBtn, { backgroundColor: c.surface2, borderColor: c.border }]}
          >
            <Ionicons name="trash" size={17} color={c.red} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <Stat icon="images" label={`${gallery.length} captures`} />
        <Stat icon="server" label={`${formatBytes(totalBytes)} local`} />
        <Stat icon="cloud-offline" label="Never uploaded" />
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'all', label: 'ALL' },
            { key: 'photo', label: 'PHOTOS' },
            { key: 'video', label: 'CLIPS' },
          ]}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={9}
        initialNumToRender={12}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.accent}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 620);
            }}
          />
        }
        ListEmptyComponent={
          gallery.length === 0 ? (
            <EmptyState
              glyph="images"
              title="No captures yet"
              subtitle="Everything you shoot stays here, encrypted in your app container. Open the camera and make something loud."
              actionLabel="Open camera"
              onAction={() => navigation.navigate('Camera')}
            />
          ) : (
            <EmptyState
              glyph="filter"
              title="Nothing in this filter"
              subtitle="Switch the tab above to see the rest of your library."
              compact
            />
          )
        }
      />
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface2, borderColor: c.border }]}>
      <Ionicons name={icon} size={12} color={c.accent} />
      <Text style={[styles.statText, { color: c.textDim }]}>{label}</Text>
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
    paddingBottom: 12,
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
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  statText: { fontSize: 10.5, fontWeight: '700', marginLeft: 5 },
  cell: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#000',
  },
  missing: { alignItems: 'center', justifyContent: 'center' },
  cellTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 40 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', marginLeft: 3 },
  lookChip: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 90,
  },
  lookText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
