import { Stack } from 'expo-router';

/**
 * Navigation now lives in the slide-out drawer (components/AppShell.tsx),
 * which mirrors the web app's left sidebar. Each screen renders inside
 * <AppShell>, so this layout is just a headerless stack.
 */
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
