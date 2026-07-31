import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Modal, ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/ui';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { PickerSheet, PickerTrigger } from '@/components/PickerSheet';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Trek { id: string; name: string; }
interface BasicUser { uid: string; displayName: string; role: string; status: string; }
interface AssignedLead { userId: string; displayName: string; isSuperLead?: boolean; }

const STATUS_OPTIONS = ['Open', 'Closed', 'Completed', 'Cancelled'];

export interface EditableBatch {
  id: string;
  batchCode?: string;
  trekId?: string;
  startDate?: string;
  endDate?: string;
  maxCapacity?: number;
  currentRegistrations?: number;
  status?: string;
  assignedLeads?: AssignedLead[];
  transportVendor?: string;
  stayVendor?: string;
  internalNotes?: string;
}

/**
 * Mirrors the web app's "Create New Batch" / "Edit batch" dialog
 * (frontend/src/pages/BatchPlanning.js BatchFormDialog) — same fields,
 * same POST/PATCH /batches payload shape. Rendered as a single native
 * <Modal>; the trek-lead picker below is an inline overlay (not a second
 * <Modal>) since stacking two RN Modals is a known source of iOS rendering
 * glitches.
 */
export function BatchFormModal({ editingBatch, onClose, onSaved }: {
  editingBatch?: EditableBatch | null; onClose: () => void; onSaved: () => void;
}) {
  const [treks, setTreks] = useState<Trek[]>([]);
  const [users, setUsers] = useState<BasicUser[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [batchCode, setBatchCode] = useState(editingBatch?.batchCode ?? '');
  const [trekId, setTrekId] = useState(editingBatch?.trekId ?? '');
  const [startDate, setStartDate] = useState(editingBatch?.startDate ?? '');
  const [endDate, setEndDate] = useState(editingBatch?.endDate ?? '');
  const [maxCapacity, setMaxCapacity] = useState(String(editingBatch?.maxCapacity ?? 30));
  const [currentRegistrations, setCurrentRegistrations] = useState(String(editingBatch?.currentRegistrations ?? 0));
  const [status, setStatus] = useState(editingBatch?.status ?? 'Open');
  const [assignedLeads, setAssignedLeads] = useState<AssignedLead[]>(editingBatch?.assignedLeads ?? []);
  const [transportVendor, setTransportVendor] = useState(editingBatch?.transportVendor ?? '');
  const [stayVendor, setStayVendor] = useState(editingBatch?.stayVendor ?? '');
  const [internalNotes, setInternalNotes] = useState(editingBatch?.internalNotes ?? '');

  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [trekPickerOpen, setTrekPickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/treks'), api.get('/users/basic')])
      .then(([tr, ur]) => {
        setTreks(tr.data ?? []);
        setUsers((ur.data ?? []).filter((u: BasicUser) => u.status === 'approved'));
      })
      .catch(() => {})
      .finally(() => setLoadingLists(false));
  }, []);

  const toggleLead = (u: BasicUser) => {
    setAssignedLeads(prev => {
      const has = prev.find(l => l.userId === u.uid);
      if (has) return prev.filter(l => l.userId !== u.uid);
      return [...prev, { userId: u.uid, displayName: u.displayName, isSuperLead: prev.length === 0 }];
    });
  };
  const makeSuperLead = (uid: string) =>
    setAssignedLeads(prev => prev.map(l => ({ ...l, isSuperLead: l.userId === uid })));
  const removeLead = (uid: string) =>
    setAssignedLeads(prev => {
      const upd = prev.filter(l => l.userId !== uid);
      if (upd.length && !upd.some(l => l.isSuperLead)) upd[0].isSuperLead = true;
      return upd;
    });

  const save = async () => {
    if (!batchCode.trim())  { Alert.alert('Batch code required', 'Enter a batch code, e.g. BT501.'); return; }
    if (!trekId)            { Alert.alert('Trek required', 'Select a trek.'); return; }
    if (!startDate.trim() || !endDate.trim()) { Alert.alert('Dates required', 'Enter start and end dates (YYYY-MM-DD).'); return; }
    if (!maxCapacity.trim()){ Alert.alert('Capacity required', 'Enter max capacity.'); return; }

    setSaving(true);
    const payload = {
      batchCode: batchCode.trim(),
      trekId,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      maxCapacity: parseInt(maxCapacity, 10) || 0,
      currentRegistrations: parseInt(currentRegistrations, 10) || 0,
      status,
      assignedLeads,
      transportVendor: transportVendor.trim(),
      stayVendor: stayVendor.trim(),
      internalNotes: internalNotes.trim(),
    };
    try {
      if (editingBatch) await api.patch(`/batches/${editingBatch.id}`, payload);
      else await api.post('/batches', payload);
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? `Could not ${editingBatch ? 'update' : 'create'} batch`);
    } finally { setSaving(false); }
  };

  const filteredUsers = users.filter(u => !leadSearch || u.displayName?.toLowerCase().includes(leadSearch.toLowerCase()));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <ModalSafeArea style={s.safe}>
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Ionicons name={editingBatch ? 'create-outline' : 'add'} size={18} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{editingBatch ? `Edit — ${editingBatch.batchCode}` : 'Create New Batch'}</Text>
              <Text style={s.headerSub}>{editingBatch ? 'Update batch details and assignments' : 'Add a new trek batch to the system'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>

          {loadingLists ? (
            <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
          ) : (
            <ScrollView
              contentContainerStyle={s.form}
              keyboardShouldPersistTaps="handled"
              // Lets a focused field scroll clear of the keyboard rather than
              // sitting underneath it.
              automaticallyAdjustKeyboardInsets
            >
              <View style={s.row2}>
                <View style={s.field}>
                  <Text style={s.label}>BATCH CODE *</Text>
                  <TextInput style={s.input} value={batchCode} onChangeText={setBatchCode}
                    placeholder="e.g. BT501" placeholderTextColor={Colors.slate400} autoCapitalize="characters" />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>TREK *</Text>
                  <PickerTrigger
                    label={treks.find(t => t.id === trekId)?.name}
                    placeholder="Select trek"
                    onPress={() => setTrekPickerOpen(true)}
                  />
                </View>
              </View>

              <View style={s.row2}>
                <View style={s.field}>
                  <Text style={s.label}>START DATE *</Text>
                  <TextInput style={s.input} value={startDate} onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD" placeholderTextColor={Colors.slate400} />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>END DATE *</Text>
                  <TextInput style={s.input} value={endDate} onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD" placeholderTextColor={Colors.slate400} />
                </View>
              </View>

              <View style={s.row2}>
                <View style={s.field}>
                  <Text style={s.label}>MAX CAPACITY *</Text>
                  <TextInput style={s.input} value={maxCapacity} onChangeText={setMaxCapacity}
                    keyboardType="number-pad" placeholderTextColor={Colors.slate400} />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>REGISTRATIONS</Text>
                  <TextInput style={s.input} value={currentRegistrations} onChangeText={setCurrentRegistrations}
                    keyboardType="number-pad" placeholderTextColor={Colors.slate400} />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>STATUS</Text>
                <PickerTrigger label={status} onPress={() => setStatusPickerOpen(true)} />
              </View>

              <View style={s.field}>
                <Text style={s.label}>👤 ASSIGN TREK LEADS</Text>
                <TouchableOpacity style={s.leadTrigger} onPress={() => setLeadPickerOpen(true)} activeOpacity={0.8}>
                  <Text style={assignedLeads.length ? s.leadTriggerTextActive : s.leadTriggerText}>
                    {assignedLeads.length === 0 ? 'Select trek leads…' : `${assignedLeads.length} lead(s) selected`}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.slate400} />
                </TouchableOpacity>

                {assignedLeads.length > 0 && (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {assignedLeads.map(l => (
                      <View key={l.userId} style={s.leadChip}>
                        <Avatar name={l.displayName} size={28} />
                        <Text style={s.leadChipName} numberOfLines={1}>{l.displayName}</Text>
                        <TouchableOpacity
                          style={[s.superBtn, l.isSuperLead && s.superBtnActive]}
                          onPress={() => makeSuperLead(l.userId)}
                        >
                          <Ionicons name="star" size={11} color={l.isSuperLead ? '#a16207' : Colors.slate400} />
                          <Text style={[s.superBtnText, l.isSuperLead && s.superBtnTextActive]}>
                            {l.isSuperLead ? 'Super Lead' : 'Lead'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeLead(l.userId)} hitSlop={8}>
                          <Ionicons name="close" size={16} color={Colors.slate300} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={s.row2}>
                <View style={s.field}>
                  <Text style={s.label}>🚌 TRANSPORT VENDOR</Text>
                  <TextInput style={s.input} value={transportVendor} onChangeText={setTransportVendor}
                    placeholder="e.g. Sharma Travels" placeholderTextColor={Colors.slate400} />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>🏕️ STAY VENDOR</Text>
                  <TextInput style={s.input} value={stayVendor} onChangeText={setStayVendor}
                    placeholder="e.g. Forest Huts" placeholderTextColor={Colors.slate400} />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>INTERNAL NOTES</Text>
                <TextInput style={[s.input, s.textarea]} value={internalNotes} onChangeText={setInternalNotes}
                  placeholder="Visible to ops team only…" placeholderTextColor={Colors.slate400} multiline />
              </View>

              <View style={s.btnRow}>
                <Button title={editingBatch ? 'Save Changes' : 'Create Batch'} onPress={save} loading={saving} style={{ flex: 1 }} />
                <Button title="Cancel" onPress={onClose} variant="outline" style={s.cancelBtn} />
              </View>
            </ScrollView>
          )}
        </ModalSafeArea>

        {/* Trek-lead picker — inline overlay within the same Modal, not a nested one.
            The sheet is bottom-anchored and its search field autofocuses, so without
            KeyboardAvoidingView the on-screen keyboard covers the user list (and the
            Done button) entirely on iOS. Wrapping the overlay lifts the sheet above
            the keyboard instead. */}
        {leadPickerOpen && (
          <KeyboardAvoidingView
            style={s.overlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setLeadPickerOpen(false)} />
            <ModalSafeArea style={s.sheet} edges={['bottom']}>
              <View style={s.sheetHandle} />
              <View style={s.searchBox}>
                <Ionicons name="search-outline" size={15} color={Colors.slate400} />
                <TextInput
                  style={s.searchInput}
                  value={leadSearch}
                  onChangeText={setLeadSearch}
                  placeholder="Search…"
                  placeholderTextColor={Colors.slate400}
                  autoFocus
                />
              </View>
              <FlatList
                data={filteredUsers}
                keyExtractor={u => u.uid}
                style={{ maxHeight: 340 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: u }) => {
                  const checked = !!assignedLeads.find(l => l.userId === u.uid);
                  return (
                    <TouchableOpacity style={s.userRow} onPress={() => toggleLead(u)} activeOpacity={0.7}>
                      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={19} color={checked ? Colors.primary : Colors.slate300} />
                      <Avatar name={u.displayName} size={26} />
                      <Text style={s.userName}>{u.displayName}</Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={s.empty}>No users found</Text>}
              />
              <TouchableOpacity style={s.doneBtn} onPress={() => setLeadPickerOpen(false)} activeOpacity={0.85}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </ModalSafeArea>
          </KeyboardAvoidingView>
        )}

        <PickerSheet
          visible={trekPickerOpen}
          onClose={() => setTrekPickerOpen(false)}
          title="Select trek"
          value={trekId}
          onChange={setTrekId}
          options={treks.map(t => ({ label: t.name, value: t.id }))}
        />
        <PickerSheet
          visible={statusPickerOpen}
          onClose={() => setStatusPickerOpen(false)}
          title="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS.map(o => ({ label: o, value: o }))}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16, backgroundColor: Colors.primary,
  },
  headerIcon:  { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 18, paddingBottom: 40, gap: 16 },

  row2: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  label: { fontSize: 10, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.6 },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  textarea: { height: 70, paddingTop: 10, textAlignVertical: 'top' },

  pickerWrap: { borderWidth: 1.5, borderColor: Colors.slate200, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.white },
  picker: { height: 46 },

  leadTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, backgroundColor: Colors.white },
  leadTriggerText: { fontSize: 13, color: Colors.slate400 },
  leadTriggerTextActive: { fontSize: 13, color: Colors.slate700, fontWeight: '600' },

  leadChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.slate50, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate100, paddingHorizontal: 10, paddingVertical: 8 },
  leadChipName: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.slate900 },
  superBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.slate200 },
  superBtnActive: { backgroundColor: '#fef3c7' },
  superBtnText: { fontSize: 10, fontWeight: '700', color: Colors.slate500 },
  superBtnTextActive: { color: '#a16207' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.slate100 },
  cancelBtn: { flex: 0, paddingHorizontal: 22 },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, maxHeight: '75%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.slate200, alignSelf: 'center', marginBottom: 10 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.slate50, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 12, height: 42, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.slate900 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.slate50 },
  userName: { fontSize: 14, color: Colors.slate900, flex: 1 },
  empty: { textAlign: 'center', color: Colors.slate400, padding: 30 },

  doneBtn: { marginTop: 10, marginBottom: 14, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  doneBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
