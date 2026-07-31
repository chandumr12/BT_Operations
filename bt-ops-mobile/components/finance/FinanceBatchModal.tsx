import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Field, Input, ToolButton, SectionTitle } from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import { inr } from '@/utils/finance';
import { describeError } from '@/utils/errors';

const num = (v: any) => parseInt(String(v || 0), 10) || 0;

export interface FinanceBatch {
  id?: string;
  batchCode?: string; trekName?: string; date?: string; startDate?: string; endDate?: string;
  noOfPeople?: number; basePrice?: number; totalDiscount?: number;
  transport?: any; homestay?: any;
  guideExpense?: number; permitExpense?: number; jeepExpense?: number;
  otherExpensesItems?: { remark: string; amount: number }[];
  leadPayments?: { name: string; amount: number }[];
  batchRemarks?: string;
  totalIncome?: number; totalExpense?: number; totalProfit?: number;
}

interface FormState {
  batchCode: string; trekName: string; startDate: string; endDate: string;
  noOfPeople: string; basePrice: string; totalDiscount: string;
  transportMode: 'calc' | 'direct';
  transportTotalKm: string; transportRatePerKm: string; transportTollCharge: string;
  transportDriverBata: string; transportDriverShifts: string;
  transportRoadTax: string; transportParkingCharge: string; transportDirectAmount: string;
  homestayMode: 'calc' | 'direct';
  homestayPeople: string; homestayPricePerPerson: string; homestayJeep: string; homestayDirectAmount: string;
  guideExpense: string; permitExpense: string; jeepExpense: string;
  otherExpensesItems: { remark: string; amount: string }[];
  leadPayments: { name: string; amount: string }[];
  batchRemarks: string;
}

const blank = (): FormState => ({
  batchCode: '', trekName: '', startDate: '', endDate: '',
  noOfPeople: '', basePrice: '', totalDiscount: '',
  transportMode: 'calc',
  transportTotalKm: '', transportRatePerKm: '', transportTollCharge: '',
  transportDriverBata: '', transportDriverShifts: '',
  transportRoadTax: '', transportParkingCharge: '', transportDirectAmount: '',
  homestayMode: 'calc',
  homestayPeople: '', homestayPricePerPerson: '', homestayJeep: '', homestayDirectAmount: '',
  guideExpense: '', permitExpense: '', jeepExpense: '',
  otherExpensesItems: [], leadPayments: [], batchRemarks: '',
});

const fromBatch = (b: FinanceBatch): FormState => ({
  batchCode: b.batchCode ?? '', trekName: b.trekName ?? '',
  startDate: b.startDate ?? b.date ?? '', endDate: b.endDate ?? '',
  noOfPeople: String(b.noOfPeople ?? ''), basePrice: String(b.basePrice ?? ''),
  totalDiscount: String(b.totalDiscount ?? ''),
  transportMode: b.transport?.mode ?? 'calc',
  transportTotalKm: String(b.transport?.totalKm ?? ''),
  transportRatePerKm: String(b.transport?.ratePerKm ?? ''),
  transportTollCharge: String(b.transport?.tollCharge ?? ''),
  transportDriverBata: String(b.transport?.driverBata ?? ''),
  transportDriverShifts: String(b.transport?.driverShifts ?? ''),
  transportRoadTax: String(b.transport?.roadTax ?? ''),
  transportParkingCharge: String(b.transport?.parkingCharge ?? ''),
  transportDirectAmount: String(b.transport?.directAmount ?? ''),
  homestayMode: b.homestay?.mode ?? 'calc',
  homestayPeople: String(b.homestay?.people ?? ''),
  homestayPricePerPerson: String(b.homestay?.pricePerPerson ?? ''),
  homestayJeep: String(b.homestay?.jeep ?? ''),
  homestayDirectAmount: String(b.homestay?.directAmount ?? ''),
  guideExpense: String(b.guideExpense ?? ''), permitExpense: String(b.permitExpense ?? ''),
  jeepExpense: String(b.jeepExpense ?? ''),
  otherExpensesItems: (b.otherExpensesItems ?? []).map(i => ({ remark: i.remark ?? '', amount: String(i.amount ?? '') })),
  leadPayments: (b.leadPayments ?? []).map(l => ({ name: l.name ?? '', amount: String(l.amount ?? '') })),
  batchRemarks: b.batchRemarks ?? '',
});

/** Mirrors computeTransport() in FinanceBatches.js */
const computeTransport = (f: FormState) =>
  f.transportMode === 'direct'
    ? num(f.transportDirectAmount)
    : num(f.transportRatePerKm) * num(f.transportTotalKm)
      + num(f.transportTollCharge)
      + num(f.transportDriverBata) * num(f.transportDriverShifts)
      + num(f.transportRoadTax)
      + num(f.transportParkingCharge);

/** Mirrors computeHomestay() in FinanceBatches.js */
const computeHomestay = (f: FormState) =>
  f.homestayMode === 'direct'
    ? num(f.homestayDirectAmount)
    : num(f.homestayPeople) * num(f.homestayPricePerPerson) + num(f.homestayJeep);

export function FinanceBatchModal({ batch, treks, leads, onClose, onSaved }: {
  batch?: FinanceBatch | null;
  treks: { id: string; name?: string; trekName?: string }[];
  leads: { id: string; name?: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!batch?.id;
  const [f, setF] = useState<FormState>(batch ? fromBatch(batch) : blank());
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF(prev => ({ ...prev, [k]: v }));

  const preview = useMemo(() => {
    const income = num(f.noOfPeople) * num(f.basePrice) - num(f.totalDiscount);
    const leadTotal  = f.leadPayments.reduce((s, l) => s + num(l.amount), 0);
    const otherTotal = f.otherExpensesItems.reduce((s, i) => s + num(i.amount), 0);
    const transport  = computeTransport(f);
    const homestay   = computeHomestay(f);
    const expenses = transport + homestay + num(f.guideExpense) + num(f.permitExpense)
                   + num(f.jeepExpense) + otherTotal + leadTotal;
    return { income, expenses, profit: income - expenses, transport, homestay, leadTotal, otherTotal };
  }, [f]);

  const save = async () => {
    if (!f.batchCode.trim())  return Alert.alert('Missing field', 'Batch Code is required.');
    if (!f.trekName.trim())   return Alert.alert('Missing field', 'Trek is required.');
    if (!f.startDate.trim())  return Alert.alert('Missing field', 'Start date is required (YYYY-MM-DD).');
    if (!f.endDate.trim())    return Alert.alert('Missing field', 'End date is required (YYYY-MM-DD).');
    if (f.startDate > f.endDate) return Alert.alert('Invalid dates', 'End date must be after start date.');
    if (num(f.noOfPeople) <= 0)  return Alert.alert('Invalid value', 'Booked count must be greater than 0.');
    if (f.leadPayments.length > 5) return Alert.alert('Too many leads', 'Maximum 5 lead payments.');

    const transportTotal = computeTransport(f);
    const homestayTotal  = computeHomestay(f);
    const otherItems = f.otherExpensesItems.map(i => ({ remark: i.remark.trim(), amount: num(i.amount) }));
    const otherTotal = otherItems.reduce((s, i) => s + i.amount, 0);
    const leadPayments = f.leadPayments
      .filter(l => l.name || l.amount)
      .map(l => ({ name: l.name, amount: num(l.amount) }));
    const leadTotal = leadPayments.reduce((s, l) => s + l.amount, 0);

    const income = num(f.noOfPeople) * num(f.basePrice) - num(f.totalDiscount);
    const expenses = transportTotal + homestayTotal + num(f.guideExpense)
                   + num(f.permitExpense) + num(f.jeepExpense) + otherTotal + leadTotal;

    const payload: any = {
      batchCode: f.batchCode, trekName: f.trekName,
      date: f.startDate, startDate: f.startDate, endDate: f.endDate,
      noOfPeople: num(f.noOfPeople), basePrice: num(f.basePrice), totalDiscount: num(f.totalDiscount),
      transport: {
        mode: f.transportMode,
        totalKm: num(f.transportTotalKm), ratePerKm: num(f.transportRatePerKm),
        tollCharge: num(f.transportTollCharge), driverBata: num(f.transportDriverBata),
        driverShifts: num(f.transportDriverShifts), roadTax: num(f.transportRoadTax),
        parkingCharge: num(f.transportParkingCharge), directAmount: num(f.transportDirectAmount),
        total: transportTotal,
      },
      busExpense: transportTotal, // legacy map (kept for web compatibility)
      homestay: {
        mode: f.homestayMode,
        people: num(f.homestayPeople), pricePerPerson: num(f.homestayPricePerPerson),
        jeep: num(f.homestayJeep), directAmount: num(f.homestayDirectAmount),
        total: homestayTotal,
      },
      stayExpense: homestayTotal, // legacy map
      guideExpense: num(f.guideExpense), permitExpense: num(f.permitExpense), jeepExpense: num(f.jeepExpense),
      otherExpensesItems: otherItems, otherExpensesTotal: otherTotal, otherExpense: otherTotal,
      leadPayments, batchRemarks: f.batchRemarks,
      totalIncome: income, totalExpense: expenses, totalProfit: income - expenses,
    };

    setSaving(true);
    try {
      if (editing && batch?.id) {
        await updateDoc(doc(financeDb, 'batches', batch.id), payload);
      } else {
        await addDoc(collection(financeDb, 'batches'), { ...payload, timestamp: Timestamp.now() });
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('Save failed', describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const trekNames = treks.map(t => t.name ?? t.trekName ?? '').filter(Boolean);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.root}>
        <View style={s.header}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {editing ? `Edit Batch — ${batch?.batchCode}` : 'Add Batch'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={Colors.slate700} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {/* Basics */}
          <SectionTitle icon="information-circle-outline" title="Batch Details" />
          <Field label="Batch Code *">
            <Input value={f.batchCode} onChangeText={v => set('batchCode', v)} placeholder="BT123" />
          </Field>
          <Field label="Trek *">
            <View style={s.pickerBox}>
              <Picker selectedValue={f.trekName} onValueChange={v => set('trekName', v)}>
                <Picker.Item label="Select trek…" value="" />
                {trekNames.map(n => <Picker.Item key={n} label={n} value={n} />)}
              </Picker>
            </View>
          </Field>
          <View style={s.row}>
            <Field label="Start Date *" flex={1}>
              <Input value={f.startDate} onChangeText={v => set('startDate', v)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="End Date *" flex={1}>
              <Input value={f.endDate} onChangeText={v => set('endDate', v)} placeholder="YYYY-MM-DD" />
            </Field>
          </View>
          <View style={s.row}>
            <Field label="Booked *" flex={1}>
              <Input value={f.noOfPeople} onChangeText={v => set('noOfPeople', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
            <Field label="Base Price" flex={1}>
              <Input value={f.basePrice} onChangeText={v => set('basePrice', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
            <Field label="Discount" flex={1}>
              <Input value={f.totalDiscount} onChangeText={v => set('totalDiscount', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
          </View>

          {/* Transport */}
          <SectionTitle icon="bus-outline" title="Transport" />
          <View style={s.modeRow}>
            <ToolButton label="Calculate" onPress={() => set('transportMode', 'calc')} primary={f.transportMode === 'calc'} />
            <ToolButton label="Direct Amount" onPress={() => set('transportMode', 'direct')} primary={f.transportMode === 'direct'} />
          </View>
          {f.transportMode === 'calc' ? (
            <>
              <View style={s.row}>
                <Field label="Total KM" flex={1}>
                  <Input value={f.transportTotalKm} onChangeText={v => set('transportTotalKm', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
                <Field label="Rate / KM" flex={1}>
                  <Input value={f.transportRatePerKm} onChangeText={v => set('transportRatePerKm', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
              </View>
              <View style={s.row}>
                <Field label="Toll" flex={1}>
                  <Input value={f.transportTollCharge} onChangeText={v => set('transportTollCharge', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
                <Field label="Driver Bata" flex={1}>
                  <Input value={f.transportDriverBata} onChangeText={v => set('transportDriverBata', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
                <Field label="Shifts" flex={1}>
                  <Input value={f.transportDriverShifts} onChangeText={v => set('transportDriverShifts', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
              </View>
              <View style={s.row}>
                <Field label="Road Tax" flex={1}>
                  <Input value={f.transportRoadTax} onChangeText={v => set('transportRoadTax', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
                <Field label="Parking" flex={1}>
                  <Input value={f.transportParkingCharge} onChangeText={v => set('transportParkingCharge', v)} keyboardType="number-pad" placeholder="0" />
                </Field>
              </View>
            </>
          ) : (
            <Field label="Transport Amount">
              <Input value={f.transportDirectAmount} onChangeText={v => set('transportDirectAmount', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
          )}
          <Text style={s.calcLine}>Transport total: <Text style={s.calcVal}>{inr(preview.transport)}</Text></Text>

          {/* Homestay */}
          <SectionTitle icon="home-outline" title="Homestay" />
          <View style={s.modeRow}>
            <ToolButton label="Calculate" onPress={() => set('homestayMode', 'calc')} primary={f.homestayMode === 'calc'} />
            <ToolButton label="Direct Amount" onPress={() => set('homestayMode', 'direct')} primary={f.homestayMode === 'direct'} />
          </View>
          {f.homestayMode === 'calc' ? (
            <View style={s.row}>
              <Field label="People" flex={1}>
                <Input value={f.homestayPeople} onChangeText={v => set('homestayPeople', v)} keyboardType="number-pad" placeholder="0" />
              </Field>
              <Field label="Price / Person" flex={1}>
                <Input value={f.homestayPricePerPerson} onChangeText={v => set('homestayPricePerPerson', v)} keyboardType="number-pad" placeholder="0" />
              </Field>
              <Field label="Jeep" flex={1}>
                <Input value={f.homestayJeep} onChangeText={v => set('homestayJeep', v)} keyboardType="number-pad" placeholder="0" />
              </Field>
            </View>
          ) : (
            <Field label="Homestay Amount">
              <Input value={f.homestayDirectAmount} onChangeText={v => set('homestayDirectAmount', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
          )}
          <Text style={s.calcLine}>Homestay total: <Text style={s.calcVal}>{inr(preview.homestay)}</Text></Text>

          {/* Other expenses */}
          <SectionTitle icon="receipt-outline" title="Other Expenses" />
          <View style={s.row}>
            <Field label="Guide" flex={1}>
              <Input value={f.guideExpense} onChangeText={v => set('guideExpense', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
            <Field label="Permit" flex={1}>
              <Input value={f.permitExpense} onChangeText={v => set('permitExpense', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
            <Field label="Jeep" flex={1}>
              <Input value={f.jeepExpense} onChangeText={v => set('jeepExpense', v)} keyboardType="number-pad" placeholder="0" />
            </Field>
          </View>

          {f.otherExpensesItems.map((it, i) => (
            <View key={i} style={s.row}>
              <Field label={`Item ${i + 1}`} flex={2}>
                <Input
                  value={it.remark}
                  onChangeText={v => set('otherExpensesItems',
                    f.otherExpensesItems.map((x, j) => j === i ? { ...x, remark: v } : x))}
                  placeholder="Remark"
                />
              </Field>
              <Field label="Amount" flex={1}>
                <Input
                  value={it.amount}
                  onChangeText={v => set('otherExpensesItems',
                    f.otherExpensesItems.map((x, j) => j === i ? { ...x, amount: v } : x))}
                  keyboardType="number-pad" placeholder="0"
                />
              </Field>
              <TouchableOpacity
                style={s.rmBtn}
                onPress={() => set('otherExpensesItems', f.otherExpensesItems.filter((_, j) => j !== i))}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <ToolButton
            label="Add Expense Item" icon="add"
            onPress={() => set('otherExpensesItems', [...f.otherExpensesItems, { remark: '', amount: '' }])}
          />

          {/* Lead payments */}
          <SectionTitle icon="people-outline" title="Lead Payments" />
          {f.leadPayments.map((lp, i) => (
            <View key={i} style={s.row}>
              <Field label={`Lead ${i + 1}`} flex={2}>
                <View style={s.pickerBox}>
                  <Picker
                    selectedValue={lp.name}
                    onValueChange={v => set('leadPayments',
                      f.leadPayments.map((x, j) => j === i ? { ...x, name: v } : x))}
                  >
                    <Picker.Item label="Select lead…" value="" />
                    {leads.map(l => <Picker.Item key={l.id} label={l.name ?? ''} value={l.name ?? ''} />)}
                  </Picker>
                </View>
              </Field>
              <Field label="Amount" flex={1}>
                <Input
                  value={lp.amount}
                  onChangeText={v => set('leadPayments',
                    f.leadPayments.map((x, j) => j === i ? { ...x, amount: v } : x))}
                  keyboardType="number-pad" placeholder="0"
                />
              </Field>
              <TouchableOpacity
                style={s.rmBtn}
                onPress={() => set('leadPayments', f.leadPayments.filter((_, j) => j !== i))}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          {f.leadPayments.length < 5 && (
            <ToolButton
              label="Add Lead Payment" icon="add"
              onPress={() => set('leadPayments', [...f.leadPayments, { name: '', amount: '' }])}
            />
          )}

          <Field label="Batch Remarks">
            <Input
              value={f.batchRemarks}
              onChangeText={v => set('batchRemarks', v)}
              placeholder="Optional notes"
              multiline
              style={{ height: 78, paddingTop: 10, textAlignVertical: 'top' }}
            />
          </Field>

          {/* Live totals */}
          <View style={s.previewBox}>
            <View style={s.previewRow}>
              <Text style={s.previewLabel}>Income</Text>
              <Text style={s.previewValue}>{inr(preview.income)}</Text>
            </View>
            <View style={s.previewRow}>
              <Text style={s.previewLabel}>Expenses</Text>
              <Text style={s.previewValue}>{inr(preview.expenses)}</Text>
            </View>
            <View style={[s.previewRow, s.previewTotal]}>
              <Text style={s.previewLabelBold}>Profit</Text>
              <Text style={[s.previewValueBold, { color: preview.profit >= 0 ? Colors.success : Colors.danger }]}>
                {inr(preview.profit)}
              </Text>
            </View>
          </View>

          <View style={{ height: 12 }} />
        </ScrollView>

        <View style={s.footer}>
          <ToolButton label="Cancel" onPress={onClose} />
          <View style={{ flex: 1 }} />
          {saving
            ? <ActivityIndicator color={Colors.primary} />
            : <ToolButton label={editing ? 'Save Changes' : 'Add Batch'} icon="checkmark" onPress={save} primary />}
        </View>
      </ModalSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.slate50 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.slate900 },
  body:        { padding: 16, gap: 12, paddingBottom: 30 },
  row:         { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  modeRow:     { flexDirection: 'row', gap: 8 },
  pickerBox:   { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, backgroundColor: Colors.white, justifyContent: 'center', minHeight: 44 },
  rmBtn:       { width: 40, height: 44, borderRadius: 11, backgroundColor: Colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  calcLine:    { fontSize: 12, color: Colors.slate500, marginTop: -4 },
  calcVal:     { fontWeight: '800', color: Colors.slate900 },
  previewBox:  { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.slate200, padding: 14, gap: 8, marginTop: 6 },
  previewRow:  { flexDirection: 'row', alignItems: 'center' },
  previewLabel:{ flex: 1, fontSize: 13, color: Colors.slate500, fontWeight: '600' },
  previewValue:{ fontSize: 14, fontWeight: '700', color: Colors.slate900 },
  previewTotal:{ borderTopWidth: 1, borderTopColor: Colors.slate200, paddingTop: 8 },
  previewLabelBold: { flex: 1, fontSize: 14, color: Colors.slate900, fontWeight: '800' },
  previewValueBold: { fontSize: 17, fontWeight: '900' },
  footer:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.slate200 },
});
