import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import Svg, { Circle } from 'react-native-svg';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
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
  transportVendor?: string;
  stayVendor?: string;
  internalNotes?: string;
  driveFolderUrl?: string;
}

type Tab = 'participants' | 'expenses' | 'documents' | 'feedback';
type SubView = 'list' | 'participantForm' | 'expenseForm' | 'adminExpense';

const BRAND = Colors.primary;

const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN');
const fmtCur = (n: any) => `₹${fmt(n)}`;
const initials = (name: string) => (name || '').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const EXPENSE_ITEMS: { key: string; label: string; icon: any }[] = [
  { key: 'paidToDriver',     label: 'Driver',        icon: 'car-outline' },
  { key: 'lunchPacking',     label: 'Lunch Packing', icon: 'fast-food-outline' },
  { key: 'parkingCharges',   label: 'Parking',       icon: 'location-outline' },
  { key: 'jeepCharges',      label: 'Jeep Charges',  icon: 'car-sport-outline' },
  { key: 'refundToCustomer', label: 'Refund',        icon: 'arrow-undo-outline' },
  { key: 'tickets',          label: 'Entry Fees',    icon: 'pricetag-outline' },
  { key: 'localGuide',       label: 'Local Guide',   icon: 'compass-outline' },
  { key: 'otherExpenses',    label: 'Other',         icon: 'ellipsis-horizontal-outline' },
];

const EMPTY_MY_EXPENSE: Record<string, string> = {
  amountCollected: '', paidToDriver: '', lunchPacking: '', parkingCharges: '',
  jeepCharges: '', refundToCustomer: '', tickets: '', localGuide: '',
  otherExpenses: '', otherExpensesRemarks: '',
};

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'participants', label: 'People',   icon: 'people-outline' },
  { key: 'expenses',     label: 'Expenses', icon: 'receipt-outline' },
  { key: 'documents',    label: 'Docs',     icon: 'document-outline' },
  { key: 'feedback',     label: 'Feedback', icon: 'chatbox-outline' },
];

interface Participant {
  id: string; slNo?: string; fullName: string; contactNo: string; age: string; gender: string;
  pickupPoint?: string; totalPrice: number; amountPaid: number; balanceAmount: number;
  amountCollected?: number; boarded: boolean; noShow?: boolean; status?: string; leadRemark?: string;
  receiptMode?: string; receiptDate?: string; bookedBy?: string; remarks?: string;
}

interface BatchDoc { id: string; name: string; uploadedBy: string; uploadedAt: string; size: number; contentType: string; }

interface ParticipantFormState {
  slNo: string; fullName: string; contactNo: string; age: string; gender: string;
  pickupPoint: string; totalPrice: string; amountPaid: string; balanceAmount: string;
  receiptMode: string; receiptDate: string; bookedBy: string; remarks: string;
}

const EMPTY_PARTICIPANT_FORM: ParticipantFormState = {
  slNo: '', fullName: '', contactNo: '', age: '', gender: 'Male', pickupPoint: '',
  totalPrice: '', amountPaid: '', balanceAmount: '', receiptMode: '', receiptDate: '', bookedBy: '', remarks: '',
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return (global as any).btoa ? (global as any).btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

export function BatchDetailModal({ batch, onClose }: { batch: BatchSummary; onClose: () => void }) {
  const { isAdmin, profile } = useAuth();

  const [tab, setTab] = useState<Tab>('participants');
  const [subView, setSubView] = useState<SubView>('list');
  const [trekName, setTrekName] = useState('');
  const [loadingAll, setLoadingAll] = useState(true);

  // ── Participants ──
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortPickup, setSortPickup] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'boarded' | 'noshow' | 'pending' | 'balance'>('all');
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [tempRemark, setTempRemark] = useState('');
  const [editParticipant, setEditParticipant] = useState<Participant | null>(null);
  const [pForm, setPForm] = useState<ParticipantFormState>(EMPTY_PARTICIPANT_FORM);
  const [savingParticipant, setSavingParticipant] = useState(false);

  // ── Expenses ──
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [myExpense, setMyExpense] = useState<Record<string, string>>(EMPTY_MY_EXPENSE);
  const [additionalExpenses, setAdditionalExpenses] = useState<{ reason: string; amount: string }[]>([]);
  const [expenseSubmitted, setExpenseSubmitted] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [adminExpenseView, setAdminExpenseView] = useState<any | null>(null);

  // ── Documents ──
  const [documents, setDocuments] = useState<BatchDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // ── Feedback ──
  const [allFeedback, setAllFeedback] = useState<any[]>([]);
  const [myFeedback, setMyFeedback] = useState({ positive: '', negative: '' });
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    if (batch.trekId) {
      api.get(`/treks/${batch.trekId}`).then(r => setTrekName(r.data?.name ?? '')).catch(() => {});
    }
  }, [batch.trekId]);

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const partRes = await api.get(`/batches/${batch.id}/participants`);
      setParticipants(partRes.data);
    } catch {}
    try {
      const [allExpRes, myExpRes] = await Promise.all([
        api.get(`/batches/${batch.id}/expenses`),
        api.get(`/batches/${batch.id}/expenses/my`),
      ]);
      setAllExpenses(allExpRes.data);
      if (myExpRes.data) {
        const d = myExpRes.data;
        const f: Record<string, string> = {};
        Object.keys(EMPTY_MY_EXPENSE).forEach(k => { f[k] = d[k] != null && d[k] !== '' ? String(d[k]) : ''; });
        setMyExpense(f);
        setAdditionalExpenses((d.additionalExpenses ?? []).map((a: any) => ({ reason: a.reason ?? '', amount: String(a.amount ?? '') })));
        setExpenseSubmitted(true);
      } else {
        setMyExpense(EMPTY_MY_EXPENSE);
        setAdditionalExpenses([]);
        setExpenseSubmitted(false);
      }
    } catch {}
    try {
      const [docsRes, fbRes] = await Promise.all([
        api.get(`/batches/${batch.id}/documents`),
        api.get(`/batches/${batch.id}/feedback`),
      ]);
      setDocuments(docsRes.data);
      setAllFeedback(fbRes.data);
      const mine = fbRes.data.find((f: any) => f.userId === profile?.uid);
      if (mine) setMyFeedback({ positive: mine.positive || '', negative: mine.negative || '' });
    } catch {}
    setLoadingAll(false);
  }, [batch.id, profile?.uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ---------------------------- Participants ---------------------------- */

  const toggleBoarded = async (p: Participant) => {
    setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, boarded: !x.boarded, noShow: false } : x));
    try {
      await api.patch(`/batches/${batch.id}/participants/${p.id}`, { boarded: !p.boarded, noShow: false });
    } catch { Alert.alert('Error', 'Could not update boarding'); loadAll(); }
  };

  const toggleNoShow = async (p: Participant) => {
    setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, noShow: !x.noShow, boarded: false } : x));
    try {
      await api.patch(`/batches/${batch.id}/participants/${p.id}`, { noShow: !p.noShow, boarded: false });
    } catch { Alert.alert('Error', 'Could not update'); loadAll(); }
  };

  const updateAmountCollected = async (p: Participant, value: string) => {
    const amt = parseFloat(value) || 0;
    try {
      await api.patch(`/batches/${batch.id}/participants/${p.id}`, { amountCollected: amt });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, amountCollected: amt } : x));
    } catch { Alert.alert('Error', 'Could not update'); }
  };

  const saveLeadRemark = async (p: Participant, remark: string) => {
    setEditingRemarkId(null);
    try {
      await api.patch(`/batches/${batch.id}/participants/${p.id}`, { leadRemark: remark });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, leadRemark: remark } : x));
    } catch { Alert.alert('Error', 'Could not save note'); }
  };

  const openAddParticipant = () => {
    setEditParticipant(null);
    setPForm(EMPTY_PARTICIPANT_FORM);
    setSubView('participantForm');
  };

  const openEditParticipant = (p: Participant) => {
    setEditParticipant(p);
    setPForm({
      slNo: p.slNo || '', fullName: p.fullName || '', contactNo: p.contactNo || '', age: p.age || '',
      gender: p.gender || 'Male', pickupPoint: p.pickupPoint || '', totalPrice: p.totalPrice?.toString() || '',
      amountPaid: p.amountPaid?.toString() || '', balanceAmount: p.balanceAmount?.toString() || '',
      receiptMode: p.receiptMode || '', receiptDate: p.receiptDate || '', bookedBy: p.bookedBy || '', remarks: p.remarks || '',
    });
    setSubView('participantForm');
  };

  const saveParticipant = async () => {
    if (!pForm.fullName.trim()) { Alert.alert('Required', 'Full Name is required'); return; }
    setSavingParticipant(true);
    try {
      const payload = {
        ...pForm,
        totalPrice: parseFloat(pForm.totalPrice) || 0,
        amountPaid: parseFloat(pForm.amountPaid) || 0,
        balanceAmount: parseFloat(pForm.balanceAmount) || 0,
      };
      if (editParticipant) {
        await api.patch(`/batches/${batch.id}/participants/${editParticipant.id}`, payload);
      } else {
        await api.post(`/batches/${batch.id}/participants`, payload);
      }
      setSubView('list');
      loadAll();
    } catch { Alert.alert('Error', 'Failed to save participant'); }
    finally { setSavingParticipant(false); }
  };

  const deleteParticipant = (p: Participant) => {
    confirmAction('Remove Participant?', `${p.fullName} will be permanently removed from this batch.`, 'Remove', async () => {
      try { await api.delete(`/batches/${batch.id}/participants/${p.id}`); loadAll(); }
      catch { Alert.alert('Error', 'Failed to remove'); }
    });
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const r = await api.get(`/batches/${batch.id}/participants/template`, { responseType: 'arraybuffer' });
      const b64 = arrayBufferToBase64(r.data);
      const path = `${FileSystem.cacheDirectory}participant_template_${batch.batchCode}.xlsx`;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else Alert.alert('Downloaded', `Saved to ${path}`);
    } catch { Alert.alert('Error', 'Download failed'); }
    finally { setDownloadingTemplate(false); }
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
      const r = await api.post(`/batches/${batch.id}/participants/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Imported', r.data?.message ?? `${r.data?.count ?? ''} participants imported`);
      loadAll();
    } catch (e: any) {
      Alert.alert('Import failed', e.response?.data?.detail ?? 'Could not import file');
    } finally { setImporting(false); }
  };

  const filteredParticipants = useMemo(() => participants
    .filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.fullName?.toLowerCase().includes(q) && !p.contactNo?.includes(q) &&
            !p.pickupPoint?.toLowerCase().includes(q) && !p.remarks?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === 'boarded') return !!p.boarded;
      if (statusFilter === 'noshow') return !!p.noShow;
      if (statusFilter === 'balance') return (p.balanceAmount || 0) > 0;
      if (statusFilter === 'pending') return !p.boarded && !p.noShow;
      return true;
    })
    .sort((a, b) => !sortPickup ? 0 : (a.pickupPoint || '').localeCompare(b.pickupPoint || '')),
  [participants, searchQuery, statusFilter, sortPickup]);

  const totalBalance   = participants.reduce((s, p) => s + (p.balanceAmount || 0), 0);
  const totalCollected = participants.reduce((s, p) => s + (p.amountCollected || 0), 0);
  const boardedCount   = participants.filter(p => p.boarded).length;
  const noShowCount    = participants.filter(p => p.noShow).length;
  const maleCount      = participants.filter(p => p.gender === 'Male').length;
  const femaleCount    = participants.filter(p => p.gender === 'Female').length;

  /* ------------------------------ Expenses -------------------------------- */

  const myExpenseNum = (field: string) => parseFloat(myExpense[field]) || 0;
  const fixedSpent = EXPENSE_ITEMS.reduce((s, { key }) => s + myExpenseNum(key), 0);
  const additionalSpent = additionalExpenses.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const myTotalSpent = fixedSpent + additionalSpent;
  const myRemaining  = myExpenseNum('amountCollected') - myTotalSpent;
  const spendPct     = myExpenseNum('amountCollected') > 0 ? Math.min(100, (myTotalSpent / myExpenseNum('amountCollected')) * 100) : 0;

  const addExpenseRow    = () => setAdditionalExpenses(p => [...p, { reason: '', amount: '' }]);
  const removeExpenseRow = (idx: number) => setAdditionalExpenses(p => p.filter((_, i) => i !== idx));
  const updateExpenseRow = (idx: number, field: 'reason' | 'amount', value: string) =>
    setAdditionalExpenses(p => { const u = [...p]; u[idx] = { ...u[idx], [field]: value }; return u; });

  const openLogExpenses = () => { setExpenseEditing(!expenseSubmitted); setSubView('expenseForm'); };

  const handleSaveExpense = async () => {
    setSavingExpense(true);
    try {
      const payload: Record<string, any> = { otherExpensesRemarks: myExpense.otherExpensesRemarks, additionalExpenses: additionalExpenses.filter(a => a.reason || a.amount) };
      payload.amountCollected = myExpenseNum('amountCollected');
      EXPENSE_ITEMS.forEach(({ key }) => { payload[key] = myExpenseNum(key); });
      await api.post(`/batches/${batch.id}/expenses`, payload);
      setExpenseSubmitted(true);
      setExpenseEditing(false);
      setSubView('list');
      loadAll();
    } catch { Alert.alert('Error', 'Failed to submit expense'); }
    finally { setSavingExpense(false); }
  };

  /* ------------------------------ Documents -------------------------------- */

  const uploadDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const form = new FormData();
      // @ts-ignore
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      setUploadingDoc(true);
      await api.post(`/batches/${batch.id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadAll();
    } catch (e: any) {
      Alert.alert('Upload failed', e.response?.data?.detail ?? 'Could not upload document');
    } finally { setUploadingDoc(false); }
  };

  const downloadDocument = async (doc: BatchDoc) => {
    setDownloadingDocId(doc.id);
    try {
      const r = await api.get(`/batches/${batch.id}/documents/${doc.id}/download`, { responseType: 'arraybuffer' });
      const b64 = arrayBufferToBase64(r.data);
      const path = FileSystem.cacheDirectory + doc.name;
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else Alert.alert('Downloaded', `Saved to ${path}`);
    } catch { Alert.alert('Error', 'Could not download document'); }
    finally { setDownloadingDocId(null); }
  };

  const deleteDocument = (doc: BatchDoc) => {
    confirmAction('Delete Document?', `"${doc.name}" will be permanently deleted.`, 'Delete', async () => {
      try { await api.delete(`/batches/${batch.id}/documents/${doc.id}`); setDocuments(p => p.filter(d => d.id !== doc.id)); }
      catch { Alert.alert('Error', 'Delete failed'); }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  /* ------------------------------- Feedback -------------------------------- */

  const saveFeedback = async () => {
    setSavingFeedback(true);
    try {
      await api.post(`/batches/${batch.id}/feedback`, myFeedback);
      loadAll();
    } catch { Alert.alert('Error', 'Failed to save feedback'); }
    finally { setSavingFeedback(false); }
  };

  const capacityPct = batch.maxCapacity > 0 ? Math.min(100, Math.round((batch.currentRegistrations / batch.maxCapacity) * 100)) : 0;

  return (
    <Modal visible animationType="slide" onRequestClose={subView !== 'list' ? () => setSubView('list') : onClose}>
      <ModalSafeArea style={s.safe}>
        {subView === 'participantForm' && (
          <ParticipantFormView
            form={pForm} setForm={setPForm} editing={!!editParticipant} batchCode={batch.batchCode}
            saving={savingParticipant} onSave={saveParticipant} onCancel={() => setSubView('list')}
          />
        )}
        {subView === 'expenseForm' && (
          <ExpenseFormSubView
            batchCode={batch.batchCode} editing={expenseEditing} submitted={expenseSubmitted}
            myExpense={myExpense} setMyExpense={setMyExpense}
            additionalExpenses={additionalExpenses} addRow={addExpenseRow} removeRow={removeExpenseRow} updateRow={updateExpenseRow}
            myExpenseNum={myExpenseNum} myTotalSpent={myTotalSpent} myRemaining={myRemaining} spendPct={spendPct}
            saving={savingExpense} onSave={handleSaveExpense} onEdit={() => setExpenseEditing(true)}
            onClose={() => { setSubView('list'); setExpenseEditing(false); }}
          />
        )}
        {subView === 'adminExpense' && adminExpenseView && (
          <AdminExpenseSubView record={adminExpenseView} onClose={() => setSubView('list')} />
        )}

        {subView === 'list' && (<>
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
            <Text style={s.metaText}>{batch.currentRegistrations}/{batch.maxCapacity} seats</Text>
          </View>

          <View style={s.fillWrap}>
            <View style={s.fillBarBg}>
              <View style={[s.fillBarFg, { width: `${capacityPct}%`, backgroundColor: capacityPct >= 90 ? Colors.danger : BRAND }]} />
            </View>
            <Text style={s.fillPct}>{capacityPct}%</Text>
          </View>

          {!!batch.assignedLeads?.length && (
            <View style={s.leadsRow}>
              {batch.assignedLeads.map(l => (
                <View key={l.userId} style={[s.leadChip, l.isSuperLead && s.leadChipSuper]}>
                  {l.isSuperLead && <Ionicons name="star" size={10} color={BRAND} style={{ marginRight: 2 }} />}
                  <View style={s.leadAvatar}><Text style={s.leadAvatarText}>{l.displayName?.charAt(0)?.toUpperCase()}</Text></View>
                  <Text style={s.leadChipText}>{l.displayName}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.tabBar}>
            {TABS.map(t => {
              const count = t.key === 'participants' ? participants.length : t.key === 'expenses' ? allExpenses.length
                : t.key === 'documents' ? documents.length : allFeedback.length;
              return (
                <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => setTab(t.key)}>
                  <Ionicons name={t.icon} size={15} color={tab === t.key ? Colors.primary : Colors.gray500} />
                  <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
                  <View style={[s.tabCount, tab === t.key && s.tabCountActive]}>
                    <Text style={[s.tabCountText, tab === t.key && s.tabCountTextActive]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {loadingAll ? (
            <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
          ) : (<>
            {tab === 'participants' && (
              <ParticipantsList
                items={filteredParticipants} allCount={participants.length} isAdmin={isAdmin}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                sortPickup={sortPickup} setSortPickup={setSortPickup}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                stats={{ total: participants.length, boarded: boardedCount, noShow: noShowCount, balance: totalBalance, collected: totalCollected, male: maleCount, female: femaleCount }}
                onToggleBoarded={toggleBoarded} onToggleNoShow={toggleNoShow}
                onUpdateCollected={updateAmountCollected}
                editingRemarkId={editingRemarkId} setEditingRemarkId={setEditingRemarkId} tempRemark={tempRemark} setTempRemark={setTempRemark}
                onSaveRemark={saveLeadRemark}
                onAdd={openAddParticipant} onEdit={openEditParticipant} onDelete={deleteParticipant}
                onDownloadTemplate={downloadTemplate} downloadingTemplate={downloadingTemplate}
                onImport={importExcel} importing={importing}
              />
            )}
            {tab === 'expenses' && (
              <ExpensesTabView
                isAdmin={isAdmin} allExpenses={allExpenses}
                collected={myExpenseNum('amountCollected')} spent={myTotalSpent} remaining={myRemaining}
                submitted={expenseSubmitted} onOpen={openLogExpenses}
                activeItems={EXPENSE_ITEMS.filter(({ key }) => myExpenseNum(key) > 0).map(i => ({ ...i, amount: myExpenseNum(i.key) }))}
                activeAdditional={additionalExpenses.filter(i => parseFloat(i.amount) > 0)}
                onViewLead={(e: any) => { setAdminExpenseView(e); setSubView('adminExpense'); }}
              />
            )}
            {tab === 'documents' && (
              <DocumentsTabView
                isAdmin={isAdmin} items={documents} uploading={uploadingDoc} onUpload={uploadDocument}
                downloadingId={downloadingDocId} onDownload={downloadDocument} onDelete={deleteDocument}
                formatFileSize={formatFileSize}
              />
            )}
            {tab === 'feedback' && (
              <FeedbackTabView
                isAdmin={isAdmin} myFeedback={myFeedback} setMyFeedback={setMyFeedback}
                saving={savingFeedback} onSave={saveFeedback} allFeedback={allFeedback}
              />
            )}
          </>)}
        </>)}
      </ModalSafeArea>
    </Modal>
  );
}

/* ============================= Participants ============================= */

function ParticipantsList({
  items, allCount, isAdmin, searchQuery, setSearchQuery, sortPickup, setSortPickup, statusFilter, setStatusFilter,
  stats, onToggleBoarded, onToggleNoShow, onUpdateCollected, editingRemarkId, setEditingRemarkId, tempRemark, setTempRemark,
  onSaveRemark, onAdd, onEdit, onDelete, onDownloadTemplate, downloadingTemplate, onImport, importing,
}: any) {
  const FILTERS: { key: string; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'boarded', label: 'Boarded' }, { key: 'noshow', label: 'No Show' },
    { key: 'pending', label: 'Pending' }, { key: 'balance', label: 'Balance' },
  ];
  return (
    <FlatList
      data={items}
      keyExtractor={(p: Participant) => p.id}
      contentContainerStyle={s.tabContent}
      ListHeaderComponent={
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {[
              { label: 'Total', value: String(stats.total), sub: `${stats.male}M · ${stats.female}F` },
              { label: 'Boarded', value: `${stats.boarded}/${stats.total}`, sub: 'checked in', accent: true },
              { label: 'No Show', value: String(stats.noShow), sub: 'absent' },
              { label: 'Balance Due', value: fmtCur(stats.balance), sub: 'outstanding' },
              { label: 'Collected', value: fmtCur(stats.collected), sub: 'on site' },
            ].map((st: any) => (
              <View key={st.label} style={[s.statCard, st.accent && s.statCardAccent]}>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={[s.statValue, st.accent && { color: BRAND }]}>{st.value}</Text>
                <Text style={s.statSub}>{st.sub}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={s.searchRow}>
            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={14} color={Colors.gray400} />
              <TextInput style={s.searchInput} placeholder="Search name, contact, pickup…" placeholderTextColor={Colors.gray400}
                value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <TouchableOpacity onPress={() => setSortPickup((v: boolean) => !v)} style={[s.sortBtn, sortPickup && s.sortBtnActive]}>
              <Ionicons name="filter-outline" size={13} color={sortPickup ? Colors.white : Colors.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f.key} onPress={() => setStatusFilter(f.key)} style={[s.filterChip, statusFilter === f.key && s.filterChipActive]}>
                <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isAdmin && (
            <View style={s.adminRow}>
              <TouchableOpacity style={s.adminBtn} onPress={onDownloadTemplate} disabled={downloadingTemplate}>
                {downloadingTemplate ? <ActivityIndicator size="small" color={Colors.gray600} /> : <Ionicons name="download-outline" size={14} color={Colors.gray600} />}
                <Text style={s.adminBtnText}>Template</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.adminBtn} onPress={onImport} disabled={importing}>
                {importing ? <ActivityIndicator size="small" color={Colors.gray600} /> : <Ionicons name="cloud-upload-outline" size={14} color={Colors.gray600} />}
                <Text style={s.adminBtnText}>{importing ? 'Importing…' : 'Import'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.adminBtnPrimary} onPress={onAdd}>
                <Ionicons name="add" size={15} color={Colors.white} />
                <Text style={s.adminBtnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {allCount > 0 && items.length === 0 && (
            <Text style={s.empty}>No participants match your filters</Text>
          )}
        </View>
      }
      renderItem={({ item: p }: { item: Participant }) => (
        <Card padding={14} style={[{ marginBottom: 10 }, p.boarded && s.participantCardBoarded]}>
          <View style={s.pRow}>
            <TouchableOpacity onPress={() => onToggleBoarded(p)} style={{ marginRight: 10, marginTop: 2 }}>
              <Ionicons name={p.boarded ? 'checkbox' : 'square-outline'} size={20} color={p.boarded ? BRAND : Colors.gray300} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.pName}>{p.fullName}</Text>
              {!!p.age && <Text style={s.pSub}>{p.age}y · {p.gender}{p.pickupPoint ? `  ·  ${p.pickupPoint}` : ''}</Text>}
              {!!p.contactNo && <Text style={s.pSub}>{p.contactNo}</Text>}
              <Text style={s.pMoney}>Total ₹{fmt(p.totalPrice)} · Paid ₹{fmt(p.amountPaid)} {(p.balanceAmount || 0) > 0 && <Text style={{ color: Colors.danger, fontWeight: '700' }}>· Bal ₹{fmt(p.balanceAmount)}</Text>}</Text>

              {editingRemarkId === p.id ? (
                <TextInput
                  autoFocus style={s.remarkInput} value={tempRemark} onChangeText={setTempRemark}
                  onBlur={() => onSaveRemark(p, tempRemark)} onSubmitEditing={() => onSaveRemark(p, tempRemark)}
                  placeholder="Lead note…" placeholderTextColor={Colors.gray400}
                />
              ) : (
                <TouchableOpacity onPress={() => { setEditingRemarkId(p.id); setTempRemark(p.leadRemark || ''); }} style={{ marginTop: 4 }}>
                  <Text style={p.leadRemark ? s.remarkText : s.remarkPlaceholder}>{p.leadRemark || '+ lead note'}</Text>
                </TouchableOpacity>
              )}

              <View style={s.collectedRow}>
                <Text style={s.collectedLabel}>Collected</Text>
                <TextInput
                  style={s.collectedInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.gray400}
                  defaultValue={p.amountCollected ? String(p.amountCollected) : ''}
                  onBlur={(e) => onUpdateCollected(p, (e.nativeEvent as any).text ?? '')}
                />
              </View>
            </View>
          </View>

          <View style={s.pActionsRow}>
            {p.noShow
              ? <View style={[s.statusPill, { borderColor: Colors.dangerBg, backgroundColor: Colors.dangerBg }]}><Text style={{ color: Colors.danger, fontSize: 10, fontWeight: '700' }}>No Show</Text></View>
              : p.boarded
              ? <View style={[s.statusPill, { backgroundColor: BRAND }]}><Text style={{ color: Colors.white, fontSize: 10, fontWeight: '700' }}>Boarded</Text></View>
              : <View style={s.statusPill}><Text style={{ color: Colors.gray500, fontSize: 10, fontWeight: '700' }}>{p.status || 'Confirmed'}</Text></View>}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => onToggleNoShow(p)} style={s.iconBtn}>
              <Ionicons name="close-circle-outline" size={17} color={p.noShow ? Colors.danger : Colors.gray400} />
            </TouchableOpacity>
            {isAdmin && (<>
              <TouchableOpacity onPress={() => onEdit(p)} style={s.iconBtn}>
                <Ionicons name="create-outline" size={17} color={Colors.gray500} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(p)} style={s.iconBtn}>
                <Ionicons name="trash-outline" size={17} color={Colors.danger} />
              </TouchableOpacity>
            </>)}
          </View>
        </Card>
      )}
      ListEmptyComponent={allCount === 0 ? <Text style={s.empty}>No participants yet</Text> : null}
    />
  );
}

function ParticipantFormView({ form, setForm, editing, batchCode, saving, onSave, onCancel }: any) {
  const set = (k: keyof ParticipantFormState, v: string) => setForm((f: ParticipantFormState) => ({ ...f, [k]: v }));
  return (
    <View style={{ flex: 1 }}>
      <View style={s.formHeader}>
        <TouchableOpacity onPress={onCancel} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.formHeaderTitle}>{editing ? 'Edit Participant' : 'Add Participant'}</Text>
          <Text style={s.formHeaderSub}>{form.fullName || 'Enter name below'} · Batch {batchCode}</Text>
        </View>
        <View style={s.formAvatar}><Text style={s.formAvatarText}>{initials(form.fullName)}</Text></View>
      </View>
      <ScrollView contentContainerStyle={s.tabContent}>
        <Text style={s.sectionLabel}>— Identity</Text>
        <View style={s.field}><Text style={s.label}>SL No</Text><TextInput style={s.input} value={form.slNo} onChangeText={(v) => set('slNo', v)} placeholder="01" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}><Text style={s.label}>Full Name *</Text><TextInput style={s.input} value={form.fullName} onChangeText={(v) => set('fullName', v)} placeholder="Full name" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}><Text style={s.label}>Contact</Text><TextInput style={s.input} value={form.contactNo} onChangeText={(v) => set('contactNo', v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" placeholder="10 digits" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}><Text style={s.label}>Age</Text><TextInput style={s.input} value={form.age} onChangeText={(v) => set('age', v)} keyboardType="number-pad" placeholder="e.g. 28" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}>
          <Text style={s.label}>Gender</Text>
          <View style={s.toggleRow}>
            {['Male', 'Female', 'Other'].map(g => (
              <TouchableOpacity key={g} onPress={() => set('gender', g)} style={[s.toggleBtn, form.gender === g && s.toggleBtnActive]}>
                <Text style={[s.toggleBtnText, form.gender === g && s.toggleBtnTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.field}><Text style={s.label}>Pickup Point</Text><TextInput style={s.input} value={form.pickupPoint} onChangeText={(v) => set('pickupPoint', v)} placeholder="e.g. Silk Board, Majestic" placeholderTextColor={Colors.gray400} /></View>

        <Text style={s.sectionLabel}>— Payment</Text>
        <View style={s.field}><Text style={s.label}>Total Price</Text><TextInput style={s.input} value={form.totalPrice} onChangeText={(v) => set('totalPrice', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}><Text style={s.label}>Amount Paid</Text><TextInput style={s.input} value={form.amountPaid} onChangeText={(v) => set('amountPaid', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}><Text style={s.label}>Balance</Text><TextInput style={s.input} value={form.balanceAmount} onChangeText={(v) => set('balanceAmount', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}>
          <Text style={s.label}>Receipt Mode</Text>
          <View style={s.toggleRow}>
            {['Cash', 'UPI', 'Card'].map(m => (
              <TouchableOpacity key={m} onPress={() => set('receiptMode', m)} style={[s.toggleBtn, form.receiptMode === m && s.toggleBtnActive]}>
                <Text style={[s.toggleBtnText, form.receiptMode === m && s.toggleBtnTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.field}><Text style={s.label}>Receipt Date</Text><TextInput style={s.input} value={form.receiptDate} onChangeText={(v) => set('receiptDate', v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.gray400} /></View>
        <View style={s.field}><Text style={s.label}>Booked By</Text><TextInput style={s.input} value={form.bookedBy} onChangeText={(v) => set('bookedBy', v)} placeholder="Staff name" placeholderTextColor={Colors.gray400} /></View>

        <Text style={s.sectionLabel}>— Notes</Text>
        <View style={s.field}><Text style={s.label}>Remarks</Text><TextInput style={[s.input, s.textarea]} multiline value={form.remarks} onChangeText={(v) => set('remarks', v)} placeholder="Allergies, special needs, dietary preferences…" placeholderTextColor={Colors.gray400} /></View>
      </ScrollView>
      <View style={s.formFooter}>
        <Button title={editing ? 'Update Participant' : 'Add Participant'} onPress={onSave} loading={saving} style={{ flex: 1 }} />
        <Button title="Cancel" onPress={onCancel} variant="outline" style={{ paddingHorizontal: 24 }} />
      </View>
    </View>
  );
}

/* ============================== Expenses ============================== */

function ExpensesTabView({ isAdmin, allExpenses, collected, spent, remaining, submitted, onOpen, activeItems, activeAdditional, onViewLead }: any) {
  const consolidated = allExpenses.reduce((acc: any, e: any) => ({
    collected: acc.collected + (e.amountCollected || 0), spent: acc.spent + (e.totalSpent || 0), remaining: acc.remaining + (e.remaining || 0),
  }), { collected: 0, spent: 0, remaining: 0 });

  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <View style={s.summaryRow3}>
        <Card padding={12} style={[{ flex: 1 }, s.summaryAccentCard]}>
          <Text style={s.statLabel}>Collected</Text><Text style={[s.statValue, { color: BRAND }]}>{fmtCur(collected)}</Text>
        </Card>
        <Card padding={12} style={{ flex: 1 }}>
          <Text style={s.statLabel}>Spent</Text><Text style={s.statValue}>{fmtCur(spent)}</Text>
        </Card>
        <Card padding={12} style={{ flex: 1 }}>
          <Text style={s.statLabel}>{remaining >= 0 ? 'Remaining' : 'Overspent'}</Text>
          <Text style={[s.statValue, remaining < 0 && { color: Colors.danger }]}>{fmtCur(Math.abs(remaining))}</Text>
        </Card>
      </View>

      <Card padding={0} style={{ marginBottom: 14, overflow: 'hidden' }}>
        <View style={s.expenseCardHeader}>
          <View style={s.expenseIconBubble}><Ionicons name="receipt-outline" size={16} color={BRAND} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.pName}>My Expense Sheet</Text>
            <Text style={s.pSub}>{submitted ? 'Submitted — view or edit' : 'Log your expenses for this batch'}</Text>
          </View>
          <TouchableOpacity style={s.adminBtnPrimary} onPress={onOpen}>
            <Ionicons name={submitted ? 'eye-outline' : 'receipt-outline'} size={14} color={Colors.white} />
            <Text style={s.adminBtnPrimaryText}>{submitted ? 'View / Edit' : 'Log Expenses'}</Text>
          </TouchableOpacity>
        </View>
        {submitted && (activeItems.length > 0 || activeAdditional.length > 0) && (
          <View style={s.chipsWrap}>
            {activeItems.map((it: any) => (
              <View key={it.key} style={s.expenseChip}>
                <Ionicons name={it.icon} size={11} color={Colors.gray400} />
                <Text style={s.expenseChipLabel}>{it.label}</Text>
                <Text style={s.expenseChipAmt}>₹{fmt(it.amount)}</Text>
              </View>
            ))}
            {activeAdditional.map((item: any, i: number) => (
              <View key={i} style={[s.expenseChip, { borderColor: `${BRAND}50`, backgroundColor: `${BRAND}10` }]}>
                <Text style={[s.expenseChipLabel, { color: BRAND }]}>{item.reason || 'Extra'}</Text>
                <Text style={[s.expenseChipAmt, { color: BRAND }]}>₹{fmt(item.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {isAdmin && allExpenses.length > 0 && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <View style={s.expenseCardHeader}>
            <View style={s.expenseIconBubble}><Ionicons name="cash-outline" size={16} color={BRAND} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pName}>All Lead Expense Sheets</Text>
              <Text style={s.pSub}>{allExpenses.length} submission{allExpenses.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          {allExpenses.map((exp: any) => {
            const pct = exp.amountCollected > 0 ? Math.min(100, ((exp.totalSpent || 0) / exp.amountCollected) * 100) : 0;
            return (
              <View key={exp.id} style={s.leadExpenseRow}>
                <View style={s.pRow}>
                  <View style={s.leadExpenseAvatar}><Text style={s.leadAvatarText}>{exp.leadName?.charAt(0)?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pName}>{exp.leadName}</Text>
                    <Text style={s.pSub}>Updated {exp.updatedAt ? new Date(exp.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => onViewLead(exp)} style={s.viewBtn}>
                    <Ionicons name="eye-outline" size={13} color={Colors.gray600} />
                    <Text style={s.viewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.miniBarBg}><View style={[s.miniBarFg, { width: `${pct}%`, backgroundColor: pct > 90 ? Colors.danger : BRAND }]} /></View>
                <Text style={s.miniBarLabel}>Collected ₹{fmt(exp.amountCollected)} · Spent ₹{fmt(exp.totalSpent)} · {pct.toFixed(0)}% used</Text>
              </View>
            );
          })}
          <View style={s.consolidatedRow}>
            <Text style={[s.pName, { flex: 1 }]}>Consolidated Total</Text>
            <Text style={s.pSub}>₹{fmt(consolidated.collected)} collected · ₹{fmt(consolidated.spent)} spent</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function Donut({ pct, color }: { pct: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={56} height={56} viewBox="0 0 60 60" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={30} cy={30} r={r} stroke={Colors.slate100} strokeWidth={5} fill="none" />
        <Circle cx={30} cy={30} r={r} stroke={color} strokeWidth={5} fill="none"
          strokeDasharray={`${c * Math.min(100, pct) / 100} ${c}`} strokeLinecap="round" />
      </Svg>
      <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.gray700 }}>{Math.round(pct)}%</Text>
    </View>
  );
}

function ExpenseFormSubView({
  batchCode, editing, submitted, myExpense, setMyExpense, additionalExpenses, addRow, removeRow, updateRow,
  myExpenseNum, myTotalSpent, myRemaining, spendPct, saving, onSave, onEdit, onClose,
}: any) {
  const readOnly = !editing && submitted;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.formHeader}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={Colors.white} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.formHeaderTitle}>{editing ? 'Edit Expenses' : 'Expense Sheet'} — {batchCode}</Text>
          <Text style={s.formHeaderSub}>{editing ? 'Fill in your expenses below' : 'Your submitted report'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.tabContent}>
        {readOnly ? (<>
          <View style={s.collectedHero}>
            <View>
              <Text style={s.collectedHeroLabel}>Amount Collected</Text>
              <Text style={s.collectedHeroValue}>{fmtCur(myExpenseNum('amountCollected'))}</Text>
            </View>
            <Ionicons name="cash-outline" size={36} color={`${BRAND}40`} />
          </View>

          <Card padding={0} style={{ marginTop: 14, overflow: 'hidden' }}>
            {EXPENSE_ITEMS.filter(({ key }) => myExpenseNum(key) > 0).map(({ key, label, icon }) => {
              const amt = myExpenseNum(key);
              const pct = myTotalSpent > 0 ? (amt / myTotalSpent) * 100 : 0;
              return (
                <View key={key} style={s.breakdownRow}>
                  <View style={s.pRow}>
                    <Ionicons name={icon} size={13} color={Colors.gray400} />
                    <Text style={[s.pSub, { flex: 1, marginLeft: 6 }]}>{label}</Text>
                    <Text style={s.pName}>{fmtCur(amt)}</Text>
                  </View>
                  <View style={s.miniBarBg}><View style={[s.miniBarFg, { width: `${pct}%`, backgroundColor: BRAND }]} /></View>
                </View>
              );
            })}
            {additionalExpenses.filter((i: any) => parseFloat(i.amount) > 0).map((item: any, i: number) => (
              <View key={i} style={s.breakdownRow}>
                <View style={s.pRow}>
                  <Text style={[s.pSub, { flex: 1, color: BRAND }]}>{item.reason || 'Additional'}</Text>
                  <Text style={[s.pName, { color: BRAND }]}>{fmtCur(item.amount)}</Text>
                </View>
              </View>
            ))}
            {!!myExpense.otherExpensesRemarks && myExpenseNum('otherExpenses') > 0 && (
              <Text style={s.remarkNote}>{myExpense.otherExpensesRemarks}</Text>
            )}
            <View style={s.totalSpentRow}>
              <Text style={s.pName}>Total Spent</Text>
              <Text style={[s.pName, { color: Colors.danger }]}>{fmtCur(myTotalSpent)}</Text>
            </View>
          </Card>

          <View style={s.remainingCard}>
            <View>
              <Text style={s.statLabel}>{myRemaining >= 0 ? 'Amount Remaining' : 'Overspent by'}</Text>
              <Text style={[s.collectedHeroValue, { color: myRemaining >= 0 ? BRAND : Colors.danger, fontSize: 22 }]}>{fmtCur(Math.abs(myRemaining))}</Text>
            </View>
            <Donut pct={spendPct} color={myRemaining >= 0 ? BRAND : Colors.danger} />
          </View>
        </>) : (<>
          <View style={s.amountCollectedBox}>
            <View style={{ flex: 1 }}>
              <Text style={s.collectedHeroLabel}>Amount Collected</Text>
              <Text style={s.pSub}>Cash received from participants on trek day</Text>
            </View>
            <TextInput
              style={s.bigInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.gray300}
              value={myExpense.amountCollected} onChangeText={(v) => setMyExpense((p: any) => ({ ...p, amountCollected: v }))}
            />
          </View>

          <Text style={s.sectionLabel}>Expense Categories</Text>
          <View style={s.expenseGrid}>
            {EXPENSE_ITEMS.map(({ key, label, icon }) => {
              const active = (parseFloat(myExpense[key]) || 0) > 0;
              return (
                <View key={key} style={[s.expenseGridItem, active && s.expenseGridItemActive]}>
                  <View style={s.pRow}>
                    <Ionicons name={icon} size={14} color={active ? BRAND : Colors.gray400} />
                    <Text style={[s.expenseGridLabel, active && { color: Colors.gray900 }]}>{label}</Text>
                  </View>
                  <TextInput
                    style={s.expenseGridInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.gray400}
                    value={myExpense[key]} onChangeText={(v) => setMyExpense((p: any) => ({ ...p, [key]: v }))}
                  />
                </View>
              );
            })}
          </View>

          {myExpenseNum('otherExpenses') > 0 && (
            <View style={s.field}>
              <Text style={s.label}>Remarks for Other Expenses</Text>
              <TextInput style={s.input} value={myExpense.otherExpensesRemarks} onChangeText={(v) => setMyExpense((p: any) => ({ ...p, otherExpensesRemarks: v }))} placeholder="What were the other expenses?" placeholderTextColor={Colors.gray400} />
            </View>
          )}

          <View style={s.addExpenseHeader}>
            <View>
              <Text style={s.sectionLabel}>Additional Expenses</Text>
              <Text style={s.pSub}>Custom items with descriptions</Text>
            </View>
            <TouchableOpacity onPress={addRow} style={s.addRowBtn}>
              <Ionicons name="add" size={14} color={BRAND} /><Text style={s.addRowBtnText}>Add Row</Text>
            </TouchableOpacity>
          </View>
          {additionalExpenses.map((item: any, idx: number) => (
            <View key={idx} style={s.addRow}>
              <TextInput style={[s.input, { flex: 2 }]} placeholder="Description" placeholderTextColor={Colors.gray400}
                value={item.reason} onChangeText={(v) => updateRow(idx, 'reason', v)} />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="₹" keyboardType="decimal-pad" placeholderTextColor={Colors.gray400}
                value={item.amount} onChangeText={(v) => updateRow(idx, 'amount', v)} />
              <TouchableOpacity onPress={() => removeRow(idx)} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          {myExpenseNum('amountCollected') > 0 && (
            <View style={s.spendBarCard}>
              <View style={s.pRow}>
                <Text style={s.pSub}>Spent so far</Text>
                <Text style={[s.pName, { color: myRemaining < 0 ? Colors.danger : BRAND }]}>{fmtCur(myTotalSpent)} / {fmtCur(myExpenseNum('amountCollected'))}</Text>
              </View>
              <View style={s.miniBarBg}><View style={[s.miniBarFg, { width: `${spendPct}%`, backgroundColor: myRemaining < 0 ? Colors.danger : BRAND }]} /></View>
              <Text style={s.miniBarLabel}>{spendPct.toFixed(0)}% used · {myRemaining >= 0 ? `₹${fmt(myRemaining)} remaining` : `₹${fmt(Math.abs(myRemaining))} overspent`}</Text>
            </View>
          )}
        </>)}
      </ScrollView>

      <View style={s.formFooter}>
        {readOnly
          ? <Button title="Edit Expenses" onPress={onEdit} style={{ flex: 1 }} />
          : <Button title="Submit Expenses" onPress={onSave} loading={saving} style={{ flex: 1 }} />}
        <Button title="Close" onPress={onClose} variant="outline" style={{ paddingHorizontal: 24 }} />
      </View>
    </View>
  );
}

function AdminExpenseSubView({ record, onClose }: { record: any; onClose: () => void }) {
  const pct = record.amountCollected > 0 ? Math.min(100, ((record.totalSpent || 0) / record.amountCollected) * 100) : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.formHeader}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={Colors.white} /></TouchableOpacity>
        <View style={s.formAvatar}><Text style={s.formAvatarText}>{record.leadName?.charAt(0)?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.formHeaderTitle}>{record.leadName}</Text>
          <Text style={s.formHeaderSub}>Expense breakdown</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.tabContent}>
        <View style={s.collectedHero}>
          <View>
            <Text style={s.collectedHeroLabel}>Amount Collected</Text>
            <Text style={s.collectedHeroValue}>{fmtCur(record.amountCollected)}</Text>
          </View>
          <Ionicons name="cash-outline" size={36} color={`${BRAND}40`} />
        </View>

        <Card padding={0} style={{ marginTop: 14, overflow: 'hidden' }}>
          {EXPENSE_ITEMS.filter(({ key }) => (record[key] || 0) > 0).map(({ key, label, icon }) => {
            const amt = record[key] || 0;
            const barPct = (record.totalSpent || 0) > 0 ? (amt / record.totalSpent) * 100 : 0;
            return (
              <View key={key} style={s.breakdownRow}>
                <View style={s.pRow}>
                  <Ionicons name={icon} size={13} color={Colors.gray400} />
                  <Text style={[s.pSub, { flex: 1, marginLeft: 6 }]}>{label}</Text>
                  <Text style={s.pName}>{fmtCur(amt)}</Text>
                </View>
                <View style={s.miniBarBg}><View style={[s.miniBarFg, { width: `${barPct}%`, backgroundColor: BRAND }]} /></View>
              </View>
            );
          })}
          {(record.additionalExpenses || []).filter((i: any) => i.amount > 0).map((item: any, i: number) => (
            <View key={i} style={s.breakdownRow}>
              <View style={s.pRow}>
                <Text style={[s.pSub, { flex: 1, color: BRAND }]}>{item.reason || 'Additional'}</Text>
                <Text style={[s.pName, { color: BRAND }]}>{fmtCur(item.amount)}</Text>
              </View>
            </View>
          ))}
          <View style={s.totalSpentRow}>
            <Text style={s.pName}>Total Spent</Text>
            <Text style={[s.pName, { color: Colors.danger }]}>{fmtCur(record.totalSpent)}</Text>
          </View>
        </Card>

        <View style={s.remainingCard}>
          <View>
            <Text style={s.statLabel}>{(record.remaining || 0) >= 0 ? 'Remaining' : 'Overspent by'}</Text>
            <Text style={[s.collectedHeroValue, { color: (record.remaining || 0) >= 0 ? BRAND : Colors.danger, fontSize: 22 }]}>{fmtCur(Math.abs(record.remaining || 0))}</Text>
          </View>
          <Donut pct={pct} color={(record.remaining || 0) >= 0 ? BRAND : Colors.danger} />
        </View>
      </ScrollView>
      <View style={s.formFooter}>
        <Button title="Close" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/* ============================== Documents ============================== */

function DocumentsTabView({ isAdmin, items, uploading, onUpload, downloadingId, onDownload, onDelete, formatFileSize }: any) {
  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      {isAdmin && (
        <Card padding={14} style={{ marginBottom: 14 }}>
          <View style={s.pRow}>
            <View style={s.expenseIconBubble}><Ionicons name="cloud-upload-outline" size={17} color={BRAND} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pName}>Upload Document</Text>
              <Text style={s.pSub}>PDF, Word, Excel, images — max 10MB</Text>
            </View>
            <TouchableOpacity style={s.uploadBtn} onPress={onUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color={BRAND} /> : <Ionicons name="cloud-upload-outline" size={14} color={BRAND} />}
              <Text style={s.uploadBtnText}>{uploading ? 'Uploading…' : 'Choose File'}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {items.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="document-outline" size={30} color={Colors.gray200} />
          <Text style={s.emptyBoxTitle}>No documents yet</Text>
          {isAdmin && <Text style={s.emptyBoxSub}>Upload permits, tickets or trek documents</Text>}
        </View>
      ) : (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <View style={s.docsHeader}>
            <Ionicons name="document-text-outline" size={15} color={BRAND} />
            <Text style={s.pName}>Documents ({items.length})</Text>
          </View>
          {items.map((doc: BatchDoc) => (
            <View key={doc.id} style={s.docRow}>
              <View style={s.expenseIconBubble}><Ionicons name="document-text-outline" size={16} color={BRAND} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pName} numberOfLines={1}>{doc.name}</Text>
                <Text style={s.pSub}>{formatFileSize(doc.size)} · {doc.uploadedBy} · {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => onDownload(doc)} style={s.iconBtn} disabled={downloadingId === doc.id}>
                {downloadingId === doc.id ? <ActivityIndicator size="small" color={BRAND} /> : <Ionicons name="download-outline" size={18} color={BRAND} />}
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity onPress={() => onDelete(doc)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

/* =============================== Feedback =============================== */

function FeedbackTabView({ isAdmin, myFeedback, setMyFeedback, saving, onSave, allFeedback }: any) {
  return (
    <ScrollView contentContainerStyle={s.tabContent}>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <View style={s.expenseCardHeader}>
          <View style={s.expenseIconBubble}><Ionicons name="chatbox-outline" size={15} color={BRAND} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.pName}>My Feedback</Text>
            <Text style={s.pSub}>What went well and what can improve</Text>
          </View>
          <TouchableOpacity style={s.adminBtnPrimary} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="save-outline" size={14} color={Colors.white} />}
            <Text style={s.adminBtnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ padding: 14, gap: 14 }}>
          <View>
            <View style={s.pRow}><Ionicons name="thumbs-up-outline" size={12} color={BRAND} /><Text style={[s.label, { marginLeft: 6 }]}>Positive Highlights</Text></View>
            <TextInput style={[s.input, s.textarea]} multiline value={myFeedback.positive}
              onChangeText={(v) => setMyFeedback((p: any) => ({ ...p, positive: v }))}
              placeholder="What went well on this trek? Great moments, highlights…" placeholderTextColor={Colors.gray300} />
          </View>
          <View>
            <View style={s.pRow}><Ionicons name="thumbs-down-outline" size={12} color={Colors.gray400} /><Text style={[s.label, { marginLeft: 6 }]}>Areas for Improvement</Text></View>
            <TextInput style={[s.input, s.textarea]} multiline value={myFeedback.negative}
              onChangeText={(v) => setMyFeedback((p: any) => ({ ...p, negative: v }))}
              placeholder="What could be improved? Issues, suggestions…" placeholderTextColor={Colors.gray300} />
          </View>
        </View>
      </Card>

      {isAdmin && allFeedback.length > 0 && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <View style={s.docsHeader}>
            <Ionicons name="chatbox-outline" size={15} color={BRAND} />
            <Text style={s.pName}>All Lead Feedback ({allFeedback.length})</Text>
          </View>
          {allFeedback.map((fb: any) => (
            <View key={fb.id} style={{ padding: 14, borderTopWidth: 1, borderTopColor: Colors.gray100 }}>
              <View style={s.pRow}>
                <View style={s.leadExpenseAvatar}><Text style={s.leadAvatarText}>{fb.leadName?.charAt(0)?.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pName}>{fb.leadName}</Text>
                  <Text style={s.pSub}>{fb.updatedAt || fb.createdAt ? new Date(fb.updatedAt || fb.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
                </View>
              </View>
              {!!fb.positive && <View style={s.fbBlock}><Text style={s.fbBlockLabel}>+ Positive</Text><Text style={s.fbBlockText}>{fb.positive}</Text></View>}
              {!!fb.negative && <View style={s.fbBlock}><Text style={s.fbBlockLabel}>− Improvement</Text><Text style={s.fbBlockText}>{fb.negative}</Text></View>}
              {!fb.positive && !fb.negative && <Text style={s.empty}>No feedback provided yet</Text>}
            </View>
          ))}
        </Card>
      )}
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

  fillWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.white },
  fillBarBg: { flex: 1, height: 5, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden' },
  fillBarFg: { height: '100%', borderRadius: 3 },
  fillPct:  { fontSize: 11, fontWeight: '700', color: Colors.gray700, width: 34, textAlign: 'right' },

  leadsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: Colors.white },
  leadChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.gray100 },
  leadChipSuper: { backgroundColor: `${BRAND}18` },
  leadChipText: { fontSize: 11, fontWeight: '600', color: Colors.gray700 },
  leadAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  leadAvatarText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  tabBar:   { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray500 },
  tabLabelActive: { color: Colors.primary },
  tabCount: { minWidth: 18, paddingHorizontal: 4, height: 16, borderRadius: 8, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  tabCountActive: { backgroundColor: BRAND },
  tabCountText: { fontSize: 9, fontWeight: '800', color: Colors.gray500 },
  tabCountTextActive: { color: Colors.white },

  tabContent: { padding: 16, gap: 0, paddingBottom: 40 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  statCard: { width: 118, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, padding: 12, marginRight: 8 },
  statCardAccent: { borderColor: BRAND, borderLeftWidth: 3 },
  statLabel: { fontSize: 9, fontWeight: '800', color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  statValue: { fontSize: 17, fontWeight: '800', color: Colors.gray900 },
  statSub:  { fontSize: 10, color: Colors.gray400, marginTop: 2 },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.gray900, height: 38 },
  sortBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  sortBtnActive: { backgroundColor: BRAND, borderColor: BRAND },

  filterChip: { paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  filterChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  filterChipText: { fontSize: 11, fontWeight: '600', color: Colors.gray500 },
  filterChipTextActive: { color: Colors.white },

  adminRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  adminBtnText: { fontSize: 11, fontWeight: '700', color: Colors.gray600 },
  adminBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 8, backgroundColor: BRAND },
  adminBtnPrimaryText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  participantCardBoarded: { borderLeftWidth: 3, borderLeftColor: BRAND },
  pRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pName: { fontSize: 14, fontWeight: '700', color: Colors.gray900 },
  pSub:  { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  pMoney:{ fontSize: 12, color: Colors.gray600, marginTop: 4, fontWeight: '500' },

  remarkInput: { marginTop: 5, fontSize: 12, borderWidth: 1, borderColor: BRAND, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, color: BRAND },
  remarkText: { fontSize: 12, fontStyle: 'italic', color: BRAND, marginTop: 4 },
  remarkPlaceholder: { fontSize: 12, fontStyle: 'italic', color: Colors.gray300, marginTop: 4 },

  collectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  collectedLabel: { fontSize: 11, color: Colors.gray400, fontWeight: '600' },
  collectedInput: { width: 90, height: 30, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 8, fontSize: 12, textAlign: 'right', color: Colors.gray900, backgroundColor: Colors.gray50 },

  pActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.gray100 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  iconBtn: { padding: 6, marginLeft: 2 },

  empty: { textAlign: 'center', color: Colors.gray400, padding: 30, fontSize: 13 },
  emptyBox: { alignItems: 'center', paddingVertical: 50, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  emptyBoxTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray500, marginTop: 10 },
  emptyBoxSub: { fontSize: 11, color: Colors.gray300, marginTop: 3 },

  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: BRAND },
  formHeaderTitle: { fontSize: 15, fontWeight: '800', color: Colors.white },
  formHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  formAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  formAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  formFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: BRAND, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },
  field:    { gap: 6, marginBottom: 14 },
  label:    { fontSize: 12, fontWeight: '600', color: Colors.gray700 },
  input:    { height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.white },
  textarea: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  addRow:   { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },

  toggleRow: { flexDirection: 'row', gap: 6 },
  toggleBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  toggleBtnActive: { backgroundColor: BRAND, borderColor: BRAND },
  toggleBtnText: { fontSize: 12, fontWeight: '600', color: Colors.gray600 },
  toggleBtnTextActive: { color: Colors.white },

  summaryRow3: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryAccentCard: { borderColor: BRAND, borderLeftWidth: 3 },

  expenseCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  expenseIconBubble: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${BRAND}18`, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 14, paddingTop: 10 },
  expenseChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.gray100, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  expenseChipLabel: { fontSize: 10, color: Colors.gray500 },
  expenseChipAmt: { fontSize: 11, fontWeight: '800', color: Colors.gray700 },

  leadExpenseRow: { padding: 14, borderTopWidth: 1, borderTopColor: Colors.gray100 },
  leadExpenseAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  viewBtnText: { fontSize: 11, fontWeight: '600', color: Colors.gray600 },
  miniBarBg: { height: 5, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  miniBarFg: { height: '100%', borderRadius: 3 },
  miniBarLabel: { fontSize: 10, color: Colors.gray400, marginTop: 4 },
  consolidatedRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: Colors.gray50 },

  collectedHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: BRAND, backgroundColor: `${BRAND}0d`, borderRadius: 16, padding: 16 },
  collectedHeroLabel: { fontSize: 10, fontWeight: '800', color: BRAND, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  collectedHeroValue: { fontSize: 26, fontWeight: '900', color: BRAND },

  breakdownRow: { padding: 12, borderTopWidth: 1, borderTopColor: Colors.gray50 },
  remarkNote: { fontSize: 11, color: Colors.gray400, fontStyle: 'italic', paddingHorizontal: 12, paddingBottom: 8 },
  totalSpentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: Colors.gray100 },

  remainingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: `${BRAND}50`, borderRadius: 14, padding: 14, marginTop: 14, marginBottom: 6 },

  amountCollectedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${BRAND}0a`, borderRadius: 14, padding: 14, marginBottom: 16 },
  bigInput: { width: 120, height: 50, borderWidth: 2, borderColor: BRAND, borderRadius: 12, textAlign: 'right', fontSize: 20, fontWeight: '800', color: BRAND, backgroundColor: Colors.white, paddingHorizontal: 10 },

  expenseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  expenseGridItem: { width: '47%', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 10, backgroundColor: Colors.white },
  expenseGridItemActive: { borderColor: BRAND, backgroundColor: `${BRAND}0d` },
  expenseGridLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray500, marginLeft: 6, flexShrink: 1 },
  expenseGridInput: { marginTop: 8, height: 36, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, textAlign: 'right', paddingHorizontal: 8, fontSize: 13, fontWeight: '700', color: Colors.gray900, backgroundColor: Colors.gray50 },

  addExpenseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: `${BRAND}50`, borderStyle: 'dashed', backgroundColor: `${BRAND}0d` },
  addRowBtnText: { fontSize: 11, fontWeight: '700', color: BRAND },

  spendBarCard: { backgroundColor: Colors.gray50, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginTop: 4 },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: BRAND },
  uploadBtnText: { fontSize: 11, fontWeight: '700', color: BRAND },
  docsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: Colors.gray50 },

  fbBlock: { marginTop: 8, backgroundColor: Colors.gray50, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray100, padding: 10 },
  fbBlockLabel: { fontSize: 9, fontWeight: '800', color: Colors.gray500, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  fbBlockText: { fontSize: 12, color: Colors.gray700, lineHeight: 17 },
});
