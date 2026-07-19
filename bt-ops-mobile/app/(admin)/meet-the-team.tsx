import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, EmptyState } from '@/components/ui';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { confirmAction } from '@/utils/confirm';

interface Member {
  id: string; name: string; role?: string; title?: string; phone?: string;
  bio?: string; manages?: string[]; reach?: string; reportsTo?: string;
  founder?: boolean; colorKey?: string;
}

const COLOR_MAP: Record<string, string> = {
  Blue: '#3b82f6', Green: '#10b981', Amber: '#f59e0b', Sky: '#0ea5e9',
  Orange: '#f97316', Purple: '#8b5cf6', Pink: '#ec4899', Forest: '#15803d',
  Red: '#ef4444', Violet: '#7c3aed', Teal: '#14b8a6',
};
const colorFor = (m: Member) => COLOR_MAP[m.colorKey ?? 'Blue'] ?? COLOR_MAP.Blue;

const EMPTY = { name: '', role: '', title: '', phone: '', bio: '', reach: '', reportsTo: '', colorKey: 'Blue' };

export default function MeetTheTeamScreen() {
  const { profile } = useAuth();
  const isAdmin = ['Super Admin', 'Operations Manager'].includes(profile?.role ?? '');

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [founder, setFounder] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/team'); setMembers(r.data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const leadership = members.filter(m => m.founder);
  const team = members.filter(m => !m.founder);

  const openEdit = (m: Member | 'new') => {
    if (m === 'new') { setForm(EMPTY); setFounder(false); }
    else {
      setForm({
        name: m.name ?? '', role: m.role ?? '', title: m.title ?? '', phone: m.phone ?? '',
        bio: m.bio ?? '', reach: m.reach ?? '', reportsTo: m.reportsTo ?? '', colorKey: m.colorKey ?? 'Blue',
      });
      setFounder(!!m.founder);
    }
    setDetail(null);
    setEditing(m);
  };

  const save = async () => {
    if (!form.name.trim() || !form.role.trim()) {
      Alert.alert('Missing fields', 'Name and role are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, founder };
      if (editing === 'new') await api.post('/team', payload);
      else if (editing) await api.patch(`/team/${editing.id}`, payload);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save team member');
    } finally { setSaving(false); }
  };

  const remove = (m: Member) => {
    confirmAction('Remove member', `Remove ${m.name} from the team?`, 'Remove', async () => {
      try { await api.delete(`/team/${m.id}`); setDetail(null); load(); }
      catch { Alert.alert('Error', 'Could not remove member'); }
    });
  };

  const MemberCard = ({ m, large }: { m: Member; large?: boolean }) => {
    const color = colorFor(m);
    return (
      <TouchableOpacity
        style={[s.memberCard, large && { borderColor: color + '55', borderWidth: 2 }]}
        onPress={() => setDetail(m)}
        activeOpacity={0.8}
      >
        <View style={[s.memberAvatar, { backgroundColor: color }]}>
          <Text style={s.memberInitial}>{m.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.memberName} numberOfLines={1}>{m.name}</Text>
          <Text style={s.memberRole} numberOfLines={1}>{m.role}</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={() => openEdit(m)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="create-outline" size={16} color={Colors.slate400} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <PageTitle
          title="Meet the Team"
          subtitle="Who does what, and who to reach for"
          right={isAdmin ? (
            <TouchableOpacity style={s.addBtn} onPress={() => openEdit('new')} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color={Colors.white} />
            </TouchableOpacity>
          ) : undefined}
        />

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : members.length === 0 ? (
          <Panel style={{ marginTop: 16 }} padding={0}>
            <EmptyState icon="people-circle-outline" title="No team members yet" message="Team members added on the web app will appear here." />
          </Panel>
        ) : (
          <>
            {leadership.length > 0 && (
              <>
                <Text style={s.sectionLabel}>LEADERSHIP</Text>
                <View style={s.memberList}>
                  {leadership.map(m => <MemberCard key={m.id} m={m} large />)}
                </View>
              </>
            )}
            {team.length > 0 && (
              <>
                <Text style={s.sectionLabel}>TEAM</Text>
                <View style={s.memberList}>
                  {team.map(m => <MemberCard key={m.id} m={m} />)}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Member detail */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setDetail(null)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            {detail && (
              <ScrollView>
                <View style={s.sheetHeader}>
                  <View style={[s.sheetAvatar, { backgroundColor: colorFor(detail) }]}>
                    <Text style={s.sheetInitial}>{detail.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sheetName}>{detail.name}</Text>
                    <Text style={[s.sheetRole, { color: colorFor(detail) }]}>{detail.role}</Text>
                    {!!detail.title && <Text style={s.sheetTitle}>{detail.title}</Text>}
                  </View>
                </View>

                {!!detail.bio && <Text style={s.sheetBio}>{detail.bio}</Text>}

                {!!detail.manages?.length && (
                  <View style={s.sheetBlock}>
                    <Text style={s.sheetBlockLabel}>MANAGES</Text>
                    {detail.manages.map((x, i) => (
                      <View key={i} style={s.bullet}>
                        <View style={[s.bulletDot, { backgroundColor: colorFor(detail) }]} />
                        <Text style={s.bulletText}>{x}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!detail.reach && (
                  <View style={s.sheetBlock}>
                    <Text style={s.sheetBlockLabel}>REACH OUT FOR</Text>
                    <Text style={s.bulletText}>{detail.reach}</Text>
                  </View>
                )}

                {!!detail.reportsTo && (
                  <View style={s.sheetBlock}>
                    <Text style={s.sheetBlockLabel}>REPORTS TO</Text>
                    <Text style={s.bulletText}>{detail.reportsTo}</Text>
                  </View>
                )}

                {!!detail.phone && (
                  <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${detail.phone}`)} activeOpacity={0.85}>
                    <Ionicons name="call-outline" size={16} color={Colors.white} />
                    <Text style={s.callText}>{detail.phone}</Text>
                  </TouchableOpacity>
                )}

                {isAdmin && (
                  <View style={s.sheetActions}>
                    <TouchableOpacity style={s.sheetAction} onPress={() => openEdit(detail)}>
                      <Ionicons name="create-outline" size={15} color={Colors.slate700} />
                      <Text style={s.sheetActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.sheetAction} onPress={() => remove(detail)}>
                      <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                      <Text style={[s.sheetActionText, { color: Colors.danger }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add / edit */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.editSafe}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.slate900} />
            </TouchableOpacity>
            <Text style={s.editTitle}>{editing === 'new' ? 'Add Team Member' : 'Edit Member'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {([
              { key: 'name', label: 'Full name' },
              { key: 'role', label: 'Role (e.g. Summit Commander)' },
              { key: 'title', label: 'Title (e.g. CEO & Social Media Head)' },
              { key: 'phone', label: 'Phone' },
              { key: 'reportsTo', label: 'Reports to' },
              { key: 'bio', label: 'Bio', multiline: true },
              { key: 'reach', label: 'Reach out for', multiline: true },
            ] as const).map(f => (
              <View key={f.key} style={s.field}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput
                  style={[s.input, (f as any).multiline && s.textarea]}
                  multiline={(f as any).multiline}
                  value={form[f.key] ?? ''}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholderTextColor={Colors.slate400}
                  keyboardType={f.key === 'phone' ? 'phone-pad' : 'default'}
                />
              </View>
            ))}

            <View style={s.field}>
              <Text style={s.label}>Colour</Text>
              <View style={s.colorRow}>
                {Object.entries(COLOR_MAP).map(([key, col]) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.swatch, { backgroundColor: col }, form.colorKey === key && s.swatchActive]}
                    onPress={() => setForm(prev => ({ ...prev, colorKey: key }))}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity style={s.checkRow} onPress={() => setFounder(f => !f)} activeOpacity={0.7}>
              <Ionicons name={founder ? 'checkbox' : 'square-outline'} size={21} color={founder ? Colors.primary : Colors.slate300} />
              <Text style={s.checkLabel}>Show in Leadership section</Text>
            </TouchableOpacity>

            <Button title={editing === 'new' ? 'Add Member' : 'Save Changes'} onPress={save} loading={saving} />
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    </AppShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },

  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.slate400, letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  memberList:   { gap: 9 },

  memberCard:   { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.slate100, padding: 12 },
  memberAvatar: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  memberInitial:{ color: Colors.white, fontWeight: '800', fontSize: 16 },
  memberName:   { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  memberRole:   { fontSize: 12, color: Colors.slate500, marginTop: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet:    { backgroundColor: Colors.white, borderRadius: 20, padding: 20, maxHeight: '82%' },

  sheetHeader:  { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 14 },
  sheetAvatar:  { width: 56, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sheetInitial: { color: Colors.white, fontWeight: '800', fontSize: 24 },
  sheetName:    { fontSize: 18, fontWeight: '800', color: Colors.slate900 },
  sheetRole:    { fontSize: 13, fontWeight: '700', marginTop: 2 },
  sheetTitle:   { fontSize: 12, color: Colors.slate500, marginTop: 2 },
  sheetBio:     { fontSize: 13, color: Colors.slate600, lineHeight: 20, marginBottom: 14 },

  sheetBlock:      { marginBottom: 14, gap: 6 },
  sheetBlockLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.8 },
  bullet:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot:       { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  bulletText:      { flex: 1, fontSize: 13, color: Colors.slate600, lineHeight: 19 },

  callBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  callText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  sheetActions:   { flexDirection: 'row', gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: Colors.slate100, paddingTop: 14 },
  sheetAction:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.slate50 },
  sheetActionText:{ fontSize: 13, fontWeight: '600', color: Colors.slate700 },

  editSafe:   { flex: 1, backgroundColor: Colors.slate50 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle:  { fontSize: 17, fontWeight: '700', color: Colors.slate900 },
  field:      { gap: 6, marginBottom: 14 },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  input:      { minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  textarea:   { minHeight: 76, textAlignVertical: 'top' },

  colorRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  swatch:       { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  swatchActive: { borderColor: Colors.slate900 },

  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  checkLabel: { fontSize: 14, color: Colors.slate700 },
});
