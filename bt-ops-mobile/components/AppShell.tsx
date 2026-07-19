import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  Animated, Dimensions, Pressable, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { menuForRole, NavItem } from '@/constants/nav';
import { confirmAction } from '@/utils/confirm';
import api from '@/utils/api';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.82);

/**
 * Replicates the web app's fixed left sidebar (frontend/src/components/Sidebar.js)
 * as a slide-out drawer, since a permanent 15-item sidebar can't fit a phone.
 * Branding, section label, item order, active-state colour and the
 * "Logged in as / role / Logout" footer all match the web layout.
 */
function Drawer({ visible, onClose, unread }: { visible: boolean; onClose: () => void; unread: number }) {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 0 : -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, fade]);

  const items = menuForRole(profile?.role);

  const isActive = (item: NavItem) => {
    const target = item.path.replace('/(admin)', '');
    if (target === '/') return pathname === '/' || pathname === '/(admin)' || pathname === '/(admin)/';
    return pathname === target || pathname === item.path || pathname.startsWith(target + '/');
  };

  const go = (item: NavItem) => {
    onClose();
    // `replace` (not push) so drawer navigation swaps the screen instead of
    // stacking every visited page on top of each other.
    setTimeout(() => router.replace(item.path as any), 120);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      confirmAction('Sign out', 'Are you sure you want to sign out?', 'Logout', logout);
    }, 200);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[d.backdrop, { opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[d.panel, { transform: [{ translateX: slide }] }]}>
          {/* Inside a Modal, SafeAreaView edges are unreliable on iOS — pad
              manually from the real insets so the brand clears the status bar. */}
          <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            {/* Brand */}
            <View style={d.brand}>
              <View style={{ flex: 1 }}>
                <Text style={d.brandTitle}>BT Ops</Text>
                <Text style={d.brandSub}>Operations &amp; Finance</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={Colors.sidebarMuted} />
              </TouchableOpacity>
            </View>

            {/* Nav */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={d.navList}>
              <Text style={d.sectionLabel}>OPERATIONS</Text>
              {items.map(item => {
                const active = isActive(item);
                return (
                  <TouchableOpacity
                    key={item.path}
                    style={[d.navItem, active && d.navItemActive]}
                    onPress={() => go(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? Colors.white : Colors.sidebarText}
                    />
                    <Text style={[d.navLabel, active && d.navLabelActive]}>{item.label}</Text>
                    {!item.built && <Text style={d.soon}>soon</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Footer */}
            <View style={d.footer}>
              <TouchableOpacity
                style={d.navItem}
                onPress={() => go({ path: '/(admin)/notifications', label: 'Notifications', icon: 'notifications-outline', roles: [] })}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={18} color={Colors.sidebarText} />
                <Text style={d.navLabel}>Notifications</Text>
                {unread > 0 && (
                  <View style={d.badge}>
                    <Text style={d.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={d.userBlock}>
                <Text style={d.loggedInAs}>Logged in as</Text>
                <Text style={d.userName} numberOfLines={1}>{profile?.displayName ?? '—'}</Text>
                <Text style={d.userRole}>{profile?.role ?? ''}</Text>
              </View>

              <TouchableOpacity style={d.logout} onPress={handleLogout} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={16} color={Colors.sidebarText} />
                <Text style={d.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function AppShell({ children, scroll = false, refreshControl }: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<any>;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const router = useRouter();

  const loadUnread = useCallback(() => {
    api.get('/notifications/unread-count')
      .then(r => setUnread(r.data?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => { loadUnread(); }, [loadUnread]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { loadUnread(); setOpen(true); }} hitSlop={10} style={s.iconBtn}>
          <Ionicons name="menu" size={24} color={Colors.slate900} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.brandTitle}>BT Ops</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(admin)/notifications' as any)} hitSlop={10} style={s.iconBtn}>
          <Ionicons name="notifications-outline" size={22} color={Colors.slate700} />
          {unread > 0 && <View style={s.dot} />}
        </TouchableOpacity>
      </View>

      {scroll ? (
        <ScrollView contentContainerStyle={s.scrollBody} refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}

      <Drawer visible={open} onClose={() => setOpen(false)} unread={unread} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.slate50 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn:    { padding: 4 },
  brandTitle: { fontSize: 17, fontWeight: '800', color: Colors.slate900 },
  dot:        { position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  scrollBody: { padding: 16, paddingBottom: 40 },
});

const d = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: DRAWER_WIDTH, backgroundColor: Colors.sidebarBg,
  },
  brand: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: Colors.sidebarBorder,
  },
  brandTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  brandSub:   { fontSize: 11, color: Colors.sidebarMuted, marginTop: 2 },

  navList:      { paddingHorizontal: 12, paddingVertical: 14, gap: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.sidebarMuted, letterSpacing: 1, paddingHorizontal: 12, paddingBottom: 6 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
  },
  navItemActive: { backgroundColor: Colors.primary },
  navLabel:      { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.sidebarText },
  navLabelActive:{ color: Colors.white, fontWeight: '600' },
  soon:          { fontSize: 9, fontWeight: '700', color: Colors.sidebarMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  footer:  { padding: 12, borderTopWidth: 1, borderTopColor: Colors.sidebarBorder },
  badge:   { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },

  userBlock:  { paddingHorizontal: 10, paddingVertical: 12 },
  loggedInAs: { fontSize: 11, color: Colors.sidebarMuted },
  userName:   { fontSize: 14, fontWeight: '600', color: Colors.white, marginTop: 2 },
  userRole:   { fontSize: 11, color: Colors.sidebarAccent, marginTop: 1 },

  logout:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  logoutText: { fontSize: 14, color: Colors.sidebarText, fontWeight: '500' },
});
