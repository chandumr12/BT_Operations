import React from 'react';
import { useRouter } from 'expo-router';
import { SettingsModal } from '@/components/SettingsModal';

export default function SettingsScreen() {
  const router = useRouter();

  const close = () => router.replace('/(admin)/' as any);

  return <SettingsModal onClose={close} />;
}
