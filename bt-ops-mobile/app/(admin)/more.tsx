import { Redirect } from 'expo-router';

/**
 * The old "More" grid was replaced by the slide-out drawer in
 * components/AppShell.tsx, which mirrors the web app's sidebar.
 * Kept as a redirect so any stale link still lands somewhere sensible.
 */
export default function MoreScreen() {
  return <Redirect href={'/(admin)/' as any} />;
}
