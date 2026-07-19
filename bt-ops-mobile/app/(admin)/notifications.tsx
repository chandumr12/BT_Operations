import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Notif {
  id: string; title: string; message: string; type: string; read: boolean; createdAt: string;
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const mins = Math.floor(Math.max(0, Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/notifications'); setItems(r.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (n: Notif) => {
    if (n.read) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    try { await api.patch(`/notifications/${n.id}/read`); } catch {}
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    try { await api.patch('/notifications/read-all'); } catch {}
  };

  const unread = items.filter(n => !n.read).length;

  return (
    <AppShell>
      <FlatList
        data={items}
        keyExtractor={n => n.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <PageTitle
              title="Notifications"
              subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
              right={unread > 0 ? (
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={s.markAll}>Mark all read</Text>
                </TouchableOpacity>
              ) : undefined}
            />
          </View>
        }
        renderItem={({ item: n }) => (
          <TouchableOpacity onPress={() => markRead(n)} activeOpacity={0.8}>
            <Panel padding={14} style={!n.read ? s.unreadCard : undefined}>
              <View style={s.row}>
                {!n.read && <View style={s.dot} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{n.title}</Text>
                  <Text style={s.message}>{n.message}</Text>
                  <Text style={s.time}>{timeAgo(n.createdAt)}</Text>
                </View>
              </View>
            </Panel>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="notifications-off-outline" title="No notifications" message="You'll see batch assignments and updates here." />
        }
      />
    </AppShell>
  );
}

const s = StyleSheet.create({
  list:       { padding: 16, paddingBottom: 40, gap: 10 },
  markAll:    { fontSize: 12, fontWeight: '700', color: Colors.primary },
  unreadCard: { borderColor: Colors.primary + '55', backgroundColor: Colors.primaryBg },
  row:        { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5 },
  title:      { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  message:    { fontSize: 13, color: Colors.slate600, marginTop: 3, lineHeight: 18 },
  time:       { fontSize: 11, color: Colors.slate400, marginTop: 6 },
});
