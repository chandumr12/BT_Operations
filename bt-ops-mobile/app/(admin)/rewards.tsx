import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Image, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, Chip, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api, { BASE_URL } from '@/utils/api';
import { describeError } from '@/utils/errors';

interface BadgeConfig {
  id: string; name: string; elevation: string; minBatches: number; emoji: string;
  goodieDescription?: string; goodiePicUrl?: string;
}
interface Voucher {
  userId: string; displayName: string; tierName: string; elevation: string; emoji: string;
  voucherCode: string; goodieDescription?: string; claimedAt?: string;
}

const TIER_TINTS = ['#fffbeb', '#f8fafc', '#fefce8', '#faf5ff', '#ecfeff', '#fff7ed'];
const IMAGE_BASE = BASE_URL.replace(/\/api$/, '');

const fmtDate = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(+d)) return '-';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Mirrors the web app's Rewards & Badges page (frontend/src/pages/
 * Rewards.js) — Badge Configuration (goodie description + photo per
 * milestone tier) and Claimed Vouchers. Super-Admin only, matching the
 * web route's allowedRoles.
 */
export default function RewardsScreen() {
  const [tab, setTab] = useState<'config' | 'claimed'>('config');

  const [configs, setConfigs] = useState<BadgeConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const r = await api.get('/badge-config');
      const list: BadgeConfig[] = r.data ?? [];
      setConfigs(list);
      setDrafts(prev => {
        const next = { ...prev };
        list.forEach(c => { if (next[c.id] === undefined) next[c.id] = c.goodieDescription ?? ''; });
        return next;
      });
      setConfigError(null);
    } catch (e: any) { setConfigError(describeError(e)); }
    finally { setLoadingConfig(false); }
  }, []);

  const loadVouchers = useCallback(async () => {
    try {
      const r = await api.get('/badges/vouchers/all');
      setVouchers(r.data ?? []);
      setVoucherError(null);
    } catch (e: any) { setVoucherError(describeError(e)); }
    finally { setLoadingVouchers(false); }
  }, []);

  useEffect(() => { loadConfig(); loadVouchers(); }, [loadConfig, loadVouchers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadConfig(), loadVouchers()]);
    setRefreshing(false);
  };

  const saveGoodie = async (tier: BadgeConfig) => {
    setSavingId(tier.id);
    try {
      await api.put(`/badge-config/${tier.id}`, { goodieDescription: drafts[tier.id] ?? '' });
      loadConfig();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save goodie description');
    } finally { setSavingId(null); }
  };

  const uploadPhoto = async (tier: BadgeConfig) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const form = new FormData();
      // @ts-ignore RN FormData file shape
      form.append('file', { uri: file.uri, name: file.name || 'photo.jpg', type: file.mimeType || 'image/jpeg' });
      setUploadingId(tier.id);
      await api.post(`/badge-config/${tier.id}/upload-image`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadConfig();
    } catch (e: any) {
      Alert.alert('Upload failed', e.response?.data?.detail ?? 'Could not upload photo');
    } finally { setUploadingId(null); }
  };

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <PageTitle
          icon="trophy-outline"
          title="Rewards & Badges"
          subtitle="Configure goodies for each milestone badge. Leads see the goodie only after they claim their badge."
        />

        <View style={s.tabRow}>
          <Chip label="Badge Configuration" active={tab === 'config'} onPress={() => setTab('config')} activeBg={Colors.primary} />
          <Chip label={`Claimed Vouchers (${vouchers.length})`} active={tab === 'claimed'} onPress={() => setTab('claimed')} activeBg={Colors.primary} />
        </View>

        {tab === 'config' && (
          <View style={{ marginTop: 14, gap: 12 }}>
            {configError && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{configError}</Text>
                </View>
              </Panel>
            )}

            {loadingConfig ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
            ) : configs.length === 0 ? (
              <EmptyState icon="trophy-outline" title="No badge tiers found" />
            ) : (
              configs.map((tier, i) => (
                <Panel key={tier.id} padding={16} style={[s.tierCard, { backgroundColor: TIER_TINTS[i % TIER_TINTS.length] }]}>
                  <View style={s.tierTop}>
                    <Text style={s.tierEmoji}>{tier.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tierName}>{tier.name}</Text>
                      <Text style={s.tierSub}>{tier.elevation} · {tier.minBatches} batches</Text>
                    </View>
                  </View>

                  <Text style={s.fieldLabel}>Goodie Description</Text>
                  <TextInput
                    style={s.textarea}
                    multiline
                    value={drafts[tier.id] ?? ''}
                    onChangeText={v => setDrafts(prev => ({ ...prev, [tier.id]: v }))}
                    placeholder="e.g. ₹500 Amazon voucher, BT branded backpack…"
                    placeholderTextColor={Colors.slate400}
                  />

                  <Text style={s.fieldLabel}>Goodie Photo</Text>
                  {!!tier.goodiePicUrl && (
                    <Image source={{ uri: IMAGE_BASE + tier.goodiePicUrl }} style={s.photoPreview} resizeMode="cover" />
                  )}
                  <TouchableOpacity style={s.uploadBtn} onPress={() => uploadPhoto(tier)} disabled={uploadingId === tier.id} activeOpacity={0.8}>
                    {uploadingId === tier.id ? (
                      <ActivityIndicator size="small" color={Colors.slate600} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={15} color={Colors.slate600} />
                        <Text style={s.uploadBtnText}>{tier.goodiePicUrl ? 'Replace Photo' : 'Upload Photo'}</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={s.saveBtn} onPress={() => saveGoodie(tier)} disabled={savingId === tier.id} activeOpacity={0.85}>
                    {savingId === tier.id ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={15} color={Colors.white} />
                        <Text style={s.saveBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </Panel>
              ))
            )}
          </View>
        )}

        {tab === 'claimed' && (
          <View style={{ marginTop: 14, gap: 10 }}>
            {voucherError && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{voucherError}</Text>
                </View>
              </Panel>
            )}

            {loadingVouchers ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
            ) : vouchers.length === 0 ? (
              <EmptyState icon="ticket-outline" title="No vouchers claimed yet" message="Claimed vouchers will appear here." />
            ) : (
              vouchers.map((v, i) => (
                <Panel key={`${v.userId}_${i}`} padding={14} style={{ gap: 6 }}>
                  <View style={s.voucherTop}>
                    <Text style={s.voucherLead}>{v.displayName || v.userId}</Text>
                    <Text style={s.voucherDate}>{fmtDate(v.claimedAt)}</Text>
                  </View>
                  <Text style={s.voucherBadge}>{v.emoji} {v.tierName}</Text>
                  <View style={s.voucherCodePill}>
                    <Text style={s.voucherCodeText}>{v.voucherCode}</Text>
                  </View>
                  <Text style={v.goodieDescription ? s.voucherGoodie : s.voucherGoodieEmpty}>
                    {v.goodieDescription || 'Not configured'}
                  </Text>
                </Panel>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },

  tabRow: { flexDirection: 'row', gap: 8, marginTop: 14 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  tierCard: { gap: 10 },
  tierTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierEmoji: { fontSize: 30 },
  tierName: { fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  tierSub: { fontSize: 12, color: Colors.slate500, marginTop: 2 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.slate600, marginTop: 2 },
  textarea: {
    minHeight: 64, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.slate200,
    backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: Colors.slate900, textAlignVertical: 'top',
  },

  photoPreview: { width: '100%', height: 130, borderRadius: 10, backgroundColor: Colors.slate100 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.slate300, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 11, backgroundColor: Colors.white },
  uploadBtnText: { fontSize: 12, fontWeight: '600', color: Colors.slate600 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.gradientBlueTo, borderRadius: 10, paddingVertical: 12 },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  voucherTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voucherLead: { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  voucherDate: { fontSize: 11, color: Colors.slate400 },
  voucherBadge: { fontSize: 13, fontWeight: '700', color: Colors.slate700 },
  voucherCodePill: { alignSelf: 'flex-start', backgroundColor: Colors.slate100, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  voucherCodeText: { fontFamily: 'Courier', fontSize: 11, fontWeight: '700', color: Colors.slate700 },
  voucherGoodie: { fontSize: 12, color: Colors.slate600 },
  voucherGoodieEmpty: { fontSize: 12, color: Colors.slate400, fontStyle: 'italic' },
});
