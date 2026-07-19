import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, SearchBar, StatCard, Panel, Pill, Avatar, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

interface Workload {
  assignee: string;
  totalTickets: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  totalEstimatedHours: number;
  tickets: { id: string; title: string; priority: string; status: string; dueDate?: string }[];
}

const CAPACITY = 15;

export default function WorkloadScreen() {
  const [items, setItems] = useState<Workload[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/tickets/analytics/workload');
      setItems(r.data);
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); }

    try {
      const r = await api.get('/users/basic');
      const map: Record<string, string> = {};
      r.data.forEach((u: any) => { map[u.uid] = u.displayName; });
      setUsers(map);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const nameFor = (assignee: string) =>
    assignee === 'Unassigned' ? 'Unassigned' : (users[assignee] ?? assignee);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    return [...items]
      .filter(w => !q || nameFor(w.assignee).toLowerCase().includes(q))
      .sort((a, b) => b.totalTickets - a.totalTickets);
  }, [items, search, users]);

  const totalActive = items.reduce((s, w) => s + w.totalTickets, 0);
  const avgPerPerson = items.length ? (totalActive / items.length).toFixed(1) : '0';
  const overloaded = items.filter(w => w.totalTickets > 10).length;

  const loadLabel = (n: number) =>
    n > 10 ? { label: 'Overloaded', color: Colors.danger, bg: Colors.dangerBg }
    : n >= 6 ? { label: 'Heavy', color: '#ea580c', bg: '#ffedd5' }
    : n >= 3 ? { label: 'Moderate', color: '#ca8a04', bg: '#fef9c3' }
    : { label: 'Light', color: Colors.success, bg: Colors.successBg };

  return (
    <AppShell>
      <FlatList
        data={sorted}
        keyExtractor={w => w.assignee}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <PageTitle title="Team Workload" subtitle="Monitor capacity and task distribution across your team" />

            <View style={s.grid}>
              <View style={s.gridItem}>
                <StatCard label="Active Tasks" value={totalActive} icon="trending-up-outline" tint={Colors.gradientBlueTo} />
              </View>
              <View style={s.gridItem}>
                <StatCard label="Team Members" value={items.length} icon="people-outline" tint="#8b5cf6" />
              </View>
              <View style={s.gridItem}>
                <StatCard label="Avg / Person" value={avgPerPerson} icon="checkmark-circle-outline" tint={Colors.success} />
              </View>
              <View style={s.gridItem}>
                <StatCard label="Overloaded" value={overloaded} icon="alert-circle-outline" tint={Colors.danger} />
              </View>
            </View>

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}

            <Text style={s.sectionTitle}>Team Members ({items.length})</Text>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search member..." />
          </View>
        }
        renderItem={({ item: w, index }) => {
          const name = nameFor(w.assignee);
          const open = expanded === w.assignee;
          const lbl = loadLabel(w.totalTickets);
          const pct = Math.min(100, Math.round((w.totalTickets / CAPACITY) * 100));
          return (
            <Panel padding={14} style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => setExpanded(open ? null : w.assignee)} activeOpacity={0.8}>
                <View style={s.memberRow}>
                  <Text style={s.rank}>{index + 1}</Text>
                  <Avatar name={name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName} numberOfLines={1}>{name}</Text>
                    <Text style={s.memberSub}>{w.totalTickets} active tasks</Text>
                  </View>
                  <Pill label={lbl.label} color={lbl.color} bg={lbl.bg} />
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.slate400} />
                </View>

                <View style={s.capBlock}>
                  <View style={s.capLabelRow}>
                    <Text style={s.capLabel}>Capacity</Text>
                    <Text style={[s.capPct, { color: lbl.color }]}>{pct}%</Text>
                  </View>
                  <View style={s.capBar}>
                    <View style={[s.capFill, { width: `${pct}%` as any, backgroundColor: lbl.color }]} />
                  </View>
                  <View style={s.capLabelRow}>
                    <Text style={s.capEdge}>0</Text>
                    <Text style={s.capEdge}>{CAPACITY} tasks</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {open && (
                <View style={s.ticketList}>
                  {w.tickets.map(t => (
                    <View key={t.id} style={s.ticketRow}>
                      <Text style={s.ticketTitle} numberOfLines={1}>{t.title}</Text>
                      <Text style={s.ticketStatus}>{t.status}</Text>
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
            : <EmptyState icon="bar-chart-outline" title="No active tasks" message="Nothing is currently assigned across the team." />
        }
      />
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 10 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.slate900, marginTop: 4 },

  memberRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank:       { fontSize: 12, fontWeight: '700', color: Colors.slate400, width: 14 },
  memberName: { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  memberSub:  { fontSize: 11, color: Colors.slate500, marginTop: 2 },

  capBlock:    { marginTop: 10, gap: 5 },
  capLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  capLabel:    { fontSize: 11, color: Colors.slate500, fontWeight: '600' },
  capPct:      { fontSize: 12, fontWeight: '800' },
  capBar:      { height: 7, backgroundColor: Colors.slate100, borderRadius: 4, overflow: 'hidden' },
  capFill:     { height: 7, borderRadius: 4 },
  capEdge:     { fontSize: 10, color: Colors.slate400 },

  ticketList:   { borderTopWidth: 1, borderTopColor: Colors.slate100, paddingTop: 10, gap: 8 },
  ticketRow:    { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ticketTitle:  { fontSize: 12, color: Colors.slate700, flex: 1 },
  ticketStatus: { fontSize: 11, color: Colors.slate400 },
});
