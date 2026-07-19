import React from 'react';
import { useRouter } from 'expo-router';
import { UserManagementModal } from '@/components/UserManagementModal';

export default function UsersScreen() {
  const router = useRouter();

  const close = () => router.replace('/(admin)/' as any);

  return <UserManagementModal onClose={close} />;
}
