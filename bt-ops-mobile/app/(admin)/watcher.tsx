import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { AppShell } from '@/components/AppShell';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface District { id: string; name: string; }
interface Trek      { id: string; name: string; }
interface Watcher   {
  job_id: string; trek_name: string; date: string; status: string;
  last_info: string; checks: number; last_checked: string | null;
  interval: number; last_alerted: string | null; started_by: string;
}

const MAX_NUMBERS = 5;
const STOPPABLE = ['starting', 'running', 'available'];

const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function WatcherScreen() {
  const [districts,      setDistricts]      = useState<District[]>([]);
  const [treks,          setTreks]          = useState<Trek[]>([]);
  const [watchers,       setWatchers]       = useState<Watcher[]>([]);
  const [lastAlert,      setLastAlert]      = useState<any>(null);
  const [loadingTreks,   setLoadingTreks]   = useState(false);
  const [starting,       setStarting]       = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);

  const [districtId,     setDistrictId]     = useState('');
  const [trekId,         setTrekId]         = useState('');
  const [trekName,       setTrekName]       = useState('');
  const [date,           setDate]           = useState('');
  const [durationHours,  setDurationHours]  = useState('2');
  const [intervalSecs,   setIntervalSecs]   = useState('30');

  // WhatsApp alert numbers
  const [notifyNumbers,  setNotifyNumbers]  = useState<string[]>([]);
  const [numInput,       setNumInput]       = useState('');
  const [savingNums,     setSavingNums]     = useState(false);
  const [testing,        setTesting]        = useState(false);

  // Bulk-select / clear history
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [clearing,       setClearing]       = useState(false);

  useEffect(() => {
    api.get('/trek-watcher/districts').then(r => setDistricts(r.data)).catch(() => {});
    api.get('/trek-watcher/settings').then(r => setNotifyNumbers(r.data?.notify_numbers ?? [])).catch(() => {});
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(() => {
    api.get('/trek-watcher/status').then(r => setWatchers(r.data)).catch(() => {});
    api.get('/trek-watcher/last-alert').then(r => setLastAlert(r.data)).catch(() => {});
  }, []);

  const onDistrictChange = async (id: string) => {
    setDistrictId(id); setTrekId(''); setTrekName(''); setTreks([]);
    if (!id) return;
    setLoadingTreks(true);
    try { const r = await api.get(`/trek-watcher/treks/${id}`); setTreks(r.data); }
    catch { Alert.alert('Error', 'Could not load treks'); }
    finally { setLoadingTreks(false); }
  };

  const onTrekChange = (id: string) => {
    setTrekId(id);
    setTrekName(treks.find(t => t.id === id)?.name ?? '');
  };

  const startWatcher = async () => {
    if (!districtId || !trekId || !date) {
      Alert.alert('Missing fields', 'Select district, trek and enter a date (DD-MM-YYYY).');
      return;
    }
    setStarting(true);
    try {
      await api.post('/trek-watcher/start', {
        district_id: districtId, trek_id: trekId, trek_name: trekName,
        date, duration_hours: parseFloat(durationHours), interval_secs: parseInt(intervalSecs),
      });
      Alert.alert('Started', 'Watcher is now running!');
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Failed to start watcher');
    } finally { setStarting(false); }
  };

  const stopWatcher = async (job_id: string) => {
    try { await api.delete(`/trek-watcher/stop/${job_id}`); fetchAll(); }
    catch { Alert.alert('Error', 'Could not stop watcher'); }
  };

  const onRefresh = async () => { setRefreshing(true); fetchAll(); setRefreshing(false); };

  // ── Select / bulk clear history ──────────────────────────────────────────
  const toggleSelect = (job_id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(job_id) ? next.delete(job_id) : next.add(job_id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === watchers.length ? new Set() : new Set(watchers.map(w => w.job_id)));
  };

  const clearSelected = async () => {
    if (selectedIds.size === 0) return;
    setClearing(true);
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/trek-watcher/history/${id}`)));
      setSelectedIds(new Set());
      fetchAll();
    } catch { Alert.alert('Error', 'Failed to clear some watchers'); }
    finally { setClearing(false); }
  };

  // ── WhatsApp notify numbers ──────────────────────────────────────────────
  const addNumber = () => {
    const digits = numInput.replace(/\D/g, '');
    if (!digits || digits.length < 10) { Alert.alert('Invalid number', 'Enter a valid phone number'); return; }
    if (notifyNumbers.length >= MAX_NUMBERS) { Alert.alert('Limit reached', `Maximum ${MAX_NUMBERS} numbers allowed`); return; }
    if (notifyNumbers.includes(numInput.trim())) { Alert.alert('Duplicate', 'Number already added'); return; }
    setNotifyNumbers(n => [...n, numInput.trim()]);
    setNumInput('');
  };

  const removeNumber = (idx: number) => setNotifyNumbers(n => n.filter((_, i) => i !== idx));

  const saveNumbers = async () => {
    let toSave = [...notifyNumbers];
    if (numInput.trim()) {
      const digits = numInput.replace(/\D/g, '');
      if (digits.length >= 10 && toSave.length < MAX_NUMBERS && !toSave.includes(numInput.trim())) {
        toSave = [...toSave, numInput.trim()];
        setNotifyNumbers(toSave);
        setNumInput('');
      }
    }
    if (toSave.length === 0) { Alert.alert('Nothing to save', 'Add at least one number before saving'); return; }
    setSavingNums(true);
    try {
      await api.put('/trek-watcher/settings', { notify_numbers: toSave });
      Alert.alert('Saved', `Saved ${toSave.length} number(s)!`);
    } catch { Alert.alert('Error', 'Failed to save numbers'); }
    finally { setSavingNums(false); }
  };

  const testWhatsApp = async () => {
    if (notifyNumbers.length === 0) { Alert.alert('No numbers', 'Add and save at least one number first'); return; }
    setTesting(true);
    try {
      const r = await api.post('/trek-watcher/test-whatsapp');
      Alert.alert('Sent', `Test message sent to ${r.data.sent_to?.length ?? 0} number(s)!`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Test failed — check backend logs');
    } finally { setTesting(false); }
  };

  const running = watchers.filter(w => STOPPABLE.includes(w.status)).length;

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.pageTitle}>Trek Watcher</Text>
            <Text style={s.pageSub}>Aranya Vihaara ticket monitor</Text>
          </View>
          {running > 0 && (
            <View style={s.runningBadge}>
              <View style={s.runningDot} />
              <Text style={s.runningText}>{running} watching</Text>
            </View>
          )}
        </View>

        {/* Last Alert */}
        <Card padding={14} style={lastAlert ? s.alertCard : s.alertCardEmpty}>
          <View style={s.alertRow}>
            <Ionicons name="notifications" size={16} color={lastAlert ? Colors.success : Colors.gray400} />
            <View style={{ flex: 1 }}>
              <Text style={s.alertLabel}>Last Successful Alert</Text>
              {lastAlert ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  <Text style={s.alertTrek}>{lastAlert.trek_name}</Text>
                  <Text style={s.alertSlots}>{lastAlert.slots_info}</Text>
                  <Text style={s.alertTime}>{fmtTime(lastAlert.alerted_at)}</Text>
                </View>
              ) : (
                <Text style={s.alertEmpty}>No alert sent yet</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Start Watcher Form */}
        <Card padding={16} style={{ gap: 14 }}>
          <Text style={s.sectionTitle}>Add Watcher</Text>

          <View style={s.pickerBox}>
            <Text style={s.label}>District</Text>
            <View style={s.pickerWrap}>
              <Picker selectedValue={districtId} onValueChange={onDistrictChange} style={s.picker}>
                <Picker.Item label="Select district…" value="" />
                {districts.map(d => <Picker.Item key={d.id} label={d.name} value={d.id} />)}
              </Picker>
            </View>
          </View>

          <View style={s.pickerBox}>
            <Text style={s.label}>Trek</Text>
            <View style={[s.pickerWrap, (!districtId || loadingTreks) && { opacity: 0.5 }]}>
              <Picker selectedValue={trekId} onValueChange={onTrekChange} style={s.picker} enabled={!!districtId && !loadingTreks}>
                <Picker.Item label={loadingTreks ? 'Loading…' : 'Select trek…'} value="" />
                {treks.map(t => <Picker.Item key={t.id} label={t.name} value={t.id} />)}
              </Picker>
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Date (DD-MM-YYYY)</Text>
            <TextInput style={s.input} placeholder="13-06-2026" placeholderTextColor={Colors.gray400}
              value={date} onChangeText={setDate} />
          </View>

          <View style={s.row2}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Duration (hrs)</Text>
              <TextInput style={s.input} keyboardType="numeric" value={durationHours} onChangeText={setDurationHours} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Every (secs)</Text>
              <TextInput style={s.input} keyboardType="numeric" value={intervalSecs} onChangeText={setIntervalSecs} />
            </View>
          </View>

          <Button title="Start Watching" onPress={startWatcher} loading={starting} />
        </Card>

        {/* WhatsApp Alerts */}
        <Card padding={16} style={{ gap: 10 }}>
          <View style={s.waHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>WhatsApp Alerts</Text>
              <Text style={s.waSub}>Send ticket alert to these numbers (max {MAX_NUMBERS})</Text>
            </View>
            <Ionicons name="notifications-outline" size={18} color={Colors.gray400} />
          </View>

          {notifyNumbers.length === 0 ? (
            <Text style={s.emptyText}>No numbers added yet</Text>
          ) : (
            notifyNumbers.map((num, i) => (
              <View key={i} style={s.numRow}>
                <Ionicons name="call-outline" size={13} color={Colors.gray400} />
                <Text style={s.numText}>{num}</Text>
                <TouchableOpacity onPress={() => removeNumber(i)}>
                  <Ionicons name="trash-outline" size={15} color={Colors.gray300} />
                </TouchableOpacity>
              </View>
            ))
          )}

          {notifyNumbers.length < MAX_NUMBERS && (
            <View style={s.numAddRow}>
              <TextInput
                style={[s.input, { flex: 1 }]} placeholder="9876543210" keyboardType="phone-pad"
                placeholderTextColor={Colors.gray400} value={numInput} onChangeText={setNumInput}
                onSubmitEditing={addNumber}
              />
              <TouchableOpacity style={s.numAddBtn} onPress={addNumber}>
                <Ionicons name="add" size={18} color={Colors.gray600} />
              </TouchableOpacity>
            </View>
          )}

          <Button title={savingNums ? 'Saving…' : 'Save Numbers'} onPress={saveNumbers} loading={savingNums} />
          <Button title={testing ? 'Sending…' : 'Send Test Message'} onPress={testWhatsApp}
            loading={testing} disabled={notifyNumbers.length === 0} variant="outline" />
        </Card>

        {/* Watcher list */}
        <View style={s.waHeaderRow}>
          <Text style={s.sectionTitle}>Watchers ({watchers.length})</Text>
          {watchers.length > 0 && (
            <TouchableOpacity style={s.selectAllBtn} onPress={toggleSelectAll}>
              <Ionicons
                name={selectedIds.size === watchers.length ? 'checkbox' : 'square-outline'}
                size={16} color={selectedIds.size === watchers.length ? Colors.info : Colors.gray400}
              />
              <Text style={s.selectAllText}>Select all</Text>
            </TouchableOpacity>
          )}
        </View>
        {selectedIds.size > 0 && (
          <TouchableOpacity style={s.clearSelectedBtn} onPress={clearSelected} disabled={clearing}>
            {clearing ? <ActivityIndicator size="small" color={Colors.danger} /> : <Ionicons name="trash-outline" size={13} color={Colors.danger} />}
            <Text style={s.clearSelectedText}>{clearing ? 'Clearing…' : `Clear ${selectedIds.size} selected`}</Text>
          </TouchableOpacity>
        )}
        {watchers.map(w => (
          <Card key={w.job_id} padding={14} style={[s.watchCard, w.status === 'available' && s.watchCardAvail, selectedIds.has(w.job_id) && s.watchCardSelected]}>
            <View style={s.watchTop}>
              <TouchableOpacity onPress={() => toggleSelect(w.job_id)} style={{ paddingTop: 2 }}>
                <Ionicons name={selectedIds.has(w.job_id) ? 'checkbox' : 'square-outline'} size={18} color={selectedIds.has(w.job_id) ? Colors.info : Colors.gray300} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.watchTrek}>{w.trek_name}</Text>
                <Text style={s.watchDate}>{w.date}</Text>
              </View>
              <StatusBadge status={w.status} />
            </View>
            {w.status === 'available' && (
              <Text style={s.slotsText}>{w.last_info}</Text>
            )}
            <View style={s.watchMeta}>
              <MetaChip icon="refresh-outline"    value={`${w.checks} checks`} />
              <MetaChip icon="time-outline"       value={`every ${w.interval}s`} />
              <MetaChip icon="eye-outline"         value={`checked ${fmtTime(w.last_checked)}`} />
              {!!w.started_by && <MetaChip icon="person-outline" value={w.started_by} />}
              {w.last_alerted && <MetaChip icon="notifications-outline" value={fmtTime(w.last_alerted)} color={Colors.success} />}
            </View>
            {STOPPABLE.includes(w.status) && (
              <TouchableOpacity style={s.stopBtn} onPress={() => stopWatcher(w.job_id)}>
                <Ionicons name="stop-circle-outline" size={15} color={Colors.danger} />
                <Text style={s.stopText}>Stop</Text>
              </TouchableOpacity>
            )}
          </Card>
        ))}
        {watchers.length === 0 && (
          <View style={s.emptyWatcher}>
            <Ionicons name="eye-off-outline" size={36} color={Colors.gray300} />
            <Text style={s.emptyText}>No watchers yet</Text>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

function MetaChip({ icon, value, color = Colors.gray500 }: { icon: any; value: string; color?: string }) {
  return (
    <View style={mc.chip}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[mc.text, { color }]}>{value}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '500' },
});

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },

  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  pageSub:      { fontSize: 13, color: Colors.gray500, marginTop: 2 },
  runningBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.infoBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  runningDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.info },
  runningText:  { fontSize: 12, fontWeight: '600', color: Colors.info },

  alertCard:      { borderColor: Colors.successBg },
  alertCardEmpty: { borderColor: Colors.border },
  alertRow:   { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  alertLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertTrek:  { fontSize: 13, fontWeight: '700', color: Colors.gray900 },
  alertSlots: { fontSize: 13, fontWeight: '700', color: Colors.success },
  alertTime:  { fontSize: 12, color: Colors.gray500 },
  alertEmpty: { fontSize: 13, color: Colors.gray400, fontStyle: 'italic', marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  pickerBox:  { gap: 6 },
  pickerWrap: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.gray50 },
  picker:     { height: 48 },
  field:      { gap: 6 },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:      { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.gray900, backgroundColor: Colors.gray50 },
  row2:       { flexDirection: 'row', gap: 12 },

  waHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waSub:       { fontSize: 11, color: Colors.gray400, marginTop: 2 },
  numRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.gray50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  numText:     { flex: 1, fontSize: 13, color: Colors.gray700, fontVariant: ['tabular-nums'] },
  numAddRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  numAddBtn:   { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },

  selectAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectAllText: { fontSize: 12, fontWeight: '600', color: Colors.gray500 },
  clearSelectedBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.dangerBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  clearSelectedText: { fontSize: 12, fontWeight: '600', color: Colors.danger },

  watchCard:      {},
  watchCardAvail: { backgroundColor: Colors.successBg, borderColor: Colors.success + '40' },
  watchCardSelected: { borderColor: Colors.info, borderWidth: 1.5 },
  watchTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  watchTrek:  { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  watchDate:  { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  slotsText:  { fontSize: 16, fontWeight: '800', color: Colors.success, marginTop: 4 },
  watchMeta:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  stopBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, backgroundColor: Colors.dangerBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stopText:   { fontSize: 12, fontWeight: '600', color: Colors.danger },

  emptyWatcher: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText:    { color: Colors.gray400, fontSize: 14 },
});
