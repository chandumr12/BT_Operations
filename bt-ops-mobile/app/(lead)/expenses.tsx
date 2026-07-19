import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Alert, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Batch { id: string; batchCode: string; status: string; }

const EXPENSE_FIELDS: { key: string; label: string }[] = [
  { key: 'amountCollected', label: 'Amount Collected' },
  { key: 'paidToDriver', label: 'Paid to Driver' },
  { key: 'lunchPacking', label: 'Lunch Packing' },
  { key: 'parkingCharges', label: 'Parking Charges' },
  { key: 'jeepCharges', label: 'Jeep Charges' },
  { key: 'refundToCustomer', label: 'Refund to Customer' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'localGuide', label: 'Local Guide' },
  { key: 'leadsLunchExpenses', label: "Leads' Lunch" },
  { key: 'otherExpenses', label: 'Other Expenses' },
];

export default function ExpensesScreen() {
  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [batchId,    setBatchId]    = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [additional, setAdditional] = useState<{ reason: string; amount: string }[]>([]);

  const loadBatches = useCallback(async () => {
    try {
      const r = await api.get('/batches/my');
      setBatches(r.data);
      if (!batchId && r.data.length > 0) setBatchId(r.data[0].id);
    } catch {}
  }, [batchId]);

  useEffect(() => { loadBatches(); }, []);

  const loadSheet = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingSheet(true);
    setForm({}); setRemarks(''); setAdditional([]);
    try {
      const r = await api.get(`/batches/${id}/expenses/my`);
      if (r.data) {
        const d = r.data;
        const f: Record<string, string> = {};
        EXPENSE_FIELDS.forEach(fld => { f[fld.key] = d[fld.key] ? String(d[fld.key]) : ''; });
        setForm(f);
        setRemarks(d.otherExpensesRemarks ?? '');
        setAdditional((d.additionalExpenses ?? []).map((a: any) => ({ reason: a.reason ?? '', amount: String(a.amount ?? '') })));
      }
    } catch {} finally { setLoadingSheet(false); }
  }, []);

  useEffect(() => { if (batchId) loadSheet(batchId); }, [batchId, loadSheet]);

  const onRefresh = async () => { setRefreshing(true); await loadBatches(); if (batchId) await loadSheet(batchId); setRefreshing(false); };

  const totalSpent = EXPENSE_FIELDS.slice(1).reduce((sum, f) => sum + (parseFloat(form[f.key]) || 0), 0)
    + additional.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const collected = parseFloat(form.amountCollected) || 0;
  const remaining = collected - totalSpent;

  const save = async () => {
    if (!batchId) { Alert.alert('Select a batch', 'Choose a batch first.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = { otherExpensesRemarks: remarks, additionalExpenses: additional.filter(a => a.reason || a.amount) };
      EXPENSE_FIELDS.forEach(f => { payload[f.key] = parseFloat(form[f.key]) || 0; });
      await api.post(`/batches/${batchId}/expenses`, payload);
      Alert.alert('Saved', 'Your expense sheet has been saved.');
      loadSheet(batchId);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save expenses');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={s.title}>Expenses</Text>

        <View style={s.pickerBox}>
          <Text style={s.label}>Batch</Text>
          <View style={s.pickerWrap}>
            <Picker selectedValue={batchId} onValueChange={setBatchId} style={s.picker}>
              {batches.length === 0 && <Picker.Item label="No batches assigned" value="" />}
              {batches.map(b => <Picker.Item key={b.id} label={b.batchCode} value={b.id} />)}
            </Picker>
          </View>
        </View>

        {loadingSheet ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : batchId ? (
          <>
            <View style={s.summaryRow}>
              <Card padding={16} style={s.summaryCard}>
                <Text style={s.summaryLabel}>Total Spent</Text>
                <Text style={s.summaryAmount}>₹{totalSpent.toFixed(0)}</Text>
              </Card>
              <Card padding={16} style={s.summaryCard}>
                <Text style={s.summaryLabel}>Remaining</Text>
                <Text style={[s.summaryAmount, { color: remaining < 0 ? Colors.danger : Colors.success }]}>₹{remaining.toFixed(0)}</Text>
              </Card>
            </View>

            <Card padding={16} style={{ gap: 14 }}>
              <Text style={s.sectionTitle}>Expense Sheet</Text>
              {EXPENSE_FIELDS.map(f => (
                <View key={f.key} style={s.field}>
                  <Text style={s.label}>{f.label}</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.gray400}
                    value={form[f.key] ?? ''}
                    onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  />
                </View>
              ))}

              <View style={s.field}>
                <Text style={s.label}>Other Expenses Remarks</Text>
                <TextInput style={[s.input, s.textarea]} multiline value={remarks} onChangeText={setRemarks} placeholder="Notes…" placeholderTextColor={Colors.gray400} />
              </View>

              <View style={s.field}>
                <View style={s.rowBetween}>
                  <Text style={s.label}>Additional Expenses</Text>
                  <TouchableOpacity onPress={() => setAdditional(prev => [...prev, { reason: '', amount: '' }])}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {additional.map((a, i) => (
                  <View key={i} style={s.addRow}>
                    <TextInput style={[s.input, { flex: 2 }]} placeholder="Reason" placeholderTextColor={Colors.gray400}
                      value={a.reason} onChangeText={v => setAdditional(prev => prev.map((x, idx) => idx === i ? { ...x, reason: v } : x))} />
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="₹" keyboardType="decimal-pad" placeholderTextColor={Colors.gray400}
                      value={a.amount} onChangeText={v => setAdditional(prev => prev.map((x, idx) => idx === i ? { ...x, amount: v } : x))} />
                    <TouchableOpacity onPress={() => setAdditional(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Button title="Save Expense Sheet" onPress={save} loading={saving} />
            </Card>
          </>
        ) : (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={40} color={Colors.gray300} />
            <Text style={s.emptyText}>No batches assigned yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.gray50 },
  content:  { padding: 16, gap: 14, paddingBottom: 32 },
  title:    { fontSize: 22, fontWeight: '700', color: Colors.gray900 },

  pickerBox:  { gap: 6 },
  pickerWrap: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.white },
  picker:     { height: 48 },

  summaryRow:    { flexDirection: 'row', gap: 12 },
  summaryCard:   { flex: 1, gap: 4 },
  summaryLabel:  { fontSize: 12, color: Colors.gray500, fontWeight: '500' },
  summaryAmount: { fontSize: 22, fontWeight: '800', color: Colors.gray900 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  field:      { gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:      { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.gray50 },
  textarea:   { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  addRow:     { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: Colors.gray400, fontSize: 14 },
});
