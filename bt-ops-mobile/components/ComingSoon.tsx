import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel } from '@/components/ui';
import { Colors } from '@/constants/Colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Placeholder for web screens not yet ported to mobile (phase 2).
 * Keeps every drawer destination navigable instead of dead-ending.
 */
export function ComingSoon({ title, subtitle, icon, note }: {
  title: string; subtitle?: string; icon: IoniconName; note?: string;
}) {
  return (
    <AppShell>
      <ScrollView contentContainerStyle={s.page}>
        <PageTitle title={title} subtitle={subtitle} />
        <Panel style={{ marginTop: 16 }} padding={0}>
          <View style={s.wrap}>
            <View style={s.iconBox}>
              <Ionicons name={icon} size={30} color={Colors.primary} />
            </View>
            <Text style={s.title}>Coming in the next phase</Text>
            <Text style={s.message}>
              {note ?? `${title} is available on the web app and is queued for the next build of the mobile app.`}
            </Text>
          </View>
        </Panel>
      </ScrollView>
    </AppShell>
  );
}

const s = StyleSheet.create({
  page:    { padding: 16, paddingBottom: 40 },
  wrap:    { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 26, gap: 10 },
  iconBox: { width: 68, height: 68, borderRadius: 20, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 16, fontWeight: '800', color: Colors.slate700, marginTop: 6 },
  message: { fontSize: 13, color: Colors.slate400, textAlign: 'center', lineHeight: 20 },
});
