// PickupPointsEdit.js — Admin: create / edit a trek's pickup points
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
  Copy, ExternalLink, Navigation, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(base, excludeId = null) {
  const q = query(collection(firestore, 'pickup_points'), where('slug', '==', base));
  const snap = await getDocs(q);
  const conflict = snap.docs.find(d => d.id !== excludeId);
  if (!conflict) return base;
  return `${base}-${Math.random().toString(36).slice(2, 5)}`;
}

const itemName = (it) => (typeof it === 'string' ? it : it?.name || '');
const itemMapUrl = (it) => (typeof it === 'string' ? '' : it?.mapUrl || '');

// The standard Bengaluru pickup route — pre-fills a new entry so admins
// aren't retyping the same base stops per trek. Fully editable afterward,
// and matches the defaults already used by the mobile app.
const STANDARD_ROUTE = [
  { name: 'Milano Pizza, Indiranagar', mapUrl: 'https://share.google/VSQsmrRbqhtAnz6Wt' },
  { name: 'Shantala Silks, Majestic', mapUrl: 'https://maps.app.goo.gl/P2zTRp5ifR6TAqsKA' },
  { name: 'Govardhan Theatre, Yeshwanthpur', mapUrl: 'https://maps.app.goo.gl/SrV8123rDB1eQQ1A6' },
  { name: 'People Tree Hospital, Gorguntepalya', mapUrl: 'https://maps.app.goo.gl/4B2BSQTUcSW1QHvp8' },
];

function newSection() { return { title: '', items: [] }; }

export default function PickupPointsEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [description, setDescription] = useState('');
  const [trekId, setTrekId] = useState('');
  const [treks, setTreks] = useState([]);
  const [sections, setSections] = useState([newSection()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    api.get('/treks').then(r => setTreks(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'pickup_points', id));
        if (!snap.exists()) { toast.error('Not found'); navigate('/pickup-points'); return; }
        const d = snap.data();
        setName(d.name || '');
        setEmoji(d.emoji || '📍');
        setDescription(d.description || '');
        setTrekId(d.trekId || '');
        setSections((d.sections || []).length ? d.sections.map(s => ({ title: s.title || '', items: [...(s.items || [])] })) : [newSection()]);
      } catch { toast.error('Failed to load'); }
      setLoading(false);
    })();
  }, [id, isNew, navigate]);

  const insertStandardRoute = () =>
    setSections(prev => [...prev, { title: '', items: STANDARD_ROUTE.map(s => ({ ...s })) }]);

  const setSectionTitle = (i, v) => setSections(prev => prev.map((s, idx) => idx === i ? { ...s, title: v } : s));
  const addSection = () => setSections(prev => [...prev, newSection()]);
  const removeSection = (i) => setSections(prev => prev.filter((_, idx) => idx !== i));

  const addItem = (si) => setSections(prev => prev.map((s, idx) =>
    idx === si ? { ...s, items: [...s.items, { name: '', mapUrl: '' }] } : s));

  const setItem = (si, ii, name) => setSections(prev => prev.map((s, idx) =>
    idx === si ? { ...s, items: s.items.map((it, j) => j === ii ? { name, mapUrl: itemMapUrl(it) } : it) } : s));

  const setItemMapUrl = (si, ii, mapUrl) => setSections(prev => prev.map((s, idx) =>
    idx === si ? { ...s, items: s.items.map((it, j) => j === ii ? { name: itemName(it), mapUrl } : it) } : s));

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
    if (!trekId) { toast.error('Select which trek these pickup points are for'); return; }
    setSaving(true);
    try {
      const base = slugify(name);
      const slug = await uniqueSlug(base, isNew ? null : id);
      const cleanSections = sections
        .map(s => ({
          title: (s.title || '').trim(),
          items: (s.items || [])
            .map(it => {
              const nm = itemName(it).trim();
              const url = itemMapUrl(it).trim();
              return url ? { name: nm, mapUrl: url } : nm;
            })
            .filter(it => itemName(it)),
        }))
        .filter(s => s.title || s.items.length);
      const payload = {
        name: name.trim(),
        emoji,
        description: description.trim(),
        slug,
        trekId,
        trekName: treks.find(t => t.id === trekId)?.name || '',
        sections: cleanSections,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile?.displayName || userProfile?.email || 'Admin',
      };
      if (isNew) {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'pickup_points'), payload);
        toast.success('Pickup points created!');
      } else {
        await updateDoc(doc(firestore, 'pickup_points', id), payload);
        toast.success('Saved!');
      }
      navigate('/pickup-points');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const publicUrl = `${window.location.origin}/pickup-route.html?id=${isNew ? 'PREVIEW-SAVE-FIRST' : id}`;
  const copyLink = () => { navigator.clipboard.writeText(publicUrl); toast.success('Link copied!'); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalStops = sections.reduce((n, s) => n + s.items.filter(it => itemName(it)).length, 0);

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/pickup-points')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm transition-colors">
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
            <input
              className="w-10 text-3xl text-center bg-transparent focus:outline-none"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <Label className="text-xs text-slate-500 font-medium block mb-1">Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kumara Parvatha Pickups" className="font-semibold" />
            </div>
            <div>
              <Label className="text-xs text-slate-500 font-medium block mb-1">Trek *</Label>
              <Select value={trekId} onValueChange={setTrekId}>
                <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Select trek" /></SelectTrigger>
                <SelectContent className="bg-white">
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
        {!isNew && (
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-500">
            <Navigation size={12} className="shrink-0" />
            <span className="font-mono truncate flex-1">{window.location.host}/pickup-route.html?id={id}</span>
            <span className="shrink-0 bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Public route map</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalStops} stop{totalStops !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-4">
          <button onClick={insertStandardRoute} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <MapPin size={14} /> Standard route
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
                placeholder={`Section ${sIdx + 1} title (optional)`}
                value={section.title}
                onChange={e => setSectionTitle(sIdx, e.target.value)}
              />
              <span className="text-xs text-slate-400 shrink-0">{section.items.length} stops</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronDown size={14} /></button>
                <button onClick={() => removeSection(sIdx)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {section.items.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No stops yet</p>}
              {section.items.map((it, ii) => (
                <div key={ii} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-6 h-6 mt-1 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{ii + 1}</span>
                  <div className="flex-1 space-y-1.5">
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Stop name"
                      value={itemName(it)}
                      onChange={e => setItem(sIdx, ii, e.target.value)}
                    />
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Google Maps link (optional)"
                      value={itemMapUrl(it)}
                      onChange={e => setItemMapUrl(sIdx, ii, e.target.value)}
                    />
                  </div>
                  <button onClick={() => removeItem(sIdx, ii)} className="p-1 mt-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={14} /></button>
                </div>
              ))}
              <div className="px-4 py-3">
                <button onClick={() => addItem(sIdx)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus size={15} /> Add Stop
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
