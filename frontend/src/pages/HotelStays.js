import React, { useState, useEffect, useMemo, useRef, Component } from 'react';

class BatchErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('BatchManager crash:', e, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <p className="text-red-600 font-semibold text-sm mb-1">Batch view failed to load</p>
          <p className="text-xs text-slate-500 mb-3 font-mono">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ error: null })} className="text-xs text-indigo-600 hover:underline">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, setDoc, getDoc, doc, deleteField } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Plus, Edit2, Trash2, ExternalLink, Copy, Check, X,
  Hotel, Calendar, Users, BedDouble, ChevronDown, ChevronUp,
  LayoutGrid, Layers, ChevronLeft, Truck,
} from 'lucide-react';

const PLACES = [
  'Haridwar', 'Barkot', 'Uttarakashi', 'Guptakashi',
  'Kedarnath', 'Mandal/Chopta', 'Joshimath-Badrinath', 'Rishikesh',
];

const PRESET_CODES = [
  { value: 'K', label: 'K — Kedarnath 7D' },
  { value: 'T', label: 'T — KBT 9D' },
  { value: 'C', label: 'C — Chardham 11D' },
  { value: 'custom', label: 'Custom...' },
];

const STATUS_OPTIONS = ['CHECK-IN', 'CHECK-OUT', '1N'];
const PKG = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };

function slugify(place) {
  return place.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
}

function statusClass(s) {
  if (s === 'CHECK-IN') return { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a' };
  if (s === 'CHECK-OUT') return { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb' };
  return { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c' };
}

function groupByDate(stays) {
  const map = {};
  for (const s of stays) {
    if (!map[s.date]) {
      const d = new Date(s.date + 'T00:00:00');
      map[s.date] = {
        date: s.date,
        day: d.getDate(),
        dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        year: d.getFullYear(),
        batches: [],
      };
    }
    map[s.date].batches.push(s);
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

const EMPTY_FORM = {
  place: PLACES[0],
  date: '',
  serial: '',
  codePreset: 'K',
  codeCustom: '',
  packageName: '',
  pax: '',
  status: 'CHECK-IN',
  doubleSharingPairs: [],
  sharingRooms: [],
  male: '',
  female: '',
};

function emptyPair() {
  return { name1: '', gender1: 'M', name2: '', gender2: 'F' };
}

const ROOM_TYPES = [
  { value: '3', label: '3-Sharing', capacity: 3 },
  { value: '4', label: '4-Sharing', capacity: 4 },
  { value: 'dorm', label: 'Dorm', capacity: 8 },
];
const ROOM_TYPE_COLORS = {
  '3':    { bg: '#f0fdf4', border: '#bbf7d0', badge: 'bg-emerald-100 text-emerald-700', title: 'text-emerald-700' },
  '4':    { bg: '#f0f9ff', border: '#bae6fd', badge: 'bg-sky-100 text-sky-700',         title: 'text-sky-700'     },
  'dorm': { bg: '#fffbeb', border: '#fde68a', badge: 'bg-amber-100 text-amber-700',     title: 'text-amber-700'   },
};

function emptyRoomGroup(type) {
  const info = ROOM_TYPES.find(t => t.value === type) || ROOM_TYPES[0];
  return {
    type,
    capacity: info.capacity,
    people: Array.from({ length: info.capacity }, (_, i) => ({ name: '', gender: i % 2 === 0 ? 'F' : 'M' })),
  };
}

// ── Add New Batch modal ──────────────────────────────────────────────────────
const PLACE_ORDER = [
  { place: 'Haridwar',             defaultStatus: '1N'       },
  { place: 'Barkot',               defaultStatus: 'CHECK-IN' },
  { place: 'Uttarakashi',          defaultStatus: 'CHECK-IN' },
  { place: 'Guptakashi',           defaultStatus: 'CHECK-IN' },
  { place: 'Kedarnath',            defaultStatus: '1N'       },
  { place: 'Mandal/Chopta',        defaultStatus: '1N'       },
  { place: 'Joshimath-Badrinath',  defaultStatus: '1N'       },
  { place: 'Rishikesh',            defaultStatus: '1N'       },
];

function emptyNight(defaultStatus) {
  return { date: '', pax: '', status: defaultStatus };
}

// ── DSPairsEditor ─────────────────────────────────────────────────────────────
function DSPairsEditor({ pairs, onChange }) {
  function addPair() { onChange([...pairs, emptyPair()]); }
  function removePair(idx) { onChange(pairs.filter((_, i) => i !== idx)); }
  function updatePair(idx, field, val) {
    onChange(pairs.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }

  return (
    <div className="space-y-2">
      {pairs.map((pair, idx) => (
        <div key={idx} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Room {idx + 1}</span>
            <button type="button" onClick={() => removePair(idx)}
              className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded hover:bg-red-50">
              <X size={13} />
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <select value={pair.gender1} onChange={e => updatePair(idx, 'gender1', e.target.value)}
                className="w-16 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="M">M</option><option value="F">F</option>
              </select>
              <Input value={pair.name1} onChange={e => updatePair(idx, 'name1', e.target.value)}
                placeholder="Person 1 name" className="h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <select value={pair.gender2} onChange={e => updatePair(idx, 'gender2', e.target.value)}
                className="w-16 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="M">M</option><option value="F">F</option>
              </select>
              <Input value={pair.name2} onChange={e => updatePair(idx, 'name2', e.target.value)}
                placeholder="Person 2 name" className="h-8 text-xs" />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addPair}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-purple-300 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors">
        <Plus size={13} /> Add Double Sharing Room
      </button>
    </div>
  );
}

// ── RoomGroupsEditor — 3-sharing, 4-sharing, dorm ────────────────────────────
function RoomGroupsEditor({ rooms, onChange }) {
  const [addType, setAddType] = useState('3');

  function addRoom() { onChange([...rooms, emptyRoomGroup(addType)]); }
  function removeRoom(ri) { onChange(rooms.filter((_, i) => i !== ri)); }

  function updatePerson(ri, pi, field, val) {
    onChange(rooms.map((r, i) => i !== ri ? r : {
      ...r,
      people: r.people.map((p, j) => j !== pi ? p : { ...p, [field]: val }),
    }));
  }

  function addPersonToDorm(ri) {
    onChange(rooms.map((r, i) => i !== ri ? r : {
      ...r,
      people: [...r.people, { name: '', gender: 'F' }],
    }));
  }

  function removePersonFromDorm(ri, pi) {
    onChange(rooms.map((r, i) => i !== ri ? r : {
      ...r,
      people: r.people.filter((_, j) => j !== pi),
    }));
  }

  function updateDormCapacity(ri, val) {
    const cap = Math.max(2, parseInt(val) || 2);
    onChange(rooms.map((r, i) => i !== ri ? r : {
      ...r,
      capacity: cap,
      people: cap > r.people.length
        ? [...r.people, ...Array.from({ length: cap - r.people.length }, () => ({ name: '', gender: 'F' }))]
        : r.people.slice(0, cap),
    }));
  }

  return (
    <div className="space-y-2">
      {rooms.map((room, ri) => {
        const c = ROOM_TYPE_COLORS[room.type] || ROOM_TYPE_COLORS['3'];
        const typeInfo = ROOM_TYPES.find(t => t.value === room.type);
        const label = room.type === 'dorm'
          ? `Dorm`
          : `${room.type}-Sharing`;

        return (
          <div key={ri} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10 }} className="p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{label}</span>
                {room.type === 'dorm' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">capacity</span>
                    <input type="number" min="2" max="50" value={room.capacity}
                      onChange={e => updateDormCapacity(ri, e.target.value)}
                      className="w-14 h-6 text-xs border border-slate-200 rounded-lg px-1.5 focus:outline-none focus:ring-1 bg-white" />
                  </div>
                )}
                <span className="text-[10px] text-slate-400 font-medium">
                  {room.people.filter(p => p.name?.trim()).length}/{room.people.length} filled
                </span>
              </div>
              <button type="button" onClick={() => removeRoom(ri)}
                className="text-slate-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors">
                <X size={13} />
              </button>
            </div>

            <div className="space-y-1.5">
              {room.people.map((person, pi) => (
                <div key={pi} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 w-5 shrink-0 text-center">
                    {pi + 1}
                  </span>
                  <select value={person.gender}
                    onChange={e => updatePerson(ri, pi, 'gender', e.target.value)}
                    className="w-14 shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-500">
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                  <Input value={person.name}
                    onChange={e => updatePerson(ri, pi, 'name', e.target.value)}
                    placeholder={`Person ${pi + 1}`}
                    className="h-8 text-xs flex-1" />
                  {room.type === 'dorm' && (
                    <button type="button" onClick={() => removePersonFromDorm(ri, pi)}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-0.5">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {room.type === 'dorm' && (
                <button type="button" onClick={() => addPersonToDorm(ri)}
                  className="text-[11px] text-purple-500 hover:text-purple-700 font-medium flex items-center gap-1 mt-1 pl-7">
                  <Plus size={11} /> Add person
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <select value={addType} onChange={e => setAddType(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          {ROOM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" onClick={addRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-purple-300 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors">
          <Plus size={13} /> Add Room
        </button>
      </div>
    </div>
  );
}

// ── AddBatchModal ─────────────────────────────────────────────────────────────
function AddBatchModal({ stays, onSave, onCancel, loading }) {
  const nextSerial = useMemo(() => {
    if (!stays.length) return 1;
    return Math.max(...stays.map(s => s.serial)) + 1;
  }, [stays]);

  const [serial, setSerial]           = useState(String(nextSerial));
  const [codePreset, setCodePreset]   = useState('K');
  const [codeCustom, setCodeCustom]   = useState('');
  const [packageName, setPackageName] = useState('');
  const [male, setMale]               = useState('');
  const [female, setFemale]           = useState('');
  const [dsPairs, setDsPairs]         = useState([]);
  const [sharingRooms, setSharingRooms] = useState([]);

  const [nights, setNights] = useState(() =>
    PLACE_ORDER.reduce((acc, { place, defaultStatus }) => {
      acc[place] = { enabled: false, entries: [emptyNight(defaultStatus)] };
      return acc;
    }, {})
  );

  function togglePlace(place, checked) {
    setNights(n => ({ ...n, [place]: { ...n[place], enabled: checked } }));
  }
  function setEntry(place, idx, key, val) {
    setNights(n => {
      const entries = n[place].entries.map((e, i) => i === idx ? { ...e, [key]: val } : e);
      return { ...n, [place]: { ...n[place], entries } };
    });
  }
  function addNight(place) {
    setNights(n => {
      const last = n[place].entries[n[place].entries.length - 1];
      return { ...n, [place]: { ...n[place], entries: [...n[place].entries, emptyNight(last.status)] } };
    });
  }
  function removeNight(place, idx) {
    setNights(n => {
      const entries = n[place].entries.filter((_, i) => i !== idx);
      return { ...n, [place]: { ...n[place], entries: entries.length ? entries : [emptyNight('CHECK-IN')] } };
    });
  }

  function submit(e) {
    e.preventDefault();
    const enabled = PLACE_ORDER.filter(({ place }) => nights[place].enabled);
    if (!enabled.length) { toast.error('Enable at least one place'); return; }
    if (!serial || isNaN(Number(serial))) { toast.error('Valid batch serial required'); return; }
    const code    = codePreset === 'custom' ? codeCustom : codePreset;
    const pkgName = codePreset === 'custom' ? packageName : (PKG[codePreset] || '');
    const entries = [];
    for (const { place } of enabled) {
      for (const [i, entry] of nights[place].entries.entries()) {
        if (!entry.date) { toast.error(`Date required for ${place} (night ${i + 1})`); return; }
        if (!entry.pax || isNaN(Number(entry.pax))) { toast.error(`Pax required for ${place} (night ${i + 1})`); return; }
        entries.push({
          place, date: entry.date, serial: Number(serial),
          code, packageName: pkgName,
          pax: Number(entry.pax), status: entry.status,
          doubleSharingPairs: dsPairs, doubleSharing: dsPairs.length,
          sharingRooms,
          male: male ? Number(male) : 0, female: female ? Number(female) : 0,
          clientNames: [],
        });
      }
    }
    onSave(entries);
  }

  return (
    <form onSubmit={submit}>
      <div className="overflow-y-auto pr-1 space-y-4" style={{ maxHeight: '65vh' }}>
        {/* Batch header */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Batch Serial #</Label>
              <Input type="number" min="1" value={serial} onChange={e => setSerial(e.target.value)} className="mt-1" required />
            </div>
            <div>
              <Label>Package</Label>
              <select value={codePreset} onChange={e => setCodePreset(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {PRESET_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {codePreset === 'custom' && (
              <>
                <div>
                  <Label>Custom Code</Label>
                  <Input placeholder="e.g. SP" value={codeCustom} onChange={e => setCodeCustom(e.target.value.toUpperCase())} className="mt-1" maxLength={6} />
                </div>
                <div>
                  <Label>Package Name</Label>
                  <Input placeholder="e.g. Special 8D" value={packageName} onChange={e => setPackageName(e.target.value)} className="mt-1" />
                </div>
              </>
            )}
            <div>
              <Label>Male (total in batch)</Label>
              <Input type="number" min="0" placeholder="0" value={male} onChange={e => setMale(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Female (total in batch)</Label>
              <Input type="number" min="0" placeholder="0" value={female} onChange={e => setFemale(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Double Sharing Rooms <span className="text-slate-400 font-normal text-xs">(2 per room)</span></Label>
            <DSPairsEditor pairs={dsPairs} onChange={setDsPairs} />
          </div>
          <div>
            <Label className="mb-2 block">Other Room Types <span className="text-slate-400 font-normal text-xs">(3-sharing, 4-sharing, dorm)</span></Label>
            <RoomGroupsEditor rooms={sharingRooms} onChange={setSharingRooms} />
          </div>
        </div>

        {/* Place rows */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Places &amp; Nights</p>
          {PLACE_ORDER.map(({ place }) => {
            const { enabled, entries } = nights[place];
            return (
              <div key={place} className={`rounded-lg border transition-colors ${enabled ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
                <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={enabled} onChange={e => togglePlace(place, e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  <span className={`text-sm font-semibold flex-1 ${enabled ? 'text-indigo-700' : 'text-slate-500'}`}>{place}</span>
                  {enabled && <span className="text-xs text-indigo-500 font-medium">{entries.length} night{entries.length > 1 ? 's' : ''}</span>}
                </label>
                {enabled && (
                  <div className="px-3 pb-3 space-y-2">
                    {entries.map((entry, idx) => (
                      <div key={idx} className="bg-white rounded-lg border border-indigo-100 p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Night {idx + 1}</span>
                          {entries.length > 1 && (
                            <button type="button" onClick={() => removeNight(place, idx)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Date</Label>
                            <Input type="date" value={entry.date} onChange={e => setEntry(place, idx, 'date', e.target.value)} className="mt-0.5 h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Pax</Label>
                            <Input type="number" min="1" placeholder="16" value={entry.pax} onChange={e => setEntry(place, idx, 'pax', e.target.value)} className="mt-0.5 h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Status</Label>
                            <select value={entry.status} onChange={e => setEntry(place, idx, 'status', e.target.value)}
                              className="w-full mt-0.5 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addNight(place)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-600 text-xs font-medium hover:bg-indigo-50 transition-colors">
                      <Plus size={13} /> Add another night
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4">
        <Button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
          {loading ? 'Saving...' : `Save Batch #${serial}`}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── EntryForm ─────────────────────────────────────────────────────────────────
function EntryForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function resolvedCode() { return form.codePreset === 'custom' ? form.codeCustom : form.codePreset; }
  function resolvedPkg() {
    if (form.codePreset === 'custom') return form.packageName;
    return PKG[form.codePreset] || '';
  }

  function submit(e) {
    e.preventDefault();
    const code = resolvedCode();
    if (!code) { toast.error('Package code is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.pax || isNaN(Number(form.pax))) { toast.error('Valid pax count is required'); return; }
    if (!form.serial || isNaN(Number(form.serial))) { toast.error('Serial number is required'); return; }
    const pairs = form.doubleSharingPairs || [];
    onSave({
      place: form.place, date: form.date,
      serial: Number(form.serial),
      code, packageName: resolvedPkg(),
      pax: Number(form.pax), status: form.status,
      doubleSharingPairs: pairs, doubleSharing: pairs.length,
      sharingRooms: form.sharingRooms || [],
      male: form.male ? Number(form.male) : 0,
      female: form.female ? Number(form.female) : 0,
      clientNames: [],
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="overflow-y-auto max-h-[65vh] pr-1 space-y-3">
        <div>
          <Label>Place</Label>
          <select value={form.place} onChange={e => set('place', e.target.value)}
            className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label>Batch Serial #</Label>
            <Input type="number" min="1" placeholder="1" value={form.serial} onChange={e => set('serial', e.target.value)} className="mt-1" required />
          </div>
        </div>

        <div>
          <Label>Package</Label>
          <select value={form.codePreset} onChange={e => set('codePreset', e.target.value)}
            className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {PRESET_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {form.codePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Custom Code</Label>
              <Input placeholder="e.g. SP" value={form.codeCustom} onChange={e => set('codeCustom', e.target.value.toUpperCase())} className="mt-1" maxLength={6} />
            </div>
            <div>
              <Label>Package Name</Label>
              <Input placeholder="e.g. Special Group 8D" value={form.packageName} onChange={e => set('packageName', e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Status</Label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label>Total Pax</Label>
            <Input type="number" min="1" placeholder="16" value={form.pax} onChange={e => set('pax', e.target.value)} className="mt-1" required />
          </div>
          <div>{/* spacer */}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Male (total)</Label>
            <Input type="number" min="0" placeholder="0" value={form.male} onChange={e => set('male', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Female (total)</Label>
            <Input type="number" min="0" placeholder="0" value={form.female} onChange={e => set('female', e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Double Sharing Rooms <span className="text-slate-400 font-normal text-xs">(2 per room)</span></Label>
          <DSPairsEditor
            pairs={form.doubleSharingPairs || []}
            onChange={val => set('doubleSharingPairs', val)}
          />
        </div>
        <div>
          <Label className="mb-2 block">Other Room Types <span className="text-slate-400 font-normal text-xs">(3-sharing, 4-sharing, dorm)</span></Label>
          <RoomGroupsEditor
            rooms={form.sharingRooms || []}
            onChange={val => set('sharingRooms', val)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4">
        <Button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
          {loading ? 'Saving...' : 'Save Entry'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── BatchCard — card inside card for double sharing ───────────────────────────
function BatchCard({ b, onEdit, onDelete }) {
  const [dsOpen, setDsOpen] = useState(false);
  const [srOpen, setSrOpen] = useState({});
  const c       = statusClass(b.status);
  const pkgName = PKG[b.code] || b.packageName || b.code || '';

  const pairs    = b.doubleSharingPairs || [];
  const legacyDS = !pairs.length && (b.doubleSharing > 0);
  const dsCount  = pairs.length || (legacyDS ? b.doubleSharing : 0);
  const dsM      = pairs.reduce((n, p) => n + (p.gender1 === 'M' ? 1 : 0) + (p.gender2 === 'M' ? 1 : 0), 0);
  const dsF      = pairs.reduce((n, p) => n + (p.gender1 === 'F' ? 1 : 0) + (p.gender2 === 'F' ? 1 : 0), 0);
  const totalM   = b.male || 0;
  const totalF   = b.female || 0;

  // sharingRooms stats
  const srRooms  = b.sharingRooms || [];
  const srByType = ROOM_TYPES.map(t => ({
    ...t,
    rooms: srRooms.filter(r => r.type === t.value),
  })).filter(t => t.rooms.length > 0);
  const srM = srRooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'M').length, 0);
  const srF = srRooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'F').length, 0);
  const unassignedM = Math.max(0, totalM - dsM - srM);
  const unassignedF = Math.max(0, totalF - dsF - srF);

  return (
    <div style={{ background: c.bg, border: `2px solid ${c.border}`, borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: c.accent }} />

      {/* ── Header: batch info + pax ── */}
      <div className="pl-4 pr-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-bold text-sm leading-tight">Batch {b.serial}</span>
            <span style={{ background: c.accent, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.5px', display: 'inline-block', width: 'fit-content' }}>
              {b.status === 'CHECK-IN' ? 'CHECK-IN' : b.status === 'CHECK-OUT' ? 'CHECK-OUT' : '1 NIGHT'}
            </span>
            <span className="text-[11px] text-slate-500 italic">{b.code} • {pkgName}</span>
            {b.status === 'CHECK-OUT' && (
              <span className="text-[11px] font-bold" style={{ color: c.accent }}>↩ Same rooms</span>
            )}
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: 28, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{b.pax}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">pax</span>
            <div className="flex gap-1 mt-2">
              <button onClick={() => onEdit(b)}
                className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-white/60 transition-colors">
                <Edit2 size={12} />
              </button>
              <button onClick={() => onDelete(b)}
                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-white/60 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Total M/F row */}
        {(totalM > 0 || totalF > 0) && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            {totalM > 0 && <span className="bg-blue-100 text-blue-700 font-bold text-[11px] px-2 py-0.5 rounded-full">{totalM}M</span>}
            {totalF > 0 && <span className="bg-pink-100 text-pink-700 font-bold text-[11px] px-2 py-0.5 rounded-full">{totalF}F</span>}
          </div>
        )}
      </div>

      {/* ── Double Sharing card-inside-card ── */}
      {dsCount > 0 && (
        <div className="mx-3 mb-3 rounded-xl border border-purple-200 overflow-hidden bg-white/60">
          {/* DS toggle header */}
          <button
            type="button"
            onClick={() => setDsOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-purple-50/70 transition-colors"
          >
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                🛏 {dsCount} double {dsCount === 1 ? 'room' : 'rooms'}
              </span>
              {pairs.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="bg-blue-100 text-blue-700 font-bold text-[10px] px-1.5 py-0.5 rounded-full">{dsM}M</span>
                  <span className="bg-pink-100 text-pink-700 font-bold text-[10px] px-1.5 py-0.5 rounded-full">{dsF}F</span>
                </span>
              )}
            </span>
            <span className="text-slate-400 shrink-0">
              {dsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </button>

          {/* Expanded pair details */}
          {dsOpen && (
            <div className="border-t border-purple-100 p-2 space-y-2">
              {pairs.map((pair, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-purple-100 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-2">Room {idx + 1}</p>
                  <div className="space-y-1.5">
                    {[{name: pair.name1, gender: pair.gender1}, {name: pair.name2, gender: pair.gender2}].map((person, pi) => (
                      <div key={pi} className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${person.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                          {person.gender}
                        </span>
                        <span className="text-xs text-slate-700 font-medium leading-tight">{person.name || <span className="text-slate-300 italic">—</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {legacyDS && b.clientNames?.length > 0 && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500">
                  {b.clientNames.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Other room type sections (3-sharing, 4-sharing, dorm) ── */}
      {srByType.map(({ value, label, rooms, color }) => {
        const tc = ROOM_TYPE_COLORS[value];
        const rM = rooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'M').length, 0);
        const rF = rooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'F').length, 0);
        const isOpen = srOpen[value];
        return (
          <div key={value} className="mx-3 mb-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: '#fff9' }}>
            <button type="button" onClick={() => setSrOpen(s => ({ ...s, [value]: !s[value] }))}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50/70 transition-colors">
              <span className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-bold ${tc.title} flex items-center gap-1`}>
                  🏠 {rooms.length} {value === 'dorm' ? 'dorm' : `${value}-sharing`} {rooms.length === 1 ? 'room' : 'rooms'}
                </span>
                <span className="bg-blue-100 text-blue-700 font-bold text-[10px] px-1.5 py-0.5 rounded-full">{rM}M</span>
                <span className="bg-pink-100 text-pink-700 font-bold text-[10px] px-1.5 py-0.5 rounded-full">{rF}F</span>
              </span>
              <span className="text-slate-400 shrink-0">{isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
            </button>
            {isOpen && (
              <div className="border-t p-2 space-y-2" style={{ borderColor: tc.border }}>
                {rooms.map((room, ri) => (
                  <div key={ri} className="bg-white rounded-lg border px-3 py-2.5" style={{ borderColor: tc.border }}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${tc.title}`}>
                      {value === 'dorm' ? `Dorm · ${room.capacity} cap` : `${value}-Sharing`} · Room {ri + 1}
                    </p>
                    <div className="space-y-1.5">
                      {room.people.map((person, pi) => (
                        <div key={pi} className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${person.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {person.gender}
                          </span>
                          <span className="text-xs text-slate-700 font-medium leading-tight">{person.name || <span className="text-slate-300 italic">—</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Unassigned pax row ── */}
      {(totalM > 0 || totalF > 0) && (dsCount > 0 || srRooms.length > 0) && (
        <div className="flex items-center gap-1.5 mx-3 mb-3 px-3 py-1.5 rounded-lg bg-slate-50/70 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unassigned</span>
          <span className="bg-blue-50 text-blue-600 font-bold text-[10px] px-1.5 py-0.5 rounded-full">{unassignedM}M</span>
          <span className="bg-pink-50 text-pink-600 font-bold text-[10px] px-1.5 py-0.5 rounded-full">{unassignedF}F</span>
        </div>
      )}
    </div>
  );
}

// ── DateGroup ─────────────────────────────────────────────────────────────────
function DateGroup({ dayData, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  const total = dayData.batches.reduce((s, b) => s + (b.pax || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-3">
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="font-bold text-xl sm:text-2xl text-[#1e3a5f] w-7 sm:w-8 text-center" style={{ fontFamily: 'Outfit,sans-serif' }}>{dayData.day}</div>
          <div>
            <p className="font-semibold text-sm">{dayData.dayName}</p>
            <p className="text-xs text-slate-500">{dayData.month} {dayData.year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="bg-[#1e3a5f] text-white text-sm font-bold px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1">
            <span className="text-xs font-normal opacity-70">TOTAL</span> {total}
          </span>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 p-2 sm:p-3">
          {dayData.batches.map(b => (
            <BatchCard key={b.id} b={b} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Package → relevant places ─────────────────────────────────────────────────
const PACKAGE_PLACES = {
  K: ['Haridwar', 'Guptakashi', 'Kedarnath', 'Rishikesh'],
  T: ['Haridwar', 'Guptakashi', 'Kedarnath', 'Mandal/Chopta', 'Joshimath-Badrinath', 'Rishikesh'],
  C: ['Haridwar', 'Barkot', 'Uttarakashi', 'Guptakashi', 'Kedarnath', 'Joshimath-Badrinath', 'Rishikesh'],
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── BatchManager — replaces TableView ────────────────────────────────────────
function BatchManager({ stays, onRefresh, onOpenAddBatch }) {

  const [code, setCode]                   = useState('C');
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [draft, setDraft]                 = useState(null);
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [vehicles, setVehicles]           = useState([]);
  const [stayInfo, setStayInfo]           = useState({});
  const [leadName, setLeadName]           = useState('');
  const [documents, setDocuments]         = useState([]);
  const [uploading, setUploading]         = useState(false);
  const [copiedLead, setCopiedLead]       = useState(false);
  const [showPastBatches, setShowPastBatches] = useState(false);
  const [applyAccomDialog, setApplyAccomDialog] = useState(false);
  const pendingSelect                     = useRef(null);

  const placeCols = PACKAGE_PLACES[code] || PLACES;

  // Load vehicles from Firestore once
  useEffect(() => {
    getDocs(collection(firestore, 'vehicles'))
      .then(snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  // Build sorted batch list for current package code
  const batches = useMemo(() => {
    const filtered = stays.filter(s => s.code === code);
    const serials  = [...new Set(filtered.map(s => s.serial))];
    const tod = new Date(); tod.setHours(0,0,0,0);
    return serials.map(serial => {
      const entries = filtered.filter(s => s.serial === serial);
      const start   = entries.reduce((m, e) => e.date < m ? e.date : m, entries[0]?.date || '9999');
      const first   = entries[0] || {};
      const isPast  = new Date(start + 'T00:00:00') < tod;
      return {
        serial, startDate: start, entries, isPast,
        pax: first.pax || 0, male: first.male || 0, female: first.female || 0,
        dsCount: (first.doubleSharingPairs || []).length || first.doubleSharing || 0,
      };
    })
    .sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      return a.isPast
        ? new Date(b.startDate) - new Date(a.startDate)
        : new Date(a.startDate) - new Date(b.startDate);
    })
    .map((b, i) => ({ ...b, seq: i + 1 }));
  }, [stays, code]);

  const upcomingBatches = useMemo(() => batches.filter(b => !b.isPast), [batches]);
  const pastBatches     = useMemo(() => batches.filter(b => b.isPast),  [batches]);

  // After refresh triggered by save, re-select the same serial
  useEffect(() => {
    if (pendingSelect.current !== null) {
      const b = batches.find(x => x.serial === pendingSelect.current);
      if (b) { buildDraft(b); pendingSelect.current = null; }
    } else if (selectedSerial === null && batches.length > 0) {
      buildDraft(batches[0]);
    } else if (batches.length === 0) {
      setSelectedSerial(null); setDraft(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  function buildDraft(batch) {
    setSelectedSerial(batch.serial);
    const first = batch.entries[0] || {};
    const placesMap = {};
    for (const place of placeCols) {
      const ents = batch.entries
        .filter(e => e.place === place)
        .sort((a, b) => a.date.localeCompare(b.date));
      placesMap[place] = ents.map(e => ({ id: e.id, date: e.date, status: e.status, _orig: e }));
    }
    setDraft({
      serial: batch.serial,
      pax: String(first.pax || ''),
      male: String(first.male || ''),
      female: String(first.female || ''),
      doubleSharingPairs: first.doubleSharingPairs || [],
      sharingRooms: first.sharingRooms || [],
      places: placesMap,
    });
    // Load stay info, lead name, and documents
    getDoc(doc(firestore, 'batch_lead_info', `${code}-${batch.serial}`))
      .then(snap => {
        const d = snap.exists() ? snap.data() : {};
        setStayInfo(d.accommodations || {});
        setLeadName(d.leadName || '');
        setDocuments(d.documents || []);
      })
      .catch(() => { setStayInfo({}); setLeadName(''); setDocuments([]); });
  }

  function setStayInfoField(place, field, val) {
    setStayInfo(si => ({ ...si, [place]: { ...(si[place] || {}), [field]: val } }));
  }

  function setDraftField(key, val) { setDraft(d => ({ ...d, [key]: val })); }

  function setPlaceEntry(place, idx, field, val) {
    setDraft(d => ({
      ...d,
      places: { ...d.places, [place]: d.places[place].map((e, i) => i === idx ? { ...e, [field]: val } : e) },
    }));
  }

  function addPlaceNight(place) {
    const defaultStatus = ['Barkot','Uttarakashi','Guptakashi'].includes(place) ? 'CHECK-IN' : '1N';
    setDraft(d => ({
      ...d,
      places: { ...d.places, [place]: [...(d.places[place] || []), { id: null, date: '', status: defaultStatus, _orig: null }] },
    }));
  }

  function removePlaceNight(place, idx) {
    setDraft(d => ({
      ...d,
      places: { ...d.places, [place]: d.places[place].filter((_, i) => i !== idx) },
    }));
  }

  async function saveBatch() {
    if (!draft) return;
    setSaving(true);
    try {
      const pax     = Number(draft.pax)    || 0;
      const male    = Number(draft.male)   || 0;
      const female  = Number(draft.female) || 0;
      const pairs   = draft.doubleSharingPairs || [];
      const shared  = { pax, male, female, doubleSharingPairs: pairs, doubleSharing: pairs.length, sharingRooms: draft.sharingRooms || [] };
      const batch   = batches.find(b => b.serial === draft.serial);
      const ops     = [];

      for (const place of placeCols) {
        const draftEntries = draft.places[place] || [];
        const origEntries  = (batch?.entries || []).filter(e => e.place === place);
        const keepIds      = new Set(draftEntries.filter(e => e.id).map(e => e.id));

        for (const entry of draftEntries) {
          if (!entry.date) continue;
          if (entry.id) {
            ops.push(api.patch(`/hotel-stays/${entry.id}`, { ...entry._orig, ...shared, date: entry.date, status: entry.status }));
          } else {
            ops.push(api.post('/hotel-stays', { place, date: entry.date, serial: draft.serial, code, packageName: PKG[code] || code, status: entry.status, ...shared, clientNames: [] }));
          }
        }
        for (const orig of origEntries) {
          if (!keepIds.has(orig.id)) ops.push(api.delete(`/hotel-stays/${orig.id}`));
        }
      }
      await Promise.all(ops);
      await setDoc(doc(firestore, 'batch_lead_info', `${code}-${draft.serial}`), {
        accommodations: stayInfo,
        leadName: leadName || '',
        documents,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // If accommodation info is filled, offer to apply to upcoming batches
      const hasAccom = Object.values(stayInfo).some(v => v.hotelName || v.locationLink || v.phone);
      if (hasAccom) { setApplyAccomDialog(true); setSaving(false); return; }
      toast.success('Batch saved');
      pendingSelect.current = draft.serial;
      onRefresh();
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  }

  async function applyAccomToUpcoming() {
    const tod = new Date(); tod.setHours(0,0,0,0);
    const upcoming = batches.filter(b => !b.isPast && b.serial !== draft.serial);
    await Promise.all(upcoming.map(b =>
      setDoc(doc(firestore, 'batch_lead_info', `${code}-${b.serial}`), { accommodations: stayInfo }, { merge: true })
    ));
    setApplyAccomDialog(false);
    toast.success(`Accommodation info applied to ${upcoming.length} upcoming batch${upcoming.length !== 1 ? 'es' : ''}`);
    pendingSelect.current = draft.serial;
    onRefresh();
  }

  async function deleteBatch() {
    if (!draft) return;
    setDeleting(true);
    try {
      const batch = batches.find(b => b.serial === draft.serial);
      if (batch) await Promise.all(batch.entries.map(e => api.delete(`/hotel-stays/${e.id}`)));
      toast.success('Batch deleted');
      setDeleteConfirm(false); setSelectedSerial(null); setDraft(null);
      onRefresh();
    } catch { toast.error('Delete failed'); } finally { setDeleting(false); }
  }

  // Match vehicles: exact batchCode (e.g. "C-2") first, fallback to ±3 day proximity
  const matchedVehicles = useMemo(() => {
    if (!draft) return [];
    const batch = batches.find(b => b.serial === draft.serial);
    if (!batch?.startDate) return [];
    const exactLabel = `${code}-${draft.serial}`;
    const exact = vehicles.filter(v => v.batchCode === exactLabel);
    if (exact.length > 0) return exact;
    const bStart = new Date(batch.startDate);
    return vehicles.filter(v => {
      if ((v.packageCode || v.code) !== code) return false;
      if (!v.startDate) return false;
      return Math.abs(new Date(v.startDate) - bStart) / 86400000 <= 3;
    });
  }, [draft, vehicles, batches, code]);

  const selectedBatch = batches.find(b => b.serial === selectedSerial);
  const batchCounts   = useMemo(() => ({
    K: [...new Set(stays.filter(s => s.code==='K').map(s => s.serial))].length,
    T: [...new Set(stays.filter(s => s.code==='T').map(s => s.serial))].length,
    C: [...new Set(stays.filter(s => s.code==='C').map(s => s.serial))].length,
  }), [stays]);

  const PKG_LABEL = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row" style={{ minHeight: 620 }}>

      {/* ══════════ LEFT: Batch List ══════════ */}
      <div className={`md:w-64 md:shrink-0 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col ${selectedSerial !== null ? 'hidden md:flex' : 'flex'}`}>
        {/* Package tabs */}
        <div className="flex border-b border-slate-200">
          {['K','T','C'].map(c => (
            <button key={c} onClick={() => { setCode(c); setSelectedSerial(null); setDraft(null); }}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${code===c ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              {c === 'K' ? 'Kedarnath' : c === 'T' ? 'KBT' : 'Chardham'}
            </button>
          ))}
        </div>

        {/* Upcoming / Past tabs + New button */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/50 px-2 pt-2 gap-1">
          <button onClick={() => setShowPastBatches(false)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${!showPastBatches ? 'bg-white border border-b-white border-slate-200 text-indigo-600 -mb-px' : 'text-slate-400 hover:text-slate-600'}`}>
            Upcoming ({upcomingBatches.length})
          </button>
          <button onClick={() => setShowPastBatches(true)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${showPastBatches ? 'bg-white border border-b-white border-slate-200 text-slate-700 -mb-px' : 'text-slate-400 hover:text-slate-600'}`}>
            Past ({pastBatches.length})
          </button>
          <button onClick={onOpenAddBatch}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors ml-1 mb-1">
            <Plus size={11} /> New
          </button>
        </div>

        {/* Batch rows */}
        <div className="flex-1 overflow-y-auto">
          {(showPastBatches ? pastBatches : upcomingBatches).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Hotel size={28} className="opacity-30" />
              <p className="text-xs">{showPastBatches ? 'No past batches' : 'No upcoming batches'}</p>
              {!showPastBatches && <button onClick={onOpenAddBatch} className="text-xs text-indigo-600 font-medium hover:underline">+ Add first batch</button>}
            </div>
          ) : (showPastBatches ? pastBatches : upcomingBatches).map(b => (
            <button key={b.serial} onClick={() => buildDraft(b)}
              className={`w-full text-left px-3 py-3 border-b border-slate-100 transition-all group ${
                selectedSerial === b.serial
                  ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500'
                  : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
              }`}>
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${selectedSerial === b.serial ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {b.seq}
                    </span>
                    <span className={`text-xs font-bold truncate ${selectedSerial === b.serial ? 'text-indigo-700' : 'text-slate-800'}`}>
                      Batch {b.serial}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-6">{fmt(b.startDate)}</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full shrink-0">{b.pax}</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5 ml-6 flex-wrap">
                {b.male > 0  && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{b.male}M</span>}
                {b.female > 0 && <span className="text-[9px] font-bold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full">{b.female}F</span>}
                {b.dsCount > 0 && <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">🛏 {b.dsCount}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ RIGHT: Detail Panel ══════════ */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedSerial === null ? 'hidden md:flex' : 'flex'}`}>
        {!draft ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center px-4">
              <Hotel size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a batch to edit</p>
              <p className="text-xs mt-1 opacity-70">{PKG_LABEL[code]} — {batches.length} batches</p>
            </div>
          </div>
        ) : (
          <>
            {/* Sticky panel header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {/* Back button (mobile) */}
                <button onClick={() => setSelectedSerial(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    #{selectedBatch?.seq} · Batch {draft.serial}
                  </p>
                  <p className="text-[11px] text-slate-400">{PKG_LABEL[code]} · from {fmt(selectedBatch?.startDate)}</p>
                  {leadName && <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">👤 {leadName}</p>}
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/lead-view?batch=${encodeURIComponent(draft.serial)}&code=${encodeURIComponent(code)}`;
                    navigator.clipboard.writeText(url).then(() => {
                      setCopiedLead(true);
                      setTimeout(() => setCopiedLead(false), 2000);
                    });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${copiedLead ? 'bg-green-50 border-green-300 text-green-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {copiedLead ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Lead Link</>}
                </button>
                <button onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
                <button onClick={saveBatch} disabled={saving}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${saving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}>
                  <Check size={13} /> {saving ? 'Saving…' : 'Save Batch'}
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

              {/* ── Section: Batch Info ── */}
              <section>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Batch Info</h3>
                <div className="mb-3">
                  <Label className="text-xs text-slate-600">Trip Lead Name</Label>
                  <Input
                    value={leadName}
                    onChange={e => setLeadName(e.target.value)}
                    placeholder="e.g. Ravi Kumar"
                    className="mt-1 h-9 text-sm font-semibold text-indigo-700"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-slate-600">Total Pax</Label>
                    <Input type="number" min="1" value={draft.pax}
                      onChange={e => setDraftField('pax', e.target.value)}
                      className="mt-1 h-9 text-sm font-bold text-indigo-700" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Male</Label>
                    <Input type="number" min="0" value={draft.male}
                      onChange={e => setDraftField('male', e.target.value)}
                      className="mt-1 h-9 text-sm font-semibold text-blue-700" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Female</Label>
                    <Input type="number" min="0" value={draft.female}
                      onChange={e => setDraftField('female', e.target.value)}
                      className="mt-1 h-9 text-sm font-semibold text-pink-600" />
                  </div>
                </div>
                {/* Live summary */}
                {(Number(draft.pax) > 0 || draft.doubleSharingPairs.length > 0 || (draft.sharingRooms||[]).length > 0) && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium">Summary:</span>
                    {Number(draft.pax) > 0 && <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">{draft.pax} pax</span>}
                    {Number(draft.male) > 0 && <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{draft.male}M</span>}
                    {Number(draft.female) > 0 && <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full">{draft.female}F</span>}
                    {draft.doubleSharingPairs.length > 0 && (
                      <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">🛏 {draft.doubleSharingPairs.length} double</span>
                    )}
                    {(draft.sharingRooms||[]).filter(r=>r.type==='3').length > 0 && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">🏠 {(draft.sharingRooms).filter(r=>r.type==='3').length} triple</span>
                    )}
                    {(draft.sharingRooms||[]).filter(r=>r.type==='4').length > 0 && (
                      <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">🏠 {(draft.sharingRooms).filter(r=>r.type==='4').length} quad</span>
                    )}
                    {(draft.sharingRooms||[]).filter(r=>r.type==='dorm').length > 0 && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">🏠 {(draft.sharingRooms).filter(r=>r.type==='dorm').length} dorm</span>
                    )}
                    {(() => {
                      const dsM = draft.doubleSharingPairs.reduce((n,p)=>n+(p.gender1==='M'?1:0)+(p.gender2==='M'?1:0),0);
                      const dsF = draft.doubleSharingPairs.reduce((n,p)=>n+(p.gender1==='F'?1:0)+(p.gender2==='F'?1:0),0);
                      const srM = (draft.sharingRooms||[]).reduce((n,r)=>n+r.people.filter(p=>p.gender==='M').length,0);
                      const srF = (draft.sharingRooms||[]).reduce((n,r)=>n+r.people.filter(p=>p.gender==='F').length,0);
                      const remM = Math.max(0,(Number(draft.male)||0)-dsM-srM);
                      const remF = Math.max(0,(Number(draft.female)||0)-dsF-srF);
                      return (remM > 0 || remF > 0) ? (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[10px] text-slate-500">unassigned: <b className="text-blue-600">{remM}M</b> <b className="text-pink-600">{remF}F</b></span>
                        </>
                      ) : null;
                    })()}
                  </div>
                )}
              </section>

              {/* ── Section: Stay Dates ── */}
              <section>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Stay Dates per Place</h3>
                <div className="space-y-2">
                  {placeCols.map(place => {
                    const entries = draft.places[place] || [];
                    const hasEntries = entries.length > 0;
                    return (
                      <div key={place} className={`rounded-xl border transition-colors ${hasEntries ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {hasEntries
                              ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />}
                            <span className={`text-sm font-semibold ${hasEntries ? 'text-indigo-700' : 'text-slate-400'}`}>{place}</span>
                            {hasEntries && <span className="text-[10px] text-indigo-400 font-medium">{entries.length} night{entries.length > 1 ? 's' : ''}</span>}
                          </div>
                          <button type="button" onClick={() => addPlaceNight(place)}
                            className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg hover:bg-indigo-50 transition-colors">
                            <Plus size={10} /> Add
                          </button>
                        </div>
                        {hasEntries && (
                          <div className="px-3 pb-3 space-y-1.5">
                            {entries.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-indigo-100 px-2.5 py-2">
                                <span className="text-[9px] font-bold text-indigo-300 uppercase w-10 shrink-0">N{idx + 1}</span>
                                <input type="date" value={entry.date}
                                  onChange={e => setPlaceEntry(place, idx, 'date', e.target.value)}
                                  className="h-8 text-xs border border-slate-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-0 bg-white" />
                                <select value={entry.status}
                                  onChange={e => setPlaceEntry(place, idx, 'status', e.target.value)}
                                  className="h-8 border border-slate-200 rounded-lg px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28 shrink-0">
                                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button type="button" onClick={() => removePlaceNight(place, idx)}
                                  className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-0.5">
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Section: Hotel Info per Place ── */}
              {(() => {
                const activePlaces = placeCols.filter(p => (draft.places[p] || []).length > 0);
                if (activePlaces.length === 0) return null;
                return (
                  <section>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Hotel size={11} /> Accommodation Info
                    </h3>
                    <p className="text-[10px] text-slate-400 mb-3">Shown to trip leader in the lead link. Fill hotel name, map link and contact per stop.</p>
                    <div className="space-y-3">
                      {activePlaces.map(place => {
                        const info = stayInfo[place] || {};
                        return (
                          <div key={place} className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3">
                            <p className="text-xs font-bold text-slate-700 mb-2.5">📍 {place}</p>
                            <div className="space-y-2">
                              <input
                                value={info.hotelName || ''}
                                onChange={e => setStayInfoField(place, 'hotelName', e.target.value)}
                                placeholder="Hotel / stay name"
                                className="w-full h-8 border border-slate-200 rounded-lg px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                              <input
                                value={info.locationLink || ''}
                                onChange={e => setStayInfoField(place, 'locationLink', e.target.value)}
                                placeholder="Google Maps / location link"
                                className="w-full h-8 border border-slate-200 rounded-lg px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                              <input
                                value={info.phone || ''}
                                onChange={e => setStayInfoField(place, 'phone', e.target.value)}
                                placeholder="Contact number"
                                className="w-full h-8 border border-slate-200 rounded-lg px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

              {/* ── Section: Double Sharing ── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Double Sharing Rooms</h3>
                  {draft.doubleSharingPairs.length > 0 && (
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{draft.doubleSharingPairs.length} rooms</span>
                  )}
                </div>
                <DSPairsEditor
                  pairs={draft.doubleSharingPairs}
                  onChange={val => setDraftField('doubleSharingPairs', val)}
                />
              </section>

              {/* ── Section: Other Room Types ── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Other Room Types</h3>
                  {(draft.sharingRooms || []).length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{draft.sharingRooms.length} rooms</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mb-2">3-sharing, 4-sharing, or dorm rooms with names &amp; gender</p>
                <RoomGroupsEditor
                  rooms={draft.sharingRooms || []}
                  onChange={val => setDraftField('sharingRooms', val)}
                />
              </section>

              {/* ── Section: Documents ── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Batch Documents</h3>
                  {documents.length > 0 && (
                    <span className="text-[10px] font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">{documents.length} file{documents.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mb-2">Permits, letters, or any batch documents. Visible to trip leader.</p>

                {/* Upload button */}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-medium cursor-pointer transition-colors ${uploading ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-sky-300 text-sky-600 hover:bg-sky-50'}`}>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    disabled={uploading}
                    onChange={async e => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setUploading(true);
                      try {
                        const newDocs = await Promise.all(files.map(async file => {
                          const path = `batch-documents/${String(draft.serial)}/${Date.now()}_${file.name}`;
                          const r = storageRef(storage, path);
                          await uploadBytes(r, file);
                          const url = await getDownloadURL(r);
                          return { name: file.name, url, path, uploadedAt: new Date().toISOString() };
                        }));
                        setDocuments(prev => [...prev, ...newDocs]);
                      } catch { toast.error('Upload failed'); } finally { setUploading(false); }
                    }}
                  />
                  {uploading ? 'Uploading…' : '+ Upload Document'}
                </label>

                {/* Document list */}
                {documents.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {documents.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-base shrink-0">
                          {d.name?.match(/\.(pdf)$/i) ? '📄' : d.name?.match(/\.(jpg|jpeg|png)$/i) ? '🖼' : '📎'}
                        </span>
                        <span className="text-xs font-medium text-slate-700 flex-1 truncate">{d.name}</span>
                        <a href={d.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-sky-600 hover:underline font-semibold shrink-0">View</a>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (d.path) await deleteObject(storageRef(storage, d.path));
                            } catch {}
                            setDocuments(prev => prev.filter((_, j) => j !== i));
                          }}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-0.5">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section: Vehicles ── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Truck size={11} /> Vehicle Assignment
                  </h3>
                  <a href="/vehicle-allocation" className="text-[10px] text-indigo-500 hover:underline font-medium">Manage →</a>
                </div>
                {matchedVehicles.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
                    <Truck size={14} className="opacity-40 shrink-0" />
                    <span>No vehicle batch matched for this date range. <a href="/vehicle-allocation" className="text-indigo-500 hover:underline">Assign in Vehicle Allocation.</a></span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matchedVehicles.map(v => {
                      const EMOJI = { 'Dzire':'🚗', 'Ertiga':'🚙', '12-Seater TT':'🚐', '16-Seater TT':'🚌', '22-Seater TT':'🚍' };
                      return (
                        <div key={v.id} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-800">{v.batchCode}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{fmt(v.startDate)} → {fmt(v.endDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(v.vehicles || []).map((vt, i) => (
                              <span key={i} className="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-lg font-semibold text-slate-700 flex items-center gap-1">
                                <span>{EMOJI[vt.type] || '🚐'}</span> {vt.count} × {vt.type}
                              </span>
                            ))}
                            {v.pax > 0 && <span className="text-[10px] text-slate-400 font-medium">{v.pax} pax</span>}
                          </div>
                          {v.notes && (
                            <p className="text-[11px] text-amber-700 mt-2 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">📝 {v.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Bottom save button (visible on mobile scroll) */}
              <div className="pt-2 pb-4">
                <button onClick={saveBatch} disabled={saving}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${saving ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}>
                  {saving ? 'Saving…' : '💾 Save Batch'}
                </button>
              </div>

            </div>
          </>
        )}
      </div>

      {/* Delete confirm dialog */}
      {applyAccomDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Apply accommodation info?</h2>
            <p className="text-sm text-slate-500 mb-4">
              Do you want to apply this accommodation info to all other upcoming {PKG[code] || code} batches too?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={applyAccomToUpcoming} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Apply to all upcoming batches
              </Button>
              <Button variant="outline" onClick={() => { setApplyAccomDialog(false); toast.success('Batch saved'); pendingSelect.current = draft?.serial; onRefresh(); }} className="w-full">
                Only this batch
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Delete entire batch?</h2>
            <p className="text-sm text-slate-500 mb-4">
              This removes all {selectedBatch?.entries?.length || 0} stay entries for Batch {draft?.serial}. Cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={deleteBatch} disabled={deleting} className="flex-1">
                {deleting ? 'Deleting…' : 'Yes, Delete All'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HotelStays() {
  const { userProfile } = useAuth();
  const [stays, setStays]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activePlace, setActive]  = useState(PLACES[0]);
  const [showForm, setShowForm]           = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editEntry, setEditEntry]         = useState(null);
  const [copied, setCopied]               = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [view, setView]                   = useState('cards');
  const [saving, setSaving]               = useState(false);
  const [showPast, setShowPast]           = useState(false);

  function load() {
    api.get('/hotel-stays')
      .then(r => setStays(r.data))
      .catch(() => toast.error('Failed to load stays'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const placeStays = useMemo(() => stays.filter(s => s.place === activePlace), [stays, activePlace]);
  const allGrouped  = useMemo(() => groupByDate(placeStays), [placeStays]);
  const today       = new Date(); today.setHours(0,0,0,0);
  const grouped     = useMemo(() => allGrouped.filter(d => new Date(d.date + 'T00:00:00') >= today), [allGrouped]);
  const pastGrouped = useMemo(() => allGrouped.filter(d => new Date(d.date + 'T00:00:00') < today).reverse(), [allGrouped]);
  const totalPax   = placeStays.reduce((s, b) => s + (b.pax || 0), 0);
  const totalDS    = placeStays.reduce((s, b) => s + ((b.doubleSharingPairs || []).length || b.doubleSharing || 0), 0);

  async function handleSave(data) {
    setSaving(true);
    try {
      if (editEntry) {
        await api.patch(`/hotel-stays/${editEntry.id}`, data);
        toast.success('Entry updated');
      } else {
        await api.post('/hotel-stays', data);
        toast.success('Entry added');
      }
      setShowForm(false); setEditEntry(null); load();
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  }

  async function handleSaveBatch(entries) {
    setSaving(true);
    try {
      await Promise.all(entries.map(e => api.post('/hotel-stays', e)));
      toast.success(`Batch saved — ${entries.length} entries added`);
      setShowBatchForm(false); load();
    } catch { toast.error('Failed to save batch'); } finally { setSaving(false); }
  }

  async function handleDelete(entry) {
    try {
      await api.delete(`/hotel-stays/${entry.id}`);
      toast.success('Entry deleted'); setDeleteConfirm(null); load();
    } catch { toast.error('Failed to delete'); }
  }

  function openEdit(entry) { setEditEntry(entry); setShowForm(true); }

  async function copyVendorLink(place) {
    try {
      setCopied(place + '_loading');
      const res = await api.get('/hotel-stays');
      const snapRef = await addDoc(collection(firestore, 'stay_snapshots'), {
        label: `Hotel Schedule — ${place} — ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`,
        place, createdAt: serverTimestamp(),
        createdBy: userProfile?.displayName || 'Admin',
        stays: res.data,
      });
      const url = `${window.location.origin}/stay-view?place=${slugify(place)}&snap=${snapRef.id}`;
      await navigator.clipboard.writeText(url);
      toast.success(`📸 Snapshot link copied for ${place}!`);
      setCopied(place); setTimeout(() => setCopied(null), 2500);
    } catch { toast.error('Failed to create snapshot'); setCopied(null); }
  }

  function openVendorView(place) { window.open(`/stay-view?place=${slugify(place)}`, '_blank'); }

  // Build initForEdit — handles both new and legacy (clientNames) data
  const initForEdit = useMemo(() => {
    if (!editEntry) return null;
    const rawPairs = editEntry.doubleSharingPairs ||
      (editEntry.clientNames?.length
        ? Array.from({ length: Math.ceil(editEntry.clientNames.length / 2) }, (_, i) => ({
            name1: editEntry.clientNames[i * 2] || '', gender1: 'M',
            name2: editEntry.clientNames[i * 2 + 1] || '', gender2: 'F',
          }))
        : []);
    return {
      place: editEntry.place, date: editEntry.date,
      serial: String(editEntry.serial),
      codePreset: ['K', 'T', 'C'].includes(editEntry.code) ? editEntry.code : 'custom',
      codeCustom: ['K', 'T', 'C'].includes(editEntry.code) ? '' : editEntry.code,
      packageName: editEntry.packageName || '',
      pax: String(editEntry.pax), status: editEntry.status,
      doubleSharingPairs: rawPairs,
      sharingRooms: editEntry.sharingRooms || [],
      male: editEntry.male ? String(editEntry.male) : '',
      female: editEntry.female ? String(editEntry.female) : '',
    };
  }, [editEntry]);

  return (
    <div className="max-w-5xl mx-auto space-y-4 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 heading-font flex items-center gap-2">
            <Hotel size={22} className="text-indigo-600" /> Hotel Stay Planner
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage stay schedules and share with vendors</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setView('cards')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view==='cards' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <LayoutGrid size={15} /> <span className="hidden sm:inline">Cards</span>
            </button>
            <button onClick={() => setView('batch')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view==='batch' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <Layers size={15} /> <span className="hidden sm:inline">Batches</span>
            </button>
          </div>
          <Button onClick={() => setShowBatchForm(true)} variant="outline" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-sm">
            <Plus size={15} /> <span className="hidden sm:inline">Add New Batch</span><span className="sm:hidden">Batch</span>
          </Button>
          <Button onClick={() => { setEditEntry(null); setShowForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2 text-sm">
            <Plus size={15} /> <span className="hidden sm:inline">Add Stay Entry</span><span className="sm:hidden">Entry</span>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Calendar size={15} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-indigo-600">{grouped.length}</p>
              <p className="text-xs text-slate-500">Active Days</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Users size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-emerald-600">{totalPax}</p>
              <p className="text-xs text-slate-500">Total Pax</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <BedDouble size={15} className="text-purple-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-purple-600">{totalDS}</p>
              <p className="text-xs text-slate-500">Double Rooms</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Hotel size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-amber-600">{placeStays.length}</p>
              <p className="text-xs text-slate-500">Entries</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch manager view */}
      {view === 'batch' && (
        <BatchErrorBoundary>
          <BatchManager stays={stays} onRefresh={load} onOpenAddBatch={() => setShowBatchForm(true)} />
        </BatchErrorBoundary>
      )}

      {/* Place tabs + share buttons (card view) */}
      {view === 'cards' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto border-b border-slate-200">
            <div className="flex">
              {PLACES.map(p => (
                <button key={p} onClick={() => setActive(p)}
                  className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activePlace === p
                      ? 'text-indigo-700 border-indigo-600 bg-indigo-50'
                      : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Share row */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs flex-wrap">
            <span className="text-slate-500 font-medium">Vendor link for {activePlace}:</span>
            <button onClick={() => copyVendorLink(activePlace)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                copied === activePlace ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : copied === activePlace + '_loading' ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {copied === activePlace ? <Check size={11} /> : <Copy size={11} />}
              {copied === activePlace ? 'Copied!' : copied === activePlace + '_loading' ? 'Creating…' : 'Copy link'}
            </button>
            <button onClick={() => openVendorView(activePlace)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 bg-white">
              <ExternalLink size={11} /> Preview
            </button>
            {pastGrouped.length > 0 && (
              <button onClick={() => setShowPast(p => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ml-auto ${showPast ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {showPast ? '▲ Hide past' : `▼ Past dates (${pastGrouped.length})`}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : grouped.length === 0 && pastGrouped.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Hotel size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No entries for {activePlace} yet.</p>
                <button onClick={() => { setEditEntry(null); setShowForm(true); }}
                  className="mt-3 text-indigo-600 text-sm font-medium hover:underline">+ Add first entry</button>
              </div>
            ) : (
              <>
                {grouped.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">No upcoming dates for {activePlace}.</div>
                )}
                {grouped.map(d => <DateGroup key={d.date} dayData={d} onEdit={openEdit} onDelete={setDeleteConfirm} />)}
                {showPast && pastGrouped.map(d => <DateGroup key={d.date} dayData={d} onEdit={openEdit} onDelete={setDeleteConfirm} />)}
              </>
            )}
          </div>
        </div>
      )}

      {/* Add New Batch modal */}
      {showBatchForm && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add New Batch</h2>
                <p className="text-xs text-slate-500 mt-0.5">Fill all places for this batch in one go</p>
              </div>
              <button onClick={() => setShowBatchForm(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AddBatchModal stays={stays} onSave={handleSaveBatch} onCancel={() => setShowBatchForm(false)} loading={saving} />
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md flex flex-col" style={{ maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">{editEntry ? 'Edit Stay Entry' : 'Add Stay Entry'}</h2>
              <button onClick={() => { setShowForm(false); setEditEntry(null); }} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <EntryForm initial={initForEdit} onSave={handleSave} onCancel={() => { setShowForm(false); setEditEntry(null); }} loading={saving} />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {!!deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete Entry?</h2>
            <p className="text-sm text-slate-600">Remove Batch {deleteConfirm?.serial} ({deleteConfirm?.status}) on {deleteConfirm?.date}?</p>
            <div className="flex gap-2 mt-4">
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)} className="flex-1">Delete</Button>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
