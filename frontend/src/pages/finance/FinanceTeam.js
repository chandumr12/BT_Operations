import React, { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/financeFirebase';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';

const ROLES = ['ops', 'sales', 'content', 'guide', 'manager', 'finance', 'support'];
const SALARY_TYPES = ['fixed', 'contract', 'freelance', 'intern'];

function Team() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '', active, inactive

  // modal state
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null); // employee object or null

  // pager
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form data
  const emptyForm = {
    name: '',
    email: '',
    phone: '',
    role: '',
    status: true,
    hiredDate: '',
    salaryType: 'fixed',

    // fixed
    baseSalary: '',
    payDay: '',
    allowances: '',
    deductions: '',

    // contract/freelance
    rate: '',

    notes: '',
    bank: {
      accHolder: '',
      accNo: '',
      ifsc: '',
      upi: '',
    },
    address: '',
    dob: '',
    emergencyContact: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  // ---------- fetch ----------
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'employees'));
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // ---------- helpers ----------
  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
  const setBank = (key, value) => setForm(prev => ({ ...prev, bank: { ...(prev.bank || {}), [key]: value }}));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email || '')) e.email = 'Valid email required';
    if (!/^[0-9]{10}$/.test(form.phone || '')) e.phone = 'Valid 10-digit phone required';
    if (!form.role) e.role = 'Role required';
    if (!form.hiredDate) e.hiredDate = 'Hired date required';
    if (!form.salaryType) e.salaryType = 'Salary type required';

    if (form.salaryType === 'fixed') {
      if (!form.baseSalary || Number(form.baseSalary) <= 0) e.baseSalary = 'Base salary required';
      if (!form.payDay || Number(form.payDay) < 1 || Number(form.payDay) > 31) e.payDay = 'Pay day (1–31) required';
    } else {
      if (!form.rate || Number(form.rate) <= 0) e.rate = 'Rate required';
    }
    return e;
  };

  // ---------- filtered list ----------
  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase();
    return list.filter(emp => {
      const bySearch =
        !s ||
        (emp.name || '').toLowerCase().includes(s) ||
        (emp.email || '').toLowerCase().includes(s) ||
        (emp.phone || '').toLowerCase().includes(s);
      const byRole = !roleFilter || emp.role === roleFilter;
      const byStatus =
        !statusFilter ||
        (statusFilter === 'active' && emp.status) ||
        (statusFilter === 'inactive' && !emp.status);
      return bySearch && byRole && byStatus;
    });
  }, [list, search, roleFilter, statusFilter]);

  // reset to first page when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter, pageSize]);

  // pagination helpers
  const paginate = (arr, p, size) => arr.slice((p - 1) * size, (p - 1) * size + size);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // ---------- create/edit ----------
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setSubmitted(false);
    setOpenForm(true);
    // scroll to top of modal if needed (UI already scrollable)
  };

  const openEdit = (emp) => {
    setEditing(emp);
    // normalize missing nested objects
    setForm({
      ...emptyForm,
      ...emp,
      bank: { ...(emptyForm.bank), ...(emp.bank || {}) },
    });
    setErrors({});
    setSubmitted(false);
    setOpenForm(true);
  };

  const handleSave = async () => {
    setSubmitted(true);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      ...form,
      baseSalary: form.baseSalary ? Number(form.baseSalary) : '',
      payDay: form.payDay ? Number(form.payDay) : '',
      allowances: form.allowances ? Number(form.allowances) : '',
      deductions: form.deductions ? Number(form.deductions) : '',
      rate: form.rate ? Number(form.rate) : '',
      updatedAt: Timestamp.now(),
      createdAt: editing?.createdAt || Timestamp.now(),
    };

    if (editing?.id) {
      await updateDoc(doc(db, 'employees', editing.id), payload);
    } else {
      await addDoc(collection(db, 'employees'), payload);
    }

    // refresh list
    const snap = await getDocs(collection(db, 'employees'));
    setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));

    setOpenForm(false);
    setEditing(null);
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'employees', emp.id));
    setList(prev => prev.filter(x => x.id !== emp.id));
  };

  // small utils
  const maskAccNo = (acc) => {
    const s = (acc || '').toString();
    if (!s) return '—';
    return s.length > 4 ? `•••• ${s.slice(-4)}` : '••••';
  };

  const currency = (n) => (n || n === 0)
    ? `₹${Number(n).toLocaleString('en-IN')}`
    : '—';

  return (
    <div className="finance-scope">
    <div className="container">
      {/* Header */}
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 16 }}>
        <div className="topbar__left">👥 <span>Team</span></div>
        <div className="topbar__right">{filtered.length} employees</div>
      </div>

      {/* Actions / Filters */}
      <div className="filters">
        <input
          className="input"
          placeholder="Search name / email / phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select className="select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="filters__spacer" />

        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
          >
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button className="btn btn--primary" onClick={openCreate}>+ Add Employee</button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Name</th>
              <th className="hide-sm">Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th className="hide-sm">Salary Type</th>
              <th className="hide-sm">Base/Rate</th>
              <th>Status</th>
              <th>⚙️</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="empty-state">No employees match your filters.</td></tr>
            )}
            {paginate(filtered, page, pageSize).map(emp => (
              <tr key={emp.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{emp.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{emp.hiredDate || '—'}</div>
                </td>
                <td className="hide-sm">{emp.role || '—'}</td>
                <td>{emp.email || '—'}</td>
                <td>{emp.phone || '—'}</td>
                <td className="hide-sm">{emp.salaryType || '—'}</td>
                <td className="hide-sm">
                  {emp.salaryType === 'fixed'
                    ? currency(emp.baseSalary)
                    : emp.rate ? currency(emp.rate) : '—'}
                </td>
                <td>{emp.status ? '✅ Active' : '❌ Inactive'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button className="btn btn--ghost" onClick={() => openEdit(emp)}>View / Edit</button>
                    <button className="btn btn--danger" onClick={() => handleDelete(emp)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pager page={page} setPage={setPage} totalPages={totalPages} />
      </div>

      {/* Create/Edit Modal (scrollable content) */}
      {openForm && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header">
              <div className="modal__title">{editing ? 'Edit Employee' : 'Add Employee'}</div>
              <button className="btn btn--icon" onClick={() => setOpenForm(false)}>✕</button>
            </div>

            <div className="modal__body" style={{ overflowY: 'auto' }}>
              {/* Basic */}
              <div className="grid-3">
                <div className="field">
                  <label className="field__label">Name *</label>
                  <input className="input" value={form.name} onChange={e=>setField('name', e.target.value)} placeholder="Full name" />
                  {submitted && errors.name && <div className="error">{errors.name}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Email *</label>
                  <input className="input" value={form.email} onChange={e=>setField('email', e.target.value)} placeholder="name@domain.com" />
                  {submitted && errors.email && <div className="error">{errors.email}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Phone *</label>
                  <input className="input" value={form.phone} onChange={e=>/^[0-9]{0,10}$/.test(e.target.value) && setField('phone', e.target.value)} placeholder="10-digit number" />
                  {submitted && errors.phone && <div className="error">{errors.phone}</div>}
                </div>

                <div className="field">
                  <label className="field__label">Role *</label>
                  <select className="select" value={form.role} onChange={e=>setField('role', e.target.value)}>
                    <option value="">Select role</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {submitted && errors.role && <div className="error">{errors.role}</div>}
                </div>
                <div className="field">
                  <label className="field__label">Status</label>
                  <select className="select" value={form.status ? 'active' : 'inactive'} onChange={e=>setField('status', e.target.value === 'active')}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Hired Date *</label>
                  <input className="input" type="date" value={form.hiredDate} onChange={e=>setField('hiredDate', e.target.value)} />
                  {submitted && errors.hiredDate && <div className="error">{errors.hiredDate}</div>}
                </div>
              </div>

              {/* Compensation */}
              <h4 className="muted" style={{ marginTop: 10 }}>Compensation</h4>
              <div className="grid-3">
                <div className="field">
                  <label className="field__label">Salary Type *</label>
                  <select className="select" value={form.salaryType} onChange={e=>setField('salaryType', e.target.value)}>
                    {SALARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {submitted && errors.salaryType && <div className="error">{errors.salaryType}</div>}
                </div>

                {form.salaryType === 'fixed' ? (
                  <>
                    <div className="field">
                      <label className="field__label">Base Salary (₹) *</label>
                      <input className="input" type="number" value={form.baseSalary} onChange={e=>setField('baseSalary', e.target.value)} />
                      {submitted && errors.baseSalary && <div className="error">{errors.baseSalary}</div>}
                    </div>
                    <div className="field">
                      <label className="field__label">Pay Day (1–31) *</label>
                      <input className="input" type="number" min={1} max={31} value={form.payDay} onChange={e=>setField('payDay', e.target.value)} />
                      {submitted && errors.payDay && <div className="error">{errors.payDay}</div>}
                    </div>
                    <div className="field">
                      <label className="field__label">Allowances (₹)</label>
                      <input className="input" type="number" value={form.allowances} onChange={e=>setField('allowances', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Deductions (₹)</label>
                      <input className="input" type="number" value={form.deductions} onChange={e=>setField('deductions', e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label className="field__label">Rate (₹) *</label>
                      <input className="input" type="number" value={form.rate} onChange={e=>setField('rate', e.target.value)} />
                      {submitted && errors.rate && <div className="error">{errors.rate}</div>}
                    </div>
                    <div className="field">
                      <label className="field__label">Notes</label>
                      <input className="input" value={form.notes} onChange={e=>setField('notes', e.target.value)} placeholder="Contract scope / terms" />
                    </div>
                  </>
                )}
              </div>

              {/* Bank + Personal */}
              <h4 className="muted" style={{ marginTop: 10 }}>Bank & Personal</h4>
              <div className="grid-3">
                <div className="field">
                  <label className="field__label">Account Holder</label>
                  <input className="input" value={form.bank?.accHolder || ''} onChange={e=>setBank('accHolder', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">Account No.</label>
                  <input className="input" value={form.bank?.accNo || ''} onChange={e=>setBank('accNo', e.target.value)} placeholder="Will be stored as-is" />
                  {/* For full security, consider masking client-side and storing hashed; this is just MVP */}
                </div>
                <div className="field">
                  <label className="field__label">IFSC</label>
                  <input className="input" value={form.bank?.ifsc || ''} onChange={e=>setBank('ifsc', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">UPI</label>
                  <input className="input" value={form.bank?.upi || ''} onChange={e=>setBank('upi', e.target.value)} />
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label className="field__label">Address</label>
                  <textarea className="input" rows={2} value={form.address} onChange={e=>setField('address', e.target.value)} placeholder="Street, City, PIN" />
                </div>
                <div className="field">
                  <label className="field__label">DOB</label>
                  <input className="input" type="date" value={form.dob} onChange={e=>setField('dob', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">Emergency Contact</label>
                  <input className="input" value={form.emergencyContact} onChange={e=>setField('emergencyContact', e.target.value)} placeholder="Name / Phone" />
                </div>
              </div>

              {/* Read-only quick calc (if fixed) */}
              {form.salaryType === 'fixed' && (
                <div className="cards-grid" style={{ marginTop: 8 }}>
                  <div className="card">
                    <div className="card__title">Gross</div>
                    <div className="card__metric">{currency(Number(form.baseSalary || 0) + Number(form.allowances || 0))}</div>
                    <div className="card__sub">Base + allowances</div>
                  </div>
                  <div className="card">
                    <div className="card__title">Net (preview)</div>
                    <div className="card__metric">
                      {currency(Number(form.baseSalary || 0) + Number(form.allowances || 0) - Number(form.deductions || 0))}
                    </div>
                    <div className="card__sub">Gross − deductions</div>
                  </div>
                  <div className="card">
                    <div className="card__title">Pay Day</div>
                    <div className="card__metric">{form.payDay || '—'}</div>
                    <div className="card__sub">of every month</div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={()=>setOpenForm(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSave}>{editing ? 'Save Changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default Team;