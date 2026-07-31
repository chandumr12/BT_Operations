import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import {
  PLACES, PRESET_CODES, PKG, STATUS_OPTIONS,
  DSPairsEditor, RoomGroupsEditor,
  Stay, DSPair, RoomGroup,
} from './HotelStayShared';

export interface EntryFormValue {
  place: string; date: string; serial: string;
  codePreset: string; codeCustom: string; packageName: string;
  pax: string; status: string; male: string; female: string;
  doubleSharingPairs: DSPair[]; sharingRooms: RoomGroup[];
}

const BLANK: EntryFormValue = {
  place: PLACES[0], date: '', serial: '', codePreset: 'K', codeCustom: '', packageName: '',
  pax: '', status: 'CHECK-IN', male: '', female: '', doubleSharingPairs: [], sharingRooms: [],
};

export function fromStay(st: Stay): EntryFormValue {
  const isPreset = ['K', 'T', 'C'].includes(st.code);
  return {
    place: st.place, date: st.date, serial: String(st.serial),
    codePreset: isPreset ? st.code : 'custom', codeCustom: isPreset ? '' : st.code,
    packageName: st.packageName ?? '',
    pax: String(st.pax ?? ''), status: st.status ?? 'CHECK-IN',
    male: st.male ? String(st.male) : '', female: st.female ? String(st.female) : '',
    doubleSharingPairs: st.doubleSharingPairs ?? [], sharingRooms: st.sharingRooms ?? [],
  };
}

/** Mirrors frontend/src/pages/HotelStays.js `EntryForm` — single stay entry. */
export function EntryFormModal({ initial, defaultPlace, onSave, onClose, saving }: {
  initial: EntryFormValue | null;
  defaultPlace?: string;
  onSave: (payload: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EntryFormValue>(initial ?? { ...BLANK, place: defaultPlace ?? PLACES[0] });
  const set = <K extends keyof EntryFormValue>(k: K, v: EntryFormValue[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    const code = form.codePreset === 'custom' ? form.codeCustom.trim().toUpperCase() : form.codePreset;
    if (!code) { Alert.alert('Package code required'); return; }
    if (!form.date.trim()) { Alert.alert('Date required'); return; }
    if (!form.pax.trim() || isNaN(Number(form.pax))) { Alert.alert('Valid pax count required'); return; }
    if (!form.serial.trim() || isNaN(Number(form.serial))) { Alert.alert('Batch serial required'); return; }

    onSave({
      place: form.place, date: form.date.trim(), serial: Number(form.serial),
      code, packageName: form.codePreset === 'custom' ? form.packageName.trim() : (PKG[form.codePreset] ?? ''),
      pax: Number(form.pax), status: form.status,
      doubleSharingPairs: form.doubleSharingPairs, doubleSharing: form.doubleSharingPairs.length,
      sharingRooms: form.sharingRooms,
      male: form.male ? Number(form.male) : 0, female: form.female ? Number(form.female) : 0,
      clientNames: [],
    });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="arrow-back" size={22} color={Colors.slate900} /></TouchableOpacity>
          <Text style={s.headerTitle}>{initial ? 'Edit Stay Entry' : 'Add Stay Entry'}</Text>
        </View>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Field label="Place">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              {PLACES.map(p => (
                <TouchableOpacity key={p} style={[s.chip, form.place === p && s.chipActive]} onPress={() => set('place', p)}>
                  <Text style={[s.chipText, form.place === p && s.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          <View style={s.row2}>
            <Field label="Date (YYYY-MM-DD)" flex={1}>
              <TextInput style={s.input} value={form.date} onChangeText={v => set('date', v)} placeholder="2026-08-14" placeholderTextColor={Colors.slate400} />
            </Field>
            <Field label="Batch Serial #" flex={1}>
              <TextInput style={s.input} value={form.serial} onChangeText={v => set('serial', v)} keyboardType="number-pad" placeholder="1" placeholderTextColor={Colors.slate400} />
            </Field>
          </View>

          <Field label="Package">
            <View style={s.pickerRow}>
              {PRESET_CODES.map(c => (
                <TouchableOpacity key={c.value} style={[s.pickChip, form.codePreset === c.value && s.pickChipActive]} onPress={() => set('codePreset', c.value)}>
                  <Text style={[s.pickChipText, form.codePreset === c.value && s.pickChipTextActive]}>{c.value === 'custom' ? 'Custom' : c.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {form.codePreset === 'custom' && (
            <View style={s.row2}>
              <Field label="Custom Code" flex={1}>
                <TextInput style={s.input} value={form.codeCustom} onChangeText={v => set('codeCustom', v.toUpperCase())} placeholder="e.g. SP" maxLength={6} placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="Package Name" flex={1}>
                <TextInput style={s.input} value={form.packageName} onChangeText={v => set('packageName', v)} placeholder="e.g. Special 8D" placeholderTextColor={Colors.slate400} />
              </Field>
            </View>
          )}

          <Field label="Status">
            <View style={s.pickerRow}>
              {STATUS_OPTIONS.map(st => (
                <TouchableOpacity key={st} style={[s.pickChip, form.status === st && s.pickChipActive]} onPress={() => set('status', st)}>
                  <Text style={[s.pickChipText, form.status === st && s.pickChipTextActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Total Pax">
            <TextInput style={s.input} value={form.pax} onChangeText={v => set('pax', v)} keyboardType="number-pad" placeholder="16" placeholderTextColor={Colors.slate400} />
          </Field>

          <View style={s.row2}>
            <Field label="Male (total)" flex={1}>
              <TextInput style={s.input} value={form.male} onChangeText={v => set('male', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.slate400} />
            </Field>
            <Field label="Female (total)" flex={1}>
              <TextInput style={s.input} value={form.female} onChangeText={v => set('female', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.slate400} />
            </Field>
          </View>

          <Field label="Double Sharing Rooms (2 per room)">
            <DSPairsEditor pairs={form.doubleSharingPairs} onChange={v => set('doubleSharingPairs', v)} />
          </Field>

          <Field label="Other Room Types (3-sharing, 4-sharing, dorm)">
            <RoomGroupsEditor rooms={form.sharingRooms} onChange={v => set('sharingRooms', v)} />
          </Field>

          <Button title={initial ? 'Save Changes' : 'Add Entry'} onPress={submit} loading={saving} />
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <View style={[{ gap: 6, marginBottom: 14 }, flex ? { flex } : undefined]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.slate900 },
  form: { padding: 16, paddingBottom: 40 },
  row2: { flexDirection: 'row', gap: 12 },

  label: { fontSize: 12, fontWeight: '700', color: Colors.slate600, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 13, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },

  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.slate100 },
  chipActive: { backgroundColor: '#4f46e5' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.slate700 },
  chipTextActive: { color: Colors.white },

  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white },
  pickChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pickChipText: { fontSize: 12, fontWeight: '700', color: Colors.slate600 },
  pickChipTextActive: { color: Colors.white },
});
