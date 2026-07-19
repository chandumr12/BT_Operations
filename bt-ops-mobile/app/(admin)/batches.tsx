import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, SearchBar, Chip, ColorTile, Pill, Panel, STATUS_STYLE, EmptyState } from '@/components/ui';
import { BatchDetailModal, BatchSummary } from '@/components/BatchDetailModal';
import { BatchFormModal } from '@/components/BatchFormModal';
import { BatchAvailabilityPanel } from '@/components/BatchAvailabilityPanel';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

interface Batch extends BatchSummary {
  trekId?: string;
}

const STATUS_OPTIONS = ['Open', 'Closed', 'Completed', 'Cancelled'];
type Filter = 'All' | 'Current' | 'Upcoming' | 'Past';

export default function BatchesScreen() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trekNames, setTrekNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [selected, setSelected] = useState<Batch | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showNewBatch, setShowNewBatch] = useState(false);

  const pickFilter = (f: Filter) => { setShowAvailability(false); setFilter(f); };

  const load = useCallback(async () => {
    try {
      const r = await api.get('/batches');
      setBatches(r.data);
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); }

    try {
      const r = await api.get('/treks');
      const map: Record<string, string> = {};
      r.data.forEach((t: any) => { map[t.id] = t.name; });
      setTrekNames(map);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const today = new Date().toISOString().split('T')[0];
  const buckets = useMemo(() => {
    const current = batches.filter(b => b.startDate <= today && b.endDate >= today);
    const upcoming = batches.filter(b => b.startDate > today);
    const past = batches.filter(b => b.endDate < today);
    return { current, upcoming, past };
  }, [batches, today]);

  const totalSeats = batches.reduce((s, b) => s + (b.maxCapacity || 0), 0);
  const filledSeats = batches.reduce((s, b) => s + (b.currentRegistrations || 0), 0);
  const fillPct = totalSeats > 0 ? Math.round((filledSeats / totalSeats) * 100) : 0;

  const filtered = useMemo(() => {
    let list =
      filter === 'Current' ? buckets.current :
      filter === 'Upcoming' ? buckets.upcoming :
      filter === 'Past' ? buckets.past : batches;
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(b =>
        b.batchCode?.toLowerCase().includes(q) ||
        b.status?.toLowerCase().includes(q) ||
        (b.trekId && trekNames[b.trekId]?.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  }, [batches, buckets, filter, search, trekNames]);

  const setStatus = async (b: Batch, status: string) => {
    setBatches(prev => prev.map(x => x.id === b.id ? { ...x, status } : x));
    try { await api.patch(`/batches/${b.id}`, { status }); }
    catch { Alert.alert('Error', 'Could not update batch status'); load(); }
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(+d)) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const relative = (b: Batch) => {
    const end = new Date(b.endDate);
    const start = new Date(b.startDate);
    const now = new Date();
    if (isNaN(+end) || isNaN(+start)) return '';
    if (end < now) return `Ended ${Math.round((+now - +end) / 86400000)}d ago`;
    if (start > now) return `Starts in ${Math.round((+start - +now) / 86400000)}d`;
    return 'Running now';
  };

  return (
    <AppShell>
      <FlatList
        data={showAvailability ? [] : filtered}
        keyExtractor={b => b.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <PageTitle
              title="Batch Planning"
              subtitle="Manage trek batches · lead assignments · logistics"
              right={
                <TouchableOpacity style={s.newBtn} onPress={() => setShowNewBatch(true)} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={Colors.white} />
                  <Text style={s.newBtnText}>New Batch</Text>
                </TouchableOpacity>
              }
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
              <ColorTile value={batches.length} label="All Batches" bg={Colors.tileNavy} icon="stats-chart-outline" onPress={() => pickFilter('All')} />
              <ColorTile value={buckets.current.length} label="Running Now" bg={Colors.tileGreen} icon="flash-outline" onPress={() => pickFilter('Current')} />
              <ColorTile value={buckets.upcoming.length} label="Upcoming" bg={Colors.tileBlue} icon="arrow-up-outline" onPress={() => pickFilter('Upcoming')} />
              <ColorTile value={buckets.past.length} label="Past" bg={Colors.tileGrayBg} fg={Colors.slate700} icon="checkmark-circle-outline" onPress={() => pickFilter('Past')} />
              <ColorTile value={`${fillPct}%`} label="Overall Fill" sub={`${filledSeats}/${totalSeats} seats`} bg={Colors.tileOrange} icon="trending-up-outline" />
            </ScrollView>

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search batch code, trek, lead, vendor..." />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <Chip label="All"      count={batches.length}          active={!showAvailability && filter === 'All'}      onPress={() => pickFilter('All')} />
              <Chip label="Current"  count={buckets.current.length}  active={!showAvailability && filter === 'Current'}  onPress={() => pickFilter('Current')} />
              <Chip label="Upcoming" count={buckets.upcoming.length} active={!showAvailability && filter === 'Upcoming'} onPress={() => pickFilter('Upcoming')} />
              <Chip label="Past"     count={buckets.past.length}     active={!showAvailability && filter === 'Past'}     onPress={() => pickFilter('Past')} />
              <Chip label="Availability" active={showAvailability} onPress={() => setShowAvailability(true)} />
            </ScrollView>

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}

            {showAvailability ? (
              <BatchAvailabilityPanel />
            ) : (
              !loading && (
                <Text style={s.showing}>
                  Showing <Text style={s.showingBold}>{filtered.length}</Text> of {batches.length} batches
                </Text>
              )
            )}
          </View>
        }
        renderItem={({ item: b }) => {
          if (showAvailability) return null;
          const st = STATUS_STYLE[b.status] ?? { color: Colors.slate700, bg: Colors.slate100 };
          return (
            <Panel padding={0} style={s.card}>
              <TouchableOpacity onPress={() => setSelected(b)} activeOpacity={0.85} style={s.cardBody}>
                <View style={s.cardTop}>
                  <Text style={s.batchCode}>{b.batchCode}</Text>
                  <Pill label={b.status} color={st.color} bg={st.bg} dot />
                  <Text style={s.relative}>{relative(b)}</Text>
                </View>

                {!!b.trekId && trekNames[b.trekId] && (
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={13} color={Colors.slate400} />
                    <Text style={s.metaText}>{trekNames[b.trekId]}</Text>
                  </View>
                )}

                <View style={s.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.slate400} />
                  <Text style={s.metaText}>{fmt(b.startDate)} → {fmt(b.endDate)}</Text>
                </View>

                <View style={s.metaRow}>
                  <Ionicons name="people-outline" size={13} color={Colors.slate400} />
                  <Text style={s.metaText}>{b.currentRegistrations}/{b.maxCapacity}</Text>
                  <View style={s.bar}>
                    <View style={[s.barFill, {
                      width: `${Math.min(100, (b.currentRegistrations / Math.max(1, b.maxCapacity)) * 100)}%` as any,
                      backgroundColor: b.currentRegistrations >= b.maxCapacity ? Colors.danger : Colors.primary,
                    }]} />
                  </View>
                </View>

                {!!b.assignedLeads?.length && (
                  <View style={s.leadRow}>
                    {b.assignedLeads.slice(0, 3).map((l, i) => (
                      <View key={i} style={s.leadPill}>
                        <Ionicons name="star" size={10} color="#a16207" />
                        <Text style={s.leadPillText}>{l.displayName}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>

              <View style={s.statusBar}>
                <Text style={s.statusLabel}>STATUS</Text>
                {STATUS_OPTIONS.map(opt => {
                  const active = b.status === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[s.statusBtn, active && s.statusBtnActive]}
                      onPress={() => setStatus(b, opt)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.statusBtnText, active && s.statusBtnTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={s.manageBtn} onPress={() => setSelected(b)} activeOpacity={0.85}>
                <Ionicons name="eye-outline" size={15} color={Colors.white} />
                <Text style={s.manageText}>Manage</Text>
              </TouchableOpacity>
            </Panel>
          );
        }}
        ListEmptyComponent={
          showAvailability ? null : loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="calendar-outline" title="No batches found" message="Try a different filter or search term." />
        }
      />

      {selected && <BatchDetailModal batch={selected} onClose={() => setSelected(null)} />}
      {showNewBatch && <BatchFormModal onClose={() => setShowNewBatch(false)} onSaved={load} />}
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },

  newBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 11 },
  newBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  tileRow: { gap: 10, paddingRight: 16 },
  chipRow: { gap: 7, paddingRight: 16 },

  showing:     { fontSize: 13, color: Colors.slate500 },
  showingBold: { fontWeight: '800', color: Colors.slate900 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  card:     { overflow: 'hidden' },
  cardBody: { padding: 14, gap: 7 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  batchCode:{ fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  relative: { fontSize: 11, color: Colors.slate400, marginLeft: 'auto' },

  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 12, color: Colors.slate500 },
  bar:      { flex: 1, height: 4, backgroundColor: Colors.slate100, borderRadius: 2, overflow: 'hidden', marginLeft: 4 },
  barFill:  { height: 4, borderRadius: 2 },

  leadRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  leadPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  leadPillText: { fontSize: 11, fontWeight: '700', color: '#a16207' },

  statusBar:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.slate100 },
  statusLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6, marginRight: 2 },
  statusBtn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200 },
  statusBtnActive: { backgroundColor: Colors.slate900, borderColor: Colors.slate900 },
  statusBtnText:   { fontSize: 11, fontWeight: '600', color: Colors.slate500 },
  statusBtnTextActive: { color: Colors.white },

  manageBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: 11 },
  manageText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
