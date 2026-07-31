import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api, { BASE_URL } from '@/utils/api';

interface Voucher {
  tierId: string; tierName: string; elevation: string; emoji: string;
  voucherCode: string; goodieDescription?: string; goodiePicUrl?: string; claimedAt?: string;
}

const BADGE_ORDER = ['kumara_parvatha', 'kedarkantha', 'roopkund', 'trishul', 'nanda_devi', 'everester'];
const IMAGE_BASE = BASE_URL.replace(/\/api$/, '');
const BRAND = Colors.primary;

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(+d)) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Mirrors the web app's My Vouchers page (frontend/src/pages/MyVouchers.js)
 * — a lead/coordinator's own claimed badge vouchers, redeemable with an
 * admin. Read-only list; claiming itself happens from the Dashboard's
 * Trek Milestone Badges widget, same as web.
 */
export default function MyVouchersScreen() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedTier, setCopiedTier] = useState<string | null>(null);

  const load = () => {
    api.get('/badges/vouchers')
      .then(r => setVouchers((r.data || []).sort((a: Voucher, b: Voucher) =>
        BADGE_ORDER.indexOf(a.tierId) - BADGE_ORDER.indexOf(b.tierId))))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const copyCode = async (code: string, tierId: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedTier(tierId);
    setTimeout(() => setCopiedTier(null), 2000);
  };

  return (
    <AppShell scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}>
      <PageTitle title="My Vouchers" subtitle="Your earned badge goodies — redeem them with the admin." icon="gift-outline" />

      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={BRAND} /></View>
      ) : vouchers.length === 0 ? (
        <EmptyState icon="trophy-outline" title="No vouchers yet"
          message="Complete 5+ batches and claim your first Kumara Parvatha badge!" />
      ) : (
        <View style={{ gap: 14 }}>
          {vouchers.map(v => (
            <Panel key={v.tierId} padding={0} style={{ overflow: 'hidden' }}>
              <View style={s.top}>
                <Text style={s.emoji}>{v.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.tierName}>{v.tierName}</Text>
                  <Text style={s.elevation}>{v.elevation}</Text>
                </View>
                {!!v.claimedAt && <Text style={s.date}>{fmtDate(v.claimedAt)}</Text>}
              </View>

              <View style={s.body}>
                <View style={s.codeRow}>
                  <View>
                    <Text style={s.codeLabel}>Voucher Code</Text>
                    <Text style={s.codeValue}>{v.voucherCode}</Text>
                  </View>
                  <TouchableOpacity style={[s.copyBtn, copiedTier === v.tierId && s.copyBtnDone]} onPress={() => copyCode(v.voucherCode, v.tierId)}>
                    <Ionicons name={copiedTier === v.tierId ? 'checkmark' : 'copy-outline'} size={12} color={copiedTier === v.tierId ? Colors.success : BRAND} />
                    <Text style={[s.copyText, copiedTier === v.tierId && { color: Colors.success }]}>{copiedTier === v.tierId ? 'Copied!' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.goodieRow}>
                  {!!v.goodiePicUrl && (
                    <Image source={{ uri: v.goodiePicUrl.startsWith('http') ? v.goodiePicUrl : `${IMAGE_BASE}${v.goodiePicUrl}` }} style={s.goodieImg} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.goodieLabel}>Your Goodie</Text>
                    {v.goodieDescription
                      ? <Text style={s.goodieText}>{v.goodieDescription}</Text>
                      : <Text style={s.goodiePending}>Goodie details coming soon — the admin is finalising your reward. Stay tuned! 🎁</Text>}
                  </View>
                </View>
              </View>
            </Panel>
          ))}
        </View>
      )}
    </AppShell>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: BRAND },
  emoji: { fontSize: 28 },
  tierName: { fontSize: 15, fontWeight: '800', color: Colors.white },
  elevation: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  date: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  body: { padding: 16, gap: 14 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: `${BRAND}30`, backgroundColor: `${BRAND}0a`, borderRadius: 12, padding: 12 },
  codeLabel: { fontSize: 9, fontWeight: '800', color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  codeValue: { fontSize: 16, fontWeight: '900', color: BRAND, letterSpacing: 1.5 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 20, backgroundColor: `${BRAND}18` },
  copyBtnDone: { backgroundColor: Colors.successBg },
  copyText: { fontSize: 11, fontWeight: '800', color: BRAND },

  goodieRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  goodieImg: { width: 76, height: 76, borderRadius: 12, backgroundColor: Colors.gray100 },
  goodieLabel: { fontSize: 9, fontWeight: '800', color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  goodieText: { fontSize: 13, color: Colors.gray700, lineHeight: 19 },
  goodiePending: { fontSize: 12, color: Colors.gray400, fontStyle: 'italic', lineHeight: 18 },
});
