import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { GradientHeader, SearchBar, Chip, Pill, Panel, PRIORITY_STYLE } from '@/components/ui';
import { TicketDetailModal, Ticket } from '@/components/TicketDetailModal';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

const COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: 'Backlog',     label: 'Backlog',     dot: '#94a3b8' },
  { key: 'To Do',       label: 'To Do',       dot: '#3b82f6' },
  { key: 'In Progress', label: 'In Progress', dot: '#f59e0b' },
  { key: 'In Review',   label: 'In Review',   dot: '#8b5cf6' },
  { key: 'Done',        label: 'Done',        dot: '#10b981' },
  { key: 'Blocked',     label: 'Blocked',     dot: '#ef4444' },
];

const CATEGORIES = ['All', 'Operations', 'Sales', 'Content', 'Development', 'Trek Planning'];
const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['All', 'Backlog', 'To Do', 'In Progress', 'In Review', 'Done', 'Blocked'];

export default function TasksScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState<Ticket | null | 'new'>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/tickets', { params: { limit: 500 } });
      setTickets(r.data.tickets ?? []);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter(t =>
      (category === 'All' || t.category === category) &&
      (priority === 'All' || t.priority === priority) &&
      (status === 'All' || t.status === status) &&
      (!q || t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
    );
  }, [tickets, search, category, priority, status]);

  const activeFilterCount = [category, priority, status].filter(v => v !== 'All').length + (search.trim() ? 1 : 0);
  const clearFilters = () => { setSearch(''); setCategory('All'); setPriority('All'); setStatus('All'); };

  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const stripHtml = (v?: string) => (v ?? '').replace(/<[^>]+>/g, '').trim();

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <GradientHeader
          icon="time-outline"
          title="Task Board"
          subtitle={`${tickets.length} tasks · ${inProgress} in progress`}
          actionLabel="Create Task"
          onAction={() => setSelected('new')}
        />

        <View style={{ marginTop: 12, gap: 12 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search tasks..." />

          <View>
            <Text style={s.filterLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {CATEGORIES.map(c => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
            </ScrollView>
          </View>

          <View>
            <Text style={s.filterLabel}>Priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {PRIORITIES.map(p => <Chip key={p} label={p} active={priority === p} onPress={() => setPriority(p)} />)}
            </ScrollView>
          </View>

          <View>
            <Text style={s.filterLabel}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {STATUSES.map(st => <Chip key={st} label={st} active={status === st} onPress={() => setStatus(st)} />)}
            </ScrollView>
          </View>

          {activeFilterCount > 0 && (
            <View style={s.filterSummary}>
              <Text style={s.filterSummaryText}>
                {filtered.length} of {tickets.length} tasks shown
              </Text>
              <TouchableOpacity onPress={clearFilters} style={s.clearBtn} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={14} color={Colors.slate400} />
                <Text style={s.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
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
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.board}
            style={{ marginTop: 14 }}
          >
            {COLUMNS.map(col => {
              const items = filtered.filter(t => t.status === col.key);
              return (
                <View key={col.key} style={s.column}>
                  <View style={s.colHeader}>
                    <View style={[s.colDot, { backgroundColor: col.dot }]} />
                    <Text style={s.colTitle}>{col.label}</Text>
                    <Text style={s.colCount}>{items.length}</Text>
                  </View>

                  {items.length === 0 ? (
                    <View style={s.colEmpty}>
                      <Text style={s.colEmptyText}>No tasks</Text>
                    </View>
                  ) : (
                    items.map(t => {
                      const pr = PRIORITY_STYLE[t.priority] ?? { color: Colors.slate500, bg: Colors.slate100 };
                      const desc = stripHtml(t.description);
                      const assignee = t.assignees?.length
                        ? (t.assignees.length > 1 ? `${t.assignees.length} people` : (users[t.assignees[0]] ?? 'Assigned'))
                        : 'Unassigned';
                      return (
                        <TouchableOpacity key={t.id} onPress={() => setSelected(t)} activeOpacity={0.85}>
                          <Panel padding={12} style={s.taskCard}>
                            <Text style={s.taskTitle}>{t.title}</Text>
                            {!!desc && <Text style={s.taskDesc} numberOfLines={2}>{desc}</Text>}
                            <View style={s.taskPills}>
                              <Pill label={t.priority} color={pr.color} bg={pr.bg} dot />
                              <Pill label={t.category} color={Colors.gradientBlueTo} bg="#dbeafe" />
                            </View>
                            <View style={s.taskFooter}>
                              <Ionicons name="person-circle-outline" size={15} color={Colors.slate400} />
                              <Text style={s.taskAssignee}>{assignee}</Text>
                              {!!t.dueDate && (
                                <>
                                  <Ionicons name="calendar-outline" size={12} color={Colors.danger} style={{ marginLeft: 'auto' }} />
                                  <Text style={s.taskDue}>{t.dueDate}</Text>
                                </>
                              )}
                            </View>
                          </Panel>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      {selected && (
        <TicketDetailModal
          ticket={selected === 'new' ? null : selected}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </AppShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },

  filterLabel: { fontSize: 11, fontWeight: '700', color: Colors.slate500, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  chipRow:     { gap: 7, paddingRight: 16 },

  filterSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSummaryText: { fontSize: 12, color: Colors.slate500 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: Colors.slate500 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca', marginTop: 12 },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  board:  { gap: 12, paddingRight: 16 },
  column: { width: 268, gap: 10 },

  colHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 13, paddingVertical: 11 },
  colDot:    { width: 8, height: 8, borderRadius: 4 },
  colTitle:  { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.slate900 },
  colCount:  { fontSize: 13, fontWeight: '800', color: Colors.slate500 },

  colEmpty:     { borderWidth: 1, borderColor: Colors.slate200, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 26, alignItems: 'center' },
  colEmptyText: { fontSize: 12, color: Colors.slate400 },

  taskCard:     { gap: 7 },
  taskTitle:    { fontSize: 14, fontWeight: '700', color: Colors.slate900, lineHeight: 19 },
  taskDesc:     { fontSize: 12, color: Colors.slate500, lineHeight: 17 },
  taskPills:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  taskFooter:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  taskAssignee: { fontSize: 11, color: Colors.slate500, fontWeight: '500' },
  taskDue:      { fontSize: 11, color: Colors.danger, fontWeight: '600' },
});
