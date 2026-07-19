import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, SearchBar, Chip, StatCard, Panel, Pill, Avatar, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

interface LeadPerf {
  userId: string; displayName: string; email: string; phone: string;
  totalBatches: number; completedBatches: number; upcomingBatches: number;
  ongoingBatches: number; uniqueTreks: number;
  lastBatchDate: string | null; inactive: boolean;
  recentBatches: { id: string; trekName: string; status: string; startDate: string }[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeadPerformanceScreen() {
  const [leads, setLeads] = useState<LeadPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.get('/analytics/lead-performance'); setLeads(r.data); setError(null); }
    catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const activeCount = leads.filter(l => !l.inactive).length;
  const inactiveCount = leads.filter(l => l.inactive).length;
  const batchesDone = leads.reduce((s, l) => s + l.completedBatches, 0);
  const top = leads[0];

  const filtered = useMemo(() => {
    let list = leads;
    if (filter === 'Active') list = list.filter(l => !l.inactive);
    if (filter === 'Inactive') list = list.filter(l => l.inactive);
    const q = search.toLowerCase();
    if (q) list = list.filter(l => l.displayName?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q));
    return list;
  }, [leads, filter, search]);

  const fmt = (iso: string | null) => {
    if (!iso) return 'never';
    const d = new Date(iso);
    if (isNaN(+d)) return 'never';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <AppShell>
      <FlatList
        data={filtered}
        keyExtractor={l => l.userId}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <PageTitle title="Lead Performance" subtitle="Trek lead activity, batch completion and availability" />

            <View style={s.grid}>
              <View style={s.gridItem}><StatCard label="Total Leads"    value={leads.length}   icon="people-outline"        tint={Colors.gradientBlueTo} /></View>
              <View style={s.gridItem}><StatCard label="Active (30d)"   value={activeCount}    icon="pulse-outline"         tint={Colors.success} /></View>
              <View style={s.gridItem}><StatCard label="Inactive (30d)" value={inactiveCount}  icon="alert-circle-outline"  tint={Colors.danger} /></View>
              <View style={s.gridItem}><StatCard label="Batches Done"   value={batchesDone}    icon="trophy-outline"        tint={Colors.warning} /></View>
            </View>

            {top && top.completedBatches > 0 && (
              <Panel style={s.topCard} padding={14}>
                <View style={s.topRow}>
                  <Text style={{ fontSize: 20 }}>🏆</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.topLabel}>TOP PERFORMER</Text>
                    <Text style={s.topName}>{top.displayName}</Text>
                  </View>
                  <View style={s.topStats}>
                    <View style={s.topStat}><Text style={[s.topStatNum, { color: Colors.success }]}>{top.completedBatches}</Text><Text style={s.topStatLabel}>Completed</Text></View>
                    <View style={s.topStat}><Text style={[s.topStatNum, { color: Colors.gradientBlueTo }]}>{top.totalBatches}</Text><Text style={s.topStatLabel}>Assigned</Text></View>
                    <View style={s.topStat}><Text style={[s.topStatNum, { color: Colors.warning }]}>{top.uniqueTreks}</Text><Text style={s.topStatLabel}>Trek Types</Text></View>
                  </View>
                </View>
              </Panel>
            )}

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or email..." />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <Chip label={`All (${leads.length})`}        active={filter === 'All'}      onPress={() => setFilter('All')}      activeBg={Colors.gradientBlueTo} />
              <Chip label={`Active (${activeCount})`}      active={filter === 'Active'}   onPress={() => setFilter('Active')}   activeBg={Colors.gradientBlueTo} />
              <Chip label={`Inactive (${inactiveCount})`}  active={filter === 'Inactive'} onPress={() => setFilter('Inactive')} activeBg={Colors.gradientBlueTo} />
            </ScrollView>
          </View>
        }
        renderItem={({ item: l, index }) => {
          const pct = l.totalBatches > 0 ? Math.round((l.completedBatches / l.totalBatches) * 100) : 0;
          const open = expanded === l.userId;
          return (
            <Panel padding={14} style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => setExpanded(open ? null : l.userId)} activeOpacity={0.8}>
                <View style={s.leadRow}>
                  <Text style={s.rank}>{index < 3 ? MEDALS[index] : `#${index + 1}`}</Text>
                  <Avatar name={l.displayName} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.leadName} numberOfLines={1}>{l.displayName}</Text>
                    <Text style={s.leadEmail} numberOfLines={1}>{l.email}</Text>
                  </View>
                  <Pill
                    label={l.inactive ? 'Inactive' : 'Active'}
                    color={l.inactive ? Colors.danger : Colors.success}
                    bg={l.inactive ? Colors.dangerBg : Colors.successBg}
                    dot
                  />
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.slate400} />
                </View>

                <View style={s.statRow}>
                  <View style={s.statCell}><Text style={[s.statNum, { color: Colors.success }]}>{l.completedBatches}</Text><Text style={s.statLabel}>Done</Text></View>
                  <View style={s.statCell}><Text style={[s.statNum, { color: Colors.gradientBlueTo }]}>{l.totalBatches}</Text><Text style={s.statLabel}>Total</Text></View>
                  <View style={s.statCell}><Text style={[s.statNum, { color: Colors.warning }]}>{l.uniqueTreks}</Text><Text style={s.statLabel}>Treks</Text></View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.pctText}>{pct}%</Text>
                    <View style={s.bar}>
                      <View style={[s.barFill, { width: `${pct}%` as any }]} />
                    </View>
                  </View>
                </View>

                <View style={s.lastRow}>
                  <Ionicons name="time-outline" size={12} color={Colors.slate400} />
                  <Text style={s.lastText}>Last batch {fmt(l.lastBatchDate)}</Text>
                </View>
              </TouchableOpacity>

              {open && !!l.recentBatches?.length && (
                <View style={s.recentList}>
                  <Text style={s.recentLabel}>RECENT BATCHES</Text>
                  {l.recentBatches.map(b => (
                    <View key={b.id} style={s.recentRow}>
                      <Text style={s.recentName} numberOfLines={1}>{b.trekName || 'Trek'}</Text>
                      <Text style={s.recentStatus}>{b.status}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Panel>
          );
        }}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="trending-up-outline" title="No lead data" message="Performance appears once leads are assigned to batches." />
        }
      />
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 10 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },

  topCard:      { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topLabel:     { fontSize: 9, fontWeight: '800', color: Colors.warning, letterSpacing: 0.8 },
  topName:      { fontSize: 16, fontWeight: '800', color: Colors.slate900, marginTop: 2 },
  topStats:     { flexDirection: 'row', gap: 12 },
  topStat:      { alignItems: 'center' },
  topStatNum:   { fontSize: 16, fontWeight: '900' },
  topStatLabel: { fontSize: 9, color: Colors.slate500, marginTop: 1 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  chipRow: { gap: 7, paddingRight: 16 },

  leadRow:   { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rank:      { fontSize: 13, width: 26, textAlign: 'center' },
  leadName:  { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  leadEmail: { fontSize: 11, color: Colors.slate400, marginTop: 2 },

  statRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  statCell:  { alignItems: 'center' },
  statNum:   { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 9, color: Colors.slate400, marginTop: 1 },
  pctText:   { fontSize: 11, fontWeight: '700', color: Colors.slate500, textAlign: 'right' },
  bar:       { height: 5, backgroundColor: Colors.slate100, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: 5, borderRadius: 3, backgroundColor: Colors.gradientBlueTo },

  lastRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lastText: { fontSize: 11, color: Colors.slate400 },

  recentList:   { borderTopWidth: 1, borderTopColor: Colors.slate100, paddingTop: 10, gap: 7 },
  recentLabel:  { fontSize: 9, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.8 },
  recentRow:    { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  recentName:   { fontSize: 12, color: Colors.slate700, flex: 1 },
  recentStatus: { fontSize: 11, color: Colors.slate400, textTransform: 'capitalize' },
});
