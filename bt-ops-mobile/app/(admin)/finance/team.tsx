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
  DataTable, Pager, paginate, ToolButton, Field, Input, Column, SectionTitle,
  KpiCard, KpiGrid,
} from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import { inr } from '@/utils/finance';
import { exportExcel } from '@/utils/financeExport';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

const ROLES = ['ops', 'sales', 'content', 'guide', 'manager', 'finance', 'support'];
const SALARY_TYPES = ['fixed', 'contract', 'freelance', 'intern'];

interface Employee {
  id: string; name?: string; email?: string; phone?: string; role?: string;
  status?: boolean; hiredDate?: string; salaryType?: string;
  baseSalary?: number | string; payDay?: number | string;
  allowances?: number | string; deductions?: number | string; rate?: number | string;
  notes?: string; address?: string; dob?: string; emergencyContact?: string;
  bank?: { accHolder?: string; accNo?: string; ifsc?: string; upi?: string };
}

const emptyForm = () => ({
  id: '', name: '', email: '', phone: '', role: '', status: true, hiredDate: '',
  salaryType: 'fixed', baseSalary: '', payDay: '', allowances: '', deductions: '',
  rate: '', notes: '', address: '', dob: '', emergencyContact: '',
  accHolder: '', accNo: '', ifsc: '', upi: '',
});

export default function FinanceTeamScreen() {
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const load = useCallback(async () => {
    setErr('');
    try {
      const snap = await getDocs(collection(financeDb, 'employees'));
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return list.filter(e => {
      const bySearch = !s
        || (e.name  || '').toLowerCase().includes(s)
        || (e.email || '').toLowerCase().includes(s)
        || (e.phone || '').toLowerCase().includes(s);
      const byRole = !roleFilter || e.role === roleFilter;
      const byStatus = !statusFilter
        || (statusFilter === 'active'   &&  e.status)
        || (statusFilter === 'inactive' && !e.status);
      return bySearch && byRole && byStatus;
    });
  }, [list, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total:    list.length,
    active:   list.filter(e => e.status).length,
    fixed:    list.filter(e => e.salaryType === 'fixed').length,
    monthly:  list.filter(e => e.status && e.salaryType === 'fixed')
                  .reduce((s, e) => s + Number(e.baseSalary || 0), 0),
  }), [list]);

  const openNew  = () => { setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Employee) => {
    setForm({
      id: e.id, name: e.name || '', email: e.email || '', phone: e.phone || '',
      role: e.role || '', status: e.status !== false, hiredDate: e.hiredDate || '',
      salaryType: e.salaryType || 'fixed',
      baseSalary: String(e.baseSalary ?? ''), payDay: String(e.payDay ?? ''),
      allowances: String(e.allowances ?? ''), deductions: String(e.deductions ?? ''),
      rate: String(e.rate ?? ''), notes: e.notes || '', address: e.address || '',
      dob: e.dob || '', emergencyContact: e.emergencyContact || '',
      accHolder: e.bank?.accHolder || '', accNo: e.bank?.accNo || '',
      ifsc: e.bank?.ifsc || '', upi: e.bank?.upi || '',
    });
    setOpen(true);
  };

  const save = async () => {
    // Same validation rules as FinanceTeam.js validate()
    if (!form.name.trim())                       return Alert.alert('Missing field', 'Name is required.');
    if (!/^\S+@\S+\.\S+$/.test(form.email))      return Alert.alert('Invalid email', 'Enter a valid email address.');
    if (!/^[0-9]{10}$/.test(form.phone))         return Alert.alert('Invalid phone', 'Enter a valid 10-digit phone number.');
    if (!form.role)                              return Alert.alert('Missing field', 'Role is required.');
    if (!form.hiredDate)                         return Alert.alert('Missing field', 'Hired date is required.');
    if (form.salaryType === 'fixed') {
      if (!form.baseSalary || Number(form.baseSalary) <= 0)
        return Alert.alert('Missing field', 'Base salary is required.');
      const pd = Number(form.payDay);
      if (!pd || pd < 1 || pd > 31)
        return Alert.alert('Invalid pay day', 'Pay day must be between 1 and 31.');
    } else if (!form.rate || Number(form.rate) <= 0) {
      return Alert.alert('Missing field', 'Rate is required for this salary type.');
    }

    const payload: any = {
      name: form.name.trim(), email: form.email.trim(), phone: form.phone,
      role: form.role, status: form.status, hiredDate: form.hiredDate,
      salaryType: form.salaryType,
      baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
      payDay:     form.payDay     ? Number(form.payDay)     : '',
      allowances: form.allowances ? Number(form.allowances) : 0,
      deductions: form.deductions ? Number(form.deductions) : 0,
      rate:       form.rate       ? Number(form.rate)       : 0,
      notes: form.notes, address: form.address, dob: form.dob,
      emergencyContact: form.emergencyContact,
      bank: { accHolder: form.accHolder, accNo: form.accNo, ifsc: form.ifsc, upi: form.upi },
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      if (form.id) {
        await updateDoc(doc(financeDb, 'employees', form.id), payload);
      } else {
        await addDoc(collection(financeDb, 'employees'), { ...payload, createdAt: serverTimestamp() });
      }
      setOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Save failed', describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (e: Employee) => {
    confirmAction(
      'Delete employee?',
      `${e.name || 'This employee'} will be removed from the finance team and payroll generation.`,
      'Delete',
      async () => {
        try {
          await deleteDoc(doc(financeDb, 'employees', e.id));
          setList(prev => prev.filter(x => x.id !== e.id));
        } catch (er) {
          Alert.alert('Delete failed', describeError(er));
        }
      },
    );
  };

  const doExport = async () => {
    try {
      await exportExcel('BT_Finance_Team', [{
        name: 'Team',
        rows: filtered.map(e => ({
          Name: e.name || '', Role: e.role || '', Email: e.email || '', Phone: e.phone || '',
          'Salary Type': e.salaryType || '', 'Base/Rate': Number(e.salaryType === 'fixed' ? e.baseSalary : e.rate) || 0,
          'Pay Day': e.payDay ?? '', Allowances: Number(e.allowances || 0), Deductions: Number(e.deductions || 0),
          Status: e.status ? 'Active' : 'Inactive', 'Hired Date': e.hiredDate || '',
          'Acc Holder': e.bank?.accHolder || '', 'Acc No': e.bank?.accNo || '',
          IFSC: e.bank?.ifsc || '', UPI: e.bank?.upi || '',
        })),
      }]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const cols: Column[] = [
    { key: 'name',   label: 'Name',        width: 118 },
    { key: 'role',   label: 'Role',        width: 82 },
    { key: 'email',  label: 'Email',       width: 160 },
    { key: 'phone',  label: 'Phone',       width: 104 },
    { key: 'stype',  label: 'Salary Type', width: 92 },
    { key: 'base',   label: 'Base/Rate',   width: 96, align: 'right' },
    {
      key: 'status', label: 'Status', width: 84,
      render: (r: any) => (
        <View style={[s.statusPill, { backgroundColor: r._active ? Colors.successBg : Colors.slate100 }]}>
          <Text style={[s.statusText, { color: r._active ? Colors.success : Colors.slate500 }]}>
            {r._active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      ),
    },
    {
      key: 'actions', label: 'Actions', width: 140,
      render: (r: any) => (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => openEdit(r._raw)}>
            <Text style={s.editText}>View / Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.delBtn} onPress={() => remove(r._raw)}>
            <Ionicons name="trash-outline" size={13} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ),
    },
  ];

  const rows = paginate(filtered, page, pageSize).map(e => ({
    id: e.id, _raw: e, _active: !!e.status,
    name: e.name || '—', role: e.role || '—', email: e.email || '—', phone: e.phone || '—',
    stype: e.salaryType || '—',
    base: inr(e.salaryType === 'fixed' ? e.baseSalary : e.rate),
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
        <PageTitle
          icon="people-outline"
          title="Team"
          subtitle={`${list.length} employee${list.length === 1 ? '' : 's'}`}
        />

        {!!err && <Panel style={s.errBox}><Text style={s.errText}>{err}</Text></Panel>}

        <KpiGrid>
          <KpiCard title="Total Employees" value={String(stats.total)}  sub={`${stats.active} active`} />
          <KpiCard title="Fixed Salary"    value={String(stats.fixed)}  sub="Included in payroll" />
          <KpiCard title="Monthly Base"    value={inr(stats.monthly)}   sub="Active fixed-salary" />
          <KpiCard title="Inactive"        value={String(stats.total - stats.active)} sub="Not on payroll" />
        </KpiGrid>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name / email / phone" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All roles" active={!roleFilter} onPress={() => setRoleFilter('')} />
          {ROLES.map(r => (
            <Chip key={r} label={r} active={roleFilter === r} onPress={() => setRoleFilter(r)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All statuses" active={!statusFilter} onPress={() => setStatusFilter('')} />
          <Chip label="Active"   active={statusFilter === 'active'}   onPress={() => setStatusFilter('active')} />
          <Chip label="Inactive" active={statusFilter === 'inactive'} onPress={() => setStatusFilter('inactive')} />
        </ScrollView>

        <View style={s.btnRow}>
          <ToolButton label="Export Excel" icon="download-outline" onPress={doExport} />
          <View style={{ flex: 1 }} />
          <ToolButton label="Add Employee" icon="add" onPress={openNew} primary />
        </View>

        <DataTable columns={cols} rows={rows} emptyText="No employees match your filters." />
        {filtered.length > 0 && (
          <Pager page={page} setPage={setPage} totalPages={totalPages}
                 pageSize={pageSize} setPageSize={setPageSize} />
        )}

        <View style={{ height: 28 }} />
      </ScrollView>

      {open && (
        <Modal visible animationType="slide" onRequestClose={() => setOpen(false)}>
          <ModalSafeArea style={s.modalRoot}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{form.id ? 'Edit Employee' : 'Add Employee'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.slate700} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <SectionTitle icon="person-outline" title="Basic Details" />
              <Field label="Name *">
                <Input value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Full name" />
              </Field>
              <Field label="Email *">
                <Input
                  value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))}
                  placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none"
                />
              </Field>
              <Field label="Phone *">
                <Input
                  value={form.phone}
                  onChangeText={v => /^[0-9]{0,10}$/.test(v) && setForm(f => ({ ...f, phone: v }))}
                  placeholder="10-digit number" keyboardType="number-pad"
                />
              </Field>
              <View style={s.row}>
                <Field label="Role *" flex={1}>
                  <View style={s.pickerBox}>
                    <Picker selectedValue={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                      <Picker.Item label="Select role" value="" />
                      {ROLES.map(r => <Picker.Item key={r} label={r} value={r} />)}
                    </Picker>
                  </View>
                </Field>
                <Field label="Status" flex={1}>
                  <View style={s.pickerBox}>
                    <Picker
                      selectedValue={form.status ? 'active' : 'inactive'}
                      onValueChange={v => setForm(f => ({ ...f, status: v === 'active' }))}
                    >
                      <Picker.Item label="Active" value="active" />
                      <Picker.Item label="Inactive" value="inactive" />
                    </Picker>
                  </View>
                </Field>
              </View>
              <Field label="Hired Date *">
                <Input value={form.hiredDate} onChangeText={v => setForm(f => ({ ...f, hiredDate: v }))} placeholder="YYYY-MM-DD" />
              </Field>

              <SectionTitle icon="cash-outline" title="Compensation" />
              <Field label="Salary Type *">
                <View style={s.pickerBox}>
                  <Picker selectedValue={form.salaryType} onValueChange={v => setForm(f => ({ ...f, salaryType: v }))}>
                    {SALARY_TYPES.map(t => <Picker.Item key={t} label={t} value={t} />)}
                  </Picker>
                </View>
              </Field>

              {form.salaryType === 'fixed' ? (
                <>
                  <View style={s.row}>
                    <Field label="Base Salary *" flex={1}>
                      <Input value={form.baseSalary} onChangeText={v => setForm(f => ({ ...f, baseSalary: v }))} keyboardType="number-pad" placeholder="0" />
                    </Field>
                    <Field label="Pay Day (1–31) *" flex={1}>
                      <Input value={form.payDay} onChangeText={v => setForm(f => ({ ...f, payDay: v }))} keyboardType="number-pad" placeholder="1" />
                    </Field>
                  </View>
                  <View style={s.row}>
                    <Field label="Allowances" flex={1}>
                      <Input value={form.allowances} onChangeText={v => setForm(f => ({ ...f, allowances: v }))} keyboardType="number-pad" placeholder="0" />
                    </Field>
                    <Field label="Deductions" flex={1}>
                      <Input value={form.deductions} onChangeText={v => setForm(f => ({ ...f, deductions: v }))} keyboardType="number-pad" placeholder="0" />
                    </Field>
                  </View>
                </>
              ) : (
                <Field label="Rate *">
                  <Input value={form.rate} onChangeText={v => setForm(f => ({ ...f, rate: v }))} keyboardType="number-pad" placeholder="0" />
                </Field>
              )}

              <SectionTitle icon="card-outline" title="Bank Details" />
              <Field label="Account Holder">
                <Input value={form.accHolder} onChangeText={v => setForm(f => ({ ...f, accHolder: v }))} placeholder="Name on account" />
              </Field>
              <View style={s.row}>
                <Field label="Account No." flex={1}>
                  <Input value={form.accNo} onChangeText={v => setForm(f => ({ ...f, accNo: v }))} keyboardType="number-pad" />
                </Field>
                <Field label="IFSC" flex={1}>
                  <Input value={form.ifsc} onChangeText={v => setForm(f => ({ ...f, ifsc: v }))} autoCapitalize="characters" />
                </Field>
              </View>
              <Field label="UPI">
                <Input value={form.upi} onChangeText={v => setForm(f => ({ ...f, upi: v }))} placeholder="name@bank" autoCapitalize="none" />
              </Field>

              <SectionTitle icon="document-text-outline" title="Other" />
              <View style={s.row}>
                <Field label="Date of Birth" flex={1}>
                  <Input value={form.dob} onChangeText={v => setForm(f => ({ ...f, dob: v }))} placeholder="YYYY-MM-DD" />
                </Field>
                <Field label="Emergency Contact" flex={1}>
                  <Input value={form.emergencyContact} onChangeText={v => setForm(f => ({ ...f, emergencyContact: v }))} keyboardType="phone-pad" />
                </Field>
              </View>
              <Field label="Address">
                <Input value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} placeholder="Optional" />
              </Field>
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
                : <ToolButton label={form.id ? 'Save Changes' : 'Add Employee'} icon="checkmark" onPress={save} primary />}
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
  statusText: { fontSize: 10, fontWeight: '800' },
  actionRow:  { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editBtn:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.slate100 },
  editText:   { fontSize: 11, fontWeight: '700', color: Colors.slate700 },
  delBtn:     { width: 28, height: 26, borderRadius: 8, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  errBox:     { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  errText:    { color: Colors.danger, fontSize: 12.5 },

  modalRoot:   { flex: 1, backgroundColor: Colors.slate50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
  modalTitle:  { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  modalBody:   { padding: 16, gap: 12, paddingBottom: 30 },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.slate200 },
  pickerBox:   { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, backgroundColor: Colors.white, justifyContent: 'center', minHeight: 44 },
});
