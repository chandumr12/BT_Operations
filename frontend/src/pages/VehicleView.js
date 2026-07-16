// VehicleView.js — Public vendor page: light mode, card view + editable driver details
import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, getDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

const VEHICLE_EMOJI = { 'Dzire':'🚗','Ertiga':'🚙','12-Seater TT':'🚐','16-Seater TT':'🚌','22-Seater TT':'🚍' };
const PKG_COLORS = {
  K: { badge: 'bg-amber-100 text-amber-800',   bar: 'bg-amber-400' },
  T: { badge: 'bg-blue-100 text-blue-800',      bar: 'bg-blue-500'  },
  C: { badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' },
};
const PACKAGE_LABELS = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };

function fmtVehicles(vehicles) {
  if (!vehicles || vehicles.length === 0) return 'TBD';
  return vehicles.map(v => `${v.count} × ${v.type}`).join(' + ');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function generateSlots(vehicles, existingSlots = []) {
  const slots = [];
  (vehicles || []).forEach(v => {
    for (let i = 0; i < v.count; i++) {
      const ex = existingSlots.find(s => s.vehicleType === v.type && s.slotIndex === i);
      slots.push({ vehicleType: v.type, slotIndex: i, driverName: ex?.driverName||'', phone: ex?.phone||'', vehicleNo: ex?.vehicleNo||'' });
    }
  });
  return slots;
}

// ── VendorCard ─────────────────────────────────────────────────────────────────
function VendorCard({ row, slots, onSlotChange, onSave, saveState }) {
  const pkg    = PKG_COLORS[row.packageCode] || {};
  const filled = slots.filter(s => s.driverName?.trim()).length;
  const total  = slots.length;

  const update = (idx, field, value) =>
    onSlotChange(slots.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Coloured top bar */}
      <div className={`h-1.5 ${pkg.bar || 'bg-slate-300'}`} />

      {/* Card header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-slate-900 font-mono">{row.batchCode}</p>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold inline-block mt-1 ${pkg.badge}`}>
              {row.packageName}
            </span>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black ${row.pax > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
              {row.pax || '—'}
            </p>
            <p className="text-xs text-slate-400">PAX</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">{fmtDate(row.startDate)} → {fmtDate(row.endDate)}</p>
        <p className="text-xs text-slate-500 mt-0.5">🚗 {fmtVehicles(row.vehicles)}</p>
        {row.itinerary && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">📍 {row.itinerary}</p>
        )}
        {row.notes && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <p className="text-xs text-amber-700">{row.notes}</p>
          </div>
        )}
      </div>

      {/* Driver details section */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">Driver Details</p>
          {total > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              filled === total ? 'bg-green-100 text-green-700'
              : filled > 0    ? 'bg-amber-100 text-amber-700'
              :                  'bg-slate-100 text-slate-500'
            }`}>
              {filled}/{total} filled
            </span>
          )}
        </div>

        {slots.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4 italic">
            Vehicle details not confirmed yet
          </p>
        ) : (
          <div className="space-y-4">
            {slots.map((slot, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                  <span className="text-base">{VEHICLE_EMOJI[slot.vehicleType]}</span>
                  {slot.vehicleType}{slot.slotIndex > 0 ? ` #${slot.slotIndex + 1}` : ''}
                </p>
                <div className="space-y-2">
                  <input
                    value={slot.driverName}
                    onChange={e => update(idx, 'driverName', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Driver name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={slot.phone}
                      onChange={e => update(idx, 'phone', e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Phone number"
                    />
                    <input
                      value={slot.vehicleNo}
                      onChange={e => update(idx, 'vehicleNo', e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Vehicle no."
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={onSave}
              disabled={saveState === 'saving'}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                saveState === 'saved'
                  ? 'bg-green-500 text-white'
                  : saveState === 'saving'
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {saveState === 'saved' ? '✓ Saved!' : saveState === 'saving' ? 'Saving…' : 'Save Driver Details'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function VehicleView() {
  const snapId = new URLSearchParams(window.location.search).get('snap');

  const [records,      setRecords]      = useState([]);
  const [driverData,   setDriverData]   = useState({});
  const [localSlots,   setLocalSlots]   = useState({});
  const [saveStates,   setSaveStates]   = useState({});
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('All');
  const [snapshotInfo, setSnapshotInfo] = useState(null);

  useEffect(() => {
    const loadDriverDetails = (docs) =>
      getDocs(collection(firestore, 'vehicle_driver_details')).then(dSnap => {
        const dd = {};
        dSnap.docs.forEach(d => { dd[d.id] = d.data().slots || []; });
        setDriverData(dd);
        const initial = {};
        docs.forEach(r => { initial[r.id] = generateSlots(r.vehicles || [], dd[r.id] || []); });
        setLocalSlots(initial);
        setLoading(false);
      });

    if (snapId) {
      getDoc(doc(firestore, 'vehicle_snapshots', snapId))
        .then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            setSnapshotInfo({
              label: data.label,
              date: data.createdAt?.toDate?.(),
              createdBy: data.createdBy,
            });
            const docs = (data.vehicles || []).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
            setRecords(docs);
            return loadDriverDetails(docs);
          }
          setLoading(false);
        }).catch(() => setLoading(false));
    } else {
      Promise.all([
        getDocs(collection(firestore, 'vehicles')),
        getDocs(collection(firestore, 'vehicle_driver_details')),
      ]).then(([vSnap, dSnap]) => {
        const docs = vSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.pax > 0 && r.isPublic !== false)
          .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
        const dd = {};
        dSnap.docs.forEach(d => { dd[d.id] = d.data().slots || []; });
        setRecords(docs);
        setDriverData(dd);
        const initial = {};
        docs.forEach(r => { initial[r.id] = generateSlots(r.vehicles || [], dd[r.id] || []); });
        setLocalSlots(initial);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [snapId]);

  const handleSave = useCallback(async (vehicleId) => {
    setSaveStates(s => ({ ...s, [vehicleId]: 'saving' }));
    try {
      await setDoc(doc(firestore, 'vehicle_driver_details', vehicleId), {
        slots: localSlots[vehicleId] || [],
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaveStates(s => ({ ...s, [vehicleId]: 'saved' }));
      setTimeout(() => setSaveStates(s => ({ ...s, [vehicleId]: 'idle' })), 3000);
    } catch {
      setSaveStates(s => ({ ...s, [vehicleId]: 'idle' }));
    }
  }, [localSlots]);

  const tabs     = ['All', 'K', 'T', 'C'];
  const displayed = filter === 'All' ? records : records.filter(r => r.packageCode === filter);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero — light */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl shadow">
              🚐
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Vehicle Allocation</h1>
              <p className="text-slate-500 text-sm">Bengaluru Trekkers · Batch Transport Schedule</p>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-4 max-w-xl">
            Please fill in the driver name, phone number, and vehicle registration for each assigned vehicle. Your entries are saved directly.
          </p>
        </div>
      </div>

      {/* Snapshot banner */}
      {snapshotInfo && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-blue-700">
            <span className="text-base">📸</span>
            <span>
              <strong>Snapshot</strong> — This link shows data shared on{' '}
              {snapshotInfo.date
                ? snapshotInfo.date.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
                : 'a previous date'}
              {snapshotInfo.createdBy ? ` by ${snapshotInfo.createdBy}` : ''}. New admin changes will not appear here.
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                filter === t
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'border-slate-300 text-slate-600 bg-white hover:border-slate-400 hover:text-slate-800'
              }`}>
              {t === 'All' ? 'All Batches' : PACKAGE_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading vehicle data…</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 text-slate-400">No active batches found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayed.map(r => (
              <VendorCard
                key={r.id}
                row={r}
                slots={localSlots[r.id] || []}
                onSlotChange={slots => setLocalSlots(s => ({ ...s, [r.id]: slots }))}
                onSave={() => handleSave(r.id)}
                saveState={saveStates[r.id] || 'idle'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-5 text-center">
          <p className="text-xs text-slate-400">
            Bengaluru Trekkers · BT Ops Platform · For queries contact your BT operations manager.
          </p>
        </div>
      </div>
    </div>
  );
}
