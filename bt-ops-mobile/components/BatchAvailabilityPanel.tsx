import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Panel, Chip } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';

const WEB_BASE = 'https://bengaluru-trekkers-ops.web.app';
const WEEK_OPTS = [1, 2, 3, 4];

interface Slot {
  id: string; month: string; week: number;
  category: string; deptDate: string; returnDate: string; trekName?: string | null;
}
interface LeadAvail {
  leadId: string; displayName: string; gender?: string; selectedSlotIds?: string[];
}

const AV_CAT_META: Record<string, { label: string; color: string; bg: string }> = {
  weekday:   { label: 'WEEKDAY',   color: Colors.gradientBlueTo, bg: '#eff6ff' },
  weekend:   { label: 'WEEKEND',   color: '#7c3aed', bg: '#f5f3ff' },
  himalayan: { label: 'HIMALAYAN', color: '#059669', bg: '#ecfdf5' },
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
 * Mirrors the web app's "Availability" tab inside Batch Planning
 * (frontend/src/pages/BatchPlanning.js AvailabilityTab) — share link,
 * active-months manager, per-week/category slot CRUD, and lead responses.
 * Weeks stack vertically here instead of the web's 4-column grid, since
 * the screen is a phone, not a desktop.
 */
export function BatchAvailabilityPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [activeMonths, setActiveMonths] = useState<string[]>([]);
  const [viewMonth, setViewMonth] = useState('');
  const [addMonthVal, setAddMonthVal] = useState('');

  const [subTab, setSubTab] = useState<'set' | 'responses'>('set');
  const [weekFilter, setWeekFilter] = useState<'all' | number>('all');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [leads, setLeads] = useState<LeadAvail[]>([]);

  const [addingSlot, setAddingSlot] = useState<{ week: number; category: string } | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [slotForm, setSlotForm] = useState({ deptDate: '', returnDate: '', trekName: '' });

  const fetchMonth = useCallback(async (m: string) => {
    if (!m) return;
    try {
      const [slotsRes, leadsRes] = await Promise.all([
        api.get('/availability/slots', { params: { month: m } }),
        api.get('/availability/all', { params: { month: m } }),
      ]);
      setSlots(slotsRes.data ?? []);
      setLeads(leadsRes.data ?? []);
      setError(null);
    } catch (e: any) { setError(describeError(e)); }
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/availability/config')
      .then(r => {
        const months: string[] = r.data?.activeMonths?.length ? r.data.activeMonths : [];
        setActiveMonths(months);
        const vm = months[0] ?? '';
        setViewMonth(vm);
        return fetchMonth(vm);
      })
      .catch((e: any) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [fetchMonth]);

  const switchMonth = (m: string) => { setViewMonth(m); setWeekFilter('all'); fetchMonth(m); };

  const saveActiveMonths = async (months: string[]) => {
    setSaving(true);
    try {
      await api.put('/availability/config', { activeMonths: months });
      setActiveMonths(months);
      if (!months.includes(viewMonth)) switchMonth(months[0] ?? '');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not update active months');
    } finally { setSaving(false); }
  };

  const removeMonth = (m: string) => saveActiveMonths(activeMonths.filter(x => x !== m));
  const addMonth = () => {
    const v = addMonthVal.trim();
    if (!/^\d{4}-\d{2}$/.test(v)) { Alert.alert('Invalid month', 'Enter a month as YYYY-MM, e.g. 2026-09.'); return; }
    if (activeMonths.includes(v)) { Alert.alert('Already active'); return; }
    if (activeMonths.length >= 2) { Alert.alert('Max 2 active months', 'Remove one to add another.'); return; }
    saveActiveMonths([...activeMonths, v].sort());
    setAddMonthVal('');
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(`${WEB_BASE}/my-availability`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startAdd = (week: number, category: string) => {
    setEditingSlot(null);
    setSlotForm({ deptDate: '', returnDate: '', trekName: '' });
    setAddingSlot({ week, category });
  };
  const startEdit = (slot: Slot) => {
    setAddingSlot({ week: slot.week, category: slot.category });
    setEditingSlot(slot);
    setSlotForm({ deptDate: slot.deptDate || '', returnDate: slot.returnDate || '', trekName: slot.trekName || '' });
  };
  const cancelSlotForm = () => { setAddingSlot(null); setEditingSlot(null); };

  const saveSlot = async () => {
    if (!slotForm.deptDate.trim() || !slotForm.returnDate.trim()) {
      Alert.alert('Dates required', 'Enter departure and return dates (YYYY-MM-DD).'); return;
    }
    setSaving(true);
    try {
      if (editingSlot) {
        await api.patch(`/availability/slots/${editingSlot.id}`, {
          deptDate: slotForm.deptDate.trim(), returnDate: slotForm.returnDate.trim(),
          trekName: slotForm.trekName.trim() || null,
        });
      } else if (addingSlot) {
        await api.post('/availability/slots', {
          month: viewMonth, week: addingSlot.week, category: addingSlot.category,
          deptDate: slotForm.deptDate.trim(), returnDate: slotForm.returnDate.trim(),
          trekName: slotForm.trekName.trim() || null,
        });
      }
      cancelSlotForm();
      fetchMonth(viewMonth);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save slot');
    } finally { setSaving(false); }
  };

  const deleteSlot = (slot: Slot) => {
    Alert.alert('Delete slot', 'Remove this availability slot?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/availability/slots/${slot.id}`); fetchMonth(viewMonth); }
        catch { Alert.alert('Error', 'Could not delete slot'); }
      }},
    ]);
  };

  const slotMap = useMemo(() => { const m: Record<string, Slot> = {}; slots.forEach(s => { m[s.id] = s; }); return m; }, [slots]);

  const groupedSlots = useMemo(() => {
    const g: Record<number, Record<string, Slot[]>> = {};
    slots.forEach(s => {
      if (!g[s.week]) g[s.week] = {};
      if (!g[s.week][s.category]) g[s.week][s.category] = [];
      g[s.week][s.category].push(s);
    });
    return g;
  }, [slots]);

  const filteredLeads = useMemo(() => {
    if (weekFilter === 'all') return leads;
    return leads.filter(l => (l.selectedSlotIds || []).some(id => slotMap[id]?.week === weekFilter));
  }, [leads, slotMap, weekFilter]);

  const males   = filteredLeads.filter(l => l.gender?.toLowerCase() === 'male').length;
  const females = filteredLeads.filter(l => l.gender?.toLowerCase() === 'female').length;

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />;

  return (
    <View style={{ gap: 12 }}>
      {error && (
        <Panel style={s.errorPanel} padding={14}>
          <View style={s.errorRow}>
            <Ionicons name="warning-outline" size={18} color={Colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        </Panel>
      )}

      {/* Share link */}
      <Panel padding={14}>
        <Text style={s.label}>SHARE WITH LEADS</Text>
        <View style={s.shareRow}>
          <View style={s.shareBox}>
            <Text style={s.shareText} numberOfLines={1}>{WEB_BASE}/my-availability</Text>
          </View>
          <TouchableOpacity style={[s.copyBtn, copied && s.copyBtnDone]} onPress={copyLink} activeOpacity={0.85}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={Colors.white} />
            <Text style={s.copyBtnText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
          </TouchableOpacity>
        </View>
      </Panel>

      {/* Active months */}
      <Panel padding={14}>
        <Text style={s.label}>ACTIVE MONTHS FOR LEADS</Text>
        <View style={s.monthChipRow}>
          {activeMonths.map(m => (
            <View key={m} style={s.monthChip}>
              <Text style={s.monthChipText}>{monthLabel(m)}</Text>
              <TouchableOpacity onPress={() => removeMonth(m)} hitSlop={8} style={s.monthChipX}>
                <Ionicons name="close" size={11} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
          {activeMonths.length === 0 && (
            <Text style={s.emptyMuted}>No active month — leads can&apos;t submit availability.</Text>
          )}
        </View>
        {activeMonths.length < 2 ? (
          <View style={s.addMonthRow}>
            <TextInput
              style={s.addMonthInput}
              value={addMonthVal}
              onChangeText={setAddMonthVal}
              placeholder="YYYY-MM"
              placeholderTextColor={Colors.slate400}
            />
            <TouchableOpacity style={s.addMonthBtn} onPress={addMonth} disabled={!addMonthVal || saving} activeOpacity={0.85}>
              <Ionicons name="add" size={13} color={Colors.white} />
              <Text style={s.addMonthBtnText}>Add month</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={s.emptyMuted}>Max 2 active months. Remove one to add another.</Text>
        )}
      </Panel>

      {/* Month tabs */}
      {activeMonths.length > 0 && (
        <View style={s.tabRow}>
          {activeMonths.map(m => (
            <Chip key={m} label={monthLabel(m)} active={viewMonth === m} onPress={() => switchMonth(m)} activeBg={Colors.primary} />
          ))}
        </View>
      )}

      {/* Sub tabs */}
      <View style={s.subTabRow}>
        <Chip label="Set Availability" active={subTab === 'set'} onPress={() => setSubTab('set')} activeBg={Colors.primary} />
        <Chip label="Lead Responses" active={subTab === 'responses'} onPress={() => setSubTab('responses')} activeBg={Colors.primary} />
        <Text style={s.countText}>{leads.length} leads · {slots.length} slots</Text>
      </View>

      {/* Set Availability */}
      {subTab === 'set' && (
        <View style={{ gap: 12 }}>
          {WEEK_OPTS.map(week => {
            const weekSlots = groupedSlots[week] || {};
            const weekTotal = Object.values(weekSlots).reduce((sum, a) => sum + a.length, 0);
            return (
              <Panel key={week} padding={0} style={{ overflow: 'hidden' }}>
                <View style={s.weekHeader}>
                  <Text style={s.weekTitle}>Week {week}</Text>
                  {weekTotal > 0 && (
                    <View style={s.weekBadge}><Text style={s.weekBadgeText}>{weekTotal}</Text></View>
                  )}
                </View>

                {['weekday', 'weekend', 'himalayan'].map(cat => {
                  const meta = AV_CAT_META[cat];
                  const catSlots = weekSlots[cat] || [];
                  const isAddingHere = addingSlot?.week === week && addingSlot?.category === cat && !editingSlot;
                  return (
                    <View key={cat} style={s.catBlock}>
                      <View style={[s.catRow, { backgroundColor: meta.bg }]}>
                        <View style={s.catLabelRow}>
                          <View style={[s.catDot, { backgroundColor: meta.color }]} />
                          <Text style={[s.catLabel, { color: meta.color }]}>{meta.label}</Text>
                          {catSlots.length > 0 && (
                            <View style={[s.catCount, { backgroundColor: meta.color + '22' }]}>
                              <Text style={[s.catCountText, { color: meta.color }]}>{catSlots.length}</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => startAdd(week, cat)} style={[s.catAddBtn, { backgroundColor: meta.color + '18' }]}>
                          <Text style={[s.catAddText, { color: meta.color }]}>+ Add</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={{ padding: 8, gap: 8 }}>
                        {catSlots.map(slot => {
                          const isEditingThis = editingSlot?.id === slot.id;
                          return (
                            <View key={slot.id}>
                              <View style={s.slotCard}>
                                <View style={s.slotTop}>
                                  <Text style={s.slotName} numberOfLines={1}>
                                    {slot.trekName || 'TREK'}
                                  </Text>
                                  <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <TouchableOpacity onPress={() => startEdit(slot)} style={s.slotIconBtn}>
                                      <Ionicons name="pencil" size={11} color={Colors.slate500} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => deleteSlot(slot)} style={[s.slotIconBtn, s.slotIconBtnDanger]}>
                                      <Ionicons name="trash" size={11} color={Colors.danger} />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                                <View style={s.slotDates}>
                                  <Ionicons name="arrow-up" size={10} color={Colors.slate400} />
                                  <Text style={s.slotDateText}>{dayLabel(slot.deptDate)}</Text>
                                  <Ionicons name="arrow-down" size={10} color={Colors.slate400} style={{ marginLeft: 10 }} />
                                  <Text style={s.slotDateText}>{dayLabel(slot.returnDate)}</Text>
                                </View>
                              </View>
                              {isEditingThis && (
                                <SlotFormInline form={slotForm} setForm={setSlotForm} onSave={saveSlot} onCancel={cancelSlotForm} saving={saving} isEdit />
                              )}
                            </View>
                          );
                        })}

                        {isAddingHere && (
                          <SlotFormInline form={slotForm} setForm={setSlotForm} onSave={saveSlot} onCancel={cancelSlotForm} saving={saving} isEdit={false} />
                        )}

                        {catSlots.length === 0 && !isAddingHere && (
                          <Text style={s.noSlots}>No slots yet</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </Panel>
            );
          })}
        </View>
      )}

      {/* Lead Responses */}
      {subTab === 'responses' && (
        <View style={{ gap: 12 }}>
          <View style={s.statsRow}>
            <StatBlock label="Total" value={filteredLeads.length} color={Colors.slate900} />
            <StatBlock label="Male" value={males} color="#2563eb" />
            <StatBlock label="Female" value={females} color={Colors.primary} />
          </View>

          <View style={s.weekFilterRow}>
            <Chip label="All weeks" active={weekFilter === 'all'} onPress={() => setWeekFilter('all')} activeBg={Colors.primary} />
            {WEEK_OPTS.map(w => (
              <Chip key={w} label={`Week ${w}`} active={weekFilter === w} onPress={() => setWeekFilter(w)} activeBg={Colors.primary} />
            ))}
          </View>

          {filteredLeads.length === 0 ? (
            <Panel padding={24} style={{ alignItems: 'center', gap: 8 }}>
              <Ionicons name="calendar-outline" size={26} color={Colors.primary} style={{ opacity: 0.3 }} />
              <Text style={s.noResponsesTitle}>No responses yet</Text>
              <Text style={s.noResponsesSub}>Share the link so leads can fill in availability.</Text>
            </Panel>
          ) : (
            filteredLeads.map((lead, i) => {
              const allMySlots = (lead.selectedSlotIds || []).map(id => slotMap[id]).filter(Boolean) as Slot[];
              const mySlots = weekFilter === 'all' ? allMySlots : allMySlots.filter(sl => sl.week === weekFilter);
              return (
                <Panel key={lead.leadId || i} padding={12}>
                  <View style={s.leadRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.leadName}>{lead.displayName}</Text>
                      <Text style={s.leadGender}>{lead.gender || 'Unknown'}</Text>
                    </View>
                    <Text style={s.leadSlotCount}>{mySlots.length} slot{mySlots.length !== 1 ? 's' : ''}</Text>
                  </View>
                  {mySlots.length === 0 ? (
                    <Text style={s.noSlots}>No slots selected</Text>
                  ) : (
                    <View style={s.leadSlotWrap}>
                      {mySlots.map(sl => {
                        const meta = AV_CAT_META[sl.category] ?? AV_CAT_META.weekday;
                        return (
                          <View key={sl.id} style={[s.leadSlotBadge, { backgroundColor: meta.bg }]}>
                            <Text style={[s.leadSlotBadgeText, { color: meta.color }]}>
                              {sl.trekName || 'TREK'} · {dayLabel(sl.deptDate)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Panel>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

function SlotFormInline({ form, setForm, onSave, onCancel, saving, isEdit }: {
  form: { deptDate: string; returnDate: string; trekName: string };
  setForm: React.Dispatch<React.SetStateAction<{ deptDate: string; returnDate: string; trekName: string }>>;
  onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean;
}) {
  return (
    <View style={s.slotForm}>
      <Text style={s.slotFormLabel}>{isEdit ? 'Edit slot' : 'New slot'}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[s.slotFormInput, { flex: 1 }]} value={form.deptDate}
          onChangeText={v => setForm(p => ({ ...p, deptDate: v }))} placeholder="Departure YYYY-MM-DD" placeholderTextColor={Colors.slate400} />
        <TextInput style={[s.slotFormInput, { flex: 1 }]} value={form.returnDate}
          onChangeText={v => setForm(p => ({ ...p, returnDate: v }))} placeholder="Return YYYY-MM-DD" placeholderTextColor={Colors.slate400} />
      </View>
      <TextInput style={s.slotFormInput} value={form.trekName}
        onChangeText={v => setForm(p => ({ ...p, trekName: v }))} placeholder="Trek name (optional)" placeholderTextColor={Colors.slate400} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={s.slotFormCancel} onPress={onCancel}>
          <Text style={s.slotFormCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.slotFormSave} onPress={onSave} disabled={saving}>
          <Text style={s.slotFormSaveText}>{saving ? '…' : isEdit ? 'Update' : 'Add slot'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Panel padding={12} style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Panel>
  );
}

const s = StyleSheet.create({
  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:  { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  label: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6, marginBottom: 8 },

  shareRow:  { flexDirection: 'row', gap: 8 },
  shareBox:  { flex: 1, backgroundColor: Colors.slate50, borderWidth: 1, borderColor: Colors.slate100, borderRadius: 10, paddingHorizontal: 10, justifyContent: 'center' },
  shareText: { fontSize: 11, color: Colors.slate500 },
  copyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  copyBtnDone: { backgroundColor: Colors.success },
  copyBtnText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

  monthChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  monthChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 20, paddingLeft: 12, paddingRight: 6, paddingVertical: 6 },
  monthChipText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  monthChipX: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  emptyMuted: { fontSize: 12, color: Colors.slate400, fontStyle: 'italic' },
  addMonthRow: { flexDirection: 'row', gap: 8 },
  addMonthInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 10, fontSize: 12, backgroundColor: Colors.slate50, color: Colors.slate900 },
  addMonthBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  addMonthBtnText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  subTabRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  countText: { marginLeft: 'auto', fontSize: 11, color: Colors.slate400, fontWeight: '600' },

  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.primaryBg, borderTopWidth: 3, borderTopColor: Colors.primary },
  weekTitle: { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  weekBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: Colors.primary },
  weekBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.white },

  catBlock: { borderTopWidth: 1, borderTopColor: Colors.slate50 },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  catLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  catCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  catCountText: { fontSize: 9, fontWeight: '800' },
  catAddBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catAddText: { fontSize: 10, fontWeight: '800' },

  slotCard: { backgroundColor: Colors.slate50, borderRadius: 10, borderWidth: 1, borderColor: Colors.slate100, paddingHorizontal: 10, paddingVertical: 8, gap: 5 },
  slotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  slotName: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.slate900 },
  slotIconBtn: { width: 20, height: 20, borderRadius: 6, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200, alignItems: 'center', justifyContent: 'center' },
  slotIconBtnDanger: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  slotDates: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slotDateText: { fontSize: 11, color: Colors.slate600, fontWeight: '500' },
  noSlots: { fontSize: 11, color: Colors.slate300, fontStyle: 'italic', paddingVertical: 2, paddingHorizontal: 2 },

  slotForm: { marginTop: 6, gap: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, padding: 10 },
  slotFormLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.5 },
  slotFormInput: { height: 38, borderRadius: 9, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 10, fontSize: 12, backgroundColor: Colors.slate50, color: Colors.slate900 },
  slotFormCancel: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9, backgroundColor: Colors.slate100 },
  slotFormCancelText: { fontSize: 12, fontWeight: '700', color: Colors.slate500 },
  slotFormSave: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9, backgroundColor: Colors.primary },
  slotFormSaveText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  statsRow: { flexDirection: 'row', gap: 8 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: Colors.slate400, marginTop: 2 },

  weekFilterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  noResponsesTitle: { fontSize: 14, fontWeight: '700', color: Colors.slate700 },
  noResponsesSub: { fontSize: 12, color: Colors.slate400, textAlign: 'center' },

  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  leadName: { fontSize: 13, fontWeight: '700', color: Colors.slate900 },
  leadGender: { fontSize: 11, color: Colors.slate400, marginTop: 1 },
  leadSlotCount: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  leadSlotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  leadSlotBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  leadSlotBadgeText: { fontSize: 11, fontWeight: '600' },
});
