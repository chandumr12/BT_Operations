import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Colors } from '@/constants/Colors';

export interface RouteStop { name: string; mapUrl?: string; }

/**
 * In-app route-map viewer — the numbered-stop timeline, entirely native.
 * Tapping a stop with a Google Maps link opens the device's Maps app
 * directly (no hosted web page involved); the bottom button chains every
 * stop into one Google Maps directions URL, same as before, just opened
 * via Linking instead of a browser tab.
 */
export function RouteMapModal({ visible, onClose, title, subtitle, stops }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stops: RouteStop[];
}) {
  if (!visible) return null;

  const openStop = (url?: string) => { if (url) Linking.openURL(url); };

  const openFullRoute = () => {
    if (stops.length < 2) return;
    const q = (v: string) => encodeURIComponent(v);
    const origin = q(stops[0].name);
    const destination = q(stops[stops.length - 1].name);
    const waypoints = stops.slice(1, -1).map(s => q(s.name)).join('%7C');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}` +
      (waypoints ? `&waypoints=${waypoints}` : '') + `&travelmode=driving`;
    Linking.openURL(url);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>📍 {title}</Text>
            {!!subtitle && <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text>}
          </View>
        </View>

        {stops.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="location-outline" size={30} color={Colors.slate300} />
            <Text style={s.emptyText}>No stops added yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={s.sectionLabel}>ROUTE</Text>
            {stops.map((stop, i) => {
              const isFirst = i === 0;
              const isLast = i === stops.length - 1;
              const color = isFirst ? Colors.success : isLast ? Colors.danger : Colors.gradientBlueTo;
              const tag = isFirst ? 'START' : isLast ? 'LAST STOP' : `STOP ${i + 1}`;
              return (
                <View key={i} style={s.stopRow}>
                  <View style={s.stopLineWrap}>
                    <View style={[s.stopNum, { backgroundColor: color }]}>
                      <Text style={s.stopNumText}>{i + 1}</Text>
                    </View>
                    {!isLast && <View style={s.stopLine} />}
                  </View>
                  <View style={s.stopBody}>
                    <Text style={[s.stopTag, { color }]}>{tag}</Text>
                    {stop.mapUrl ? (
                      <TouchableOpacity onPress={() => openStop(stop.mapUrl)} activeOpacity={0.7} style={s.stopNameRow}>
                        <Ionicons name="location" size={13} color={Colors.primary} />
                        <Text style={s.stopNameLinked}>{stop.name}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={s.stopName}>{stop.name}</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {stops.length > 1 && (
              <TouchableOpacity style={s.routeBtn} onPress={openFullRoute} activeOpacity={0.85}>
                <Ionicons name="navigate-outline" size={16} color={Colors.white} />
                <Text style={s.routeBtnText}>Open full route in Google Maps</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16, backgroundColor: Colors.primary,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: Colors.slate400 },

  body: { padding: 18, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.6, marginBottom: 14 },

  stopRow: { flexDirection: 'row', gap: 12 },
  stopLineWrap: { alignItems: 'center' },
  stopNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stopNumText: { fontSize: 12, fontWeight: '800', color: Colors.white },
  stopLine: { width: 2, flex: 1, backgroundColor: Colors.slate200, marginVertical: 4 },

  stopBody: { flex: 1, paddingBottom: 22 },
  stopTag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  stopName: { fontSize: 15, fontWeight: '700', color: Colors.slate900 },
  stopNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopNameLinked: { fontSize: 15, fontWeight: '700', color: Colors.primary },

  routeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.slate900, borderRadius: 14, paddingVertical: 15, marginTop: 4,
  },
  routeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
