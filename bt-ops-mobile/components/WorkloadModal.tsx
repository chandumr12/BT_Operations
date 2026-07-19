import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator, TextInput } from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Workload {
  assignee: string;
  totalTickets: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  totalEstimatedHours: number;
  tickets: { id: string; title: string; priority: string; status: string; dueDate?: string }[];
}

export function WorkloadModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/tickets/analytics/workload').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => i.assignee.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.totalTickets - a.totalTickets);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={s.title}>Workload</Text>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.gray400} />
          <TextInput style={s.searchInput} placeholder="Search team member…" placeholderTextColor={Colors.gray400} value={search} onChangeText={setSearch} />
        </View>

        {loading ? (
          <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.assignee}
            contentContainerStyle={s.list}
            renderItem={({ item: w }) => {
              const isOpen = expanded === w.assignee;
              return (
                <Card padding={14} style={{ marginBottom: 10 }}>
                  <TouchableOpacity onPress={() => setExpanded(isOpen ? null : w.assignee)}>
                    <View style={s.rowBetween}>
                      <Text style={s.name}>{w.assignee}</Text>
                      <View style={s.countBadge}><Text style={s.countText}>{w.totalTickets} active</Text></View>
                    </View>
                    <View style={s.priorityRow}>
                      {Object.entries(w.byPriority).filter(([, n]) => n > 0).map(([p, n]) => (
                        <View key={p} style={s.priorityChip}>
                          <Text style={s.priorityChipText}>{p}: {n}</Text>
                        </View>
                      ))}
                      {w.totalEstimatedHours > 0 && (
                        <View style={s.priorityChip}><Text style={s.priorityChipText}>{w.totalEstimatedHours}h est.</Text></View>
                      )}
                    </View>
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={s.ticketList}>
                      {w.tickets.map(t => (
                        <View key={t.id} style={s.ticketRow}>
                          <Text style={s.ticketTitle} numberOfLines={1}>{t.title}</Text>
                          <Text style={s.ticketStatus}>{t.status}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              );
            }}
            ListEmptyComponent={<Text style={s.empty}>No active tasks</Text>}
          />
        )}
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.gray50 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.gray900, flex: 1 },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44 },
  searchInput:{ flex: 1, fontSize: 14, color: Colors.gray900 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:    { padding: 16, paddingTop: 4, paddingBottom: 40 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:    { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  countBadge: { backgroundColor: Colors.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText:  { fontSize: 11, fontWeight: '600', color: Colors.primary },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  priorityChip: { backgroundColor: Colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  priorityChipText: { fontSize: 11, fontWeight: '600', color: Colors.gray600 },
  ticketList: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 8 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ticketTitle: { fontSize: 12, color: Colors.gray700, flex: 1 },
  ticketStatus: { fontSize: 11, color: Colors.gray400 },
  empty:   { textAlign: 'center', color: Colors.gray400, padding: 40 },
});
