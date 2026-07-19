import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Slot {
  id: string; month: string; week: number;
  category: string; deptDate: string; returnDate: string; trekName?: string | null;
}
interface LeadAvail {
  leadId: string; displayName: string; gender?: string; selectedSlotIds?: string[];
}

const CAT_META: Record<string, { color: string; bg: string }> = {
  weekday:   { color: Colors.gradientBlueTo, bg: '#eff6ff' },
  weekend:   { color: '#7c3aed', bg: '#f5f3ff' },
  himalayan: { color: '#059669', bg: '#ecfdf5' },
};

const monthLabel = (m: string) => {
  try { return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
  catch { return m; }
};
const dayLabel = (iso?: string) => {
  if (!iso) return '?';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return iso; }
};

/**
 * Mirrors the web app's "Team Availability" dialog opened from the "See
 * team" button on the Lead Availability page (frontend/src/pages/
 * LeadAvailability.js TeamModal) — same GET /availability/all + slot
 * lookup, same month tabs, and the same two-box (male/female only, no
 * total) stats row. Visible to every role that can reach My Availability,
 * not just admins, matching the web's unconditional button.
 */
export function TeamAvailabilityModal({ onClose }: { onClose: () => void }) {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState('');
  const [leads, setLeads] = useState<LeadAvail[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMonth = useCallback(async (m: string) => {
    if (!m) return;
    try {
      const [leadsRes, slotsRes] = await Promise.all([
        api.get('/availability/all', { params: { month: m } }),
        api.get('/availability/slots', { params: { month: m } }),
      ]);
      setLeads(leadsRes.data ?? []);
      setSlots(slotsRes.data ?? []);
    } catch { setLeads([]); setSlots([]); }
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/availability/config')
      .then(r => {
        const list: string[] = r.data?.activeMonths ?? [];
        setMonths(list);
        const m = list[0] ?? '';
        setMonth(m);
        return fetchMonth(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchMonth]);

  const switchMonth = (m: string) => { setMonth(m); fetchMonth(m); };

  const slotMap = useMemo(() => { const map: Record<string, Slot> = {}; slots.forEach(s => { map[s.id] = s; }); return map; }, [slots]);

  const males   = leads.filter(l => l.gender?.toLowerCase() === 'male').length;
  const females = leads.filter(l => l.gender?.toLowerCase() === 'female').length;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="people" size={18} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Team Availability</Text>
            <Text style={s.headerSub}>{leads.length} leads responded</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.body}>
            {months.length > 1 && (
              <View style={s.monthRow}>
                {months.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.monthBtn, month === m && s.monthBtnActive]}
                    onPress={() => switchMonth(m)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.monthText, month === m && s.monthTextActive]}>{monthLabel(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {leads.length === 0 ? (
              <Text style={s.empty}>No responses yet.</Text>
            ) : (
              <>
                <View style={s.statsRow}>
                  <View style={[s.statBox, s.statBoxMale]}>
                    <Text style={[s.statValue, { color: Colors.gradientBlueTo }]}>{males}</Text>
                    <Text style={s.statLabel}>Male</Text>
                  </View>
                  <View style={[s.statBox, s.statBoxFemale]}>
                    <Text style={[s.statValue, { color: Colors.primary }]}>{females}</Text>
                    <Text style={s.statLabel}>Female</Text>
                  </View>
                </View>

                <View style={{ gap: 10 }}>
                  {leads.map((lead, i) => {
                    const mySlots = (lead.selectedSlotIds || []).map(id => slotMap[id]).filter(Boolean) as Slot[];
                    return (
                      <View key={lead.leadId || i} style={s.leadCard}>
                        <Text style={s.leadName}>{lead.displayName}</Text>
                        <Text style={s.leadGender}>{lead.gender}</Text>
                        {mySlots.length === 0 ? (
                          <Text style={s.noSlots}>No slots selected</Text>
                        ) : (
                          <View style={s.slotWrap}>
                            {mySlots.map(sl => {
                              const meta = CAT_META[sl.category] ?? CAT_META.weekday;
                              return (
                                <View key={sl.id} style={[s.slotBadge, { backgroundColor: meta.bg }]}>
                                  <Text style={[s.slotBadgeText, { color: meta.color }]}>
                                    {sl.trekName || 'TREK'} · {dayLabel(sl.deptDate)}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16, backgroundColor: Colors.primary,
  },
  headerIcon:  { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, paddingBottom: 40, gap: 14 },

  monthRow: { flexDirection: 'row', gap: 8 },
  monthBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.slate100 },
  monthBtnActive: { backgroundColor: Colors.primary },
  monthText: { fontSize: 12, fontWeight: '700', color: Colors.slate500 },
  monthTextActive: { color: Colors.white },

  empty: { textAlign: 'center', color: Colors.slate400, fontSize: 13, marginTop: 30 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  statBoxMale: { backgroundColor: '#eff6ff' },
  statBoxFemale: { backgroundColor: Colors.primaryBg },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: Colors.slate500, marginTop: 2 },

  leadCard: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.slate100, padding: 14, gap: 6 },
  leadName: { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  leadGender: { fontSize: 11, color: Colors.slate400 },
  noSlots: { fontSize: 12, color: Colors.slate400, fontStyle: 'italic' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  slotBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  slotBadgeText: { fontSize: 11, fontWeight: '600' },
});
