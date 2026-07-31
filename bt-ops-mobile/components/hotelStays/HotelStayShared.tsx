import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

/**
 * Shared types, constants and small editors for the Hotel Stay Planner,
 * ported from frontend/src/pages/HotelStays.js. The real `/hotel-stays`
 * records use this shape (place/date/serial/code/packageName/pax/status/
 * male/female/doubleSharingPairs/sharingRooms) — the mobile screen
 * previously used a different ad-hoc shape (hotel/rooms/batchCode/contact)
 * that didn't match what the web app actually reads and writes.
 */

export const PLACES = [
  'Haridwar', 'Barkot', 'Uttarakashi', 'Guptakashi',
  'Kedarnath', 'Mandal/Chopta', 'Joshimath-Badrinath', 'Rishikesh',
];

export const PRESET_CODES = [
  { value: 'K', label: 'K — Kedarnath 7D' },
  { value: 'T', label: 'T — KBT 9D' },
  { value: 'C', label: 'C — Chardham 11D' },
  { value: 'custom', label: 'Custom…' },
];

export const PKG: Record<string, string> = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };
export const STATUS_OPTIONS = ['CHECK-IN', 'CHECK-OUT', '1N'];

export const ROOM_TYPES: { value: '3' | '4' | 'dorm'; label: string; capacity: number }[] = [
  { value: '3', label: '3-Sharing', capacity: 3 },
  { value: '4', label: '4-Sharing', capacity: 4 },
  { value: 'dorm', label: 'Dorm', capacity: 8 },
];
export const ROOM_TYPE_COLORS: Record<string, { bg: string; border: string; title: string }> = {
  '3':    { bg: '#f0fdf4', border: '#bbf7d0', title: '#047857' },
  '4':    { bg: '#f0f9ff', border: '#bae6fd', title: '#0369a1' },
  dorm:   { bg: '#fffbeb', border: '#fde68a', title: '#b45309' },
};

export function slugify(place: string) {
  return place.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
}

export function statusClass(status: string) {
  if (status === 'CHECK-IN') return { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a' };
  if (status === 'CHECK-OUT') return { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb' };
  return { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c' };
}

export interface DSPair { name1: string; gender1: 'M' | 'F'; name2: string; gender2: 'M' | 'F' }
export interface RoomPerson { name: string; gender: 'M' | 'F' }
export interface RoomGroup { type: '3' | '4' | 'dorm'; capacity: number; people: RoomPerson[] }

export interface Stay {
  id: string;
  place: string;
  date: string;
  serial: number;
  code: string;
  packageName?: string;
  pax: number;
  status: string;
  male?: number;
  female?: number;
  doubleSharingPairs?: DSPair[];
  doubleSharing?: number;
  sharingRooms?: RoomGroup[];
  clientNames?: string[];
}

export function emptyPair(): DSPair { return { name1: '', gender1: 'M', name2: '', gender2: 'F' }; }
export function emptyRoomGroup(type: '3' | '4' | 'dorm'): RoomGroup {
  const info = ROOM_TYPES.find(t => t.value === type) ?? ROOM_TYPES[0];
  return { type, capacity: info.capacity, people: Array.from({ length: info.capacity }, (_, i) => ({ name: '', gender: i % 2 === 0 ? 'F' : 'M' })) };
}

export function fmtShort(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ── Double sharing pairs editor ─────────────────────────────────────── */
export function DSPairsEditor({ pairs, onChange }: { pairs: DSPair[]; onChange: (p: DSPair[]) => void }) {
  const addPair = () => onChange([...pairs, emptyPair()]);
  const removePair = (idx: number) => onChange(pairs.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof DSPair, val: string) =>
    onChange(pairs.map((p, i) => i === idx ? { ...p, [field]: val } : p));

  return (
    <View style={{ gap: 8 }}>
      {pairs.map((pair, idx) => (
        <View key={idx} style={h.dsPairBox}>
          <View style={h.dsPairHeader}>
            <Text style={h.dsPairTitle}>Room {idx + 1}</Text>
            <TouchableOpacity onPress={() => removePair(idx)} hitSlop={8}>
              <Ionicons name="close" size={14} color={Colors.slate400} />
            </TouchableOpacity>
          </View>
          {(['1', '2'] as const).map(n => (
            <View key={n} style={h.personRow}>
              <GenderToggle value={pair[`gender${n}` as 'gender1' | 'gender2']} onChange={v => update(idx, `gender${n}` as any, v)} />
              <TextInput
                style={h.personInput}
                value={pair[`name${n}` as 'name1' | 'name2']}
                onChangeText={v => update(idx, `name${n}` as any, v)}
                placeholder={`Person ${n} name`}
                placeholderTextColor={Colors.slate400}
              />
            </View>
          ))}
        </View>
      ))}
      <TouchableOpacity style={h.dashedBtn} onPress={addPair} activeOpacity={0.8}>
        <Ionicons name="add" size={13} color="#7c3aed" />
        <Text style={h.dashedBtnTextPurple}>Add Double Sharing Room</Text>
      </TouchableOpacity>
    </View>
  );
}

function GenderToggle({ value, onChange }: { value: 'M' | 'F'; onChange: (v: 'M' | 'F') => void }) {
  return (
    <View style={h.genderToggle}>
      {(['M', 'F'] as const).map(g => (
        <TouchableOpacity
          key={g}
          style={[h.genderOpt, value === g && (g === 'M' ? h.genderOptM : h.genderOptF)]}
          onPress={() => onChange(g)}
        >
          <Text style={[h.genderOptText, value === g && { color: Colors.white }]}>{g}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ── 3-sharing / 4-sharing / dorm room editor ────────────────────────── */
export function RoomGroupsEditor({ rooms, onChange }: { rooms: RoomGroup[]; onChange: (r: RoomGroup[]) => void }) {
  const [addType, setAddType] = useState<'3' | '4' | 'dorm'>('3');

  const addRoom = () => onChange([...rooms, emptyRoomGroup(addType)]);
  const removeRoom = (ri: number) => onChange(rooms.filter((_, i) => i !== ri));
  const updatePerson = (ri: number, pi: number, field: keyof RoomPerson, val: string) =>
    onChange(rooms.map((r, i) => i !== ri ? r : { ...r, people: r.people.map((p, j) => j !== pi ? p : { ...p, [field]: val }) }));
  const addPersonToDorm = (ri: number) =>
    onChange(rooms.map((r, i) => i !== ri ? r : { ...r, people: [...r.people, { name: '', gender: 'F' }] }));
  const removePersonFromDorm = (ri: number, pi: number) =>
    onChange(rooms.map((r, i) => i !== ri ? r : { ...r, people: r.people.filter((_, j) => j !== pi) }));

  return (
    <View style={{ gap: 8 }}>
      {rooms.map((room, ri) => {
        const c = ROOM_TYPE_COLORS[room.type];
        const label = room.type === 'dorm' ? 'Dorm' : `${room.type}-Sharing`;
        return (
          <View key={ri} style={[h.roomBox, { backgroundColor: c.bg, borderColor: c.border }]}>
            <View style={h.roomHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={[h.roomBadge, { backgroundColor: c.border }]}><Text style={[h.roomBadgeText, { color: c.title }]}>{label}</Text></View>
                <Text style={h.roomFilled}>{room.people.filter(p => p.name.trim()).length}/{room.people.length} filled</Text>
              </View>
              <TouchableOpacity onPress={() => removeRoom(ri)} hitSlop={8}>
                <Ionicons name="close" size={14} color={Colors.slate400} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 6, marginTop: 6 }}>
              {room.people.map((person, pi) => (
                <View key={pi} style={h.personRow}>
                  <Text style={h.personNo}>{pi + 1}</Text>
                  <GenderToggle value={person.gender} onChange={v => updatePerson(ri, pi, 'gender', v)} />
                  <TextInput
                    style={[h.personInput, { flex: 1 }]}
                    value={person.name}
                    onChangeText={v => updatePerson(ri, pi, 'name', v)}
                    placeholder={`Person ${pi + 1}`}
                    placeholderTextColor={Colors.slate400}
                  />
                  {room.type === 'dorm' && (
                    <TouchableOpacity onPress={() => removePersonFromDorm(ri, pi)} hitSlop={8}>
                      <Ionicons name="close" size={12} color={Colors.slate300} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {room.type === 'dorm' && (
                <TouchableOpacity onPress={() => addPersonToDorm(ri)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="add" size={11} color="#b45309" />
                  <Text style={h.addPersonText}>Add person</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={h.typePickerRow}>
          {ROOM_TYPES.map(t => (
            <TouchableOpacity key={t.value} style={[h.typeOpt, addType === t.value && h.typeOptActive]} onPress={() => setAddType(t.value)}>
              <Text style={[h.typeOptText, addType === t.value && h.typeOptTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={h.dashedBtn} onPress={addRoom} activeOpacity={0.8}>
          <Ionicons name="add" size={13} color="#7c3aed" />
          <Text style={h.dashedBtnTextPurple}>Add Room</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  dsPairBox: { backgroundColor: '#faf5ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 12, padding: 10, gap: 6 },
  dsPairHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dsPairTitle: { fontSize: 10, fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personNo: { fontSize: 10, color: Colors.slate400, width: 14, textAlign: 'center' },
  personInput: { flex: 1, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.white, paddingHorizontal: 10, fontSize: 12, color: Colors.slate900 },

  genderToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.slate200 },
  genderOpt: { width: 26, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  genderOptM: { backgroundColor: '#3b82f6' },
  genderOptF: { backgroundColor: '#ec4899' },
  genderOptText: { fontSize: 10, fontWeight: '800', color: Colors.slate500 },

  dashedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#d8b4fe', borderStyle: 'dashed', flex: 1 },
  dashedBtnTextPurple: { fontSize: 11.5, fontWeight: '700', color: '#7c3aed' },

  roomBox: { borderWidth: 1, borderRadius: 12, padding: 10 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roomBadgeText: { fontSize: 10, fontWeight: '800' },
  roomFilled: { fontSize: 10, color: Colors.slate400, fontWeight: '600' },
  addPersonText: { fontSize: 10.5, color: '#b45309', fontWeight: '700' },

  typePickerRow: { flexDirection: 'row', gap: 4, backgroundColor: Colors.slate100, borderRadius: 9, padding: 2 },
  typeOpt: { paddingHorizontal: 8, paddingVertical: 7, borderRadius: 7 },
  typeOptActive: { backgroundColor: Colors.white },
  typeOptText: { fontSize: 10.5, fontWeight: '700', color: Colors.slate500 },
  typeOptTextActive: { color: Colors.slate900 },
});
