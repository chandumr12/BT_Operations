// src/pages/Treks.js
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/financeFirebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import '@/components/finance/finance-compat.css';

function Treks() {
  const [treks, setTreks] = useState([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    difficulty: '',
    bestTime: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch all treks
  const fetchTreks = async () => {
    const snapshot = await getDocs(collection(db, 'treks'));
    const trekList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setTreks(trekList);
  };

  useEffect(() => {
    fetchTreks();
  }, []);

  // Create trek
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return; // minimal guard
    try {
      setSubmitting(true);
      await addDoc(collection(db, 'treks'), formData);
      setFormData({ name: '', category: '', difficulty: '', bestTime: '' });
      await fetchTreks();
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered list
  const filtered = treks.filter(t =>
    [t.name, t.category, t.difficulty, t.bestTime]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="finance-scope">
    <div className="container">
      {/* Page header */}
      <div className="topbar" style={{ position: 'static', borderRadius: 12, marginBottom: 16 }}>
        <div className="topbar__left">🗻 <span>Treks</span></div>
        <div className="topbar__right">{treks.length} total</div>
      </div>

      {/* Add trek card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__title">Add New Trek</div>
        <form onSubmit={handleSubmit} className="grid-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label className="field__label">Trek Name *</label>
            <input
              className="input"
              placeholder="Eg. Kudremukh"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label className="field__label">Category</label>
            <select
              className="select"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="">Select Category</option>
              <option value="1-day">1-Day</option>
              <option value="2-day">2-Day</option>
              <option value="Himalayan">Himalayan</option>
            </select>
          </div>

          <div className="field">
            <label className="field__label">Difficulty</label>
            <input
              className="input"
              placeholder="Easy / Moderate / Hard"
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field__label">Best Time to Visit</label>
            <input
              className="input"
              placeholder="Eg. Jun–Sep"
              value={formData.bestTime}
              onChange={(e) => setFormData({ ...formData, bestTime: e.target.value })}
            />
          </div>

          <div className="field" style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Trek'}
            </button>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          className="input"
          placeholder="Search treks (name, category, difficulty, season)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <div className="filters__spacer" />
      </div>

      {/* Treks table */}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Difficulty</th>
              <th className="hide-sm">Best Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">No treks found.</td>
              </tr>
            ) : (
              filtered.map(trek => (
                <tr key={trek.id}>
                  <td>{trek.name || '—'}</td>
                  <td>{trek.category || '—'}</td>
                  <td>{trek.difficulty || '—'}</td>
                  <td className="hide-sm">{trek.bestTime || '—'}</td>
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

export default Treks;