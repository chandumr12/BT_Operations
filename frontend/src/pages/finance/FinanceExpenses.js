// src/pages/Expenses.js
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/financeFirebase';
import {
  collection, addDoc, getDocs, query, where, serverTimestamp, updateDoc, doc, deleteDoc,
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';

const CATEGORIES = [
  { value: 'rent', label: 'Office Rent' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'insta_ads', label: 'Instagram Ads', parent: 'marketing' },
  { value: 'google_ads', label: 'Google Ads', parent: 'marketing' },
  { value: 'content_creator', label: 'Content Creator', parent: 'marketing' },
  { value: 'badges', label: 'Round Badges' },
  { value: 'website', label: 'Website Mgmt' },
  { value: 'b2b_vendor', label: 'B2B Vendor' },
  { value: 'outing', label: 'Team Outing' },
  { value: 'team_dinner', label: 'Team Dinner' },
  { value: 'other', label: 'Other' },
];

const parentFor = (cat) => CATEGORIES.find(c => c.value === cat)?.parent || '';
const currency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Expenses() {
  const storage = getStorage();

  // filters & paging
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [marketingOnly, setMarketingOnly] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // data
  const [rows, setRows] = useState([]);
  const [budgets, setBudgets] = useState([]); // for selected month
  const [templates, setTemplates] = useState([]);

  // create form
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: '',
    subCategory: '',
    amount: '',
    notes: '',
    isRecurring: false,
    recurrence: 'monthly',
    file: null, // file input
  });

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({
    id: '',
    date: '',
    category: '',
    subCategory: '',
    amount: '',
    notes: '',
    isRecurring: false,
    recurrence: 'monthly',
    attachmentUrl: '',
    newFile: null,      // optional replacement file
    removeAttachment: false, // flag to remove existing attachment
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // helpers
  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
  const setEditField = (name, value) => setEdit(prev => ({ ...prev, [name]: value }));

  const refresh = async (mk = monthKey) => {
    const q1 = query(collection(db, 'expenses_global'), where('monthKey', '==', mk));
    const snap1 = await getDocs(q1);
    setRows(snap1.docs.map(d => ({ id: d.id, ...d.data() })));

    const q2 = query(collection(db, 'expense_budgets'), where('monthKey', '==', mk));
    const snap2 = await getDocs(q2);
    setBudgets(snap2.docs.map(d => ({ id: d.id, ...d.data() })));

    const snap3 = await getDocs(collection(db, 'expense_templates'));
    setTemplates(snap3.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // load data
  useEffect(() => {
    (async () => {
      await refresh(monthKey);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]); // ✅ don't include `db` to avoid lint warning

  const uploadAttachment = async (docId, file) => {
    const storageRef = ref(storage, `attachments/expenses/${docId}/${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  // ------- Create -------
  const handleAddExpense = async () => {
    if (!form.category || !form.amount || !form.date) {
      alert('Category, Amount and Date are required.');
      return;
    }
    const mk = form.date.slice(0, 7);
    const payload = {
      date: new Date(form.date),
      monthKey: mk,
      category: form.category,
      parentCategory: parentFor(form.category),
      subCategory: form.subCategory || '',
      amount: Number(form.amount || 0),
      notes: form.notes || '',
      isRecurring: !!form.isRecurring,
      recurrence: form.isRecurring ? form.recurrence : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'expenses_global'), payload);

    if (form.file) {
      const url = await uploadAttachment(docRef.id, form.file);
      await updateDoc(doc(db, 'expenses_global', docRef.id), { attachmentUrl: url, updatedAt: serverTimestamp() });
    }

    await refresh(mk);

    // clear form
    setForm({
      date: new Date().toISOString().slice(0, 10),
      category: '',
      subCategory: '',
      amount: '',
      notes: '',
      isRecurring: false,
      recurrence: 'monthly',
      file: null,
    });
  };

  // ------- Edit / Delete -------
  const openEditModal = (r) => {
    setEdit({
      id: r.id,
      date: r.date?.toDate ? r.date.toDate().toISOString().slice(0, 10)
           : (r.date?.seconds ? new Date(r.date.seconds * 1000).toISOString().slice(0, 10)
           : new Date().toISOString().slice(0, 10)),
      category: r.category || '',
      subCategory: r.subCategory || '',
      amount: r.amount || '',
      notes: r.notes || '',
      isRecurring: !!r.isRecurring,
      recurrence: r.recurrence || 'monthly',
      attachmentUrl: r.attachmentUrl || '',
      newFile: null,
      removeAttachment: false,
    });
    setEditOpen(true);
  };

  const saveEditExpense = async () => {
    if (!edit.id) return;
    if (!edit.category || !edit.amount || !edit.date) {
      alert('Category, Amount and Date are required.');
      return;
    }
    try {
      setSavingEdit(true);
      const mk = edit.date.slice(0, 7);
      const payload = {
        date: new Date(edit.date),
        monthKey: mk,
        category: edit.category,
        parentCategory: parentFor(edit.category),
        subCategory: edit.subCategory || '',
        amount: Number(edit.amount || 0),
        notes: edit.notes || '',
        isRecurring: !!edit.isRecurring,
        recurrence: edit.isRecurring ? edit.recurrence : null,
        updatedAt: serverTimestamp(),
      };

      // Attachment logic
      let newUrl = edit.attachmentUrl || '';

      // remove existing?
      if (edit.removeAttachment && edit.attachmentUrl) {
        try {
          const oldRef = ref(storage, edit.attachmentUrl);
          await deleteObject(oldRef);
        } catch (e) {
          // ignore delete errors, retain UX flow
          console.warn('Failed to delete old attachment:', e);
        }
        newUrl = '';
      }

      // replace / add new?
      if (edit.newFile) {
        const url = await uploadAttachment(edit.id, edit.newFile);
        newUrl = url;
      }

      if (newUrl !== (edit.attachmentUrl || '')) {
        payload.attachmentUrl = newUrl;
      }

      await updateDoc(doc(db, 'expenses_global', edit.id), payload);

      setEditOpen(false);
      setSavingEdit(false);
      await refresh(monthKey);
    } catch (err) {
      console.error('Failed to save edit:', err);
      setSavingEdit(false);
      alert('Failed to save changes.');
    }
  };

  const deleteExpense = async (r) => {
    if (!window.confirm('Delete this expense permanently?')) return;
    try {
      setDeletingId(r.id);
      // delete attachment if exists
      if (r.attachmentUrl) {
        try {
          const fileRef = ref(storage, r.attachmentUrl);
          await deleteObject(fileRef);
        } catch (e) {
          console.warn('Unable to delete attachment:', e);
        }
      }
      await deleteDoc(doc(db, 'expenses_global', r.id));
      await refresh(monthKey);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Failed to delete. Check console for details.');
    } finally {
      setDeletingId(null);
    }
  };

  // filters / derived
  const filteredRows = useMemo(() => {
    const s = (search || '').toLowerCase();
    return rows.filter(r => {
      const catOk = catFilter ? r.category === catFilter : true;
      const mkOk = r.monthKey === monthKey;
      const marketingOk = marketingOnly ? r.parentCategory === 'marketing' : true;
      const sOk =
        !s ||
        (r.subCategory || '').toLowerCase().includes(s) ||
        (r.notes || '').toLowerCase().includes(s);
      return mkOk && catOk && marketingOk && sOk;
    });
  }, [rows, monthKey, catFilter, marketingOnly, search]);

  const totals = useMemo(() => {
    const sum = filteredRows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const byCat = {};
    filteredRows.forEach(r => {
      byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount || 0);
    });
    return { sum, byCat };
  }, [filteredRows]);

  // budgets & variance
  const categoryBudget = (cat) =>
    budgets.find(b => b.category === cat)?.amount || 0;

  const marketingSpent = Object.entries(totals.byCat)
    .filter(([cat]) => parentFor(cat) === 'marketing')
    .reduce((s, [, v]) => s + v, 0);

  const marketingBudget = budgets
    .filter(b => parentFor(b.category) === 'marketing')
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  // paging
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paged = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  // export
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const sheetRows = filteredRows.map(r => ({
      Date: r.date?.toDate ? r.date.toDate().toISOString().slice(0,10) : (r.date?.seconds ? new Date(r.date.seconds*1000).toISOString().slice(0,10) : ''),
      Month: r.monthKey,
      Category: CATEGORIES.find(c => c.value === r.category)?.label || r.category,
      Parent: r.parentCategory || '',
      SubCategory: r.subCategory || '',
      Amount: r.amount || 0,
      Notes: r.notes || '',
      Attachment: r.attachmentUrl || '',
      Recurring: r.isRecurring ? (r.recurrence || '—') : 'No',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Expenses');

    const catSummary = Object.entries(totals.byCat).map(([cat, amt]) => ({
      Category: CATEGORIES.find(c => c.value === cat)?.label || cat,
      Spent: amt,
      Budget: categoryBudget(cat),
      Variance: (categoryBudget(cat) || 0) - (amt || 0),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catSummary), 'Category Summary');

    const mkSummary = [{
      Month: monthKey,
      MarketingSpent: marketingSpent,
      MarketingBudget: marketingBudget,
      MarketingVariance: marketingBudget - marketingSpent,
      TotalSpent: totals.sum,
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mkSummary), 'Month Summary');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Ops_Expenses_${monthKey}.xlsx`);
  };

  const exportPDF = () => {
    const docp = new jsPDF();
    let y = 12;
    docp.setFontSize(14);
    docp.text(`Ops Expenses — ${monthKey}`, 14, y); y += 8;

    docp.setFontSize(11);
    docp.text(`Total Spent: ${currency(totals.sum)}`, 14, y); y += 6;
    docp.text(`Marketing: ${currency(marketingSpent)} / Budget ${currency(marketingBudget)} (Var ${currency(marketingBudget - marketingSpent)})`, 14, y); y += 8;

    const catBody = Object.entries(totals.byCat).map(([cat, amt]) => [
      CATEGORIES.find(c => c.value === cat)?.label || cat,
      currency(amt),
      currency(categoryBudget(cat)),
      currency(categoryBudget(cat) - amt),
    ]);
    if (catBody.length) {
      docp.autoTable({
        startY: y,
        head: [['Category', 'Spent', 'Budget', 'Variance']],
        body: catBody,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240,240,240] },
      });
      // @ts-ignore
      y = docp.lastAutoTable.finalY + 6;
    }

    docp.save(`Ops_Expenses_${monthKey}.pdf`);
  };

  // post recurring templates
  const postRecurring = async () => {
    const candidates = templates.filter(t => (t.nextRunMonthKey || '') <= monthKey);
    if (candidates.length === 0) {
      alert('No templates due for this month.');
      return;
    }
    const existingKeys = new Set(rows.map(r => `${r.monthKey}|${r.category}|${r.subCategory||''}`));
    let created = 0;
    for (const t of candidates) {
      const key = `${monthKey}|${t.category}|${t.subCategory||''}`;
      if (existingKeys.has(key)) continue;

      const payload = {
        date: new Date(`${monthKey}-01`),
        monthKey,
        category: t.category,
        parentCategory: t.parentCategory || parentFor(t.category),
        subCategory: t.subCategory || '',
        amount: Number(t.defaultAmount || 0),
        notes: t.notes || 'posted from template',
        isRecurring: true,
        recurrence: t.recurrence || 'monthly',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'expenses_global'), payload);

      const bump = (mk, rec) => {
        const [y, m] = mk.split('-').map(Number);
        const dt = new Date(y, m-1, 1);
        if (rec === 'yearly') dt.setFullYear(dt.getFullYear()+1);
        else if (rec === 'quarterly') dt.setMonth(dt.getMonth()+3);
        else dt.setMonth(dt.getMonth()+1);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      };
      await updateDoc(doc(db, 'expense_templates', t.id), { nextRunMonthKey: bump(monthKey, t.recurrence || 'monthly') });
      created++;
    }
    alert(`Posted ${created} recurring items for ${monthKey}.`);
    await refresh(monthKey);
  };

  // ---------- UI ----------
  return (
    <div className="finance-scope">
    <div className="container">
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 12 }}>
        <div className="topbar__left">💼 <span>Ops Expenses</span></div>
        <div className="topbar__right">
          <strong>{currency(totals.sum)}</strong> in {monthKey}
        </div>
      </div>

      {/* KPI cards */}
      <section className="cards-grid" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="card__title">Marketing Spent</div>
          <div className="card__metric">{currency(marketingSpent)}</div>
          <div className="card__sub">Budget {currency(marketingBudget)} • Var {currency(marketingBudget - marketingSpent)}</div>
        </div>
        <div className="card">
          <div className="card__title">Total Ops Spend</div>
          <div className="card__metric">{currency(totals.sum)}</div>
          <div className="card__sub">{filteredRows.length} items</div>
        </div>
      </section>

      {/* Filters & Export */}
      <div className="filters">
        <div className="field">
          <label className="field__label">Month</label>
          <input className="input" type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Category</label>
          <select className="select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Search</label>
          <input className="input" placeholder="vendor / notes" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="switch">
          <input type="checkbox" checked={marketingOnly} onChange={(e)=>setMarketingOnly(e.target.checked)} />
          <span>Marketing only</span>
        </label>

        <div className="filters__spacer" />
        <button className="btn btn--ghost" onClick={() => { setCatFilter(''); setSearch(''); setMarketingOnly(false); }}>Reset</button>
        <button className="btn" onClick={exportPDF}>Export PDF</button>
        <button className="btn btn--primary" onClick={exportExcel}>Export Excel</button>
      </div>

      {/* Add Expense */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid-3">
          <div className="field">
            <label className="field__label">Date</label>
            <input className="input" type="date" value={form.date} onChange={e=>setField('date', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Category</label>
            <select className="select" value={form.category} onChange={e=>setField('category', e.target.value)}>
              <option value="">Select</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">SubCategory / Vendor</label>
            <input className="input" placeholder="e.g., Reel Boost – Monsoon" value={form.subCategory} onChange={e=>setField('subCategory', e.target.value)} />
          </div>

          <div className="field">
            <label className="field__label">Amount (₹)</label>
            <input className="input" type="number" value={form.amount} onChange={e=>setField('amount', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Notes</label>
            <input className="input" placeholder="optional" value={form.notes} onChange={e=>setField('notes', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Attachment</label>
            <input className="input" type="file" onChange={e=>setField('file', e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.isRecurring} onChange={(e)=>setField('isRecurring', e.target.checked)} />
            Recurring?
          </label>
          {form.isRecurring && (
            <div className="field">
              <label className="field__label">Recurrence</label>
              <select className="select" value={form.recurrence} onChange={e=>setField('recurrence', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}
          <div />
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
          <button className="btn btn--primary" onClick={handleAddExpense}>+ Add Expense</button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Vendor/Campaign</th>
              <th>Amount</th>
              <th>Attachment</th>
              <th>Notes</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td className="empty-state" colSpan={7}>No expenses found.</td></tr>
            ) : (
              paged.map(r => (
                <tr key={r.id}>
                  <td>{r.date?.toDate ? r.date.toDate().toISOString().slice(0,10) : (r.date?.seconds ? new Date(r.date.seconds*1000).toISOString().slice(0,10) : '')}</td>
                  <td>{CATEGORIES.find(c => c.value === r.category)?.label || r.category}</td>
                  <td>{r.subCategory || '—'}</td>
                  <td>{currency(r.amount)}</td>
                  <td>{r.attachmentUrl ? <a href={r.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                  <td>{r.notes || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn--ghost" onClick={() => openEditModal(r)}>Edit</button>
                    <button
                      className="btn btn--danger"
                      style={{ marginLeft: 6 }}
                      onClick={() => deleteExpense(r)}
                      disabled={deletingId === r.id}
                      title="Delete"
                    >
                      {deletingId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="filters" style={{ marginTop: 8 }}>
          <div className="field" style={{ minWidth: 140 }}>
            <label className="field__label">Rows per page</label>
            <select className="select" value={pageSize} onChange={(e)=>{ setPageSize(parseInt(e.target.value,10)); setPage(1); }}>
              {[5,10,20,50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filters__spacer" />
          <Pager page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      </div>

      {/* Templates action */}
      <div style={{ marginTop: 10, display:'flex', justifyContent:'flex-end' }}>
        <button className="btn" onClick={postRecurring}>Post recurring items for {monthKey}</button>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content" style={{ maxWidth: 720 }}>
            <div className="modal__header">
              <div className="modal__title">Edit Expense</div>
              <button className="btn btn--icon" onClick={() => setEditOpen(false)}>✕</button>
            </div>

            <div className="modal__body">
              <div className="grid-3">
                <div className="field">
                  <label className="field__label">Date</label>
                  <input className="input" type="date" value={edit.date} onChange={e=>setEditField('date', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">Category</label>
                  <select className="select" value={edit.category} onChange={e=>setEditField('category', e.target.value)}>
                    <option value="">Select</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">SubCategory / Vendor</label>
                  <input className="input" value={edit.subCategory} onChange={e=>setEditField('subCategory', e.target.value)} />
                </div>

                <div className="field">
                  <label className="field__label">Amount (₹)</label>
                  <input className="input" type="number" value={edit.amount} onChange={e=>setEditField('amount', e.target.value)} />
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label className="field__label">Notes</label>
                  <input className="input" value={edit.notes} onChange={e=>setEditField('notes', e.target.value)} />
                </div>
              </div>

              {/* Recurrence */}
              <div className="grid-3" style={{ marginTop: 8 }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={edit.isRecurring} onChange={(e)=>setEditField('isRecurring', e.target.checked)} />
                  Recurring?
                </label>
                {edit.isRecurring && (
                  <div className="field">
                    <label className="field__label">Recurrence</label>
                    <select className="select" value={edit.recurrence} onChange={e=>setEditField('recurrence', e.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                )}
                <div />
              </div>

              {/* Attachment controls */}
              <div className="card" style={{ marginTop: 10 }}>
                <div className="card__title">Attachment</div>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginTop:8 }}>
                  {edit.attachmentUrl ? (
                    <>
                      <a href={edit.attachmentUrl} target="_blank" rel="noreferrer">View current</a>
                      <label className="checkbox-label" style={{ marginLeft: 8 }}>
                        <input
                          type="checkbox"
                          checked={edit.removeAttachment}
                          onChange={(e)=>setEditField('removeAttachment', e.target.checked)}
                        />
                        Remove existing
                      </label>
                    </>
                  ) : (
                    <span className="muted">No attachment</span>
                  )}
                  <input
                    className="input"
                    type="file"
                    onChange={(e)=>setEditField('newFile', e.target.files?.[0] || null)}
                    style={{ maxWidth: 260 }}
                  />
                </div>
              </div>
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setEditOpen(false)} disabled={savingEdit}>Cancel</button>
              <button className="btn btn--primary" onClick={saveEditExpense} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}

export default Expenses;