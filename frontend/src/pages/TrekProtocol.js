// TrekProtocol.js — Admin: manage trek protocol / code-of-conduct documents
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Copy, ExternalLink, Share2, ShieldCheck, CopyPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function formatDateTime(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const itemName = (it) => (typeof it === 'string' ? it : it?.name || '');

export default function TrekProtocol() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(firestore, 'trek_protocols'), orderBy('updatedAt', 'desc')));
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Failed to load trek protocols');
    }
    setLoading(false);
  };

  const del = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(firestore, 'trek_protocols', id));
      toast.success('Deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const duplicate = async (l) => {
    setDuplicating(l.id);
    try {
      const { id: _id, ...rest } = l;
      await addDoc(collection(firestore, 'trek_protocols'), {
        ...rest,
        name: `${l.name} Copy`,
        slug: `${l.slug || l.id}-copy`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: null,
      });
      toast.success(`"${l.name} Copy" created — click Edit to customise it`);
      load();
    } catch { toast.error('Duplicate failed'); }
    setDuplicating(null);
  };

  // Standalone static page (frontend/public/trek-protocol.html) — same page
  // works whether reached from the web app or shared from the mobile app.
  const publicUrl = (id) => `${window.location.origin}/trek-protocol.html?id=${id}`;

  const copyLink = (id) => {
    navigator.clipboard.writeText(publicUrl(id));
    toast.success('Public link copied!');
  };

  const whatsapp = (id, name) => {
    const text = encodeURIComponent(`🧭 *${name}*\n\n👉 ${publicUrl(id)}\n\n_Powered by BT Ops_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const totalItems = (l) => (l.sections || []).reduce((n, s) => n + (s.items || []).filter(it => itemName(it)).length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={24} className="text-blue-600" />
            Trek Protocol
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Safety rules &amp; code of conduct — common across all treks, or specific to one
          </p>
        </div>
        <Button onClick={() => navigate('/trek-protocol/new/edit')} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
          <Plus size={16} className="mr-2" /> New Protocol
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-100">
          <div className="text-6xl mb-4">🧭</div>
          <p className="text-xl font-semibold text-slate-700">No protocols yet</p>
          <p className="text-sm text-slate-400 mt-2 mb-6">Create the trek protocol and share it with leads &amp; participants</p>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/trek-protocol/new/edit')}>
            <Plus size={16} className="mr-2" /> Create First Protocol
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {docs.map((l) => {
            const itemCount = totalItems(l);
            const sectionCount = (l.sections || []).length;
            const updatedStr = formatDateTime(l.updatedAt);
            return (
              <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5">
                  <div className="flex items-start justify-between">
                    <span className="text-5xl leading-none">{l.emoji || '🧭'}</span>
                    <span className="text-xs font-medium bg-white/70 text-slate-600 px-2 py-1 rounded-full">{itemCount} items</span>
                  </div>
                  <h2 className="font-bold text-slate-900 text-lg mt-3 leading-tight">{l.name}</h2>
                  {l.trekName ? (
                    <span className="inline-block mt-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{l.trekName}</span>
                  ) : (
                    <span className="inline-block mt-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Shared — all treks</span>
                  )}
                  {l.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{l.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">{sectionCount} sections</p>
                </div>

                {updatedStr && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400">
                      Updated {updatedStr}
                      {l.updatedBy && <span className="font-medium text-slate-500"> · {l.updatedBy}</span>}
                    </p>
                    <p className="text-[10px] text-slate-300 font-mono truncate">trek-protocol.html?id={l.id}</p>
                  </div>
                )}

                <div className="p-3 flex flex-wrap gap-1.5 mt-auto">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/trek-protocol/${l.id}/edit`)} className="text-xs h-7">
                    <Edit2 size={11} className="mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => duplicate(l)} disabled={duplicating === l.id}
                    className="text-xs h-7 text-indigo-700 border-indigo-200 hover:bg-indigo-50" title="Duplicate">
                    <CopyPlus size={11} className="mr-1" />{duplicating === l.id ? '…' : 'Duplicate'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyLink(l.id)} className="text-xs h-7">
                    <Copy size={11} className="mr-1" /> Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => whatsapp(l.id, l.name)}
                    className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50">
                    <Share2 size={11} className="mr-1" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(publicUrl(l.id), '_blank')} className="text-xs h-7">
                    <ExternalLink size={11} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => del(l.id, l.name)}
                    className="text-xs h-7 text-red-400 hover:bg-red-50 hover:text-red-600 ml-auto">
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
