import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl,
  TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  collection, getDocs, addDoc, updateDoc, doc, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, SearchBar, Chip } from '@/components/ui';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import {
  KpiCard, KpiGrid, DataTable, Pager, paginate, MonthPicker, ToolButton,
  Field, Input, Column,
} from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import { inr, thisMonthKey } from '@/utils/finance';
import { exportExcel, exportPdf } from '@/utils/financeExport';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

const STATUSES = ['pending', 'processed', 'paid'];

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:   { color: '#d97706', bg: '#fffbeb' },
  processed: { color: '#2563eb', bg: '#eff6ff' },
  paid:      { color: '#16a34a', bg: '#f0fdf4' },
};

interface PayrollRow {
  id: string; employeeId?: string; employeeName?: string; role?: string; monthKey?: string;
  gross?: number; allowances?: number; deductions?: number; netPay?: number;
  status?: string; paidOn?: any; notes?: string;
}
interface Employee {
  id: string; name?: string; role?: string; status?: any; salaryType?: string;
  baseSalary?: number; allowances?: number; deductions?: number;
}

const tsToDate = (t: any) => t?.seconds ? new Date(t.seconds * 1000).toISOString().slice(0, 10) : '';

export default function FinancePayrollScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [month, setMonth] = useState(thisMonthKey());
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editRow, setEditRow] = useState<PayrollRow | null>(null);
  const [editForm, setEditForm] = useState({ allowances: '', deductions: '', notes: '', status: 'pending' });

  const load = useCallback(async () => {
    setErr('');
    try {
      const [emp, pay] = await Promise.all([
        getDocs(collection(financeDb, 'employees')),
        getDocs(collection(financeDb, 'payroll')),
      ]);
      setEmployees(emp.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      setRows(pay.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRow)).filter(r => r.monthKey === month));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, employeeFilter, statusFilter, month]);

  /** Mirrors handleGenerate() — active fixed-salary employees only. */
  const generate = async () => {
    setBusy(true);
    try {
      const fixedActive = employees.filter(e => e.status && e.salaryType === 'fixed');
      const existing = new Set(rows.map(r => r.employeeId));
      const toCreate = fixedActive.filter(e => !existing.has(e.id));

      for (const e of toCreate) {
        const gross = Number(e.baseSalary || 0) + Number(e.allowances || 0);
        await addDoc(collection(financeDb, 'payroll'), {
          employeeId: e.id,
          employeeName: e.name || '',
          role: e.role || '',
          monthKey: month,
          gross: Number(e.baseSalary || 0),
          allowances: Number(e.allowances || 0),
          deductions: Number(e.deductions || 0),
          netPay: gross - Number(e.deductions || 0),
          status: 'pending',
          paidOn: null,
          notes: '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      await load();
      if (!toCreate.length) {
        Alert.alert('Already generated', 'Payroll already exists for all active fixed-salary employees this month.');
      } else {
        Alert.alert('Payroll generated', `${toCreate.length} row(s) created for ${month}.`);
      }
    } catch (e) {
      Alert.alert('Generate failed', describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const patchRow = async (id: string, patch: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    try {
      await updateDoc(doc(financeDb, 'payroll', id), { ...patch, updatedAt: Timestamp.now() });
    } catch (e) {
      Alert.alert('Update failed', describeError(e));
      load();
    }
  };

  const markPaid = async (r: PayrollRow) => {
    await patchRow(r.id, { status: 'paid', paidOn: Timestamp.now() });
  };

  const remove = (r: PayrollRow) => {
    confirmAction(
      'Delete payroll entry?',
      `${r.employeeName || 'Employee'} — ${r.monthKey}. This cannot be undone.`,
      'Delete',
      async () => {
        try {
          await deleteDoc(doc(financeDb, 'payroll', r.id));
          setRows(prev => prev.filter(x => x.id !== r.id));
        } catch (e) {
          Alert.alert('Delete failed', describeError(e));
        }
      },
    );
  };

  const openEdit = (r: PayrollRow) => {
    setEditRow(r);
    setEditForm({
      allowances: String(r.allowances ?? 0),
      deductions: String(r.deductions ?? 0),
      notes: r.notes || '',
      status: r.status || 'pending',
    });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const allowances = Number(editForm.allowances || 0);
    const deductions = Number(editForm.deductions || 0);
    const netPay = Number(editRow.gross || 0) + allowances - deductions;
    const patch: any = { allowances, deductions, netPay, notes: editForm.notes, status: editForm.status };
    if (editForm.status === 'paid' && editRow.status !== 'paid') patch.paidOn = Timestamp.now();
    await patchRow(editRow.id, patch);
    setEditRow(null);
  };

  /* ── Filters / totals ──────────────────────────────────────────────── */
  const employeeOptions = useMemo(() => {
    const byId = new Map(employees.map(e => [e.id, e]));
    return Array.from(new Set(rows.map(r => r.employeeId)))
      .map(id => ({ id: id || '', name: byId.get(id || '')?.name || 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, employees]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r => {
      const bySearch = !s
        || (r.employeeName || '').toLowerCase().includes(s)
        || (r.role || '').toLowerCase().includes(s);
      return bySearch
        && (!employeeFilter || r.employeeId === employeeFilter)
        && (!statusFilter   || r.status === statusFilter);
    }).sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
  }, [rows, search, employeeFilter, statusFilter]);

  const totals = useMemo(() => filtered.reduce((a, r) => ({
    gross:      a.gross      + Number(r.gross      || 0),
    allowances: a.allowances + Number(r.allowances || 0),
    deductions: a.deductions + Number(r.deductions || 0),
    net:        a.net        + Number(r.netPay     || 0),
  }), { gross: 0, allowances: 0, deductions: 0, net: 0 }), [filtered]);

  /* ── Exports ───────────────────────────────────────────────────────── */
  const doExportExcel = async () => {
    try {
      await exportExcel(`BT_Payroll_${month}`, [{
        name: `Payroll_${month}`,
        rows: filtered.map(r => ({
          Employee: r.employeeName || '', Role: r.role || '', Month: r.monthKey || '',
          Gross: r.gross || 0, Allowances: r.allowances || 0, Deductions: r.deductions || 0,
          NetPay: r.netPay || 0, Status: r.status || '', PaidOn: tsToDate(r.paidOn), Notes: r.notes || '',
        })),
      }]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const payslip = async (r: PayrollRow) => {
    try {
      await exportPdf(
        `Payslip_${r.employeeName}_${r.monthKey}`,
        'Payslip',
        [
          {
            title: 'Employee',
            columns: ['Field', 'Value'],
            rows: [
              ['Employee', r.employeeName || ''],
              ['Role', r.role || ''],
              ['Month', r.monthKey || ''],
              ['Status', r.status || ''],
              ['Paid On', tsToDate(r.paidOn) || '—'],
            ],
          },
          {
            title: 'Breakdown',
            columns: ['Component', 'Amount'],
            rows: [
              ['Gross',      inr(r.gross)],
              ['Allowances', inr(r.allowances)],
              ['Deductions', inr(r.deductions)],
              ['Net Pay',    inr(r.netPay)],
            ],
          },
        ],
      );
    } catch (e) { Alert.alert('Payslip failed', describeError(e)); }
  };

  /* ── Table ─────────────────────────────────────────────────────────── */
  const cols: Column[] = [
    { key: 'employee', label: 'Employee', width: 120 },
    { key: 'role',     label: 'Role',     width: 88 },
    { key: 'gross',    label: 'Gross',    width: 88, align: 'right' },
    { key: 'allow',    label: 'Allow.',   width: 80, align: 'right' },
    { key: 'deduct',   label: 'Deduct.',  width: 80, align: 'right' },
    { key: 'net',      label: 'Net',      width: 92, align: 'right' },
    {
      key: 'status', label: 'Status', width: 88,
      render: (r: any) => {
        const st = STATUS_STYLE[r._status] ?? STATUS_STYLE.pending;
        return (
          <View style={[s.statusPill, { backgroundColor: st.bg }]}>
            <Text style={[s.statusText, { color: st.color }]}>{r._status}</Text>
          </View>
        );
      },
    },
    { key: 'paidOn', label: 'Paid On', width: 88 },
    { key: 'notes',  label: 'Notes',   width: 110 },
    {
      key: 'actions', label: 'Actions', width: 200,
      render: (r: any) => (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.ghostBtn} onPress={() => payslip(r._raw)}>
            <Text style={s.ghostText}>Payslip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={() => openEdit(r._raw)}>
            <Text style={s.ghostText}>Edit</Text>
          </TouchableOpacity>
          {r._status !== 'paid' && (
            <TouchableOpacity style={s.paidBtn} onPress={() => markPaid(r._raw)}>
              <Text style={s.paidText}>Mark Paid</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.delBtn} onPress={() => remove(r._raw)}>
            <Ionicons name="trash-outline" size={13} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ),
    },
  ];

  const tableRows = paginate(filtered, page, pageSize).map(r => ({
    id: r.id, _raw: r, _status: r.status || 'pending',
    employee: r.employeeName || '—', role: r.role || '—',
    gross: inr(r.gross), allow: inr(r.allowances), deduct: inr(r.deductions), net: inr(r.netPay),
    paidOn: tsToDate(r.paidOn) || '—', notes: r.notes || '—',
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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <PageTitle icon="card-outline" title="Payroll" subtitle={`${filtered.length} rows`} />

        {!!err && <Panel style={s.errBox}><Text style={s.errText}>{err}</Text></Panel>}

        <KpiGrid>
          <KpiCard title="Gross"      value={inr(totals.gross)} />
          <KpiCard title="Allowances" value={inr(totals.allowances)} />
          <KpiCard title="Deductions" value={inr(totals.deductions)} />
          <KpiCard title="Net Pay"    value={inr(totals.net)} valueColor={Colors.success} />
        </KpiGrid>

        <Panel style={{ gap: 12 }}>
          <MonthPicker value={month} onChange={setMonth} label="Month" />
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search employee / role" />
        </Panel>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All status" active={!statusFilter} onPress={() => setStatusFilter('')} />
          {STATUSES.map(st => (
            <Chip key={st} label={st} active={statusFilter === st} onPress={() => setStatusFilter(st)} />
          ))}
        </ScrollView>

        {employeeOptions.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            <Chip label="All employees" active={!employeeFilter} onPress={() => setEmployeeFilter('')} />
            {employeeOptions.map(e => (
              <Chip key={e.id} label={e.name} active={employeeFilter === e.id} onPress={() => setEmployeeFilter(e.id)} />
            ))}
          </ScrollView>
        )}

        <View style={s.btnRow}>
          <ToolButton label="Export Excel" icon="download-outline" onPress={doExportExcel} />
          <View style={{ flex: 1 }} />
          {busy
            ? <ActivityIndicator color={Colors.primary} />
            : <ToolButton label="Generate for Month" icon="sparkles-outline" onPress={generate} primary />}
        </View>

        <DataTable columns={cols} rows={tableRows} emptyText="No payroll rows for this month." />
        {filtered.length > 0 && (
          <Pager page={page} setPage={setPage} totalPages={totalPages}
                 pageSize={pageSize} setPageSize={setPageSize} />
        )}

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Edit modal */}
      {editRow && (
        <Modal visible animationType="slide" onRequestClose={() => setEditRow(null)}>
          <ModalSafeArea style={s.modalRoot}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>
                {editRow.employeeName} — {editRow.monthKey}
              </Text>
              <TouchableOpacity onPress={() => setEditRow(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.slate700} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <View style={s.grossBox}>
                <Text style={s.grossLabel}>Gross</Text>
                <Text style={s.grossValue}>{inr(editRow.gross)}</Text>
              </View>

              <View style={s.row}>
                <Field label="Allowances" flex={1}>
                  <Input
                    value={editForm.allowances}
                    onChangeText={v => setEditForm(f => ({ ...f, allowances: v }))}
                    keyboardType="number-pad"
                  />
                </Field>
                <Field label="Deductions" flex={1}>
                  <Input
                    value={editForm.deductions}
                    onChangeText={v => setEditForm(f => ({ ...f, deductions: v }))}
                    keyboardType="number-pad"
                  />
                </Field>
              </View>

              <View style={s.netBox}>
                <Text style={s.netLabel}>Net Pay</Text>
                <Text style={s.netValue}>
                  {inr(Number(editRow.gross || 0) + Number(editForm.allowances || 0) - Number(editForm.deductions || 0))}
                </Text>
              </View>

              <Field label="Status">
                <View style={s.pickerBox}>
                  <Picker
                    selectedValue={editForm.status}
                    onValueChange={v => setEditForm(f => ({ ...f, status: v }))}
                  >
                    {STATUSES.map(st => (
                      <Picker.Item key={st} label={st[0].toUpperCase() + st.slice(1)} value={st} />
                    ))}
                  </Picker>
                </View>
              </Field>

              <Field label="Notes">
                <Input
                  value={editForm.notes}
                  onChangeText={v => setEditForm(f => ({ ...f, notes: v }))}
                  placeholder="Optional" multiline
                  style={{ height: 72, paddingTop: 10, textAlignVertical: 'top' }}
                />
              </Field>
            </ScrollView>

            <View style={s.modalFooter}>
              <ToolButton label="Cancel" onPress={() => setEditRow(null)} />
              <View style={{ flex: 1 }} />
              <ToolButton label="Save" icon="checkmark" onPress={saveEdit} primary />
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
  row:        { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  actionRow:  { flexDirection: 'row', gap: 5, alignItems: 'center' },
  ghostBtn:   { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.slate100 },
  ghostText:  { fontSize: 11, fontWeight: '700', color: Colors.slate700 },
  paidBtn:    { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.slate900 },
  paidText:   { fontSize: 11, fontWeight: '700', color: Colors.white },
  delBtn:     { width: 28, height: 26, borderRadius: 8, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  errBox:     { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  errText:    { color: Colors.danger, fontSize: 12.5 },

  modalRoot:   { flex: 1, backgroundColor: Colors.slate50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
  modalTitle:  { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  modalBody:   { padding: 16, gap: 12, paddingBottom: 30 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.slate200 },
  pickerBox:   { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, backgroundColor: Colors.white, justifyContent: 'center', minHeight: 44 },
  grossBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, padding: 14 },
  grossLabel:  { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.slate500 },
  grossValue:  { fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  netBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.success, padding: 14 },
  netLabel:    { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.success },
  netValue:    { fontSize: 18, fontWeight: '900', color: Colors.success },
});
