import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  useEffect(() => {
    api.get('/trek-watcher/districts').then(r => setDistricts(r.data)).catch(() => {});
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

  const running = watchers.filter(w => ['starting','running','available'].includes(w.status)).length;

  return (
    <SafeAreaView style={s.safe}>
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

        {/* Watcher list */}
        <Text style={s.sectionTitle}>Watchers ({watchers.length})</Text>
        {watchers.map(w => (
          <Card key={w.job_id} padding={14} style={[s.watchCard, w.status === 'available' && s.watchCardAvail]}>
            <View style={s.watchTop}>
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
              <MetaChip icon="time-outline"       value={`${w.interval}s`} />
              {w.last_alerted && <MetaChip icon="notifications-outline" value={fmtTime(w.last_alerted)} color={Colors.success} />}
            </View>
            {['starting','running','available'].includes(w.status) && (
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
    </SafeAreaView>
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

  watchCard:      {},
  watchCardAvail: { backgroundColor: Colors.successBg, borderColor: Colors.success + '40' },
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
