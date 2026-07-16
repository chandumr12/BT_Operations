import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={s.text}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, gap: 16 },
  text:      { color: Colors.gray500, fontSize: 14 },
});
