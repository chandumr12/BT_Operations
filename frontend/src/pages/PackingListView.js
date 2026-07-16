// PackingListView.js — Public shareable packing list (no auth required)
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Share2, Copy, Check, Mountain, ExternalLink, X, ShoppingCart, Store } from 'lucide-react';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SECTION_BG = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
];

// ── Recommendations modal ─────────────────────────────────────────────────────
function RecsModal({ item, onClose }) {
  const recs = item.recommendations || [];
  const buyLinks = recs.filter(r => r.type !== 'rent');
  const rentLinks = recs.filter(r => r.type === 'rent');

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{item.emoji}</span>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{item.name}</h3>
              <p className="text-xs text-slate-400">Recommended options</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
          {/* Buy options */}
          {buyLinks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShoppingCart size={12} /> Buy Options
              </p>
              <div className="space-y-2">
                {buyLinks.map(r => (
                  <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between bg-green-50 hover:bg-green-100 border border-green-100 rounded-xl px-4 py-3 transition-colors group"
                  >
                    <span className="text-sm font-medium text-slate-800">{r.name}</span>
                    <ExternalLink size={14} className="text-green-600 group-hover:text-green-700 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rent options */}
          {rentLinks.length > 0 && item.rentable && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Store size={12} /> Rent Options
              </p>
              <div className="space-y-2">
                {rentLinks.map(r => (
                  <a key={r.id} href={r.url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl px-4 py-3 transition-colors group"
                  >
                    <span className="text-sm font-medium text-slate-800">{r.name}</span>
                    <ExternalLink size={14} className="text-blue-600 group-hover:text-blue-700 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {recs.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">No recommendations added yet</p>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function PackingListView() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [recsModal, setRecsModal] = useState(null); // item object
  const sectionRefs = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, 'packing_lists'), where('slug', '==', slug));
        const snap = await getDocs(q);
        if (snap.empty) { setNotFound(true); setLoading(false); return; }
        setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } catch { setNotFound(true); }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const idx = sectionRefs.current.indexOf(e.target);
            if (idx >= 0) setActiveSection(idx);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-80px 0px 0px 0px' }
    );
    sectionRefs.current.forEach(r => r && observer.observe(r));
    return () => observer.disconnect();
  }, [data]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsapp = () => {
    const text = encodeURIComponent(
      `📋 *${data.name} – Packing List*\n\nHere's what to pack for your trek:\n👉 ${window.location.href}\n\n_Powered by BT Ops_`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const scrollToSection = (idx) =>
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading packing list…</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🏔️</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">List Not Found</h1>
          <p className="text-slate-500 text-sm">This packing list doesn't exist or may have been removed.</p>
          <p className="text-xs text-slate-400 mt-4">Powered by BT Ops · Bengaluru Trekkers</p>
        </div>
      </div>
    );
  }

  const sections = data.sections || [];
  const totalItems = sections.reduce((acc, s) => acc + (s.items || []).length, 0);

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-8">
          <div className="flex items-center gap-2 mb-8">
            <Mountain size={18} className="text-blue-400" />
            <span className="text-sm font-semibold text-slate-300 tracking-wide">BENGALURU TREKKERS</span>
          </div>
          <div className="text-center">
            <div className="text-7xl mb-4 leading-none">{data.emoji || '📋'}</div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{data.name}</h1>
            <p className="text-sm font-semibold text-blue-300 uppercase tracking-widest mb-2">PACKING LIST</p>
            {data.description && (
              <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">{data.description}</p>
            )}
            <div className="flex items-center justify-center gap-3 mt-4 text-xs text-slate-500">
              <span>{totalItems} items</span>
              <span>·</span>
              <span>{sections.length} sections</span>
              {data.updatedAt && (
                <><span>·</span><span>Updated {formatDate(data.updatedAt)}</span></>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-7 justify-center">
            <button onClick={copyLink}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all border border-white/10"
            >
              {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={whatsapp}
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#22c55e] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all shadow-lg shadow-green-900/30"
            >
              <Share2 size={15} /> Share on WhatsApp
            </button>
          </div>
        </div>

        {/* Section nav tabs */}
        {sections.length > 0 && (
          <div className="border-t border-white/10 overflow-x-auto">
            <div className="flex max-w-2xl mx-auto px-5 min-w-max">
              {sections.map((s, idx) => (
                <button key={s.id || idx} onClick={() => scrollToSection(idx)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    activeSection === idx ? 'border-blue-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="hidden sm:inline">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Tip banner ── */}
      <div className="bg-blue-600 text-white text-xs text-center py-2 px-4">
        💡 Pack your clothes inside polybags to ensure they don't get wet — especially during heavy rain
      </div>

      {/* ── Sections ── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {sections.map((section, sIdx) => {
          const items = section.items || [];
          if (items.length === 0) return null;
          const gradient = SECTION_BG[sIdx % SECTION_BG.length];

          return (
            <div key={section.id || sIdx} ref={el => (sectionRefs.current[sIdx] = el)} className="scroll-mt-4">
              <div className={`flex items-center gap-3 bg-gradient-to-r ${gradient} text-white px-5 py-3.5 rounded-2xl shadow-sm mb-4`}>
                <span className="text-2xl">{section.icon}</span>
                <div>
                  <h2 className="font-bold text-base">{section.name}</h2>
                  <p className="text-xs text-white/70">{items.length} items</p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {items.map((item, iIdx) => (
                  <ItemCard key={item.id || iIdx} item={item} onViewRecs={() => setRecsModal(item)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Notes ── */}
      <div className="max-w-2xl mx-auto px-4 pb-4 space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs text-amber-800">
            <span className="font-bold">💊 Medicine Note:</span> Everyone need not carry the medicine kit.
            Divide the medicines within your group. Always carry your personal medication if any.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <p className="text-xs text-indigo-800">
            <span className="font-bold">📋 Documents:</span> Medical Form signed by a certified MBBS doctor.
            Disclaimer form signed by you. ID proof — original and photocopy. Vaccination Certificate ✓
          </p>
        </div>
      </div>

      {/* ── Share CTA ── */}
      <div className="bg-slate-900 text-white py-10 px-4 text-center">
        <p className="text-slate-400 text-sm mb-4">Share this packing list with your trek group</p>
        <div className="flex gap-3 justify-center">
          <button onClick={copyLink}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all border border-white/10"
          >
            {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={whatsapp}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#22c55e] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all"
          >
            <Share2 size={15} /> WhatsApp
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="bg-slate-950 py-5 text-center">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Mountain size={14} />
          <span className="text-xs">Powered by <span className="text-slate-400 font-semibold">BT Ops</span> · Bengaluru Trekkers</span>
        </div>
      </div>

      {/* Recommendations modal */}
      {recsModal && <RecsModal item={recsModal} onClose={() => setRecsModal(null)} />}
    </div>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, onViewRecs }) {
  const hasRecs = (item.recommendations || []).length > 0;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border flex flex-col items-center text-center relative overflow-hidden
      ${item.optional ? 'border-amber-100' : 'border-slate-100'}
    `}>
      {/* Badges */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {item.optional && (
          <span className="text-[9px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full leading-none">OPT</span>
        )}
        {item.rentable && (
          <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full leading-none">RENT</span>
        )}
      </div>

      {/* Icon */}
      <div className={`text-4xl mt-4 mb-2 leading-none ${item.optional ? 'opacity-70' : ''}`}>
        {item.emoji}
      </div>

      {/* Name */}
      <p className={`text-xs font-semibold leading-tight mb-1 px-2 ${item.optional ? 'text-slate-400' : 'text-slate-700'}`}>
        {item.name}
      </p>

      {/* Quantity */}
      {item.quantity && (
        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium mb-2">
          {item.quantity}
        </span>
      )}

      {/* View options button */}
      {hasRecs && (
        <button
          onClick={onViewRecs}
          className="w-full mt-auto py-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border-t border-blue-100 flex items-center justify-center gap-1"
        >
          <ExternalLink size={10} /> View Options
        </button>
      )}

      {/* Rentable CTA (even without links) */}
      {!hasRecs && item.rentable && (
        <div className="w-full mt-auto py-1 text-[9px] text-blue-400 bg-blue-50/50 border-t border-blue-100 text-center">
          Available to rent
        </div>
      )}
    </div>
  );
}
