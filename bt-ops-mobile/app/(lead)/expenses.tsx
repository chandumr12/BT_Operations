import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Batch { id: string; batchCode: string; }
interface Expense {
  id: string;
  batchCode: string;
  category: string;
  amount: number;
  description: string;
  status: string;
  submittedAt: string;
}

const CATEGORIES = ['Food', 'Transport', 'Accommodation', 'Equipment', 'First Aid', 'Permit', 'Other'];

const statusColor = (s: string) =>
  s === 'approved' ? Colors.success : s === 'rejected' ? Colors.danger : Colors.warning;

export default function ExpensesScreen() {
  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const [batchId,    setBatchId]    = useState('');
  const [category,   setCategory]   = useState('');
  const [amount,     setAmount]     = useState('');
  const [description,setDescription]= useState('');

  const loadData = async () => {
    try {
      const [br, er] = await Promise.all([
        api.get('/lead/my-batches'),
        api.get('/lead/expenses'),
      ]);
      setBatches(br.data);
      setExpenses(er.data);
    } catch {}
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const submitExpense = async () => {
    if (!batchId || !category || !amount || !description.trim()) {
      Alert.alert('Missing fields', 'Fill in all fields before submitting.');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid positive amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/lead/expenses', { batch_id: batchId, category, amount: amt, description });
      Alert.alert('Submitted', 'Your expense has been submitted for review.');
      setBatchId(''); setCategory(''); setAmount(''); setDescription('');
      setShowForm(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not submit expense');
    } finally { setSubmitting(false); }
  };

  const totalPending  = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.title}>Expenses</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(!showForm)}>
            <Ionicons name={showForm ? 'close' : 'add'} size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={s.summaryRow}>
          <Card padding={16} style={s.summaryCard}>
            <Text style={s.summaryLabel}>Pending</Text>
            <Text style={[s.summaryAmount, { color: Colors.warning }]}>₹{totalPending.toFixed(0)}</Text>
          </Card>
          <Card padding={16} style={s.summaryCard}>
            <Text style={s.summaryLabel}>Approved</Text>
            <Text style={[s.summaryAmount, { color: Colors.success }]}>₹{totalApproved.toFixed(0)}</Text>
          </Card>
        </View>

        {/* Form */}
        {showForm && (
          <Card padding={16} style={{ gap: 14 }}>
            <Text style={s.sectionTitle}>New Expense</Text>

            <View style={s.pickerBox}>
              <Text style={s.label}>Batch</Text>
              <View style={s.pickerWrap}>
                <Picker selectedValue={batchId} onValueChange={setBatchId} style={s.picker}>
                  <Picker.Item label="Select batch…" value="" />
                  {batches.map(b => <Picker.Item key={b.id} label={b.batchCode} value={b.id} />)}
                </Picker>
              </View>
            </View>

            <View style={s.pickerBox}>
              <Text style={s.label}>Category</Text>
              <View style={s.pickerWrap}>
                <Picker selectedValue={category} onValueChange={setCategory} style={s.picker}>
                  <Picker.Item label="Select category…" value="" />
                  {CATEGORIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
                </Picker>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Amount (₹)</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={Colors.gray400}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, s.textarea]}
                placeholder="Describe the expense…"
                placeholderTextColor={Colors.gray400}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <Button title="Submit Expense" onPress={submitExpense} loading={submitting} />
          </Card>
        )}

        {/* Expense list */}
        <Text style={s.sectionTitle}>History ({expenses.length})</Text>
        {expenses.map(e => (
          <Card key={e.id} padding={14} style={s.expCard}>
            <View style={s.expTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.expDesc}>{e.description}</Text>
                <Text style={s.expMeta}>{e.batchCode}  •  {e.category}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.expAmount}>₹{e.amount.toFixed(0)}</Text>
                <View style={[s.statusPill, { backgroundColor: statusColor(e.status) + '20' }]}>
                  <Text style={[s.statusText, { color: statusColor(e.status) }]}>{e.status}</Text>
                </View>
              </View>
            </View>
            <Text style={s.expDate}>{new Date(e.submittedAt).toLocaleDateString('en-IN')}</Text>
          </Card>
        ))}
        {expenses.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={40} color={Colors.gray300} />
            <Text style={s.emptyText}>No expenses submitted yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.gray50 },
  content:  { padding: 16, gap: 14, paddingBottom: 32 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:     { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  addBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  summaryRow:    { flexDirection: 'row', gap: 12 },
  summaryCard:   { flex: 1, gap: 4 },
  summaryLabel:  { fontSize: 12, color: Colors.gray500, fontWeight: '500' },
  summaryAmount: { fontSize: 24, fontWeight: '800' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  pickerBox:  { gap: 6 },
  pickerWrap: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.gray50 },
  picker:     { height: 48 },
  field:      { gap: 6 },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:      { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.gray50 },
  textarea:   { height: 88, paddingTop: 12, textAlignVertical: 'top' },

  expCard:   {},
  expTop:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  expDesc:   { fontSize: 14, fontWeight: '600', color: Colors.gray900 },
  expMeta:   { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  expAmount: { fontSize: 16, fontWeight: '700', color: Colors.gray900 },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:{ fontSize: 11, fontWeight: '600' },
  expDate:   { fontSize: 11, color: Colors.gray400, marginTop: 8 },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: Colors.gray400, fontSize: 14 },
});
