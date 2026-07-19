import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { GradientHeader, SearchBar, Chip, Pill, Panel, Avatar, EmptyState } from '@/components/ui';
import { LeadFormModal } from '@/components/LeadFormModal';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

interface Lead {
  id: string; name: string; phone?: string; email?: string;
  age?: number; gender?: string; active?: boolean; hiredDate?: string;
  languages?: string[]; specialSkills?: string[]; status?: string;
}

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'approved' | 'pending'>('approved');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [showAddLead, setShowAddLead] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/leads');
      setLeads(r.data);
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const approved = leads.filter(l => l.status !== 'pending');
  const pending = leads.filter(l => l.status === 'pending');

  const filtered = useMemo(() => {
    let list = tab === 'approved' ? approved : pending;
    if (statusFilter !== 'All') {
      list = list.filter(l => (statusFilter === 'Active' ? l.active !== false : l.active === false));
    }
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.languages?.some(x => x.toLowerCase().includes(q)) ||
        l.specialSkills?.some(x => x.toLowerCase().includes(q))
      );
    }
    return list;
  }, [leads, tab, statusFilter, search, approved, pending]);

  const activeCount = approved.filter(l => l.active !== false).length;

  const remove = (l: Lead) => {
    confirmAction('Delete lead', `Remove ${l.name}?`, 'Delete', async () => {
      try { await api.delete(`/leads/${l.id}`); load(); }
      catch { Alert.alert('Error', 'Could not delete lead'); }
    });
  };

  const approve = async (l: Lead) => {
    try { await api.post(`/leads/${l.id}/approve`); load(); }
    catch { Alert.alert('Error', 'Could not approve lead'); }
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(+d)) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <AppShell>
      <FlatList
        data={filtered}
        keyExtractor={l => l.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <GradientHeader
              icon="people-outline"
              title="Lead Management"
              subtitle={`${activeCount} active · ${leads.length} total`}
              actionLabel="Add New Lead"
              onAction={() => setShowAddLead(true)}
            />

            <View style={s.tabBar}>
              <TouchableOpacity
                style={[s.tabBtn, tab === 'approved' && s.tabBtnActive]}
                onPress={() => setTab('approved')}
                activeOpacity={0.85}
              >
                <Text style={[s.tabText, tab === 'approved' && s.tabTextActive]}>Approved Leads</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tabBtn, tab === 'pending' && s.tabBtnActive]}
                onPress={() => setTab('pending')}
                activeOpacity={0.85}
              >
                <Ionicons name="time-outline" size={14} color={tab === 'pending' ? Colors.white : Colors.slate500} />
                <Text style={[s.tabText, tab === 'pending' && s.tabTextActive]}>
                  Pending Applications{pending.length > 0 ? ` (${pending.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, phone, email, language or skill..." />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {(['All', 'Active', 'Inactive'] as const).map(f => (
                <Chip key={f} label={f} active={statusFilter === f} onPress={() => setStatusFilter(f)} activeBg={Colors.gradientBlueTo} />
              ))}
            </ScrollView>

            {error && (
              <Panel style={s.errorPanel} padding={14}>
                <View style={s.errorRow}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              </Panel>
            )}

            {!loading && (
              <Text style={s.showing}>
                Showing <Text style={s.showingBold}>{filtered.length}</Text> of {leads.length} leads
              </Text>
            )}
          </View>
        }
        renderItem={({ item: l }) => (
          <Panel padding={0} style={s.card}>
            <View style={s.cardTop}>
              <Avatar name={l.name} size={44} />
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={s.name}>{l.name}</Text>
                  <Pill
                    label={l.active === false ? 'Inactive' : 'Active'}
                    color={l.active === false ? Colors.slate500 : Colors.success}
                    bg={l.active === false ? Colors.slate100 : Colors.successBg}
                    dot
                  />
                </View>
                {(l.age || l.gender) ? (
                  <Text style={s.sub}>{l.age ? `${l.age}y` : ''}{l.age && l.gender ? ' · ' : ''}{l.gender ?? ''}</Text>
                ) : null}
              </View>
            </View>

            <View style={s.metaBlock}>
              {!!l.phone && (
                <View style={s.metaRow}>
                  <Ionicons name="call-outline" size={13} color={Colors.slate400} />
                  <Text style={s.metaText}>{l.phone}</Text>
                </View>
              )}
              {!!l.email && (
                <View style={s.metaRow}>
                  <Ionicons name="mail-outline" size={13} color={Colors.slate400} />
                  <Text style={s.metaText} numberOfLines={1}>{l.email}</Text>
                </View>
              )}
              {!!l.hiredDate && (
                <View style={s.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.slate400} />
                  <Text style={s.metaText}>Joined {fmtDate(l.hiredDate)}</Text>
                </View>
              )}
            </View>

            {!!l.languages?.length && (
              <View style={s.tagBlock}>
                <Text style={s.tagLabel}>LANGUAGES</Text>
                <View style={s.tagRow}>
                  {l.languages.map((x, i) => (
                    <View key={i} style={s.langPill}><Text style={s.langText}>{x}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {!!l.specialSkills?.length && (
              <View style={s.tagBlock}>
                <Text style={s.tagLabel}>SKILLS</Text>
                <View style={s.tagRow}>
                  {l.specialSkills.map((x, i) => (
                    <View key={i} style={s.skillPill}><Text style={s.skillText}>{x}</Text></View>
                  ))}
                </View>
              </View>
            )}

            <View style={s.cardFooter}>
              {tab === 'pending' ? (
                <TouchableOpacity style={s.footerBtn} onPress={() => approve(l)} activeOpacity={0.7}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={Colors.success} />
                  <Text style={[s.footerBtnText, { color: Colors.success }]}>Approve</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.footerBtn} activeOpacity={0.7} onPress={() => Alert.alert('Edit lead', 'Lead editing is coming in the next phase.')}>
                  <Ionicons name="create-outline" size={15} color={Colors.slate700} />
                  <Text style={s.footerBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
              <View style={s.footerDivider} />
              <TouchableOpacity style={s.footerBtn} onPress={() => remove(l)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                <Text style={[s.footerBtnText, { color: Colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Panel>
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            : <EmptyState icon="people-outline" title="No leads found" message="Try a different search or filter." />
        }
      />

      {showAddLead && <LeadFormModal onClose={() => setShowAddLead(false)} onSaved={load} />}
    </AppShell>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },

  tabBar:       { flexDirection: 'row', gap: 8 },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 11, backgroundColor: Colors.slate100 },
  tabBtnActive: { backgroundColor: Colors.gradientBlueTo },
  tabText:      { fontSize: 12, fontWeight: '700', color: Colors.slate500 },
  tabTextActive:{ color: Colors.white },

  chipRow: { gap: 7, paddingRight: 16 },

  showing:     { fontSize: 13, color: Colors.slate500 },
  showingBold: { fontWeight: '800', color: Colors.slate900 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  card:    { overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:    { fontSize: 15, fontWeight: '800', color: Colors.slate900 },
  sub:     { fontSize: 12, color: Colors.slate500, marginTop: 3 },

  metaBlock: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText:  { fontSize: 12, color: Colors.slate500, flex: 1 },

  tagBlock:  { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  tagLabel:  { fontSize: 9, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.8 },
  tagRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  langPill:  { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  langText:  { fontSize: 11, fontWeight: '600', color: Colors.gradientBlueTo },
  skillPill: { backgroundColor: '#f5f3ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  skillText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },

  cardFooter:    { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.slate100 },
  footerBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  footerBtnText: { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
  footerDivider: { width: 1, height: 22, backgroundColor: Colors.slate100 },
});
