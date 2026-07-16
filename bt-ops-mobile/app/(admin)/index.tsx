import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Stats {
  totalUpcomingBatches: number;
  totalActiveLeads: number;
  totalActiveTreks: number;
  completedBatchesThisMonth: number;
  pendingUsers: number;
}

const STAT_CARDS = [
  { key: 'totalUpcomingBatches',    label: 'Upcoming Batches',   icon: 'calendar',      color: Colors.info },
  { key: 'totalActiveLeads',        label: 'Active Leads',        icon: 'people',        color: Colors.success },
  { key: 'totalActiveTreks',        label: 'Active Treks',        icon: 'map',           color: Colors.primary },
  { key: 'completedBatchesThisMonth', label: 'Completed This Month', icon: 'checkmark-circle', color: Colors.warning },
];

export default function DashboardScreen() {
  const { profile } = useAuth();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/dashboard/stats');
      setStats(r.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting} 👋</Text>
            <Text style={s.name}>{profile?.displayName ?? 'Admin'}</Text>
          </View>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{profile?.role}</Text>
          </View>
        </View>

        {/* Stats grid */}
        <Text style={s.sectionTitle}>Overview</Text>
        <View style={s.grid}>
          {STAT_CARDS.map(card => (
            <Card key={card.key} style={s.statCard} padding={16}>
              <View style={[s.iconBox, { backgroundColor: card.color + '18' }]}>
                <Ionicons name={card.icon as any} size={20} color={card.color} />
              </View>
              <Text style={s.statValue}>{stats ? (stats as any)[card.key] : '—'}</Text>
              <Text style={s.statLabel}>{card.label}</Text>
            </Card>
          ))}
        </View>

        {stats?.pendingUsers ? (
          <Card style={s.alertCard} padding={14}>
            <View style={s.alertRow}>
              <Ionicons name="alert-circle" size={18} color={Colors.warning} />
              <Text style={s.alertText}>{stats.pendingUsers} user(s) pending approval</Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.gray50 },
  scroll:  { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting:  { fontSize: 13, color: Colors.gray500 },
  name:      { fontSize: 22, fontWeight: '700', color: Colors.gray900, marginTop: 2 },
  roleBadge: { backgroundColor: Colors.primaryBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText:  { fontSize: 12, fontWeight: '600', color: Colors.primary },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:     { width: '47%', gap: 8 },
  iconBox:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue:    { fontSize: 28, fontWeight: '800', color: Colors.gray900 },
  statLabel:    { fontSize: 12, color: Colors.gray500, fontWeight: '500' },

  alertCard: { backgroundColor: Colors.warningBg, borderColor: '#fde68a' },
  alertRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertText: { color: Colors.warning, fontWeight: '600', fontSize: 13 },
});
