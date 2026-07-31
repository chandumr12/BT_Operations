import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
  TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, SearchBar, Chip } from '@/components/ui';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import {
  KpiCard, KpiGrid, DataTable, Pager, paginate, ToolButton,
  Field, Input, Column, SectionTitle,
} from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import { inr } from '@/utils/finance';
import { exportExcel, exportPdf } from '@/utils/financeExport';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

const LEAD_TYPES = ['Full-time', 'Part-time', 'Freelance'];
const GENDERS = ['Male', 'Female', 'Other'];

interface Lead {
  id: string; name?: string; phone?: string; age?: any; gender?: string;
  isActive?: boolean; hiredDate?: string; type?: string; notes?: string;
  bankName?: string; accountName?: string; accountNumber?: string;
  ifsc?: string; panNumber?: string; idProof?: string;
}
interface Batch {
  id: string; batchCode?: string; date?: string; startDate?: string; trekName?: string;
  leadPayments?: { name?: string; amount?: any }[];
  leadId?: string; leadName?: string; leadPayment?: any;
  paymentClearedBy?: Record<string, boolean>; paymentCleared?: boolean;
}
interface Payout {
  id: string; batchCode: string; date: string; amount: number; cleared: boolean; leadKey: string;
}

const emptyLead = () => ({
  id: '', name: '', phone: '', age: '', gender: '', isActive: true,
  hiredDate: '', type: '', notes: '',
  bankName: '', accountName: '', accountNumber: '', ifsc: '', panNumber: '', idProof: '',
});

const safeMonth = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('default', { month: 'short', year: 'numeric' });
};

export default function FinanceLeadsScreen() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [trekFilter, setTrekFilter]   = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyLead());

  const load = useCallback(async () => {
    setErr('');
    try {
      const [ls, bs] = await Promise.all([
        getDocs(collection(financeDb, 'leads')),
        getDocs(collection(financeDb, 'batches')),
      ]);
      setLeads(ls.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));
      setBatches(bs.docs.map(d => ({ id: d.id, ...d.data() } as Batch)));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, monthFilter, trekFilter]);

  const months = useMemo(
    () => Array.from(new Set(batches.map(b => safeMonth(b.date || b.startDate)))).filter(Boolean),
    [batches],
  );
  const treks = useMemo(
    () => Array.from(new Set(batches.map(b => b.trekName).filter(Boolean))) as string[],
    [batches],
  );

  const filteredBatches = useMemo(() => batches.filter(b => {
    const m = safeMonth(b.date || b.startDate);
    return (!monthFilter || monthFilter === m) && (!trekFilter || trekFilter === b.trekName);
  }), [batches, monthFilter, trekFilter]);

  /**
   * Mirrors getLeadPayouts() in FinanceLeads.js — matches by lead id first,
   * then falls back to case-insensitive name matching, and supports both the
   * `leadPayments[]` array and the legacy single `leadPayment` field.
   */
  const payoutsFor = useCallback((lead: Lead): Payout[] => {
    const keyById = lead.id;
    const keyByName = (lead.name || '').trim();
    const entries: Payout[] = [];

    filteredBatches.forEach(b => {
      const lp = Array.isArray(b.leadPayments) ? b.leadPayments : [];
      const fromArray = lp
        .filter(it => (it?.name || '').trim().toLowerCase() === keyByName.toLowerCase())
        .reduce((s, it) => s + (parseInt(String(it?.amount || 0), 10) || 0), 0);

      const legacyHit =
        (b.leadId && keyById && b.leadId === keyById) ||
        ((b.leadName || '').trim().toLowerCase() === keyByName.toLowerCase());
      const fromLegacy = legacyHit ? (parseInt(String(b.leadPayment || 0), 10) || 0) : 0;

      const amount = fromArray + fromLegacy;
      if (amount > 0) {
        const clearedBy = b.paymentClearedBy || {};
        const cleared =
          (keyById && typeof clearedBy[keyById] === 'boolean') ? clearedBy[keyById]
          : (typeof clearedBy[keyByName] === 'boolean') ? clearedBy[keyByName]
          : !!b.paymentCleared;

        entries.push({
          id: b.id,
          batchCode: b.batchCode || '—',
          date: b.date || b.startDate || '—',
          amount, cleared,
          leadKey: keyById || keyByName,
        });
      }
    });
    return entries;
  }, [filteredBatches]);

  const togglePayment = async (batchId: string, leadKey: string, current: boolean) => {
    if (!batchId || !leadKey) return;
    try {
      await updateDoc(doc(financeDb, 'batches', batchId), {
        [`paymentClearedBy.${leadKey}`]: !current,
      });
      setBatches(prev => prev.map(b => b.id === batchId
        ? { ...b, paymentClearedBy: { ...(b.paymentClearedBy || {}), [leadKey]: !current } }
        : b));
    } catch (e) {
      Alert.alert('Update failed', describeError(e));
    }
  };

  const visibleLeads = useMemo(() => {
    const s = search.toLowerCase();
    return leads.filter(l =>
      !s || (l.name || '').toLowerCase().includes(s) || (l.phone || '').includes(s));
  }, [leads, search]);

  const totalLeads    = leads.length;
  const activeLeads   = leads.filter(l => l.isActive).length;
  const inactiveLeads = totalLeads - activeLeads;

  /* ── CRUD ──────────────────────────────────────────────────────────── */
  const openNew  = () => { setForm(emptyLead()); setOpen(true); };
  const openEdit = (l: Lead) => {
    setForm({
      id: l.id, name: l.name || '', phone: l.phone || '', age: String(l.age ?? ''),
      gender: l.gender || '', isActive: l.isActive !== false, hiredDate: l.hiredDate || '',
      type: l.type || '', notes: l.notes || '',
      bankName: l.bankName || '', accountName: l.accountName || '',
      accountNumber: l.accountNumber || '', ifsc: l.ifsc || '',
      panNumber: l.panNumber || '', idProof: l.idProof || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Missing field', 'Name is required.');
    const payload: any = {
      name: form.name.trim(), phone: form.phone, age: form.age ? Number(form.age) : '',
      gender: form.gender, isActive: form.isActive, hiredDate: form.hiredDate,
      type: form.type, notes: form.notes,
      bankName: form.bankName, accountName: form.accountName,
      accountNumber: form.accountNumber, ifsc: form.ifsc,
      panNumber: form.panNumber, idProof: form.idProof,
      updatedAt: serverTimestamp(),
    };
    setSaving(true);
    try {
      if (form.id) await updateDoc(doc(financeDb, 'leads', form.id), payload);
      else         await addDoc(collection(financeDb, 'leads'), { ...payload, createdAt: serverTimestamp() });
      setOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Save failed', describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (l: Lead) => {
    confirmAction(
      'Delete lead?',
      `${l.name || 'This lead'} will be removed from the finance leads list.`,
      'Delete',
      async () => {
        try {
          await deleteDoc(doc(financeDb, 'leads', l.id));
          setLeads(prev => prev.filter(x => x.id !== l.id));
        } catch (e) {
          Alert.alert('Delete failed', describeError(e));
        }
      },
    );
  };

  /* ── Exports ───────────────────────────────────────────────────────── */
  const exportProfile = async (l: Lead) => {
    try {
      await exportPdf(`Lead_Profile_${l.name}`, `Lead Profile — ${l.name}`, [{
        columns: ['Field', 'Value'],
        rows: [
          ['Name', l.name || ''], ['Phone', l.phone || ''], ['Age', String(l.age ?? '')],
          ['Gender', l.gender || ''], ['Type', l.type || ''],
          ['Active', l.isActive ? 'Yes' : 'No'], ['Hired Date', l.hiredDate || ''],
          ['Bank', l.bankName || ''], ['Account Name', l.accountName || ''],
          ['Account No.', l.accountNumber || ''], ['IFSC', l.ifsc || ''],
          ['PAN', l.panNumber || ''], ['ID Proof', l.idProof || ''],
          ['Notes', l.notes || ''],
        ],
      }]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const exportPayouts = async (l: Lead) => {
    const entries = payoutsFor(l);
    try {
      await exportPdf(`Lead_Payouts_${l.name}`, `Payouts — ${l.name}`, [{
        title: `Batches led: ${entries.length} • Total: ${inr(entries.reduce((s, e) => s + e.amount, 0))}`,
        columns: ['Batch Code', 'Date', 'Amount', 'Status'],
        rows: entries.map(e => [e.batchCode, e.date, inr(e.amount), e.cleared ? 'Cleared' : 'Pending']),
      }]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const exportAll = async () => {
    try {
      await exportExcel('Lead_Payments', [
        {
          name: 'Leads',
          rows: leads.map(l => ({
            Name: l.name || '', Phone: l.phone || '', Age: l.age ?? '', Gender: l.gender || '',
            Type: l.type || '', Status: l.isActive ? 'Active' : 'Inactive',
            'Hired Date': l.hiredDate || '',
            'Batches Led': payoutsFor(l).length,
            'Total Paid': payoutsFor(l).reduce((s, e) => s + e.amount, 0),
          })),
        },
        {
          name: 'Payouts',
          rows: leads.flatMap(l => payoutsFor(l).map(e => ({
            Lead: l.name || '', 'Batch Code': e.batchCode, Date: e.date,
            Amount: e.amount, Status: e.cleared ? 'Cleared' : 'Pending',
          }))),
        },
      ]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const payoutCols: Column[] = [
    { key: 'batchCode', label: 'Batch Code', width: 96 },
    { key: 'date',      label: 'Date',       width: 96 },
    { key: 'amount',    label: 'Amount',     width: 88, align: 'right' },
    {
      key: 'status', label: 'Status', width: 88,
      render: (r: any) => (
        <View style={[s.payPill, { backgroundColor: r._cleared ? Colors.successBg : Colors.dangerBg }]}>
          <Text style={[s.payText, { color: r._cleared ? Colors.success : Colors.danger }]}>
            {r._cleared ? 'Paid' : 'Unpaid'}
          </Text>
        </View>
      ),
    },
    {
      key: 'toggle', label: 'Toggle', width: 64,
      render: (r: any) => (
        <TouchableOpacity onPress={() => togglePayment(r.id, r._leadKey, r._cleared)} hitSlop={8}>
          <Ionicons
            name={r._cleared ? 'checkbox' : 'square-outline'}
            size={20}
            color={r._cleared ? Colors.success : Colors.slate400}
          />
        </TouchableOpacity>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / pageSize));

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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <PageTitle icon="people-outline" title="Leads" subtitle={`${totalLeads} leads`} />

        {!!err && <Panel style={s.errBox}><Text style={s.errText}>{err}</Text></Panel>}

        <KpiGrid>
          <KpiCard title="Total Leads" value={String(totalLeads)} />
          <KpiCard title="Active"   value={String(activeLeads)}   valueColor={Colors.success} />
          <KpiCard title="Inactive" value={String(inactiveLeads)} valueColor={Colors.danger} />
        </KpiGrid>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search lead name / phone" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All Months" active={!monthFilter} onPress={() => setMonthFilter('')} />
          {months.map(m => (
            <Chip key={m} label={m} active={monthFilter === m} onPress={() => setMonthFilter(m)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All Treks" active={!trekFilter} onPress={() => setTrekFilter('')} />
          {treks.map(t => (
            <Chip key={t} label={t} active={trekFilter === t} onPress={() => setTrekFilter(t)} />
          ))}
        </ScrollView>

        <View style={s.btnRow}>
          <ToolButton label="Export All to Excel" icon="download-outline" onPress={exportAll} />
          <View style={{ flex: 1 }} />
          <ToolButton label="Add Lead" icon="add" onPress={openNew} primary />
        </View>

        {/* Lead cards */}
        {paginate(visibleLeads, page, pageSize).map(l => {
          const entries = payoutsFor(l);
          const total = entries.reduce((s2, e) => s2 + e.amount, 0);
          const allPaid = entries.length > 0 && entries.every(e => e.cleared);
          return (
            <Panel key={l.id} style={{ gap: 10 }}>
              <View style={s.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.nameRow}>
                    <Text style={s.leadName} numberOfLines={1}>{l.name || 'Unnamed'}</Text>
                    {!!l.type && (
                      <View style={s.typePill}><Text style={s.typeText}>{l.type}</Text></View>
                    )}
                    <View style={[s.statusPill, { backgroundColor: allPaid ? Colors.successBg : Colors.dangerBg }]}>
                      <Text style={[s.statusText, { color: allPaid ? Colors.success : Colors.danger }]}>
                        {allPaid ? 'Cleared' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.leadMeta}>
                    Batches Led: <Text style={s.leadMetaBold}>{entries.length}</Text>
                    {'   '}Total Paid: <Text style={s.leadMetaBold}>{inr(total)}</Text>
                  </Text>
                </View>
                <View style={[s.dot, { backgroundColor: l.isActive ? Colors.success : Colors.slate300 }]} />
              </View>

              <View style={s.cardBtnRow}>
                <ToolButton label="Profile PDF"  icon="document-outline" onPress={() => exportProfile(l)} />
                <ToolButton label="Payouts PDF"  icon="cash-outline"     onPress={() => exportPayouts(l)} primary />
                <ToolButton label="Edit"         icon="create-outline"   onPress={() => openEdit(l)} />
                <TouchableOpacity style={s.delBtn} onPress={() => remove(l)}>
                  <Ionicons name="trash-outline" size={15} color={Colors.white} />
                </TouchableOpacity>
              </View>

              <DataTable
                columns={payoutCols}
                rows={entries.map(e => ({
                  id: e.id, _cleared: e.cleared, _leadKey: e.leadKey,
                  batchCode: e.batchCode, date: e.date, amount: inr(e.amount),
                }))}
                emptyText="No payouts in the selected filters."
              />
            </Panel>
          );
        })}

        {visibleLeads.length === 0 && (
          <Panel><Text style={s.emptyText}>No leads match your search.</Text></Panel>
        )}

        {visibleLeads.length > 0 && (
          <Pager page={page} setPage={setPage} totalPages={totalPages}
                 pageSize={pageSize} setPageSize={setPageSize} />
        )}

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Add / Edit lead */}
      {open && (
        <Modal visible animationType="slide" onRequestClose={() => setOpen(false)}>
          <ModalSafeArea style={s.modalRoot}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{form.id ? 'Edit Lead' : 'Add Lead'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.slate700} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <SectionTitle icon="person-outline" title="Lead Details" />
              <Field label="Name *">
                <Input value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Full name" />
              </Field>
              <View style={s.row}>
                <Field label="Phone" flex={1}>
                  <Input value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
                </Field>
                <Field label="Age" flex={1}>
                  <Input value={form.age} onChangeText={v => setForm(f => ({ ...f, age: v }))} keyboardType="number-pad" />
                </Field>
              </View>
              <View style={s.row}>
                <Field label="Gender" flex={1}>
                  <View style={s.pickerBox}>
                    <Picker selectedValue={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                      <Picker.Item label="Select…" value="" />
                      {GENDERS.map(g => <Picker.Item key={g} label={g} value={g} />)}
                    </Picker>
                  </View>
                </Field>
                <Field label="Type" flex={1}>
                  <View style={s.pickerBox}>
                    <Picker selectedValue={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <Picker.Item label="Select…" value="" />
                      {LEAD_TYPES.map(t => <Picker.Item key={t} label={t} value={t} />)}
                    </Picker>
                  </View>
                </Field>
              </View>
              <Field label="Hired Date">
                <Input value={form.hiredDate} onChangeText={v => setForm(f => ({ ...f, hiredDate: v }))} placeholder="YYYY-MM-DD" />
              </Field>
              <TouchableOpacity style={s.checkRow} onPress={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                <Ionicons
                  name={form.isActive ? 'checkbox' : 'square-outline'}
                  size={19}
                  color={form.isActive ? Colors.primary : Colors.slate400}
                />
                <Text style={s.checkLabel}>Active</Text>
              </TouchableOpacity>

              <SectionTitle icon="card-outline" title="Bank & KYC" />
              <Field label="Bank Name">
                <Input value={form.bankName} onChangeText={v => setForm(f => ({ ...f, bankName: v }))} />
              </Field>
              <Field label="Account Name">
                <Input value={form.accountName} onChangeText={v => setForm(f => ({ ...f, accountName: v }))} />
              </Field>
              <View style={s.row}>
                <Field label="Account Number" flex={1}>
                  <Input value={form.accountNumber} onChangeText={v => setForm(f => ({ ...f, accountNumber: v }))} keyboardType="number-pad" />
                </Field>
                <Field label="IFSC" flex={1}>
                  <Input value={form.ifsc} onChangeText={v => setForm(f => ({ ...f, ifsc: v }))} autoCapitalize="characters" />
                </Field>
              </View>
              <View style={s.row}>
                <Field label="PAN Number" flex={1}>
                  <Input value={form.panNumber} onChangeText={v => setForm(f => ({ ...f, panNumber: v }))} autoCapitalize="characters" />
                </Field>
                <Field label="ID Proof" flex={1}>
                  <Input value={form.idProof} onChangeText={v => setForm(f => ({ ...f, idProof: v }))} placeholder="e.g. Aadhaar" />
                </Field>
              </View>

              <Field label="Notes">
                <Input
                  value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                  placeholder="Optional" multiline
                  style={{ height: 72, paddingTop: 10, textAlignVertical: 'top' }}
                />
              </Field>
            </ScrollView>

            <View style={s.modalFooter}>
              <ToolButton label="Cancel" onPress={() => setOpen(false)} />
              <View style={{ flex: 1 }} />
              {saving
                ? <ActivityIndicator color={Colors.primary} />
                : <ToolButton label={form.id ? 'Save Changes' : 'Add Lead'} icon="checkmark" onPress={save} primary />}
            </View>
          </ModalSafeArea>
        </Modal>
      )}
    </AppShell>
  );
}

const s = StyleSheet.create({
  scroll:      { padding: 16, gap: 12, paddingBottom: 40 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  chipRow:     { gap: 8, paddingRight: 8 },
  btnRow:      { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  row:         { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  cardHead:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  leadName:    { fontSize: 15.5, fontWeight: '800', color: Colors.slate900 },
  typePill:    { backgroundColor: Colors.infoBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  typeText:    { fontSize: 10, fontWeight: '700', color: Colors.info },
  statusPill:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  statusText:  { fontSize: 10, fontWeight: '800' },
  leadMeta:    { fontSize: 12, color: Colors.slate500, marginTop: 4 },
  leadMetaBold:{ fontWeight: '800', color: Colors.slate900 },
  dot:         { width: 9, height: 9, borderRadius: 5 },
  cardBtnRow:  { flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center' },
  delBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  payPill:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, alignSelf: 'flex-start' },
  payText:     { fontSize: 10, fontWeight: '800' },
  checkRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel:  { fontSize: 13, color: Colors.slate700, fontWeight: '600' },
  emptyText:   { fontSize: 13, color: Colors.slate400, textAlign: 'center', fontStyle: 'italic', paddingVertical: 12 },
  errBox:      { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  errText:     { color: Colors.danger, fontSize: 12.5 },

  modalRoot:   { flex: 1, backgroundColor: Colors.slate50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
  modalTitle:  { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  modalBody:   { padding: 16, gap: 12, paddingBottom: 30 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.slate200 },
  pickerBox:   { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, backgroundColor: Colors.white, justifyContent: 'center', minHeight: 44 },
});
