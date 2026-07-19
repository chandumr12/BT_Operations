import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Modal, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { GradientHeader, SearchBar, Chip, Pill, Panel, DIFFICULTY_STYLE, EmptyState } from '@/components/ui';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

interface Trek {
  id: string; name: string; region: string; distanceFromBengaluru: string;
  trekDistance: string; altitude: string; difficultyLevel: string;
  bestTimeToVisit: string; meetingPoint: string; reportingTime: string;
  requiredPermissions?: string; vendorNotes?: string; internalNotes?: string;
  trekType: string; category: string; archived: boolean;
}

const EMPTY = {
  name: '', region: '', distanceFromBengaluru: '', trekDistance: '', altitude: '',
  difficultyLevel: '', bestTimeToVisit: '', meetingPoint: '', reportingTime: '',
  requiredPermissions: '', vendorNotes: '', internalNotes: '', trekType: '', category: '',
};

const FIELDS: { key: keyof typeof EMPTY; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Trek Name' },
  { key: 'region', label: 'Region' },
  { key: 'category', label: 'Category' },
  { key: 'trekType', label: 'Trek Type' },
  { key: 'difficultyLevel', label: 'Difficulty' },
  { key: 'distanceFromBengaluru', label: 'Distance from Bengaluru' },
  { key: 'trekDistance', label: 'Trek Distance' },
  { key: 'altitude', label: 'Altitude' },
  { key: 'bestTimeToVisit', label: 'Best Time to Visit' },
  { key: 'meetingPoint', label: 'Meeting Point' },
  { key: 'reportingTime', label: 'Reporting Time' },
  { key: 'requiredPermissions', label: 'Required Permissions', multiline: true },
  { key: 'vendorNotes', label: 'Vendor Notes', multiline: true },
  { key: 'internalNotes', label: 'Internal Notes', multiline: true },
];

const CATEGORIES = ['All', 'Karnataka', 'Kerala', 'Himalayas', 'Sunrise', 'Backpacking', 'Kids Batch'];
const DIFFICULTIES = ['All', 'Easy', 'Moderate', 'Difficult', 'Very Difficult'];

export default function TrekMasterScreen() {
  const [treks, setTreks] = useState<Trek[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [editing, setEditing] = useState<Trek | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/treks');
      setTreks(r.data);
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return treks.filter(t =>
      (category === 'All' || t.category === category) &&
      (difficulty === 'All' || t.difficultyLevel === difficulty) &&
      (!q || t.name?.toLowerCase().includes(q) || t.region?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q))
    );
  }, [treks, search, category, difficulty]);

  const openEdit = (t: Trek | 'new') => {
    setForm(t === 'new' ? { ...EMPTY } : { ...EMPTY, ...(t as any) });
    setEditing(t);
  };

  const save = async () => {
    if (!form.name?.trim()) { Alert.alert('Name required', 'Enter a trek name.'); return; }
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/treks', form);
      else if (editing) await api.patch(`/treks/${editing.id}`, form);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save trek');
    } finally { setSaving(false); }
  };

  const archive = (t: Trek) => {
    confirmAction('Archive trek', `Archive "${t.name}"?`, 'Archive', async () => {
      try { await api.patch(`/treks/${t.id}`, { archived: true }); load(); }
      catch { Alert.alert('Error', 'Could not archive trek'); }
    });
  };

  if (editing) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.editSafe}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
            </TouchableOpacity>
            <Text style={s.editTitle}>{editing === 'new' ? 'New Trek' : 'Edit Trek'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {FIELDS.map(f => (
              <View key={f.key} style={s.field}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput
                  style={[s.input, f.multiline && s.textarea]}
                  multiline={f.multiline}
                  value={form[f.key] ?? ''}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholderTextColor={Colors.slate400}
                />
              </View>
            ))}
            <Button title={editing === 'new' ? 'Create Trek' : 'Save Changes'} onPress={save} loading={saving} />
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    );
  }

  return (
    <AppShell>
      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <GradientHeader
              icon="triangle-outline"
              title="Trek Master"
              subtitle={`${treks.length} treks configured`}
              actionLabel="Add New Trek"
              onAction={() => openEdit('new')}
            />

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by trek name, region or category..." />

            <View>
              <Text style={s.filterLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {CATEGORIES.map(c => (
                  <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
                ))}
              </ScrollView>
            </View>

            <View>
              <Text style={s.filterLabel}>Difficulty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {DIFFICULTIES.map(d => (
                  <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(d)} />
                ))}
              </ScrollView>
            </View>

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}

            {!loading && (
              <Text style={s.showing}>
                Showing <Text style={s.showingBold}>{filtered.length}</Text> of {treks.length} treks
              </Text>
            )}
          </View>
        }
        renderItem={({ item: t }) => {
          const diff = DIFFICULTY_STYLE[t.difficultyLevel] ?? { color: Colors.slate500, bg: Colors.slate100 };
          return (
            <Panel padding={0} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.trekIcon}>
                  <Ionicons name="triangle-outline" size={17} color={Colors.gradientBlueTo} />
                </View>
                <Text style={s.trekName} numberOfLines={2}>{t.name}</Text>
                {!!t.difficultyLevel && <Pill label={t.difficultyLevel} color={diff.color} bg={diff.bg} dot />}
              </View>

              <View style={s.tagRow}>
                {!!t.category && <Pill label={t.category} color={Colors.gradientBlueTo} bg="#dbeafe" />}
                {!!t.trekType && <Pill label={t.trekType} color={Colors.slate700} bg={Colors.slate100} />}
              </View>

              <View style={s.metaBlock}>
                {!!t.region && (
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={13} color={Colors.slate400} />
                    <Text style={s.metaText}>{t.region}</Text>
                  </View>
                )}
                {(t.altitude || t.trekDistance) ? (
                  <View style={s.metaRow}>
                    <Ionicons name="navigate-outline" size={13} color={Colors.slate400} />
                    <Text style={s.metaText}>{t.altitude || 'NA'} · {t.trekDistance || 'NA'}</Text>
                  </View>
                ) : null}
                {!!t.distanceFromBengaluru && (
                  <View style={s.metaRow}>
                    <Ionicons name="time-outline" size={13} color={Colors.slate400} />
                    <Text style={s.metaText}>{t.distanceFromBengaluru} from Bengaluru</Text>
                  </View>
                )}
                {!!t.bestTimeToVisit && <Text style={s.bestTime}>Best: {t.bestTimeToVisit}</Text>}
              </View>

              <View style={s.cardFooter}>
                <TouchableOpacity style={s.footerBtn} onPress={() => openEdit(t)} activeOpacity={0.7}>
                  <Ionicons name="create-outline" size={15} color={Colors.slate700} />
                  <Text style={s.footerBtnText}>Edit</Text>
                </TouchableOpacity>
                <View style={s.footerDivider} />
                <TouchableOpacity style={s.footerBtn} onPress={() => archive(t)} activeOpacity={0.7}>
                  <Ionicons name="archive-outline" size={15} color={Colors.slate400} />
                  <Text style={[s.footerBtnText, { color: Colors.slate400 }]}>Archive</Text>
                </TouchableOpacity>
              </View>
            </Panel>
          );
        }}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="triangle-outline" title="No treks found" message="Try a different search or filter." />
        }
      />
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },

  filterLabel: { fontSize: 11, fontWeight: '700', color: Colors.slate500, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  chipRow:     { gap: 7, paddingRight: 16 },

  showing:     { fontSize: 13, color: Colors.slate500 },
  showingBold: { fontWeight: '800', color: Colors.slate900 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  card:      { overflow: 'hidden' },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, paddingBottom: 10 },
  trekIcon:  { width: 32, height: 32, borderRadius: 9, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  trekName:  { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.slate900, lineHeight: 20 },

  tagRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },

  metaBlock: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText:  { fontSize: 12, color: Colors.slate500 },
  bestTime:  { fontSize: 11, color: Colors.slate400, fontStyle: 'italic', marginTop: 2 },

  cardFooter:    { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.slate100 },
  footerBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  footerBtnText: { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  footerDivider: { width: 1, height: 22, backgroundColor: Colors.slate100 },

  editSafe:   { flex: 1, backgroundColor: Colors.slate50 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle:  { fontSize: 17, fontWeight: '700', color: Colors.slate900 },
  field:      { gap: 6, marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  input:      { minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  textarea:   { minHeight: 70, textAlignVertical: 'top' },
});
