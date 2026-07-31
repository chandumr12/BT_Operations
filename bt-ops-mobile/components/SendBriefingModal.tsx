import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Modal, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { collection, getDocs } from 'firebase/firestore';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/utils/firebase';
import { LibraryDoc, pickupRouteMapUrl, packingListUrl, trekProtocolUrl } from '@/components/DocLibraryScreen';

interface AssignedLead { userId: string; displayName: string; isSuperLead?: boolean; }

export interface BriefingBatch {
  id: string;
  batchCode: string;
  trekId?: string;
  startDate?: string;
  endDate?: string;
  assignedLeads?: AssignedLead[];
}

/**
 * Composes the consolidated "you've been assigned" briefing that Ops Managers
 * and Super Admins send to a batch's trek leads over WhatsApp.
 *
 * Pickup points are matched to the batch's trek automatically (they differ per
 * trek); the packing list and protocol are chosen at send time since several
 * of each can exist and they're shared across treks. POC defaults to the
 * sender but stays editable.
 */
export function SendBriefingModal({ batch, trekName, onClose }: {
  batch: BriefingBatch; trekName?: string; onClose: () => void;
}) {
  const { profile } = useAuth();

  const [packingLists, setPackingLists] = useState<LibraryDoc[]>([]);
  const [pickupDocs, setPickupDocs]     = useState<LibraryDoc[]>([]);
  const [protocols, setProtocols]       = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [packingId, setPackingId]   = useState('');
  const [pickupId, setPickupId]     = useState('');
  const [protocolId, setProtocolId] = useState('');
  const [poc, setPoc] = useState(profile?.displayName ?? '');

  useEffect(() => {
    (async () => {
      try {
        const [pl, pp, pr] = await Promise.all([
          getDocs(collection(firestore, 'packing_lists')),
          getDocs(collection(firestore, 'pickup_points')),
          getDocs(collection(firestore, 'trek_protocols')),
        ]);
        const map = (snap: any): LibraryDoc[] => snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        const plDocs = map(pl), ppDocs = map(pp), prDocs = map(pr);
        setPackingLists(plDocs);
        setPickupDocs(ppDocs);
        setProtocols(prDocs);

        // Preselect the best match for this batch's trek: a doc tied to this
        // exact trek first, then the one shared/all-treks doc if there's
        // exactly one, then the sole doc overall if there's only one to
        // choose from. Otherwise left blank for a manual pick.
        const preselect = (docs: LibraryDoc[]): string => {
          const trekMatch = docs.find(d => d.trekId && d.trekId === batch.trekId);
          if (trekMatch) return trekMatch.id;
          const shared = docs.filter(d => !d.trekId);
          if (shared.length === 1) return shared[0].id;
          if (docs.length === 1) return docs[0].id;
          return '';
        };
        setPickupId(preselect(ppDocs));
        setPackingId(preselect(plDocs));
        setProtocolId(preselect(prDocs));
      } catch {
        Alert.alert('Error', 'Could not load templates.');
      } finally { setLoading(false); }
    })();
  }, [batch.trekId]);

  const leadNames = (batch.assignedLeads ?? []).map(l => l.displayName).join(', ');

  const selected = {
    packing:  packingLists.find(d => d.id === packingId),
    pickup:   pickupDocs.find(d => d.id === pickupId),
    protocol: protocols.find(d => d.id === protocolId),
  };

  const message = useMemo(() => {
    const lines = [
      `You are assigned to this particular trek.`,
      ``,
      `Please share the below details:`,
      ``,
      `📍 *Pickup points*`,
      `Link : ${selected.pickup ? pickupRouteMapUrl(selected.pickup) : '—'}`,
      ``,
      `📋 *Packing list*`,
      `Link : ${selected.packing ? packingListUrl(selected.packing) : '—'}`,
      ``,
      `🧭 *Trek protocol*`,
      `Link : ${selected.protocol ? trekProtocolUrl(selected.protocol) : '—'}`,
      ``,
      `Assigned Trek lead : ${leadNames || '—'}`,
      `Trek Name : ${trekName || batch.batchCode}`,
      `Poc : ${poc || '—'}`,
      ``,
      `_Powered by BT Ops_`,
    ];
    return lines.join('\n');
  }, [selected.pickup, selected.packing, selected.protocol, leadNames, trekName, batch.batchCode, poc]);

  const missing = !selected.pickup || !selected.packing || !selected.protocol;

  const send = async () => {
    if (missing) {
      Alert.alert('Pick all three', 'Select a pickup points, packing list and protocol entry first.');
      return;
    }
    const text = encodeURIComponent(message);
    const appUrl = `whatsapp://send?text=${text}`;
    const ok = await Linking.canOpenURL(appUrl);
    Linking.openURL(ok ? appUrl : `https://wa.me/?text=${text}`);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied', 'Message copied to clipboard.');
  };

  const Selector = ({ label, docs, value, onSelect, emptyHint }: {
    label: string; docs: LibraryDoc[]; value: string; onSelect: (id: string) => void; emptyHint: string;
  }) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {docs.length === 0 ? (
        <Text style={s.emptyHint}>{emptyHint}</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {docs.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[s.optionRow, value === d.id && s.optionRowActive]}
              onPress={() => onSelect(d.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={value === d.id ? 'radio-button-on' : 'radio-button-off'}
                size={17}
                color={value === d.id ? Colors.primary : Colors.slate300}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.optionName} numberOfLines={1}>{d.emoji ? `${d.emoji} ` : ''}{d.name}</Text>
                <Text style={s.optionSub} numberOfLines={1}>{d.trekName || 'Shared — all treks'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="logo-whatsapp" size={18} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Send Trek Briefing</Text>
            <Text style={s.headerSub}>{batch.batchCode}{trekName ? ` · ${trekName}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.centerFill}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            {(batch.assignedLeads ?? []).length === 0 && (
              <View style={s.warnBox}>
                <Ionicons name="warning-outline" size={16} color={Colors.warning} />
                <Text style={s.warnText}>No trek leads assigned to this batch yet.</Text>
              </View>
            )}

            <Selector
              label="📍 PICKUP POINTS (per trek)"
              docs={pickupDocs} value={pickupId} onSelect={setPickupId}
              emptyHint="No pickup points created yet — add them on the Pickup Points screen."
            />
            <Selector
              label="📋 PACKING LIST"
              docs={packingLists} value={packingId} onSelect={setPackingId}
              emptyHint="No packing lists created yet."
            />
            <Selector
              label="🧭 TREK PROTOCOL"
              docs={protocols} value={protocolId} onSelect={setProtocolId}
              emptyHint="No protocols created yet — add one on the Trek Protocol screen."
            />

            <View style={s.field}>
              <Text style={s.label}>POC (POINT OF CONTACT)</Text>
              <TextInput
                style={s.input} value={poc} onChangeText={setPoc}
                placeholder="Name / phone" placeholderTextColor={Colors.slate400}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>PREVIEW</Text>
              <View style={s.preview}>
                <Text style={s.previewText}>{message}</Text>
              </View>
            </View>

            <View style={s.btnRow}>
              <Button title="Send on WhatsApp" onPress={send} disabled={missing} style={{ flex: 1 }} />
              <Button title="Copy" onPress={copy} variant="outline" style={{ paddingHorizontal: 20 }} />
            </View>
          </ScrollView>
        )}
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.slate50 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: Colors.success },
  headerIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, paddingBottom: 40, gap: 16 },

  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningBg, borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12 },
  warnText: { flex: 1, fontSize: 12, color: Colors.warning, fontWeight: '600' },

  field: { gap: 8 },
  label: { fontSize: 10, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.6 },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  emptyHint: { fontSize: 12, color: Colors.slate400, fontStyle: 'italic' },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: Colors.white },
  optionRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  optionName: { fontSize: 13, fontWeight: '700', color: Colors.slate900 },
  optionSub: { fontSize: 11, color: Colors.slate500, marginTop: 2 },

  preview: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.slate200, borderRadius: 12, padding: 14 },
  previewText: { fontSize: 12, color: Colors.slate700, lineHeight: 18 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
