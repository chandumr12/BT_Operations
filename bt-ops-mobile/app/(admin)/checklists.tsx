import React from 'react';
import { AppShell } from '@/components/AppShell';
import { ChecklistsScreen } from '@/components/ChecklistsScreen';

export default function AdminChecklistsScreen() {
  return (
    <AppShell>
      <ChecklistsScreen />
    </AppShell>
  );
}
