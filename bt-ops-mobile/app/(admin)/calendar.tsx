import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, Pill, EmptyState, STATUS_STYLE, PRIORITY_STYLE } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';

interface Batch { id: string; batchCode: string; startDate: string; endDate: string; status: string; }
interface Task  { id: string; title: string; dueDate?: string; priority: string; status: string; }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const LEGEND = [
  { label: 'Trek Batch',  color: '#3b82f6' },
  { label: 'Urgent Task', color: '#ef4444' },
  { label: 'High Task',   color: '#f97316' },
  { label: 'Task Due',    color: '#22c55e' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarScreen() {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selected, setSelected] = useState<string>(() => iso(new Date()));
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/batches/my');
      setBatches(r.data);
    } catch {}
    try {
      const r = await api.get('/tickets', { params: { limit: 500 } });
      setTasks(r.data.tickets ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  /** Map of YYYY-MM-DD → marker colours */
  const marks = useMemo(() => {
    const m: Record<string, string[]> = {};
    const push = (day: string, color: string) => {
      if (!day) return;
      const key = day.slice(0, 10);
      if (!m[key]) m[key] = [];
      if (!m[key].includes(color)) m[key].push(color);
    };
    batches.forEach(b => {
      const start = new Date(b.startDate); const end = new Date(b.endDate);
      if (isNaN(+start)) return;
      const last = isNaN(+end) ? start : end;
      for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 1)) push(iso(d), '#3b82f6');
    });
    tasks.forEach(t => {
      if (!t.dueDate || t.status === 'Done') return;
      push(t.dueDate, t.priority === 'Urgent' ? '#ef4444' : t.priority === 'High' ? '#f97316' : '#22c55e');
    });
    return m;
  }, [batches, tasks]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = Array(first).fill(null);
    for (let i = 1; i <= days; i++) cells.push(iso(new Date(year, month, i)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const todayIso = iso(new Date());

  const dayBatches = batches.filter(b => selected >= b.startDate?.slice(0, 10) && selected <= (b.endDate ?? b.startDate)?.slice(0, 10));
  const dayTasks = tasks.filter(t => t.dueDate?.slice(0, 10) === selected && t.status !== 'Done');

  const shift = (n: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <PageTitle title="Calendar" subtitle="View your batches and task deadlines" />

        <Panel style={{ marginTop: 14 }} padding={0}>
          <View style={s.monthBar}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={12} style={s.arrow}>
              <Ionicons name="chevron-back" size={20} color={Colors.slate500} />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
            <TouchableOpacity onPress={() => shift(1)} hitSlop={12} style={s.arrow}>
              <Ionicons name="chevron-forward" size={20} color={Colors.slate500} />
            </TouchableOpacity>
          </View>

          <View style={s.dowRow}>
            {DOW.map(d => <Text key={d} style={s.dow}>{d}</Text>)}
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 40 }} />
          ) : (
            <View style={s.grid}>
              {grid.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={s.cell} />;
                const n = Number(day.slice(8, 10));
                const dots = marks[day] ?? [];
                const isToday = day === todayIso;
                const isSel = day === selected;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.cell, isSel && s.cellSelected]}
                    onPress={() => setSelected(day)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.dayCircle, isToday && s.dayToday]}>
                      <Text style={[s.dayText, isToday && s.dayTextToday, isSel && !isToday && { color: Colors.primary, fontWeight: '800' }]}>{n}</Text>
                    </View>
                    <View style={s.dotRow}>
                      {dots.slice(0, 3).map((c, di) => <View key={di} style={[s.dot, { backgroundColor: c }]} />)}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={s.legend}>
            {LEGEND.map(l => (
              <View key={l.label} style={s.legendItem}>
                <View style={[s.dot, { backgroundColor: l.color }]} />
                <Text style={s.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </Panel>

        <Panel style={{ marginTop: 14 }} padding={0}>
          <View style={s.detailHeader}>
            <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
            <Text style={s.detailTitle}>
              {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={{ padding: 14, gap: 10 }}>
            {dayBatches.length === 0 && dayTasks.length === 0 ? (
              <EmptyState icon="calendar-outline" title="Nothing on this day" message="No batches running and no tasks due." />
            ) : (
              <>
                {dayBatches.map(b => {
                  const st = STATUS_STYLE[b.status] ?? { color: Colors.slate700, bg: Colors.slate100 };
                  return (
                    <View key={b.id} style={s.itemRow}>
                      <View style={[s.itemBar, { backgroundColor: '#3b82f6' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{b.batchCode}</Text>
                        <Text style={s.itemSub}>Trek batch</Text>
                      </View>
                      <Pill label={b.status} color={st.color} bg={st.bg} />
                    </View>
                  );
                })}
                {dayTasks.map(t => {
                  const pr = PRIORITY_STYLE[t.priority] ?? { color: Colors.slate500, bg: Colors.slate100 };
                  return (
                    <View key={t.id} style={s.itemRow}>
                      <View style={[s.itemBar, { backgroundColor: pr.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle} numberOfLines={1}>{t.title}</Text>
                        <Text style={s.itemSub}>Task due</Text>
                      </View>
                      <Pill label={t.priority} color={pr.color} bg={pr.bg} />
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </Panel>
      </ScrollView>
    </AppShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },

  monthBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 14 },
  arrow:      { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: Colors.slate900 },

  dowRow: { flexDirection: 'row', paddingBottom: 6 },
  dow:    { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: Colors.slate400 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cell:         { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 0.5, borderColor: Colors.slate100 },
  cellSelected: { backgroundColor: Colors.primaryBg },
  dayCircle:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayToday:     { backgroundColor: Colors.gradientBlueTo },
  dayText:      { fontSize: 13, color: Colors.slate700, fontWeight: '500' },
  dayTextToday: { color: Colors.white, fontWeight: '800' },
  dotRow:       { flexDirection: 'row', gap: 2, height: 5 },
  dot:          { width: 5, height: 5, borderRadius: 2.5 },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: Colors.slate100 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, color: Colors.slate500 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  detailTitle:  { fontSize: 14, fontWeight: '800', color: Colors.slate900 },

  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate100, padding: 12 },
  itemBar:   { width: 3, height: 30, borderRadius: 2 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  itemSub:   { fontSize: 11, color: Colors.slate400, marginTop: 2 },
});
