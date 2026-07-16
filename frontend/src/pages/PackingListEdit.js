// PackingListEdit.js — Admin: create / edit a packing list category
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection, doc, getDoc, addDoc, updateDoc, getDocs,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowLeft, Save, Plus, Trash2, Edit2, ChevronUp, ChevronDown,
  Copy, ExternalLink, X, Check, ChevronDown as Caret,
  ChevronRight, Sparkles, Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ── helpers ───────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9); }

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(base, excludeId = null) {
  const q = query(collection(firestore, 'packing_lists'), where('slug', '==', base));
  const snap = await getDocs(q);
  const conflict = snap.docs.find(d => d.id !== excludeId);
  if (!conflict) return base;
  return `${base}-${Math.random().toString(36).slice(2, 5)}`;
}

// ── emoji sets ─────────────────────────────────────────────────────────────────
const ITEM_EMOJIS = [
  '🎒','🧗','🏔️','⛺','🌄','🌊','🌧️','❄️','🔥','🌞',
  '🥾','🧤','🧥','👖','🧢','🕶️','🧦','🧣','👕','🩴',
  '💧','🍱','🥄','🔦','🔋','🗺️','🧭','📍','☂️','🍵',
  '💊','🩹','🌡️','💉','🩺','🧃','🩸','🦵','💪','🧬',
  '📋','📝','🪪','📄','🖊️','📦','🛍️','🧴','🧻','🦷',
  '🌞','🧲','⚙️','🔧','🎿','🎯','🧊','💦','🥗','🫙',
];

// ── monsoon template ──────────────────────────────────────────────────────────
const MONSOON_TEMPLATE = [
  { id: genId(), name: 'Trek Gear & Accessories', icon: '🎒', collapsed: false, items: [
    { id: genId(), name: 'Trekking Poles', emoji: '🎿', quantity: '2 nos', optional: true, rentable: true, recommendations: [] },
    { id: genId(), name: 'Headlamp', emoji: '🔦', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Thermos', emoji: '🍵', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Water Bottle', emoji: '💧', quantity: '1 L', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Backpack', emoji: '🎒', quantity: '55+10 L', optional: false, rentable: true, recommendations: [] },
    { id: genId(), name: 'Sunglasses', emoji: '🕶️', quantity: '1 pair', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Sun Cap', emoji: '🧢', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Power Bank', emoji: '🔋', quantity: '10000 mAh', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Day Pack', emoji: '🎒', quantity: '1 nos', optional: true, rentable: true, recommendations: [] },
    { id: genId(), name: 'Rain Cover for Backpack', emoji: '☂️', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Lunch Box', emoji: '🍱', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Spoon and Mug', emoji: '🥄', quantity: '1 set', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Trekking Shoes (high ankle)', emoji: '🥾', quantity: '1 pair', optional: false, rentable: false, recommendations: [] },
  ]},
  { id: genId(), name: 'Clothes & Layers', icon: '🧥', collapsed: false, items: [
    { id: genId(), name: 'Light Sweater', emoji: '👕', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Fleece Jacket', emoji: '🧥', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Full Arm Dry Fit Shirts', emoji: '👕', quantity: '3 pairs', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Padded Jacket', emoji: '🧥', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Dry Fit Trek Pants', emoji: '👖', quantity: '3 pairs', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Woollen Gloves', emoji: '🧤', quantity: '1 pair', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Undergarments', emoji: '👙', quantity: '3 pairs', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Woollen Socks', emoji: '🧦', quantity: '3 pairs', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Woollen Cap', emoji: '🧢', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Poncho / Rain Jacket & Pant', emoji: '🌧️', quantity: '1 set', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Waterproof Gloves', emoji: '🧤', quantity: '1 pair', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Synthetic Socks', emoji: '🧦', quantity: '2 pairs', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Balaclava / Scarf', emoji: '🧣', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Slippers', emoji: '🩴', quantity: '1 pair', optional: false, rentable: false, recommendations: [] },
  ]},
  { id: genId(), name: 'Toiletries', icon: '🧴', collapsed: false, items: [
    { id: genId(), name: 'Toilet Paper', emoji: '🧻', quantity: '2 rolls', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Toothbrush & Toothpaste', emoji: '🦷', quantity: '1 set', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Lip Balm & Sunscreen', emoji: '🌞', quantity: '1 each', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Menstrual Products', emoji: '🩸', quantity: 'as needed', optional: true, rentable: false, recommendations: [] },
    { id: genId(), name: 'Zip Lock Pouch', emoji: '📦', quantity: '2 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Light Hand Towel', emoji: '🧴', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Reusable Plastic Bag', emoji: '🛍️', quantity: '2 nos', optional: false, rentable: false, recommendations: [] },
  ]},
  { id: genId(), name: 'Medicines', icon: '💊', collapsed: false, items: [
    { id: genId(), name: 'Diamox', emoji: '💊', quantity: '1 strip', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Paracetamol', emoji: '💊', quantity: '1 strip', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Avomine', emoji: '💊', quantity: '1 strip', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Digene', emoji: '💊', quantity: '1 strip', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'ORS Packets', emoji: '🧃', quantity: '6 packs', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Muscle Relaxant Spray', emoji: '💉', quantity: '1 nos', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Knee Cap', emoji: '🦵', quantity: '1 pair', optional: true, rentable: false, recommendations: [] },
    { id: genId(), name: 'Personal Medication', emoji: '💊', quantity: 'as prescribed', optional: true, rentable: false, recommendations: [] },
  ]},
  { id: genId(), name: 'Documents', icon: '📋', collapsed: false, items: [
    { id: genId(), name: 'Medical Form (MBBS signed)', emoji: '📋', quantity: '1 copy', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Disclaimer Form', emoji: '📝', quantity: '1 copy', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'ID Proof (original + photocopy)', emoji: '🪪', quantity: '1 set', optional: false, rentable: false, recommendations: [] },
    { id: genId(), name: 'Vaccination Certificate', emoji: '💉', quantity: '1 copy', optional: false, rentable: false, recommendations: [] },
  ]},
];

function defaultSections() {
  return [
    { id: genId(), name: 'Trek Gear & Accessories', icon: '🎒', collapsed: false, items: [] },
    { id: genId(), name: 'Clothes & Layers', icon: '🧥', collapsed: false, items: [] },
    { id: genId(), name: 'Toiletries', icon: '🧴', collapsed: false, items: [] },
    { id: genId(), name: 'Medicines', icon: '💊', collapsed: false, items: [] },
    { id: genId(), name: 'Documents', icon: '📋', collapsed: false, items: [] },
  ];
}

// ── EmojiPicker ───────────────────────────────────────────────────────────────
function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
        title="Click to change icon"
      >
        {value || '➕'}
      </button>
      {open && (
        <div className="absolute z-50 top-14 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64">
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1"
              placeholder="Type emoji…"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && custom) { onChange(custom); setCustom(''); setOpen(false); }}}
            />
            {custom && (
              <button onClick={() => { onChange(custom); setCustom(''); setOpen(false); }}
                className="text-xs bg-blue-600 text-white px-2 rounded-lg">OK</button>
            )}
          </div>
          <div className="grid grid-cols-10 gap-0.5 max-h-40 overflow-y-auto">
            {ITEM_EMOJIS.map(e => (
              <button key={e} type="button"
                onClick={() => { onChange(e); setOpen(false); }}
                className={`text-lg w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 ${value === e ? 'bg-blue-100 ring-1 ring-blue-400' : ''}`}
              >{e}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ItemModal ─────────────────────────────────────────────────────────────────
function ItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    item
      ? { ...item, recommendations: item.recommendations || [] }
      : { id: genId(), name: '', emoji: '🎒', quantity: '', optional: false, rentable: false, recommendations: [] }
  );
  const [newLink, setNewLink] = useState({ name: '', url: '', type: 'buy' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addRec = () => {
    if (!newLink.name.trim() || !newLink.url.trim()) { toast.error('Name and URL required'); return; }
    const url = newLink.url.startsWith('http') ? newLink.url : `https://${newLink.url}`;
    set('recommendations', [...form.recommendations, { id: genId(), ...newLink, url }]);
    setNewLink({ name: '', url: '', type: 'buy' });
  };

  const removeRec = (rid) => set('recommendations', form.recommendations.filter(r => r.id !== rid));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-slate-900">{item ? 'Edit Item' : 'Add Item'}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Icon + Name */}
          <div className="flex items-center gap-4">
            <EmojiPicker value={form.emoji} onChange={v => set('emoji', v)} />
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-medium block mb-1">Item Name *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Trekking Poles"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Quantity / Notes</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 2 nos, 3 pairs, 1 L"
              value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <Toggle label="Optional" color="amber" value={form.optional} onChange={v => set('optional', v)} />
            <Toggle label="Rentable" color="blue" value={form.rentable} onChange={v => set('rentable', v)} />
          </div>

          {/* Recommended Links */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <LinkIcon size={12} className="text-slate-400" />
              Recommended Options
              <span className="text-slate-400 font-normal">(links shown to trekkers)</span>
            </p>

            {/* Existing links */}
            {form.recommendations.map(r => (
              <div key={r.id} className="flex items-center gap-2 mb-1.5 bg-slate-50 rounded-lg px-3 py-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  r.type === 'rent' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {r.type === 'rent' ? '🏪 RENT' : '🛒 BUY'}
                </span>
                <span className="text-xs font-medium text-slate-700 flex-1 truncate">{r.name}</span>
                <a href={r.url} target="_blank" rel="noreferrer"
                  className="text-[10px] text-blue-500 hover:underline shrink-0">link</a>
                <button onClick={() => removeRec(r.id)} className="text-red-400 hover:text-red-600 shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* Add new link */}
            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                <select
                  value={newLink.type}
                  onChange={e => setNewLink(l => ({ ...l, type: e.target.value }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white shrink-0"
                >
                  <option value="buy">🛒 Buy</option>
                  <option value="rent">🏪 Rent</option>
                </select>
                <input
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Name (e.g. Decathlon Carbon Poles)"
                  value={newLink.name}
                  onChange={e => setNewLink(l => ({ ...l, name: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="URL (e.g. https://www.decathlon.in/...)"
                  value={newLink.url}
                  onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addRec(); }}
                />
                <button
                  onClick={addRec}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 shrink-0"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 flex-shrink-0 border-t border-slate-50 pt-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => { if (!form.name.trim()) { toast.error('Item name required'); return; } onSave(form); }}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Check size={14} className="mr-1.5" /> Save Item
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, color, value, onChange }) {
  const colors = { amber: 'bg-amber-400', blue: 'bg-blue-500' };
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? colors[color] : 'bg-slate-200'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PackingListEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState(defaultSections);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [itemModal, setItemModal] = useState(null);
  const [showTemplates, setShowTemplates] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'packing_lists', id));
        if (!snap.exists()) { toast.error('Not found'); navigate('/packing-lists'); return; }
        const d = snap.data();
        setName(d.name || '');
        setEmoji(d.emoji || '📋');
        setDescription(d.description || '');
        setSections((d.sections || []).map(s => ({
          ...s,
          collapsed: false,
          items: (s.items || []).map(i => ({ ...i, recommendations: i.recommendations || [] })),
        })));
      } catch { toast.error('Failed to load'); }
      setLoading(false);
    })();
  }, [id, isNew, navigate]);

  const updateSection = (sid, patch) =>
    setSections(prev => prev.map(s => s.id === sid ? { ...s, ...patch } : s));

  const deleteSection = (sid) => {
    if (!window.confirm('Delete this section and all its items?')) return;
    setSections(prev => prev.filter(s => s.id !== sid));
  };

  const addSection = () =>
    setSections(prev => [...prev, { id: genId(), name: 'New Section', icon: '📌', collapsed: false, items: [] }]);

  const moveSection = (sid, dir) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sid);
      if ((dir === -1 && idx === 0) || (dir === 1 && idx === prev.length - 1)) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return arr;
    });
  };

  const saveItem = (sectionId, item) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const exists = s.items.some(i => i.id === item.id);
      return { ...s, items: exists ? s.items.map(i => i.id === item.id ? item : i) : [...s.items, item] };
    }));
    setItemModal(null);
  };

  const deleteItem = (sectionId, itemId) =>
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s
    ));

  const moveItem = (sectionId, itemId, dir) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const idx = s.items.findIndex(i => i.id === itemId);
      if ((dir === -1 && idx === 0) || (dir === 1 && idx === s.items.length - 1)) return s;
      const arr = [...s.items];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return { ...s, items: arr };
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Category name required'); return; }
    setSaving(true);
    try {
      const base = slugify(name);
      const slug = await uniqueSlug(base, isNew ? null : id);
      const cleanSections = sections.map(({ collapsed, ...s }) => s);
      const payload = {
        name: name.trim(),
        emoji,
        description: description.trim(),
        slug,
        sections: cleanSections,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile?.displayName || userProfile?.email || 'Admin',
      };
      if (isNew) {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'packing_lists'), payload);
        toast.success('Packing list created!');
      } else {
        await updateDoc(doc(firestore, 'packing_lists', id), payload);
        toast.success('Saved!');
      }
      navigate('/packing-lists');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/packing/${slugify(name || 'my-trek')}`);
    toast.success('Link copied!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/packing-lists')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex gap-2">
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={copyLink} className="text-xs">
                <Copy size={13} className="mr-1.5" /> Copy Link
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => window.open(`/packing/${slugify(name)}`, '_blank')}
                className="text-xs"
              >
                <ExternalLink size={13} className="mr-1.5" /> Preview
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-sm">
            <Save size={14} className="mr-2" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Template picker */}
      {isNew && showTemplates && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" /> Quick Start Templates
            </h3>
            <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Start with a pre-built template or begin with empty sections.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => {
                setSections(MONSOON_TEMPLATE.map(s => ({ ...s, id: genId(), items: s.items.map(i => ({ ...i, id: genId() })) })));
                setShowTemplates(false);
                toast.success('Template loaded!');
              }}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              🌧️ Standard Trek Template
            </button>
            <button
              onClick={() => { setSections(defaultSections()); setShowTemplates(false); }}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              📋 Empty (5 sections)
            </button>
            <button
              onClick={() => { setSections([]); setShowTemplates(false); }}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:border-slate-400 hover:bg-slate-50 transition-all text-slate-500"
            >
              ✨ Blank — Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Category Info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-4">
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Category Name *</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Monsoon Treks, Himalayan Treks…"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">Description (optional)</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Packing list for treks during monsoon season"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-500">
          <span className="font-mono truncate flex-1">
            {window.location.host}/packing/{name ? slugify(name) : 'your-category-name'}
          </span>
          <span className="shrink-0 bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Public URL</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}
        </p>
        <button onClick={addSection} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus size={16} /> Add Section
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, sIdx) => (
          <div key={section.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <EmojiPicker value={section.icon} onChange={v => updateSection(section.id, { icon: v })} />
              <input
                className="flex-1 bg-transparent font-semibold text-slate-800 text-sm focus:outline-none"
                value={section.name}
                onChange={e => updateSection(section.id, { name: e.target.value })}
              />
              <span className="text-xs text-slate-400 shrink-0">{section.items.length} items</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveSection(section.id, -1)} disabled={sIdx === 0}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveSection(section.id, 1)} disabled={sIdx === sections.length - 1}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronDown size={14} /></button>
                <button onClick={() => deleteSection(section.id)}
                  className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                <button onClick={() => updateSection(section.id, { collapsed: !section.collapsed })}
                  className="p-1 rounded hover:bg-slate-200">
                  {section.collapsed ? <ChevronRight size={14} /> : <Caret size={14} />}
                </button>
              </div>
            </div>

            {!section.collapsed && (
              <div className="divide-y divide-slate-50">
                {section.items.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-6">No items yet</p>
                )}
                {section.items.map((item, iIdx) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 group">
                    <span className="text-xl w-8 text-center">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800">{item.name}</span>
                      {item.quantity && <span className="ml-2 text-xs text-slate-400">{item.quantity}</span>}
                      <div className="flex gap-1.5 mt-0.5">
                        {item.optional && <span className="text-[10px] bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded-full">Optional</span>}
                        {item.rentable && <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded-full">Rentable</span>}
                        {(item.recommendations || []).length > 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded-full">
                            {item.recommendations.length} link{item.recommendations.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveItem(section.id, item.id, -1)} disabled={iIdx === 0}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronUp size={13} /></button>
                      <button onClick={() => moveItem(section.id, item.id, 1)} disabled={iIdx === section.items.length - 1}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronDown size={13} /></button>
                      <button onClick={() => setItemModal({ sectionId: section.id, item })}
                        className="p-1 rounded hover:bg-blue-50 text-blue-500"><Edit2 size={13} /></button>
                      <button onClick={() => deleteItem(section.id, item.id)}
                        className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3">
                  <button
                    onClick={() => setItemModal({ sectionId: section.id, item: null })}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={15} /> Add Item
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addSection}
        className="w-full mt-5 border-2 border-dashed border-slate-200 rounded-2xl py-4 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Add New Section
      </button>

      {itemModal && (
        <ItemModal
          item={itemModal.item}
          onSave={(item) => saveItem(itemModal.sectionId, item)}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  );
}
