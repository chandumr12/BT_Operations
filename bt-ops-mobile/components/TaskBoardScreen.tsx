import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Colors } from '@/constants/Colors';
import { TicketDetailModal, Ticket } from '@/components/TicketDetailModal';
import api from '@/utils/api';

const STATUS_FILTERS = ['All', 'Backlog', 'To Do', 'In Progress', 'In Review', 'Done', 'Blocked'];

const PRIORITY_COLOR: Record<string, string> = {
  Low: Colors.gray500, Medium: Colors.info, High: Colors.warning, Urgent: Colors.danger,
};

export function TaskBoardScreen({ title }: { title: string }) {
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Ticket | null | 'new'>(null);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const r = await api.get('/tickets', { params });
      setTickets(r.data.tickets ?? []);
    } catch {}
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.count}>{tickets.length}</Text>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.gray400} />
        <TextInput
          style={s.searchInput}
          placeholder="Search tasks…"
          placeholderTextColor={Colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity key={f} onPress={() => setStatusFilter(f)} style={[s.filterChip, statusFilter === f && s.filterChipActive]}>
            <Text style={[s.filterChipText, statusFilter === f && s.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={tickets}
        keyExtractor={t => t.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item: t }) => (
          <TouchableOpacity onPress={() => setSelected(t)} activeOpacity={0.85}>
            <Card padding={14} style={{ marginBottom: 10 }}>
              <View style={s.rowBetween}>
                <Text style={s.taskTitle} numberOfLines={1}>{t.title}</Text>
                <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLOR[t.priority] ?? Colors.gray400 }]} />
              </View>
              <View style={s.metaRow}>
                <View style={s.statusPill}><Text style={s.statusPillText}>{t.status}</Text></View>
                <Text style={s.metaText}>{t.category}</Text>
                {t.dueDate ? <Text style={s.metaText}>• due {t.dueDate}</Text> : null}
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkbox-outline" size={40} color={Colors.gray300} />
            <Text style={s.emptyText}>No tasks found</Text>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setSelected('new')}>
        <Ionicons name="add" size={26} color={Colors.white} />
      </TouchableOpacity>

      {selected && (
        <TicketDetailModal
          ticket={selected === 'new' ? null : selected}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.gray50 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title:      { fontSize: 22, fontWeight: '700', color: Colors.gray900, flex: 1 },
  count:      { fontSize: 13, color: Colors.gray500, backgroundColor: Colors.gray100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44 },
  searchInput:{ flex: 1, fontSize: 14, color: Colors.gray900 },
  filterRow:  { marginTop: 10, flexGrow: 0 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.gray100 },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.gray600 },
  filterChipTextActive: { color: Colors.white },
  list:       { padding: 16, paddingBottom: 90 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  taskTitle:  { fontSize: 15, fontWeight: '700', color: Colors.gray900, flex: 1 },
  priorityDot:{ width: 9, height: 9, borderRadius: 5 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statusPill: { backgroundColor: Colors.gray100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '600', color: Colors.gray600 },
  metaText:   { fontSize: 12, color: Colors.gray500 },
  empty:      { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText:  { color: Colors.gray400, fontSize: 14 },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
});
