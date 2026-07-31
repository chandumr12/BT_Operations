import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import {
  PLACES, PRESET_CODES, PKG, STATUS_OPTIONS,
  DSPairsEditor, RoomGroupsEditor,
  Stay, DSPair, RoomGroup,
} from './HotelStayShared';

const PLACE_DEFAULT_STATUS: Record<string, string> = {
  Haridwar: '1N', Barkot: 'CHECK-IN', Uttarakashi: 'CHECK-IN', Guptakashi: 'CHECK-IN',
  Kedarnath: '1N', 'Mandal/Chopta': '1N', 'Joshimath-Badrinath': '1N', Rishikesh: '1N',
};

interface NightEntry { id?: string; date: string; pax: string; status: string }
type NightsMap = Record<string, { enabled: boolean; entries: NightEntry[] }>;

export interface BatchOps {
  toCreate: Record<string, unknown>[];
  toUpdate: { id: string; data: Record<string, unknown> }[];
  toDelete: string[];
}

function blankNight(status: string): NightEntry { return { date: '', pax: '', status }; }

function buildInitialNights(existing: Stay[]): NightsMap {
  const map: NightsMap = {};
  for (const place of PLACES) {
    const ents = existing.filter(e => e.place === place).sort((a, b) => a.date.localeCompare(b.date));
    map[place] = {
      enabled: ents.length > 0,
      entries: ents.length ? ents.map(e => ({ id: e.id, date: e.date, pax: String(e.pax ?? ''), status: e.status })) : [blankNight(PLACE_DEFAULT_STATUS[place])],
    };
  }
  return map;
}

/**
 * Mirrors frontend/src/pages/HotelStays.js `AddBatchModal` (create) and the
 * per-place night editing inside `BatchManager.saveBatch()` (edit) — one
 * form to add or update a whole batch's nights across all 8 places in one
 * go, plus shared double-sharing / other-room breakdowns.
 *
 * Vehicle allocation, lead assignment and document uploads from the
 * desktop BatchManager are handled by their own dedicated screens
 * (Vehicle Allocation, Meet the Team) and aren't duplicated here.
 */
export function AddBatchModal({ mode, code: initCode, serial: initSerial, existingEntries, nextSerial, onSave, onCancel, saving }: {
  mode: 'create' | 'edit';
  code?: string;
  serial?: number;
  existingEntries?: Stay[];
  nextSerial: number;
  onSave: (ops: BatchOps) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const first = existingEntries?.[0];
  const isPresetCode = first ? ['K', 'T', 'C'].includes(first.code) : true;

  const [serial, setSerial] = useState(String(mode === 'edit' ? initSerial : nextSerial));
  const [codePreset, setCodePreset] = useState(mode === 'edit' && first ? (isPresetCode ? first.code : 'custom') : 'K');
  const [codeCustom, setCodeCustom] = useState(mode === 'edit' && first && !isPresetCode ? first.code : '');
  const [packageName, setPackageName] = useState(first?.packageName ?? '');
  const [male, setMale] = useState(first?.male ? String(first.male) : '');
  const [female, setFemale] = useState(first?.female ? String(first.female) : '');
  const [dsPairs, setDsPairs] = useState<DSPair[]>(first?.doubleSharingPairs ?? []);
  const [sharingRooms, setSharingRooms] = useState<RoomGroup[]>(first?.sharingRooms ?? []);
  const [nights, setNights] = useState<NightsMap>(() => buildInitialNights(existingEntries ?? []));

  const togglePlace = (place: string, enabled: boolean) => setNights(n => ({ ...n, [place]: { ...n[place], enabled } }));
  const setEntry = (place: string, idx: number, key: keyof NightEntry, val: string) =>
    setNights(n => ({ ...n, [place]: { ...n[place], entries: n[place].entries.map((e, i) => i === idx ? { ...e, [key]: val } : e) } }));
  const addNight = (place: string) =>
    setNights(n => {
      const last = n[place].entries[n[place].entries.length - 1];
      return { ...n, [place]: { ...n[place], entries: [...n[place].entries, blankNight(last?.status ?? PLACE_DEFAULT_STATUS[place])] } };
    });
  const removeNight = (place: string, idx: number) =>
    setNights(n => {
      const entries = n[place].entries.filter((_, i) => i !== idx);
      return { ...n, [place]: { ...n[place], entries: entries.length ? entries : [blankNight(PLACE_DEFAULT_STATUS[place])] } };
    });

  const enabledCount = useMemo(() => Object.values(nights).filter(n => n.enabled).length, [nights]);

  const submit = () => {
    const enabledPlaces = PLACES.filter(p => nights[p].enabled);
    if (!enabledPlaces.length) { Alert.alert('Enable at least one place'); return; }
    if (!serial.trim() || isNaN(Number(serial))) { Alert.alert('Valid batch serial required'); return; }
    const code = codePreset === 'custom' ? codeCustom.trim().toUpperCase() : codePreset;
    if (!code) { Alert.alert('Package code required'); return; }

    for (const place of enabledPlaces) {
      for (const [i, e] of nights[place].entries.entries()) {
        if (!e.date.trim()) { Alert.alert('Date required', `${place} — night ${i + 1}`); return; }
        if (!e.pax.trim() || isNaN(Number(e.pax))) { Alert.alert('Pax required', `${place} — night ${i + 1}`); return; }
      }
    }

    const shared = {
      code, packageName: codePreset === 'custom' ? packageName.trim() : (PKG[codePreset] ?? ''),
      male: male ? Number(male) : 0, female: female ? Number(female) : 0,
      doubleSharingPairs: dsPairs, doubleSharing: dsPairs.length, sharingRooms,
      clientNames: [] as string[],
    };
    const serialNum = Number(serial);

    const ops: BatchOps = { toCreate: [], toUpdate: [], toDelete: [] };
    for (const place of PLACES) {
      const { enabled, entries } = nights[place];
      const origIds = new Set((existingEntries ?? []).filter(e => e.place === place).map(e => e.id));
      const keepIds = new Set<string>();

      if (enabled) {
        for (const e of entries) {
          if (e.id) {
            keepIds.add(e.id);
            ops.toUpdate.push({ id: e.id, data: { ...shared, place, serial: serialNum, date: e.date, pax: Number(e.pax), status: e.status } });
          } else {
            ops.toCreate.push({ ...shared, place, serial: serialNum, date: e.date, pax: Number(e.pax), status: e.status });
          }
        }
      }
      for (const id of origIds) if (!keepIds.has(id)) ops.toDelete.push(id);
    }

    onSave(ops);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={10}><Ionicons name="arrow-back" size={22} color={Colors.slate900} /></TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>{mode === 'edit' ? `Edit Batch ${initSerial}` : 'Add New Batch'}</Text>
            <Text style={s.headerSub}>Fill all places for this batch in one go</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={s.headerBox}>
            <View style={s.row2}>
              <Field label="Batch Serial #" flex={1}>
                <TextInput style={s.input} value={serial} onChangeText={setSerial} keyboardType="number-pad" placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="Package" flex={1}>
                <View style={s.pickerRow}>
                  {PRESET_CODES.map(c => (
                    <TouchableOpacity key={c.value} style={[s.pickChip, codePreset === c.value && s.pickChipActive]} onPress={() => setCodePreset(c.value)}>
                      <Text style={[s.pickChipText, codePreset === c.value && s.pickChipTextActive]}>{c.value === 'custom' ? 'Custom' : c.value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>
            </View>

            {codePreset === 'custom' && (
              <View style={s.row2}>
                <Field label="Custom Code" flex={1}>
                  <TextInput style={s.input} value={codeCustom} onChangeText={v => setCodeCustom(v.toUpperCase())} maxLength={6} placeholder="e.g. SP" placeholderTextColor={Colors.slate400} />
                </Field>
                <Field label="Package Name" flex={1}>
                  <TextInput style={s.input} value={packageName} onChangeText={setPackageName} placeholder="e.g. Special 8D" placeholderTextColor={Colors.slate400} />
                </Field>
              </View>
            )}

            <View style={s.row2}>
              <Field label="Male (total)" flex={1}>
                <TextInput style={s.input} value={male} onChangeText={setMale} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.slate400} />
              </Field>
              <Field label="Female (total)" flex={1}>
                <TextInput style={s.input} value={female} onChangeText={setFemale} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.slate400} />
              </Field>
            </View>

            <Field label="Double Sharing Rooms (2 per room)">
              <DSPairsEditor pairs={dsPairs} onChange={setDsPairs} />
            </Field>
            <Field label="Other Room Types (3-sharing, 4-sharing, dorm)">
              <RoomGroupsEditor rooms={sharingRooms} onChange={setSharingRooms} />
            </Field>
          </View>

          <Text style={s.sectionLabel}>PLACES & NIGHTS · {enabledCount} enabled</Text>

          {PLACES.map(place => {
            const { enabled, entries } = nights[place];
            return (
              <View key={place} style={[s.placeBox, enabled && s.placeBoxActive]}>
                <View style={s.placeHeader}>
                  <Switch value={enabled} onValueChange={v => togglePlace(place, v)} trackColor={{ true: '#4f46e5', false: Colors.slate200 }} thumbColor={Colors.white} />
                  <Text style={[s.placeName, enabled && s.placeNameActive]}>{place}</Text>
                  {enabled && <Text style={s.nightCount}>{entries.length} night{entries.length > 1 ? 's' : ''}</Text>}
                </View>

                {enabled && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {entries.map((entry, idx) => (
                      <View key={idx} style={s.nightBox}>
                        <View style={s.nightTop}>
                          <Text style={s.nightLabel}>Night {idx + 1}</Text>
                          {entries.length > 1 && (
                            <TouchableOpacity onPress={() => removeNight(place, idx)} hitSlop={8}>
                              <Ionicons name="close" size={13} color={Colors.slate400} />
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={s.row2}>
                          <Field label="Date" flex={1}>
                            <TextInput style={s.inputSm} value={entry.date} onChangeText={v => setEntry(place, idx, 'date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.slate400} />
                          </Field>
                          <Field label="Pax" flex={1}>
                            <TextInput style={s.inputSm} value={entry.pax} onChangeText={v => setEntry(place, idx, 'pax', v)} keyboardType="number-pad" placeholder="16" placeholderTextColor={Colors.slate400} />
                          </Field>
                        </View>
                        <View style={s.pickerRow}>
                          {STATUS_OPTIONS.map(st => (
                            <TouchableOpacity key={st} style={[s.pickChipSm, entry.status === st && s.pickChipActive]} onPress={() => setEntry(place, idx, 'status', st)}>
                              <Text style={[s.pickChipTextSm, entry.status === st && s.pickChipTextActive]}>{st}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity style={s.addNightBtn} onPress={() => addNight(place)} activeOpacity={0.8}>
                      <Ionicons name="add" size={12} color="#4f46e5" />
                      <Text style={s.addNightText}>Add another night</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button title={mode === 'edit' ? 'Save Batch' : `Save Batch #${serial}`} onPress={submit} loading={saving} style={{ flex: 1 }} />
            <Button title="Cancel" onPress={onCancel} variant="outline" style={{ flex: 0, paddingHorizontal: 20 }} />
          </View>
        </ScrollView>
      </ModalSafeArea>
    </Modal>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <View style={[{ gap: 5, marginBottom: 10 }, flex ? { flex } : undefined]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.slate900 },
  headerSub: { fontSize: 11.5, color: Colors.slate400, marginTop: 1 },
  form: { padding: 16, paddingBottom: 40 },
  row2: { flexDirection: 'row', gap: 10 },

  headerBox: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.slate100, padding: 14, marginBottom: 16 },

  label: { fontSize: 11, fontWeight: '700', color: Colors.slate600, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { minHeight: 42, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 12, fontSize: 13, color: Colors.slate900, backgroundColor: Colors.white },
  inputSm: { height: 36, borderRadius: 9, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 10, fontSize: 12.5, color: Colors.slate900, backgroundColor: Colors.white },

  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white },
  pickChipSm: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white },
  pickChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pickChipText: { fontSize: 11.5, fontWeight: '700', color: Colors.slate600 },
  pickChipTextSm: { fontSize: 10.5, fontWeight: '700', color: Colors.slate600 },
  pickChipTextActive: { color: Colors.white },

  sectionLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6, marginBottom: 10 },

  placeBox: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, padding: 10, marginBottom: 8 },
  placeBoxActive: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  placeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeName: { fontSize: 13, fontWeight: '600', color: Colors.slate500, flex: 1 },
  placeNameActive: { color: '#4338ca', fontWeight: '700' },
  nightCount: { fontSize: 10.5, color: '#6366f1', fontWeight: '700' },

  nightBox: { backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: '#e0e7ff', padding: 8, gap: 6 },
  nightTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nightLabel: { fontSize: 10, fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.4 },

  addNightBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#c7d2fe', borderStyle: 'dashed' },
  addNightText: { fontSize: 11, fontWeight: '700', color: '#4f46e5' },
});
