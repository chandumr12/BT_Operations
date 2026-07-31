// TrekProtocolEdit.js — Admin: create / edit a trek protocol document
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import {
  collection, doc, getDoc, addDoc, updateDoc, getDocs,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowLeft, Save, Plus, Trash2, ChevronUp, ChevronDown,
  Copy, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const SHARED = '__shared__'; // Radix Select can't use an empty string value

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(base, excludeId = null) {
  const q = query(collection(firestore, 'trek_protocols'), where('slug', '==', base));
  const snap = await getDocs(q);
  const conflict = snap.docs.find(d => d.id !== excludeId);
  if (!conflict) return base;
  return `${base}-${Math.random().toString(36).slice(2, 5)}`;
}

const itemName = (it) => (typeof it === 'string' ? it : it?.name || '');

// The "Green Trail Trek Protocol" content, same default the mobile app
// pre-fills a brand-new document with. Fully editable afterward.
const DEFAULT_NAME = 'Green Trail Trek Protocol';
const DEFAULT_DESCRIPTION = "Let's Trek Responsibly — Monsoon Edition";
const DEFAULT_SECTIONS = [
  {
    title: '✅ Essentials to Carry (steel or non-disposable only)',
    items: ['Chocolate', 'Chips', 'Energy bars', 'Water — from Bisleri bottles', 'Poncho', 'Mobile rain cover', 'Dettol'],
  },
  {
    title: '🚫 Not Allowed On The Trail',
    items: [
      'Tissues', 'Wet wipes', 'Plastic boxes — disposables', 'Plastic bottles — disposables',
      'Band-aids', 'Cotton', 'Cigarettes and matchboxes', 'Chips and chocolate wrappers',
      'Plastic covers in general', 'Food containers', 'Plastic spoons', 'Plastic cups', 'Aluminium pouches',
    ],
  },
  {
    title: '👕 Recommended Trek Attire',
    items: [
      'Full-sleeve dry-fit T-shirt (quick drying, breathable)', 'Full-length trekking pants (avoid jeans)',
      'Trekking shoes with good grip', 'Cap or hat, sunglasses', 'Lightweight poncho or raincoat',
    ],
  },
  {
    title: '🥾 Golden Trekking Tips',
    items: [
      'Trim your toenails before the trek to reduce discomfort and prevent your toes from hitting the front of your shoes during descents.',
      'Choose the right footwear — trekking shoes about half to one size larger than your regular size, for extra comfort especially while descending.',
      'Leech protection: apply Dettol on your shoes and around your ankles before starting the trek, and reapply after lunch if needed. If a leech attaches, gently pluck or flick it off, or use salt. If bleeding continues after removal, place a small piece of clean paper/tissue over the bite until it clots, or use a bandage.',
      'Descend with proper technique — keep your feet at approximately a 45° angle while descending to improve balance and reduce strain.',
      'Use the zig-zag method on steep slopes instead of walking straight down — this reduces pressure on your knees and gives better control.',
      'Step on firm rocks or stable surfaces whenever possible. Avoid placing your full weight on loose mud, as it can be slippery.',
      'Need more trekking tips? Feel free to ask your trek leads — always happy to help! 😄',
    ],
  },
  {
    title: '🌍 Leave No Trace',
    items: ['Carry a small cloth bag for your own waste and help keep our trails plastic-free.', 'Happy Trekking! Stay safe and enjoy the journey. ⛰️'],
  },
];

function newSection() { return { title: '', items: [] }; }

export default function TrekProtocolEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [name, setName] = useState(isNew ? DEFAULT_NAME : '');
  const [emoji, setEmoji] = useState('🥾');
  const [description, setDescription] = useState(isNew ? DEFAULT_DESCRIPTION : '');
  const [trekId, setTrekId] = useState(SHARED);
  const [treks, setTreks] = useState([]);
  const [sections, setSections] = useState(isNew ? DEFAULT_SECTIONS.map(s => ({ ...s, items: [...s.items] })) : [newSection()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    api.get('/treks').then(r => setTreks(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'trek_protocols', id));
        if (!snap.exists()) { toast.error('Not found'); navigate('/trek-protocol'); return; }
        const d = snap.data();
        setName(d.name || '');
        setEmoji(d.emoji || '🧭');
        setDescription(d.description || '');
        setTrekId(d.trekId || SHARED);
        setSections((d.sections || []).length ? d.sections.map(s => ({ title: s.title || '', items: [...(s.items || [])] })) : [newSection()]);
      } catch { toast.error('Failed to load'); }
      setLoading(false);
    })();
  }, [id, isNew, navigate]);

  const insertStandardContent = () =>
    setSections(prev => [...prev, ...DEFAULT_SECTIONS.map(s => ({ ...s, items: [...s.items] }))]);

  const setSectionTitle = (i, v) => setSections(prev => prev.map((s, idx) => idx === i ? { ...s, title: v } : s));
  const addSection = () => setSections(prev => [...prev, newSection()]);
  const removeSection = (i) => setSections(prev => prev.filter((_, idx) => idx !== i));

  const addItem = (si) => setSections(prev => prev.map((s, idx) => idx === si ? { ...s, items: [...s.items, ''] } : s));
  const setItem = (si, ii, v) => setSections(prev => prev.map((s, idx) =>
    idx === si ? { ...s, items: s.items.map((it, j) => j === ii ? v : it) } : s));
  const removeItem = (si, ii) => setSections(prev => prev.map((s, idx) =>
    idx === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s));

  const moveSection = (i, dir) => {
    setSections(prev => {
      if ((dir === -1 && i === 0) || (dir === 1 && i === prev.length - 1)) return prev;
      const arr = [...prev];
      [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const base = slugify(name);
      const slug = await uniqueSlug(base, isNew ? null : id);
      const cleanSections = sections
        .map(s => ({ title: (s.title || '').trim(), items: (s.items || []).map(it => itemName(it).trim()).filter(Boolean) }))
        .filter(s => s.title || s.items.length);
      const trekPicked = trekId !== SHARED ? trekId : '';
      const payload = {
        name: name.trim(),
        emoji,
        description: description.trim(),
        slug,
        trekId: trekPicked || null,
        trekName: trekPicked ? (treks.find(t => t.id === trekPicked)?.name || '') : null,
        sections: cleanSections,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile?.displayName || userProfile?.email || 'Admin',
      };
      if (isNew) {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'trek_protocols'), payload);
        toast.success('Protocol created!');
      } else {
        await updateDoc(doc(firestore, 'trek_protocols', id), payload);
        toast.success('Saved!');
      }
      navigate('/trek-protocol');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  // Standalone static page (frontend/public/trek-protocol.html) — same page
  // works whether reached from the web app or shared from the mobile app.
  const publicUrl = `${window.location.origin}/trek-protocol.html?id=${id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copied!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalItems = sections.reduce((n, s) => n + s.items.filter(it => itemName(it)).length, 0);

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/trek-protocol')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex gap-2">
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={copyLink} className="text-xs">
                <Copy size={13} className="mr-1.5" /> Copy Link
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, '_blank')} className="text-xs">
                <ExternalLink size={13} className="mr-1.5" /> Preview
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-sm">
            <Save size={14} className="mr-2" />{saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="text-4xl w-14 h-14 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200">
            <input className="w-10 text-3xl text-center bg-transparent focus:outline-none" value={emoji} onChange={e => setEmoji(e.target.value)} />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <Label className="text-xs text-slate-500 font-medium block mb-1">Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Green Trail Trek Protocol" className="font-semibold" />
            </div>
            <div>
              <Label className="text-xs text-slate-500 font-medium block mb-1">Trek (optional — leave shared to apply to all treks)</Label>
              <Select value={trekId} onValueChange={setTrekId}>
                <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Shared — all treks" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value={SHARED}>Shared — all treks</SelectItem>
                  {treks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-500 font-medium block mb-1">Description (optional)</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short summary shown on the card" />
        </div>
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-500">
          <span className="font-mono truncate flex-1">{isNew ? `${window.location.host}/trek-protocol.html?id=(save first)` : `${window.location.host}/trek-protocol.html?id=${id}`}</span>
          <span className="shrink-0 bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Public URL</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{sections.length} section{sections.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-4">
          <button onClick={insertStandardContent} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <ShieldCheck size={14} /> Standard Protocol
          </button>
          <button onClick={addSection} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={16} /> Add Section
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <input
                className="flex-1 bg-transparent font-semibold text-slate-800 text-sm focus:outline-none"
                placeholder={`Section ${sIdx + 1} title`}
                value={section.title}
                onChange={e => setSectionTitle(sIdx, e.target.value)}
              />
              <span className="text-xs text-slate-400 shrink-0">{section.items.length} items</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronDown size={14} /></button>
                <button onClick={() => removeSection(sIdx)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {section.items.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No items yet</p>}
              {section.items.map((it, ii) => (
                <div key={ii} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <input
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Item"
                    value={itemName(it)}
                    onChange={e => setItem(sIdx, ii, e.target.value)}
                  />
                  <button onClick={() => removeItem(sIdx, ii)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={14} /></button>
                </div>
              ))}
              <div className="px-4 py-3">
                <button onClick={() => addItem(sIdx)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus size={15} /> Add Item
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addSection} className="w-full mt-5 border-2 border-dashed border-slate-200 rounded-2xl py-4 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2">
        <Plus size={16} /> Add New Section
      </button>
    </div>
  );
}
