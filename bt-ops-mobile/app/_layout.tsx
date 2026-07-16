import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';

function RootGuard() {
  const { user, profile, loading, isAdmin } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth  = segments[0] === 'login';
    const inAdmin = segments[0] === '(admin)';
    const inLead  = segments[0] === '(lead)';

    if (!user) {
      if (!inAuth) router.replace('/login');
    } else if (isAdmin) {
      if (!inAdmin) router.replace('/(admin)/');
    } else {
      if (!inLead) router.replace('/(lead)/');
    }
  }, [user, profile, loading]);

  if (loading) return <LoadingScreen message="BT Ops loading…" />;
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
