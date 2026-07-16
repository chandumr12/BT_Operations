import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Lead {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  status: string;
  role: string;
  assignedBatches?: number;
  totalTreks?: number;
}

interface LeadDetail extends Lead {
  batches?: { batchCode: string; startDate: string; status: string }[];
}

function LeadDetailModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);

  useEffect(() => {
    api.get(`/users/${lead.id}`).then(r => setDetail(r.data)).catch(() => setDetail(lead as LeadDetail));
  }, [lead.id]);

  const d = detail ?? lead;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={md.safe}>
        <View style={md.header}>
          <TouchableOpacity onPress={onClose} style={md.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={md.title}>{d.displayName}</Text>
          <StatusBadge status={d.status} />
        </View>

        <ScrollView contentContainerStyle={md.content}>
          <Card padding={16} style={{ gap: 12 }}>
            <InfoRow icon="mail-outline"   label={d.email} />
            {d.phone && <InfoRow icon="call-outline"   label={d.phone} />}
            <InfoRow icon="shield-outline" label={d.role} />
          </Card>

          {(d as LeadDetail).batches && (d as LeadDetail).batches!.length > 0 && (
            <>
              <Text style={md.sectionTitle}>Assigned Batches</Text>
              {(d as LeadDetail).batches!.map((b, i) => (
                <Card key={i} padding={14} style={md.batchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={md.batchCode}>{b.batchCode}</Text>
                    <Text style={md.batchDate}>{b.startDate}</Text>
                  </View>
                  <StatusBadge status={b.status} />
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function InfoRow({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={16} color={Colors.gray400} />
      <Text style={{ fontSize: 14, color: Colors.gray700, flex: 1 }}>{label}</Text>
    </View>
  );
}

function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={av.text}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  text:   { fontSize: 15, fontWeight: '700', color: Colors.primary },
});

export default function LeadsScreen() {
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [filtered,  setFiltered]  = useState<Lead[]>([]);
  const [search,    setSearch]    = useState('');
  const [refreshing,setRefreshing]= useState(false);
  const [selected,  setSelected]  = useState<Lead | null>(null);

  const load = async () => {
    try {
      const r = await api.get('/users?role=lead');
      setLeads(r.data); setFiltered(r.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(leads.filter(l =>
      l.displayName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    ));
  }, [search, leads]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const statusColor = (s: string) =>
    s === 'active' ? Colors.success : s === 'pending' ? Colors.warning : Colors.gray400;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Trek Leads</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.gray400} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name or email…"
          placeholderTextColor={Colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={l => l.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item: l }) => (
          <TouchableOpacity onPress={() => setSelected(l)} activeOpacity={0.85}>
            <Card padding={14} style={s.leadCard}>
              <View style={s.leadRow}>
                <Avatar name={l.displayName} />
                <View style={{ flex: 1 }}>
                  <Text style={s.leadName}>{l.displayName}</Text>
                  <Text style={s.leadEmail}>{l.email}</Text>
                </View>
                <View style={[s.statusDot, { backgroundColor: statusColor(l.status) }]} />
              </View>
              <View style={s.leadMeta}>
                {l.assignedBatches !== undefined && (
                  <View style={s.chip}>
                    <Ionicons name="layers-outline" size={11} color={Colors.gray500} />
                    <Text style={s.chipText}>{l.assignedBatches} batches</Text>
                  </View>
                )}
                {l.totalTreks !== undefined && (
                  <View style={s.chip}>
                    <Ionicons name="map-outline" size={11} color={Colors.gray500} />
                    <Text style={s.chipText}>{l.totalTreks} treks</Text>
                  </View>
                )}
                <View style={s.chip}>
                  <Text style={[s.chipText, { color: statusColor(l.status) }]}>{l.status}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color={Colors.gray300} />
            <Text style={s.emptyText}>No leads found</Text>
          </View>
        }
      />

      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} />}
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
  leadCard:   {},
  leadRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leadName:   { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  leadEmail:  { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  statusDot:  { width: 9, height: 9, borderRadius: 5 },
  leadMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginLeft: 54 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  chipText:   { fontSize: 11, fontWeight: '500', color: Colors.gray500 },
  empty:      { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText:  { color: Colors.gray400, fontSize: 14 },
});

const md = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.gray50 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:   { padding: 4 },
  title:     { fontSize: 18, fontWeight: '700', color: Colors.gray900, flex: 1 },
  content:   { padding: 16, gap: 14, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginTop: 4 },
  batchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batchCode: { fontSize: 14, fontWeight: '600', color: Colors.gray900 },
  batchDate: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
});
