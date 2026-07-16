import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Button } from '@/components/Button';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential'
        ? 'Invalid email or password.'
        : e.message ?? 'Login failed.';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>BT</Text>
          </View>
          <Text style={s.title}>Bengaluru Trekkers</Text>
          <Text style={s.subtitle}>Operations Portal</Text>
        </View>

        {/* Form Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign in</Text>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.gray400}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.gray400}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <Button
            title="Sign in"
            onPress={handleLogin}
            loading={loading}
            style={s.btn}
          />
        </View>

        <Text style={s.footer}>BT Ops v1.0  •  Bengaluru Trekkers</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.primary },
  scroll:   { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 24 },

  header:   { alignItems: 'center', gap: 10 },
  logoBox:  {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 28, fontWeight: '800', color: Colors.white },
  title:    { fontSize: 22, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  card:      {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray900, marginBottom: 4 },

  field:  { gap: 6 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input:  {
    height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, fontSize: 15,
    color: Colors.gray900, backgroundColor: Colors.gray50,
  },
  btn:    { marginTop: 4 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
