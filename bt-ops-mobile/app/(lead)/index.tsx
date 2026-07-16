import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Batch {
  id: string;
  batchCode: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  currentRegistrations: number;
  status: string;
  trekName?: string;
}

interface Participant {
  id: string;
  fullName: string;
  contactNo: string;
  gender: string;
  age: number;
  boarded: boolean;
}

function ParticipantsModal({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/batches/${batch.id}/participants`)
      .then(r => setParticipants(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [batch.id]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={pm.safe}>
        <View style={pm.header}>
          <TouchableOpacity onPress={onClose} style={pm.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={pm.title}>{batch.batchCode}</Text>
            <Text style={pm.sub}>{batch.startDate} → {batch.endDate}</Text>
          </View>
          <StatusBadge status={batch.status} />
        </View>

        {/* Capacity bar */}
        <View style={pm.capRow}>
          <Text style={pm.capLabel}>{batch.currentRegistrations}/{batch.maxCapacity} participants</Text>
          <View style={pm.barBg}>
            <View style={[pm.barFill, {
              width: `${Math.min(100, (batch.currentRegistrations / batch.maxCapacity) * 100)}%` as any,
              backgroundColor: batch.currentRegistrations >= batch.maxCapacity ? Colors.danger : Colors.primary,
            }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={pm.list}>
          <Text style={pm.sectionTitle}>Participants ({participants.length})</Text>
          {loading && <Text style={pm.loading}>Loading…</Text>}
          {participants.map(p => (
            <Card key={p.id} padding={14} style={[pm.pCard, p.boarded && pm.pCardBoarded]}>
              <View style={pm.pRow}>
                <View style={{ flex: 1 }}>
                  <Text style={pm.pName}>{p.fullName}</Text>
                  <Text style={pm.pSub}>{p.contactNo}  •  {p.gender}, {p.age}y</Text>
                </View>
                <View style={[pm.boardedBadge, { backgroundColor: p.boarded ? Colors.successBg : Colors.gray100 }]}>
                  <Ionicons name={p.boarded ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={p.boarded ? Colors.success : Colors.gray400} />
                  <Text style={[pm.boardedText, { color: p.boarded ? Colors.success : Colors.gray400 }]}>
                    {p.boarded ? 'Boarded' : 'Pending'}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
          {!loading && participants.length === 0 && (
            <Text style={pm.empty}>No participants yet</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function LeadBatchesScreen() {
  const { profile } = useAuth();
  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Batch | null>(null);

  const load = async () => {
    try {
      const r = await api.get('/lead/my-batches');
      setBatches(r.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const upcoming = batches.filter(b => ['upcoming', 'confirmed'].includes(b.status));
  const past     = batches.filter(b => !['upcoming', 'confirmed'].includes(b.status));

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
        <View style={s.countBadge}>
          <Text style={s.countText}>{batches.length}</Text>
        </View>
      </View>

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

      {selected && <ParticipantsModal batch={selected} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.gray50 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  greeting:  { fontSize: 13, color: Colors.gray500 },
  title:     { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  countBadge:{ backgroundColor: Colors.primaryBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
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
});

const pm = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.gray50 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:  { padding: 4 },
  title:    { fontSize: 17, fontWeight: '700', color: Colors.gray900 },
  sub:      { fontSize: 12, color: Colors.gray500, marginTop: 1 },
  capRow:   { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, gap: 8 },
  capLabel: { fontSize: 13, color: Colors.gray600, fontWeight: '500' },
  barBg:    { height: 6, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
  list:     { padding: 16, gap: 10, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 4 },
  loading:  { color: Colors.gray400, textAlign: 'center', padding: 20 },
  pCard:    {},
  pCardBoarded: { borderColor: Colors.success + '40' },
  pRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pName:    { fontSize: 14, fontWeight: '600', color: Colors.gray900 },
  pSub:     { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  boardedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  boardedText:  { fontSize: 11, fontWeight: '600' },
  empty:    { textAlign: 'center', color: Colors.gray400, padding: 20 },
});
