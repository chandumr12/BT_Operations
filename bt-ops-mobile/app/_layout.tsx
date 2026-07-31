import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';

function RootGuard() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth  = segments[0] === 'login';
    const inAdmin = segments[0] === '(admin)';

    // Every role lands in the (admin) group — it's the single shell with the
    // full drawer nav, and constants/nav.ts already filters each menu item
    // by role (mirroring the web sidebar), so Trek Lead/Coordinator simply
    // see a shorter menu rather than being routed into a separate, far
    // smaller (lead) tab bar that was missing Calendar, Meet the Team, My
    // Availability, and the full role-aware Dashboard entirely.
    if (!user) {
      if (!inAuth) router.replace('/login');
    } else if (!inAdmin) {
      router.replace('/(admin)/');
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
