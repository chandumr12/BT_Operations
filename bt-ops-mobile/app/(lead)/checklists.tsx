import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChecklistsScreen } from '@/components/ChecklistsScreen';
import { Colors } from '@/constants/Colors';

export default function LeadChecklistsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.slate50 }}>
      <ChecklistsScreen myBatchesOnly />
    </SafeAreaView>
  );
}
