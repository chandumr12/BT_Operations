import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/* ── Blue gradient page header (Trek Master / Leads / Tasks on web) ───── */
export function GradientHeader({ icon, title, subtitle, actionLabel, onAction }: {
  icon?: IoniconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <LinearGradient
      colors={[Colors.gradientBlueFrom, Colors.gradientBlueTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={g.wrap}
    >
      <View style={{ flex: 1 }}>
        <View style={g.titleRow}>
          {icon && <Ionicons name={icon} size={22} color={Colors.white} />}
          <Text style={g.title}>{title}</Text>
        </View>
        {!!subtitle && <Text style={g.subtitle}>{subtitle}</Text>}
      </View>
      {!!actionLabel && (
        <TouchableOpacity style={g.action} onPress={onAction} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={Colors.gradientBlueTo} />
          <Text style={g.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const g = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 18 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:     { fontSize: 21, fontWeight: '800', color: Colors.white },
  subtitle:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  action:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  actionText:{ fontSize: 12, fontWeight: '700', color: Colors.gradientBlueTo },
});

/* ── Plain page title (Batches / Workload / Checklists on web) ───────── */
export function PageTitle({ title, subtitle, right, icon, iconColor }: {
  title: string; subtitle?: string; right?: React.ReactNode; icon?: IoniconName; iconColor?: string;
}) {
  return (
    <View style={p.row}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={p.titleRow}>
          {icon && <Ionicons name={icon} size={20} color={iconColor ?? Colors.gradientBlueTo} />}
          <Text style={p.title}>{title}</Text>
        </View>
        {!!subtitle && <Text style={p.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const p = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { fontSize: 24, fontWeight: '800', color: Colors.slate900 },
  subtitle: { fontSize: 13, color: Colors.slate500, marginTop: 3 },
});

/* ── White stat card with icon tile (Dashboard / Workload) ───────────── */
export function StatCard({ label, value, icon, tint }: {
  label: string; value: React.ReactNode; icon: IoniconName; tint?: string;
}) {
  const color = tint ?? Colors.primary;
  return (
    <View style={st.card}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.label} numberOfLines={2}>{label}</Text>
        <Text style={st.value}>{value}</Text>
      </View>
      <View style={[st.iconBox, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.slate100,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  label:   { fontSize: 11, color: Colors.slate500, fontWeight: '600', lineHeight: 14 },
  value:   { fontSize: 26, fontWeight: '900', color: Colors.slate900, marginTop: 3 },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

/* ── Solid colour stat tile (Batch Planning row on web) ──────────────── */
export function ColorTile({ value, label, sub, bg, fg = Colors.white, icon, onPress }: {
  value: React.ReactNode; label: string; sub?: string; bg: string; fg?: string;
  icon?: IoniconName; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ct.tile, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
    >
      {icon && (
        <View style={[ct.iconBox, { backgroundColor: fg === Colors.white ? 'rgba(255,255,255,0.18)' : Colors.white }]}>
          <Ionicons name={icon} size={15} color={fg} />
        </View>
      )}
      <Text style={[ct.value, { color: fg }]}>{value}</Text>
      <Text style={[ct.label, { color: fg, opacity: 0.85 }]}>{label}</Text>
      {!!sub && <Text style={[ct.sub, { color: fg, opacity: 0.7 }]}>{sub}</Text>}
    </TouchableOpacity>
  );
}

const ct = StyleSheet.create({
  tile:    { minWidth: 132, borderRadius: 14, padding: 14, gap: 2 },
  iconBox: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  value:   { fontSize: 24, fontWeight: '900' },
  label:   { fontSize: 12, fontWeight: '700' },
  sub:     { fontSize: 10, fontWeight: '500' },
});

/* ── Search bar ──────────────────────────────────────────────────────── */
export function SearchBar({ value, onChangeText, placeholder }: {
  value: string; onChangeText: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={sb.box}>
      <Ionicons name="search-outline" size={16} color={Colors.slate400} />
      <TextInput
        style={sb.input}
        placeholder={placeholder ?? 'Search…'}
        placeholderTextColor={Colors.slate400}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={Colors.slate400} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const sb = StyleSheet.create({
  box:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 14, color: Colors.slate900 },
});

/* ── Filter chip row ─────────────────────────────────────────────────── */
export function Chip({ label, active, count, onPress, activeBg = Colors.slate900 }: {
  label: string; active?: boolean; count?: number; onPress?: () => void; activeBg?: string;
}) {
  return (
    <TouchableOpacity
      style={[c.chip, active && { backgroundColor: activeBg }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[c.text, active && c.textActive]}>{label}</Text>
      {count !== undefined && (
        <View style={[c.count, active && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
          <Text style={[c.countText, active && { color: Colors.white }]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.slate100 },
  text:      { fontSize: 12, fontWeight: '600', color: Colors.slate700 },
  textActive:{ color: Colors.white },
  count:     { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: Colors.white },
  countText: { fontSize: 10, fontWeight: '800', color: Colors.slate700 },
});

/* ── Small coloured pill (status / difficulty / category) ────────────── */
export function Pill({ label, color, bg, dot }: {
  label: string; color: string; bg: string; dot?: boolean;
}) {
  return (
    <View style={[pl.pill, { backgroundColor: bg }]}>
      {dot && <View style={[pl.dot, { backgroundColor: color }]} />}
      <Text style={[pl.text, { color }]}>{label}</Text>
    </View>
  );
}

const pl = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});

export const DIFFICULTY_STYLE: Record<string, { color: string; bg: string }> = {
  'Easy':           { color: '#16a34a', bg: '#dcfce7' },
  'Moderate':       { color: '#ca8a04', bg: '#fef9c3' },
  'Difficult':      { color: '#ea580c', bg: '#ffedd5' },
  'Very Difficult': { color: '#dc2626', bg: '#fee2e2' },
};

export const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  'Open':         { color: '#16a34a', bg: '#dcfce7' },
  'Filling Fast': { color: '#ca8a04', bg: '#fef9c3' },
  'Full':         { color: '#dc2626', bg: '#fee2e2' },
  'Closed':       { color: '#475569', bg: '#f1f5f9' },
  'Completed':    { color: '#2563eb', bg: '#dbeafe' },
  'Cancelled':    { color: '#dc2626', bg: '#fee2e2' },
};

export const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  'Low':    { color: '#64748b', bg: '#f1f5f9' },
  'Medium': { color: '#ca8a04', bg: '#fef9c3' },
  'High':   { color: '#ea580c', bg: '#ffedd5' },
  'Urgent': { color: '#dc2626', bg: '#fee2e2' },
};

/* ── Card ─────────────────────────────────────────────────────────────── */
export function Panel({ children, style, padding = 16 }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; padding?: number;
}) {
  return <View style={[pn.panel, { padding }, style]}>{children}</View>;
}

const pn = StyleSheet.create({
  panel: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.slate100,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
});

/* ── Avatar with deterministic colour (Leads / Workload on web) ──────── */
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#6366f1'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = (name || '?').trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const bg = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[av.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text:   { color: Colors.white, fontWeight: '800' },
});

/* ── Empty state ─────────────────────────────────────────────────────── */
export function EmptyState({ icon, title, message }: {
  icon: IoniconName; title: string; message?: string;
}) {
  return (
    <View style={es.wrap}>
      <View style={es.iconBox}>
        <Ionicons name={icon} size={28} color={Colors.primary} />
      </View>
      <Text style={es.title}>{title}</Text>
      {!!message && <Text style={es.message}>{message}</Text>}
    </View>
  );
}

const es = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
  iconBox: { width: 64, height: 64, borderRadius: 18, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 15, fontWeight: '700', color: Colors.slate700, marginTop: 4 },
  message: { fontSize: 13, color: Colors.slate400, textAlign: 'center', lineHeight: 19 },
});
