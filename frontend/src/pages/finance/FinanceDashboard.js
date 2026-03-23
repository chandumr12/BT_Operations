// src/pages/Dashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/financeFirebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';

const COLORS = ['#00C49F', '#FF8042'];
const MKT_COLORS = ['#4285F4', '#E1306C', '#34A853']; // google, insta, creators
const MARKETING_CATS = ['google_ads', 'insta_ads', 'content_creator'];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Dashboard() {
  const [batches, setBatches] = useState([]);
  const [expenses, setExpenses] = useState([]); // expenses_global
  const [payroll, setPayroll] = useState([]);   // payroll

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Pagination for Monthly Trek table
  const [monthPage, setMonthPage] = useState(1);
  const [monthPageSize, setMonthPageSize] = useState(10);

  useEffect(() => {
    (async () => {
      const batchSnap = await getDocs(collection(db, 'batches'));
      const batchList = batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBatches(batchList);

      const expSnap = await getDocs(collection(db, 'expenses_global'));
      const expList = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(expList);

      const paySnap = await getDocs(collection(db, 'payroll'));
      const payList = paySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPayroll(payList);
    })();
  }, []);

  // Reset monthly pager when month changes
  useEffect(() => { setMonthPage(1); }, [selectedMonth]);

  // ------ Monthly aggregation (Batches) ------
  const filtered = useMemo(
    () => batches.filter(b => (b.date || '').startsWith(selectedMonth)),
    [batches, selectedMonth]
  );

  const grouped = useMemo(() => {
    return filtered.reduce((acc, batch) => {
      const trek = batch.trekName || 'Unknown';
      if (!acc[trek]) acc[trek] = { income: 0, expense: 0, profit: 0, count: 0 };
      acc[trek].income += Number(batch.totalIncome || 0);
      acc[trek].expense += Number(batch.totalExpense || 0);
      acc[trek].profit += Number(batch.totalProfit || 0);
      acc[trek].count += 1;
      return acc;
    }, {});
  }, [filtered]);

  const groupedEntries = useMemo(
    () =>
      Object.entries(grouped).sort((a, b) => b[1].profit - a[1].profit),
    [grouped]
  );

  const chartData = useMemo(
    () =>
      groupedEntries.map(([trek, data]) => ({
        name: trek,
        income: data.income,
        expense: data.expense,
        profit: data.profit,
      })),
    [groupedEntries]
  );

  const totalIncome = chartData.reduce((s, i) => s + i.income, 0);
  const totalExpense = chartData.reduce((s, i) => s + i.expense, 0);
  const totalProfit  = chartData.reduce((s, i) => s + i.profit, 0);
  const totalBatches = filtered.length;

  // ------ Monthly aggregation (Ops Expenses & Marketing) ------
  const monthOps = useMemo(
    () => expenses.filter(e => (e.monthKey || '').startsWith(selectedMonth)),
    [expenses, selectedMonth]
  );
  const opsSpend = useMemo(
    () => monthOps.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [monthOps]
  );

  const marketingBreakdown = useMemo(() => {
    const map = { google_ads: 0, insta_ads: 0, content_creator: 0 };
    monthOps.forEach(e => {
      if (MARKETING_CATS.includes(e.category)) {
        map[e.category] += Number(e.amount || 0);
      }
    });
    return [
      { name: 'Google Ads', category: 'google_ads', value: map.google_ads },
      { name: 'Instagram Ads', category: 'insta_ads', value: map.insta_ads },
      { name: 'Content Creators', category: 'content_creator', value: map.content_creator },
    ];
  }, [monthOps]);
  const marketingSpend = marketingBreakdown.reduce((s, r) => s + r.value, 0);

  // Company Net for month (batch profit − ops spend − payroll)
  const monthPayroll = useMemo(
    () => payroll.filter(p => (p.monthKey || '').startsWith(selectedMonth)),
    [payroll, selectedMonth]
  );
  const payrollSpend = useMemo(
    () => monthPayroll.reduce((s, r) => s + Number(r.netPay || 0), 0),
    [monthPayroll]
  );
  const companyNet = totalProfit - opsSpend - payrollSpend;

  // ------ Quarterly (year) — Batches only ------
  const yearlyFiltered = useMemo(
    () => batches.filter(b => (b.date || '').startsWith(String(selectedYear))),
    [batches, selectedYear]
  );
  const quarterlyData = useMemo(() => {
    const q = [
      { label: 'Q1 (Jan–Mar)', income: 0, expense: 0, profit: 0, count: 0 },
      { label: 'Q2 (Apr–Jun)', income: 0, expense: 0, profit: 0, count: 0 },
      { label: 'Q3 (Jul–Sep)', income: 0, expense: 0, profit: 0, count: 0 },
      { label: 'Q4 (Oct–Dec)', income: 0, expense: 0, profit: 0, count: 0 },
    ];
    yearlyFiltered.forEach(b => {
      const m = parseInt((b.date || '').split('-')[1], 10);
      const idx = Math.floor((m - 1) / 3);
      if (idx >= 0 && idx < 4) {
        q[idx].income += Number(b.totalIncome || 0);
        q[idx].expense += Number(b.totalExpense || 0);
        q[idx].profit += Number(b.totalProfit || 0);
        q[idx].count += 1;
      }
    });
    return q;
  }, [yearlyFiltered]);

  // ------ Quarterly (year) — Ops + Payroll ------
  const yearKey = String(selectedYear);
  const opsByQuarter = useMemo(() => {
    const q = [0,0,0,0];
    expenses.forEach(e => {
      const mk = e.monthKey || '';
      if (!mk.startsWith(yearKey)) return;
      const month = parseInt(mk.split('-')[1], 10);
      if (!month) return;
      const idx = Math.floor((month - 1) / 3);
      q[idx] += Number(e.amount || 0);
    });
    return q; // [Q1,Q2,Q3,Q4]
  }, [expenses, yearKey]);

  const payrollByQuarter = useMemo(() => {
    const q = [0,0,0,0];
    payroll.forEach(p => {
      const mk = p.monthKey || '';
      if (!mk.startsWith(yearKey)) return;
      const month = parseInt(mk.split('-')[1], 10);
      if (!month) return;
      const idx = Math.floor((month - 1) / 3);
      q[idx] += Number(p.netPay || 0);
    });
    return q;
  }, [payroll, yearKey]);

  const quarterlyNet = useMemo(() => {
    return quarterlyData.map((row, i) => ({
      label: row.label,
      batchIncome: row.income,
      batchExpense: row.expense,
      batchProfit: row.profit,
      ops: opsByQuarter[i] || 0,
      payroll: payrollByQuarter[i] || 0,
      companyNet: row.profit - (opsByQuarter[i] || 0) - (payrollByQuarter[i] || 0),
      count: row.count
    }));
  }, [quarterlyData, opsByQuarter, payrollByQuarter]);

  // ------ Export: Monthly Trek Report (+Ops summary) ------
  const handleExport = () => {
    const rows = groupedEntries.map(([trek, data]) => ({
      'Trek Name': trek,
      'Total Income': data.income,
      'Total Expense': data.expense,
      'Total Profit': data.profit,
      'No. of Batches': data.count,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Monthly Report');

    const opsRows = [
      { Metric: 'Batch Profit (month)', Amount: totalProfit },
      { Metric: 'Ops Spend (month)', Amount: opsSpend },
      { Metric: 'Payroll (month)', Amount: payrollSpend },
      { Metric: 'Company Net (month)', Amount: companyNet },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opsRows), 'Ops Summary');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `BT_Trek_Report_${selectedMonth}.xlsx`);
  };

  // Marketing-only export (month)
  const handleExportMarketing = () => {
    const rows = monthOps
      .filter(e => MARKETING_CATS.includes(e.category))
      .map(e => ({
        Date: e.date || '',
        MonthKey: e.monthKey || '',
        Category: e.category,
        SubCategory: e.subCategory || '',
        Amount: Number(e.amount || 0),
        Notes: e.notes || '',
      }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Marketing_${selectedMonth}`);

    const sumWs = XLSX.utils.json_to_sheet(
      marketingBreakdown.map(m => ({ Channel: m.name, Amount: m.value }))
    );
    XLSX.utils.book_append_sheet(wb, sumWs, 'Marketing_Summary');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `BT_Marketing_${selectedMonth}.xlsx`);
  };

  const years = Array.from(
    new Set(batches.map(b => (b.date || '').slice(0, 4)).filter(Boolean))
  )
    .concat([String(new Date().getFullYear())])
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  // helpers
  const paginate = (arr, page, size) => {
    const start = (page - 1) * size;
    return arr.slice(start, start + size);
  };
  const monthTotalPages = Math.max(1, Math.ceil(groupedEntries.length / monthPageSize));

  return (
    <div className="finance-scope">
    <div className="container">
      {/* Page header */}
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 16 }}>
        <div className="topbar__left">📊 <span>Dashboard</span></div>
        <div className="topbar__right">{totalBatches} batches in {selectedMonth}</div>
      </div>

      {/* KPI Cards – Row 1 (Batches) */}
      <section className="cards-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card__title">Monthly Income</div>
          <div className="card__metric">{inr(totalIncome)}</div>
          <div className="card__sub">Before expenses</div>
        </div>
        <div className="card">
          <div className="card__title">Monthly Expenses</div>
          <div className="card__metric">{inr(totalExpense)}</div>
          <div className="card__sub">Batch expenses only</div>
        </div>
        <div className="card">
          <div className="card__title">Monthly Profit</div>
          <div className="card__metric">{inr(totalProfit)}</div>
          <div className="card__sub">{totalIncome ? `${Math.round((totalProfit / totalIncome) * 100)}% margin` : '—'}</div>
        </div>
        <div className="card">
          <div className="card__title">Batches this month</div>
          <div className="card__metric">{totalBatches}</div>
          <div className="card__sub">Across all treks</div>
        </div>
      </section>

      {/* KPI Cards – Row 2 (Ops/Marketing/Company Net) */}
      <section className="cards-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card__title">Ops Spend (MTD)</div>
          <div className="card__metric">{inr(opsSpend)}</div>
          <div className="card__sub">All ops categories</div>
        </div>
        <div className="card">
          <div className="card__title">Payroll (MTD)</div>
          <div className="card__metric">{inr(payrollSpend)}</div>
          <div className="card__sub">Paid & pending</div>
        </div>
        <div className="card">
          <div className="card__title">Company Net (Month)</div>
          <div className="card__metric">{inr(companyNet)}</div>
          <div className="card__sub">Batch Profit − Ops − Payroll</div>
        </div>
        <div className="card">
          <div className="card__title">Marketing Spend (MTD)</div>
          <div className="card__metric">{inr(marketingSpend)}</div>
          <div className="card__sub">Google/Instagram/Creators</div>
        </div>
      </section>

      {/* Filters + Export */}
      <div className="filters">
        <div className="field">
          <label className="field__label">Select Month</label>
          <input
            className="input"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>

        <div className="filters__spacer" />

        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={monthPageSize}
            onChange={(e) => { setMonthPageSize(parseInt(e.target.value, 10)); setMonthPage(1); }}
          >
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button className="btn" onClick={handleExportMarketing}>Export Marketing</button>
        <button className="btn btn--primary" onClick={handleExport}>📥 Export Monthly</button>
      </div>

      {/* Monthly Trek Table */}
      {groupedEntries.length === 0 ? (
        <div className="empty-state">No data available for the selected month.</div>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Trek Name</th>
                  <th>Total Income</th>
                  <th>Total Expense</th>
                  <th>Total Profit</th>
                  <th className="hide-sm">No. of Batches</th>
                </tr>
              </thead>
              <tbody>
                {paginate(groupedEntries, monthPage, monthPageSize).map(([trek, data]) => (
                  <tr key={trek}>
                    <td>{trek}</td>
                    <td>{inr(data.income)}</td>
                    <td>{inr(data.expense)}</td>
                    <td>{inr(data.profit)}</td>
                    <td className="hide-sm">{data.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pager page={monthPage} setPage={setMonthPage} totalPages={monthTotalPages} />
          </div>

          {/* Charts */}
          <h3 style={{ marginTop: 18 }}>📈 Trek-wise Profit</h3>
          <div className="card" style={{ marginTop: 8 }}>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h3 style={{ marginTop: 18 }}>🧾 Income vs Expense</h3>
          <div className="card" style={{ marginTop: 8 }}>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Income', value: totalIncome },
                      { name: 'Expense', value: totalExpense },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label
                  >
                    {COLORS.map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Marketing Breakdown */}
          <h3 style={{ marginTop: 18 }}>📣 Marketing Breakdown</h3>
          <div className="card" style={{ marginTop: 8 }}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={marketingBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label
                  >
                    {marketingBreakdown.map((_, i) => (
                      <Cell key={i} fill={MKT_COLORS[i % MKT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Quarterly Section (Batches only) */}
      <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 12 }}>
        <div className="topbar__left">📅 <span>Quarterly Report (Batches)</span></div>
        <div className="topbar__right">
          <label className="field__label" style={{ marginRight: 8 }}>Select Year</label>
          <select
            className="select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Total Income</th>
              <th>Total Expense</th>
              <th>Total Profit</th>
              <th className="hide-sm">No. of Batches</th>
            </tr>
          </thead>
          <tbody>
            {quarterlyData.map((q, i) => (
              <tr key={i}>
                <td>{q.label}</td>
                <td>{inr(q.income)}</td>
                <td>{inr(q.expense)}</td>
                <td>{inr(q.profit)}</td>
                <td className="hide-sm">{q.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quarterly Net (Batches − Ops − Payroll) */}
      <h3 style={{ marginTop: 18 }}>🏁 Quarterly Company Net (incl. Ops + Payroll)</h3>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Batch Profit</th>
              <th>Ops Spend</th>
              <th>Payroll</th>
              <th>Company Net</th>
            </tr>
          </thead>
          <tbody>
            {quarterlyNet.map((row, i) => (
              <tr key={i}>
                <td>{row.label}</td>
                <td>{inr(row.batchProfit)}</td>
                <td>{inr(row.ops)}</td>
                <td>{inr(row.payroll)}</td>
                <td>{inr(row.companyNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

export default Dashboard;