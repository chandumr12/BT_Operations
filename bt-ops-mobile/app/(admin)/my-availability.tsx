import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, EmptyState } from '@/components/ui';
import { Button } from '@/components/Button';
import { TeamAvailabilityModal } from '@/components/TeamAvailabilityModal';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

interface Slot {
  id: string; month: string; week: number;
  category: string; deptDate: string; returnDate: string; trekName?: string | null;
}

const CATEGORY_STYLE: Record<string, { label: string; color: string }> = {
  weekday:   { label: 'WEEKDAY',   color: Colors.gradientBlueTo },
  weekend:   { label: 'WEEKEND',   color: '#8b5cf6' },
  himalayan: { label: 'HIMALAYAN', color: Colors.primary },
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function MyAvailabilityScreen() {
  const { profile } = useAuth();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState('');
  const [showTrekNames, setShowTrekNames] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTeam, setShowTeam] = useState(false);

  // Load config → active months
  useEffect(() => {
    api.get('/availability/config')
      .then(r => {
        const list: string[] = r.data?.activeMonths ?? [];
        setShowTrekNames(r.data?.showTrekNames !== false);
        setMonths(list);
        setMonth(prev => prev || list[0] || '');
      })
      .catch((e: any) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, []);

  const loadMonth = useCallback(async (m: string) => {
    if (!m) return;
    try {
      const [slotsRes, mineRes] = await Promise.all([
        api.get('/availability/slots', { params: { month: m } }),
        api.get('/availability', { params: { month: m } }),
      ]);
      setSlots(slotsRes.data ?? []);
      setSelectedIds(mineRes.data?.selectedSlotIds ?? []);
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
  }, []);

  useEffect(() => { if (month) loadMonth(month); }, [month, loadMonth]);

  const onRefresh = async () => { setRefreshing(true); await loadMonth(month); setRefreshing(false); };

  const toggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/availability', { month, selectedSlotIds: selectedIds });
      Alert.alert('Saved', 'Your availability has been submitted.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save availability');
    } finally { setSaving(false); }
  };

  /** week number → category → slots */
  const grouped = useMemo(() => {
    const byWeek: Record<number, Record<string, Slot[]>> = {};
    slots.forEach(s => {
      if (!byWeek[s.week]) byWeek[s.week] = {};
      if (!byWeek[s.week][s.category]) byWeek[s.week][s.category] = [];
      byWeek[s.week][s.category].push(s);
    });
    return byWeek;
  }, [slots]);

  const weeks = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <PageTitle
          title="My Availability"
          subtitle={months.map(monthLabel).join(' & ')}
          right={
            <TouchableOpacity style={s.teamBtn} onPress={() => setShowTeam(true)} activeOpacity={0.85}>
              <Ionicons name="eye-outline" size={14} color={Colors.primary} />
              <Text style={s.teamBtnText}>See team</Text>
            </TouchableOpacity>
          }
        />

        <Panel style={s.greeting} padding={14}>
          <Text style={s.greetingText}>
            Hi <Text style={s.greetingName}>{profile?.displayName ?? 'there'}</Text> — toggle the slots you're available for, then Save.
          </Text>
        </Panel>

        {months.length > 1 && (
          <View style={s.monthRow}>
            {months.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.monthBtn, month === m && s.monthBtnActive]}
                onPress={() => setMonth(m)}
                activeOpacity={0.85}
              >
                <Text style={[s.monthText, month === m && s.monthTextActive]}>{monthLabel(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {error && (
          <Panel style={s.errorPanel} padding={14}>
            <View style={s.errorRow}>
              <Ionicons name="warning-outline" size={18} color={Colors.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          </Panel>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : weeks.length === 0 ? (
          <Panel style={{ marginTop: 14 }} padding={0}>
            <EmptyState icon="calendar-clear-outline" title="No slots published" message="Availability slots for this month haven't been opened yet." />
          </Panel>
        ) : (
          weeks.map(w => (
            <Panel key={w} padding={0} style={{ marginTop: 14, overflow: 'hidden' }}>
              <View style={s.weekHeader}>
                <View style={s.weekBar} />
                <Text style={s.weekTitle}>Week {w}</Text>
              </View>

              {Object.entries(grouped[w]).map(([cat, list]) => {
                const meta = CATEGORY_STYLE[cat] ?? { label: cat.toUpperCase(), color: Colors.slate500 };
                return (
                  <View key={cat}>
                    <View style={[s.catHeader, { backgroundColor: meta.color + '12' }]}>
                      <View style={[s.catDot, { backgroundColor: meta.color }]} />
                      <Text style={[s.catLabel, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {list.map(slot => {
                      const on = selectedIds.includes(slot.id);
                      return (
                        <View key={slot.id} style={s.slotRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.slotName}>
                              {showTrekNames && slot.trekName ? slot.trekName : 'TREK'}
                            </Text>
                            <View style={s.slotDates}>
                              <Ionicons name="arrow-up" size={11} color={Colors.slate400} />
                              <Text style={s.slotDateText}>{dayLabel(slot.deptDate)}</Text>
                              <Ionicons name="arrow-down" size={11} color={Colors.slate400} style={{ marginLeft: 8 }} />
                              <Text style={s.slotDateText}>{dayLabel(slot.returnDate)}</Text>
                            </View>
                          </View>
                          <Switch
                            value={on}
                            onValueChange={() => toggle(slot.id)}
                            trackColor={{ true: Colors.primary, false: Colors.slate200 }}
                            thumbColor={Colors.white}
                          />
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </Panel>
          ))
        )}

        {weeks.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={s.selectedCount}>{selectedIds.length} slot(s) selected</Text>
            <Button title="Save Availability" onPress={save} loading={saving} />
          </View>
        )}
      </ScrollView>

      {showTeam && <TeamAvailabilityModal onClose={() => setShowTeam(false)} />}
    </AppShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },

  teamBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryBg, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  teamBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  greeting:     { backgroundColor: Colors.primaryBg, borderColor: '#fed7cd', marginTop: 14 },
  greetingText: { fontSize: 13, color: Colors.slate700, lineHeight: 19 },
  greetingName: { fontWeight: '800', color: Colors.slate900 },

  monthRow:       { flexDirection: 'row', gap: 8, marginTop: 14 },
  monthBtn:       { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200, alignItems: 'center' },
  monthBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthText:      { fontSize: 13, fontWeight: '700', color: Colors.slate600 },
  monthTextActive:{ color: Colors.white },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca', marginTop: 14 },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: Colors.primaryBg },
  weekBar:    { width: 4, height: 18, borderRadius: 2, backgroundColor: Colors.primary },
  weekTitle:  { fontSize: 15, fontWeight: '800', color: Colors.slate900 },

  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8 },
  catDot:    { width: 6, height: 6, borderRadius: 3 },
  catLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  slotRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: Colors.slate50 },
  slotName:     { fontSize: 13, fontWeight: '700', color: Colors.slate500, fontStyle: 'italic' },
  slotDates:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  slotDateText: { fontSize: 12, color: Colors.slate600 },

  selectedCount: { fontSize: 12, color: Colors.slate500, textAlign: 'center', marginBottom: 10 },
});
