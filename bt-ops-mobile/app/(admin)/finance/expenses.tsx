import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
  TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, SearchBar, Chip } from '@/components/ui';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import {
  KpiCard, KpiGrid, DataTable, Pager, paginate, MonthPicker, ToolButton,
  Field, Input, Column, SectionTitle,
} from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import {
  inr, thisMonthKey, todayISO, EXPENSE_CATEGORIES, RECURRENCES,
  catLabel, parentFor,
} from '@/utils/finance';
import { exportExcel, exportPdf } from '@/utils/financeExport';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

interface ExpenseRow {
  id: string; date?: any; monthKey?: string; category?: string; parentCategory?: string;
  subCategory?: string; amount?: number; notes?: string;
  isRecurring?: boolean; recurrence?: string | null; attachmentUrl?: string;
}
interface Template {
  id: string; category?: string; subCategory?: string; defaultAmount?: number;
  recurrence?: string; nextRunMonthKey?: string; parentCategory?: string; notes?: string;
}

const toDateStr = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d.toDate) return d.toDate().toISOString().slice(0, 10);
  if (d.seconds) return new Date(d.seconds * 1000).toISOString().slice(0, 10);
  return '';
};

const emptyForm = () => ({
  id: '', date: todayISO(), category: '', subCategory: '', amount: '',
  notes: '', isRecurring: false, recurrence: 'monthly',
});

export default function FinanceExpensesScreen() {
  const [rows, setRows]           = useState<ExpenseRow[]>([]);
  const [budgets, setBudgets]     = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const [monthKey, setMonthKey]   = useState(thisMonthKey());
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [marketingOnly, setMarketingOnly] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [form, setForm] = useState(emptyForm());
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (mk = monthKey) => {
    setErr('');
    try {
      const [ex, bu, tp] = await Promise.all([
        getDocs(query(collection(financeDb, 'expenses_global'), where('monthKey', '==', mk))),
        getDocs(query(collection(financeDb, 'expense_budgets'), where('monthKey', '==', mk))),
        getDocs(collection(financeDb, 'expense_templates')),
      ]);
      setRows(ex.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRow)));
      setBudgets(bu.docs.map(d => ({ id: d.id, ...d.data() })));
      setTemplates(tp.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthKey]);

  useEffect(() => { load(monthKey); }, [monthKey, load]);
  useEffect(() => { setPage(1); }, [catFilter, search, marketingOnly, monthKey]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r => {
      const catOk = catFilter ? r.category === catFilter : true;
      const mkOk  = marketingOnly ? parentFor(r.category || '') === 'marketing' : true;
      const sOk   = !s
        || (r.subCategory || '').toLowerCase().includes(s)
        || (r.notes || '').toLowerCase().includes(s);
      return catOk && mkOk && sOk;
    });
  }, [rows, catFilter, marketingOnly, search]);

  const totals = useMemo(() => {
    const sum = filtered.reduce((a, r) => a + Number(r.amount || 0), 0);
    const byCat: Record<string, number> = {};
    filtered.forEach(r => {
      byCat[r.category || 'other'] = (byCat[r.category || 'other'] || 0) + Number(r.amount || 0);
    });
    return { sum, byCat };
  }, [filtered]);

  const marketingSpent = Object.entries(totals.byCat)
    .filter(([c]) => parentFor(c) === 'marketing')
    .reduce((s, [, v]) => s + v, 0);
  const marketingBudget = budgets
    .filter(b => parentFor(b.category) === 'marketing')
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  /* ── CRUD ──────────────────────────────────────────────────────────── */
  const openNew  = () => { setForm(emptyForm()); setEditOpen(true); };
  const openEdit = (r: ExpenseRow) => {
    setForm({
      id: r.id, date: toDateStr(r.date) || todayISO(), category: r.category || '',
      subCategory: r.subCategory || '', amount: String(r.amount ?? ''),
      notes: r.notes || '', isRecurring: !!r.isRecurring, recurrence: r.recurrence || 'monthly',
    });
    setEditOpen(true);
  };

  const save = async () => {
    if (!form.category || !form.amount || !form.date) {
      return Alert.alert('Missing fields', 'Category, Amount and Date are required.');
    }
    const mk = form.date.slice(0, 7);
    const payload: any = {
      date: new Date(form.date),
      monthKey: mk,
      category: form.category,
      parentCategory: parentFor(form.category),
      subCategory: form.subCategory || '',
      amount: Number(form.amount || 0),
      notes: form.notes || '',
      isRecurring: !!form.isRecurring,
      recurrence: form.isRecurring ? form.recurrence : null,
      updatedAt: serverTimestamp(),
    };
    setSaving(true);
    try {
      if (form.id) {
        await updateDoc(doc(financeDb, 'expenses_global', form.id), payload);
      } else {
        await addDoc(collection(financeDb, 'expenses_global'), { ...payload, createdAt: serverTimestamp() });
      }
      setEditOpen(false);
      await load(mk === monthKey ? monthKey : mk);
      if (mk !== monthKey) setMonthKey(mk);
    } catch (e) {
      Alert.alert('Save failed', describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: ExpenseRow) => {
    confirmAction(
      'Delete expense?',
      `${catLabel(r.category || '')} — ${inr(r.amount)} will be permanently removed.`,
      'Delete',
      async () => {
        try {
          await deleteDoc(doc(financeDb, 'expenses_global', r.id));
          setRows(prev => prev.filter(x => x.id !== r.id));
        } catch (e) {
          Alert.alert('Delete failed', describeError(e));
        }
      },
    );
  };

  /** Mirrors postRecurring() in FinanceExpenses.js */
  const postRecurring = async () => {
    const candidates = templates.filter(t => (t.nextRunMonthKey || '') <= monthKey);
    if (!candidates.length) return Alert.alert('Nothing to post', 'No templates due for this month.');

    const existing = new Set(rows.map(r => `${r.monthKey}|${r.category}|${r.subCategory || ''}`));
    const bump = (mk: string, rec?: string) => {
      const [y, m] = mk.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      if (rec === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
      else if (rec === 'quarterly') dt.setMonth(dt.getMonth() + 3);
      else dt.setMonth(dt.getMonth() + 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    };

    let created = 0;
    try {
      for (const t of candidates) {
        if (existing.has(`${monthKey}|${t.category}|${t.subCategory || ''}`)) continue;
        await addDoc(collection(financeDb, 'expenses_global'), {
          date: new Date(`${monthKey}-01`),
          monthKey,
          category: t.category,
          parentCategory: t.parentCategory || parentFor(t.category || ''),
          subCategory: t.subCategory || '',
          amount: Number(t.defaultAmount || 0),
          notes: t.notes || 'posted from template',
          isRecurring: true,
          recurrence: t.recurrence || 'monthly',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(financeDb, 'expense_templates', t.id), {
          nextRunMonthKey: bump(monthKey, t.recurrence),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
      await load(monthKey);
      Alert.alert('Recurring posted', created ? `${created} expense(s) created for ${monthKey}.` : 'All templates were already posted for this month.');
    } catch (e) {
      Alert.alert('Posting failed', describeError(e));
    }
  };

  /* ── Exports ───────────────────────────────────────────────────────── */
  const rowsForExport = () => filtered.map(r => ({
    Date: toDateStr(r.date),
    MonthKey: r.monthKey || '',
    Category: catLabel(r.category || ''),
    SubCategory: r.subCategory || '',
    Amount: Number(r.amount || 0),
    Recurring: r.isRecurring ? (r.recurrence || 'monthly') : '',
    Notes: r.notes || '',
  }));

  const doExportExcel = async () => {
    try {
      await exportExcel(`BT_Ops_Expenses_${monthKey}`, [
        { name: `Expenses_${monthKey}`, rows: rowsForExport() },
        {
          name: 'By_Category',
          rows: Object.entries(totals.byCat).map(([c, v]) => ({ Category: catLabel(c), Amount: v })),
        },
      ]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const doExportPdf = async () => {
    try {
      await exportPdf(`BT_Ops_Expenses_${monthKey}`, `Ops Expenses — ${monthKey}`, [
        {
          title: 'Summary',
          columns: ['Metric', 'Amount'],
          rows: [
            ['Total Ops Spend', inr(totals.sum)],
            ['Marketing Spent', inr(marketingSpent)],
            ['Marketing Budget', inr(marketingBudget)],
            ['Marketing Variance', inr(marketingBudget - marketingSpent)],
          ],
        },
        {
          title: 'By Category',
          columns: ['Category', 'Amount'],
          rows: Object.entries(totals.byCat).map(([c, v]) => [catLabel(c), inr(v)]),
        },
        {
          title: 'Expenses',
          columns: ['Date', 'Category', 'Vendor', 'Amount', 'Notes'],
          rows: filtered.map(r => [
            toDateStr(r.date), catLabel(r.category || ''), r.subCategory || '—',
            inr(r.amount), r.notes || '',
          ]),
        },
      ]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  /* ── Table ─────────────────────────────────────────────────────────── */
  const cols: Column[] = [
    { key: 'date',     label: 'Date',           width: 92 },
    { key: 'category', label: 'Category',       width: 118 },
    { key: 'vendor',   label: 'Vendor/Campaign', width: 130 },
    { key: 'amount',   label: 'Amount',         width: 92, align: 'right' },
    {
      key: 'recurring', label: 'Recurring', width: 84,
      render: (r: any) => r._rec
        ? <View style={s.recPill}><Text style={s.recText}>{r._rec}</Text></View>
        : <Text style={s.dash}>—</Text>,
    },
    { key: 'notes', label: 'Notes', width: 130 },
    {
      key: 'actions', label: 'Actions', width: 128,
      render: (r: any) => (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => openEdit(r._raw)}>
            <Text style={s.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.delBtn} onPress={() => remove(r._raw)}>
            <Text style={s.delText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ),
    },
  ];

  const tableRows = paginate(filtered, page, pageSize).map(r => ({
    id: r.id, _raw: r, _rec: r.isRecurring ? (r.recurrence || 'monthly') : '',
    date: toDateStr(r.date) || '—',
    category: catLabel(r.category || ''),
    vendor: r.subCategory || '—',
    amount: inr(r.amount),
    notes: r.notes || '—',
  }));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(monthKey); }} tintColor={Colors.primary} />
        }
      >
        <PageTitle
          icon="briefcase-outline"
          title="Ops Expenses"
          subtitle={`${inr(totals.sum)} in ${monthKey}`}
        />

        {!!err && <Panel style={s.errBox}><Text style={s.errText}>{err}</Text></Panel>}

        <KpiGrid>
          <KpiCard
            title="Marketing Spent" value={inr(marketingSpent)}
            sub={`Budget ${inr(marketingBudget)} • Var ${inr(marketingBudget - marketingSpent)}`}
          />
          <KpiCard title="Total Ops Spend" value={inr(totals.sum)} sub={`${filtered.length} items`} />
        </KpiGrid>

        <Panel style={{ gap: 12 }}>
          <MonthPicker value={monthKey} onChange={setMonthKey} label="Month" />
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search vendor / notes" />
          <TouchableOpacity style={s.checkRow} onPress={() => setMarketingOnly(v => !v)}>
            <Ionicons
              name={marketingOnly ? 'checkbox' : 'square-outline'}
              size={19}
              color={marketingOnly ? Colors.primary : Colors.slate400}
            />
            <Text style={s.checkLabel}>Marketing only</Text>
          </TouchableOpacity>
        </Panel>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All" active={!catFilter} onPress={() => setCatFilter('')} />
          {EXPENSE_CATEGORIES.map(c => (
            <Chip key={c.value} label={c.label} active={catFilter === c.value} onPress={() => setCatFilter(c.value)} />
          ))}
        </ScrollView>

        <View style={s.btnRow}>
          <ToolButton label="Export PDF"   icon="document-outline" onPress={doExportPdf} />
          <ToolButton label="Export Excel" icon="download-outline" onPress={doExportExcel} />
          <View style={{ flex: 1 }} />
          <ToolButton label="Add Expense" icon="add" onPress={openNew} primary />
        </View>

        <DataTable columns={cols} rows={tableRows} emptyText="No expenses found." />
        {filtered.length > 0 && (
          <Pager page={page} setPage={setPage} totalPages={totalPages}
                 pageSize={pageSize} setPageSize={setPageSize} />
        )}

        <ToolButton
          label={`Post recurring items for ${monthKey}`}
          icon="repeat-outline"
          onPress={postRecurring}
        />

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Add / Edit modal */}
      {editOpen && (
        <Modal visible animationType="slide" onRequestClose={() => setEditOpen(false)}>
          <ModalSafeArea style={s.modalRoot}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{form.id ? 'Edit Expense' : 'Add Expense'}</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.slate700} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <Field label="Date *">
                <Input value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" />
              </Field>

              <Field label="Category *">
                <View style={s.pickerBox}>
                  <Picker
                    selectedValue={form.category}
                    onValueChange={v => setForm(f => ({ ...f, category: v }))}
                  >
                    <Picker.Item label="Select…" value="" />
                    {EXPENSE_CATEGORIES.map(c => (
                      <Picker.Item key={c.value} label={c.label} value={c.value} />
                    ))}
                  </Picker>
                </View>
              </Field>

              <Field label="SubCategory / Vendor">
                <Input
                  value={form.subCategory}
                  onChangeText={v => setForm(f => ({ ...f, subCategory: v }))}
                  placeholder="e.g. Reel Boost — Monsoon"
                />
              </Field>

              <Field label="Amount (₹) *">
                <Input
                  value={form.amount}
                  onChangeText={v => setForm(f => ({ ...f, amount: v }))}
                  keyboardType="number-pad" placeholder="0"
                />
              </Field>

              <Field label="Notes">
                <Input
                  value={form.notes}
                  onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                  placeholder="optional" multiline
                  style={{ height: 72, paddingTop: 10, textAlignVertical: 'top' }}
                />
              </Field>

              <TouchableOpacity
                style={s.checkRow}
                onPress={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
              >
                <Ionicons
                  name={form.isRecurring ? 'checkbox' : 'square-outline'}
                  size={19}
                  color={form.isRecurring ? Colors.primary : Colors.slate400}
                />
                <Text style={s.checkLabel}>Recurring?</Text>
              </TouchableOpacity>

              {form.isRecurring && (
                <Field label="Recurrence">
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
              )}

              <Text style={s.hint}>
                Attachments can be added from the web app — mobile uploads aren’t supported for
                expense receipts yet.
              </Text>
            </ScrollView>

            <View style={s.modalFooter}>
              <ToolButton label="Cancel" onPress={() => setEditOpen(false)} />
              <View style={{ flex: 1 }} />
              {saving
                ? <ActivityIndicator color={Colors.primary} />
                : <ToolButton label={form.id ? 'Save Changes' : 'Add Expense'} icon="checkmark" onPress={save} primary />}
            </View>
          </ModalSafeArea>
        </Modal>
      )}
    </AppShell>
  );
}

const s = StyleSheet.create({
  scroll:     { padding: 16, gap: 12, paddingBottom: 40 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  chipRow:    { gap: 8, paddingRight: 8 },
  btnRow:     { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 13, color: Colors.slate700, fontWeight: '600' },
  recPill:    { backgroundColor: Colors.infoBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  recText:    { fontSize: 10, fontWeight: '700', color: Colors.info },
  dash:       { fontSize: 12.5, color: Colors.slate400 },
  actionRow:  { flexDirection: 'row', gap: 6 },
  editBtn:    { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.slate100 },
  editText:   { fontSize: 11.5, fontWeight: '700', color: Colors.slate700 },
  delBtn:     { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.danger },
  delText:    { fontSize: 11.5, fontWeight: '700', color: Colors.white },
  errBox:     { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  errText:    { color: Colors.danger, fontSize: 12.5 },

  modalRoot:   { flex: 1, backgroundColor: Colors.slate50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
  modalTitle:  { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  modalBody:   { padding: 16, gap: 12, paddingBottom: 30 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.slate200 },
  pickerBox:   { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, backgroundColor: Colors.white, justifyContent: 'center', minHeight: 44 },
  hint:        { fontSize: 11.5, color: Colors.slate400, fontStyle: 'italic', lineHeight: 16 },
});
