import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ScrollView, Modal, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Trek {
  id: string;
  name: string;
  region: string;
  distanceFromBengaluru: string;
  trekDistance: string;
  altitude: string;
  difficultyLevel: string;
  bestTimeToVisit: string;
  meetingPoint: string;
  reportingTime: string;
  requiredPermissions?: string;
  vendorNotes?: string;
  internalNotes?: string;
  trekType: string;
  category: string;
  archived: boolean;
}

const EMPTY: Omit<Trek, 'id' | 'archived'> = {
  name: '', region: '', distanceFromBengaluru: '', trekDistance: '', altitude: '',
  difficultyLevel: '', bestTimeToVisit: '', meetingPoint: '', reportingTime: '',
  requiredPermissions: '', vendorNotes: '', internalNotes: '', trekType: '', category: '',
};

const FIELDS: { key: keyof typeof EMPTY; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Trek Name' },
  { key: 'region', label: 'Region' },
  { key: 'category', label: 'Category (e.g. Karnataka, Himalayas)' },
  { key: 'trekType', label: 'Trek Type (e.g. 1-day, 2-day)' },
  { key: 'difficultyLevel', label: 'Difficulty (Easy/Moderate/Difficult/Very Difficult)' },
  { key: 'distanceFromBengaluru', label: 'Distance from Bengaluru' },
  { key: 'trekDistance', label: 'Trek Distance' },
  { key: 'altitude', label: 'Altitude' },
  { key: 'bestTimeToVisit', label: 'Best Time to Visit' },
  { key: 'meetingPoint', label: 'Meeting Point' },
  { key: 'reportingTime', label: 'Reporting Time' },
  { key: 'requiredPermissions', label: 'Required Permissions', multiline: true },
  { key: 'vendorNotes', label: 'Vendor Notes', multiline: true },
  { key: 'internalNotes', label: 'Internal Notes', multiline: true },
];

export function TrekMasterModal({ onClose }: { onClose: () => void }) {
  const [treks, setTreks] = useState<Trek[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Trek | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/treks', { params: { include_archived: true } }).then(r => setTreks(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (t: Trek | 'new') => {
    if (t === 'new') setForm(EMPTY);
    else setForm({ ...EMPTY, ...t } as any);
    setEditing(t);
  };

  const save = async () => {
    if (!form.name?.trim()) { Alert.alert('Name required', 'Enter a trek name.'); return; }
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.post('/treks', form);
      } else if (editing) {
        await api.patch(`/treks/${editing.id}`, form);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save trek');
    } finally { setSaving(false); }
  };

  const toggleArchive = async (t: Trek) => {
    try {
      await api.patch(`/treks/${t.id}`, { archived: !t.archived });
      load();
    } catch { Alert.alert('Error', 'Could not update trek'); }
  };

  const visible = treks.filter(t => showArchived || !t.archived);

  if (editing) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalSafeArea style={s.safe}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setEditing(null)} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
            </TouchableOpacity>
            <Text style={s.title}>{editing === 'new' ? 'New Trek' : 'Edit Trek'}</Text>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {FIELDS.map(f => (
              <View key={f.key} style={s.field}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput
                  style={[s.input, f.multiline && s.textarea]}
                  multiline={f.multiline}
                  value={form[f.key] ?? ''}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholderTextColor={Colors.gray400}
                />
              </View>
            ))}
            <Button title={editing === 'new' ? 'Create Trek' : 'Save Changes'} onPress={save} loading={saving} />
          </ScrollView>
        </ModalSafeArea>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={s.title}>Trek Master</Text>
          <Text style={s.count}>{visible.length}</Text>
        </View>

        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Show archived</Text>
          <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: Colors.primary }} />
        </View>

        {loading ? (
          <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={t => t.id}
            contentContainerStyle={s.list}
            renderItem={({ item: t }) => (
              <TouchableOpacity onPress={() => openEdit(t)} activeOpacity={0.85}>
                <Card padding={14} style={[{ marginBottom: 10 }, t.archived && { opacity: 0.5 }]}>
                  <View style={s.rowBetween}>
                    <Text style={s.trekName}>{t.name}</Text>
                    <TouchableOpacity onPress={() => toggleArchive(t)} style={{ padding: 4 }}>
                      <Ionicons name={t.archived ? 'refresh-outline' : 'archive-outline'} size={18} color={Colors.gray500} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.trekMeta}>{t.region}  •  {t.difficultyLevel}  •  {t.trekType}</Text>
                </Card>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.empty}>No treks found</Text>}
          />
        )}

        <TouchableOpacity style={s.fab} onPress={() => openEdit('new')}>
          <Ionicons name="add" size={26} color={Colors.white} />
        </TouchableOpacity>
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.gray50 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.gray900, flex: 1 },
  count:   { fontSize: 13, color: Colors.gray500, backgroundColor: Colors.gray100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  toggleLabel: { fontSize: 13, color: Colors.gray600, fontWeight: '500' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:    { padding: 16, paddingBottom: 90 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trekName:{ fontSize: 15, fontWeight: '700', color: Colors.gray900, flex: 1 },
  trekMeta:{ fontSize: 12, color: Colors.gray500, marginTop: 4 },
  empty:   { textAlign: 'center', color: Colors.gray400, padding: 40 },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  content: { padding: 16, paddingBottom: 40 },
  field:   { gap: 6, marginBottom: 14 },
  label:   { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:   { minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.white },
  textarea:{ minHeight: 70, textAlignVertical: 'top' },
});
