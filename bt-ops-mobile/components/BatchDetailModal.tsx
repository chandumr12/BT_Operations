import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
// expo-file-system v19 (SDK 54) moved the old string-based API (cacheDirectory,
// EncodingType, writeAsStringAsync) to a /legacy subpath; the new default export
// uses a different File/Directory class-based API.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import api, { BASE_URL } from '@/utils/api';
import { confirmAction } from '@/utils/confirm';

export interface BatchSummary {
  id: string;
  batchCode: string;
  trekId?: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  currentRegistrations: number;
  status: string;
  assignedLeads?: { userId: string; displayName: string; isSuperLead?: boolean }[];
}

type Tab = 'participants' | 'expenses' | 'documents' | 'feedback';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'participants', label: 'People',   icon: 'people-outline' },
  { key: 'expenses',     label: 'Expenses', icon: 'receipt-outline' },
  { key: 'documents',    label: 'Docs',     icon: 'document-outline' },
  { key: 'feedback',     label: 'Feedback', icon: 'chatbox-outline' },
];

export function BatchDetailModal({ batch, onClose }: { batch: BatchSummary; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('participants');
  const [trekName, setTrekName] = useState('');

  useEffect(() => {
    if (batch.trekId) {
      api.get(`/treks/${batch.trekId}`).then(r => setTrekName(r.data?.name ?? '')).catch(() => {});
    }
  }, [batch.trekId]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{batch.batchCode}</Text>
            {!!trekName && <Text style={s.sub}>{trekName}</Text>}
          </View>
          <StatusBadge status={batch.status} />
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaText}>{batch.startDate} → {batch.endDate}</Text>
          <Text style={s.metaText}>{batch.currentRegistrations}/{batch.maxCapacity} participants</Text>
        </View>

        <View style={s.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={15} color={tab === t.key ? Colors.primary : Colors.gray500} />
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'participants' && <ParticipantsTab batchId={batch.id} />}
        {tab === 'expenses'     && <ExpensesTab batchId={batch.id} />}
        {tab === 'documents'    && <DocumentsTab batchId={batch.id} />}
        {tab === 'feedback'     && <FeedbackTab batchId={batch.id} />}
      </ModalSafeArea>
    </Modal>
  );
}

/* ---------------------------- Participants ---------------------------- */

interface Participant {
  id: string; fullName: string; contactNo: string; age: string; gender: string;
  totalPrice: number; amountPaid: number; balanceAmount: number; boarded: boolean; status: string;
}

function ParticipantsTab({ batchId }: { batchId: string }) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/batches/${batchId}/participants`).then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const toggleBoarded = async (p: Participant) => {
    setItems(prev => prev.map(x => x.id === p.id ? { ...x, boarded: !x.boarded } : x));
    try {
      await api.patch(`/batches/${batchId}/participants/${p.id}`, { boarded: !p.boarded });
    } catch {
      Alert.alert('Error', 'Could not update participant');
      load();
    }
  };

  const importExcel = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const form = new FormData();
      // @ts-ignore RN FormData file shape
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      setImporting(true);
      const r = await api.post(`/batches/${batchId}/participants/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Imported', r.data?.message ?? 'Participants imported');
      load();
    } catch (e: any) {
      Alert.alert('Import failed', e.response?.data?.detail ?? 'Could not import file');
    } finally { setImporting(false); }
  };

  if (loading) return <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={p => p.id}
      contentContainerStyle={s.tabContent}
      ListHeaderComponent={isAdmin ? (
        <TouchableOpacity style={s.importBtn} onPress={importExcel} disabled={importing}>
          {importing
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} />}
          <Text style={s.importBtnText}>{importing ? 'Importing…' : 'Import from Excel'}</Text>
        </TouchableOpacity>
      ) : null}
      renderItem={({ item: p }) => (
        <TouchableOpacity onPress={() => toggleBoarded(p)} activeOpacity={0.8}>
          <Card padding={14} style={{ marginBottom: 10 }}>
            <View style={s.pRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.pName}>{p.fullName}</Text>
                <Text style={s.pSub}>{p.contactNo}  •  {p.gender}, {p.age}y</Text>
                <Text style={s.pMoney}>Paid ₹{p.amountPaid || 0} / ₹{p.totalPrice || 0}  {p.balanceAmount > 0 ? `(bal ₹${p.balanceAmount})` : ''}</Text>
              </View>
              <View style={[s.boardedBadge, { backgroundColor: p.boarded ? Colors.successBg : Colors.gray100 }]}>
                <Ionicons name={p.boarded ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={p.boarded ? Colors.success : Colors.gray400} />
                <Text style={[s.boardedText, { color: p.boarded ? Colors.success : Colors.gray400 }]}>{p.boarded ? 'Boarded' : 'Pending'}</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={s.empty}>No participants yet</Text>}
    />
  );
}

/* ------------------------------ Expenses -------------------------------- */

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

function ExpensesTab({ batchId }: { batchId: string }) {
  const { isAdmin, isLead } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [additional, setAdditional] = useState<{ reason: string; amount: string }[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    if (isAdmin) {
      api.get(`/batches/${batchId}/expenses`).then(r => setAllExpenses(r.data)).catch(() => {}).finally(() => setLoading(false));
    } else {
      api.get(`/batches/${batchId}/expenses/my`).then(r => {
        if (r.data) {
          const d = r.data;
          const f: Record<string, string> = {};
          EXPENSE_FIELDS.forEach(fld => { f[fld.key] = d[fld.key] ? String(d[fld.key]) : ''; });
          setForm(f);
          setRemarks(d.otherExpensesRemarks ?? '');
          setAdditional((d.additionalExpenses ?? []).map((a: any) => ({ reason: a.reason ?? '', amount: String(a.amount ?? '') })));
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [batchId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const totalSpent = EXPENSE_FIELDS.slice(1).reduce((sum, f) => sum + (parseFloat(form[f.key]) || 0), 0)
    + additional.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const collected = parseFloat(form.amountCollected) || 0;
  const remaining = collected - totalSpent;

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = { otherExpensesRemarks: remarks, additionalExpenses: additional.filter(a => a.reason || a.amount) };
      EXPENSE_FIELDS.forEach(f => { payload[f.key] = parseFloat(form[f.key]) || 0; });
      await api.post(`/batches/${batchId}/expenses`, payload);
      Alert.alert('Saved', 'Your expense sheet has been saved.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save expenses');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>;

  if (isAdmin) {
    return (
      <ScrollView contentContainerStyle={s.tabContent}>
        {allExpenses.length === 0 && <Text style={s.empty}>No expense sheets submitted yet</Text>}
        {allExpenses.map(e => (
          <Card key={e.id} padding={14} style={{ marginBottom: 10, gap: 6 }}>
            <View style={s.pRow}>
              <Text style={s.pName}>{e.leadName}</Text>
              <Text style={[s.pName, { color: e.remaining < 0 ? Colors.danger : Colors.success }]}>₹{(e.remaining ?? 0).toFixed(0)} left</Text>
            </View>
            <Text style={s.pSub}>Collected ₹{e.amountCollected || 0}  •  Spent ₹{(e.totalSpent ?? 0).toFixed(0)}</Text>
          </Card>
        ))}
      </ScrollView>
    );
  }

  if (!isLead) return <Text style={s.empty}>Expense sheets are managed by trek leads.</Text>;

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <View style={s.summaryRow}>
        <Card padding={14} style={{ flex: 1 }}>
          <Text style={s.summaryLabel}>Total Spent</Text>
          <Text style={s.summaryAmount}>₹{totalSpent.toFixed(0)}</Text>
        </Card>
        <Card padding={14} style={{ flex: 1 }}>
          <Text style={s.summaryLabel}>Remaining</Text>
          <Text style={[s.summaryAmount, { color: remaining < 0 ? Colors.danger : Colors.success }]}>₹{remaining.toFixed(0)}</Text>
        </Card>
      </View>

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
        <View style={s.pRow}>
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
    </ScrollView>
  );
}

/* ------------------------------ Documents -------------------------------- */

interface BatchDoc { id: string; name: string; uploadedBy: string; uploadedAt: string; size: number; contentType: string; }

function DocumentsTab({ batchId }: { batchId: string }) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<BatchDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/batches/${batchId}/documents`).then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const form = new FormData();
      // @ts-ignore
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      setUploading(true);
      await api.post(`/batches/${batchId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (e: any) {
      Alert.alert('Upload failed', e.response?.data?.detail ?? 'Could not upload document');
    } finally { setUploading(false); }
  };

  const download = async (doc: BatchDoc) => {
    setDownloadingId(doc.id);
    try {
      const r = await api.get(`/batches/${batchId}/documents/${doc.id}/download`, { responseType: 'arraybuffer' });
      const b64 = arrayBufferToBase64(r.data);
      const path = FileSystem.cacheDirectory + doc.name;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else Alert.alert('Downloaded', `Saved to ${path}`);
    } catch {
      Alert.alert('Error', 'Could not download document');
    } finally { setDownloadingId(null); }
  };

  const remove = (doc: BatchDoc) => {
    confirmAction('Delete document', `Remove "${doc.name}"?`, 'Delete', async () => {
      try { await api.delete(`/batches/${batchId}/documents/${doc.id}`); load(); } catch { Alert.alert('Error', 'Could not delete'); }
    });
  };

  if (loading) return <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={d => d.id}
      contentContainerStyle={s.tabContent}
      ListHeaderComponent={
        <TouchableOpacity style={s.importBtn} onPress={upload} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} />}
          <Text style={s.importBtnText}>{uploading ? 'Uploading…' : 'Upload Document'}</Text>
        </TouchableOpacity>
      }
      renderItem={({ item: d }) => (
        <Card padding={14} style={{ marginBottom: 10 }}>
          <View style={s.pRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text-outline" size={22} color={Colors.gray500} />
              <View style={{ flex: 1 }}>
                <Text style={s.pName} numberOfLines={1}>{d.name}</Text>
                <Text style={s.pSub}>{d.uploadedBy}  •  {(d.size / 1024).toFixed(0)} KB</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => download(d)} style={{ padding: 6 }} disabled={downloadingId === d.id}>
              {downloadingId === d.id ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="download-outline" size={20} color={Colors.primary} />}
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity onPress={() => remove(d)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </Card>
      )}
      ListEmptyComponent={<Text style={s.empty}>No documents uploaded yet</Text>}
    />
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return global.btoa ? global.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/* ------------------------------- Feedback -------------------------------- */

function FeedbackTab({ batchId }: { batchId: string }) {
  const { isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [all, setAll] = useState<any[]>([]);
  const [positive, setPositive] = useState('');
  const [negative, setNegative] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/batches/${batchId}/feedback`).then(r => {
      setAll(r.data);
      const mine = r.data.find((f: any) => f.userId === profile?.uid);
      if (mine) { setPositive(mine.positive ?? ''); setNegative(mine.negative ?? ''); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [batchId, profile?.uid]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/batches/${batchId}/feedback`, { positive, negative });
      Alert.alert('Saved', 'Feedback saved.');
      load();
    } catch { Alert.alert('Error', 'Could not save feedback'); } finally { setSaving(false); }
  };

  if (loading) return <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      {!isAdmin && (
        <Card padding={16} style={{ gap: 12, marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Your Feedback</Text>
          <View style={s.field}>
            <Text style={s.label}>What went well</Text>
            <TextInput style={[s.input, s.textarea]} multiline value={positive} onChangeText={setPositive} placeholder="Positives…" placeholderTextColor={Colors.gray400} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>What could improve</Text>
            <TextInput style={[s.input, s.textarea]} multiline value={negative} onChangeText={setNegative} placeholder="Issues / suggestions…" placeholderTextColor={Colors.gray400} />
          </View>
          <Button title="Save Feedback" onPress={save} loading={saving} />
        </Card>
      )}

      <Text style={s.sectionTitle}>{isAdmin ? 'All Feedback' : 'Team Feedback'} ({all.length})</Text>
      {all.map(f => (
        <Card key={f.id} padding={14} style={{ marginBottom: 10, gap: 6 }}>
          <Text style={s.pName}>{f.leadName}</Text>
          {!!f.positive && <Text style={s.feedbackPos}>+ {f.positive}</Text>}
          {!!f.negative && <Text style={s.feedbackNeg}>− {f.negative}</Text>}
        </Card>
      ))}
      {all.length === 0 && <Text style={s.empty}>No feedback submitted yet</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.gray50 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:  { padding: 4 },
  title:    { fontSize: 17, fontWeight: '700', color: Colors.gray900 },
  sub:      { fontSize: 12, color: Colors.gray500, marginTop: 1 },
  metaRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  metaText: { fontSize: 12, color: Colors.gray500 },

  tabBar:   { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray500 },
  tabLabelActive: { color: Colors.primary },

  tabContent: { padding: 16, gap: 0, paddingBottom: 40 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, marginBottom: 14 },
  importBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },

  pRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  pName: { fontSize: 14, fontWeight: '600', color: Colors.gray900 },
  pSub:  { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  pMoney:{ fontSize: 12, color: Colors.gray600, marginTop: 3, fontWeight: '500' },
  boardedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  boardedText:  { fontSize: 11, fontWeight: '600' },

  summaryRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryLabel:  { fontSize: 12, color: Colors.gray500, fontWeight: '500' },
  summaryAmount: { fontSize: 20, fontWeight: '800', color: Colors.gray900, marginTop: 4 },

  field:    { gap: 6, marginBottom: 14 },
  label:    { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:    { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.white },
  textarea: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  addRow:   { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 10 },
  feedbackPos: { fontSize: 13, color: Colors.success },
  feedbackNeg: { fontSize: 13, color: Colors.danger },

  empty: { textAlign: 'center', color: Colors.gray400, padding: 30 },
});
