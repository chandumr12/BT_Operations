// src/pages/Payroll.js
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/financeFirebase';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const statusOptions = ['pending', 'processed', 'paid'];
const monthKeyOf = (isoMonth) => isoMonth; // "YYYY-MM"

// Stable INR formatter (UI)
const INR_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr = (n) => `₹${INR_FMT.format(Number(n || 0))}`;

// PDF-safe formatter (no ₹ to avoid glyph issues in jsPDF)
const inrPdf = (n) => `INR ${INR_FMT.format(Number(n || 0))}`;

function Payroll() {
  // data
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]); // payroll docs

  // filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [search, setSearch] = useState('');

  // pager
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [busy, setBusy] = useState(false); // for generate

  // ---------- fetch ----------
  useEffect(() => {
    (async () => {
      const empSnap = await getDocs(collection(db, 'employees'));
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  useEffect(() => {
    fetchPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const fetchPayroll = async () => {
    const mk = monthKeyOf(selectedMonth);
    const paySnap = await getDocs(collection(db, 'payroll'));
    const list = paySnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.monthKey === mk);
    setRows(list);
    setPage(1);
  };

  // ---------- generate payroll for month ----------
  const handleGenerate = async () => {
    const mk = monthKeyOf(selectedMonth);
    setBusy(true);
    try {
      // Active, fixed-salary employees only
      const fixedActive = employees.filter(e => e.status && e.salaryType === 'fixed');

      // Check existing employeeIds for this month
      const existingEmpIds = new Set(rows.map(r => r.employeeId));
      const toCreate = fixedActive.filter(e => !existingEmpIds.has(e.id));

      for (const e of toCreate) {
        const gross = Number(e.baseSalary || 0) + Number(e.allowances || 0);
        const net = gross - Number(e.deductions || 0);
        await addDoc(collection(db, 'payroll'), {
          employeeId: e.id,
          employeeName: e.name || '',
          role: e.role || '',
          monthKey: mk,
          gross: Number(e.baseSalary || 0),
          allowances: Number(e.allowances || 0),
          deductions: Number(e.deductions || 0),
          netPay: Number(net),
          status: 'pending',
          paidOn: null,
          notes: '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      await fetchPayroll();
      if (toCreate.length === 0) {
        alert('Payroll already generated for all active fixed-salary employees for this month.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate payroll. Check console.');
    } finally {
      setBusy(false);
    }
  };

  // ---------- inline edit ----------
  const updateField = async (rowId, patch) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
    try {
      await updateDoc(doc(db, 'payroll', rowId), { ...patch, updatedAt: Timestamp.now() });
    } catch (err) {
      console.error(err);
      alert('Failed to update payroll row.');
    }
  };

  const setStatus = async (row, status) => {
    const patch = { status };
    if (status === 'paid') patch.paidOn = Timestamp.now();
    await updateField(row.id, patch);
  };

  // ---------- delete ----------
  const handleDeleteRow = async (row) => {
    const label = `${row.employeeName || 'Employee'} — ${row.monthKey}`;
    if (!window.confirm(`Delete this payroll entry?\n\n${label}\n\nThis cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'payroll', row.id));
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (err) {
      console.error('Delete payroll failed', err);
      alert('Failed to delete payroll row. Check console for details.');
    }
  };

  // ---------- filters + search ----------
  const employeeOptions = useMemo(() => {
    const byId = new Map(employees.map(e => [e.id, e]));
    const ids = new Set(rows.map(r => r.employeeId));
    return [...ids].map(id => ({ id, name: byId.get(id)?.name || 'Unknown' })).sort((a,b)=>a.name.localeCompare(b.name));
  }, [rows, employees]);

  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase();
    return rows.filter(r => {
      const empName = (r.employeeName || '').toLowerCase();
      const role = (r.role || '').toLowerCase();
      const bySearch = !s || empName.includes(s) || role.includes(s);
      const byEmp = !employeeFilter || r.employeeId === employeeFilter;
      const byStatus = !statusFilter || r.status === statusFilter;
      return bySearch && byEmp && byStatus;
    }).sort((a,b)=> (a.employeeName || '').localeCompare(b.employeeName || ''));
  }, [rows, search, employeeFilter, statusFilter]);

  useEffect(() => { setPage(1); }, [search, employeeFilter, statusFilter, pageSize]);

  const paginate = (arr, p, size) => arr.slice((p-1)*size, (p-1)*size + size);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // totals
  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => {
      acc.gross += Number(r.gross || 0);
      acc.allowances += Number(r.allowances || 0);
      acc.deductions += Number(r.deductions || 0);
      acc.net += Number(r.netPay || 0);
      return acc;
    }, { gross: 0, allowances: 0, deductions: 0, net: 0 });
  }, [filtered]);

  // ---------- export ----------
  const exportExcel = () => {
    const rowsX = filtered.map(r => ({
      Employee: r.employeeName,
      Role: r.role || '',
      Month: r.monthKey,
      Gross: r.gross || 0,
      Allowances: r.allowances || 0,
      Deductions: r.deductions || 0,
      NetPay: r.netPay || 0,
      Status: r.status,
      PaidOn: r.paidOn ? new Date(r.paidOn.seconds * 1000).toISOString().slice(0,10) : '',
      Notes: r.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rowsX);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Payroll_${selectedMonth}`);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `BT_Payroll_${selectedMonth}.xlsx`);
  };

  const exportPayslip = (row) => {
    const docPDF = new jsPDF();

    // Use Helvetica (built-in) + no ₹ to avoid odd glyphs.
    docPDF.setFont('helvetica', 'normal');

    let y = 12;
    docPDF.setFontSize(14);
    docPDF.text('Payslip', 14, y); y += 8;

    docPDF.setFontSize(11);
    docPDF.text(`Employee: ${row.employeeName || ''}`, 14, y); y += 6;
    docPDF.text(`Role: ${row.role || ''}`, 14, y); y += 6;
    docPDF.text(`Month: ${row.monthKey}`, 14, y); y += 6;
    docPDF.text(`Status: ${row.status}`, 14, y); y += 8;

    docPDF.autoTable({
      startY: y,
      head: [['Component', 'Amount']],
      body: [
        ['Gross',      inrPdf(row.gross || 0)],
        ['Allowances', inrPdf(row.allowances || 0)],
        ['Deductions', inrPdf(row.deductions || 0)],
        ['Net Pay',    inrPdf(row.netPay || 0)],
      ],
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [240, 240, 240] },
      columnStyles: { 1: { halign: 'right' } }, // right-align amounts
    });

    docPDF.save(`Payslip_${row.employeeName}_${row.monthKey}.pdf`);
  };

  // ---------- UI ----------
  return (
    <div className="finance-scope">
    <div className="container">
      {/* Header */}
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 16 }}>
        <div className="topbar__left">💸 <span>Payroll</span></div>
        <div className="topbar__right">{filtered.length} rows</div>
      </div>

      {/* Controls */}
      <div className="filters">
        <div className="field">
          <label className="field__label">Month</label>
          <input
            className="input"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>

        <input
          className="input"
          placeholder="Search employee / role"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />

        <select
          className="select"
          value={employeeFilter}
          onChange={(e)=>setEmployeeFilter(e.target.value)}
        >
          <option value="">All employees</option>
          {employeeOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>

        <select
          className="select"
          value={statusFilter}
          onChange={(e)=>setStatusFilter(e.target.value)}
        >
          <option value="">All status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="filters__spacer" />

        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={pageSize}
            onChange={(e)=>{ setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
          >
            {[5,10,20,50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button className="btn" disabled={busy} onClick={handleGenerate}>
          {busy ? 'Generating…' : 'Generate for Month'}
        </button>
        <button className="btn btn--primary" onClick={exportExcel}>Export Excel</button>
      </div>

      {/* Totals */}
      <section className="cards-grid" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="card__title">Gross</div>
          <div className="card__metric">{inr(totals.gross)}</div>
        </div>
        <div className="card">
          <div className="card__title">Allowances</div>
          <div className="card__metric">{inr(totals.allowances)}</div>
        </div>
        <div className="card">
          <div className="card__title">Deductions</div>
          <div className="card__metric">{inr(totals.deductions)}</div>
        </div>
        <div className="card">
          <div className="card__title">Net Pay</div>
          <div className="card__metric">{inr(totals.net)}</div>
        </div>
      </section>

      {/* Table */}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="hide-sm">Role</th>
              <th>Gross</th>
              <th>Allow.</th>
              <th>Deduct.</th>
              <th>Net</th>
              <th>Status</th>
              <th className="hide-sm">Paid On</th>
              <th>Notes</th>
              <th>⚙️</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="empty-state">No payroll rows.</td></tr>
            )}
            {paginate(filtered, page, pageSize).map(r => {
              const paidOn = r.paidOn
                ? new Date((r.paidOn.seconds || 0) * 1000).toISOString().slice(0,10)
                : '—';
              const recomputeNet = (rr) => Number(rr.gross || 0) + Number(rr.allowances || 0) - Number(rr.deductions || 0);

              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.employeeName || '—'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{r.monthKey}</div>
                  </td>
                  <td className="hide-sm">{r.role || '—'}</td>
                  <td>{inr(r.gross || 0)}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      value={r.allowances ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        updateField(r.id, { allowances: v, netPay: recomputeNet({ ...r, allowances: v }) });
                      }}
                      style={{ width: 110 }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      value={r.deductions ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        updateField(r.id, { deductions: v, netPay: recomputeNet({ ...r, deductions: v }) });
                      }}
                      style={{ width: 110 }}
                    />
                  </td>
                  <td><strong>{inr(r.netPay || 0)}</strong></td>
                  <td>
                    <select
                      className="select"
                      value={r.status}
                      onChange={(e)=>setStatus(r, e.target.value)}
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="hide-sm">{paidOn}</td>
                  <td>
                    <input
                      className="input"
                      value={r.notes || ''}
                      onChange={(e)=>updateField(r.id, { notes: e.target.value })}
                      placeholder="Optional"
                      style={{ minWidth: 140 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="btn btn--ghost" onClick={() => exportPayslip(r)}>Payslip</button>
                      {r.status !== 'paid' && (
                        <button className="btn" onClick={() => setStatus(r, 'paid')}>Mark Paid</button>
                      )}
                      <button
                        className="btn btn--danger"
                        title="Delete payroll row"
                        onClick={() => handleDeleteRow(r)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Pager page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
    </div>
  );
}

export default Payroll;