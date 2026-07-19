import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { BatchDetailModal, BatchSummary } from '@/components/BatchDetailModal';
import { NotificationsModal } from '@/components/NotificationsModal';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

interface Batch extends BatchSummary {
  trekName?: string;
}

const UPCOMING_STATUSES = ['Open', 'Filling Fast', 'Full'];

export default function LeadBatchesScreen() {
  const { profile } = useAuth();
  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Batch | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread,     setUnread]     = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await api.get('/batches/my');
      const list: Batch[] = r.data;
      // Attach trek names (best-effort, ignore failures)
      const trekIds = Array.from(new Set(list.map(b => b.trekId).filter(Boolean)));
      const treks = await Promise.all(trekIds.map(id => api.get(`/treks/${id}`).then(r2 => r2.data).catch(() => null)));
      const trekMap: Record<string, string> = {};
      treks.forEach(t => { if (t) trekMap[t.id] = t.name; });
      setBatches(list.map(b => ({ ...b, trekName: b.trekId ? trekMap[b.trekId] : undefined })));
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
    try {
      const r = await api.get('/notifications/unread-count');
      setUnread(r.data?.count ?? 0);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const upcoming = batches.filter(b => UPCOMING_STATUSES.includes(b.status));

  const renderBatch = ({ item: b }: { item: Batch }) => (
    <TouchableOpacity onPress={() => setSelected(b)} activeOpacity={0.85}>
      <Card padding={16} style={s.batchCard}>
        <View style={s.batchTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.batchCode}>{b.batchCode}</Text>
            {b.trekName && <Text style={s.trekName}>{b.trekName}</Text>}
          </View>
          <StatusBadge status={b.status} />
        </View>
        <View style={s.dateRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.gray400} />
          <Text style={s.dateText}>{b.startDate} → {b.endDate}</Text>
        </View>
        <View style={s.capRow}>
          <Ionicons name="people-outline" size={13} color={Colors.gray400} />
          <Text style={s.capText}>{b.currentRegistrations}/{b.maxCapacity}</Text>
          <View style={s.bar}>
            <View style={[s.barFill, {
              width: `${Math.min(100, (b.currentRegistrations / b.maxCapacity) * 100)}%` as any,
              backgroundColor: b.currentRegistrations >= b.maxCapacity ? Colors.danger : Colors.primary,
            }]} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {profile?.displayName?.split(' ')[0] ?? 'Lead'}</Text>
          <Text style={s.title}>My Batches</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={s.bellBtn} onPress={() => setShowNotifs(true)}>
            <Ionicons name="notifications-outline" size={20} color={Colors.gray700} />
            {unread > 0 && <View style={s.bellDot} />}
          </TouchableOpacity>
          <View style={s.countBadge}>
            <Text style={s.countText}>{batches.length}</Text>
          </View>
        </View>
      </View>

      {error && (
        <Card style={s.errorCard} padding={14}>
          <View style={s.errorRow}>
            <Ionicons name="warning-outline" size={18} color={Colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        </Card>
      )}

      <FlatList
        data={batches}
        keyExtractor={b => b.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <>
            {upcoming.length > 0 && <Text style={s.sectionLabel}>Upcoming ({upcoming.length})</Text>}
          </>
        }
        renderItem={renderBatch}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="layers-outline" size={40} color={Colors.gray300} />
            <Text style={s.emptyText}>No batches assigned</Text>
          </View>
        }
      />

      {selected && <BatchDetailModal batch={selected} onClose={() => setSelected(null)} />}
      {showNotifs && <NotificationsModal onClose={() => { setShowNotifs(false); load(); }} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.gray50 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  greeting:  { fontSize: 13, color: Colors.gray500 },
  title:     { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  bellBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  bellDot:   { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  countBadge:{ backgroundColor: Colors.primaryBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  countText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  list:      { padding: 16, gap: 10, paddingBottom: 24 },
  batchCard: {},
  batchTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  batchCode: { fontSize: 16, fontWeight: '700', color: Colors.gray900 },
  trekName:  { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dateText:  { fontSize: 12, color: Colors.gray500 },
  capRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  capText:   { fontSize: 12, color: Colors.gray500, minWidth: 40 },
  bar:       { flex: 1, height: 4, backgroundColor: Colors.gray100, borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: 4, borderRadius: 2 },
  empty:     { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { color: Colors.gray400, fontSize: 14 },
  errorCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },
});
