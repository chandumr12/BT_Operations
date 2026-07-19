import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PageTitle, Panel, EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Batch { id: string; batchCode: string; startDate?: string; endDate?: string; }
interface ChecklistItem { task: string; status: 'pending' | 'done'; assignedTo?: string; }
interface Checklist { id: string; batchId: string; type: 'pre' | 'during' | 'post'; items: ChecklistItem[]; }

const TITLES: Record<string, string> = { pre: 'Pre-Trek', during: 'During Trek', post: 'Post-Trek' };
const ICONS: Record<string, any> = { pre: 'time-outline', during: 'checkbox-outline', post: 'list-outline' };
const ORDER: Record<string, number> = { pre: 1, during: 2, post: 3 };

const DEFAULTS: { type: 'pre' | 'during' | 'post'; items: ChecklistItem[] }[] = [
  { type: 'pre', items: [
    { task: 'Transport confirmed', status: 'pending' },
    { task: 'Stay confirmed', status: 'pending' },
    { task: 'Forest permits confirmed', status: 'pending' },
    { task: 'Participant list finalized', status: 'pending' },
    { task: 'Medical kit assigned', status: 'pending' },
    { task: 'ID cards printed', status: 'pending' },
    { task: 'Badges packed', status: 'pending' },
  ]},
  { type: 'during', items: [
    { task: 'Attendance marked', status: 'pending' },
    { task: 'Emergency contact list shared', status: 'pending' },
    { task: 'Photos uploaded', status: 'pending' },
  ]},
  { type: 'post', items: [
    { task: 'Expense sheet submitted', status: 'pending' },
    { task: 'Feedback collected', status: 'pending' },
    { task: 'Lost & found checked', status: 'pending' },
  ]},
];

export function ChecklistsScreen({ myBatchesOnly }: { myBatchesOnly?: boolean }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    api.get(myBatchesOnly ? '/batches/my' : '/batches')
      .then(r => setBatches(r.data))
      .catch(() => {});
  }, [myBatchesOnly]);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      let r = await api.get(`/checklists/${id}`);
      if (r.data.length === 0) {
        await Promise.all(DEFAULTS.map(d => api.post('/checklists', { batchId: id, type: d.type, items: d.items })));
        r = await api.get(`/checklists/${id}`);
      }
      setChecklists(r.data.sort((a: Checklist, b: Checklist) => ORDER[a.type] - ORDER[b.type]));
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (batchId) load(batchId); }, [batchId, load]);

  const toggleItem = async (checklist: Checklist, idx: number) => {
    const items = checklist.items.map((it, i): ChecklistItem => {
      if (i !== idx) return it;
      const newStatus: 'pending' | 'done' = it.status === 'done' ? 'pending' : 'done';
      return { ...it, status: newStatus };
    });
    setChecklists(prev => prev.map(c => c.id === checklist.id ? { ...c, items } : c));
    try { await api.patch(`/checklists/${checklist.id}`, { items }); } catch { load(batchId); }
  };

  const selected = batches.find(b => b.id === batchId);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <PageTitle title="Checklists" subtitle="Pre, during, and post-trek task tracking" />

      <Panel style={{ marginTop: 14 }} padding={16}>
        <Text style={s.selectLabel}>SELECT BATCH</Text>
        <TouchableOpacity style={s.select} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
          <Text style={[s.selectText, !selected && { color: Colors.slate400 }]}>
            {selected ? selected.batchCode : 'Choose a batch to view checklists...'}
          </Text>
          <Ionicons name="chevron-down" size={17} color={Colors.slate400} />
        </TouchableOpacity>
      </Panel>

      {loading ? (
        <View style={{ paddingVertical: 50, alignItems: 'center' }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !batchId ? (
        <Panel style={{ marginTop: 14 }} padding={0}>
          <EmptyState
            icon="checkbox-outline"
            title="Select a batch to begin"
            message="Choose a batch above to view and manage pre, during, and post-trek task checklists."
          />
        </Panel>
      ) : (
        checklists.map(cl => {
          const done = cl.items.filter(i => i.status === 'done').length;
          const total = cl.items.length;
          const pct = total > 0 ? (done / total) * 100 : 0;
          const allDone = done === total && total > 0;
          return (
            <Panel key={cl.id} padding={0} style={{ marginTop: 14, overflow: 'hidden' }}>
              <View style={s.clHeader}>
                <View style={[s.clIcon, { backgroundColor: allDone ? Colors.success : Colors.primaryBg }]}>
                  <Ionicons name={ICONS[cl.type]} size={16} color={allDone ? Colors.white : Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clTitle}>{TITLES[cl.type]}</Text>
                  <Text style={s.clSub}>{done}/{total} completed</Text>
                </View>
                <Text style={[s.clPct, { color: allDone ? Colors.success : Colors.primary }]}>{Math.round(pct)}%</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: allDone ? Colors.success : Colors.primary }]} />
              </View>
              {cl.items.map((item, idx) => (
                <TouchableOpacity key={idx} style={s.itemRow} onPress={() => toggleItem(cl, idx)} activeOpacity={0.7}>
                  <Ionicons
                    name={item.status === 'done' ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={item.status === 'done' ? Colors.success : Colors.slate300}
                  />
                  <Text style={[s.itemText, item.status === 'done' && s.itemTextDone]}>{item.task}</Text>
                </TouchableOpacity>
              ))}
            </Panel>
          );
        })
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Select Batch</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {batches.length === 0 && <Text style={s.modalEmpty}>No batches available</Text>}
              {batches.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={s.modalItem}
                  onPress={() => { setBatchId(b.id); setPickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.modalItemText, batchId === b.id && { color: Colors.primary, fontWeight: '700' }]}>
                    {b.batchCode}
                  </Text>
                  {batchId === b.id && <Ionicons name="checkmark" size={17} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },

  selectLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.8, marginBottom: 9 },
  select:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 14, height: 50, backgroundColor: Colors.slate50 },
  selectText:  { flex: 1, fontSize: 14, color: Colors.slate900, fontWeight: '500' },

  clHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  clIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  clTitle:  { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  clSub:    { fontSize: 11, color: Colors.slate400, marginTop: 1 },
  clPct:    { fontSize: 15, fontWeight: '900' },
  barBg:    { height: 5, backgroundColor: Colors.slate100 },
  barFill:  { height: 5 },

  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: Colors.slate50 },
  itemText:     { fontSize: 13, color: Colors.slate700, flex: 1 },
  itemTextDone: { color: Colors.slate300, textDecorationLine: 'line-through' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalSheet:    { backgroundColor: Colors.white, borderRadius: 18, padding: 18 },
  modalTitle:    { fontSize: 16, fontWeight: '800', color: Colors.slate900, marginBottom: 12 },
  modalItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.slate50 },
  modalItemText: { flex: 1, fontSize: 14, color: Colors.slate700 },
  modalEmpty:    { fontSize: 13, color: Colors.slate400, textAlign: 'center', paddingVertical: 20 },
});
