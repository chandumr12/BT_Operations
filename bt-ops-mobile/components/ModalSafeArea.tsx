import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Drop-in replacement for <SafeAreaView> when it's the root of a native
 * <Modal>. On iOS, SafeAreaView (both RN's and react-native-safe-area-
 * context's) does not reliably pick up safe-area insets inside a Modal —
 * the header renders under the status bar / notch / dynamic island instead
 * of below it, which can also make close/back buttons unreachable. This
 * applies the real insets as manual padding instead, the same fix already
 * used for the drawer in components/AppShell.tsx.
 */
export function ModalSafeArea({ children, style, edges = ['top', 'bottom'] }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        style,
        edges.includes('top') ? { paddingTop: insets.top } : null,
        edges.includes('bottom') ? { paddingBottom: insets.bottom } : null,
      ]}
    >
      {children}
    </View>
  );
}
