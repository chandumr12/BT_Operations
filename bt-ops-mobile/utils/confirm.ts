import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 *
 * React Native's multi-button `Alert.alert(title, message, [...])` is not
 * reliably rendered by react-native-web — on the web preview it frequently
 * shows nothing at all, so a "Cancel / Sign out"-style dialog silently does
 * nothing when tapped. This falls back to `window.confirm` on web and uses
 * the native Alert on iOS/Android.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  destructive = true
) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
