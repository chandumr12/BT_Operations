import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/AppShell';
import { StatCard, Panel, Pill, STATUS_STYLE, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

interface Stats {
  totalUpcomingBatches: number;
  totalActiveLeads: number;
  totalActiveTreks: number;
  completedBatchesThisMonth: number;
  pendingUsers: number;
}

interface Batch {
  id: string; batchCode: string; startDate: string; endDate: string;
  status: string; currentRegistrations: number; maxCapacity: number;
}

const ADMIN_ROLES = ['Super Admin', 'Operations Manager'];

export default function DashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? '');

  const [stats, setStats] = useState<Stats | null>(null);
  const [myBatches, setMyBatches] = useState<Batch[]>([]);
  const [upcoming7d, setUpcoming7d] = useState<Batch[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, batchesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/batches'),
      ]);
      setStats(statsRes.data);
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 86400000);
      setUpcoming7d(
        (batchesRes.data as Batch[])
          .filter(b => { const d = new Date(b.startDate); return d >= today && d <= nextWeek; })
          .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
      );
      setError(null);
    } catch (e: any) { setError(describeError(e)); }

    try {
      const r = await api.get('/batches/my');
      setMyBatches(r.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const today = new Date().toISOString().split('T')[0];
  const upcomingList = myBatches
    .filter(b => b.status !== 'Completed' || b.startDate >= today)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  const completedList = myBatches
    .filter(b => b.status === 'Completed')
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
  const activeList = tab === 'upcoming' ? upcomingList : completedList;

  const statCards = isAdmin
    ? [
        { label: 'Upcoming Batches',     value: stats?.totalUpcomingBatches ?? 0,      icon: 'calendar-outline' as const,  tint: Colors.primary },
        { label: 'Active Treks',         value: stats?.totalActiveTreks ?? 0,          icon: 'triangle-outline' as const,  tint: Colors.primary },
        { label: 'Active Leads',         value: stats?.totalActiveLeads ?? 0,          icon: 'people-outline' as const,    tint: Colors.primary },
        { label: 'Completed This Month', value: stats?.completedBatchesThisMonth ?? 0, icon: 'checkmark-circle-outline' as const, tint: Colors.primary },
        { label: 'Pending Approvals',    value: stats?.pendingUsers ?? 0,              icon: 'warning-outline' as const,   tint: Colors.primary },
      ]
    : [
        { label: 'My Batches',      value: stats?.totalUpcomingBatches ?? 0,      icon: 'calendar-outline' as const, tint: Colors.primary },
        { label: 'Done This Month', value: stats?.completedBatchesThisMonth ?? 0, icon: 'checkmark-circle-outline' as const, tint: Colors.primary },
      ];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(+d)) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <AppShell scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      {/* Welcome banner — matches web hero */}
      <View style={s.hero}>
        <Text style={s.heroRole}>{(profile?.role ?? '').toUpperCase()}</Text>
        <Text style={s.heroTitle}>Welcome back, {profile?.displayName ?? 'there'}!</Text>
      </View>

      {error && (
        <Panel style={s.errorPanel} padding={14}>
          <View style={s.errorRow}>
            <Ionicons name="warning-outline" size={18} color={Colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        </Panel>
      )}

      {/* Stat cards */}
      <View style={s.grid}>
        {statCards.map(card => (
          <View key={card.label} style={s.gridItem}>
            <StatCard label={card.label} value={card.value} icon={card.icon} tint={card.tint} />
          </View>
        ))}
      </View>

      {/* My Assigned Batches */}
      <Panel padding={0} style={{ overflow: 'hidden' }}>
        <View style={s.panelHeader}>
          <View style={s.panelTitleRow}>
            <Ionicons name="calendar" size={19} color={Colors.primary} />
            <Text style={s.panelTitle}>My Assigned Batches</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/batches' as any)}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={s.tabBar}>
            {([
              { key: 'upcoming' as const, label: 'Upcoming', list: upcomingList },
              { key: 'completed' as const, label: 'Completed', list: completedList },
            ]).map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
                {t.list.length > 0 && (
                  <View style={s.tabCount}>
                    <Text style={s.tabCountText}>{t.list.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.panelBody}>
          {activeList.length === 0 ? (
            <Text style={s.emptyLine}>
              {tab === 'upcoming' ? 'No upcoming batches assigned.' : 'No completed batches yet.'}
            </Text>
          ) : (
            activeList.slice(0, 5).map(b => {
              const st = STATUS_STYLE[b.status] ?? { color: Colors.slate700, bg: Colors.slate100 };
              return (
                <View key={b.id} style={s.batchRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.batchTop}>
                      <Text style={s.batchCode}>{b.batchCode}</Text>
                      <Pill label={b.status} color={st.color} bg={st.bg} />
                    </View>
                    <Text style={s.batchDate}>{fmtDate(b.startDate)} → {fmtDate(b.endDate)}</Text>
                  </View>
                  <Text style={s.batchPax}>{b.currentRegistrations}/{b.maxCapacity}</Text>
                </View>
              );
            })
          )}
        </View>
      </Panel>

      {/* Upcoming Batches (Next 7 Days) — admin only, as on web */}
      {isAdmin && (
        <Panel padding={0} style={{ overflow: 'hidden', marginTop: 14 }}>
          <View style={s.panelHeader}>
            <View style={s.panelTitleRow}>
              <Ionicons name="trending-up" size={19} color={Colors.primary} />
              <Text style={s.panelTitle}>Upcoming Batches (Next 7 Days)</Text>
            </View>
          </View>
          <View style={s.panelBody}>
            {upcoming7d.length === 0 ? (
              <EmptyState icon="calendar-outline" title="Nothing scheduled" message="No batches scheduled for the next 7 days" />
            ) : (
              upcoming7d.map(b => {
                const st = STATUS_STYLE[b.status] ?? { color: Colors.slate700, bg: Colors.slate100 };
                return (
                  <View key={b.id} style={s.simpleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.batchCode}>{b.batchCode}</Text>
                      <Text style={s.batchDate}>{fmtDate(b.startDate)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Pill label={b.status} color={st.color} bg={st.bg} />
                      <Text style={s.batchPax}>{b.currentRegistrations}/{b.maxCapacity}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Panel>
      )}
    </AppShell>
  );
}

const s = StyleSheet.create({
  hero:      { backgroundColor: Colors.primary, borderRadius: 18, padding: 20, marginBottom: 14 },
  heroRole:  { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.4 },
  heroTitle: { fontSize: 23, fontWeight: '900', color: Colors.white, marginTop: 6, lineHeight: 29 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca', marginBottom: 14 },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  gridItem: { width: '48%', flexGrow: 1 },

  panelHeader:   { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle:    { fontSize: 15, fontWeight: '800', color: Colors.slate900, flex: 1 },
  viewAll:       { fontSize: 13, fontWeight: '700', color: Colors.primary },

  tabBar:       { flexDirection: 'row', gap: 4, backgroundColor: Colors.slate100, borderRadius: 12, padding: 4, marginTop: 12, alignSelf: 'flex-start' },
  tabBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  tabBtnActive: { backgroundColor: Colors.white },
  tabText:      { fontSize: 13, fontWeight: '600', color: Colors.slate500 },
  tabTextActive:{ color: Colors.primary },
  tabCount:     { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: Colors.primaryBg },
  tabCountText: { fontSize: 10, fontWeight: '900', color: Colors.primary },

  panelBody:  { padding: 14, gap: 10 },
  emptyLine:  { fontSize: 13, color: Colors.slate400, textAlign: 'center', paddingVertical: 20 },

  batchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate100, borderLeftWidth: 3, borderLeftColor: Colors.primary, padding: 13 },
  simpleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate100, padding: 13 },
  batchTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  batchCode: { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  batchDate: { fontSize: 12, color: Colors.slate500, marginTop: 3 },
  batchPax:  { fontSize: 12, color: Colors.slate400, fontWeight: '600' },
});
