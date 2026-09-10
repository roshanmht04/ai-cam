import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { formatBytes } from '../lib/format';
import { Banner, GhostButton, GradientButton, Segmented } from '../components/UI';

function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const interactive = !!onPress;
  return (
    <Pressable
      disabled={!interactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: c.border },
        pressed ? { backgroundColor: c.surface2 } : null,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? `${c.red}1F` : c.accentSoft }]}>
        <Ionicons name={icon} size={15} color={danger ? c.red : c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: danger ? c.red : c.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: c.textFaint }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
      <Text style={[styles.cardKicker, { color: c.accent }]}>{title.toUpperCase()}</Text>
      {subtitle ? <Text style={[styles.cardSub, { color: c.textFaint }]}>{subtitle}</Text> : null}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

const CONSENT_POINTS: { icon: keyof typeof Ionicons.glyphMap; t: string; d: string }[] = [
  {
    icon: 'eye',
    t: 'Exactly what is sent',
    d: 'Only the single frame you tapped — never your camera roll, never background audio, never location.',
  },
  {
    icon: 'time',
    t: 'How long it is kept',
    d: 'Frames are processed in memory and dropped within 24 hours. No training, no retention.',
  },
  {
    icon: 'phone-portrait',
    t: 'What still runs locally',
    d: 'Live filters, face FX, backgrounds and every on-device model keep working with consent off.',
  },
  {
    icon: 'close-circle',
    t: 'How to undo it',
    d: 'Revoke consent any time in Settings — cloud effects lock instantly.',
  },
];

export default function SettingsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSetting,
    grantCloudConsent,
    revokeCloudConsent,
    gallery,
    clearCaptures,
    resetAll,
    generatedScenes,
  } = useApp();

  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [libPerm, setLibPerm] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const refreshLibPerm = useCallback(async () => {
    try {
      setLibPerm(await MediaLibrary.getPermissionsAsync(true));
    } catch {
      setLibPerm(null);
    }
  }, []);

  useEffect(() => {
    refreshLibPerm();
  }, [refreshLibPerm]);

  const bytes = gallery.reduce((acc, i) => acc + (i.bytes ?? 0), 0);

  const sw = (key: 'mirrorFront' | 'gridLines' | 'openEditor' | 'saveToRoll' | 'haptics' | 'reducedMotion' | 'keepCameraWarm') =>
    (value: boolean) => {
      haptics.tap();
      updateSetting(key, value);
    };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: c.accent }]}>CONTROL CENTRE</Text>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <View
            style={[
              styles.consentCard,
              { backgroundColor: c.surface, borderColor: settings.cloudConsent ? `${c.green}55` : c.border },
            ]}
          >
            <LinearGradient
              colors={
                settings.cloudConsent
                  ? ([`${c.green}22`, 'transparent'] as [string, string])
                  : ([`${c.accent}22`, 'transparent'] as [string, string])
              }
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.consentHead}>
              <View
                style={[styles.rowIcon, { backgroundColor: settings.cloudConsent ? `${c.green}22` : c.accentSoft }]}
              >
                <Ionicons
                  name={settings.cloudConsent ? 'cloud-done' : 'cloud-offline'}
                  size={16}
                  color={settings.cloudConsent ? c.green : c.accent}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowTitle, { color: c.text }]}>Cloud AI processing</Text>
                <Text style={[styles.rowSub, { color: c.textFaint }]}>
                  {settings.cloudConsent
                    ? `Consent granted ${new Date(settings.cloudConsentAt ?? Date.now()).toLocaleDateString()}`
                    : 'Off — every frame stays on this device'}
                </Text>
              </View>
            </View>

            <Text style={[styles.consentBody, { color: c.textDim }]}>
              Some effects need a server-side model. AURA always asks before sending a single frame,
              shows exactly which model runs, and lets you revoke consent at any time. Your camera
              roll is never scanned or uploaded.
            </Text>

            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              {settings.cloudConsent ? (
                <GhostButton
                  label="Revoke consent"
                  icon="close-circle"
                  onPress={revokeCloudConsent}
                  style={{ flex: 1 }}
                />
              ) : (
                <GradientButton
                  label="Review consent"
                  icon="hand-left"
                  onPress={() => setConsentOpen(true)}
                  small
                />
              )}
            </View>
          </View>
        </Animated.View>

        <Card title="Appearance">
          <View style={{ padding: 14 }}>
            <Segmented
              value={settings.appearance}
              onChange={(v) => {
                haptics.tap();
                updateSetting('appearance', v);
              }}
              items={[
                { key: 'system', label: 'SYSTEM' },
                { key: 'dark', label: 'DARK' },
                { key: 'light', label: 'LIGHT' },
              ]}
            />
          </View>
        </Card>

        <Card title="Capture" subtitle="Shutter behaviour and defaults">
          <Row
            icon="camera-reverse"
            title="Mirror front camera"
            subtitle="Save selfies the way you see them"
            right={
              <Switch
                value={settings.mirrorFront}
                onValueChange={sw('mirrorFront')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="grid"
            title="Composition grid"
            subtitle="Thirds overlay in the viewfinder"
            right={
              <Switch
                value={settings.gridLines}
                onValueChange={sw('gridLines')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="color-wand"
            title="Open editor after capture"
            subtitle="Jump straight into retouching"
            right={
              <Switch
                value={settings.openEditor}
                onValueChange={sw('openEditor')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="download"
            title="Auto-save to device Photos"
            subtitle="Off by default — exports stay manual"
            right={
              <Switch
                value={settings.saveToRoll}
                onValueChange={sw('saveToRoll')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
          <View style={{ padding: 14 }}>
            <Text style={[styles.rowTitle, { color: c.text, marginBottom: 10 }]}>Capture quality</Text>
            <Segmented
              value={settings.quality}
              onChange={(v) => {
                haptics.tap();
                updateSetting('quality', v);
              }}
              items={[
                { key: 'hd', label: 'EFFICIENT' },
                { key: 'max', label: 'MAXIMUM' },
              ]}
            />
          </View>
        </Card>

        <Card title="Feedback" subtitle="Haptics are silent in the browser">
          <Row
            icon="phone-portrait"
            title="Haptic feedback"
            subtitle="Shutter ticks, rec start/stop, success"
            right={
              <Switch
                value={settings.haptics}
                onValueChange={sw('haptics')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
          <View style={{ padding: 14 }}>
            <Segmented
              value={settings.hapticLevel}
              onChange={(v) => updateSetting('hapticLevel', v)}
              compact
              items={[
                { key: 'light', label: 'LIGHT' },
                { key: 'medium', label: 'MEDIUM' },
                { key: 'off', label: 'OFF' },
              ]}
            />
          </View>
        </Card>

        <Card title="Performance" subtitle="Effects are GPU composited — keep it that way">
          <Row
            icon="speedometer"
            title="Reduced motion"
            subtitle="Freeze animated backgrounds and glows"
            right={
              <Switch
                value={settings.reducedMotion}
                onValueChange={sw('reducedMotion')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="hardware-chip"
            title="Keep camera session warm"
            subtitle="Faster reopen, slightly higher idle cost"
            right={
              <Switch
                value={settings.keepCameraWarm}
                onValueChange={sw('keepCameraWarm')}
                trackColor={{ true: c.accent, false: c.surface3 }}
                thumbColor="#fff"
              />
            }
          />
        </Card>

        <Card title="Permissions">
          <Row
            icon="camera"
            title="Camera"
            subtitle={
              cameraPerm?.granted
                ? 'Granted — live preview active'
                : cameraPerm?.canAskAgain
                  ? 'Not granted yet'
                  : 'Blocked — enable it in system settings'
            }
            right={
              cameraPerm?.granted ? (
                <Ionicons name="checkmark-circle" size={20} color={c.green} />
              ) : (
                <Pressable onPress={() => requestCameraPerm()} style={[styles.smallBtn, { borderColor: c.borderStrong }]}>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Allow</Text>
                </Pressable>
              )
            }
          />
          <Row
            icon="images"
            title="Photo library"
            subtitle={
              libPerm?.granted
                ? 'Granted — backgrounds and export available'
                : 'Only used when you pick a background or save'
            }
            right={
              libPerm?.granted ? (
                <Ionicons name="checkmark-circle" size={20} color={c.green} />
              ) : (
                <Pressable
                  onPress={async () => {
                    await MediaLibrary.requestPermissionsAsync(false);
                    refreshLibPerm();
                  }}
                  style={[styles.smallBtn, { borderColor: c.borderStrong }]}
                >
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Allow</Text>
                </Pressable>
              )
            }
          />
        </Card>

        <Card title="Storage" subtitle="Local-first, no cloud footprint">
          <Row
            icon="server"
            title="Stored on this device"
            subtitle={`${gallery.length} capture(s) · ${formatBytes(bytes)} · ${generatedScenes.length} generated scene(s)`}
          />
          <Row
            icon="trash"
            title="Clear capture library"
            subtitle="Deletes every file AURA wrote to disk"
            danger
            onPress={() => {
              haptics.warning();
              Alert.alert('Clear library?', `${gallery.length} capture(s) will be deleted.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => clearCaptures() },
              ]);
            }}
          />
          <Row
            icon="refresh"
            title="Reset app to factory state"
            subtitle="Settings, consent, scenes and captures"
            danger
            onPress={() => {
              haptics.warning();
              Alert.alert('Reset AURA?', 'All preferences, consent and captures are erased.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: () => resetAll() },
              ]);
            }}
          />
        </Card>

        <Card title="About">
          <Row icon="sparkles" title="AURA AI Camera" subtitle="Version 1.0.0 · Effect engine 3" />
          <Row
            icon="shield-checkmark"
            title="No trackers, no analytics on media"
            subtitle="Diagnostics never include pixels or audio"
          />
          <Row
            icon="document-text"
            title="How your data is handled"
            subtitle="Captures live in the app sandbox until you export them"
            onPress={() => {
              Alert.alert(
                'Privacy in one paragraph',
                'AURA stores captures in its own private container on this device. Nothing is uploaded, shared or backed up automatically. Cloud AI effects are opt-in, require an explicit consent step, and can be revoked at any time.'
              );
            }}
          />
        </Card>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal visible={consentOpen} animationType="slide" transparent onRequestClose={() => setConsentOpen(false)}>
        <View style={styles.modalScrim}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.modal, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <View style={[styles.rowIcon, { backgroundColor: c.accentSoft, alignSelf: 'flex-start' }]}>
              <Ionicons name="cloud-upload" size={18} color={c.accent} />
            </View>
            <Text style={[styles.modalTitle, { color: c.text }]}>Consent for cloud processing</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {CONSENT_POINTS.map((b) => (
                <View key={b.t} style={styles.consentRow}>
                  <Ionicons name={b.icon} size={15} color={c.accentAlt} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.rowTitle, { color: c.text }]}>{b.t}</Text>
                    <Text style={[styles.rowSub, { color: c.textDim }]}>{b.d}</Text>
                  </View>
                </View>
              ))}
              <Banner
                text="Preview build: cloud models are simulated on-device, so no frame actually leaves your phone even with consent on."
                glyph="information-circle"
                style={{ marginHorizontal: 0, marginBottom: 8 }}
              />
            </ScrollView>
            <GradientButton
              label="I understand — enable cloud effects"
              icon="checkmark-circle"
              onPress={() => {
                grantCloudConsent();
                setConsentOpen(false);
                haptics.success();
              }}
              style={{ marginTop: 16 }}
            />
            <GhostButton label="Not now" onPress={() => setConsentOpen(false)} style={{ marginTop: 10 }} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2.2 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.9, marginTop: 2 },
  consentCard: { borderRadius: radius.xl, borderWidth: 1, padding: 16, overflow: 'hidden' },
  consentHead: { flexDirection: 'row', alignItems: 'center' },
  consentBody: { fontSize: 12.5, lineHeight: 19, marginTop: 12 },
  cardKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  cardSub: { fontSize: 11.5, marginBottom: 8, paddingHorizontal: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  smallBtn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 22, paddingBottom: 34 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginVertical: 14 },
  consentRow: { flexDirection: 'row', marginBottom: 14 },
});
