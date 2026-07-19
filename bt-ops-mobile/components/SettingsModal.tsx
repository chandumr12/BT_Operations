import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Config {
  categories: string[];
  difficultyLevels: string[];
  trekTypes: string[];
  batchStatuses: string[];
  taskCategories: string[];
}

const SECTIONS: { key: keyof Config; label: string }[] = [
  { key: 'categories', label: 'Trek Categories' },
  { key: 'difficultyLevels', label: 'Difficulty Levels' },
  { key: 'trekTypes', label: 'Trek Types' },
  { key: 'batchStatuses', label: 'Batch Statuses' },
  { key: 'taskCategories', label: 'Task Categories' },
];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/config').then(r => setConfig(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const addItem = (key: keyof Config) => {
    const val = (drafts[key] ?? '').trim();
    if (!val || !config) return;
    if (config[key].includes(val)) return;
    setConfig({ ...config, [key]: [...config[key], val] });
    setDrafts(prev => ({ ...prev, [key]: '' }));
  };

  const removeItem = (key: keyof Config, val: string) => {
    if (!config) return;
    setConfig({ ...config, [key]: config[key].filter(v => v !== val) });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.post('/config', config);
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch { Alert.alert('Error', 'Could not save settings'); } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={s.title}>Settings</Text>
        </View>

        {loading || !config ? (
          <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.content}>
            {SECTIONS.map(sec => (
              <Card key={sec.key} padding={16} style={{ gap: 10, marginBottom: 14 }}>
                <Text style={s.sectionTitle}>{sec.label}</Text>
                <View style={s.chipsWrap}>
                  {config[sec.key].map(v => (
                    <View key={v} style={s.chip}>
                      <Text style={s.chipText}>{v}</Text>
                      <TouchableOpacity onPress={() => removeItem(sec.key, v)}>
                        <Ionicons name="close-circle" size={15} color={Colors.gray400} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={s.addRow}>
                  <TextInput
                    style={s.input}
                    placeholder={`Add ${sec.label.toLowerCase()}…`}
                    placeholderTextColor={Colors.gray400}
                    value={drafts[sec.key] ?? ''}
                    onChangeText={v => setDrafts(prev => ({ ...prev, [sec.key]: v }))}
                    onSubmitEditing={() => addItem(sec.key)}
                  />
                  <TouchableOpacity onPress={() => addItem(sec.key)} style={s.addBtn}>
                    <Ionicons name="add" size={18} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
            <Button title="Save Settings" onPress={save} loading={saving} />
          </ScrollView>
        )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.gray50 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.gray900, flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray900 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.gray100, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  chipText:  { fontSize: 12, fontWeight: '600', color: Colors.gray700 },
  addRow:    { flexDirection: 'row', gap: 8 },
  input:     { flex: 1, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, fontSize: 13, color: Colors.gray900, backgroundColor: Colors.white },
  addBtn:    { width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
