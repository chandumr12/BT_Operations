import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel } from '@/components/ui';
import {
  KpiCard, KpiGrid, SectionTitle, DataTable, Pager, paginate,
  MonthPicker, ToolButton, BarChart, DonutChart, Column,
} from '@/components/finance/FinanceUI';
import { Colors } from '@/constants/Colors';
import { financeDb } from '@/utils/financeFirebase';
import {
  inr, thisMonthKey, MARKETING_CATS, QUARTER_LABELS, quarterOf, netColor,
} from '@/utils/finance';
import { exportExcel } from '@/utils/financeExport';
import { describeError } from '@/utils/errors';

interface Batch  { id: string; date?: string; trekName?: string; totalIncome?: number; totalExpense?: number; totalProfit?: number }
interface Expense { id: string; monthKey?: string; date?: string; category?: string; subCategory?: string; amount?: number; notes?: string }
interface Payroll { id: string; monthKey?: string; netPay?: number }

export default function FinanceDashboardScreen() {
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payroll,  setPayroll]  = useState<Payroll[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const [month, setMonth] = useState(thisMonthKey());
  const [year,  setYear]  = useState(new Date().getFullYear());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setErr('');
    try {
      const [bs, es, ps] = await Promise.all([
        getDocs(collection(financeDb, 'batches')),
        getDocs(collection(financeDb, 'expenses_global')),
        getDocs(collection(financeDb, 'payroll')),
      ]);
      setBatches(bs.docs.map(d => ({ id: d.id, ...d.data() } as Batch)));
      setExpenses(es.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
      setPayroll(ps.docs.map(d => ({ id: d.id, ...d.data() } as Payroll)));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [month]);

  /* ── Monthly batch aggregation ─────────────────────────────────────── */
  const filtered = useMemo(
    () => batches.filter(b => (b.date || '').startsWith(month)),
    [batches, month],
  );

  const groupedEntries = useMemo(() => {
    const acc: Record<string, { income: number; expense: number; profit: number; count: number }> = {};
    filtered.forEach(b => {
      const trek = b.trekName || 'Unknown';
      if (!acc[trek]) acc[trek] = { income: 0, expense: 0, profit: 0, count: 0 };
      acc[trek].income  += Number(b.totalIncome  || 0);
      acc[trek].expense += Number(b.totalExpense || 0);
      acc[trek].profit  += Number(b.totalProfit  || 0);
      acc[trek].count   += 1;
    });
    return Object.entries(acc).sort((a, b) => b[1].profit - a[1].profit);
  }, [filtered]);

  const totalIncome  = groupedEntries.reduce((s, [, d]) => s + d.income,  0);
  const totalExpense = groupedEntries.reduce((s, [, d]) => s + d.expense, 0);
  const totalProfit  = groupedEntries.reduce((s, [, d]) => s + d.profit,  0);
  const totalBatches = filtered.length;

  /* ── Ops / marketing / payroll ─────────────────────────────────────── */
  const monthOps  = useMemo(() => expenses.filter(e => (e.monthKey || '').startsWith(month)), [expenses, month]);
  const opsSpend  = useMemo(() => monthOps.reduce((s, e) => s + Number(e.amount || 0), 0), [monthOps]);

  const marketingBreakdown = useMemo(() => {
    const map: Record<string, number> = { google_ads: 0, insta_ads: 0, content_creator: 0 };
    monthOps.forEach(e => {
      if (e.category && MARKETING_CATS.includes(e.category)) map[e.category] += Number(e.amount || 0);
    });
    return [
      { name: 'Google Ads',       value: map.google_ads,       color: '#4285F4' },
      { name: 'Instagram Ads',    value: map.insta_ads,        color: '#E1306C' },
      { name: 'Content Creators', value: map.content_creator,  color: '#34A853' },
    ];
  }, [monthOps]);
  const marketingSpend = marketingBreakdown.reduce((s, r) => s + r.value, 0);

  const payrollSpend = useMemo(
    () => payroll.filter(p => (p.monthKey || '').startsWith(month))
                 .reduce((s, r) => s + Number(r.netPay || 0), 0),
    [payroll, month],
  );
  const companyNet = totalProfit - opsSpend - payrollSpend;

  /* ── Quarterly ─────────────────────────────────────────────────────── */
  const yearKey = String(year);
  const quarterly = useMemo(() => {
    const q = QUARTER_LABELS.map(label => ({ label, income: 0, expense: 0, profit: 0, count: 0, ops: 0, payroll: 0 }));
    batches.filter(b => (b.date || '').startsWith(yearKey)).forEach(b => {
      const i = quarterOf(b.date || '');
      if (i < 0) return;
      q[i].income  += Number(b.totalIncome  || 0);
      q[i].expense += Number(b.totalExpense || 0);
      q[i].profit  += Number(b.totalProfit  || 0);
      q[i].count   += 1;
    });
    expenses.forEach(e => {
      if (!(e.monthKey || '').startsWith(yearKey)) return;
      const i = quarterOf(e.monthKey || '');
      if (i >= 0) q[i].ops += Number(e.amount || 0);
    });
    payroll.forEach(p => {
      if (!(p.monthKey || '').startsWith(yearKey)) return;
      const i = quarterOf(p.monthKey || '');
      if (i >= 0) q[i].payroll += Number(p.netPay || 0);
    });
    return q.map(r => ({ ...r, companyNet: r.profit - r.ops - r.payroll }));
  }, [batches, expenses, payroll, yearKey]);

  const years = useMemo(() => {
    const set = new Set(batches.map(b => (b.date || '').slice(0, 4)).filter(Boolean));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort();
  }, [batches]);

  /* ── Exports ───────────────────────────────────────────────────────── */
  const handleExportMonthly = async () => {
    try {
      await exportExcel(`BT_Trek_Report_${month}`, [
        {
          name: 'Monthly Report',
          rows: groupedEntries.map(([trek, d]) => ({
            'Trek Name': trek,
            'Total Income': d.income,
            'Total Expense': d.expense,
            'Total Profit': d.profit,
            'No. of Batches': d.count,
          })),
        },
        {
          name: 'Ops Summary',
          rows: [
            { Metric: 'Batch Profit (month)', Amount: totalProfit },
            { Metric: 'Ops Spend (month)',    Amount: opsSpend },
            { Metric: 'Payroll (month)',      Amount: payrollSpend },
            { Metric: 'Company Net (month)',  Amount: companyNet },
          ],
        },
      ]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  const handleExportMarketing = async () => {
    try {
      await exportExcel(`BT_Marketing_${month}`, [
        {
          name: `Marketing_${month}`,
          rows: monthOps
            .filter(e => e.category && MARKETING_CATS.includes(e.category))
            .map(e => ({
              Date: e.date || '',
              MonthKey: e.monthKey || '',
              Category: e.category,
              SubCategory: e.subCategory || '',
              Amount: Number(e.amount || 0),
              Notes: e.notes || '',
            })),
        },
        {
          name: 'Marketing_Summary',
          rows: marketingBreakdown.map(m => ({ Channel: m.name, Amount: m.value })),
        },
      ]);
    } catch (e) { Alert.alert('Export failed', describeError(e)); }
  };

  /* ── Table configs ─────────────────────────────────────────────────── */
  const trekRows = groupedEntries.map(([trek, d]) => ({
    id: trek, trek, income: inr(d.income), expense: inr(d.expense), profit: inr(d.profit), count: d.count,
  }));
  const trekCols: Column[] = [
    { key: 'trek',    label: 'Trek Name',      width: 130 },
    { key: 'income',  label: 'Total Income',   width: 105, align: 'right' },
    { key: 'expense', label: 'Total Expense',  width: 105, align: 'right' },
    { key: 'profit',  label: 'Total Profit',   width: 105, align: 'right' },
    { key: 'count',   label: 'No. of Batches', width: 100, align: 'right' },
  ];
  const totalPages = Math.max(1, Math.ceil(trekRows.length / pageSize));

  const qCols: Column[] = [
    { key: 'label',   label: 'Quarter',       width: 118 },
    { key: 'income',  label: 'Total Income',  width: 105, align: 'right' },
    { key: 'expense', label: 'Total Expense', width: 105, align: 'right' },
    { key: 'profit',  label: 'Total Profit',  width: 105, align: 'right' },
    { key: 'count',   label: 'Batches',       width: 76,  align: 'right' },
  ];
  const qNetCols: Column[] = [
    { key: 'label',   label: 'Quarter',      width: 118 },
    { key: 'profit',  label: 'Batch Profit', width: 105, align: 'right' },
    { key: 'ops',     label: 'Ops Spend',    width: 100, align: 'right' },
    { key: 'payroll', label: 'Payroll',      width: 100, align: 'right' },
    {
      key: 'companyNet', label: 'Company Net', width: 112, align: 'right',
      render: (r: any) => (
        <Text style={[s.netCell, { color: netColor(r._net) }]}>{r.companyNet}</Text>
      ),
    },
  ];

  if (loading) {
    return (
      <AppShell>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <PageTitle
          icon="stats-chart-outline"
          title="Dashboard"
          subtitle={`${totalBatches} batches in ${month}`}
        />

        {!!err && <Panel style={s.errBox}><Text style={s.errText}>{err}</Text></Panel>}

        {/* KPI row 1 — batches */}
        <KpiGrid>
          <KpiCard title="Monthly Income"   value={inr(totalIncome)}  sub="Before expenses" />
          <KpiCard title="Monthly Expenses" value={inr(totalExpense)} sub="Batch expenses only" />
          <KpiCard title="Monthly Profit"   value={inr(totalProfit)}
                   sub={totalIncome ? `${Math.round((totalProfit / totalIncome) * 100)}% margin` : '—'} />
          <KpiCard title="Batches this month" value={String(totalBatches)} sub="Across all treks" />
        </KpiGrid>

        {/* KPI row 2 — ops / payroll / net / marketing */}
        <KpiGrid>
          <KpiCard title="Ops Spend (MTD)"     value={inr(opsSpend)}      sub="All ops categories" />
          <KpiCard title="Payroll (MTD)"       value={inr(payrollSpend)}  sub="Paid & pending" />
          <KpiCard title="Company Net (Month)" value={inr(companyNet)}    sub="Batch Profit − Ops − Payroll"
                   valueColor={netColor(companyNet)} />
          <KpiCard title="Marketing Spend (MTD)" value={inr(marketingSpend)} sub="Google/Instagram/Creators" />
        </KpiGrid>

        {/* Filters + exports */}
        <Panel style={{ gap: 12 }}>
          <MonthPicker value={month} onChange={setMonth} label="Select Month" />
          <View style={s.btnRow}>
            <ToolButton label="Export Marketing" icon="megaphone-outline" onPress={handleExportMarketing} />
            <ToolButton label="Export Monthly" icon="download-outline" onPress={handleExportMonthly} primary />
          </View>
        </Panel>

        {/* Monthly trek table */}
        <DataTable columns={trekCols} rows={paginate(trekRows, page, pageSize)}
                   emptyText="No data available for the selected month." />
        {trekRows.length > 0 && (
          <Pager page={page} setPage={setPage} totalPages={totalPages}
                 pageSize={pageSize} setPageSize={setPageSize} />
        )}

        {/* Charts */}
        {groupedEntries.length > 0 && (
          <>
            <SectionTitle icon="trending-up-outline" title="Trek-wise Profit" />
            <Panel>
              <BarChart data={groupedEntries.slice(0, 10).map(([name, d]) => ({ name, value: d.profit }))} />
            </Panel>

            <SectionTitle icon="pie-chart-outline" title="Income vs Expense" />
            <Panel>
              <DonutChart data={[
                { name: 'Income',  value: totalIncome,  color: '#00C49F' },
                { name: 'Expense', value: totalExpense, color: '#FF8042' },
              ]} />
            </Panel>

            <SectionTitle icon="megaphone-outline" title="Marketing Breakdown" />
            <Panel><DonutChart data={marketingBreakdown} /></Panel>
          </>
        )}

        {/* Quarterly */}
        <SectionTitle icon="calendar-outline" title={`Quarterly Report (Batches) — ${year}`} />
        <View style={s.yearRow}>
          {years.map(y => (
            <ToolButton
              key={y}
              label={y}
              onPress={() => setYear(Number(y))}
              primary={Number(y) === year}
            />
          ))}
        </View>
        <DataTable
          columns={qCols}
          rows={quarterly.map((q, i) => ({
            id: i, label: q.label, income: inr(q.income), expense: inr(q.expense),
            profit: inr(q.profit), count: q.count,
          }))}
        />

        <SectionTitle icon="flag-outline" title="Quarterly Company Net (incl. Ops + Payroll)" />
        <DataTable
          columns={qNetCols}
          rows={quarterly.map((q, i) => ({
            id: i, label: q.label, profit: inr(q.profit), ops: inr(q.ops),
            payroll: inr(q.payroll), companyNet: inr(q.companyNet), _net: q.companyNet,
          }))}
        />

        <View style={{ height: 28 }} />
      </ScrollView>
    </AppShell>
  );
}

const s = StyleSheet.create({
  scroll:  { padding: 16, gap: 14, paddingBottom: 40 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  btnRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  yearRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  netCell: { fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  errBox:  { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  errText: { color: Colors.danger, fontSize: 12.5 },
});
