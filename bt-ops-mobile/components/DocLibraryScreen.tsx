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

export const WEB_BASE = 'https://bengaluru-trekkers-ops.web.app';

/**
 * An item is either a plain string (the original shape, still written by the
 * packing-list editor) or an object carrying an optional Google Maps link.
 * Both are read everywhere, so older documents keep rendering unchanged.
 */
export type DocItem = string | { name: string; mapUrl?: string };
export interface DocSection { title?: string; items?: DocItem[] }
export interface LibraryDoc {
  id: string; name: string; slug?: string; description?: string;
  emoji?: string; sections?: DocSection[]; trekId?: string; trekName?: string;
  updatedAt?: any; updatedBy?: string;
}

export const itemName = (it: DocItem): string =>
  typeof it === 'string' ? it : (it?.name ?? '');
export const itemMapUrl = (it: DocItem): string =>
  typeof it === 'string' ? '' : (it?.mapUrl ?? '');

interface Trek { id: string; name: string; }

type SortMode = 'updated' | 'az' | 'items';

export const docTotalItems = (l: LibraryDoc) =>
  (l.sections ?? []).reduce((n, sec) => n + (sec.items?.length ?? 0), 0);

/** Flattens every stop in document order — used to build the route link. */
export const docStops = (l: LibraryDoc) =>
  (l.sections ?? []).flatMap(sec => (sec.items ?? []))
    .map(it => ({ name: itemName(it), mapUrl: itemMapUrl(it) }))
    .filter(s => s.name);

export const docPublicUrl = (routePrefix: string, l: LibraryDoc) =>
  `${WEB_BASE}/${routePrefix}/${l.slug ?? l.id}`;

/**
 * All three doc types (Pickup Points, Packing List, Trek Protocol) share to a
 * standalone static page under frontend/public/ instead of a React Router
 * route — each is a plain HTML file that fetches the document straight from
 * Firestore by id, so a new trek's entry automatically gets its own working
 * link with no React app rebuild needed beyond the one-time Hosting deploy.
 * Same page works whether it's opened from the web app or shared from the
 * mobile app — neither needs the other.
 */
export const staticPageUrl = (fileName: string, l: LibraryDoc) =>
  `${WEB_BASE}/${fileName}?id=${l.id}`;
export const pickupRouteMapUrl = (l: LibraryDoc) => staticPageUrl('pickup-route.html', l);
export const packingListUrl = (l: LibraryDoc) => staticPageUrl('packing-list.html', l);
export const trekProtocolUrl = (l: LibraryDoc) => staticPageUrl('trek-protocol.html', l);

const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Shared implementation behind the Packing Lists–style library screens
 * (Pickup Points, Trek Protocol). Same Firestore document shape and the same
 * card/editor UX; the differences are the collection name, the public web
 * route prefix, the copy, and whether entries are tied to a specific trek.
 *
 * Editing is restricted to Super Admin / Operations Manager — everyone else
 * gets a read-only view (no New/Edit/Delete/Duplicate controls), matching the
 * requirement that only ops can change these but all roles can read them.
 */
export function DocLibraryScreen({
  collectionName, routePrefix, title, subtitle, icon, newLabel,
  perTrek = false, perTrekOptional = false, shareEmoji = '📄', withMapLinks = false, itemLabel = 'Item',
  defaultStops, defaultSections, defaultName, defaultDescription, defaultEmoji,
  standardContentLabel = 'Standard route', staticPage,
}: {
  collectionName: string;
  routePrefix: string;
  title: string;
  subtitle: string;
  icon: any;
  newLabel: string;
  /**
   * Filename of the standalone static page (under frontend/public/) this doc
   * type shares to — e.g. "trek-protocol.html". Falls back to the React app
   * route (`docPublicUrl`) when not set.
   */
  staticPage?: string;
  /** Trek is required — every document must belong to exactly one trek (Pickup Points). */
  perTrek?: boolean;
  /**
   * Trek is shown as an optional picker — a document can either stay shared
   * across all treks (no trek picked) or be tied to one specific trek
   * (Packing List, Trek Protocol).
   */
  perTrekOptional?: boolean;
  shareEmoji?: string;
  /** Adds a Google Maps link field to each item (pickup stops). */
  withMapLinks?: boolean;
  itemLabel?: string;
  /**
   * The "standard route" — pre-fills a new document's first section so every
   * trek starts from the same base stops, but every field stays fully
   * editable (add/remove/rename stops, change links) per trek from there.
   */
  defaultStops?: { name: string; mapUrl?: string }[];
  /**
   * A full default section/item structure — pre-fills a new document (title,
   * items and all), used where there's one canonical document rather than
   * one per trek (e.g. Trek Protocol). Still entirely editable afterward.
   */
  defaultSections?: DocSection[];
  defaultName?: string;
  defaultDescription?: string;
  defaultEmoji?: string;
  /** Label for the "insert default content" button shown in the editor. */
  standardContentLabel?: string;
}) {
  const { profile, isAdmin } = useAuth();

  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [treks, setTreks] = useState<Trek[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('updated');

  const [editing, setEditing] = useState<LibraryDoc | 'new' | null>(null);
  const [trekPickerOpen, setTrekPickerOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [trekId, setTrekId] = useState('');
  const [sections, setSections] = useState<DocSection[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      let snap;
      try {
        snap = await getDocs(query(collection(firestore, collectionName), orderBy('updatedAt', 'desc')));
      } catch {
        snap = await getDocs(collection(firestore, collectionName));
      }
      setDocs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? `Could not load ${title.toLowerCase()}`);
    } finally { setLoading(false); }
  }, [collectionName, title]);

  useEffect(() => { load(); }, [load]);

  const showTrekPicker = perTrek || perTrekOptional;

  useEffect(() => {
    if (!showTrekPicker) return;
    api.get('/treks').then(r => setTreks(r.data ?? [])).catch(() => {});
  }, [showTrekPicker]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const publicUrl = (l: LibraryDoc) => staticPage ? staticPageUrl(staticPage, l) : docPublicUrl(routePrefix, l);

  const updatedMs = (l: LibraryDoc) => {
    const d = l.updatedAt?.toDate ? l.updatedAt.toDate() : l.updatedAt ? new Date(l.updatedAt) : null;
    return d && !isNaN(+d) ? +d : 0;
  };

  const stats = useMemo(() => {
    const items = docs.reduce((n, l) => n + docTotalItems(l), 0);
    const sectionsCount = docs.reduce((n, l) => n + (l.sections ?? []).length, 0);
    return {
      count: docs.length,
      items,
      sections: sectionsCount,
      avg: docs.length ? Math.round(items / docs.length) : 0,
    };
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = q
      ? docs.filter(l =>
          l.name?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q) ||
          l.trekName?.toLowerCase().includes(q))
      : docs;
    out = [...out].sort((a, b) => {
      if (sort === 'az') return (a.name ?? '').localeCompare(b.name ?? '');
      if (sort === 'items') return docTotalItems(b) - docTotalItems(a);
      return updatedMs(b) - updatedMs(a);
    });
    return out;
  }, [docs, search, sort]);

  const standardRouteItems = (): DocItem[] =>
    (defaultStops ?? []).map(ds =>
      withMapLinks && ds.mapUrl ? { name: ds.name, mapUrl: ds.mapUrl } : ds.name);

  /** Default content for a brand-new document — a single stops section for
   *  Pickup Points, or a full multi-section structure for Trek Protocol. */
  const standardSections = (): DocSection[] =>
    defaultSections
      ? defaultSections.map(s => ({ title: s.title ?? '', items: [...(s.items ?? [])] }))
      : [{ title: '', items: standardRouteItems() }];

  const openEdit = (l: LibraryDoc | 'new') => {
    if (l === 'new') {
      setName(defaultName ?? ''); setDescription(defaultDescription ?? '');
      setEmoji(defaultEmoji ?? ''); setTrekId('');
      setSections(standardSections());
    } else {
      setName(l.name ?? ''); setDescription(l.description ?? ''); setEmoji(l.emoji ?? '');
      setTrekId(l.trekId ?? '');
      setSections((l.sections ?? []).map(s => ({ title: s.title ?? '', items: [...(s.items ?? [])] })));
    }
    setEditing(l);
  };

  const duplicate = async (l: LibraryDoc) => {
    try {
      const { id: _id, ...rest } = l;
      await addDoc(collection(firestore, collectionName), {
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

  const copyLink = async (l: LibraryDoc) => {
    await Clipboard.setStringAsync(publicUrl(l));
    Alert.alert('Copied', 'Public link copied to clipboard.');
  };

  const whatsapp = async (l: LibraryDoc) => {
    const text = encodeURIComponent(`${shareEmoji} *${l.name}*\n\n👉 ${publicUrl(l)}\n\n_Powered by BT Ops_`);
    const url = `whatsapp://send?text=${text}`;
    const ok = await Linking.canOpenURL(url);
    Linking.openURL(ok ? url : `https://wa.me/?text=${text}`);
  };

  const openExternal = (l: LibraryDoc) => Linking.openURL(publicUrl(l));

  const remove = (l: LibraryDoc) => {
    confirmAction(`Delete ${title.toLowerCase()}`, `Delete "${l.name}"?`, 'Delete', async () => {
      try { await deleteDoc(doc(firestore, collectionName, l.id)); load(); }
      catch (e: any) { Alert.alert('Error', e?.message ?? 'Delete failed'); }
    });
  };

  const setSectionTitle = (i: number, v: string) =>
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, title: v } : s));
  const addSection = () => setSections(prev => [...prev, { title: '', items: [] }]);
  const insertStandardContent = () =>
    setSections(prev => [...prev, ...standardSections()]);
  const removeSection = (i: number) => setSections(prev => prev.filter((_, idx) => idx !== i));
  const addItem = (si: number) =>
    setSections(prev => prev.map((s, idx) =>
      idx === si ? { ...s, items: [...(s.items ?? []), withMapLinks ? { name: '', mapUrl: '' } : ''] } : s));
  /** Edits an item's name, preserving any map link already attached to it. */
  const setItem = (si: number, ii: number, v: string) =>
    setSections(prev => prev.map((s, idx) =>
      idx === si ? {
        ...s,
        items: (s.items ?? []).map((it, j) => {
          if (j !== ii) return it;
          if (!withMapLinks && typeof it === 'string') return v;
          return { name: v, mapUrl: itemMapUrl(it) };
        }),
      } : s));
  const setItemMapUrl = (si: number, ii: number, v: string) =>
    setSections(prev => prev.map((s, idx) =>
      idx === si ? {
        ...s,
        items: (s.items ?? []).map((it, j) =>
          j === ii ? { name: itemName(it), mapUrl: v } : it),
      } : s));
  const removeItem = (si: number, ii: number) =>
    setSections(prev => prev.map((s, idx) =>
      idx === si ? { ...s, items: (s.items ?? []).filter((_, j) => j !== ii) } : s));

  const save = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Enter a name.'); return; }
    if (perTrek && !trekId) { Alert.alert('Trek required', 'Select which trek these pickup points are for.'); return; }
    setSaving(true);
    try {
      const cleanSections = sections
        .map(s => ({
          title: (s.title ?? '').trim(),
          items: (s.items ?? [])
            .map(it => {
              const nm = itemName(it).trim();
              if (!withMapLinks) return nm;
              const url = itemMapUrl(it).trim();
              // Drop the wrapper when there's no link, so simple entries stay
              // plain strings rather than bloating into objects.
              return url ? { name: nm, mapUrl: url } : nm;
            })
            .filter(it => itemName(it)),
        }))
        .filter(s => s.title || s.items.length);
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        emoji: emoji.trim(),
        sections: cleanSections,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.displayName ?? null,
      };
      if (perTrek || (perTrekOptional && trekId)) {
        payload.trekId = trekId;
        payload.trekName = treks.find(t => t.id === trekId)?.name ?? '';
      } else if (perTrekOptional) {
        // Explicitly shared — clear any trek this doc used to belong to.
        payload.trekId = null;
        payload.trekName = null;
      }
      if (editing === 'new') {
        payload.slug = slugify(name) || `${routePrefix}-${Date.now().toString(36)}`;
        payload.createdAt = serverTimestamp();
        await addDoc(collection(firestore, collectionName), payload);
      } else if (editing) {
        await updateDoc(doc(firestore, collectionName, editing.id), payload);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save');
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
              icon={icon}
              title={title}
              subtitle={subtitle}
              right={isAdmin ? (
                <TouchableOpacity style={s.newBtn} onPress={() => openEdit('new')} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={Colors.white} />
                  <Text style={s.newBtnText}>{newLabel}</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.readOnlyPill}>
                  <Ionicons name="eye-outline" size={13} color={Colors.slate500} />
                  <Text style={s.readOnlyText}>View only</Text>
                </View>
              )}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
              <ColorTile value={stats.count} label={title} bg={Colors.tileNavy} icon={icon} />
              <ColorTile value={stats.items} label="Total Items" bg={Colors.tileGreen} icon="checkbox-outline" />
              <ColorTile value={stats.sections} label="Total Sections" bg={Colors.tileBlue} icon="layers-outline" />
              <ColorTile value={stats.avg} label="Avg Items" bg={Colors.tileOrange} icon="stats-chart-outline" />
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
                Showing <Text style={s.showingBold}>{filtered.length}</Text> of {docs.length}
              </Text>
            )}
          </View>
        }
        renderItem={({ item: l }) => (
          <Panel padding={0} style={s.card}>
            <View style={s.cardBody}>
              <View style={s.cardTopRow}>
                <Text style={s.cardTitle} numberOfLines={1}>{l.emoji ? `${l.emoji} ` : ''}{l.name}</Text>
                <View style={s.countPill}>
                  <Text style={s.countText}>{docTotalItems(l)} items</Text>
                </View>
              </View>

              {l.trekName ? (
                <View style={s.trekPill}>
                  <Ionicons name="triangle-outline" size={11} color={Colors.gradientBlueTo} />
                  <Text style={s.trekPillText}>{l.trekName}</Text>
                </View>
              ) : perTrekOptional ? (
                <View style={s.sharedPill}>
                  <Ionicons name="globe-outline" size={11} color={Colors.slate500} />
                  <Text style={s.sharedPillText}>Shared — all treks</Text>
                </View>
              ) : null}

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
                <Ionicons name={withMapLinks ? 'navigate-outline' : 'link-outline'} size={13} color={Colors.slate400} />
                <Text style={s.slugText} numberOfLines={1}>
                  {withMapLinks ? `${docStops(l).length} stops · route map link` : `/${routePrefix}/${l.slug ?? l.id}`}
                </Text>
              </View>
            </View>

            {isAdmin ? (<>
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
              <View style={s.actionGrid}>
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
            </>) : (
              <View style={s.actionGrid}>
                <TouchableOpacity style={s.action} onPress={() => openExternal(l)} activeOpacity={0.7}>
                  <Ionicons name="open-outline" size={15} color={Colors.slate700} />
                  <Text style={s.actionText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => copyLink(l)} activeOpacity={0.7}>
                  <Ionicons name="copy-outline" size={15} color={Colors.slate700} />
                  <Text style={s.actionText}>Copy Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => whatsapp(l)} activeOpacity={0.7}>
                  <Ionicons name="logo-whatsapp" size={15} color={Colors.success} />
                  <Text style={[s.actionText, { color: Colors.success }]}>Share</Text>
                </TouchableOpacity>
              </View>
            )}
          </Panel>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`}
                message={isAdmin ? 'Try a different search, or tap New to create the first one.' : 'Nothing has been published yet.'} />
        }
      />

      {/* Edit / create — admin only */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.editSafe}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
            </TouchableOpacity>
            <Text style={s.editTitle}>{editing === 'new' ? newLabel : `Edit ${title}`}</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} automaticallyAdjustKeyboardInsets>
            <View style={s.field}>
              <Text style={s.label}>Emoji</Text>
              <TextInput style={[s.input, { width: 80 }]} value={emoji} onChangeText={setEmoji} placeholder={shareEmoji} placeholderTextColor={Colors.slate400} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Name</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Kumara Parvatha Pickups" placeholderTextColor={Colors.slate400} />
            </View>

            {showTrekPicker && (
              <View style={s.field}>
                <Text style={s.label}>Trek{perTrekOptional ? ' (optional — leave blank to share across all treks)' : ''}</Text>
                <PickerTrigger
                  label={trekId ? treks.find(t => t.id === trekId)?.name : (perTrekOptional ? 'Shared — all treks' : undefined)}
                  placeholder="Select trek…"
                  onPress={() => setTrekPickerOpen(true)}
                />
              </View>
            )}

            <View style={s.field}>
              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input, s.textarea]} multiline value={description} onChangeText={setDescription}
                placeholder="Short summary shown on the card" placeholderTextColor={Colors.slate400} />
            </View>

            <View style={s.sectionsHeader}>
              <Text style={s.sectionsTitle}>Sections</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {(!!defaultStops?.length || !!defaultSections?.length) && (
                  <TouchableOpacity style={s.standardRouteBtn} onPress={insertStandardContent} activeOpacity={0.7}>
                    <Ionicons name="navigate-outline" size={13} color={Colors.gradientBlueTo} />
                    <Text style={s.standardRouteText}>{standardContentLabel}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={addSection} hitSlop={8}>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
              </View>
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
                  withMapLinks ? (
                    <View key={ii} style={s.stopEditBlock}>
                      <View style={s.itemEditRow}>
                        <View style={s.stopNum}><Text style={s.stopNumText}>{ii + 1}</Text></View>
                        <TextInput
                          style={[s.input, { flex: 1, height: 42 }]}
                          value={itemName(it)}
                          onChangeText={v => setItem(si, ii, v)}
                          placeholder={itemLabel}
                          placeholderTextColor={Colors.slate400}
                        />
                        <TouchableOpacity onPress={() => removeItem(si, ii)} hitSlop={8} style={{ padding: 4 }}>
                          <Ionicons name="close-circle" size={17} color={Colors.slate300} />
                        </TouchableOpacity>
                      </View>
                      <View style={s.mapUrlRow}>
                        <Ionicons name="location-outline" size={13} color={Colors.slate400} />
                        <TextInput
                          style={[s.input, { flex: 1, height: 40, fontSize: 12 }]}
                          value={itemMapUrl(it)}
                          onChangeText={v => setItemMapUrl(si, ii, v)}
                          placeholder="Google Maps link (optional)"
                          placeholderTextColor={Colors.slate400}
                          autoCapitalize="none"
                          keyboardType="url"
                        />
                      </View>
                    </View>
                  ) : (
                    <View key={ii} style={s.itemEditRow}>
                      <Ionicons name="ellipse" size={5} color={Colors.primary} />
                      <TextInput
                        style={[s.input, { flex: 1, height: 42 }]}
                        value={itemName(it)}
                        onChangeText={v => setItem(si, ii, v)}
                        placeholder={itemLabel}
                        placeholderTextColor={Colors.slate400}
                      />
                      <TouchableOpacity onPress={() => removeItem(si, ii)} hitSlop={8} style={{ padding: 4 }}>
                        <Ionicons name="close-circle" size={17} color={Colors.slate300} />
                      </TouchableOpacity>
                    </View>
                  )
                ))}

                <TouchableOpacity style={s.addItemBtn} onPress={() => addItem(si)} activeOpacity={0.7}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                  <Text style={s.addItemText}>Add {itemLabel.toLowerCase()}</Text>
                </TouchableOpacity>
              </Panel>
            ))}

            <Button title={editing === 'new' ? 'Create' : 'Save Changes'} onPress={save} loading={saving} />
          </ScrollView>

          <PickerSheet
            visible={trekPickerOpen}
            onClose={() => setTrekPickerOpen(false)}
            title="Select trek"
            value={trekId}
            onChange={setTrekId}
            options={[
              ...(perTrekOptional ? [{ label: 'Shared — all treks', value: '' }] : []),
              ...treks.map(t => ({ label: t.name, value: t.id })),
            ]}
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
  readOnlyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.slate100, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  readOnlyText: { fontSize: 11, fontWeight: '700', color: Colors.slate500 },

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

  actionGrid: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.slate100 },
  action:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  actionText: { fontSize: 12, fontWeight: '600', color: Colors.slate700 },

  editSafe:   { flex: 1, backgroundColor: Colors.slate50 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle:  { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.slate900 },

  field:    { gap: 6, marginBottom: 14 },
  label:    { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  input:    { minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1.5, borderColor: Colors.slate200, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.white },
  picker:     { height: 46 },

  sectionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionsTitle:  { fontSize: 15, fontWeight: '800', color: Colors.slate900 },
  secTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemEditRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopEditBlock:  { gap: 6, borderLeftWidth: 2, borderLeftColor: Colors.slate100, paddingLeft: 8, marginBottom: 2 },
  stopNum:        { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stopNumText:    { fontSize: 10, fontWeight: '800', color: Colors.white },
  mapUrlRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 28 },
  addItemBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 9 },
  addItemText:    { fontSize: 12, fontWeight: '700', color: Colors.primary },
  standardRouteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dbeafe', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  standardRouteText: { fontSize: 11, fontWeight: '700', color: Colors.gradientBlueTo },
});
