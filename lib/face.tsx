import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LayoutChangeEvent, Platform } from 'react-native';
import { SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

/**
 * Face Lock — the anchor that keeps face-attached effects glued to the subject.
 *
 * Resolution order:
 *  1. Platform face detector (Shape Detection API on Chromium builds) — real ML,
 *     runs off the JS thread and writes straight into shared values.
 *  2. Manual anchor — tap/drag anywhere on the preview to place the face box.
 *  3. Auto drift — a gentle idle orbit so face effects stay lively before lock.
 *
 * Everything is written to Reanimated shared values, so zero React work happens
 * per frame and the render thread stays untouched.
 */

export type FaceSource = 'auto' | 'manual' | 'detector';

const SRC_AUTO = 0;
const SRC_MANUAL = 1;
const SRC_DETECTOR = 2;

type FaceLockValue = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  size: SharedValue<number>;
  confidence: SharedValue<number>;
  source: SharedValue<number>;
  tracking: boolean;
  sourceLabel: string;
  setAnchor: (x: number, y: number, size?: number) => void;
  recenter: () => void;
  setTracking: (on: boolean) => void;
  onPreviewLayout: (e: LayoutChangeEvent) => void;
};

const Ctx = createContext<FaceLockValue | null>(null);

export function FaceLockProvider({ children }: { children: React.ReactNode }) {
  const x = useSharedValue(0.5);
  const y = useSharedValue(0.42);
  const size = useSharedValue(0.38);
  const confidence = useSharedValue(0);
  const source = useSharedValue(SRC_AUTO);
  const manualAt = useSharedValue(0);
  const manualTarget = useSharedValue({ x: 0.5, y: 0.42 });

  const [tracking, setTracking] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('Auto orbit');
  const [preview, setPreview] = useState({ w: 0, h: 0 });

  const flashLabel = useCallback((label: string) => {
    setSourceLabel(label);
  }, []);

  /* Idle orbit + smoothing. Runs on the UI thread, never touches React state. */
  useFrameCallback((frame) => {
    'worklet';
    const t = frame.timeSinceFirstFrame / 1000;
    if (source.value === SRC_DETECTOR) {
      confidence.value += (1 - confidence.value) * 0.08;
      return;
    }

    let tx = 0.5;
    let ty = 0.42;
    let ts = 0.38;

    if (source.value === SRC_MANUAL) {
      tx = manualTarget.value.x;
      ty = manualTarget.value.y;
      ts = 0.4;
      if (frame.timeSinceFirstFrame - manualAt.value > 7000) {
        source.value = SRC_AUTO;
      }
    } else {
      tx = 0.5 + Math.sin(t / 3.4) * 0.055;
      ty = 0.43 + Math.sin(t / 2.6) * 0.035;
      ts = 0.38 + Math.sin(t / 5.2) * 0.018;
    }

    const k = source.value === SRC_MANUAL ? 0.16 : 0.035;
    x.value += (tx - x.value) * k;
    y.value += (ty - y.value) * k;
    size.value += (ts - size.value) * k;
    confidence.value += (0.72 - confidence.value) * 0.02;
  }, true);

  const setAnchor = useCallback(
    (nx: number, ny: number, nsize = 0.4) => {
      manualTarget.value = { x: clamp01(nx), y: clamp01(ny) };
      manualAt.value = performance.now();
      source.value = SRC_MANUAL;
      size.value += (clamp01(nsize) - size.value) * 0.5;
      flashLabel('Manual lock');
    },
    [flashLabel, manualAt, manualTarget, size, source]
  );

  const recenter = useCallback(() => {
    source.value = SRC_AUTO;
    flashLabel('Auto orbit');
  }, [flashLabel, source]);

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPreview((prev) => (Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }));
  }, []);

  /* Real platform face detection when the runtime exposes it (Chromium). */
  useEffect(() => {
    if (Platform.OS !== 'web' || !tracking || preview.w === 0) return;
    const w = window as unknown as { FaceDetector?: new (o: unknown) => { detect: (t: unknown) => Promise<{ boundingBox: DOMRectReadOnly }[]> } };
    if (!w.FaceDetector) return;

    let cancelled = false;
    let detector: { detect: (t: unknown) => Promise<{ boundingBox: DOMRectReadOnly }[]> } | null = null;
    try {
      detector = new w.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    } catch {
      return;
    }

    const tick = async () => {
      if (cancelled || !detector) return;
      const video = document.querySelector('video');
      if (!video || video.videoWidth === 0) return;
      try {
        const faces = await detector.detect(video);
        if (cancelled) return;
        if (faces.length > 0) {
          const box = faces[0].boundingBox;
          const map = coverMap(video.videoWidth, video.videoHeight, preview.w, preview.h);
          const cx = map.x + box.x * map.scale + (box.width * map.scale) / 2;
          const cy = map.y + box.y * map.scale + (box.height * map.scale) / 2;
          const s = (box.width * map.scale) / preview.w;
          x.value += (clamp01(cx / preview.w) - x.value) * 0.45;
          y.value += (clamp01(cy / preview.h) - y.value) * 0.45;
          size.value += (clamp01(s * 1.5) - size.value) * 0.35;
          if (source.value !== SRC_DETECTOR) flashLabel('Face locked');
          source.value = SRC_DETECTOR;
        } else if (source.value === SRC_DETECTOR) {
          source.value = SRC_AUTO;
          flashLabel('Auto orbit');
        }
      } catch {
        /* detector hiccup — keep the previous anchor */
      }
    };

    const id = setInterval(tick, 160);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (source.value === SRC_DETECTOR) source.value = SRC_AUTO;
    };
  }, [tracking, preview.w, preview.h, flashLabel, size, source, x, y]);

  const value = useMemo<FaceLockValue>(
    () => ({
      x,
      y,
      size,
      confidence,
      source,
      tracking,
      sourceLabel,
      setAnchor,
      recenter,
      setTracking,
      onPreviewLayout,
    }),
    [x, y, size, confidence, source, tracking, sourceLabel, setAnchor, recenter, onPreviewLayout]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Maps video-frame coordinates into the (cover-fitted) preview box. */
function coverMap(vw: number, vh: number, w: number, h: number) {
  const va = vw / vh;
  const ca = w / h;
  if (va > ca) {
    const scale = h / vh;
    return { scale, x: (w - vw * scale) / 2, y: 0 };
  }
  const scale = w / vw;
  return { scale, x: 0, y: (h - vh * scale) / 2 };
}

export function useFaceLock() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFaceLock must be used inside <FaceLockProvider>');
  return ctx;
}
