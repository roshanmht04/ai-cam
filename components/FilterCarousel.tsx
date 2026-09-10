import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FilterDef } from '../lib/catalog';
import { useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';

const ITEM = 64;
const GAP = 14;
const STEP = ITEM + GAP;

/**
 * Real-time look carousel. Selection is committed on scroll momentum so the
 * preview never re-renders while the list is still moving.
 */
export function FilterCarousel({
  filters,
  selectedId,
  onSelect,
  onBrowse,
}: {
  filters: FilterDef[];
  selectedId: string;
  onSelect: (id: string) => void;
  onBrowse?: () => void;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const pad = Math.max(16, (width - ITEM) / 2);
  const listRef = useRef<FlatList<FilterDef>>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const idx = filters.findIndex((f) => f.id === selectedId);
    if (idx >= 0 && idx !== current) {
      listRef.current?.scrollToIndex({ index: idx, animated: true });
      setCurrent(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const commit = useCallback(
    (offsetX: number) => {
      const idx = Math.max(0, Math.min(filters.length - 1, Math.round(offsetX / STEP)));
      if (idx !== current) {
        setCurrent(idx);
        haptics.tap();
        onSelect(filters[idx].id);
      }
    },
    [current, filters, onSelect]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FilterDef; index: number }) => {
      const active = item.id === selectedId;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} filter`}
          accessibilityState={{ selected: active }}
          onPress={() => {
            haptics.light();
            onSelect(item.id);
            listRef.current?.scrollToIndex({ index, animated: true });
          }}
          style={styles.item}
        >
          <View
            style={[
              styles.swatchWrap,
              active && { borderColor: c.accent, shadowColor: c.accent },
            ]}
          >
            <LinearGradient
              colors={item.swatch}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.swatch}
            />
            <View style={[styles.swatchGlass, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
            <Ionicons
              name={item.glyph as keyof typeof Ionicons.glyphMap}
              size={19}
              color="#FFFFFF"
              style={styles.swatchIcon}
            />
            {item.hot ? (
              <View style={[styles.hot, { backgroundColor: c.pink }]}>
                <Ionicons name="flame" size={9} color="#fff" />
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: active ? c.accent : c.textDim }]}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [c.accent, c.pink, onSelect, selectedId]
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={filters}
        keyExtractor={(f) => f.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: STEP, offset: STEP * index, index })}
        contentContainerStyle={{ paddingHorizontal: pad, paddingRight: pad }}
        snapToInterval={STEP}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        removeClippedSubviews
        initialScrollIndex={0}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(e) => commit(e.nativeEvent.contentOffset.x)}
        windowSize={7}
        maxToRenderPerBatch={9}
        initialNumToRender={11}
        ListFooterComponent={
          onBrowse ? (
            <Animated.View entering={FadeIn} style={styles.item}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse all effects"
                onPress={() => {
                  haptics.tap();
                  onBrowse();
                }}
                style={[styles.browse, { borderColor: c.border, backgroundColor: c.glass }]}
              >
                <Ionicons name="grid" size={18} color={c.text} />
              </Pressable>
              <Text style={[styles.name, { color: c.textFaint }]}>Browse</Text>
            </Animated.View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 6 },
  item: { width: ITEM, alignItems: 'center', marginRight: GAP },
  swatchWrap: {
    width: ITEM,
    height: ITEM,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  swatch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  swatchGlass: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    borderRadius: 20,
  },
  swatchIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -10,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  hot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browse: {
    width: ITEM,
    height: ITEM,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 10.5, fontWeight: '600', marginTop: 7, letterSpacing: 0.2 },
});
