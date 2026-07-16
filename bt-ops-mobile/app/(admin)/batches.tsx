import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Batch {
  id: string;
  batchCode: string;
  trekId: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  currentRegistrations: number;
  status: string;
  assignedLeads?: { displayName: string }[];
}

interface Trek { id: string; name: string; region: string; }

function BatchDetailModal({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [participants, setParticipants] = useState<any[]>([]);
  const [trek, setTrek] = useState<Trek | null>(null);

  useEffect(() => {
    api.get(`/batches/${batch.id}/participants`).then(r => setParticipants(r.data)).catch(() => {});
    if (batch.trekId) api.get(`/treks/${batch.trekId}`).then(r => setTrek(r.data)).catch(() => {});
  }, [batch.id]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={md.safe}>
        <View style={md.header}>
          <TouchableOpacity onPress={onClose} style={md.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={md.title}>{batch.batchCode}</Text>
          <StatusBadge status={batch.status} />
        </View>
        <ScrollView contentContainerStyle={md.content}>
          <Card padding={16} style={{ gap: 10 }}>
            <Row label="Trek"     value={trek?.name ?? batch.trekId} />
            <Row label="Dates"    value={`${batch.startDate} → ${batch.endDate}`} />
            <Row label="Capacity" value={`${batch.currentRegistrations} / ${batch.maxCapacity}`} />
            <Row label="Leads"    value={batch.assignedLeads?.map(l => l.displayName).join(', ') || '—'} />
          </Card>

          <Text style={md.sectionTitle}>Participants ({participants.length})</Text>
          {participants.map(p => (
            <Card key={p.id} padding={14} style={md.participantCard}>
              <View style={md.pRow}>
                <View>
                  <Text style={md.pName}>{p.fullName}</Text>
                  <Text style={md.pSub}>{p.contactNo}  •  {p.gender}, {p.age}y</Text>
                </View>
                <View style={[md.boardedDot, { backgroundColor: p.boarded ? Colors.success : Colors.gray300 }]} />
              </View>
            </Card>
          ))}
          {participants.length === 0 && <Text style={md.empty}>No participants yet</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={{ color: Colors.gray500, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color: Colors.gray900, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function BatchesScreen() {
  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [filtered,   setFiltered]   = useState<Batch[]>([]);
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Batch | null>(null);

  const load = async () => {
    try { const r = await api.get('/batches'); setBatches(r.data); setFiltered(r.data); } catch {}
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(batches.filter(b =>
      b.batchCode.toLowerCase().includes(q) || b.status.toLowerCase().includes(q)
    ));
  }, [search, batches]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Batches</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.gray400} />
        <TextInput
          style={s.searchInput}
          placeholder="Search batch code or status…"
          placeholderTextColor={Colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={b => b.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item: b }) => (
          <TouchableOpacity onPress={() => setSelected(b)} activeOpacity={0.85}>
            <Card style={s.batchCard} padding={16}>
              <View style={s.batchTop}>
                <Text style={s.batchCode}>{b.batchCode}</Text>
                <StatusBadge status={b.status} />
              </View>
              <Text style={s.batchDate}>{b.startDate} → {b.endDate}</Text>
              <View style={s.batchMeta}>
                <Ionicons name="people-outline" size={13} color={Colors.gray400} />
                <Text style={s.batchMetaText}>{b.currentRegistrations}/{b.maxCapacity} participants</Text>
                {b.assignedLeads?.length ? (
                  <>
                    <Text style={s.dot}>•</Text>
                    <Text style={s.batchMetaText}>{b.assignedLeads.length} lead(s)</Text>
                  </>
                ) : null}
              </View>
              {/* Capacity bar */}
              <View style={s.bar}>
                <View style={[s.barFill, {
                  width: `${Math.min(100, (b.currentRegistrations / b.maxCapacity) * 100)}%` as any,
                  backgroundColor: b.currentRegistrations >= b.maxCapacity ? Colors.danger : Colors.primary,
                }]} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No batches found</Text>}
      />

      {selected && <BatchDetailModal batch={selected} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.gray50 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title:      { fontSize: 22, fontWeight: '700', color: Colors.gray900, flex: 1 },
  count:      { fontSize: 13, color: Colors.gray500, backgroundColor: Colors.gray100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginTop: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 44 },
  searchInput:{ flex: 1, fontSize: 14, color: Colors.gray900 },
  list:       { paddingHorizontal: 16, gap: 10, paddingBottom: 24 },
  batchCard:  {},
  batchTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batchCode:  { fontSize: 16, fontWeight: '700', color: Colors.gray900 },
  batchDate:  { fontSize: 12, color: Colors.gray500, marginTop: 4 },
  batchMeta:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  batchMetaText: { fontSize: 12, color: Colors.gray500 },
  dot:        { color: Colors.gray300 },
  bar:        { height: 4, backgroundColor: Colors.gray100, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  barFill:    { height: 4, borderRadius: 2 },
  empty:      { textAlign: 'center', color: Colors.gray400, padding: 40 },
});

const md = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.gray50 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:  { padding: 4 },
  title:    { fontSize: 18, fontWeight: '700', color: Colors.gray900, flex: 1 },
  content:  { padding: 16, gap: 14, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginTop: 4 },
  participantCard: { gap: 4 },
  pRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pName:    { fontSize: 14, fontWeight: '600', color: Colors.gray900 },
  pSub:     { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  boardedDot: { width: 10, height: 10, borderRadius: 5 },
  empty:    { textAlign: 'center', color: Colors.gray400, padding: 20 },
});
