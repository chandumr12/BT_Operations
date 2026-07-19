import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/notifications').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (n: Notif) => {
    if (n.read) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    try { await api.patch(`/notifications/${n.id}/read`); } catch {}
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    try { await api.patch('/notifications/read-all'); } catch {}
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={s.markAll}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={n => n.id}
            contentContainerStyle={s.list}
            renderItem={({ item: n }) => (
              <TouchableOpacity onPress={() => markRead(n)} activeOpacity={0.8}>
                <Card padding={14} style={[s.card, !n.read && s.cardUnread]}>
                  <View style={s.row}>
                    {!n.read && <View style={s.dot} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.notifTitle}>{n.title}</Text>
                      <Text style={s.notifMsg}>{n.message}</Text>
                      <Text style={s.notifTime}>{timeAgo(n.createdAt)}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={40} color={Colors.gray300} />
                <Text style={s.emptyText}>No notifications yet</Text>
              </View>
            }
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
  markAll: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:    { padding: 16, gap: 10, paddingBottom: 32 },
  card:    { marginBottom: 0 },
  cardUnread: { borderColor: Colors.primary + '40', backgroundColor: Colors.primaryBg },
  row:     { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray900 },
  notifMsg:   { fontSize: 13, color: Colors.gray600, marginTop: 3 },
  notifTime:  { fontSize: 11, color: Colors.gray400, marginTop: 6 },
  empty:   { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { color: Colors.gray400, fontSize: 14 },
});
