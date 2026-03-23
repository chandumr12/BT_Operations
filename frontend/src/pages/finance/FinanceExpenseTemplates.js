// src/pages/ExpenseTemplates.js (optional)
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/financeFirebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import '@/components/finance/finance-compat.css';

const cat = [
  { value: 'insta_ads', label: 'Instagram Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'content_creator', label: 'Content Creators' },
  { value: 'rent', label: 'Office Rent' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'website', label: 'Website Mgmt' },
];

export default function ExpenseTemplates() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ category: '', subCategory: '', defaultAmount: '', recurrence: 'monthly', nextRunMonthKey: '' });

  const load = async () => {
    const snap = await getDocs(collection(db, 'expense_templates'));
    setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.category || !form.defaultAmount) return alert('Category and amount are required.');
    await addDoc(collection(db, 'expense_templates'), {
      ...form,
      defaultAmount: Number(form.defaultAmount || 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setForm({ category: '', subCategory: '', defaultAmount: '', recurrence: 'monthly', nextRunMonthKey: '' });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await deleteDoc(doc(db, 'expense_templates', id));
    load();
  };

  return (
    <div className="finance-scope">
    <div className="container">
      <div className="topbar" style={{position:'static',borderRadius:12,marginBottom:16}}>
        <div className="topbar__left">🧩 <span>Expense Templates</span></div>
        <div className="topbar__right">{list.length} templates</div>
      </div>

      <div className="card">
        <div className="card__title">Add Template</div>
        <div className="grid-3" style={{ marginTop: 8 }}>
          <select className="select" value={form.category} onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}>
            <option value="">Category</option>
            {cat.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input className="input" placeholder="Sub-category (opt)" value={form.subCategory} onChange={e=>setForm(f=>({...f,subCategory:e.target.value}))} />
          <input className="input" type="number" placeholder="Amount" value={form.defaultAmount} onChange={e=>setForm(f=>({...f,defaultAmount:e.target.value}))} />
          <select className="select" value={form.recurrence} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input className="input" type="month" placeholder="Next Run (opt)" value={form.nextRunMonthKey} onChange={e=>setForm(f=>({...f,nextRunMonthKey:e.target.value}))} />
          <div />
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
          <button className="btn btn--primary" onClick={add}>Add</button>
        </div>
      </div>

      <div className="table-wrap" style={{marginTop:12}}>
        <table className="table table--compact">
          <thead>
            <tr><th>Category</th><th>Sub</th><th>Amount</th><th>Recurrence</th><th>Next Run</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list.length===0 ? (
              <tr><td colSpan={6} className="empty-state">No templates</td></tr>
            ) : list.map(t => (
              <tr key={t.id}>
                <td>{t.category}</td>
                <td>{t.subCategory || '—'}</td>
                <td>₹{t.defaultAmount}</td>
                <td>{t.recurrence}</td>
                <td>{t.nextRunMonthKey || '—'}</td>
                <td><button className="btn btn--ghost" onClick={()=>remove(t.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}