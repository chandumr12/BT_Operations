// PackingLists.js — Admin: manage all packing list categories
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Copy, ExternalLink, Share2, ClipboardList, CopyPlus } from 'lucide-react';
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

export default function PackingLists() {
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const snap = await getDocs(
        query(collection(firestore, 'packing_lists'), orderBy('createdAt', 'desc'))
      );
      setCats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Failed to load packing lists');
    }
    setLoading(false);
  };

  const del = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(firestore, 'packing_lists', id));
      toast.success('Deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const duplicate = async (cat) => {
    setDuplicating(cat.id);
    try {
      const { id: _id, ...rest } = cat;
      const newSlug = `${cat.slug}-copy`;
      await addDoc(collection(firestore, 'packing_lists'), {
        ...rest,
        name: `${cat.name} Copy`,
        slug: newSlug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: null,
      });
      toast.success(`"${cat.name} Copy" created — click Edit to customise it`);
      load();
    } catch { toast.error('Duplicate failed'); }
    setDuplicating(null);
  };

  // Standalone static page (frontend/public/packing-list.html) — same page
  // works whether reached from the web app or shared from the mobile app.
  const publicUrl = (id) => `${window.location.origin}/packing-list.html?id=${id}`;

  const copyLink = (id) => {
    navigator.clipboard.writeText(publicUrl(id));
    toast.success('Public link copied!');
  };

  const whatsapp = (id, name) => {
    const text = encodeURIComponent(
      `📋 *${name} – Packing List*\n\nHere's what to pack for your trek:\n👉 ${publicUrl(id)}\n\n_Powered by BT Ops_`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const totalItems = (cat) =>
    (cat.sections || []).reduce((acc, s) => acc + (s.items || []).length, 0);

  const CATEGORY_COLORS = [
    'from-blue-50 to-indigo-50',
    'from-green-50 to-emerald-50',
    'from-orange-50 to-amber-50',
    'from-purple-50 to-violet-50',
    'from-pink-50 to-rose-50',
    'from-cyan-50 to-sky-50',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-600" />
            Packing Lists
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Create & share packing lists with trek batches via WhatsApp
          </p>
        </div>
        <Button
          onClick={() => navigate('/packing-lists/new/edit')}
          className="bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          <Plus size={16} className="mr-2" /> New Packing List
        </Button>
      </div>

      {cats.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-100">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-xl font-semibold text-slate-700">No packing lists yet</p>
          <p className="text-sm text-slate-400 mt-2 mb-6">
            Create your first packing list and share it with trekkers via WhatsApp
          </p>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => navigate('/packing-lists/new/edit')}
          >
            <Plus size={16} className="mr-2" /> Create First List
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cats.map((cat, idx) => {
            const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
            const itemCount = totalItems(cat);
            const sectionCount = (cat.sections || []).length;
            const updatedStr = formatDateTime(cat.updatedAt);

            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Card hero */}
                <div className={`bg-gradient-to-br ${color} p-5`}>
                  <div className="flex items-start justify-between">
                    <span className="text-5xl leading-none">{cat.emoji || '📋'}</span>
                    <span className="text-xs font-medium bg-white/70 text-slate-600 px-2 py-1 rounded-full">
                      {itemCount} items
                    </span>
                  </div>
                  <h2 className="font-bold text-slate-900 text-lg mt-3 leading-tight">
                    {cat.name}
                  </h2>
                  {cat.trekName ? (
                    <span className="inline-block mt-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {cat.trekName}
                    </span>
                  ) : (
                    <span className="inline-block mt-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      Shared — all treks
                    </span>
                  )}
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{cat.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{sectionCount} sections</p>
                </div>

                {/* Last updated meta */}
                {updatedStr && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400">
                        Updated {updatedStr}
                        {cat.updatedBy && (
                          <span className="font-medium text-slate-500"> · {cat.updatedBy}</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-300 font-mono truncate">
                        packing-list.html?id={cat.id}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-3 flex flex-wrap gap-1.5 mt-auto">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => navigate(`/packing-lists/${cat.id}/edit`)}
                    className="text-xs h-7"
                  >
                    <Edit2 size={11} className="mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => duplicate(cat)}
                    disabled={duplicating === cat.id}
                    className="text-xs h-7 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                    title="Duplicate this list"
                  >
                    <CopyPlus size={11} className="mr-1" />
                    {duplicating === cat.id ? '…' : 'Duplicate'}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => copyLink(cat.id)}
                    className="text-xs h-7"
                  >
                    <Copy size={11} className="mr-1" /> Link
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => whatsapp(cat.id, cat.name)}
                    className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <Share2 size={11} className="mr-1" /> WhatsApp
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => window.open(publicUrl(cat.id), '_blank')}
                    className="text-xs h-7"
                  >
                    <ExternalLink size={11} />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => del(cat.id, cat.name)}
                    className="text-xs h-7 text-red-400 hover:bg-red-50 hover:text-red-600 ml-auto"
                  >
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
