import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ScrollView, RefreshControl, ActivityIndicator, Alert, Linking, TextInput,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { PickerSheet, PickerTrigger } from '@/components/PickerSheet';
import {
  collection, getDocs, query, orderBy, deleteDoc, doc,
  addDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, EmptyState, ColorTile, SearchBar, Chip } from '@/components/ui';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/utils/firebase';
import { confirmAction } from '@/utils/confirm';
import api from '@/utils/api';

interface Section { title?: string; items?: string[] }
interface Trek { id: string; name: string; }
interface PackingList {
  id: string; name: string; slug?: string; description?: string;
  emoji?: string; sections?: Section[]; trekId?: string; trekName?: string;
  updatedAt?: any; updatedBy?: string;
}

const WEB_BASE = 'https://bengaluru-trekkers-ops.web.app';

type SortMode = 'updated' | 'az' | 'items';

export default function PackingListsScreen() {
  const { profile } = useAuth();

  const [lists, setLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('updated');

  const [editing, setEditing] = useState<PackingList | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);
  const [treks, setTreks] = useState<Trek[]>([]);
  const [trekId, setTrekId] = useState('');
  const [trekPickerOpen, setTrekPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      let snap;
      try {
        snap = await getDocs(query(collection(firestore, 'packing_lists'), orderBy('updatedAt', 'desc')));
      } catch {
        snap = await getDocs(collection(firestore, 'packing_lists'));
      }
      setLists(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load packing lists');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/treks').then(r => setTreks(r.data ?? [])).catch(() => {}); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalItems = (l: PackingList) =>
    (l.sections ?? []).reduce((n, sec) => n + (sec.items?.length ?? 0), 0);

  // Standalone static page (frontend/public/packing-list.html) — same page
  // works whether reached from the web app or the mobile app, no React
  // Router route involved.
  const publicUrl = (l: PackingList) => `${WEB_BASE}/packing-list.html?id=${l.id}`;

  const updatedMs = (l: PackingList) => {
    const d = l.updatedAt?.toDate ? l.updatedAt.toDate() : l.updatedAt ? new Date(l.updatedAt) : null;
    return d && !isNaN(+d) ? +d : 0;
  };

  const stats = useMemo(() => {
    const items = lists.reduce((n, l) => n + totalItems(l), 0);
    const sectionsCount = lists.reduce((n, l) => n + (l.sections ?? []).length, 0);
    return {
      count: lists.length,
      items,
      sections: sectionsCount,
      avg: lists.length ? Math.round(items / lists.length) : 0,
    };
  }, [lists]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = q
      ? lists.filter(l => l.name?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
      : lists;
    out = [...out].sort((a, b) => {
      if (sort === 'az') return (a.name ?? '').localeCompare(b.name ?? '');
      if (sort === 'items') return totalItems(b) - totalItems(a);
      return updatedMs(b) - updatedMs(a);
    });
    return out;
  }, [lists, search, sort]);

  /* ── Actions mirroring the web card footer ───────────────────────── */

  const openEdit = (l: PackingList | 'new') => {
    if (l === 'new') {
      setName(''); setDescription(''); setEmoji(''); setTrekId(''); setSections([{ title: '', items: [] }]);
    } else {
      setName(l.name ?? ''); setDescription(l.description ?? ''); setEmoji(l.emoji ?? '');
      setTrekId(l.trekId ?? '');
      setSections((l.sections ?? []).map(s => ({ title: s.title ?? '', items: [...(s.items ?? [])] })));
    }
    setEditing(l);
  };

  const duplicate = async (l: PackingList) => {
    try {
      const { id: _id, ...rest } = l;
      await addDoc(collection(firestore, 'packing_lists'), {
        ...rest,
        name: `${l.name} Copy`,
        slug: `${l.slug ?? l.id}-copy`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: null,
      });
      load();
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Duplicate failed'); }
  };

  const copyLink = async (l: PackingList) => {
    await Clipboard.setStringAsync(publicUrl(l));
    Alert.alert('Copied', 'Public link copied to clipboard.');
  };

  const whatsapp = async (l: PackingList) => {
    const text = encodeURIComponent(
      `📋 *${l.name} – Packing List*\n\nHere's what to pack for your trek:\n👉 ${publicUrl(l)}\n\n_Powered by BT Ops_`
    );
    const url = `whatsapp://send?text=${text}`;
    const ok = await Linking.canOpenURL(url);
    Linking.openURL(ok ? url : `https://wa.me/?text=${text}`);
  };

  const openExternal = (l: PackingList) => Linking.openURL(publicUrl(l));

  const remove = (l: PackingList) => {
    confirmAction('Delete packing list', `Delete "${l.name}"?`, 'Delete', async () => {
      try { await deleteDoc(doc(firestore, 'packing_lists', l.id)); load(); }
      catch (e: any) { Alert.alert('Error', e?.message ?? 'Delete failed'); }
    });
  };

  /* ── Edit form helpers ───────────────────────────────────────────── */

  const setSectionTitle = (i: number, v: string) =>
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, title: v } : s));

  const addSection = () => setSections(prev => [...prev, { title: '', items: [] }]);
  const removeSection = (i: number) => setSections(prev => prev.filter((_, idx) => idx !== i));

  const addItem = (si: number) =>
    setSections(prev => prev.map((s, idx) => idx === si ? { ...s, items: [...(s.items ?? []), ''] } : s));

  const setItem = (si: number, ii: number, v: string) =>
    setSections(prev => prev.map((s, idx) =>
      idx === si ? { ...s, items: (s.items ?? []).map((it, j) => j === ii ? v : it) } : s));

  const removeItem = (si: number, ii: number) =>
    setSections(prev => prev.map((s, idx) =>
      idx === si ? { ...s, items: (s.items ?? []).filter((_, j) => j !== ii) } : s));

  const slugify = (v: string) =>
    v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const save = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Enter a list name.'); return; }
    setSaving(true);
    try {
      const cleanSections = sections
        .map(s => ({ title: (s.title ?? '').trim(), items: (s.items ?? []).map(i => i.trim()).filter(Boolean) }))
        .filter(s => s.title || s.items.length);
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        emoji: emoji.trim(),
        sections: cleanSections,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.displayName ?? null,
      };
      if (trekId) {
        payload.trekId = trekId;
        payload.trekName = treks.find(t => t.id === trekId)?.name ?? '';
      } else {
        // Explicitly shared — clear any trek this list used to belong to.
        payload.trekId = null;
        payload.trekName = null;
      }
      if (editing === 'new') {
        payload.slug = slugify(name) || `list-${Date.now().toString(36)}`;
        payload.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'packing_lists'), payload);
      } else if (editing) {
        await updateDoc(doc(firestore, 'packing_lists', editing.id), payload);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save packing list');
    } finally { setSaving(false); }
  };

  const fmtDate = (ts: any) => {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d || isNaN(+d)) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <AppShell>
      <FlatList
        data={filtered}
        keyExtractor={l => l.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <PageTitle
              icon="clipboard-outline"
              title="Packing Lists"
              subtitle="Create & share packing lists with trek batches via WhatsApp"
              right={
                <TouchableOpacity style={s.newBtn} onPress={() => openEdit('new')} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={Colors.white} />
                  <Text style={s.newBtnText}>New Packing List</Text>
                </TouchableOpacity>
              }
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
              <ColorTile value={stats.count} label="All Lists" bg={Colors.tileNavy} icon="clipboard-outline" />
              <ColorTile value={stats.items} label="Total Items" bg={Colors.tileGreen} icon="checkbox-outline" />
              <ColorTile value={stats.sections} label="Total Sections" bg={Colors.tileBlue} icon="layers-outline" />
              <ColorTile value={stats.avg} label="Avg Items / List" bg={Colors.tileOrange} icon="stats-chart-outline" />
            </ScrollView>

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or description..." />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <Chip label="Recently Updated" active={sort === 'updated'} onPress={() => setSort('updated')} />
              <Chip label="Name A–Z" active={sort === 'az'} onPress={() => setSort('az')} />
              <Chip label="Most Items" active={sort === 'items'} onPress={() => setSort('items')} />
            </ScrollView>

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
                Showing <Text style={s.showingBold}>{filtered.length}</Text> of {lists.length} lists
              </Text>
            )}
          </View>
        }
        renderItem={({ item: l }) => (
          <Panel padding={0} style={s.card}>
            <View style={s.cardBody}>
              <View style={s.cardTopRow}>
                <Text style={s.cardTitle} numberOfLines={1}>{l.name}</Text>
                <View style={s.countPill}>
                  <Text style={s.countText}>{totalItems(l)} items</Text>
                </View>
              </View>

              {l.trekName ? (
                <View style={s.trekPill}>
                  <Ionicons name="triangle-outline" size={11} color={Colors.gradientBlueTo} />
                  <Text style={s.trekPillText}>{l.trekName}</Text>
                </View>
              ) : (
                <View style={s.sharedPill}>
                  <Ionicons name="globe-outline" size={11} color={Colors.slate500} />
                  <Text style={s.sharedPillText}>Shared — all treks</Text>
                </View>
              )}

              {!!l.description && <Text style={s.cardDesc} numberOfLines={2}>{l.description}</Text>}

              <View style={s.metaRow}>
                <Ionicons name="layers-outline" size={13} color={Colors.slate400} />
                <Text style={s.metaText}>{(l.sections ?? []).length} sections</Text>
              </View>
              <View style={s.metaRow}>
                <Ionicons name="time-outline" size={13} color={Colors.slate400} />
                <Text style={s.metaText} numberOfLines={1}>
                  Updated {fmtDate(l.updatedAt)}{l.updatedBy ? ` · ${l.updatedBy}` : ''}
                </Text>
              </View>
              <View style={s.metaRow}>
                <Ionicons name="link-outline" size={13} color={Colors.slate400} />
                <Text style={s.slugText} numberOfLines={1}>packing-list.html?id={l.id}</Text>
              </View>
            </View>

            {/* Same actions as the web card: Edit · Duplicate · Link / WhatsApp · Open · Delete */}
            <View style={s.actionGrid}>
              <TouchableOpacity style={s.action} onPress={() => openEdit(l)} activeOpacity={0.7}>
                <Ionicons name="create-outline" size={15} color={Colors.slate700} />
                <Text style={s.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.action} onPress={() => duplicate(l)} activeOpacity={0.7}>
                <Ionicons name="duplicate-outline" size={15} color={Colors.gradientBlueTo} />
                <Text style={[s.actionText, { color: Colors.gradientBlueTo }]}>Duplicate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.action} onPress={() => copyLink(l)} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={15} color={Colors.slate700} />
                <Text style={s.actionText}>Link</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.actionGrid, s.actionGridLast]}>
              <TouchableOpacity style={s.action} onPress={() => whatsapp(l)} activeOpacity={0.7}>
                <Ionicons name="logo-whatsapp" size={15} color={Colors.success} />
                <Text style={[s.actionText, { color: Colors.success }]}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.action} onPress={() => openExternal(l)} activeOpacity={0.7}>
                <Ionicons name="open-outline" size={15} color={Colors.slate700} />
              </TouchableOpacity>
              <TouchableOpacity style={s.action} onPress={() => remove(l)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </Panel>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="clipboard-outline" title="No packing lists" message="Try a different search, or tap New to create your first list." />
        }
      />

      {/* Edit / create */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.editSafe}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
            </TouchableOpacity>
            <Text style={s.editTitle}>{editing === 'new' ? 'New Packing List' : 'Edit Packing List'}</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={s.field}>
              <Text style={s.label}>Emoji</Text>
              <TextInput style={[s.input, { width: 80 }]} value={emoji} onChangeText={setEmoji} placeholder="📋" placeholderTextColor={Colors.slate400} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Name</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Monsoon Treks" placeholderTextColor={Colors.slate400} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Trek (optional — leave blank to share across all treks)</Text>
              <PickerTrigger
                label={trekId ? treks.find(t => t.id === trekId)?.name : 'Shared — all treks'}
                onPress={() => setTrekPickerOpen(true)}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, s.textarea]} multiline value={description} onChangeText={setDescription}
                placeholder="Packing list for treks during the monsoon season" placeholderTextColor={Colors.slate400} />
            </View>

            <View style={s.sectionsHeader}>
              <Text style={s.sectionsTitle}>Sections</Text>
              <TouchableOpacity onPress={addSection} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {sections.map((sec, si) => (
              <Panel key={si} padding={12} style={{ marginBottom: 12, gap: 9 }}>
                <View style={s.secTitleRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={sec.title ?? ''}
                    onChangeText={v => setSectionTitle(si, v)}
                    placeholder={`Section ${si + 1} title`}
                    placeholderTextColor={Colors.slate400}
                  />
                  <TouchableOpacity onPress={() => removeSection(si)} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                  </TouchableOpacity>
                </View>

                {(sec.items ?? []).map((it, ii) => (
                  <View key={ii} style={s.itemEditRow}>
                    <Ionicons name="ellipse" size={5} color={Colors.primary} />
                    <TextInput
                      style={[s.input, { flex: 1, height: 42 }]}
                      value={it}
                      onChangeText={v => setItem(si, ii, v)}
                      placeholder="Item"
                      placeholderTextColor={Colors.slate400}
                    />
                    <TouchableOpacity onPress={() => removeItem(si, ii)} hitSlop={8} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={17} color={Colors.slate300} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={s.addItemBtn} onPress={() => addItem(si)} activeOpacity={0.7}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                  <Text style={s.addItemText}>Add item</Text>
                </TouchableOpacity>
              </Panel>
            ))}

            <Button title={editing === 'new' ? 'Create List' : 'Save Changes'} onPress={save} loading={saving} />
          </ScrollView>

          <PickerSheet
            visible={trekPickerOpen}
            onClose={() => setTrekPickerOpen(false)}
            title="Select trek"
            value={trekId}
            onChange={setTrekId}
            options={[{ label: 'Shared — all treks', value: '' }, ...treks.map(t => ({ label: t.name, value: t.id }))]}
          />
        </ModalSafeArea>
      </Modal>
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },

  newBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.gradientBlueTo, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 11 },
  newBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  tileRow: { gap: 10, paddingRight: 16 },
  chipRow: { gap: 7, paddingRight: 16 },

  showing:     { fontSize: 13, color: Colors.slate500 },
  showingBold: { fontWeight: '800', color: Colors.slate900 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  card:      { overflow: 'hidden' },
  cardBody:  { padding: 14, gap: 7 },
  cardTopRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  cardDesc:  { fontSize: 12, color: Colors.slate600, lineHeight: 17 },
  countPill: { backgroundColor: Colors.slate100, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 11, fontWeight: '700', color: Colors.slate700 },
  trekPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#dbeafe', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  trekPillText: { fontSize: 11, fontWeight: '700', color: Colors.gradientBlueTo },
  sharedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: Colors.slate100, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  sharedPillText: { fontSize: 11, fontWeight: '700', color: Colors.slate500 },

  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 12, color: Colors.slate500 },
  slugText: { fontSize: 11, color: Colors.slate400 },

  actionGrid:     { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.slate100 },
  actionGridLast: {},
  action:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  actionText:     { fontSize: 12, fontWeight: '600', color: Colors.slate700 },

  editSafe:   { flex: 1, backgroundColor: Colors.slate50 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle:  { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.slate900 },

  field:    { gap: 6, marginBottom: 14 },
  label:    { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  input:    { minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  textarea: { minHeight: 72, textAlignVertical: 'top' },

  sectionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionsTitle:  { fontSize: 15, fontWeight: '800', color: Colors.slate900 },
  secTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemEditRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addItemBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 9 },
  addItemText:    { fontSize: 12, fontWeight: '700', color: Colors.primary },
});
