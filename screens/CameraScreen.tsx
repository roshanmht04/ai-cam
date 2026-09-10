import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { useApp } from '../lib/store';
import { useFaceLock, FaceLockProvider } from '../lib/face';
import { FILTERS, getAiEffect, getFilter, mergeRecipes } from '../lib/catalog';
import { SCENE_PRESETS, SceneSpec } from '../lib/sceneGen';
import { EffectStack } from '../components/EffectStack';
import { SceneView } from '../components/SceneView';
import { CompositeStill } from '../components/CompositeStill';
import { FilterCarousel } from '../components/FilterCarousel';
import { CaptureButton } from '../components/CaptureButton';
import { PermissionGate } from '../components/PermissionGate';
import { Glass, IconButton, ProcessingOverlay } from '../components/UI';
import { Platform, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';

const MAX_RECORD_MS = 60000;
const ZOOM_STEPS = [
  { label: '1×', v: 0 },
  { label: '2×', v: 0.32 },
  { label: '3×', v: 0.55 },
  { label: '5×', v: 0.82 },
];

export default function CameraScreen({ navigation }: { navigation: any }) {
  return (
    <FaceLockProvider>
      <CameraBody navigation={navigation} />
    </FaceLockProvider>
  );
}

function CameraBody({ navigation }: { navigation: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { settings, selection, setSelection, subject, setSubject, gallery, addCapture } = useApp();
  const [perm, requestPerm] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const bakeRef = useRef<View>(null);

  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [flash, setFlash] = useState<'off' | 'auto' | 'on'>('off');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [zoomIdx, setZoomIdx] = useState(0);
  const [box, setBox] = useState({ width: width, height: height });
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [bakeJob, setBakeJob] = useState<{ uri: string; sceneId: string | null } | null>(null);

  const recStart = useRef(0);
  const recPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const webFrames = useRef<string[]>([]);
  const webTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false);

  const lock = useFaceLock();

  /* ------------------------------------------------------------ derivations */
  const filter = useMemo(() => getFilter(selection.filterId), [selection.filterId]);
  const effect = useMemo(() => getAiEffect(selection.effectId), [selection.effectId]);
  const recipe = useMemo(
    () => mergeRecipes(filter.recipe, effect?.apply ?? null),
    [filter, effect]
  );
  const scene = useScene(selection.sceneId);
  const faceActive = !!filter.faceTracked || !!effect?.needsFace;

  useEffect(() => {
    lock.setTracking(faceActive);
  }, [faceActive, lock]);

  /* ------------------------------------------------------------------ toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* -------------------------------------------------------------- countdown */
  const [pendingDelay, setPendingDelay] = useState<0 | 3 | 10>(0);

  const runCountdown = useCallback(
    (after: () => void) => {
      if (pendingDelay === 0) {
        after();
        return;
      }
      let left = pendingDelay;
      setCountdown(left);
      const id = setInterval(() => {
        left -= 1;
        setCountdown(left);
        haptics.tap();
        if (left <= 0) {
          clearInterval(id);
          after();
        }
      }, 1000);
    },
    [pendingDelay]
  );

  /* ------------------------------------------------------------- recording */
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Date.now() - recStart.current), 200);
    return () => clearInterval(id);
  }, [recording]);

  /* ---------------------------------------------------------------- capture */
  const needsBake = recipe.tints.length > 0 || recipe.stickers.length > 0 || !!scene;

  const bakeAndSave = useCallback(
    async (stillUri: string) => {
      let finalUri = stillUri;
      if (needsBake && bakeRef.current) {
        try {
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const shot = await captureRef(bakeRef, {
            format: 'jpg',
            quality: settings.quality === 'max' ? 0.94 : 0.8,
            width: 900,
            height: 1200,
          });
          if (shot) finalUri = shot;
        } catch {
          finalUri = stillUri;
        }
      }
      const item = await addCapture({
        sourceUri: finalUri,
        kind: 'photo',
        width: 900,
        height: 1200,
        filterId: selection.filterId,
        effectId: selection.effectId,
        sceneId: selection.sceneId,
        lookName: effect?.name ?? (filter.id !== 'none' ? filter.name : scene ? scene.name : undefined),
      });
      return item;
    },
    [addCapture, effect, filter.id, filter.name, needsBake, scene, selection, settings.quality]
  );

  const takePhoto = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || busy.current) return;
    busy.current = true;
    setCapturing(true);
    try {
      const photo = await cam.takePictureAsync({
        quality: settings.quality === 'max' ? 0.95 : 0.72,
        skipProcessing: false,
        exif: false,
      });
      if (photo?.uri) {
        setBakeJob({ uri: photo.uri, sceneId: selection.sceneId });
      }
    } catch {
      setToast('Capture failed — try again');
    } finally {
      setTimeout(() => setCapturing(false), 180);
      busy.current = false;
    }
  }, [selection.sceneId, settings.quality]);

  /* Flushes the bake job: renders the composite off-screen, snapshots it and
     writes the final file. Kept out of the render path so the viewfinder never
     blocks. */
  useEffect(() => {
    if (!bakeJob) return;
    let cancelled = false;
    (async () => {
      const item = await bakeAndSave(bakeJob.uri);
      if (cancelled) return;
      setBakeJob(null);
      if (item) {
        haptics.success();
        setToast('Saved to your library');
        if (settings.saveToRoll) {
          const { saveToCameraRoll } = await import('../lib/media');
          saveToCameraRoll(item.uri).then((r) => {
            if (!r.ok) setToast(r.reason ?? 'Could not auto-save');
          });
        }
        if (settings.openEditor) navigation.navigate('Editor', { id: item.id });
      } else {
        setToast('Could not save capture');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bakeJob, bakeAndSave, navigation, settings.openEditor, settings.saveToRoll]);

  /* -------------------------------------------------------------- recording */
  const startRecording = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam || recording || mode !== 'video') return;
    setRecording(true);
    setElapsed(0);
    recStart.current = Date.now();
    haptics.medium();

    if (Platform.OS === 'web') {
      webFrames.current = [];
      webTimer.current = setInterval(async () => {
        try {
          const f = await cameraRef.current?.takePictureAsync({ scale: 0.3, quality: 0.4, skipProcessing: true });
          if (f?.uri) webFrames.current.push(f.uri);
        } catch {
          /* frame dropped */
        }
      }, 680);
      return;
    }

    try {
      const p = cam.recordAsync({
        maxDuration: MAX_RECORD_MS,
      });
      recPromise.current = p;
      p.then(async (video) => {
        if (!video?.uri) return;
        const item = await addCapture({
          sourceUri: video.uri,
          kind: 'video',
          durationMs: Date.now() - recStart.current,
          filterId: selection.filterId,
          effectId: selection.effectId,
          sceneId: selection.sceneId,
          lookName: effect?.name ?? (filter.id !== 'none' ? filter.name : undefined),
        });
        if (item) {
          haptics.success();
          setToast('Clip saved');
        }
      }).catch(() => {});
    } catch {
      setRecording(false);
      setToast('Video is unavailable on this device');
    }
  }, [addCapture, effect, filter.id, filter.name, mode, recording, selection, settings.quality]);

  const stopRecording = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    setRecording(false);
    haptics.light();
    const durationMs = Date.now() - recStart.current;

    if (Platform.OS === 'web') {
      if (webTimer.current) clearInterval(webTimer.current);
      webTimer.current = null;
      const frames = webFrames.current.slice();
      webFrames.current = [];
      if (frames.length > 1) {
        const item = await addCapture({
          sourceUri: frames[0],
          kind: 'motion',
          durationMs,
          frames,
          filterId: selection.filterId,
          effectId: selection.effectId,
          sceneId: selection.sceneId,
          lookName: effect?.name ?? (filter.id !== 'none' ? filter.name : undefined),
        });
        if (item) {
          haptics.success();
          setToast('Motion clip saved');
        }
      } else {
        setToast('Hold longer to record a clip');
      }
      return;
    }

    cam.stopRecording();
    recPromise.current = null;
  }, [addCapture, effect, filter.id, filter.name, selection]);

  useEffect(() => {
    return () => {
      if (webTimer.current) clearInterval(webTimer.current);
    };
  }, []);

  /* --------------------------------------------------------------- gestures */
  const zoomScale = useSharedValue(1);
  const panY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      zoomScale.value = Math.max(0.5, Math.min(4, e.scale));
    })
    .onEnd((e) => {
      zoomScale.value = withTiming(1, { duration: 160 });
      const dir = e.scale > 1.12 ? 1 : e.scale < 0.9 ? -1 : 0;
      if (dir !== 0) runOnJS(setZoomIdx)((i: number) => Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir)));
    });

  const pan = Gesture.Pan()
    .enabled(!!scene)
    .averageTouches(false)
    .onUpdate((e) => {
      panY.value = e.translationY;
    })
    .onEnd(() => {
      runOnJS(setSubject)({ offsetY: Math.max(-90, Math.min(90, panY.value)) });
      panY.value = 0;
    });

  const tap = Gesture.Tap()
    .maxDuration(260)
    .onEnd((e, success) => {
      if (success) runOnJS(lock.setAnchor)(e.x / Math.max(1, box.width), e.y / Math.max(1, box.height));
    });

  const previewGesture = Gesture.Simultaneous(pinch, Gesture.Race(tap, pan));

  const camWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }, { translateY: panY.value * (scene ? 0.35 : 0) }],
  }));

  /* --------------------------------------------------------------- geometry */
  const onPreviewLayout = useCallback(
    (w: number, h: number) => setBox({ width: w, height: h }),
    []
  );

  const winW = scene ? box.width * 0.66 * subject.scale : box.width;
  const winH = scene ? box.height * 0.58 * subject.scale : box.height;

  /* ------------------------------------------------------------------ perms */
  if (!perm) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (!perm.granted) {
    return (
      <PermissionGate
        icon="camera"
        title="Camera access"
        headline="Let AURA see through the lens"
        bullets={[
          { icon: 'flash', text: 'Live filters, face FX and AI backgrounds render in the viewfinder in real time.' },
          { icon: 'lock-closed', text: 'Frames are processed on this device — the camera stream never leaves your phone.' },
          { icon: 'images', text: 'Photos are written to a private in-app library. You choose when to export.' },
        ]}
        primaryLabel={perm.canAskAgain ? 'Enable camera' : 'Open settings'}
        onPrimary={() => {
          haptics.tap();
          if (perm.canAskAgain) requestPerm();
        }}
        secondaryLabel="Browse effects first"
        onSecondary={() => navigation.navigate('Discover')}
      />
    );
  }

  /* ------------------------------------------------------------------ render */
  const flashIcon: Record<typeof flash, keyof typeof Ionicons.glyphMap> = {
    off: 'flash-off',
    auto: 'flash',
    on: 'flashlight',
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bgDeep }]}>
      {/* ---------------------------------------------------------- viewfinder */}
      <View
        style={styles.preview}
        onLayout={(e) => onPreviewLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
      >
        {scene ? <SceneView spec={scene} animated={!capturing} /> : null}

        <Animated.View
          style={[
            styles.camWindow,
            {
              left: (box.width - winW) / 2,
              top: (box.height - winH) / 2 + subject.offsetY,
              width: winW,
              height: winH,
              borderRadius: scene ? winW * 0.42 : 0,
              opacity: 1 - subject.softness * 0.12,
            },
            !scene && camWrapStyle,
          ]}
        >
          {scene ? (
            <Animated.View style={[StyleSheet.absoluteFill, camWrapStyle]}>
              <CameraLayer
                ref={cameraRef}
                facing={facing}
                flash={flash}
                mode={mode === 'video' ? 'video' : 'picture'}
                zoom={ZOOM_STEPS[zoomIdx].v}
                mirror={facing === 'front' && settings.mirrorFront}
                active
                onReady={() => setReady(true)}
                onError={setCamError}
              />
            </Animated.View>
          ) : (
            <CameraLayer
              ref={cameraRef}
              facing={facing}
              flash={flash}
              mode={mode === 'video' ? 'video' : 'picture'}
              zoom={ZOOM_STEPS[zoomIdx].v}
              mirror={facing === 'front' && settings.mirrorFront}
              active
              onReady={() => setReady(true)}
              onError={setCamError}
            />
          )}
        </Animated.View>

        {scene ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (box.width - winW) / 2,
              top: (box.height - winH) / 2 + subject.offsetY,
              width: winW,
              height: winH,
              borderRadius: winW * 0.42,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.32)',
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
            }}
          />
        ) : null}

        <EffectStack recipe={recipe} box={box} />

        {settings.gridLines ? <GridLines color={c.overlayText} /> : null}

        {!ready && !camError ? (
          <View style={[styles.center, StyleSheet.absoluteFill, { backgroundColor: c.bgDeep }]}>
            <ActivityIndicator color={c.accent} size="large" />
            <Text style={[styles.smallNote, { color: c.textDim }]}>Starting camera…</Text>
          </View>
        ) : null}

        {camError ? (
          <View style={[styles.center, StyleSheet.absoluteFill, { backgroundColor: c.bgDeep, padding: 28 }]}>
            <Ionicons name="warning" size={30} color={c.amber} />
            <Text style={[styles.errTitle, { color: c.text }]}>Camera unavailable</Text>
            <Text style={[styles.smallNote, { color: c.textDim }]}>{camError}</Text>
            <Pressable
              onPress={() => {
                setCamError(null);
                setReady(false);
              }}
              style={[styles.retry, { borderColor: c.borderStrong }]}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {countdown > 0 ? (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={[styles.center, StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
            pointerEvents="none"
          >
            <Text style={[styles.countdown, { color: c.overlayText }]}>{countdown}</Text>
          </Animated.View>
        ) : null}

        <GestureDetector gesture={previewGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </View>

      {/* ------------------------------------------------------------- top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <IconButton
            name={flashIcon[flash]}
            active={flash !== 'off'}
            tintActive={c.amber}
            accessibilityLabel="Flash"
            onPress={() => {
              haptics.tap();
              setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'));
            }}
          />
          <IconButton
            name="timer-outline"
            active={pendingDelay > 0}
            accessibilityLabel="Capture timer"
            onPress={() => {
              haptics.tap();
              setPendingDelay((d) => (d === 0 ? 3 : d === 3 ? 10 : 0));
            }}
          />

          <Glass style={styles.privacyPill} intensity={30} padded={false}>
            <View style={styles.privacyInner}>
              <Ionicons name="lock-closed" size={11} color={c.green} />
              <Text style={[styles.privacyText, { color: c.text }]}>On-device</Text>
            </View>
          </Glass>

          <IconButton
            name="color-wand"
            accessibilityLabel="AI effects"
            onPress={() => {
              haptics.tap();
              navigation.navigate('AIFx');
            }}
          />
          <IconButton
            name="image"
            active={!!scene}
            accessibilityLabel="AI backgrounds"
            onPress={() => {
              haptics.tap();
              navigation.navigate('Backgrounds');
            }}
          />
        </View>

        {faceActive ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ marginTop: 10, alignSelf: 'center' }}>
            <Pressable
              onPress={() => {
                haptics.tap();
                lock.recenter();
              }}
              style={[styles.lockPill, { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: `${c.accent}66` }]}
            >
              <Ionicons
                name={lock.sourceLabel === 'Face locked' ? 'scan' : 'happy'}
                size={12}
                color={c.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.lockText, { color: c.text }]}>Face Lock · {lock.sourceLabel}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      {/* ---------------------------------------------------------------- zoom */}
      <View style={[styles.zoomRail, { top: insets.top + 62 }]} pointerEvents="box-none">
        {zoomIdx > 0 ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              setZoomIdx(0);
            }}
            style={[styles.zoomPill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          >
            <Text style={[styles.zoomText, { color: c.amber }]}>{ZOOM_STEPS[zoomIdx].label}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* -------------------------------------------------------------- bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none">
        {toast ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ marginBottom: 10, alignSelf: 'center' }}>
            <Glass style={{ paddingHorizontal: 4 }} padded={false}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                <Text style={{ color: c.text, fontSize: 12.5, fontWeight: '600' }}>{toast}</Text>
              </View>
            </Glass>
          </Animated.View>
        ) : null}

        <View style={styles.chipRow} pointerEvents="box-none">
          <ScrollViewish>
            <Pressable
              onPress={() => {
                haptics.tap();
                navigation.navigate('Backgrounds');
              }}
              style={[
                styles.actionChip,
                { backgroundColor: scene ? c.accent : 'rgba(0,0,0,0.45)', borderColor: scene ? c.accent : c.glassBorder },
              ]}
            >
              <Ionicons name="images" size={13} color="#fff" />
              <Text style={styles.actionChipText}>{scene ? scene.name : 'AI Background'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                haptics.tap();
                setFacing((f) => (f === 'front' ? 'back' : 'front'));
              }}
              style={[styles.actionChip, { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: c.glassBorder }]}
            >
              <Ionicons name="camera-reverse" size={13} color="#fff" />
              <Text style={styles.actionChipText}>{facing === 'front' ? 'Front' : 'Rear'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                haptics.tap();
                setZoomIdx((i) => (i + 1) % ZOOM_STEPS.length);
              }}
              style={[styles.actionChip, { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: c.glassBorder }]}
            >
              <Ionicons name="search" size={13} color="#fff" />
              <Text style={styles.actionChipText}>{ZOOM_STEPS[zoomIdx].label}</Text>
            </Pressable>
          </ScrollViewish>
        </View>

        <FilterCarousel
          filters={FILTERS}
          selectedId={selection.filterId}
          onSelect={(id) => setSelection({ filterId: id })}
          onBrowse={() => navigation.navigate('Discover')}
        />

        <View style={styles.controlsRow}>
          <Pressable
            accessibilityLabel="Open last capture"
            onPress={() => {
              haptics.tap();
              if (gallery[0]) navigation.navigate('Viewer', { id: gallery[0].id });
              else navigation.navigate('Library');
            }}
            style={[styles.thumb, { borderColor: c.borderStrong }]}
          >
            {gallery[0]?.uri ? (
              <Image source={{ uri: gallery[0].uri }} style={styles.thumbImg} contentFit="cover" />
            ) : (
              <Ionicons name="images" size={17} color={c.textDim} />
            )}
            {gallery[0]?.kind !== 'photo' && gallery[0] ? (
              <View style={styles.thumbBadge}>
                <Ionicons
                  name={gallery[0].kind === 'video' ? 'play' : 'flash'}
                  size={7}
                  color="#fff"
                />
              </View>
            ) : null}
          </Pressable>

          <CaptureButton
            mode={mode === 'video' ? 'video' : 'picture'}
            recording={recording}
            disabled={!ready || !!camError}
            maxMs={MAX_RECORD_MS}
            elapsedMs={elapsed}
            onCapture={() => runCountdown(takePhoto)}
            onRecordStart={startRecording}
            onRecordEnd={stopRecording}
          />

          <Pressable
            accessibilityLabel="Switch camera"
            onPress={() => {
              haptics.medium();
              setFacing((f) => (f === 'front' ? 'back' : 'front'));
            }}
            style={[styles.flipBtn, { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: c.glassBorder }]}
          >
            <Ionicons name="camera-reverse" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          <ModeSwitch mode={mode} onChange={(m) => { haptics.tap(); setMode(m); }} />
        </View>
      </View>

      {/* --------------------------------------------------- hidden bake canvas */}
      {bakeJob ? (
        <View style={styles.bakeCanvas} pointerEvents="none">
          <CompositeStill
            ref={bakeRef}
            uri={bakeJob.uri}
            recipe={recipe}
            box={{ width: 900, height: 1200 }}
            scene={scene}
            subject={subject}
            mirror={facing === 'front' && settings.mirrorFront}
          />
        </View>
      ) : null}

      <ProcessingOverlay
        visible={capturing}
        title="Developing"
        stages={['Capturing frame', 'Applying look', 'Writing to library']}
        stageIndex={capturing ? 1 : 0}
      />
    </View>
  );
}

/* --------------------------------------------------------------- fragments */

const CameraLayer = React.forwardRef<
  CameraView,
  {
    facing: 'front' | 'back';
    flash: 'off' | 'auto' | 'on';
    mode: 'photo' | 'video';
    zoom: number;
    mirror: boolean;
    active: boolean;
    onReady: () => void;
    onError: (m: string) => void;
  }
>(function CameraLayer({ facing, flash, mode, zoom, mirror, active, onReady, onError }, ref) {
  return (
    <CameraView
      ref={ref}
      style={StyleSheet.absoluteFill}
      facing={facing}
      flash={flash as FlashMode}
      mode={mode === 'video' ? 'video' : 'picture'}
      zoom={zoom}
      mirror={mirror}
      active={active}
      animateShutter={false}
      enableTorch={false}
      videoQuality="1080p"
      onCameraReady={onReady}
      onMountError={(e) => onError(e.message ?? 'The camera could not start.')}
    />
  );
});

function GridLines({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[1, 2].map((i) => (
        <View
          key={`v${i}`}
          style={[styles.gridV, { left: `${(i * 100) / 3}%`, backgroundColor: color, opacity: 0.22 }]}
        />
      ))}
      {[1, 2].map((i) => (
        <View
          key={`h${i}`}
          style={[styles.gridH, { top: `${(i * 100) / 3}%`, backgroundColor: color, opacity: 0.22 }]}
        />
      ))}
    </View>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: 'photo' | 'video';
  onChange: (m: 'photo' | 'video') => void;
}) {
  const { c } = useTheme();
  const items: { key: 'photo' | 'video'; label: string }[] = [
    { key: 'photo', label: 'PHOTO' },
    { key: 'video', label: Platform.OS === 'web' ? 'MOTION' : 'VIDEO' },
  ];
  return (
    <View style={styles.modeSwitch}>
      {items.map((it) => {
        const active = it.key === mode;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={styles.modeItem} accessibilityRole="tab">
            {active ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999 }]}
              />
            ) : null}
            <Text
              style={{
                color: active ? c.overlayText : 'rgba(255,255,255,0.55)',
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 1.4,
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScrollViewish({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipScroller}>{children}</View>;
}

function useScene(sceneId: string | null): SceneSpec | null {
  const { generatedScenes } = useApp();
  if (!sceneId) return null;
  return generatedScenes.find((s) => s.id === sceneId) ?? SCENE_PRESETS.find((s) => s.id === sceneId) ?? null;
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  root: { flex: 1 },
  preview: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  camWindow: { position: 'absolute', overflow: 'hidden', backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  smallNote: { fontSize: 12.5, marginTop: 10, textAlign: 'center' },
  errTitle: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  retry: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  countdown: { fontSize: 92, fontWeight: '800', letterSpacing: -4, textShadowRadius: 20 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  privacyPill: { marginHorizontal: 6, flexShrink: 1 },
  privacyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
  },
  privacyText: { fontSize: 11.5, fontWeight: '700', marginLeft: 6, letterSpacing: 0.2 },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  zoomRail: { position: 'absolute', alignSelf: 'center' },
  zoomPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  zoomText: { fontSize: 12, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  chipRow: { paddingHorizontal: 14, marginBottom: 4 },
  chipScroller: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginHorizontal: 4,
    marginBottom: 6,
  },
  actionChipText: { color: '#fff', fontSize: 11.5, fontWeight: '700', marginLeft: 6 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginTop: 10,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: { alignItems: 'center', marginTop: 12 },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modeItem: { paddingHorizontal: 20, paddingVertical: 7, borderRadius: 999, overflow: 'hidden' },
  bakeCanvas: { position: 'absolute', left: -3000, top: 0, opacity: 0.01 },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
