import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert, Linking,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { collection, getDocs, doc, updateDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, Chip, EmptyState } from '@/components/ui';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/utils/firebase';

interface VehicleUnit { type: string; count: number }
interface VehicleRow {
  id: string; batchCode?: string; packageCode?: string; packageName?: string;
  startDate?: string; endDate?: string; pax?: number; isPublic?: boolean;
  vehicles?: VehicleUnit[];
}
interface DriverSlot { vehicleType: string; slotIndex: number; driverName?: string; phone?: string; vehicleNo?: string }
interface DriverDoc { slots?: DriverSlot[] }

const WEB_BASE = 'https://bengaluru-trekkers-ops.web.app';

/** Mirrors frontend/src/pages/VehicleAllocation.js's VEHICLE_TYPES table. */
const VEHICLE_CAPACITY: Record<string, number> = {
  Dzire: 4, Ertiga: 5, '12-Seater TT': 11, '16-Seater TT': 13, '22-Seater TT': 17,
};
const VEHICLE_EMOJI: Record<string, string> = {
  Dzire: '🚗', Ertiga: '🚙', '12-Seater TT': '🚐', '16-Seater TT': '🚌', '22-Seater TT': '🚍',
};
const PKG_LABEL: Record<string, string> = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };
const PKG_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  K: { color: '#b45309', bg: '#fef3c7', border: '#f59e0b' },
  T: { color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6' },
  C: { color: '#047857', bg: '#dcfce7', border: '#10b981' },
};

const totalCapacity = (vehicles: VehicleUnit[] = []) =>
  vehicles.reduce((s, v) => s + (VEHICLE_CAPACITY[v.type] ?? 0) * (v.count || 0), 0);

/** One slot per physical vehicle unit — matches web's generateSlots(). */
const generateSlots = (vehicles: VehicleUnit[] = [], existing?: DriverDoc): DriverSlot[] => {
  const existingSlots = existing?.slots ?? [];
  const out: DriverSlot[] = [];
  vehicles.forEach(v => {
    for (let i = 0; i < (v.count || 0); i++) {
      const match = existingSlots.find(s => s.vehicleType === v.type && s.slotIndex === i);
      out.push(match ?? { vehicleType: v.type, slotIndex: i, driverName: '', phone: '', vehicleNo: '' });
    }
  });
  return out;
};

const fmtVehicles = (vehicles: VehicleUnit[] = []) =>
  vehicles.filter(v => v.count > 0).map(v => `${v.count} × ${v.type}`).join(' + ');

const fmtShortDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
};

const monthKey = (iso?: string) => (iso ?? '').slice(0, 7);
const monthLabel = (key: string) => {
  if (key === 'all') return 'All Months';
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

export default function VehicleAllocationScreen() {
  const { profile } = useAuth();

  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [drivers, setDrivers] = useState<Record<string, DriverDoc>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState('all');
  const [pkg, setPkg] = useState<'all' | string>('all');
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [slotForm, setSlotForm] = useState<DriverSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<'link' | 'whatsapp' | null>(null);

  const load = useCallback(async () => {
    try {
      const [vSnap, dSnap] = await Promise.all([
        getDocs(collection(firestore, 'vehicles')),
        getDocs(collection(firestore, 'vehicle_driver_details')),
      ]);
      setRows(vSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      const map: Record<string, DriverDoc> = {};
      dSnap.docs.forEach(d => { map[d.id] = d.data() as any; });
      setDrivers(map);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load vehicle data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  /* ── Months, derived from ALL rows, unfiltered ─────────────────────── */
  const months = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.startDate) set.add(monthKey(r.startDate)); });
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  /* ── Month-filtered set (used for package chip counts) ─────────────── */
  const monthFiltered = useMemo(
    () => (month === 'all' ? rows : rows.filter(r => monthKey(r.startDate) === month)),
    [rows, month]
  );

  /* ── Month + package filtered set (drives tiles, active/pax, sections) */
  const filtered = useMemo(
    () => (pkg === 'all' ? monthFiltered : monthFiltered.filter(r => r.packageCode === pkg)),
    [monthFiltered, pkg]
  );

  const activeRows = useMemo(() => filtered.filter(r => (r.pax ?? 0) > 0), [filtered]);
  const totalPax = useMemo(() => activeRows.reduce((s, r) => s + (r.pax ?? 0), 0), [activeRows]);

  const vehicleTotals = useMemo(() => {
    const t: Record<string, number> = {};
    activeRows.forEach(r => (r.vehicles ?? []).forEach(v => { t[v.type] = (t[v.type] ?? 0) + (v.count || 0); }));
    return t;
  }, [activeRows]);

  /* ── These two ignore month/package filters entirely, per web ──────── */
  const underCapacityCount = useMemo(
    () => rows.filter(r => (r.pax ?? 0) > 0 && totalCapacity(r.vehicles) < (r.pax ?? 0)).length,
    [rows]
  );
  const hiddenCount = useMemo(() => rows.filter(r => r.isPublic === false).length, [rows]);

  const pkgCounts = useMemo(() => ({
    all: monthFiltered.length,
    K: monthFiltered.filter(r => r.packageCode === 'K').length,
    T: monthFiltered.filter(r => r.packageCode === 'T').length,
    C: monthFiltered.filter(r => r.packageCode === 'C').length,
  }), [monthFiltered]);

  /* ── Date-grouped sections (exact startDate, not month) ─────────────── */
  const sections = useMemo(() => {
    const byDate: Record<string, VehicleRow[]> = {};
    filtered.forEach(r => {
      const key = r.startDate || 'TBD';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(r);
    });
    return Object.keys(byDate).sort().map(k => ({ title: k, data: byDate[k] }));
  }, [filtered]);

  /* ── Edit driver slots ───────────────────────────────────────────────── */
  const openEdit = (r: VehicleRow) => {
    setSlotForm(generateSlots(r.vehicles, drivers[r.id]));
    setEditing(r);
  };

  const setSlotField = (i: number, key: 'driverName' | 'phone' | 'vehicleNo', v: string) =>
    setSlotForm(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: v } : s));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'vehicle_driver_details', editing.id), {
        slots: slotForm, updatedAt: serverTimestamp(), updatedBy: profile?.displayName ?? profile?.uid ?? null,
      }, { merge: true });
      setDrivers(prev => ({ ...prev, [editing.id]: { slots: slotForm } }));
      setEditing(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save driver details');
    } finally { setSaving(false); }
  };

  const toggleHidden = async (r: VehicleRow) => {
    const nextPublic = r.isPublic === false ? true : false;
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, isPublic: nextPublic } : x));
    try { await updateDoc(doc(firestore, 'vehicles', r.id), { isPublic: nextPublic }); }
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not update'); load(); }
  };

  /* ── Header actions ──────────────────────────────────────────────────── */
  const livePreview = () => Linking.openURL(`${WEB_BASE}/vehicle-view`);

  const createSnapshot = async () => {
    const label = `Vehicle Schedule — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const ref = await addDoc(collection(firestore, 'vehicle_snapshots'), {
      label,
      createdAt: serverTimestamp(),
      createdBy: profile?.displayName ?? profile?.uid ?? null,
      vehicles: rows.filter(r => r.isPublic !== false),
    });
    return `${WEB_BASE}/vehicle-view?snap=${ref.id}`;
  };

  const copyShareLink = async () => {
    setSharing('link');
    try {
      const url = await createSnapshot();
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'Share link copied to clipboard.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create share link');
    } finally { setSharing(null); }
  };

  const shareWhatsApp = async () => {
    setSharing('whatsapp');
    try {
      const url = await createSnapshot();
      const text = encodeURIComponent(
        `🚌 *Vehicle Schedule — BT Ops*\n\nVehicle allocation for all upcoming trek batches:\n👉 ${url}`
      );
      const deep = `whatsapp://send?text=${text}`;
      const ok = await Linking.canOpenURL(deep);
      Linking.openURL(ok ? deep : `https://wa.me/?text=${text}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create share link');
    } finally { setSharing(null); }
  };

  return (
    <AppShell>
      <SectionList
        sections={sections}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <PageTitle
              icon="bus-outline"
              title="Vehicle Allocation"
              subtitle="Manage vehicle assignments and driver details for all batches"
            />

            <View style={s.headerBtnRow}>
              <TouchableOpacity style={s.outlineBtn} onPress={livePreview} activeOpacity={0.8}>
                <Ionicons name="open-outline" size={14} color={Colors.slate700} />
                <Text style={s.outlineBtnText}>Live Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.outlineBtn} onPress={copyShareLink} disabled={sharing === 'link'} activeOpacity={0.8}>
                {sharing === 'link' ? <ActivityIndicator size="small" color={Colors.slate600} /> : (
                  <>
                    <Ionicons name="copy-outline" size={14} color={Colors.slate700} />
                    <Text style={s.outlineBtnText}>Copy Share Link</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.whatsappBtn} onPress={shareWhatsApp} disabled={sharing === 'whatsapp'} activeOpacity={0.85}>
                {sharing === 'whatsapp' ? <ActivityIndicator size="small" color={Colors.white} /> : (
                  <>
                    <Ionicons name="logo-whatsapp" size={14} color={Colors.white} />
                    <Text style={s.whatsappBtnText}>Share WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {months.map(m => (
                <Chip key={m} label={monthLabel(m)} active={month === m} onPress={() => setMonth(m)} activeBg={Colors.gradientBlueTo} />
              ))}
            </ScrollView>

            <View style={s.tileGrid}>
              <VehicleTile emoji="🚗" label="Cars (Dzire/Ertiga)" value={(vehicleTotals['Dzire'] ?? 0) + (vehicleTotals['Ertiga'] ?? 0)} />
              <VehicleTile emoji="🚐" label="12-Seater TT" value={vehicleTotals['12-Seater TT'] ?? 0} />
              <VehicleTile emoji="🚌" label="16-Seater TT" value={vehicleTotals['16-Seater TT'] ?? 0} />
              <VehicleTile emoji="🚍" label="22-Seater TT" value={vehicleTotals['22-Seater TT'] ?? 0} />
            </View>

            <View style={s.statPillRow}>
              <StatPill value={activeRows.length} label="Active Batches" color={Colors.gradientBlueTo} bg="#eff6ff" />
              <StatPill value={totalPax} label="Total PAX" color="#7c3aed" bg="#f5f3ff" />
              <StatPill value={underCapacityCount} label="Under Capacity" color={Colors.danger} bg={Colors.dangerBg} />
              <StatPill value={hiddenCount} label="Hidden from Vendor" color="#b45309" bg="#fef3c7" />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <Chip label={`All (${pkgCounts.all})`} active={pkg === 'all'} onPress={() => setPkg('all')} activeBg={Colors.gradientBlueTo} />
              <Chip label={`Kedarnath 7D (${pkgCounts.K})`} active={pkg === 'K'} onPress={() => setPkg('K')} activeBg={Colors.gradientBlueTo} />
              <Chip label={`KBT 9D (${pkgCounts.T})`} active={pkg === 'T'} onPress={() => setPkg('T')} activeBg={Colors.gradientBlueTo} />
              <Chip label={`Chardham 11D (${pkgCounts.C})`} active={pkg === 'C'} onPress={() => setPkg('C')} activeBg={Colors.gradientBlueTo} />
            </ScrollView>

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => {
          const d = section.title === 'TBD' ? null : new Date(section.title);
          const groupPax = section.data.reduce((sum, r) => sum + (r.pax ?? 0), 0);
          return (
            <View style={s.sectionHeader}>
              <Text style={s.sectionDay}>{d && !isNaN(+d) ? d.getDate() : '—'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionWeekday}>
                  {d && !isNaN(+d) ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : 'TBD'}
                </Text>
                <Text style={s.sectionMonth}>
                  {d && !isNaN(+d) ? d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}
                </Text>
              </View>
              {groupPax > 0 && (
                <View style={s.totalPill}>
                  <Text style={s.totalPillText}>TOTAL {groupPax}</Text>
                </View>
              )}
            </View>
          );
        }}
        renderItem={({ item: r }) => {
          const slots = generateSlots(r.vehicles, drivers[r.id]);
          const filled = slots.filter(sl => sl.driverName?.trim()).length;
          const total = slots.length;
          const driverColor = total === 0 ? Colors.slate400 : filled === total ? Colors.success : filled === 0 ? Colors.slate400 : '#b45309';
          const driverIcon = total === 0 ? 'remove-circle-outline' : filled === total ? 'checkmark-circle' : filled === 0 ? 'ellipse-outline' : 'alert-circle';
          const pc = PKG_COLOR[r.packageCode ?? ''] ?? { color: Colors.slate600, bg: Colors.slate100, border: Colors.slate300 };
          const isHidden = r.isPublic === false;
          const under = (r.pax ?? 0) > 0 && totalCapacity(r.vehicles) < (r.pax ?? 0);

          return (
            <Panel padding={14} style={[s.card, { borderLeftColor: pc.border }, isHidden && { opacity: 0.6 }]}>
              <View style={s.cardTop}>
                <Text style={s.batchCode}>{r.batchCode ?? r.id}</Text>
                {isHidden && (
                  <View style={s.hiddenPill}>
                    <Ionicons name="eye-off-outline" size={10} color={Colors.slate500} />
                    <Text style={s.hiddenText}>Hidden</Text>
                  </View>
                )}
                <Text style={s.pax}>{r.pax || '—'}{r.pax ? ' PAX' : ''}</Text>
              </View>

              {!!r.packageCode && (
                <View style={[s.pkgPill, { backgroundColor: pc.bg }]}>
                  <Text style={[s.pkgText, { color: pc.color }]}>{r.packageName || PKG_LABEL[r.packageCode] || r.packageCode}</Text>
                </View>
              )}

              <Text style={s.dateRange}>{fmtShortDate(r.startDate)} → {fmtShortDate(r.endDate)}</Text>

              {!!r.vehicles?.length && (
                <View style={s.vehicleRow}>
                  <Ionicons name="bus-outline" size={13} color={Colors.slate400} />
                  <Text style={s.vehicleText}>{fmtVehicles(r.vehicles)}</Text>
                  {under && (
                    <View style={s.underBadge}><Text style={s.underBadgeText}>UNDER {(r.pax ?? 0) - totalCapacity(r.vehicles)}</Text></View>
                  )}
                </View>
              )}

              <View style={[s.driverRow, { backgroundColor: driverColor + '1A' }]}>
                <Ionicons name={driverIcon as any} size={13} color={driverColor} />
                <Text style={[s.driverText, { color: driverColor }]}>
                  {filled}/{total} driver{total !== 1 ? 's' : ''} assigned
                </Text>
              </View>

              {slots.map((sl, i) => (
                <View key={i} style={s.slotRow}>
                  <Text style={{ fontSize: 13 }}>{VEHICLE_EMOJI[sl.vehicleType] ?? '🚐'}</Text>
                  {sl.driverName?.trim() ? (
                    <Text style={s.slotText} numberOfLines={1}>
                      {sl.driverName}{sl.vehicleNo ? ` · ${sl.vehicleNo}` : ''}{sl.phone ? ` · ${sl.phone}` : ''}
                    </Text>
                  ) : (
                    <Text style={s.slotTextEmpty}>Not assigned</Text>
                  )}
                </View>
              ))}

              <View style={s.actions}>
                <TouchableOpacity style={s.action} onPress={() => openEdit(r)} activeOpacity={0.7}>
                  <Ionicons name="create-outline" size={14} color={Colors.gradientBlueTo} />
                  <Text style={[s.actionText, { color: Colors.gradientBlueTo }]}>Edit Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => toggleHidden(r)} activeOpacity={0.7}>
                  <Ionicons name={isHidden ? 'eye-outline' : 'eye-off-outline'} size={14} color={Colors.slate600} />
                  <Text style={s.actionText}>{isHidden ? 'Show' : 'Hide'}</Text>
                </TouchableOpacity>
              </View>
            </Panel>
          );
        }}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="bus-outline" title="No vehicle allocations" message="Allocations created on the web app appear here." />
        }
      />

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.editSafe}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
            </TouchableOpacity>
            <Text style={s.editTitle}>Driver Details — {editing?.batchCode ?? ''}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {slotForm.map((sl, i) => (
              <Panel key={i} padding={12} style={{ marginBottom: 12, gap: 8 }}>
                <Text style={s.slotFormTitle}>{VEHICLE_EMOJI[sl.vehicleType] ?? '🚐'} {sl.vehicleType} #{sl.slotIndex + 1}</Text>
                <View style={s.field}>
                  <Text style={s.label}>Driver name</Text>
                  <TextInput style={s.input} value={sl.driverName ?? ''} onChangeText={v => setSlotField(i, 'driverName', v)} placeholderTextColor={Colors.slate400} />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>Phone</Text>
                  <TextInput style={s.input} keyboardType="phone-pad" value={sl.phone ?? ''} onChangeText={v => setSlotField(i, 'phone', v)} placeholderTextColor={Colors.slate400} />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>Vehicle number</Text>
                  <TextInput style={s.input} value={sl.vehicleNo ?? ''} onChangeText={v => setSlotField(i, 'vehicleNo', v)} placeholderTextColor={Colors.slate400} />
                </View>
              </Panel>
            ))}
            <Button title="Save Details" onPress={save} loading={saving} />
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    </AppShell>
  );
}

function VehicleTile({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <View style={s.vTile}>
      <Text style={s.vTileEmoji}>{emoji}</Text>
      <View>
        <Text style={s.vTileValue}>{value}</Text>
        <Text style={s.vTileLabel}>{label}</Text>
      </View>
    </View>
  );
}

function StatPill({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[s.statPill, { backgroundColor: bg }]}>
      <Text style={[s.statPillValue, { color }]}>{value}</Text>
      <Text style={[s.statPillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },

  headerBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.slate200, backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  outlineBtnText: { fontSize: 12, fontWeight: '700', color: Colors.slate700 },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.success, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  whatsappBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  chipRow: { gap: 7, paddingRight: 16 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vTile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate100, borderRadius: 14, padding: 12 },
  vTileEmoji: { fontSize: 24 },
  vTileValue: { fontSize: 20, fontWeight: '900', color: Colors.slate900 },
  vTileLabel: { fontSize: 11, color: Colors.slate500, fontWeight: '600', marginTop: 1 },

  statPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statPill: { flexGrow: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statPillValue: { fontSize: 16, fontWeight: '900' },
  statPillLabel: { fontSize: 11, fontWeight: '700' },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 8 },
  sectionDay:     { fontSize: 26, fontWeight: '900', color: Colors.slate900 },
  sectionWeekday: { fontSize: 13, fontWeight: '800', color: Colors.slate700 },
  sectionMonth:   { fontSize: 11, color: Colors.slate400 },
  totalPill:      { backgroundColor: Colors.slate900, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  totalPillText:  { fontSize: 11, fontWeight: '800', color: Colors.white },

  card:      { gap: 6, marginBottom: 10, borderLeftWidth: 3 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batchCode: { fontSize: 15, fontWeight: '800', color: Colors.slate900, flex: 1 },
  pax:       { fontSize: 13, fontWeight: '800', color: Colors.slate700 },
  hiddenPill:{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.slate100, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hiddenText:{ fontSize: 10, fontWeight: '600', color: Colors.slate500 },

  pkgPill:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pkgText:   { fontSize: 11, fontWeight: '700' },
  dateRange: { fontSize: 12, color: Colors.slate500 },

  vehicleRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.slate50, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, flexWrap: 'wrap' },
  vehicleText: { fontSize: 12, color: Colors.slate700, fontWeight: '600' },
  underBadge:  { marginLeft: 'auto', backgroundColor: Colors.danger, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  underBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  driverRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  driverText: { fontSize: 12, fontWeight: '700' },

  slotRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 2 },
  slotText: { fontSize: 11, color: Colors.slate600, flex: 1 },
  slotTextEmpty: { fontSize: 11, color: Colors.slate400, fontStyle: 'italic', flex: 1 },

  actions:    { flexDirection: 'row', gap: 16, marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.slate100, paddingTop: 10 },
  action:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '600', color: Colors.slate600 },

  editSafe:   { flex: 1, backgroundColor: Colors.slate50 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle:  { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.slate900 },
  slotFormTitle: { fontSize: 13, fontWeight: '800', color: Colors.slate900 },
  field:      { gap: 6 },
  label:      { fontSize: 12, fontWeight: '600', color: Colors.slate700 },
  input:      { height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 12, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
});
