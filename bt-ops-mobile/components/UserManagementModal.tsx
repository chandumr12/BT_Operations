import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ColorTile, SearchBar, Chip, Pill, Panel, Avatar, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt?: string;
}

const ROLES = ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'];

const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  'Super Admin':        { color: Colors.tileRose,   bg: '#ffe4e6' },
  'Operations Manager': { color: Colors.tilePurple, bg: '#ede9fe' },
  'Coordinator':         { color: '#0d9488',         bg: '#ccfbf1' },
  'Trek Lead':           { color: Colors.tileBlue,   bg: '#dbeafe' },
};

const fmt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(+d)) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Mirrors the web app's User Management dashboard (frontend/src/pages/
 * UserManagement.js) — 4 stat tiles, a Pending Approvals grid with
 * Approve/Reject, search + role-filter chips over the approved list, and
 * an inline role-change picker per row (a small centered <Modal> — safe
 * here since this screen has no AppShell/Drawer wrapper, so it's the only
 * native Modal ever mounted at once).
 */
export function UserManagementModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | string>('All');
  const [rolePickerFor, setRolePickerFor] = useState<AppUser | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users')
      .then(r => { setUsers(r.data); setError(null); })
      .catch((e: any) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); load(); setRefreshing(false); };

  const pending  = useMemo(() => users.filter(u => u.status === 'pending'), [users]);
  const approved = useMemo(() => users.filter(u => u.status === 'approved'), [users]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    ROLES.forEach(r => { c[r] = approved.filter(u => u.role === r).length; });
    return c;
  }, [approved]);

  const filtered = useMemo(() => {
    let list = approved;
    if (roleFilter !== 'All') list = list.filter(u => u.role === roleFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(u => u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    return list;
  }, [approved, roleFilter, search]);

  const approve = async (u: AppUser) => {
    setBusy(u.uid);
    setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, status: 'approved' } : x));
    try { await api.patch(`/users/${u.uid}/approve`); }
    catch { Alert.alert('Error', 'Could not approve user'); load(); }
    finally { setBusy(null); }
  };

  const reject = (u: AppUser) => {
    confirmAction('Reject request', 'This will reject and remove this access request permanently.', 'Reject', async () => {
      setBusy(u.uid);
      try { await api.delete(`/users/${u.uid}`); setUsers(prev => prev.filter(x => x.uid !== u.uid)); }
      catch { Alert.alert('Error', 'Could not reject request'); load(); }
      finally { setBusy(null); }
    });
  };

  const remove = (u: AppUser) => {
    confirmAction('Remove user', `${u.displayName || u.email} will lose all access immediately. This cannot be undone.`, 'Remove User', async () => {
      setBusy(u.uid);
      try { await api.delete(`/users/${u.uid}`); setUsers(prev => prev.filter(x => x.uid !== u.uid)); }
      catch { Alert.alert('Error', 'Could not remove user'); load(); }
      finally { setBusy(null); }
    });
  };

  const setRole = async (u: AppUser, role: string) => {
    setRolePickerFor(null);
    if (role === u.role) return;
    setBusy(u.uid);
    setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, role } : x));
    try { await api.patch(`/users/${u.uid}/role`, null, { params: { role } }); }
    catch { Alert.alert('Error', 'Could not update role'); load(); }
    finally { setBusy(null); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>User Management</Text>
          <Text style={s.sub}>Approve access requests · manage roles</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} hitSlop={10}>
          <Ionicons name="refresh-outline" size={20} color={Colors.slate500} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u.uid}
          contentContainerStyle={s.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 12 }}>
              {error && (
                <Panel style={s.errorPanel} padding={14}>
                  <View style={s.errorRow}>
                    <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                </Panel>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
                <ColorTile value={approved.length} label="Total Users" sub={`${pending.length} pending`} bg={Colors.tileNavy} icon="people-outline" />
                <ColorTile value={roleCounts['Super Admin']} label="Super Admins" bg={Colors.tileRose} icon="star-outline" />
                <ColorTile value={roleCounts['Trek Lead']} label="Trek Leads" bg={Colors.tileBlue} icon="shield-outline" />
                <ColorTile value={(roleCounts['Operations Manager'] ?? 0) + (roleCounts['Coordinator'] ?? 0)} label="Ops / Coords" bg={Colors.tilePurple} icon="briefcase-outline" />
              </ScrollView>

              {pending.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={s.sectionLabel}>Pending Approvals ({pending.length})</Text>
                  {pending.map(u => (
                    <Panel key={u.uid} padding={14} style={s.pendingCard}>
                      <View style={s.pendingTop}>
                        <Avatar name={u.displayName || u.email} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.name}>{u.displayName || u.email}</Text>
                          <Text style={s.email}>{u.email}</Text>
                        </View>
                        <Pill label="PENDING" color="#a16207" bg="#fef3c7" />
                      </View>
                      <Text style={s.requested}>Requested {fmt(u.createdAt)}</Text>
                      <View style={s.pendingActions}>
                        <TouchableOpacity style={s.approveBtn} onPress={() => approve(u)} disabled={busy === u.uid} activeOpacity={0.85}>
                          {busy === u.uid ? <ActivityIndicator size="small" color={Colors.white} /> : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} />
                              <Text style={s.approveBtnText}>Approve</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={s.rejectBtn} onPress={() => reject(u)} disabled={busy === u.uid}>
                          <Ionicons name="close-circle-outline" size={18} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </Panel>
                  ))}
                </View>
              )}

              <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or email…" />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                <Chip label="All" count={approved.length} active={roleFilter === 'All'} onPress={() => setRoleFilter('All')} />
                {ROLES.map(r => (
                  <Chip key={r} label={r} count={roleCounts[r]} active={roleFilter === r} onPress={() => setRoleFilter(r)} />
                ))}
              </ScrollView>

              <Text style={s.showing}>{filtered.length} users</Text>
            </View>
          }
          renderItem={({ item: u }) => {
            const rc = ROLE_COLOR[u.role] ?? { color: Colors.slate600, bg: Colors.slate100 };
            return (
              <Panel padding={12} style={s.row}>
                <Avatar name={u.displayName || u.email} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={s.name}>{u.displayName || u.email}</Text>
                    <Pill label={u.role} color={rc.color} bg={rc.bg} dot />
                  </View>
                  <Text style={s.email}>{u.email}</Text>
                  <Text style={s.joined}>Joined {fmt(u.createdAt)}</Text>
                </View>
                <View style={{ gap: 8, alignItems: 'flex-end' }}>
                  <TouchableOpacity style={s.roleBtn} onPress={() => setRolePickerFor(u)} disabled={busy === u.uid} activeOpacity={0.8}>
                    {busy === u.uid
                      ? <ActivityIndicator size="small" color={Colors.slate500} />
                      : <>
                          <View style={[s.roleDot, { backgroundColor: rc.color }]} />
                          <Text style={s.roleBtnText} numberOfLines={1}>{u.role}</Text>
                          <Ionicons name="chevron-down" size={13} color={Colors.slate400} />
                        </>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(u)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </Panel>
            );
          }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No users found" message="Try a different search or role filter." />}
        />
      )}

      {/* Role picker — a plain centered Modal; safe since this screen has no AppShell/Drawer of its own */}
      <Modal visible={!!rolePickerFor} transparent animationType="fade" onRequestClose={() => setRolePickerFor(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setRolePickerFor(null)}>
          <View style={s.pickerCard} onStartShouldSetResponder={() => true}>
            <Text style={s.pickerTitle}>Set role for {rolePickerFor?.displayName ?? rolePickerFor?.email}</Text>
            {ROLES.map(r => {
              const rc = ROLE_COLOR[r];
              const active = rolePickerFor?.role === r;
              return (
                <TouchableOpacity key={r} style={[s.pickerRow, active && { backgroundColor: rc.bg }]} onPress={() => rolePickerFor && setRole(rolePickerFor, r)} activeOpacity={0.7}>
                  <View style={[s.roleDot, { backgroundColor: rc.color }]} />
                  <Text style={[s.pickerRowText, active && { color: rc.color, fontWeight: '800' }]}>{r}</Text>
                  {active && <Ionicons name="checkmark" size={16} color={rc.color} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.slate50 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  title:   { fontSize: 17, fontWeight: '800', color: Colors.slate900 },
  sub:     { fontSize: 11, color: Colors.slate400, marginTop: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, paddingBottom: 40 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  tileRow: { gap: 10, paddingRight: 16 },
  chipRow: { gap: 7, paddingRight: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#a16207', textTransform: 'uppercase', letterSpacing: 0.6 },

  pendingCard: { borderColor: '#fde68a', backgroundColor: '#fffbeb', gap: 8 },
  pendingTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requested: { fontSize: 11, color: Colors.slate500 },
  pendingActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10 },
  approveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  rejectBtn: { width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#fee2e2' },

  showing: { fontSize: 12, color: Colors.slate400, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  email: { fontSize: 12, color: Colors.slate500, marginTop: 2 },
  joined: { fontSize: 11, color: Colors.slate400, marginTop: 2 },

  roleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.slate50, borderWidth: 1, borderColor: Colors.slate200, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, maxWidth: 150 },
  roleDot: { width: 7, height: 7, borderRadius: 3.5 },
  roleBtnText: { fontSize: 11, fontWeight: '700', color: Colors.slate700, flexShrink: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, width: '100%', maxWidth: 360, gap: 4 },
  pickerTitle: { fontSize: 12, fontWeight: '700', color: Colors.slate500, marginBottom: 6, paddingHorizontal: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10 },
  pickerRowText: { fontSize: 14, fontWeight: '600', color: Colors.slate700 },
});
