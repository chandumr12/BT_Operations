// src/pages/Reports.js
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/financeFirebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MARKETING_CATS = ['google_ads', 'insta_ads', 'content_creator'];
const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A66DD4', '#E57373'];

function Reports() {
  const [batches, setBatches] = useState([]);
  const [expenses, setExpenses] = useState([]); // expenses_global
  const [payroll, setPayroll] = useState([]);   // payroll

  const [filters, setFilters] = useState({ month: '', trek: '', lead: '' });
  const [search, setSearch] = useState('');

  // Pagination state (one set per table)
  const [trekPage, setTrekPage] = useState(1);
  const [trekPageSize, setTrekPageSize] = useState(10);

  const [monthPage, setMonthPage] = useState(1);
  const [monthPageSize, setMonthPageSize] = useState(10);

  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(10);

  // Ops table pager
  const [opsPage, setOpsPage] = useState(1);
  const [opsPageSize, setOpsPageSize] = useState(10);

  // Ops table filters
  const [opsCategory, setOpsCategory] = useState(''); // enum/category filter
  const [opsSearch, setOpsSearch] = useState('');     // search vendor/notes

  // Marketing-only view
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [mktPage, setMktPage] = useState(1);
  const [mktPageSize, setMktPageSize] = useState(10);

  // Company Net section (Monthly & Quarterly)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [netMonthPage, setNetMonthPage] = useState(1);
  const [netMonthPageSize, setNetMonthPageSize] = useState(12);

  useEffect(() => {
    (async () => {
      const snapB = await getDocs(collection(db, 'batches'));
      setBatches(snapB.docs.map(d => ({ id: d.id, ...d.data() })));

      const snapE = await getDocs(collection(db, 'expenses_global'));
      setExpenses(snapE.docs.map(d => ({ id: d.id, ...d.data() })));

      const snapP = await getDocs(collection(db, 'payroll'));
      setPayroll(snapP.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // Helpers
  const monthLabel = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('default', { month: 'short', year: 'numeric' });
    } catch {
      return iso.slice(0, 7);
    }
  };
  const monthKeyFromDate = (iso) => (iso || '').slice(0, 7);
  const expMonthLabel = (monthKey) => {
    if (!monthKey) return '';
    const iso = `${monthKey}-01`;
    return new Date(iso).toLocaleString('default', { month: 'short', year: 'numeric' });
  };
  const currency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const paginate = (arr, page, size) => {
    const start = (page - 1) * size;
    return arr.slice(start, start + size);
  };

  // Options for filters (from batches)
  const uniqueMonths = useMemo(
    () => [...new Set(batches.map(b => monthLabel(b.date)))].filter(Boolean),
    [batches]
  );
  const uniqueTreks = useMemo(
    () => [...new Set(batches.map(b => b.trekName).filter(Boolean))],
    [batches]
  );
  const uniqueLeads = useMemo(() => {
    const set = new Set();
    batches.forEach(b => {
      if (b.leadName) set.add(b.leadName);
      (b.leadPayments || []).forEach(lp => lp?.name && set.add(lp.name));
    });
    return [...set];
  }, [batches]);

  // years list for Company Net section (union of years seen in batches/expenses/payroll)
  const years = useMemo(() => {
    const s = new Set();
    const addYear = (y) => { if (y) s.add(String(y)); };
    batches.forEach(b => addYear((b.date || '').slice(0,4)));
    expenses.forEach(e => addYear((e.monthKey || '').slice(0,4)));
    payroll.forEach(p => addYear((p.monthKey || '').slice(0,4)));
    addYear(new Date().getFullYear());
    return Array.from(s).sort();
  }, [batches, expenses, payroll]);

  // Filter + search (batches)
  const filteredBatches = useMemo(() => {
    const s = (search || '').toLowerCase();
    return batches.filter(b => {
      const m = monthLabel(b.date);
      const trekOk = !filters.trek || b.trekName === filters.trek;
      const monthOk = !filters.month || m === filters.month;
      const leadOk = !filters.lead
        ? true
        : (b.leadName === filters.lead) ||
          (b.leadPayments || []).some(lp => lp?.name === filters.lead);
      const searchOk =
        !s ||
        (b.trekName || '').toLowerCase().includes(s) ||
        (b.batchCode || '').toLowerCase().includes(s) ||
        (b.leadName || '').toLowerCase().includes(s) ||
        (b.leadPayments || []).some(lp => (lp?.name || '').toLowerCase().includes(s));
      return trekOk && monthOk && leadOk && searchOk;
    });
  }, [batches, filters, search]);

  // Reset pagers when filters/search change
  useEffect(() => {
    setTrekPage(1);
    setMonthPage(1);
    setLeadPage(1);
    setOpsPage(1);
    setMktPage(1);
    setNetMonthPage(1);
  }, [filters, search, opsCategory, opsSearch, marketingOnly, selectedYear]);

  // Summary aggregations (batches)
  const summary = useMemo(() => {
    let totalIncome = 0, totalExpense = 0, totalProfit = 0;
    const trekWise = {};
    const monthWise = {};
    const leadWise = {};

    filteredBatches.forEach(b => {
      const income = Number(b.totalIncome || b.income || 0);
      const expense = Number(b.totalExpense || 0);
      const profit = Number(b.totalProfit || b.profit || 0);

      totalIncome += income;
      totalExpense += expense;
      totalProfit += profit;

      // Trek
      if (b.trekName) {
        trekWise[b.trekName] ??= { income: 0, expense: 0, profit: 0, count: 0 };
        trekWise[b.trekName].income += income;
        trekWise[b.trekName].expense += expense;
        trekWise[b.trekName].profit += profit;
        trekWise[b.trekName].count += 1;
      }
      // Month
      const m = monthLabel(b.date);
      if (m) {
        monthWise[m] ??= { income: 0, expense: 0, profit: 0, count: 0 };
        monthWise[m].income += income;
        monthWise[m].expense += expense;
        monthWise[m].profit += profit;
        monthWise[m].count += 1;
      }
      // Lead (old + new schema)
      if (b.leadName) {
        leadWise[b.leadName] ??= { count: 0, paid: 0 };
        leadWise[b.leadName].count += 1;
      }
      (b.leadPayments || []).forEach(lp => {
        if (!lp?.name) return;
        leadWise[lp.name] ??= { count: 0, paid: 0 };
        leadWise[lp.name].count += 1;
        leadWise[lp.name].paid += Number(lp.amount || 0);
      });
    });

    return { totalIncome, totalExpense, totalProfit, trekWise, monthWise, leadWise };
  }, [filteredBatches]);

  // ---------- OPS / MARKETING (from expenses_global) ----------
  const selectedMonthLabel = filters.month; // e.g. "Aug 2025" or ''
  const opsFiltered = useMemo(() => {
    return expenses.filter(e => {
      const mLabel = expMonthLabel(e.monthKey);
      const monthOk = !selectedMonthLabel || mLabel === selectedMonthLabel;
      const catOk = !opsCategory || e.category === opsCategory;
      const s = (opsSearch || '').toLowerCase();
      const searchOk =
        !s ||
        (e.subCategory || '').toLowerCase().includes(s) ||
        (e.notes || '').toLowerCase().includes(s);
      // if Marketing-only toggle is ON, filter to marketing categories
      const mktOk = !marketingOnly || MARKETING_CATS.includes(e.category);
      return monthOk && catOk && searchOk && mktOk;
    });
  }, [expenses, selectedMonthLabel, opsCategory, opsSearch, marketingOnly]);

  const opsCategoriesTotal = useMemo(() => {
    const byCat = {};
    opsFiltered.forEach(e => {
      const key = e.category || 'other';
      byCat[key] ??= 0;
      byCat[key] += Number(e.amount || 0);
    });
    return byCat; // { rent: 30000, wifi: 1200, ... }
  }, [opsFiltered]);

  const opsRows = useMemo(
    () => Object.entries(opsCategoriesTotal).sort((a,b) => b[1] - a[1]),
    [opsCategoriesTotal]
  );

  const opsTotal = useMemo(
    () => opsFiltered.reduce((s, e) => s + Number(e.amount || 0), 0),
    [opsFiltered]
  );

  const marketingTotal = useMemo(
    () => opsFiltered
      .filter(e => MARKETING_CATS.includes(e.category))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
    [opsFiltered]
  );

  // ---------- PAYROLL (from payroll) ----------
  const payrollFiltered = useMemo(() => {
    return payroll.filter(p => {
      const mLabel = expMonthLabel(p.monthKey);
      const monthOk = !selectedMonthLabel || mLabel === selectedMonthLabel;
      return monthOk; // could add status filter later
    });
  }, [payroll, selectedMonthLabel]);

  const payrollTotal = useMemo(
    () => payrollFiltered.reduce((s, p) => s + Number(p.netPay || 0), 0),
    [payrollFiltered]
  );

  // Company Net across the (current) view
  const companyNet = summary.totalProfit - opsTotal - payrollTotal;

  // Derived arrays for pagination (batches)
  const trekRows = useMemo(
    () => Object.entries(summary.trekWise || {}).sort((a,b) => b[1].profit - a[1].profit),
    [summary.trekWise]
  );
  const monthRows = useMemo(
    () => Object.entries(summary.monthWise || {}).sort((a,b) => a[0].localeCompare(b[0])),
    [summary.monthWise]
  );
  const leadRows = useMemo(
    () => Object.entries(summary.leadWise || {}).sort((a,b) => (b[1].paid || 0) - (a[1].paid || 0)),
    [summary.leadWise]
  );

  const trekTotalPages  = Math.max(1, Math.ceil(trekRows.length  / trekPageSize));
  const monthTotalPages = Math.max(1, Math.ceil(monthRows.length / monthPageSize));
  const leadTotalPages  = Math.max(1, Math.ceil(leadRows.length  / leadPageSize));
  const opsTotalPages   = Math.max(1, Math.ceil(opsRows.length   / opsPageSize));

  // ---------- Marketing-only breakdown ----------
  const marketingCatMap = useMemo(() => {
    const map = {};
    opsFiltered
      .filter(e => MARKETING_CATS.includes(e.category))
      .forEach(e => {
        map[e.category] ??= 0;
        map[e.category] += Number(e.amount || 0);
      });
    return map; // { google_ads: 12345, insta_ads: 6789, content_creator: 2345 }
  }, [opsFiltered]);

  const marketingRows = useMemo(
    () => Object.entries(marketingCatMap).sort((a,b) => b[1] - a[1]),
    [marketingCatMap]
  );

  const marketingPieData = useMemo(
    () => marketingRows.map(([name, value]) => ({ name, value })),
    [marketingRows]
  );

  const mktTotalPages = Math.max(1, Math.ceil(marketingRows.length / mktPageSize));

  // ===== Company Net (Monthly & Quarterly) — full-year view =====
  const yearKey = String(selectedYear);
  const monthKeysInYear = useMemo(() => {
    const list = [];
    for (let m = 1; m <= 12; m++) {
      list.push(`${yearKey}-${String(m).padStart(2,'0')}`);
    }
    return list;
  }, [yearKey]);

  const netMonthlyRows = useMemo(() => {
    const profByMonth = {};
    batches.forEach(b => {
      const mk = monthKeyFromDate(b.date);
      if (!mk.startsWith(yearKey)) return;
      profByMonth[mk] = (profByMonth[mk] || 0) + Number(b.totalProfit || b.profit || 0);
    });

    const opsByMonth = {};
    expenses.forEach(e => {
      const mk = e.monthKey || '';
      if (!mk.startsWith(yearKey)) return;
      opsByMonth[mk] = (opsByMonth[mk] || 0) + Number(e.amount || 0);
    });

    const payByMonth = {};
    payroll.forEach(p => {
      const mk = p.monthKey || '';
      if (!mk.startsWith(yearKey)) return;
      payByMonth[mk] = (payByMonth[mk] || 0) + Number(p.netPay || 0);
    });

    return monthKeysInYear.map(mk => {
      const batchProfit = profByMonth[mk] || 0;
      const ops = opsByMonth[mk] || 0;
      const pay = payByMonth[mk] || 0;
      return {
        monthKey: mk,
        label: new Date(`${mk}-01`).toLocaleString('default', { month: 'short', year: 'numeric' }),
        batchProfit,
        ops,
        payroll: pay,
        companyNet: batchProfit - ops - pay,
      };
    });
  }, [batches, expenses, payroll, monthKeysInYear, yearKey]);

  const netQuarterlyRows = useMemo(() => {
    const q = [
      { label: 'Q1 (Jan–Mar)', batchProfit: 0, ops: 0, payroll: 0, companyNet: 0 },
      { label: 'Q2 (Apr–Jun)', batchProfit: 0, ops: 0, payroll: 0, companyNet: 0 },
      { label: 'Q3 (Jul–Sep)', batchProfit: 0, ops: 0, payroll: 0, companyNet: 0 },
      { label: 'Q4 (Oct–Dec)', batchProfit: 0, ops: 0, payroll: 0, companyNet: 0 },
    ];
    netMonthlyRows.forEach(r => {
      const month = parseInt(r.monthKey.split('-')[1], 10);
      const idx = Math.floor((month - 1) / 3);
      q[idx].batchProfit += r.batchProfit;
      q[idx].ops        += r.ops;
      q[idx].payroll    += r.payroll;
      q[idx].companyNet += r.companyNet;
    });
    return q;
  }, [netMonthlyRows]);

  const netMonthTotalPages = Math.max(1, Math.ceil(netMonthlyRows.length / netMonthPageSize));

  // ---------- Exports ----------
  // Excel: full report with Ops/Payroll/Net sheets too
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Trek-wise
    const trekRowsX = trekRows.map(([name, d]) => ({
      Trek: name,
      TotalIncome: d.income,
      TotalExpense: d.expense,
      TotalProfit: d.profit,
      Batches: d.count,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trekRowsX), 'Trek-wise');

    // Monthly
    const monthRowsX = monthRows.map(([m, d]) => ({
      Month: m,
      TotalIncome: d.income,
      TotalExpense: d.expense,
      TotalProfit: d.profit,
      Batches: d.count,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthRowsX), 'Monthly');

    // Lead-wise
    const leadRowsX = leadRows.map(([lead, d]) => ({
      Lead: lead,
      Batches: d.count || 0,
      TotalPaidToLead: d.paid || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadRowsX), 'Lead-wise');

    // Ops (raw filtered)
    const opsRaw = opsFiltered.map(e => ({
      MonthKey: e.monthKey || '',
      Category: e.category || '',
      SubCategory: e.subCategory || '',
      Amount: Number(e.amount || 0),
      Notes: e.notes || '',
      Recurring: e.isRecurring ? 'Yes' : 'No',
      Recurrence: e.recurrence || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opsRaw), 'Ops (filtered)');

    // Ops by Category summary
    const opsSum = opsRows.map(([cat, amt]) => ({ Category: cat, Amount: amt }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opsSum), 'Ops Summary');

    // Marketing sheet & summary
    const mktRaw = opsFiltered
      .filter(e => MARKETING_CATS.includes(e.category))
      .map(e => ({
        MonthKey: e.monthKey || '',
        Category: e.category,
        SubCategory: e.subCategory || '',
        Amount: Number(e.amount || 0),
        Notes: e.notes || '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mktRaw), 'Marketing');

    const mktSum = marketingRows.map(([cat, amt]) => ({ Channel: cat, Amount: amt }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mktSum), 'Marketing Summary');

    // High-level summary (now includes Payroll)
    const totals = [
      { Metric: 'Batch Total Income', Amount: summary.totalIncome },
      { Metric: 'Batch Total Expense', Amount: summary.totalExpense },
      { Metric: 'Batch Total Profit', Amount: summary.totalProfit },
      { Metric: 'Ops Total (filtered)', Amount: opsTotal },
      { Metric: 'Payroll Total (filtered)', Amount: payrollTotal },
      { Metric: 'Marketing Total (filtered)', Amount: marketingTotal },
      { Metric: 'Company Net (Profit - Ops - Payroll)', Amount: companyNet },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totals), 'Totals');

    // Company Net — Monthly & Quarterly for selected year
    const netMonthlyOut = netMonthlyRows.map(r => ({
      Month: r.monthKey,
      BatchProfit: r.batchProfit,
      Ops: r.ops,
      Payroll: r.payroll,
      CompanyNet: r.companyNet,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(netMonthlyOut), `CompanyNet_${selectedYear}`);

    const netQuarterlyOut = netQuarterlyRows.map(r => ({
      Quarter: r.label,
      BatchProfit: r.batchProfit,
      Ops: r.ops,
      Payroll: r.payroll,
      CompanyNet: r.companyNet,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(netQuarterlyOut), `CompanyNet_Q_${selectedYear}`);

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'BT_Reports.xlsx');
  };

  // Excel: marketing-only
  const handleExportMarketingExcel = () => {
    const wb = XLSX.utils.book_new();

    const rows = opsFiltered
      .filter(e => MARKETING_CATS.includes(e.category))
      .map(e => ({
        MonthKey: e.monthKey || '',
        Category: e.category,
        SubCategory: e.subCategory || '',
        Amount: Number(e.amount || 0),
        Notes: e.notes || '',
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Marketing');

    const sum = MARKETING_CATS.map(cat => ({
      Channel: cat,
      Amount: rows.filter(r => r.Category === cat).reduce((s, r) => s + r.Amount, 0),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sum), 'Summary');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'BT_Marketing.xlsx');
  };

  // PDF: batches summary + ops + payroll + company net + quarterly net
  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 12;

    doc.setFontSize(14);
    doc.text('BT Finance - Reports', 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Batch Income: ${currency(summary.totalIncome)}`, 14, y); y += 6;
    doc.text(`Batch Expense: ${currency(summary.totalExpense)}`, 14, y); y += 6;
    doc.text(`Batch Profit: ${currency(summary.totalProfit)}`, 14, y); y += 6;
    doc.text(`Ops Total: ${currency(opsTotal)}  |  Payroll: ${currency(payrollTotal)}`, 14, y); y += 6;
    doc.text(`Company Net (Profit - Ops - Payroll): ${currency(companyNet)}`, 14, y); y += 8;

    // Trek-wise
    const trekBody = Object.entries(summary.trekWise || {}).map(([name, d]) => [
      name, d.income, d.expense, d.profit, d.count,
    ]);
    if (trekBody.length) {
      doc.text('Trek-wise', 14, y); y += 4;
      doc.autoTable({
        startY: y,
        head: [['Trek', 'Income', 'Expense', 'Profit', 'Batches']],
        body: trekBody.map(r => [r[0], `₹${r[1]}`, `₹${r[2]}`, `₹${r[3]}`, r[4]]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      // @ts-ignore
      y = doc.lastAutoTable.finalY + 6;
    }

    // Monthly
    const monthBody = Object.entries(summary.monthWise || {}).map(([m, d]) => [
      m, d.income, d.expense, d.profit, d.count,
    ]);
    if (monthBody.length) {
      doc.text('Monthly', 14, y); y += 4;
      doc.autoTable({
        startY: y,
        head: [['Month', 'Income', 'Expense', 'Profit', 'Batches']],
        body: monthBody.map(r => [r[0], `₹${r[1]}`, `₹${r[2]}`, `₹${r[3]}`, r[4]]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      // @ts-ignore
      y = doc.lastAutoTable.finalY + 6;
    }

    // Lead-wise
    const leadBody = Object.entries(summary.leadWise || {}).map(([l, d]) => [
      l, d.count || 0, d.paid || 0,
    ]);
    if (leadBody.length) {
      doc.text('Lead-wise (payouts)', 14, y); y += 4;
      doc.autoTable({
        startY: y,
        head: [['Lead', 'Batches', 'Total Paid']],
        body: leadBody.map(r => [r[0], r[1], `₹${r[2]}`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      // @ts-ignore
      y = doc.lastAutoTable.finalY + 6;
    }

    // Ops by Category
    const opsBody = opsRows.map(([cat, amt]) => [cat, amt]);
    if (opsBody.length) {
      doc.text('Ops – Category Breakdown', 14, y); y += 4;
      doc.autoTable({
        startY: y,
        head: [['Category', 'Amount']],
        body: opsBody.map(r => [r[0], `₹${r[1]}`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
      });
      // @ts-ignore
      y = doc.lastAutoTable.finalY + 6;
    }

    // Company Net — Quarterly (selectedYear)
    const netQuarterBody = netQuarterlyRows.map(r => [
      r.label, r.batchProfit, r.ops, r.payroll, r.companyNet
    ]);
    if (netQuarterBody.length) {
      doc.text(`Company Net — Quarterly (${selectedYear})`, 14, y); y += 4;
      doc.autoTable({
        startY: y,
        head: [['Quarter', 'Batch Profit', 'Ops', 'Payroll', 'Company Net']],
        body: netQuarterBody.map(r => [r[0], `₹${r[1]}`, `₹${r[2]}`, `₹${r[3]}`, `₹${r[4]}`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
      });
    }

    doc.save('BT_Reports.pdf');
  };

  return (
    <div className="finance-scope">
    <div className="container">
      {/* Header */}
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 16 }}>
        <div className="topbar__left">📑 <span>Reports</span></div>
        <div className="topbar__right">{filteredBatches.length} batches in view</div>
      </div>

      {/* KPI Cards – Batches */}
      <section className="cards-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card__title">Total Income</div>
          <div className="card__metric">{currency(summary.totalIncome)}</div>
          <div className="card__sub">Filtered range</div>
        </div>
        <div className="card">
          <div className="card__title">Total Expense</div>
          <div className="card__metric">{currency(summary.totalExpense)}</div>
          <div className="card__sub">Batch expenses</div>
        </div>
        <div className="card">
          <div className="card__title">Total Profit</div>
          <div className="card__metric">{currency(summary.totalProfit)}</div>
          <div className="card__sub">
            {summary.totalIncome
              ? `${Math.round((summary.totalProfit / summary.totalIncome) * 100)}% margin`
              : '—'}
          </div>
        </div>
        <div className="card">
          <div className="card__title">Batches</div>
          <div className="card__metric">{filteredBatches.length}</div>
          <div className="card__sub">Matching filters</div>
        </div>
      </section>

      {/* KPI Cards – Ops/Marketing/Payroll/Company Net */}
      <section className="cards-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card__title">Ops Spend</div>
          <div className="card__metric">{currency(opsTotal)}</div>
          <div className="card__sub">{filters.month ? `in ${filters.month}` : 'Filtered range'}</div>
        </div>
        <div className="card">
          <div className="card__title">Marketing Spend</div>
          <div className="card__metric">{currency(marketingTotal)}</div>
          <div className="card__sub">Google / Insta / Creators</div>
        </div>
        <div className="card">
          <div className="card__title">Payroll</div>
          <div className="card__metric">{currency(payrollTotal)}</div>
          <div className="card__sub">{filters.month || 'Filtered range'}</div>
        </div>
        <div className="card">
          <div className="card__title">Company Net</div>
          <div className="card__metric">{currency(companyNet)}</div>
          <div className="card__sub">Batch Profit − Ops − Payroll</div>
        </div>
      </section>

      {/* Filters + Search + Export */}
      <div className="filters">
        <input
          className="input"
          placeholder="Search trek / batch code / lead"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select
          className="select"
          value={filters.month}
          onChange={(e) => setFilters({ ...filters, month: e.target.value })}
        >
          <option value="">All Months</option>
          {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          className="select"
          value={filters.trek}
          onChange={(e) => setFilters({ ...filters, trek: e.target.value })}
        >
          <option value="">All Treks</option>
          {uniqueTreks.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="select"
          value={filters.lead}
          onChange={(e) => setFilters({ ...filters, lead: e.target.value })}
        >
          <option value="">All Leads</option>
          {uniqueLeads.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <div className="filters__spacer" />
        <button className="btn btn--ghost" onClick={() => { setFilters({ month: '', trek: '', lead: '' }); setSearch(''); }}>Reset</button>
        <button className="btn" onClick={handleExportPDF}>Export PDF</button>
        <button className="btn" onClick={handleExportMarketingExcel}>Export Marketing</button>
        <button className="btn btn--primary" onClick={handleExportExcel}>Export Excel</button>
      </div>

      {/* Trek-wise */}
      <div className="section-header">
        <h3>🏔️ Trek-wise</h3>
        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={trekPageSize}
            onChange={(e) => { setTrekPageSize(parseInt(e.target.value, 10)); setTrekPage(1); }}
          >
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Trek</th>
              <th>Total Income</th>
              <th>Total Expense</th>
              <th>Total Profit</th>
              <th className="hide-sm">Batches</th>
            </tr>
          </thead>
          <tbody>
            {trekRows.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No data</td></tr>
            ) : (
              paginate(trekRows, trekPage, trekPageSize).map(([name, d]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{currency(d.income)}</td>
                  <td>{currency(d.expense)}</td>
                  <td>{currency(d.profit)}</td>
                  <td className="hide-sm">{d.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pager page={trekPage} setPage={setTrekPage} totalPages={trekTotalPages} />
      </div>

      {/* Monthly */}
      <div className="section-header" style={{ marginTop: 18 }}>
        <h3>📅 Monthly</h3>
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
      </div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Income</th>
              <th>Total Expense</th>
              <th>Total Profit</th>
              <th className="hide-sm">Batches</th>
            </tr>
          </thead>
          <tbody>
            {monthRows.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No data</td></tr>
            ) : (
              paginate(monthRows, monthPage, monthPageSize).map(([m, d]) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td>{currency(d.income)}</td>
                  <td>{currency(d.expense)}</td>
                  <td>{currency(d.profit)}</td>
                  <td className="hide-sm">{d.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pager page={monthPage} setPage={setMonthPage} totalPages={monthTotalPages} />
      </div>

      {/* Lead-wise */}
      <div className="section-header" style={{ marginTop: 18 }}>
        <h3>🧑‍💼 Lead-wise</h3>
        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={leadPageSize}
            onChange={(e) => { setLeadPageSize(parseInt(e.target.value, 10)); setLeadPage(1); }}
          >
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Lead</th>
              <th className="hide-sm">Batches</th>
              <th>Total Paid to Lead</th>
            </tr>
          </thead>
          <tbody>
            {leadRows.length === 0 ? (
              <tr><td colSpan={3} className="empty-state">No data</td></tr>
            ) : (
              paginate(leadRows, leadPage, leadPageSize).map(([lead, d]) => (
                <tr key={lead}>
                  <td>{lead}</td>
                  <td className="hide-sm">{d.count || 0}</td>
                  <td>{d.paid != null ? currency(d.paid) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pager page={leadPage} setPage={setLeadPage} totalPages={leadTotalPages} />
      </div>

      {/* Ops – Category Breakdown (+ marketing toggle) */}
      <div className="section-header" style={{ marginTop: 18 }}>
        <h3>🧾 {marketingOnly ? 'Marketing Spend (by Channel)' : 'Ops Expenses (by Category)'}{filters.month ? ` — ${filters.month}` : ''}</h3>
        <div className="filters" style={{ margin: 0, gap: 8 }}>
          <label className="field__label" style={{ alignSelf: 'center' }}>
            <input
              type="checkbox"
              checked={marketingOnly}
              onChange={(e)=>setMarketingOnly(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show Marketing Only
          </label>

          {!marketingOnly && (
            <>
              <input
                className="input"
                placeholder="Search vendor/notes"
                value={opsSearch}
                onChange={(e)=>setOpsSearch(e.target.value)}
                style={{ minWidth: 180 }}
              />
              <select className="select" value={opsCategory} onChange={(e)=>setOpsCategory(e.target.value)}>
                <option value="">All Categories</option>
                {Array.from(new Set(expenses.map(e=>e.category).filter(Boolean))).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </>
          )}

          <div className="filters__spacer" />
          <div className="field" style={{ minWidth: 130 }}>
            <label className="field__label">Rows per page</label>
            <select
              className="select"
              value={marketingOnly ? mktPageSize : opsPageSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (marketingOnly) { setMktPageSize(val); setMktPage(1); }
                else { setOpsPageSize(val); setOpsPage(1); }
              }}
            >
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Ops / Marketing Tables + Pie */}
      {!marketingOnly ? (
        <>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {opsRows.length === 0 ? (
                  <tr><td colSpan={2} className="empty-state">No expenses</td></tr>
                ) : (
                  paginate(opsRows, opsPage, opsPageSize).map(([cat, amt]) => (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td>{currency(amt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pager page={opsPage} setPage={setOpsPage} totalPages={opsTotalPages} />
          </div>
        </>
      ) : (
        <>
          {/* Marketing table */}
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {marketingRows.length === 0 ? (
                  <tr><td colSpan={2} className="empty-state">No marketing spend</td></tr>
                ) : (
                  paginate(marketingRows, mktPage, mktPageSize).map(([cat, amt]) => (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td>{currency(amt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pager page={mktPage} setPage={setMktPage} totalPages={mktTotalPages} />
          </div>

          {/* Marketing pie */}
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={marketingPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label
                  >
                    {marketingPieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
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

      {/* ===== Company Net (Monthly & Quarterly) Section ===== */}
      <hr style={{ margin: '28px 0', borderColor: 'var(--border)' }} />
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 12 }}>
        <div className="topbar__left">🏢 <span>Company Net — Batches − Ops − Payroll</span></div>
        <div className="topbar__right">
          <label className="field__label" style={{ marginRight: 8 }}>Year</label>
          <select
            className="select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Monthly Net Table */}
      <div className="section-header" style={{ marginTop: 6 }}>
        <h3>📆 Monthly Net — {selectedYear}</h3>
        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={netMonthPageSize}
            onChange={(e) => { setNetMonthPageSize(parseInt(e.target.value, 10)); setNetMonthPage(1); }}
          >
            {[6, 12].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Month</th>
              <th>Batch Profit</th>
              <th>Ops</th>
              <th>Payroll</th>
              <th>Company Net</th>
            </tr>
          </thead>
          <tbody>
            {netMonthlyRows.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No data</td></tr>
            ) : (
              paginate(netMonthlyRows, netMonthPage, netMonthPageSize).map(r => (
                <tr key={r.monthKey}>
                  <td>{r.label}</td>
                  <td>{currency(r.batchProfit)}</td>
                  <td>{currency(r.ops)}</td>
                  <td>{currency(r.payroll)}</td>
                  <td>{currency(r.companyNet)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pager page={netMonthPage} setPage={setNetMonthPage} totalPages={netMonthTotalPages} />
      </div>

      {/* Quarterly Net Table */}
      <h3 style={{ marginTop: 18 }}>🧮 Quarterly Net — {selectedYear}</h3>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Batch Profit</th>
              <th>Ops</th>
              <th>Payroll</th>
              <th>Company Net</th>
            </tr>
          </thead>
          <tbody>
            {netQuarterlyRows.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No data</td></tr>
            ) : (
              netQuarterlyRows.map((q, i) => (
                <tr key={i}>
                  <td>{q.label}</td>
                  <td>{currency(q.batchProfit)}</td>
                  <td>{currency(q.ops)}</td>
                  <td>{currency(q.payroll)}</td>
                  <td>{currency(q.companyNet)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

export default Reports;