import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { timeAgo } from '../lib/format';
import { saveToCameraRoll, shareMedia } from '../lib/media';
import { getFilter } from '../lib/catalog';
import { Banner, GhostButton, IconButton, ProcessingOverlay } from '../components/UI';

/** Full-screen viewer with share / export / delete and flipbook playback for motion clips. */
export default function MediaViewerScreen({ route, navigation }: { route: any; navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { gallery, deleteCapture } = useApp();
  const item = useMemo(() => gallery.find((g) => g.id === route.params?.id) ?? null, [gallery, route.params?.id]);

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const frames = item?.frames ?? [];

  useEffect(() => {
    if (!item || item.kind !== 'motion' || frames.length < 2 || !playing) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 220);
    return () => clearInterval(id);
  }, [frames.length, item, playing]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!item) {
    return (
      <View style={[styles.root, { backgroundColor: c.bgDeep, paddingTop: insets.top + 40 }]}>
        <Banner text="This capture is no longer available." tone="warn" />
        <GhostButton label="Back" onPress={() => navigation.goBack()} style={{ margin: 20 }} />
      </View>
    );
  }

  const shown = item.kind === 'motion' && frames.length ? frames[frame % frames.length] : item.uri;

  const doShare = async () => {
    setBusy('share');
    const res = await shareMedia(item.uri, item.kind === 'video' ? 'video' : 'photo');
    setBusy(null);
    if (!res.ok && res.reason !== 'Cancelled') setToast(res.reason ?? 'Sharing unavailable');
  };

  const doExport = async () => {
    setBusy('export');
    const res = await saveToCameraRoll(item.uri);
    setBusy(null);
    haptics.success();
    setToast(res.ok ? 'Saved to your Photos' : res.reason ?? 'Export failed');
  };

  const doDelete = () => {
    haptics.warning();
    Alert.alert('Delete capture?', 'This removes the file from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCapture(item.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bgDeep }]}>
      <View style={[styles.imgWrap]}>
        {shown ? (
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} contentFit="contain" transition={180} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Ionicons name="image-outline" size={30} color={c.textFaint} />
            <Text style={{ color: c.textDim, marginTop: 10, fontSize: 12.5 }}>
              Media is stored on this device only.
            </Text>
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={[styles.topScrim, { paddingTop: insets.top + 8 }]}
          pointerEvents="none"
        />

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.topTitle}>
              {item.kind === 'photo' ? 'Photo' : item.kind === 'video' ? 'Video' : 'Motion clip'}
            </Text>
            <Text style={styles.topSub}>{timeAgo(item.createdAt)}</Text>
          </View>
          <IconButton name="trash-outline" accessibilityLabel="Delete" color={c.red} onPress={doDelete} />
        </View>

        {item.kind === 'motion' && frames.length > 1 ? (
          <Pressable onPress={() => setPlaying((p) => !p)} style={[styles.playFab, { bottom: 24 }]}>
            <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <Animated.View entering={FadeInDown.duration(280)} style={{ padding: 20 }}>
          <View style={[styles.metaCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.metaTitle, { color: c.text }]}>
                {item.lookName ?? getFilter(item.filterId).name}
              </Text>
              <Text style={[styles.metaSub, { color: c.textFaint }]}>
                {item.width && item.height ? `${item.width}×${item.height}` : 'Local capture'}
                {item.durationMs ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : ''}
                {item.bytes ? ` · ${Math.round(item.bytes / 1024)} KB` : ''}
              </Text>
            </View>
            <View style={[styles.localPill, { backgroundColor: `${c.green}22` }]}>
              <Ionicons name="lock-closed" size={10} color={c.green} />
              <Text style={styles.localPillText}>Local</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <GhostButton
              label="Edit"
              icon="color-wand"
              style={{ flex: 1, marginRight: 8 }}
              onPress={() => {
                haptics.tap();
                navigation.navigate('Editor', { id: item.id });
              }}
            />
            <GhostButton
              label="Export"
              icon="images"
              style={{ flex: 1, marginRight: 8 }}
              onPress={doExport}
            />
            <GhostButton label="Share" icon="share-outline" style={{ flex: 1 }} onPress={doShare} />
          </View>

          {toast ? (
            <Animated.View entering={FadeIn} style={{ marginTop: 14 }}>
              <Banner text={toast} tone="success" />
            </Animated.View>
          ) : null}

          <Text style={[styles.foot, { color: c.textFaint }]}>
            AURA never uploads this file. Export and share only happen when you tap.
          </Text>
        </Animated.View>
      </ScrollView>

      <ProcessingOverlay
        visible={!!busy}
        title={busy === 'share' ? 'Preparing share' : 'Exporting'}
        stages={['Reading local file', 'Preparing output']}
        stageIndex={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  imgWrap: { width: '100%', height: '62%', backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  topBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  topSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  playFab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  metaTitle: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.2 },
  metaSub: { fontSize: 11.5, marginTop: 4 },
  localPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  localPillText: { color: '#3DDC97', fontSize: 10, fontWeight: '800', marginLeft: 5 },
  foot: { fontSize: 11, lineHeight: 16, marginTop: 18, textAlign: 'center' },
});
