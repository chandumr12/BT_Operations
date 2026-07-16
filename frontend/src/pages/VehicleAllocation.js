// VehicleAllocation.js — Admin: Cards + Table view, driver details, visibility toggle, vehicle stats
import React, { useState, useEffect, useMemo } from 'react';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection, getDocs, updateDoc, setDoc, addDoc, doc, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import {
  Truck, Edit2, Copy, Share2, Wand2, X, Check, ExternalLink,
  LayoutGrid, Table2, AlertTriangle, Users, Car, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ── Constants ──────────────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { type: 'Dzire',        label: '4-Seater Dzire',   max: 4  },
  { type: 'Ertiga',       label: '5-Seater Ertiga',  max: 5  },
  { type: '12-Seater TT', label: '12-Seater TT',     max: 11 },
  { type: '16-Seater TT', label: '16-Seater TT',     max: 13 },
  { type: '22-Seater TT', label: '22-Seater TT',     max: 17 },
];
const VEHICLE_EMOJI = { 'Dzire':'🚗','Ertiga':'🚙','12-Seater TT':'🚐','16-Seater TT':'🚌','22-Seater TT':'🚍' };
const PKG = {
  K: { label: 'Kedarnath 7D', color: 'bg-orange-100 text-orange-700', border: 'border-l-amber-400' },
  T: { label: 'KBT 9D',       color: 'bg-blue-100 text-blue-700',     border: 'border-l-blue-400'  },
  C: { label: 'Chardham 11D', color: 'bg-green-100 text-green-700',   border: 'border-l-emerald-400'},
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function autoSuggest(pax) {
  if (!pax || pax <= 0) return [];
  const result = {};
  let rem = pax;
  while (rem > 13) { result['22-Seater TT'] = (result['22-Seater TT'] || 0) + 1; rem -= 17; if (rem < 0) rem = 0; }
  if      (rem > 11) result['16-Seater TT'] = 1;
  else if (rem > 5)  result['12-Seater TT'] = 1;
  else if (rem > 4)  result['Ertiga']       = 1;
  else if (rem > 0)  result['Dzire']        = 1;
  const order = ['22-Seater TT','16-Seater TT','12-Seater TT','Ertiga','Dzire'];
  return order.filter(t => result[t]).map(t => ({ type: t, count: result[t] }));
}

function fmtVehicles(vehicles) {
  if (!vehicles || vehicles.length === 0) return '—';
  return vehicles.map(v => `${v.count} × ${v.type}`).join(' + ');
}

function totalCapacity(vehicles) {
  return (vehicles || []).reduce((sum, v) => {
    const cfg = VEHICLE_TYPES.find(t => t.type === v.type);
    return sum + v.count * (cfg?.max || 0);
  }, 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'2-digit' });
}

function fmtMonthKey(key) {
  if (key === 'all') return 'All Months';
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
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

// ── VehiclePicker ──────────────────────────────────────────────────────────────
function VehiclePicker({ vehicles, onChange }) {
  const counts = {};
  (vehicles || []).forEach(v => { counts[v.type] = v.count; });
  const setCount = (type, delta) => {
    const next = Math.max(0, (counts[type] || 0) + delta);
    const updated = VEHICLE_TYPES
      .map(t => ({ type: t.type, count: t.type === type ? next : (counts[t.type] || 0) }))
      .filter(v => v.count > 0);
    onChange(updated);
  };
  return (
    <div className="space-y-2">
      {VEHICLE_TYPES.map(vt => {
        const cnt = counts[vt.type] || 0;
        return (
          <div key={vt.type} className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${cnt > 0 ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
            <div>
              <p className={`text-sm font-medium ${cnt > 0 ? 'text-blue-800' : 'text-slate-600'}`}>{vt.label}</p>
              <p className="text-[11px] text-slate-400">max {vt.max} pax</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCount(vt.type, -1)} disabled={cnt === 0}
                className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-30 font-bold text-lg leading-none">−</button>
              <span className={`w-6 text-center text-sm font-bold ${cnt > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{cnt}</span>
              <button onClick={() => setCount(vt.type, 1)}
                className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg leading-none">+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── DriverSlotEditor ───────────────────────────────────────────────────────────
function DriverSlotEditor({ slots, onChange }) {
  const update = (idx, field, value) =>
    onChange(slots.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  if (!slots.length) return (
    <div className="text-center py-10 text-slate-400 text-sm">
      <p className="text-2xl mb-2">🚗</p>
      <p>No vehicles assigned yet.</p>
      <p className="text-xs mt-1">Switch to the Logistics tab to assign vehicles first.</p>
    </div>
  );
  return (
    <div className="space-y-4">
      {slots.map((slot, idx) => (
        <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            {VEHICLE_EMOJI[slot.vehicleType]} {slot.vehicleType}{slot.slotIndex > 0 ? ` #${slot.slotIndex + 1}` : ''}
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-500 font-medium">Driver Name</label>
              <input value={slot.driverName} onChange={e => update(idx, 'driverName', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 font-medium">Phone</label>
                <input value={slot.phone} onChange={e => update(idx, 'phone', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9876543210" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Vehicle Number</label>
                <input value={slot.vehicleNo} onChange={e => update(idx, 'vehicleNo', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="DL01AB1234" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── EditModal ──────────────────────────────────────────────────────────────────
function EditModal({ row, existingDriverSlots, onSave, onClose }) {
  const [tab, setTab] = useState('logistics');
  const [form, setForm] = useState({
    startDate:   row.startDate   || '',
    endDate:     row.endDate     || '',
    pax:         row.pax         || 0,
    vehicles:    row.vehicles    || [],
    itinerary:   row.itinerary   || '',
    pickupPoint: row.pickupPoint || 'Delhi Airport',
    dropPoint:   row.dropPoint   || 'Delhi Airport',
    notes:       row.notes       || '',
  });
  const [driverSlots, setDriverSlots] = useState(() =>
    generateSlots(row.vehicles || [], existingDriverSlots || [])
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleVehiclesChange = (nv) => { set('vehicles', nv); setDriverSlots(prev => generateSlots(nv, prev)); };
  const cap = totalCapacity(form.vehicles);
  const ok  = cap >= form.pax;
  const dFilled = driverSlots.filter(s => s.driverName?.trim()).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="font-bold text-slate-900 text-lg">{row.batchCode}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${PKG[row.packageCode]?.color}`}>{row.packageName}</span>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-700" /></button>
        </div>
        <div className="flex border-b border-slate-100 flex-shrink-0">
          {[{key:'logistics',label:'Logistics'},{key:'drivers',label:`Drivers (${dFilled}/${driverSlots.length})`}].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'logistics' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">PAX</label>
                  <input type="number" min="0" value={form.pax} onChange={e => set('pax', parseInt(e.target.value)||0)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-500 font-medium">Vehicle Allocation</label>
                  <button onClick={() => handleVehiclesChange(autoSuggest(form.pax))}
                    className="flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg">
                    <Wand2 size={12} /> Auto-suggest for {form.pax} pax
                  </button>
                </div>
                <VehiclePicker vehicles={form.vehicles} onChange={handleVehiclesChange} />
                <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {ok ? <Check size={13}/> : <X size={13}/>}
                  Capacity: {cap} seats / {form.pax} pax{ok ? ' — OK' : ` — UNDER by ${form.pax - cap} seats`}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Route / Itinerary</label>
                <input value={form.itinerary} onChange={e => set('itinerary', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Delhi Airport → Haridwar → …" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Pickup Point</label>
                  <input value={form.pickupPoint} onChange={e => set('pickupPoint', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Drop Point</label>
                  <input value={form.dropPoint} onChange={e => set('dropPoint', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Special instructions for vendor…" />
              </div>
            </div>
          ) : (
            <DriverSlotEditor slots={driverSlots} onChange={setDriverSlots} />
          )}
        </div>
        <div className="flex gap-2 px-6 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => onSave({ form, driverSlots })} className="flex-1 bg-blue-600 hover:bg-blue-700">
            <Check size={14} className="mr-1.5" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── BatchCard ──────────────────────────────────────────────────────────────────
function BatchCard({ row, slots, onEdit, onToggle }) {
  const isHidden = row.isPublic === false;
  const pkg      = PKG[row.packageCode];
  const filled   = slots.filter(s => s.driverName?.trim()).length;
  const total    = slots.length;
  const cap      = totalCapacity(row.vehicles);
  const capOk    = row.pax === 0 || cap >= row.pax;
  const borderColor = row.packageCode === 'K' ? 'border-l-amber-400'
                    : row.packageCode === 'T' ? 'border-l-blue-400'
                    : 'border-l-emerald-400';

  return (
    <div className={`bg-white rounded-xl border border-slate-100 border-l-4 ${borderColor} shadow-sm overflow-hidden transition-opacity ${isHidden ? 'opacity-60' : ''}`}>
      <div className="p-4">
        {/* Top row: batch + visibility toggle + PAX */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900 font-mono">{row.batchCode}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pkg?.color}`}>{row.packageName}</span>
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-2">
            <button
              onClick={() => onToggle(row)}
              title={isHidden ? 'Hidden from vendor — click to show' : 'Visible to vendor — click to hide'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                isHidden
                  ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              {isHidden ? 'Hidden' : 'Visible'}
            </button>
            <div className="text-right">
              <p className={`text-xl font-bold ${row.pax === 0 ? 'text-slate-300' : 'text-slate-700'}`}>{row.pax || '—'}</p>
              <p className="text-xs text-slate-400">PAX</p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <p className="text-xs text-slate-400 mb-3">{fmtDate(row.startDate)} → {fmtDate(row.endDate)}</p>

        {/* Vehicle badge */}
        <div className={`text-xs px-3 py-2 rounded-lg mb-3 font-medium ${capOk ? 'bg-slate-50 text-slate-600' : 'bg-red-50 text-red-600'}`}>
          {row.pax === 0 ? <span className="text-slate-300">TBD</span> : <span>{fmtVehicles(row.vehicles)}{!capOk ? ' ⚠ Under capacity' : ''}</span>}
        </div>

        {/* Driver status */}
        {total > 0 && (
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg mb-3 font-medium w-fit ${
            filled === total ? 'bg-green-50 text-green-700'
            : filled > 0    ? 'bg-amber-50 text-amber-700'
            :                  'bg-slate-100 text-slate-500'
          }`}>
            {filled === total ? '✅' : filled > 0 ? '⚠️' : '⭕'} {filled}/{total} driver{total !== 1 ? 's' : ''} assigned
          </div>
        )}

        {/* Driver list preview */}
        {slots.length > 0 && (
          <div className="space-y-1 mb-3">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-base leading-none">{VEHICLE_EMOJI[s.vehicleType]}</span>
                {s.driverName
                  ? <span className="text-slate-600 truncate">{s.driverName}{s.vehicleNo ? ` · ${s.vehicleNo}` : ''}{s.phone ? ` · ${s.phone}` : ''}</span>
                  : <span className="text-slate-300 italic">Not assigned</span>}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => onEdit(row)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors">
          <Edit2 size={12} /> Edit Details
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VehicleAllocation() {
  const { userProfile } = useAuth();
  const [rows, setRows]             = useState([]);
  const [driverData, setDriverData] = useState({});
  const [loading, setLoading]       = useState(true);
  const [snapLoading, setSnapLoading] = useState(false);
  const [activeTab, setActiveTab]   = useState('all');
  const [activeMonth, setActiveMonth] = useState('all');
  const [viewMode, setViewMode]     = useState('cards');
  const [editRow, setEditRow]       = useState(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [vSnap, dSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'vehicles'), orderBy('startDate', 'asc'))),
        getDocs(collection(firestore, 'vehicle_driver_details')),
      ]);
      setRows(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const dd = {};
      dSnap.docs.forEach(d => { dd[d.id] = d.data().slots || []; });
      setDriverData(dd);
    } catch { toast.error('Failed to load vehicle data'); }
    setLoading(false);
  };

  const handleSave = async ({ form, driverSlots }) => {
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'vehicles', editRow.id), {
        ...form, updatedAt: serverTimestamp(), updatedBy: userProfile?.displayName || 'Admin',
      });
      await setDoc(doc(firestore, 'vehicle_driver_details', editRow.id), {
        slots: driverSlots, updatedAt: serverTimestamp(), updatedBy: userProfile?.displayName || 'Admin',
      }, { merge: true });
      toast.success('Saved!');
      setEditRow(null);
      load();
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const toggleVisibility = async (row) => {
    const newVal = row.isPublic === false ? true : false;
    try {
      await updateDoc(doc(firestore, 'vehicles', row.id), { isPublic: newVal, updatedAt: serverTimestamp() });
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, isPublic: newVal } : r));
      toast.success(newVal ? '✅ Visible to vendor' : '🙈 Hidden from vendor');
    } catch { toast.error('Failed to update visibility'); }
  };

  const createSnapshot = async () => {
    const publicVehicles = rows.filter(r => r.isPublic !== false);
    const ref = await addDoc(collection(firestore, 'vehicle_snapshots'), {
      label: `Vehicle Schedule — ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`,
      createdAt: serverTimestamp(),
      createdBy: userProfile?.displayName || 'Admin',
      vehicles: publicVehicles,
    });
    return ref.id;
  };

  const copySnapshotLink = async () => {
    setSnapLoading(true);
    try {
      const id = await createSnapshot();
      navigator.clipboard.writeText(`${window.location.origin}/vehicle-view?snap=${id}`);
      toast.success('📸 Snapshot link copied! Vendors will always see today\'s data on this link.');
    } catch { toast.error('Failed to create snapshot'); }
    setSnapLoading(false);
  };

  const shareSnapshotWhatsApp = async () => {
    setSnapLoading(true);
    try {
      const id = await createSnapshot();
      const url = `${window.location.origin}/vehicle-view?snap=${id}`;
      const text = encodeURIComponent(`🚌 *Vehicle Schedule — BT Ops*\n\nVehicle allocation for all upcoming trek batches:\n👉 ${url}`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
      toast.success('📸 Snapshot created!');
    } catch { toast.error('Failed to create snapshot'); }
    setSnapLoading(false);
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const months = useMemo(() => {
    const set = new Set();
    rows.forEach(r => { if (r.startDate) set.add(r.startDate.slice(0, 7)); });
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    const pkgOk   = activeTab   === 'all' || r.packageCode === activeTab;
    const monthOk = activeMonth === 'all' || (r.startDate && r.startDate.startsWith(activeMonth));
    return pkgOk && monthOk;
  }), [rows, activeTab, activeMonth]);

  // Vehicle type totals for the filtered set
  const vehicleTotals = useMemo(() => {
    const t = {};
    filtered.filter(r => r.pax > 0).forEach(r => {
      (r.vehicles || []).forEach(v => { t[v.type] = (t[v.type] || 0) + v.count; });
    });
    return t;
  }, [filtered]);

  const activeBatches  = filtered.filter(r => r.pax > 0);
  const totalPax       = activeBatches.reduce((s, r) => s + r.pax, 0);
  const underCapCount  = rows.filter(r => r.pax > 0 && totalCapacity(r.vehicles) < r.pax).length;
  const hiddenCount    = rows.filter(r => r.isPublic === false).length;

  const TABS = [
    { key: 'all', label: 'All',          count: filtered.length },
    { key: 'K',   label: 'Kedarnath 7D', count: filtered.filter(r => r.packageCode === 'K').length },
    { key: 'T',   label: 'KBT 9D',       count: filtered.filter(r => r.packageCode === 'T').length },
    { key: 'C',   label: 'Chardham 11D', count: filtered.filter(r => r.packageCode === 'C').length },
  ];

  // Grouped by date for card view
  const grouped = {};
  filtered.forEach(r => {
    const key = r.startDate || 'TBD';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  const sortedDates = Object.keys(grouped).sort();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck size={24} className="text-blue-600" /> Vehicle Allocation
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Manage vehicle assignments and driver details for all batches</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => window.open('/vehicle-view', '_blank')} className="text-xs"><ExternalLink size={13} className="mr-1.5" /> Live Preview</Button>
          <Button variant="outline" size="sm" onClick={copySnapshotLink} disabled={snapLoading} className="text-xs"><Copy size={13} className="mr-1.5" /> {snapLoading ? 'Creating…' : 'Copy Share Link'}</Button>
          <Button size="sm" onClick={shareSnapshotWhatsApp} disabled={snapLoading} className="text-xs bg-green-600 hover:bg-green-700 text-white"><Share2 size={13} className="mr-1.5" /> {snapLoading ? 'Creating…' : 'Share WhatsApp'}</Button>
        </div>
      </div>

      {/* Month filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {months.map(m => (
          <button key={m} onClick={() => setActiveMonth(m)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0 ${
              activeMonth === m
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
            }`}>
            {fmtMonthKey(m)}
          </button>
        ))}
      </div>

      {/* Vehicle type stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Cars (Dzire/Ertiga)', emoji: '🚗', value: (vehicleTotals['Dzire']||0) + (vehicleTotals['Ertiga']||0) },
          { label: '12-Seater TT',        emoji: '🚐', value: vehicleTotals['12-Seater TT'] || 0 },
          { label: '16-Seater TT',        emoji: '🚌', value: vehicleTotals['16-Seater TT'] || 0 },
          { label: '22-Seater TT',        emoji: '🚍', value: vehicleTotals['22-Seater TT'] || 0 },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <span className="text-3xl">{s.emoji}</span>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Operational stats strip */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: 'Active Batches', value: activeBatches.length, color: 'text-blue-600 bg-blue-50' },
          { label: 'Total PAX',      value: totalPax,             color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Under Capacity', value: underCapCount,        color: underCapCount > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
          { label: 'Hidden from Vendor', value: hiddenCount,      color: hiddenCount > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold ${s.color}`}>
            <span className="text-lg font-black">{s.value}</span>
            <span className="text-xs font-medium opacity-80">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs + view toggle */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <LayoutGrid size={15} /> Cards
          </button>
          <button onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <Table2 size={15} /> Table
          </button>
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="space-y-8">
          {filtered.length === 0 && <p className="text-center text-slate-400 py-16 text-sm">No batches found</p>}
          {sortedDates.map(dateKey => {
            const group    = grouped[dateKey];
            const groupPax = group.reduce((s, r) => s + (r.pax || 0), 0);
            const dt       = dateKey && dateKey !== 'TBD' ? new Date(dateKey + 'T00:00:00') : null;
            return (
              <div key={dateKey}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-3xl font-black text-slate-800">{dt ? dt.getDate() : '?'}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 leading-tight">
                        {dt ? dt.toLocaleDateString('en-IN', { weekday: 'short' }) : ''}
                      </p>
                      <p className="text-xs text-slate-400 leading-tight">
                        {dt ? dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'TBD'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                  {groupPax > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                      TOTAL <span className="text-blue-300 ml-1">{groupPax}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.map(row => (
                    <BatchCard
                      key={row.id}
                      row={row}
                      slots={generateSlots(row.vehicles || [], driverData[row.id] || [])}
                      onEdit={setEditRow}
                      onToggle={toggleVisibility}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[80px_130px_150px_55px_190px_110px_90px_80px] gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <span>Batch</span><span>Package</span><span>Dates</span><span>PAX</span><span>Vehicles</span><span>Drivers</span><span>Visible</span><span></span>
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.length === 0 && <p className="text-center text-slate-400 py-12 text-sm">No batches found</p>}
            {filtered.map(row => {
              const cap    = totalCapacity(row.vehicles);
              const capOk  = row.pax === 0 || cap >= row.pax;
              const slots  = generateSlots(row.vehicles || [], driverData[row.id] || []);
              const filled = slots.filter(s => s.driverName?.trim()).length;
              const isHidden = row.isPublic === false;
              return (
                <div key={row.id}
                  className={`grid grid-cols-[80px_130px_150px_55px_190px_110px_90px_80px] gap-2 px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors ${row.pax === 0 ? 'opacity-50' : ''}`}>
                  <span className="font-mono font-bold text-sm text-slate-800">{row.batchCode}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${PKG[row.packageCode]?.color}`}>
                    {row.packageCode === 'K' ? 'Kedarnath' : row.packageCode === 'T' ? 'KBT' : 'Chardham'}
                  </span>
                  <div className="text-xs text-slate-600">
                    {fmtDate(row.startDate)}<span className="text-slate-300 mx-1">→</span>{fmtDate(row.endDate)}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{row.pax === 0 ? <span className="text-slate-300">—</span> : row.pax}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-700">{row.pax === 0 ? <span className="text-slate-300">TBD</span> : fmtVehicles(row.vehicles)}</span>
                    {!capOk && row.pax > 0 && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">UNDER {row.pax - cap}</span>}
                  </div>
                  <div>
                    {slots.length === 0 ? <span className="text-xs text-slate-300">—</span> : (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${filled === slots.length ? 'bg-green-100 text-green-700' : filled > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {filled}/{slots.length}
                      </span>
                    )}
                  </div>
                  <button onClick={() => toggleVisibility(row)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${isHidden ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                    {isHidden ? 'Hidden' : 'Visible'}
                  </button>
                  <button onClick={() => setEditRow(row)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Edit2 size={12} /> Edit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {underCapCount > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          ⚠️ {underCapCount} batch{underCapCount > 1 ? 'es have' : ' has'} insufficient vehicle capacity. Click Edit to fix.
        </div>
      )}

      {editRow && !saving && (
        <EditModal
          row={editRow}
          existingDriverSlots={driverData[editRow.id] || []}
          onSave={handleSave}
          onClose={() => setEditRow(null)}
        />
      )}
    </div>
  );
}
