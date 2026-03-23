// src/pages/Leads.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/financeFirebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';

function Leads() {
  const [leads, setLeads] = useState([]);
  const [batches, setBatches] = useState([]);

  // Create form visibility
  const [showCreate, setShowCreate] = useState(false);

  // Form (create)
  const [formData, setFormData] = useState({
    name: '', phone: '', age: '', gender: '', isActive: true, hiredDate: '', type: '', notes: '',
    bankName: '', accountName: '', accountNumber: '', ifsc: '', panNumber: '',
    idProof: null // {name, type, data} base64
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // List filters + preview
  const [filters, setFilters] = useState({ month: '', trek: '' });
  const [showPreview, setShowPreview] = useState(false);

  // Pagination
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [cardsPage, setCardsPage] = useState(1);
  const [cardsPageSize, setCardsPageSize] = useState(5);

  // Edit/Delete modal state
  const emptyLead = { id: '', name: '', phone: '', age: '', gender: '', isActive: true, hiredDate: '', type: '', notes: '' };
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(emptyLead);
  const [editErrors, setEditErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ---------- Validation ----------
  const validate = (data) => {
    const errors = {};
    if (!data.name?.trim()) errors.name = 'Name is required';
    if (!/^[0-9]{10}$/.test(String(data.phone || ''))) errors.phone = 'Valid 10-digit phone required';
    const ageNum = Number(data.age);
    if (!ageNum || ageNum < 18 || ageNum > 80) errors.age = 'Age must be between 18 and 80';
    if (!data.gender) errors.gender = 'Gender required';
    if (!data.hiredDate) errors.hiredDate = 'Hired Date required';
    if (!data.type) errors.type = 'Type required';
    // Bank details (optional but format-checked if present)
    if (data.accountNumber && !/^\d{6,18}$/.test(data.accountNumber)) errors.accountNumber = '6–18 digits';
    if (data.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifsc.toUpperCase())) errors.ifsc = 'Invalid IFSC';
    if (data.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(data.panNumber.toUpperCase())) errors.panNumber = 'Invalid PAN';
    return errors;
  };

  // ---------- Fetch ----------
  const fetchLeads = async () => {
    const snapshot = await getDocs(collection(db, 'leads'));
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setLeads(list);
  };

  const fetchBatches = async () => {
    const snapshot = await getDocs(collection(db, 'batches'));
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setBatches(list);
  };

  useEffect(() => {
    fetchLeads();
    fetchBatches();
  }, []);

  // ---------- Create ----------
  const resetForm = () => setFormData({
    name: '', phone: '', age: '', gender: '', isActive: true, hiredDate: '', type: '', notes: '',
    bankName: '', accountName: '', accountNumber: '', ifsc: '', panNumber: '',
    idProof: null
  });

  const handleFile = async (file) => {
    if (!file) return null;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      alert('Please upload PDF/JPG/PNG only.');
      return null;
    }
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve({ name: file.name, type: file.type, data: fr.result });
      fr.readAsDataURL(file);
    });
  };

  const submitLead = async (addAnother = false) => {
    setSubmitted(true);
    const errors = validate(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await addDoc(collection(db, 'leads'), formData);
    await fetchLeads();

    if (addAnother) {
      resetForm();
      setSubmitted(false);
    } else {
      resetForm();
      setSubmitted(false);
      setShowCreate(false);
      setPreviewPage(1);
      setCardsPage(1);
    }
  };

  // ---------- Edit ----------
  const openEdit = (lead) => {
    setEditData({
      id: lead.id,
      name: lead.name || '',
      phone: lead.phone || '',
      age: lead.age || '',
      gender: lead.gender || '',
      isActive: !!lead.isActive,
      hiredDate: lead.hiredDate || '',
      type: lead.type || '',
      notes: lead.notes || '',
    });
    setEditErrors({});
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const errors = validate(editData);
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setEditSubmitting(true);
      const ref = doc(db, 'leads', editData.id);
      const payload = { ...editData };
      delete payload.id;
      await updateDoc(ref, payload);
      setEditOpen(false);
      setEditSubmitting(false);
      await fetchLeads();
    } catch (err) {
      console.error('Update failed', err);
      setEditSubmitting(false);
      alert('Failed to update. Check console for details.');
    }
  };

  const deleteLead = async (leadId) => {
    if (!window.confirm('Delete this lead permanently?')) return;
    try {
      await deleteDoc(doc(db, 'leads', leadId));
      await fetchLeads();
      setPreviewPage(1);
      setCardsPage(1);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Failed to delete. Check console for details.');
    }
  };

  // ---------- Helpers: link batches to a lead (multi-payout aware) ----------
  const getLeadEntries = (lead, sourceBatches) => {
    const keyById = lead.id;
    const keyByName = (lead.name || '').trim();

    const entries = [];

    (sourceBatches || []).forEach((b) => {
      const lp = Array.isArray(b.leadPayments) ? b.leadPayments : [];

      const amountFromArray = lp
        .filter(it => (it?.name || '').trim().toLowerCase() === keyByName.toLowerCase())
        .reduce((s, it) => s + (parseInt(it?.amount || 0) || 0), 0);

      const legacyHit =
        (b.leadId && keyById && b.leadId === keyById) ||
        ((b.leadName || '').trim().toLowerCase() === keyByName.toLowerCase());
      const amountFromLegacy = legacyHit ? (parseInt(b.leadPayment || 0) || 0) : 0;

      const amount = amountFromArray + amountFromLegacy;

      if (amount > 0) {
        const clearedBy = b.paymentClearedBy || {};
        const cleared =
          (keyById && typeof clearedBy[keyById] === 'boolean') ? clearedBy[keyById]
          : (typeof clearedBy[keyByName] === 'boolean') ? clearedBy[keyByName]
          : !!b.paymentCleared;

        const leadKey = keyById || keyByName;

        entries.push({
          id: b.id,
          batchCode: b.batchCode || '—',
          date: b.date || b.startDate || '—',
          amount,
          cleared,
          leadKey,
        });
      }
    });

    return entries;
  };

  const handleTogglePayment = async (batchId, leadKey, currentStatus) => {
    if (!batchId || !leadKey) return;
    const batchRef = doc(db, 'batches', batchId);
    try {
      await updateDoc(batchRef, { [`paymentClearedBy.${leadKey}`]: !currentStatus });
      await fetchBatches();
    } catch (e) {
      console.error('Failed to toggle payment:', e);
      alert('Failed to toggle payment.');
    }
  };

  // ---------- Export ----------
  const handleExportPDF = (lead, entries, totalPayment) => {
    const docPDF = new jsPDF();
    docPDF.text(`Lead Payment Summary - ${lead.name}`, 10, 10);

    const rows = entries.map(e => [
      e.batchCode,
      e.date,
      `₹${e.amount}`,
      e.cleared ? 'Cleared' : 'Pending'
    ]);

    docPDF.autoTable({
      head: [['Batch Code', 'Date', 'Amount', 'Status']],
      body: rows,
      startY: 20,
      didDrawPage: (data) => {
        docPDF.text(`Total Payment: ₹${totalPayment}`, 10, data.cursor.y + 10);
      },
    });
    docPDF.save(`${lead.name}_payments.pdf`);
  };

  // New: export profile (with bank + KYC)
  const handleExportProfilePDF = (lead) => {
    const p = new jsPDF();
    p.setFontSize(14);
    p.text(`Lead Profile — ${lead.name}`, 14, 14);

    p.setFontSize(10);
    const lines = [
      ['Name', lead.name || '—'],
      ['Phone', lead.phone || '—'],
      ['Age', String(lead.age || '—')],
      ['Gender', lead.gender || '—'],
      ['Active', lead.isActive ? 'Yes' : 'No'],
      ['Hired Date', lead.hiredDate || '—'],
      ['Type', lead.type || '—'],
      ['Notes', lead.notes || '—'],
      ['Bank Name', lead.bankName || '—'],
      ['Account Name', lead.accountName || '—'],
      ['Account Number', lead.accountNumber || '—'],
      ['IFSC', lead.ifsc || '—'],
      ['PAN', lead.panNumber || '—'],
    ];

    p.autoTable({
      head: [['Field', 'Value']],
      body: lines,
      startY: 24,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240,240,240] },
    });

    // If there’s an image id proof, embed a thumbnail (PDFs can’t be embedded this way)
    const y = p.lastAutoTable?.finalY ? p.lastAutoTable.finalY + 8 : 90;
    if (lead.idProof?.data && lead.idProof?.type?.startsWith('image/')) {
      try {
        p.text('ID Proof (thumbnail):', 14, y);
        p.addImage(lead.idProof.data, lead.idProof.type === 'image/png' ? 'PNG' : 'JPEG', 14, y + 4, 50, 35);
      } catch {}
    } else if (lead.idProof?.name) {
      p.text(`ID Proof: ${lead.idProof.name} (${lead.idProof.type || ''})`, 14, y);
    }

    p.save(`${lead.name}_profile.pdf`);
  };

  const handleExportExcel = () => {
    const allData = leads.map((lead) => {
      const entries = getLeadEntries(lead, filteredBatches);
      const totalPayment = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      return {
        Name: lead.name,
        Phone: lead.phone,
        Age: lead.age,
        Gender: lead.gender,
        Status: lead.isActive ? 'Active' : 'Inactive',
        HiredDate: lead.hiredDate,
        Type: lead.type,
        BankName: lead.bankName || '',
        AccountName: lead.accountName || '',
        AccountNumber: lead.accountNumber || '',
        IFSC: lead.ifsc || '',
        PAN: lead.panNumber || '',
        TotalBatches: entries.length,
        TotalPayment: totalPayment,
      };
    });
    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LeadSummary');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Lead_Payments.xlsx');
  };

  // ---------- Filters / derived ----------
  useEffect(() => { setCardsPage(1); }, [filters]);

  const safeMonth = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  const uniqueMonths = [...new Set(batches.map(b => safeMonth(b.date || b.startDate)))].filter(Boolean);
  const uniqueTreks = [...new Set(batches.map(b => b.trekName).filter(Boolean))];

  const filteredBatches = batches.filter(batch => {
    const month = safeMonth(batch.date || batch.startDate);
    return (
      (!filters.month || filters.month === month) &&
      (!filters.trek || filters.trek === batch.trekName)
    );
  });

  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.isActive).length;
  const inactiveLeads = totalLeads - activeLeads;

  const paginate = (arr, page, size) => {
    const start = (page - 1) * size;
    return arr.slice(start, start + size);
  };

  const previewTotalPages = Math.max(1, Math.ceil(leads.length / previewPageSize));
  const cardsTotalPages = Math.max(1, Math.ceil(leads.length / cardsPageSize));

  const pagedPreviewLeads = useMemo(
    () => paginate(leads, previewPage, previewPageSize),
    [leads, previewPage, previewPageSize]
  );
  const pagedCardLeads = useMemo(
    () => paginate(leads, cardsPage, cardsPageSize),
    [leads, cardsPage, cardsPageSize]
  );

  return (
    <div className="finance-scope">
    <div className="leads-container">
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 12 }}>
        <div className="topbar__left">🧑‍💼 <span>Leads</span></div>
        <div className="topbar__right">
          <button className="btn btn--primary" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Close' : '+ Add Lead'}
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <span>Total Leads: {totalLeads}</span>
        <span>✅ Active: {activeLeads}</span>
        <span>❌ Inactive: {inactiveLeads}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label className="field__label" style={{ fontSize: 12 }}>Rows</label>
          <select
            className="select"
            value={previewPageSize}
            onChange={(e) => { setPreviewPageSize(parseInt(e.target.value, 10)); setPreviewPage(1); }}
          >
            {[5,10,20,50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={() => { setShowPreview(!showPreview); setPreviewPage(1); }}>
            {showPreview ? 'Hide' : 'View All Leads'}
          </button>
        </div>
      </div>

      {/* Collapsible Create Lead */}
      {showCreate && (
        <form
          onSubmit={(e) => { e.preventDefault(); submitLead(false); }}
          className="card"
          style={{ padding: 12, marginTop: 12 }}
        >
          <div className="grid-4">
            {/* Basic */}
            <div className="field">
              <label className="field__label">Lead Name *</label>
              <input
                className="input"
                placeholder="e.g. Ravi Kumar"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {submitted && formErrors.name && <div className="error">{formErrors.name}</div>}
            </div>

            <div className="field">
              <label className="field__label">Phone Number *</label>
              <input
                className="input"
                placeholder="10-digit phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              {submitted && formErrors.phone && <div className="error">{formErrors.phone}</div>}
            </div>

            <div className="field">
              <label className="field__label">Age *</label>
              <input
                className="input"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
              {submitted && formErrors.age && <div className="error">{formErrors.age}</div>}
            </div>

            <div className="field">
              <label className="field__label">Gender *</label>
              <select
                className="select"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              {submitted && formErrors.gender && <div className="error">{formErrors.gender}</div>}
            </div>

            <div className="field">
              <label className="field__label">Active Status</label>
              <label className="checkbox-label" style={{ paddingTop: 8 }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ marginRight: 8 }}
                />
                Active
              </label>
            </div>

            <div className="field">
              <label className="field__label">Hired Date *</label>
              <input
                className="input"
                type="date"
                value={formData.hiredDate}
                onChange={(e) => setFormData({ ...formData, hiredDate: e.target.value })}
              />
              {submitted && formErrors.hiredDate && <div className="error">{formErrors.hiredDate}</div>}
            </div>

            <div className="field">
              <label className="field__label">Type *</label>
              <select
                className="select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="">Select</option>
                <option>Full-time</option>
                <option>Freelance</option>
                <option>Volunteer</option>
              </select>
              {submitted && formErrors.type && <div className="error">{formErrors.type}</div>}
            </div>

            {/* Bank / KYC */}
            <div className="field">
              <label className="field__label">Bank Name</label>
              <input className="input" value={formData.bankName}
                     onChange={(e)=>setFormData({...formData, bankName: e.target.value})}/>
            </div>
            <div className="field">
              <label className="field__label">Account Name</label>
              <input className="input" value={formData.accountName}
                     onChange={(e)=>setFormData({...formData, accountName: e.target.value})}/>
            </div>
            <div className="field">
              <label className="field__label">Account Number</label>
              <input className="input" value={formData.accountNumber}
                     onChange={(e)=>setFormData({...formData, accountNumber: e.target.value})}/>
              {submitted && formErrors.accountNumber && <div className="error">{formErrors.accountNumber}</div>}
            </div>
            <div className="field">
              <label className="field__label">IFSC</label>
              <input className="input" value={formData.ifsc}
                     onChange={(e)=>setFormData({...formData, ifsc: e.target.value.toUpperCase()})}/>
              {submitted && formErrors.ifsc && <div className="error">{formErrors.ifsc}</div>}
            </div>
            <div className="field">
              <label className="field__label">PAN</label>
              <input className="input" value={formData.panNumber}
                     onChange={(e)=>setFormData({...formData, panNumber: e.target.value.toUpperCase()})}/>
              {submitted && formErrors.panNumber && <div className="error">{formErrors.panNumber}</div>}
            </div>
            <div className="field" style={{ gridColumn: '1/3' }}>
              <label className="field__label">ID Proof (PDF/JPG/PNG)</label>
              <input
                className="input"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  const packed = await handleFile(f);
                  setFormData(prev => ({ ...prev, idProof: packed }));
                }}
              />
              {formData.idProof?.name && (
                <div className="muted" style={{ marginTop: 4 }}>
                  Attached: {formData.idProof.name}
                </div>
              )}
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Notes (optional)</label>
              <textarea
                className="input"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal__footer" style={{ paddingTop: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => { setShowCreate(false); resetForm(); }}>
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn"
              onClick={() => submitLead(true)}
              title="Save and keep the form open to add another"
            >
              Save & Add Another
            </button>
            <button type="submit" className="btn btn--primary">Save</button>
          </div>
        </form>
      )}

      {/* View-all preview */}
      {showPreview && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Name</th><th>Phone</th><th>Age</th><th>Gender</th><th>Status</th><th>Hired Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedPreviewLeads.map(lead => (
                <tr key={lead.id}>
                  <td>{lead.name}</td>
                  <td>{lead.phone}</td>
                  <td>{lead.age}</td>
                  <td>{lead.gender}</td>
                  <td>{lead.isActive ? '✅' : '❌'}</td>
                  <td>{lead.hiredDate}</td>
                  <td>
                    <button className="btn btn--ghost" onClick={() => openEdit(lead)}>Edit</button>{' '}
                    <button className="btn btn--danger" onClick={() => deleteLead(lead.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {pagedPreviewLeads.length === 0 && (
                <tr><td colSpan={7} className="empty-state">No leads found.</td></tr>
              )}
            </tbody>
          </table>
          <Pager page={previewPage} setPage={setPreviewPage} totalPages={Math.max(1, Math.ceil(leads.length / previewPageSize))} />
        </div>
      )}

      {/* Filters + export */}
      <div className="filters" style={{ marginTop: 12 }}>
        <select
          className="select"
          value={filters.month}
          onChange={e => setFilters({ ...filters, month: e.target.value })}
        >
          <option value="">All Months</option>
          {[...new Set(batches.map(b => {
            const d = new Date(b.date || b.startDate || '');
            return isNaN(d) ? '' : d.toLocaleString('default',{month:'short',year:'numeric'});
          })).values()].filter(Boolean).map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          className="select"
          value={filters.trek}
          onChange={e => setFilters({ ...filters, trek: e.target.value })}
        >
          <option value="">All Treks</option>
          {[...new Set(batches.map(b => b.trekName).filter(Boolean))].map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="filters__spacer" />
        <div className="field" style={{ minWidth: 140 }}>
          <label className="field__label">Cards per page</label>
          <select
            className="select"
            value={cardsPageSize}
            onChange={(e) => { setCardsPageSize(parseInt(e.target.value, 10)); setCardsPage(1); }}
          >
            {[3,5,10,20].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button onClick={handleExportExcel} className="btn">Export All to Excel</button>
      </div>

      {/* Lead cards */}
      <h3>All Leads</h3>
      {paginate(leads, cardsPage, cardsPageSize).map((lead) => {
        const entries = getLeadEntries(lead, filteredBatches);
        const totalPayment = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const allPaid = entries.length > 0 && entries.every(e => e.cleared);

        return (
          <div key={lead.id} className="lead-card">
            <div className="lead-header">
              <strong>{lead.name}</strong>
              <span className="lead-type">{lead.type}</span>
              <span className={allPaid ? 'status-paid' : 'status-pending'}>
                {allPaid ? '✅ All Paid' : '❌ Pending'}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn--ghost" onClick={() => handleExportProfilePDF(lead)}>Export Profile PDF</button>
                <button className="btn" onClick={() => handleExportPDF(lead, entries, totalPayment)}>Export Payouts PDF</button>
              </div>
            </div>

            <p className="lead-notes">{lead.notes}</p>
            <p>
              <strong>Batches Led:</strong> {entries.length}
              &nbsp;&nbsp; <strong>Total Paid:</strong> ₹{totalPayment}
            </p>

            <table className="batch-table">
              <thead>
                <tr><th>Batch Code</th><th>Date</th><th>Amount</th><th>Status</th><th>Toggle</th></tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td>{e.batchCode}</td>
                    <td>{e.date}</td>
                    <td>₹{e.amount}</td>
                    <td>{e.cleared ? '✅ Paid' : '❌ Unpaid'}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!e.cleared}
                        onChange={() => handleTogglePayment(e.id, e.leadKey, e.cleared)}
                      />
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">No batches for this lead in current filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Pager for card list */}
      <Pager page={cardsPage} setPage={setCardsPage} totalPages={Math.max(1, Math.ceil(leads.length / cardsPageSize))} />

      {/* Edit Modal */}
      {editOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <div className="modal__header">
              <div className="modal__title">Edit Lead</div>
              <button className="btn btn--icon" onClick={() => setEditOpen(false)}>✕</button>
            </div>

            <div className="modal__body">
              <div className="grid-2">
                <div className="field">
                  <label className="field__label">Name</label>
                  <input className="input" value={editData.name}
                         onChange={(e)=>setEditData({...editData, name: e.target.value})}/>
                  {editErrors.name && <div className="error">{editErrors.name}</div>}
                </div>

                <div className="field">
                  <label className="field__label">Phone</label>
                  <input className="input" value={editData.phone}
                         onChange={(e)=>setEditData({...editData, phone: e.target.value})}/>
                  {editErrors.phone && <div className="error">{editErrors.phone}</div>}
                </div>

                <div className="field">
                  <label className="field__label">Age</label>
                  <input className="input" type="number" value={editData.age}
                         onChange={(e)=>setEditData({...editData, age: e.target.value})}/>
                  {editErrors.age && <div className="error">{editErrors.age}</div>}
                </div>

                <div className="field">
                  <label className="field__label">Gender</label>
                  <select className="select" value={editData.gender}
                          onChange={(e)=>setEditData({...editData, gender: e.target.value})}>
                    <option value="">Select Gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                  {editErrors.gender && <div className="error">{editErrors.gender}</div>}
                </div>

                <div className="field">
                  <label className="field__label">Active</label>
                  <input type="checkbox" checked={editData.isActive}
                         onChange={(e)=>setEditData({...editData, isActive: e.target.checked})}/>
                </div>

                <div className="field">
                  <label className="field__label">Hired Date</label>
                  <input className="input" type="date" value={editData.hiredDate}
                         onChange={(e)=>setEditData({...editData, hiredDate: e.target.value})}/>
                  {editErrors.hiredDate && <div className="error">{editErrors.hiredDate}</div>}
                </div>

                <div className="field">
                  <label className="field__label">Type</label>
                  <select className="select" value={editData.type}
                          onChange={(e)=>setEditData({...editData, type: e.target.value})}>
                    <option value="">Select Type</option>
                    <option>Full-time</option>
                    <option>Freelance</option>
                    <option>Volunteer</option>
                  </select>
                  {editErrors.type && <div className="error">{editErrors.type}</div>}
                </div>

                <div className="field" style={{gridColumn: '1/-1'}}>
                  <label className="field__label">Notes</label>
                  <textarea className="input" rows={3} value={editData.notes}
                            onChange={(e)=>setEditData({...editData, notes: e.target.value})}/>
                </div>
              </div>
            </div>

            <div className="modal__footer">
              <button className="btn btn--danger" onClick={() => deleteLead(editData.id)} disabled={editSubmitting}>Delete</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn--ghost" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</button>
              <button className="btn btn--primary" onClick={saveEdit} disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}

export default Leads;