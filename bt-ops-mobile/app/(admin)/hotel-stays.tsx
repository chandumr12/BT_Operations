import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, RefreshControl, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, StatCard, Panel, Chip, EmptyState } from '@/components/ui';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

interface Stay {
  id: string; place: string; date: string; serial?: number;
  hotel?: string; rooms?: number; pax?: number;
  batchCode?: string; contact?: string; notes?: string;
}

const PLACES = [
  'Haridwar', 'Barkot', 'Uttarakashi', 'Guptakashi',
  'Kedarnath', 'Mandal/Chopta', 'Joshimath-Badrinath', 'Rishikesh',
];

const EMPTY = { place: PLACES[0], date: '', hotel: '', rooms: '', pax: '', batchCode: '', contact: '', notes: '' };

export default function HotelStaysScreen() {
  const { profile } = useAuth();
  const isAdmin = ['Super Admin', 'Operations Manager'].includes(profile?.role ?? '');

  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState(PLACES[0]);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<Stay | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/hotel-stays'); setStays(r.data); setError(null); }
    catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const today = new Date().toISOString().split('T')[0];

  const forPlace = useMemo(() => stays.filter(s => s.place === place), [stays, place]);
  const upcoming = forPlace.filter(s => (s.date ?? '') >= today);
  const past = forPlace.filter(s => (s.date ?? '') < today);
  const visible = showPast ? past : upcoming;

  const totalPax = stays.reduce((sum, s) => sum + (Number(s.pax) || 0), 0);
  const totalRooms = stays.reduce((sum, s) => sum + (Number(s.rooms) || 0), 0);
  const activeDays = new Set(stays.filter(s => (s.date ?? '') >= today).map(s => s.date)).size;

  const openEdit = (st: Stay | 'new') => {
    if (st === 'new') setForm({ ...EMPTY, place });
    else setForm({
      place: st.place ?? place, date: st.date ?? '', hotel: st.hotel ?? '',
      rooms: st.rooms != null ? String(st.rooms) : '', pax: st.pax != null ? String(st.pax) : '',
      batchCode: st.batchCode ?? '', contact: st.contact ?? '', notes: st.notes ?? '',
    });
    setEditing(st);
  };

  const save = async () => {
    if (!form.date.trim()) { Alert.alert('Date required', 'Enter a date (YYYY-MM-DD).'); return; }
    setSaving(true);
    try {
      const payload = {
        place: form.place, date: form.date.trim(), hotel: form.hotel,
        rooms: Number(form.rooms) || 0, pax: Number(form.pax) || 0,
        batchCode: form.batchCode, contact: form.contact, notes: form.notes,
      };
      if (editing === 'new') await api.post('/hotel-stays', payload);
      else if (editing) await api.patch(`/hotel-stays/${editing.id}`, payload);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save stay entry');
    } finally { setSaving(false); }
  };

  const remove = (st: Stay) => {
    confirmAction('Delete entry', `Remove the ${st.place} stay on ${st.date}?`, 'Delete', async () => {
      try { await api.delete(`/hotel-stays/${st.id}`); load(); }
      catch { Alert.alert('Error', 'Could not delete entry'); }
    });
  };

  const fmt = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(+d)) return iso;
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <AppShell>
      <FlatList
        data={visible}
        keyExtractor={st => st.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <PageTitle
              title="Hotel Stay Planner"
              subtitle="Manage stay schedules and share with vendors"
              right={isAdmin ? (
                <TouchableOpacity style={s.addBtn} onPress={() => openEdit('new')} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={Colors.white} />
                </TouchableOpacity>
              ) : undefined}
            />

            <View style={s.grid}>
              <View style={s.gridItem}><StatCard label="Active Days"  value={activeDays}    icon="calendar-outline" tint={Colors.gradientBlueTo} /></View>
              <View style={s.gridItem}><StatCard label="Total Pax"    value={totalPax}      icon="people-outline"   tint={Colors.success} /></View>
              <View style={s.gridItem}><StatCard label="Total Rooms"  value={totalRooms}    icon="bed-outline"      tint="#8b5cf6" /></View>
              <View style={s.gridItem}><StatCard label="Entries"      value={stays.length}  icon="business-outline" tint={Colors.warning} /></View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {PLACES.map(p => (
                <Chip key={p} label={p} active={place === p} onPress={() => setPlace(p)} activeBg={Colors.gradientBlueTo} />
              ))}
            </ScrollView>

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}

            <View style={s.toggleRow}>
              <Text style={s.placeTitle}>{place}</Text>
              <TouchableOpacity style={s.pastBtn} onPress={() => setShowPast(p => !p)} activeOpacity={0.8}>
                <Ionicons name={showPast ? 'arrow-up' : 'arrow-down'} size={12} color={Colors.slate600} />
                <Text style={s.pastText}>{showPast ? `Upcoming (${upcoming.length})` : `Past dates (${past.length})`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item: st }) => (
          <Panel padding={14} style={{ gap: 7 }}>
            <View style={s.cardTop}>
              <Ionicons name="calendar-outline" size={14} color={Colors.gradientBlueTo} />
              <Text style={s.dateText}>{fmt(st.date)}</Text>
              {!!st.batchCode && <View style={s.batchPill}><Text style={s.batchPillText}>{st.batchCode}</Text></View>}
            </View>

            {!!st.hotel && (
              <View style={s.metaRow}>
                <Ionicons name="business-outline" size={13} color={Colors.slate400} />
                <Text style={s.metaText}>{st.hotel}</Text>
              </View>
            )}

            <View style={s.metaRow}>
              <Ionicons name="people-outline" size={13} color={Colors.slate400} />
              <Text style={s.metaText}>{st.pax ?? 0} pax</Text>
              <Ionicons name="bed-outline" size={13} color={Colors.slate400} style={{ marginLeft: 10 }} />
              <Text style={s.metaText}>{st.rooms ?? 0} rooms</Text>
            </View>

            {!!st.contact && (
              <View style={s.metaRow}>
                <Ionicons name="call-outline" size={13} color={Colors.slate400} />
                <Text style={s.metaText}>{st.contact}</Text>
              </View>
            )}

            {!!st.notes && <Text style={s.notes}>{st.notes}</Text>}

            {isAdmin && (
              <View style={s.cardActions}>
                <TouchableOpacity style={s.action} onPress={() => openEdit(st)} activeOpacity={0.7}>
                  <Ionicons name="create-outline" size={14} color={Colors.slate700} />
                  <Text style={s.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => remove(st)} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                  <Text style={[s.actionText, { color: Colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </Panel>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="business-outline" title={`No ${showPast ? 'past' : 'upcoming'} dates for ${place}`} message="Add a stay entry or pick another location." />
        }
      />

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.editSafe}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
            </TouchableOpacity>
            <Text style={s.editTitle}>{editing === 'new' ? 'Add Stay Entry' : 'Edit Stay Entry'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={s.field}>
              <Text style={s.label}>Place</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {PLACES.map(p => (
                  <Chip key={p} label={p} active={form.place === p} onPress={() => setForm(prev => ({ ...prev, place: p }))} activeBg={Colors.gradientBlueTo} />
                ))}
              </ScrollView>
            </View>

            {([
              { key: 'date', label: 'Date (YYYY-MM-DD)' },
              { key: 'hotel', label: 'Hotel' },
              { key: 'rooms', label: 'Rooms', numeric: true },
              { key: 'pax', label: 'Pax', numeric: true },
              { key: 'batchCode', label: 'Batch code' },
              { key: 'contact', label: 'Vendor contact' },
              { key: 'notes', label: 'Notes', multiline: true },
            ] as const).map(f => (
              <View key={f.key} style={s.field}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput
                  style={[s.input, (f as any).multiline && s.textarea]}
                  multiline={(f as any).multiline}
                  keyboardType={(f as any).numeric ? 'number-pad' : 'default'}
                  value={form[f.key] ?? ''}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholderTextColor={Colors.slate400}
                />
              </View>
            ))}

            <Button title={editing === 'new' ? 'Add Entry' : 'Save Changes'} onPress={save} loading={saving} />
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 10 },

  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },
  chipRow:  { gap: 7, paddingRight: 16 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeTitle: { fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  pastBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.slate100, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  pastText:   { fontSize: 11, fontWeight: '600', color: Colors.slate600 },

  cardTop:       { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateText:      { fontSize: 14, fontWeight: '800', color: Colors.slate900, flex: 1 },
  batchPill:     { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  batchPillText: { fontSize: 11, fontWeight: '700', color: Colors.gradientBlueTo },

  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 12, color: Colors.slate500 },
  notes:    { fontSize: 12, color: Colors.slate600, fontStyle: 'italic', marginTop: 2 },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.slate100, paddingTop: 10 },
  action:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText:  { fontSize: 12, fontWeight: '600', color: Colors.slate700, marginRight: 12 },

  editSafe:   { flex: 1, backgroundColor: Colors.slate50 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle:  { fontSize: 17, fontWeight: '700', color: Colors.slate900 },
  field:      { gap: 6, marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  input:      { minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  textarea:   { minHeight: 76, textAlignVertical: 'top' },
});
