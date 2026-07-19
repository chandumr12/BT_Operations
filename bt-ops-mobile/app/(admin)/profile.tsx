import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { Colors } from '@/constants/Colors';
import { confirmAction } from '@/utils/confirm';

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={av.circle}>
      <Text style={av.text}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  text:   { fontSize: 28, fontWeight: '800', color: Colors.white },
});

function MenuItem({ icon, label, value, danger, onPress }: {
  icon: any; label: string; value?: string; danger?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={mi.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[mi.iconBox, { backgroundColor: danger ? Colors.dangerBg : Colors.gray100 }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.gray600} />
      </View>
      <Text style={[mi.label, danger && { color: Colors.danger }]}>{label}</Text>
      {value ? <Text style={mi.value}>{value}</Text> : null}
      {onPress && !value && <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />}
    </TouchableOpacity>
  );
}
const mi = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.gray900 },
  value:   { fontSize: 13, color: Colors.gray500 },
});

export default function AdminProfileScreen() {
  const { profile, logout } = useAuth();

  const handleLogout = () => {
    confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out', logout);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Profile card */}
        <View style={s.heroCard}>
          <Avatar name={profile?.displayName ?? 'A'} />
          <Text style={s.heroName}>{profile?.displayName ?? 'Admin'}</Text>
          <Text style={s.heroEmail}>{profile?.email ?? ''}</Text>
          <View style={s.rolePill}>
            <Text style={s.roleText}>{profile?.role ?? 'admin'}</Text>
          </View>
        </View>

        {/* Info */}
        <Card padding={0} style={s.menuCard}>
          <MenuItem icon="mail-outline"   label="Email"  value={profile?.email ?? '—'} />
          <MenuItem icon="shield-outline" label="Role"   value={profile?.role  ?? '—'} />
          <MenuItem icon="phone-portrait-outline" label="App Version" value="1.0.0" />
        </Card>

        {/* Actions */}
        <Card padding={0} style={s.menuCard}>
          <MenuItem
            icon="log-out-outline"
            label="Sign out"
            danger
            onPress={handleLogout}
          />
        </Card>

        <Text style={s.footer}>BT Ops v1.0  •  Bengaluru Trekkers</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.gray50 },
  content:  { padding: 20, gap: 16, paddingBottom: 40 },

  heroCard:  { alignItems: 'center', gap: 8, paddingVertical: 32, backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  heroName:  { fontSize: 22, fontWeight: '700', color: Colors.gray900, marginTop: 4 },
  heroEmail: { fontSize: 13, color: Colors.gray500 },
  rolePill:  { backgroundColor: Colors.primaryBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  roleText:  { fontSize: 12, fontWeight: '600', color: Colors.primary },

  menuCard:  { overflow: 'hidden' },
  footer:    { textAlign: 'center', color: Colors.gray400, fontSize: 12, marginTop: 8 },
});
