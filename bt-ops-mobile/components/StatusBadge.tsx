import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

const MAP: Record<string, { bg: string; text: string; dot?: string }> = {
  available: { bg: Colors.successBg, text: Colors.success,  dot: Colors.success },
  running:   { bg: Colors.infoBg,    text: Colors.info,     dot: Colors.info },
  starting:  { bg: Colors.infoBg,    text: Colors.info },
  done:      { bg: Colors.gray100,   text: Colors.gray500 },
  stopped:   { bg: Colors.dangerBg,  text: Colors.danger },
  Open:      { bg: Colors.successBg, text: Colors.success },
  Completed: { bg: Colors.gray100,   text: Colors.gray500 },
  Cancelled: { bg: Colors.dangerBg,  text: Colors.danger },
  approved:  { bg: Colors.successBg, text: Colors.success },
  pending:   { bg: Colors.warningBg, text: Colors.warning },
};

export function StatusBadge({ status }: { status: string }) {
  const style = MAP[status] ?? { bg: Colors.gray100, text: Colors.gray500 };
  return (
    <View style={[s.badge, { backgroundColor: style.bg }]}>
      {style.dot && <View style={[s.dot, { backgroundColor: style.dot }]} />}
      <Text style={[s.text, { color: style.text }]}>{status}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  text:  { fontSize: 12, fontWeight: '600' },
});
