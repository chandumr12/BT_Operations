import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, StatCard, Panel, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/utils/firebase';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';
import {
  PLACES, PKG, ROOM_TYPES, ROOM_TYPE_COLORS,
  Stay, slugify, statusClass, fmtShort,
} from '@/components/hotelStays/HotelStayShared';
import { EntryFormModal, EntryFormValue, fromStay } from '@/components/hotelStays/EntryFormModal';
import { AddBatchModal, BatchOps } from '@/components/hotelStays/AddBatchModal';

const WEB_BASE = 'https://bengaluru-trekkers-ops.web.app';

function groupByDate(stays: Stay[]) {
  const map: Record<string, { date: string; day: number; dayName: string; month: string; year: number; batches: Stay[] }> = {};
  for (const st of stays) {
    if (!map[st.date]) {
      const d = new Date(st.date + 'T00:00:00');
      map[st.date] = {
        date: st.date, day: d.getDate(),
        dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        year: d.getFullYear(), batches: [],
      };
    }
    map[st.date].batches.push(st);
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

type ViewMode = 'cards' | 'batches';

export default function HotelStaysScreen() {
  const { profile } = useAuth();
  const isAdmin = ['Super Admin', 'Operations Manager'].includes(profile?.role ?? '');

  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>('cards');
  const [place, setPlace] = useState(PLACES[0]);
  const [showPast, setShowPast] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [entryModal, setEntryModal] = useState<{ initial: EntryFormValue | null } | null>(null);
  const [batchModal, setBatchModal] = useState<{ mode: 'create' | 'edit'; code?: string; serial?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchCode, setBatchCode] = useState('');

  const load = useCallback(async () => {
    try { const r = await api.get('/hotel-stays'); setStays(r.data ?? []); setError(null); }
    catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const placeStays = useMemo(() => stays.filter(st => st.place === place), [stays, place]);
  const allGrouped = useMemo(() => groupByDate(placeStays), [placeStays]);
  const grouped = useMemo(() => allGrouped.filter(d => new Date(d.date + 'T00:00:00') >= today), [allGrouped]);
  const pastGrouped = useMemo(() => allGrouped.filter(d => new Date(d.date + 'T00:00:00') < today).reverse(), [allGrouped]);

  const totalPaxPlace = placeStays.reduce((sum, st) => sum + (st.pax || 0), 0);
  const totalDSPlace = placeStays.reduce((sum, st) => sum + ((st.doubleSharingPairs?.length) || st.doubleSharing || 0), 0);

  /* ── batches view: group by code, then serial ────────────────────── */
  const codesPresent = useMemo(() => {
    const set = new Set(stays.map(st => st.code).filter(Boolean));
    return Array.from(set).sort();
  }, [stays]);
  useEffect(() => { if (!batchCode && codesPresent.length) setBatchCode(codesPresent[0]); }, [codesPresent, batchCode]);

  const batchList = useMemo(() => {
    const filtered = stays.filter(st => st.code === batchCode);
    const serials = Array.from(new Set(filtered.map(st => st.serial)));
    return serials.map(serial => {
      const entries = filtered.filter(st => st.serial === serial).sort((a, b) => a.date.localeCompare(b.date));
      const start = entries.reduce((m, e) => e.date < m ? e.date : m, entries[0]?.date ?? '9999');
      const end = entries.reduce((m, e) => e.date > m ? e.date : m, entries[0]?.date ?? '0000');
      const isPast = new Date(start + 'T00:00:00') < today;
      const first = entries[0];
      return {
        serial, entries, start, end, isPast,
        pax: first?.pax ?? 0, male: first?.male ?? 0, female: first?.female ?? 0,
        dsCount: (first?.doubleSharingPairs?.length) || first?.doubleSharing || 0,
      };
    }).sort((a, b) => a.isPast !== b.isPast ? (a.isPast ? 1 : -1) : (a.isPast ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
  }, [stays, batchCode]);

  /* ── CRUD ─────────────────────────────────────────────────────────── */
  // Tracks exactly which Stay record is being edited (identity, not a
  // field-based re-match) so saveEntry() knows whether to PATCH or POST.
  const [editingEntryRef, setEditingEntryRef] = useState<Stay | null>(null);
  const openEdit = (st: Stay) => { setEditingEntryRef(st); setEntryModal({ initial: fromStay(st) }); };
  const openAdd = () => { setEditingEntryRef(null); setEntryModal({ initial: null }); };

  const saveEntry = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingEntryRef) await api.patch(`/hotel-stays/${editingEntryRef.id}`, payload);
      else await api.post('/hotel-stays', payload);
      setEntryModal(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save entry');
    } finally { setSaving(false); }
  };

  const deleteEntry = (st: Stay) => {
    confirmAction('Delete entry?', `Remove Batch ${st.serial} (${st.status}) on ${st.date}?`, 'Delete', async () => {
      try { await api.delete(`/hotel-stays/${st.id}`); load(); }
      catch { Alert.alert('Error', 'Could not delete entry'); }
    });
  };

  const saveBatchOps = async (ops: BatchOps) => {
    setSaving(true);
    try {
      await Promise.all([
        ...ops.toCreate.map(e => api.post('/hotel-stays', e)),
        ...ops.toUpdate.map(u => api.patch(`/hotel-stays/${u.id}`, u.data)),
        ...ops.toDelete.map(id => api.delete(`/hotel-stays/${id}`)),
      ]);
      setBatchModal(null);
      load();
    } catch {
      Alert.alert('Error', 'Could not save batch');
    } finally { setSaving(false); }
  };

  const deleteBatch = (serial: number, entries: Stay[]) => {
    confirmAction('Delete batch?', `Batch ${serial} and all its ${entries.length} night(s) will be removed.`, 'Delete', async () => {
      try {
        await Promise.all(entries.map(e => api.delete(`/hotel-stays/${e.id}`)));
        load();
      } catch { Alert.alert('Error', 'Could not delete batch'); }
    });
  };

  /* ── Vendor link ──────────────────────────────────────────────────── */
  const copyVendorLink = async (p: string) => {
    setCopied(p + '_loading');
    try {
      const res = await api.get('/hotel-stays');
      const snapRef = await addDoc(collection(firestore, 'stay_snapshots'), {
        label: `Hotel Schedule — ${p} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        place: p, createdAt: serverTimestamp(),
        createdBy: profile?.displayName ?? 'Admin',
        stays: res.data ?? [],
      });
      const url = `${WEB_BASE}/stay-view?place=${slugify(p)}&snap=${snapRef.id}`;
      await Clipboard.setStringAsync(url);
      setCopied(p);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      Alert.alert('Error', 'Failed to create snapshot');
      setCopied(null);
    }
  };
  const openVendorView = (p: string) => Linking.openURL(`${WEB_BASE}/stay-view?place=${slugify(p)}`);

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <PageTitle
          icon="business-outline"
          title="Hotel Stay Planner"
          subtitle="Manage stay schedules and share with vendors"
        />

        {isAdmin && (
          <View style={s.headerBtnRow}>
            <View style={s.viewToggle}>
              <TouchableOpacity style={[s.viewBtn, view === 'cards' && s.viewBtnActive]} onPress={() => setView('cards')}>
                <Ionicons name="grid-outline" size={13} color={view === 'cards' ? Colors.white : Colors.slate600} />
                <Text style={[s.viewBtnText, view === 'cards' && s.viewBtnTextActive]}>Cards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.viewBtn, view === 'batches' && s.viewBtnActive]} onPress={() => setView('batches')}>
                <Ionicons name="layers-outline" size={13} color={view === 'batches' ? Colors.white : Colors.slate600} />
                <Text style={[s.viewBtnText, view === 'batches' && s.viewBtnTextActive]}>Batches</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.outlineBtn} onPress={() => setBatchModal({ mode: 'create' })} activeOpacity={0.85}>
              <Ionicons name="add" size={14} color="#4338ca" />
              <Text style={s.outlineBtnText}>Add New Batch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.solidBtn} onPress={openAdd} activeOpacity={0.85}>
              <Ionicons name="add" size={14} color={Colors.white} />
              <Text style={s.solidBtnText}>Add Stay Entry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.grid}>
          <View style={s.gridItem}><StatCard label="Active Days" value={grouped.length} icon="calendar-outline" tint="#6366f1" /></View>
          <View style={s.gridItem}><StatCard label="Total Pax" value={totalPaxPlace} icon="people-outline" tint={Colors.success} /></View>
          <View style={s.gridItem}><StatCard label="Double Rooms" value={totalDSPlace} icon="bed-outline" tint="#8b5cf6" /></View>
          <View style={s.gridItem}><StatCard label="Entries" value={placeStays.length} icon="business-outline" tint={Colors.warning} /></View>
        </View>

        {error && (
          <Panel style={s.errorPanel} padding={14}>
            <View style={s.errorRow}>
              <Ionicons name="warning-outline" size={18} color={Colors.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          </Panel>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : view === 'batches' ? (
          <View style={{ gap: 10 }}>
            {codesPresent.length === 0 ? (
              <EmptyState icon="layers-outline" title="No batches yet" message="Add a stay entry or a new batch to get started." />
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                  {codesPresent.map(c => (
                    <TouchableOpacity key={c} style={[s.codeChip, batchCode === c && s.codeChipActive]} onPress={() => setBatchCode(c)}>
                      <Text style={[s.codeChipText, batchCode === c && s.codeChipTextActive]}>{c} · {PKG[c] ?? 'Custom'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {batchList.length === 0 ? (
                  <EmptyState icon="layers-outline" title={`No batches for ${batchCode}`} />
                ) : (
                  batchList.map(b => (
                    <Panel key={b.serial} padding={14} style={b.isPast ? { opacity: 0.6 } : undefined}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.batchTitle}>Batch {b.serial}{b.isPast ? ' · Past' : ''}</Text>
                          <Text style={s.batchDates}>{fmtShort(b.start)} → {fmtShort(b.end)} · {b.entries.length} night{b.entries.length !== 1 ? 's' : ''}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            <View style={s.mfPill}><Text style={s.mfPillText}>{b.pax} pax</Text></View>
                            {b.male > 0 && <View style={[s.mfPill, { backgroundColor: '#dbeafe' }]}><Text style={[s.mfPillText, { color: '#1d4ed8' }]}>{b.male}M</Text></View>}
                            {b.female > 0 && <View style={[s.mfPill, { backgroundColor: '#fce7f3' }]}><Text style={[s.mfPillText, { color: '#be185d' }]}>{b.female}F</Text></View>}
                            {b.dsCount > 0 && <View style={[s.mfPill, { backgroundColor: '#f3e8ff' }]}><Text style={[s.mfPillText, { color: '#7c3aed' }]}>{b.dsCount} DS room{b.dsCount !== 1 ? 's' : ''}</Text></View>}
                          </View>
                        </View>
                        {isAdmin && (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity style={s.iconBtn} onPress={() => setBatchModal({ mode: 'edit', code: batchCode, serial: b.serial })}>
                              <Ionicons name="pencil" size={12} color={Colors.slate600} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={() => deleteBatch(b.serial, b.entries)}>
                              <Ionicons name="trash" size={12} color={Colors.danger} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </Panel>
                  ))
                )}
              </>
            )}
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {PLACES.map(p => (
                <TouchableOpacity key={p} style={[s.placeTab, place === p && s.placeTabActive]} onPress={() => setPlace(p)}>
                  <Text style={[s.placeTabText, place === p && s.placeTabTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.vendorRow}>
              <Text style={s.vendorLabel}>Vendor link for {place}:</Text>
              <TouchableOpacity
                style={[s.vendorBtn, copied === place && s.vendorBtnDone]}
                onPress={() => copyVendorLink(place)}
                disabled={copied === place + '_loading'}
              >
                <Ionicons name={copied === place ? 'checkmark' : 'copy-outline'} size={11} color={copied === place ? '#047857' : Colors.slate600} />
                <Text style={[s.vendorBtnText, copied === place && { color: '#047857' }]}>
                  {copied === place ? 'Copied!' : copied === place + '_loading' ? 'Creating…' : 'Copy link'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.vendorBtn} onPress={() => openVendorView(place)}>
                <Ionicons name="open-outline" size={11} color={Colors.slate600} />
                <Text style={s.vendorBtnText}>Preview</Text>
              </TouchableOpacity>
              {pastGrouped.length > 0 && (
                <TouchableOpacity style={[s.pastBtn, showPast && s.pastBtnActive]} onPress={() => setShowPast(p => !p)}>
                  <Ionicons name={showPast ? 'arrow-up' : 'arrow-down'} size={11} color={showPast ? '#b45309' : Colors.slate600} />
                  <Text style={[s.vendorBtnText, showPast && { color: '#b45309' }]}>{showPast ? 'Hide past' : `Past dates (${pastGrouped.length})`}</Text>
                </TouchableOpacity>
              )}
            </View>

            {grouped.length === 0 && pastGrouped.length === 0 ? (
              <EmptyState icon="business-outline" title={`No entries for ${place} yet`} message="Add a stay entry to get started." />
            ) : (
              <View style={{ gap: 10 }}>
                {grouped.length === 0 && <Text style={s.noneText}>No upcoming dates for {place}.</Text>}
                {grouped.map(d => <DateGroup key={d.date} dayData={d} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteEntry} />)}
                {showPast && pastGrouped.map(d => <DateGroup key={d.date} dayData={d} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteEntry} />)}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {entryModal && (
        <EntryFormModal
          initial={entryModal.initial}
          defaultPlace={place}
          saving={saving}
          onClose={() => setEntryModal(null)}
          onSave={saveEntry}
        />
      )}

      {batchModal && (
        <AddBatchModal
          mode={batchModal.mode}
          code={batchModal.code}
          serial={batchModal.serial}
          existingEntries={batchModal.mode === 'edit' ? stays.filter(st => st.code === batchModal.code && st.serial === batchModal.serial) : undefined}
          nextSerial={(stays.filter(st => st.code === (batchModal.code ?? codesPresent[0] ?? 'K')).reduce((m, st) => Math.max(m, st.serial), 0) || 0) + 1}
          saving={saving}
          onCancel={() => setBatchModal(null)}
          onSave={saveBatchOps}
        />
      )}
    </AppShell>
  );
}

function DateGroup({ dayData, isAdmin, onEdit, onDelete }: {
  dayData: { date: string; day: number; dayName: string; month: string; year: number; batches: Stay[] };
  isAdmin: boolean; onEdit: (st: Stay) => void; onDelete: (st: Stay) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = dayData.batches.reduce((sum, b) => sum + (b.pax || 0), 0);
  return (
    <Panel padding={0} style={{ overflow: 'hidden' }}>
      <TouchableOpacity style={s.dgHeader} onPress={() => setOpen(p => !p)} activeOpacity={0.7}>
        <View style={s.dgDay}><Text style={s.dgDayNum}>{dayData.day}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.dgDayName}>{dayData.dayName}</Text>
          <Text style={s.dgMonth}>{dayData.month} {dayData.year}</Text>
        </View>
        <View style={s.dgTotal}><Text style={s.dgTotalText}>TOTAL {total}</Text></View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.slate400} />
      </TouchableOpacity>
      {open && (
        <View style={{ padding: 10, gap: 8 }}>
          {dayData.batches.map(b => <BatchCard key={b.id} b={b} isAdmin={isAdmin} onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} />)}
        </View>
      )}
    </Panel>
  );
}

function BatchCard({ b, isAdmin, onEdit, onDelete }: { b: Stay; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const [dsOpen, setDsOpen] = useState(false);
  const [srOpen, setSrOpen] = useState<Record<string, boolean>>({});
  const c = statusClass(b.status);
  const pkgName = PKG[b.code] ?? b.packageName ?? b.code ?? '';

  const pairs = b.doubleSharingPairs ?? [];
  const dsCount = pairs.length || b.doubleSharing || 0;
  const dsM = pairs.reduce((n, p) => n + (p.gender1 === 'M' ? 1 : 0) + (p.gender2 === 'M' ? 1 : 0), 0);
  const dsF = pairs.reduce((n, p) => n + (p.gender1 === 'F' ? 1 : 0) + (p.gender2 === 'F' ? 1 : 0), 0);
  const srRooms = b.sharingRooms ?? [];
  const srByType = ROOM_TYPES.map(t => ({ ...t, rooms: srRooms.filter(r => r.type === t.value) })).filter(t => t.rooms.length > 0);

  return (
    <View style={[s.bcCard, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[s.bcAccent, { backgroundColor: c.accent }]} />
      <View style={s.bcHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.bcSerial}>Batch {b.serial}</Text>
          <View style={[s.bcStatusPill, { backgroundColor: c.accent }]}>
            <Text style={s.bcStatusText}>{b.status === 'CHECK-IN' ? 'CHECK-IN' : b.status === 'CHECK-OUT' ? 'CHECK-OUT' : '1 NIGHT'}</Text>
          </View>
          <Text style={s.bcPkg}>{b.code} · {pkgName}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[s.bcPax, { color: c.accent }]}>{b.pax}</Text>
          <Text style={s.bcPaxLabel}>pax</Text>
          {isAdmin && (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
              <TouchableOpacity onPress={onEdit} hitSlop={6}><Ionicons name="pencil" size={12} color={Colors.slate400} /></TouchableOpacity>
              <TouchableOpacity onPress={onDelete} hitSlop={6}><Ionicons name="trash" size={12} color={Colors.slate400} /></TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {(b.male || b.female) ? (
        <View style={s.bcMFRow}>
          <Text style={s.bcMFLabel}>TOTAL</Text>
          {!!b.male && <View style={[s.mfPill, { backgroundColor: '#dbeafe' }]}><Text style={[s.mfPillText, { color: '#1d4ed8' }]}>{b.male}M</Text></View>}
          {!!b.female && <View style={[s.mfPill, { backgroundColor: '#fce7f3' }]}><Text style={[s.mfPillText, { color: '#be185d' }]}>{b.female}F</Text></View>}
        </View>
      ) : null}

      {dsCount > 0 && (
        <View style={s.bcSection}>
          <TouchableOpacity style={s.bcSectionHeader} onPress={() => setDsOpen(v => !v)}>
            <Text style={s.bcSectionTitle}>🛏 {dsCount} double {dsCount === 1 ? 'room' : 'rooms'}</Text>
            {pairs.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <View style={[s.mfPillSm, { backgroundColor: '#dbeafe' }]}><Text style={[s.mfPillSmText, { color: '#1d4ed8' }]}>{dsM}M</Text></View>
                <View style={[s.mfPillSm, { backgroundColor: '#fce7f3' }]}><Text style={[s.mfPillSmText, { color: '#be185d' }]}>{dsF}F</Text></View>
              </View>
            )}
            <Ionicons name={dsOpen ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.slate400} />
          </TouchableOpacity>
          {dsOpen && pairs.map((pair, idx) => (
            <View key={idx} style={s.bcRoomDetail}>
              <Text style={s.bcRoomDetailLabel}>Room {idx + 1}</Text>
              {[{ name: pair.name1, gender: pair.gender1 }, { name: pair.name2, gender: pair.gender2 }].map((p, pi) => (
                <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View style={[s.genderDot, { backgroundColor: p.gender === 'M' ? '#dbeafe' : '#fce7f3' }]}>
                    <Text style={[s.genderDotText, { color: p.gender === 'M' ? '#1d4ed8' : '#be185d' }]}>{p.gender}</Text>
                  </View>
                  <Text style={s.bcPersonName}>{p.name || '—'}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {srByType.map(({ value, label, rooms }) => {
        const tc = ROOM_TYPE_COLORS[value];
        const isOpen = srOpen[value];
        return (
          <View key={value} style={[s.bcSection, { borderColor: tc.border }]}>
            <TouchableOpacity style={s.bcSectionHeader} onPress={() => setSrOpen(p => ({ ...p, [value]: !p[value] }))}>
              <Text style={[s.bcSectionTitle, { color: tc.title }]}>🏠 {rooms.length} {value === 'dorm' ? 'dorm' : `${value}-sharing`} {rooms.length === 1 ? 'room' : 'rooms'}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.slate400} />
            </TouchableOpacity>
            {isOpen && rooms.map((room, ri) => (
              <View key={ri} style={s.bcRoomDetail}>
                <Text style={[s.bcRoomDetailLabel, { color: tc.title }]}>{label} · Room {ri + 1}</Text>
                {room.people.map((p, pi) => (
                  <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <View style={[s.genderDot, { backgroundColor: p.gender === 'M' ? '#dbeafe' : '#fce7f3' }]}>
                      <Text style={[s.genderDotText, { color: p.gender === 'M' ? '#1d4ed8' : '#be185d' }]}>{p.gender}</Text>
                    </View>
                    <Text style={s.bcPersonName}>{p.name || '—'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  headerBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  viewToggle: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: Colors.slate200 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: Colors.white },
  viewBtnActive: { backgroundColor: '#4f46e5' },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: Colors.slate600 },
  viewBtnTextActive: { color: Colors.white },

  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#c7d2fe', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, backgroundColor: '#eef2ff' },
  outlineBtnText: { fontSize: 12, fontWeight: '700', color: '#4338ca' },
  solidBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  solidBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  chipRow: { gap: 7, paddingRight: 16 },
  placeTab: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200 },
  placeTabActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  placeTabText: { fontSize: 12, fontWeight: '600', color: Colors.slate500 },
  placeTabTextActive: { color: '#4338ca', fontWeight: '700' },

  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  vendorLabel: { fontSize: 11.5, color: Colors.slate500, fontWeight: '600' },
  vendorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  vendorBtnDone: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  vendorBtnText: { fontSize: 10.5, fontWeight: '600', color: Colors.slate600 },
  pastBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, marginLeft: 'auto' },
  pastBtnActive: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },

  noneText: { fontSize: 12.5, color: Colors.slate400, textAlign: 'center', paddingVertical: 12 },

  codeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200 },
  codeChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  codeChipText: { fontSize: 12, fontWeight: '700', color: Colors.slate600 },
  codeChipTextActive: { color: Colors.white },

  batchTitle: { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  batchDates: { fontSize: 11.5, color: Colors.slate400, marginTop: 2 },
  mfPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: Colors.slate100 },
  mfPillText: { fontSize: 10.5, fontWeight: '700', color: Colors.slate600 },
  iconBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.slate50, borderWidth: 1, borderColor: Colors.slate200, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },

  dgHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: Colors.slate50, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  dgDay: { width: 34, alignItems: 'center' },
  dgDayNum: { fontSize: 22, fontWeight: '800', color: '#1e3a5f' },
  dgDayName: { fontSize: 13, fontWeight: '700', color: Colors.slate700 },
  dgMonth: { fontSize: 11, color: Colors.slate400 },
  dgTotal: { backgroundColor: '#1e3a5f', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dgTotalText: { fontSize: 11, fontWeight: '800', color: Colors.white },

  bcCard: { borderWidth: 2, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  bcAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  bcHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 10, paddingTop: 10, paddingBottom: 6, gap: 8 },
  bcSerial: { fontSize: 13, fontWeight: '800', color: Colors.slate900 },
  bcStatusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  bcStatusText: { fontSize: 9.5, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },
  bcPkg: { fontSize: 10.5, color: Colors.slate500, fontStyle: 'italic', marginTop: 4 },
  bcPax: { fontSize: 24, fontWeight: '900', lineHeight: 26 },
  bcPaxLabel: { fontSize: 8.5, color: Colors.slate400, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  bcMFRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingBottom: 8, flexWrap: 'wrap' },
  bcMFLabel: { fontSize: 9.5, fontWeight: '800', color: Colors.slate400, textTransform: 'uppercase' },
  mfPillSm: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  mfPillSmText: { fontSize: 9.5, fontWeight: '800' },

  bcSection: { marginHorizontal: 10, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e9d5ff', backgroundColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  bcSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  bcSectionTitle: { fontSize: 11, fontWeight: '700', color: '#7c3aed', flex: 1 },
  bcRoomDetail: { paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  bcRoomDetailLabel: { fontSize: 9, fontWeight: '800', color: '#a855f7', textTransform: 'uppercase', letterSpacing: 0.4 },
  genderDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  genderDotText: { fontSize: 9, fontWeight: '800' },
  bcPersonName: { fontSize: 11.5, fontWeight: '600', color: Colors.slate700 },
});
