import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MediaItem,
  loadGalleryMeta,
  materializeWeb,
  persistCapture,
  persistFrames,
  removeMedia,
  saveGalleryMeta,
} from './media';
import { configureHaptics } from './haptics';
import { SceneSpec, SCENE_PRESETS } from './sceneGen';

export type Settings = {
  appearance: 'system' | 'dark' | 'light';
  haptics: boolean;
  hapticLevel: 'light' | 'medium' | 'off';
  mirrorFront: boolean;
  gridLines: boolean;
  saveToRoll: boolean;
  openEditor: boolean;
  quality: 'hd' | 'max';
  watermark: boolean;
  /** explicit, revocable opt-in — never defaults to true, never auto-uploads */
  cloudConsent: boolean;
  cloudConsentAt: number | null;
  reducedMotion: boolean;
  keepCameraWarm: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  haptics: true,
  hapticLevel: 'medium',
  mirrorFront: true,
  gridLines: false,
  saveToRoll: false,
  openEditor: true,
  quality: 'max',
  watermark: false,
  cloudConsent: false,
  cloudConsentAt: null,
  reducedMotion: false,
  keepCameraWarm: true,
};

export type Selection = {
  filterId: string;
  effectId: string | null;
  sceneId: string | null;
};

export type SubjectShape = {
  scale: number;
  offsetY: number;
  softness: number;
};

const DEFAULT_SUBJECT: SubjectShape = { scale: 1, offsetY: 0, softness: 0.5 };

const SETTINGS_KEY = '@aura/settings/v1';
const GEN_KEY = '@aura/generated-scenes/v1';
const SEL_KEY = '@aura/selection/v1';

type Ctx = {
  ready: boolean;
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  grantCloudConsent: () => void;
  revokeCloudConsent: () => void;

  gallery: MediaItem[];
  addCapture: (input: {
    sourceUri: string;
    kind: MediaItem['kind'];
    durationMs?: number;
    width?: number;
    height?: number;
    filterId?: string | null;
    effectId?: string | null;
    sceneId?: string | null;
    lookName?: string;
    frames?: string[];
  }) => Promise<MediaItem | null>;
  deleteCapture: (id: string) => Promise<void>;
  clearCaptures: () => Promise<void>;

  selection: Selection;
  setSelection: (patch: Partial<Selection>) => void;

  subject: SubjectShape;
  setSubject: (patch: Partial<SubjectShape>) => void;

  generatedScenes: SceneSpec[];
  addGeneratedScene: (spec: SceneSpec) => void;
  removeGeneratedScene: (id: string) => void;

  resetAll: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const [generatedScenes, setGeneratedScenes] = useState<SceneSpec[]>([]);
  const [selection, setSelectionState] = useState<Selection>({
    filterId: 'none',
    effectId: null,
    sceneId: null,
  });
  const [subject, setSubjectState] = useState<SubjectShape>(DEFAULT_SUBJECT);
  const hydrated = useRef(false);

  /* ------------------------------------------------------------- hydration */
  useEffect(() => {
    (async () => {
      try {
        const [s, g, sel, meta] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(GEN_KEY),
          AsyncStorage.getItem(SEL_KEY),
          loadGalleryMeta(),
        ]);
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<Settings>) });
        if (g) setGeneratedScenes(JSON.parse(g) as SceneSpec[]);
        if (sel) setSelectionState((prev) => ({ ...prev, ...(JSON.parse(sel) as Partial<Selection>) }));
        const materialized = await materializeWeb(meta);
        setGallery(materialized);
      } catch {
        // first run / corrupt state — defaults are fine
      } finally {
        hydrated.current = true;
        setReady(true);
      }
    })();
  }, []);

  /* ------------------------------------------------------------ persistence */
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
    configureHaptics(settings.haptics, settings.hapticLevel);
  }, [settings]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(GEN_KEY, JSON.stringify(generatedScenes)).catch(() => {});
  }, [generatedScenes]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(SEL_KEY, JSON.stringify(selection)).catch(() => {});
  }, [selection]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const grantCloudConsent = useCallback(() => {
    setSettings((prev) => ({ ...prev, cloudConsent: true, cloudConsentAt: Date.now() }));
  }, []);

  const revokeCloudConsent = useCallback(() => {
    setSettings((prev) => ({ ...prev, cloudConsent: false, cloudConsentAt: null }));
  }, []);

  const addCapture = useCallback<Ctx['addCapture']>(async (input) => {
    try {
      const id = `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const persisted = await persistCapture({ sourceUri: input.sourceUri, kind: input.kind, id });
      let frames = input.frames;
      if (frames?.length) frames = await persistFrames(frames, id);
      const item: MediaItem = {
        id,
        kind: input.kind,
        uri: persisted.uri,
        bytes: persisted.bytes,
        createdAt: Date.now(),
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
        filterId: input.filterId ?? null,
        effectId: input.effectId ?? null,
        sceneId: input.sceneId ?? null,
        lookName: input.lookName,
        frames: frames?.length ? frames : undefined,
      };
      setGallery((prev) => {
        const next = [item, ...prev];
        saveGalleryMeta(next).catch(() => {});
        return next;
      });
      return item;
    } catch {
      return null;
    }
  }, []);

  const deleteCapture = useCallback(async (id: string) => {
    setGallery((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) removeMedia(target).catch(() => {});
      const next = prev.filter((i) => i.id !== id);
      saveGalleryMeta(next).catch(() => {});
      return next;
    });
  }, []);

  const clearCaptures = useCallback(async () => {
    setGallery((prev) => {
      prev.forEach((i) => removeMedia(i).catch(() => {}));
      saveGalleryMeta([]).catch(() => {});
      return [];
    });
  }, []);

  const setSelection = useCallback((patch: Partial<Selection>) => {
    setSelectionState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSubject = useCallback((patch: Partial<SubjectShape>) => {
    setSubjectState((prev) => ({ ...prev, ...patch }));
  }, []);

  const addGeneratedScene = useCallback((spec: SceneSpec) => {
    setGeneratedScenes((prev) => [spec, ...prev.filter((s) => s.id !== spec.id)].slice(0, 24));
  }, []);

  const removeGeneratedScene = useCallback((id: string) => {
    setGeneratedScenes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetAll = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    setSelectionState({ filterId: 'none', effectId: null, sceneId: null });
    setSubjectState(DEFAULT_SUBJECT);
    setGeneratedScenes([]);
    setGallery((prev) => {
      prev.forEach((i) => removeMedia(i).catch(() => {}));
      return [];
    });
    for (const key of [SETTINGS_KEY, GEN_KEY, SEL_KEY, '@aura/gallery/v1']) {
      await AsyncStorage.removeItem(key).catch(() => {});
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      settings,
      updateSetting,
      grantCloudConsent,
      revokeCloudConsent,
      gallery,
      addCapture,
      deleteCapture,
      clearCaptures,
      selection,
      setSelection,
      subject,
      setSubject,
      generatedScenes,
      addGeneratedScene,
      removeGeneratedScene,
      resetAll,
    }),
    [
      ready,
      settings,
      updateSetting,
      grantCloudConsent,
      revokeCloudConsent,
      gallery,
      addCapture,
      deleteCapture,
      clearCaptures,
      selection,
      setSelection,
      subject,
      setSubject,
      generatedScenes,
      addGeneratedScene,
      removeGeneratedScene,
      resetAll,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function isWeb() {
  return Platform.OS === 'web';
}

/** Resolves a scene id against presets + user generated scenes. */
export function useSceneResolver() {
  const { generatedScenes } = useApp();
  return useCallback(
    (id: string | null | undefined): SceneSpec | null => {
      if (!id) return null;
      return (
        generatedScenes.find((s) => s.id === id) ?? SCENE_PRESETS.find((s) => s.id === id) ?? null
      );
    },
    [generatedScenes]
  );
}
