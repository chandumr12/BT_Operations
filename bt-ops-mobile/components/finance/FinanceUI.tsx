import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { inr, monthLabel } from '@/utils/finance';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/* ── KPI card — mirrors web `.card` (title / metric / sub) ─────────────── */
export function KpiCard({ title, value, sub, valueColor }: {
  title: string; value: React.ReactNode; sub?: string; valueColor?: string;
}) {
  return (
    <View style={k.card}>
      <Text style={k.title} numberOfLines={2}>{title}</Text>
      <Text style={[k.value, valueColor ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {!!sub && <Text style={k.sub} numberOfLines={2}>{sub}</Text>}
    </View>
  );
}

const k = StyleSheet.create({
  card: {
    flex: 1, minWidth: '46%',
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.slate100,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  title: { fontSize: 11.5, color: Colors.slate500, fontWeight: '600' },
  value: { fontSize: 21, fontWeight: '900', color: Colors.slate900, marginTop: 4 },
  sub:   { fontSize: 10.5, color: Colors.slate400, marginTop: 3, lineHeight: 14 },
});

/** Two-per-row grid of KPI cards. */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={k2.grid}>{children}</View>;
}
const k2 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

/* ── Section heading (web uses <h3>📈 Trek-wise Profit</h3>) ──────────── */
export function SectionTitle({ icon, title, right }: {
  icon?: IoniconName; title: string; right?: React.ReactNode;
}) {
  return (
    <View style={sc.row}>
      {icon && <Ionicons name={icon} size={16} color={Colors.gradientBlueTo} />}
      <Text style={sc.text}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}
const sc = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  text: { fontSize: 15, fontWeight: '800', color: Colors.slate900 },
});

/* ── Data table — horizontally scrollable, sticky-ish header ──────────── */
export interface Column {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'right';
  /** Render a custom cell; falls back to String(row[key]). */
  render?: (row: any) => React.ReactNode;
}

export function DataTable({ columns, rows, emptyText = 'No records' }: {
  columns: Column[]; rows: any[]; emptyText?: string;
}) {
  const total = columns.reduce((s, c) => s + (c.width ?? 120), 0);
  return (
    <View style={dt.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: total }}>
          {/* Header */}
          <View style={dt.headRow}>
            {columns.map(c => (
              <Text
                key={c.key}
                style={[
                  dt.headCell,
                  { width: c.width ?? 120 },
                  c.align === 'right' && dt.right,
                ]}
                numberOfLines={2}
              >
                {c.label}
              </Text>
            ))}
          </View>

          {/* Body */}
          {rows.length === 0 ? (
            <Text style={dt.empty}>{emptyText}</Text>
          ) : (
            rows.map((r, i) => (
              <View key={r.id ?? i} style={[dt.row, i % 2 === 1 && dt.rowAlt]}>
                {columns.map(c => (
                  <View key={c.key} style={[{ width: c.width ?? 120 }, c.align === 'right' && dt.rightBox]}>
                    {c.render
                      ? c.render(r)
                      : <Text style={[dt.cell, c.align === 'right' && dt.right]} numberOfLines={2}>
                          {r[c.key] ?? '—'}
                        </Text>}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const dt = StyleSheet.create({
  wrap:     { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.slate100, overflow: 'hidden' },
  headRow:  { flexDirection: 'row', backgroundColor: Colors.slate100, paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  headCell: { fontSize: 11, fontWeight: '800', color: Colors.slate700 },
  row:      { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 12, gap: 10, borderTopWidth: 1, borderTopColor: Colors.slate100, alignItems: 'center' },
  rowAlt:   { backgroundColor: Colors.slate50 },
  cell:     { fontSize: 12.5, color: Colors.slate700 },
  right:    { textAlign: 'right' },
  rightBox: { alignItems: 'flex-end' },
  empty:    { fontSize: 13, color: Colors.slate400, textAlign: 'center', paddingVertical: 26, fontStyle: 'italic' },
});

/* ── Pager — mirrors components/finance/Pager.js ──────────────────────── */
export function Pager({ page, setPage, totalPages, pageSize, setPageSize }: {
  page: number; setPage: (p: number) => void; totalPages: number;
  pageSize?: number; setPageSize?: (n: number) => void;
}) {
  return (
    <View style={pg.row}>
      {setPageSize && (
        <View style={pg.sizeRow}>
          <Text style={pg.sizeLabel}>Rows</Text>
          {[10, 20, 50].map(n => (
            <TouchableOpacity
              key={n}
              style={[pg.sizeBtn, pageSize === n && pg.sizeBtnActive]}
              onPress={() => { setPageSize(n); setPage(1); }}
            >
              <Text style={[pg.sizeText, pageSize === n && pg.sizeTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={[pg.navBtn, page <= 1 && pg.navBtnOff]}
        onPress={() => setPage(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        <Ionicons name="chevron-back" size={15} color={page <= 1 ? Colors.slate300 : Colors.slate700} />
      </TouchableOpacity>
      <Text style={pg.pageText}>{page} / {totalPages}</Text>
      <TouchableOpacity
        style={[pg.navBtn, page >= totalPages && pg.navBtnOff]}
        onPress={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        <Ionicons name="chevron-forward" size={15} color={page >= totalPages ? Colors.slate300 : Colors.slate700} />
      </TouchableOpacity>
    </View>
  );
}

const pg = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  sizeRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sizeLabel:    { fontSize: 11, color: Colors.slate500, fontWeight: '600', marginRight: 2 },
  sizeBtn:      { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.slate100 },
  sizeBtnActive:{ backgroundColor: Colors.slate900 },
  sizeText:     { fontSize: 11, fontWeight: '700', color: Colors.slate700 },
  sizeTextActive:{ color: Colors.white },
  navBtn:       { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.slate100, alignItems: 'center', justifyContent: 'center' },
  navBtnOff:    { opacity: 0.5 },
  pageText:     { fontSize: 12, fontWeight: '700', color: Colors.slate700, minWidth: 44, textAlign: 'center' },
});

export const paginate = <T,>(arr: T[], page: number, size: number): T[] =>
  arr.slice((page - 1) * size, (page - 1) * size + size);

/* ── Month stepper (replaces web's <input type="month">) ──────────────── */
export function MonthPicker({ value, onChange, label = 'Month' }: {
  value: string; onChange: (v: string) => void; label?: string;
}) {
  const shift = (delta: number) => {
    const [y, m] = value.split('-').map(Number);
    const d = new Date(y, (m - 1) + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <View style={mp.wrap}>
      <Text style={mp.label}>{label}</Text>
      <View style={mp.row}>
        <TouchableOpacity style={mp.btn} onPress={() => shift(-1)}>
          <Ionicons name="chevron-back" size={16} color={Colors.slate700} />
        </TouchableOpacity>
        <Text style={mp.value}>{monthLabel(value)}</Text>
        <TouchableOpacity style={mp.btn} onPress={() => shift(1)}>
          <Ionicons name="chevron-forward" size={16} color={Colors.slate700} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const mp = StyleSheet.create({
  wrap:  { gap: 5 },
  label: { fontSize: 11.5, fontWeight: '700', color: Colors.slate500 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 6, height: 44 },
  btn:   { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.slate100, alignItems: 'center', justifyContent: 'center' },
  value: { flex: 1, textAlign: 'center', fontSize: 13.5, fontWeight: '800', color: Colors.slate900 },
});

/* ── Toolbar button ──────────────────────────────────────────────────── */
export function ToolButton({ label, icon, onPress, primary, disabled }: {
  label: string; icon?: IoniconName; onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[tb.btn, primary && tb.btnPrimary, disabled && tb.btnOff]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon && <Ionicons name={icon} size={14} color={primary ? Colors.white : Colors.slate700} />}
      <Text style={[tb.text, primary && tb.textPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const tb = StyleSheet.create({
  btn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 11, backgroundColor: Colors.slate100 },
  btnPrimary: { backgroundColor: Colors.slate900 },
  btnOff:     { opacity: 0.45 },
  text:       { fontSize: 12, fontWeight: '700', color: Colors.slate700 },
  textPrimary:{ color: Colors.white },
});

/* ── Labelled field (forms) ──────────────────────────────────────────── */
export function Field({ label, children, flex }: {
  label: string; children: React.ReactNode; flex?: number;
}) {
  return (
    <View style={[{ gap: 5 }, flex ? { flex } : null]}>
      <Text style={fd.label}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={[fd.input, props.style]}
      placeholderTextColor={Colors.slate400}
    />
  );
}

const fd = StyleSheet.create({
  label: { fontSize: 11.5, fontWeight: '700', color: Colors.slate500 },
  input: {
    height: 44, borderRadius: 11, borderWidth: 1, borderColor: Colors.slate200,
    paddingHorizontal: 12, fontSize: 13.5, color: Colors.slate900,
    backgroundColor: Colors.white,
  },
});

/* ── Horizontal bar chart (replaces recharts BarChart) ────────────────── */
export function BarChart({ data, color = Colors.tileBlue, formatValue = inr }: {
  data: { name: string; value: number }[];
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const max = useMemo(() => Math.max(1, ...data.map(d => Math.abs(d.value))), [data]);
  if (!data.length) return <Text style={ch.empty}>No data</Text>;
  return (
    <View style={{ gap: 9 }}>
      {data.map((d, i) => (
        <View key={`${d.name}-${i}`} style={ch.barRow}>
          <Text style={ch.barLabel} numberOfLines={1}>{d.name}</Text>
          <View style={ch.barTrack}>
            <View
              style={[
                ch.barFill,
                {
                  width: `${Math.max(2, (Math.abs(d.value) / max) * 100)}%`,
                  backgroundColor: d.value < 0 ? Colors.danger : color,
                },
              ]}
            />
          </View>
          <Text style={ch.barValue} numberOfLines={1}>{formatValue(d.value)}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Donut chart (replaces recharts PieChart) ─────────────────────────── */
export function DonutChart({ data, size = 168 }: {
  data: { name: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) return <Text style={ch.empty}>No data</Text>;

  const r = size / 2;
  const inner = r * 0.58;
  let angle = -Math.PI / 2; // start at 12 o'clock

  const arcs = data
    .filter(d => d.value > 0)
    .map((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const x0 = r + r * Math.cos(angle);
      const y0 = r + r * Math.sin(angle);
      const x1 = r + r * Math.cos(angle + sweep);
      const y1 = r + r * Math.sin(angle + sweep);
      const xi1 = r + inner * Math.cos(angle + sweep);
      const yi1 = r + inner * Math.sin(angle + sweep);
      const xi0 = r + inner * Math.cos(angle);
      const yi0 = r + inner * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const path =
        `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} ` +
        `L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`;
      angle += sweep;
      return <Path key={i} d={path} fill={d.color} />;
    });

  return (
    <View style={ch.donutWrap}>
      <Svg width={size} height={size}>
        <G>{arcs}</G>
      </Svg>
      <View style={ch.legend}>
        {data.map((d, i) => (
          <View key={i} style={ch.legendRow}>
            <View style={[ch.legendDot, { backgroundColor: d.color }]} />
            <Text style={ch.legendLabel} numberOfLines={1}>{d.name}</Text>
            <Text style={ch.legendValue}>{inr(d.value)}</Text>
            <Text style={ch.legendPct}>
              {total ? `${Math.round((d.value / total) * 100)}%` : '0%'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  empty:      { fontSize: 12.5, color: Colors.slate400, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  barRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel:   { width: 92, fontSize: 11.5, color: Colors.slate600, fontWeight: '600' },
  barTrack:   { flex: 1, height: 16, borderRadius: 6, backgroundColor: Colors.slate100, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 6 },
  barValue:   { width: 84, fontSize: 11, fontWeight: '700', color: Colors.slate900, textAlign: 'right' },
  donutWrap:  { alignItems: 'center', gap: 12 },
  legend:     { alignSelf: 'stretch', gap: 7 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendLabel:{ flex: 1, fontSize: 12, color: Colors.slate600, fontWeight: '600' },
  legendValue:{ fontSize: 12, fontWeight: '800', color: Colors.slate900 },
  legendPct:  { fontSize: 11, color: Colors.slate400, width: 34, textAlign: 'right' },
});
