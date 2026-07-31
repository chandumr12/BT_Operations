import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel } from '@/components/ui';
import {
  DataTable, ToolButton, Field, Input, Column, SectionTitle,
} from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import { inr, RECURRENCES, catLabel, parentFor } from '@/utils/finance';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

// Mirrors the narrower `cat` list in FinanceExpenseTemplates.js (not the full
// expense category list — templates only cover recurring overheads).
const TEMPLATE_CATEGORIES = [
  { value: 'insta_ads',       label: 'Instagram Ads' },
  { value: 'google_ads',      label: 'Google Ads' },
  { value: 'content_creator', label: 'Content Creators' },
  { value: 'rent',            label: 'Office Rent' },
  { value: 'wifi',            label: 'Wi-Fi' },
  { value: 'website',         label: 'Website Mgmt' },
];

interface Template {
  id: string; category?: string; subCategory?: string; defaultAmount?: number;
  recurrence?: string; nextRunMonthKey?: string;
}

export default function FinanceExpenseTemplatesScreen() {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    category: '', subCategory: '', defaultAmount: '',
    recurrence: 'monthly', nextRunMonthKey: '',
  });

  const load = useCallback(async () => {
    setErr('');
    try {
      const snap = await getDocs(collection(financeDb, 'expense_templates'));
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.category || !form.defaultAmount) {
      return Alert.alert('Missing fields', 'Category and amount are required.');
    }
    setSaving(true);
    try {
      await addDoc(collection(financeDb, 'expense_templates'), {
        category: form.category,
        parentCategory: parentFor(form.category),
        subCategory: form.subCategory || '',
        defaultAmount: Number(form.defaultAmount || 0),
        recurrence: form.recurrence,
        nextRunMonthKey: form.nextRunMonthKey || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setForm({ category: '', subCategory: '', defaultAmount: '', recurrence: 'monthly', nextRunMonthKey: '' });
      await load();
    } catch (e) {
      Alert.alert('Save failed', describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (t: Template) => {
    confirmAction(
      'Delete template?',
      `${catLabel(t.category || '')} will no longer post automatically.`,
      'Delete',
      async () => {
        try {
          await deleteDoc(doc(financeDb, 'expense_templates', t.id));
          setList(prev => prev.filter(x => x.id !== t.id));
        } catch (e) {
          Alert.alert('Delete failed', describeError(e));
        }
      },
    );
  };

  const cols: Column[] = [
    { key: 'category',   label: 'Category',   width: 128 },
    { key: 'sub',        label: 'Sub',        width: 110 },
    { key: 'amount',     label: 'Amount',     width: 92, align: 'right' },
    { key: 'recurrence', label: 'Recurrence', width: 96 },
    { key: 'nextRun',    label: 'Next Run',   width: 92 },
    {
      key: 'actions', label: 'Actions', width: 78,
      render: (r: any) => (
        <TouchableOpacity style={s.delBtn} onPress={() => remove(r._raw)}>
          <Text style={s.delText}>Delete</Text>
        </TouchableOpacity>
      ),
    },
  ];

  const rows = list.map(t => ({
    id: t.id, _raw: t,
    category: catLabel(t.category || ''),
    sub: t.subCategory || '—',
    amount: inr(t.defaultAmount),
    recurrence: t.recurrence || 'monthly',
    nextRun: t.nextRunMonthKey || '—',
  }));

  if (loading) {
    return (
      <AppShell>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <PageTitle
          icon="extension-puzzle-outline"
          title="Expense Templates"
          subtitle={`${list.length} template${list.length === 1 ? '' : 's'}`}
        />

        {!!err && <Panel style={s.errBox}><Text style={s.errText}>{err}</Text></Panel>}

        <Panel style={{ gap: 12 }}>
          <SectionTitle icon="add-circle-outline" title="Add Template" />

          <Field label="Category *">
            <View style={s.pickerBox}>
              <Picker
                selectedValue={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v }))}
              >
                <Picker.Item label="Select category…" value="" />
                {TEMPLATE_CATEGORIES.map(c => (
                  <Picker.Item key={c.value} label={c.label} value={c.value} />
                ))}
              </Picker>
            </View>
          </Field>

          <View style={s.row}>
            <Field label="Sub-category (opt)" flex={1}>
              <Input
                value={form.subCategory}
                onChangeText={v => setForm(f => ({ ...f, subCategory: v }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Amount *" flex={1}>
              <Input
                value={form.defaultAmount}
                onChangeText={v => setForm(f => ({ ...f, defaultAmount: v }))}
                keyboardType="number-pad" placeholder="0"
              />
            </Field>
          </View>

          <View style={s.row}>
            <Field label="Recurrence" flex={1}>
              <View style={s.pickerBox}>
                <Picker
                  selectedValue={form.recurrence}
                  onValueChange={v => setForm(f => ({ ...f, recurrence: v }))}
                >
                  {RECURRENCES.map(r => (
                    <Picker.Item key={r} label={r[0].toUpperCase() + r.slice(1)} value={r} />
                  ))}
                </Picker>
              </View>
            </Field>
            <Field label="Next Run (opt)" flex={1}>
              <Input
                value={form.nextRunMonthKey}
                onChangeText={v => setForm(f => ({ ...f, nextRunMonthKey: v }))}
                placeholder="YYYY-MM"
              />
            </Field>
          </View>

          <View style={s.btnRow}>
            <View style={{ flex: 1 }} />
            {saving
              ? <ActivityIndicator color={Colors.primary} />
              : <ToolButton label="Add" icon="add" onPress={add} primary />}
          </View>
        </Panel>

        <DataTable columns={cols} rows={rows} emptyText="No templates" />

        <Text style={s.hint}>
          Templates are posted into Ops Expenses from the Expenses screen using
          “Post recurring items”. Next Run advances automatically after each post.
        </Text>

        <View style={{ height: 28 }} />
      </ScrollView>
    </AppShell>
  );
}

const s = StyleSheet.create({
  scroll:    { padding: 16, gap: 12, paddingBottom: 40 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  row:       { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  btnRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerBox: { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, backgroundColor: Colors.white, justifyContent: 'center', minHeight: 44 },
  delBtn:    { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.danger, alignSelf: 'flex-start' },
  delText:   { fontSize: 11.5, fontWeight: '700', color: Colors.white },
  hint:      { fontSize: 11.5, color: Colors.slate400, fontStyle: 'italic', lineHeight: 16 },
  errBox:    { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  errText:   { color: Colors.danger, fontSize: 12.5 },
});
