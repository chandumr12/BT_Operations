import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Colors } from '@/constants/Colors';

export interface PickerOption { label: string; value: string; }

/**
 * Bottom-sheet option picker, standing in for @react-native-picker/picker.
 *
 * The native Picker's dropdown/dialog does not reliably open on Android when
 * it is nested inside a React Native <Modal> — taps land but nothing appears,
 * which reads to a user as "there's no way to fill this field". This mirrors
 * the "Assign Trek Leads" sheet pattern already used in BatchFormModal (an
 * inline absolute-positioned overlay, not a second <Modal>, since stacking
 * two RN Modals is a known source of iOS rendering glitches) — so it must be
 * rendered by the caller as a sibling at the top level of the single
 * screen-owning <Modal>, exactly like that lead sheet, not nested inside a
 * ScrollView or field row.
 */
export function PickerSheet({
  visible, onClose, title, options, value, onChange,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: PickerOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (!visible) return null;
  return (
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      <ModalSafeArea style={s.sheet} edges={['bottom']}>
        <View style={s.sheetHandle} />
        {!!title && <Text style={s.sheetTitle}>{title}</Text>}
        <FlatList
          data={options}
          keyExtractor={o => o.value}
          style={{ maxHeight: 360 }}
          renderItem={({ item: o }) => {
            const active = o.value === value;
            return (
              <TouchableOpacity
                style={s.optionRow}
                onPress={() => { onChange(o.value); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={active ? s.optionTextActive : s.optionText}>{o.label}</Text>
                {active && <Ionicons name="checkmark" size={17} color={Colors.primary} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>No options available</Text>}
        />
      </ModalSafeArea>
    </KeyboardAvoidingView>
  );
}

/** Matching trigger button — shows the current selection, opens the sheet. */
export function PickerTrigger({
  label, placeholder = 'Select…', onPress,
}: {
  label?: string;
  placeholder?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.trigger} onPress={onPress} activeOpacity={0.8}>
      <Text style={label ? s.triggerTextActive : s.triggerText} numberOfLines={1}>
        {label || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color={Colors.slate400} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 14, backgroundColor: Colors.white },
  triggerText: { fontSize: 13, color: Colors.slate400, flex: 1 },
  triggerTextActive: { fontSize: 13, color: Colors.slate900, fontWeight: '600', flex: 1 },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, maxHeight: '75%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.slate200, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.6, marginBottom: 6, paddingHorizontal: 4 },

  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.slate50 },
  optionText: { fontSize: 14, color: Colors.slate900 },
  optionTextActive: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.slate400, padding: 30 },
});
