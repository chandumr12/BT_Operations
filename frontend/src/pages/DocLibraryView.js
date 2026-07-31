// DocLibraryView.js — Public shareable view for Pickup Points / Trek Protocol
// (no auth required). Mirrors PackingListView's look, but renders the simple
// { title, items: [string] } section shape written by the mobile Doc Library
// editor rather than the richer per-item object shape packing lists use.
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Share2, Copy, Check, Mountain, MapPin, Navigation, ExternalLink } from 'lucide-react';

// Items are either plain strings or { name, mapUrl } — see DocLibraryScreen
// on the mobile side. Both shapes render, so older entries keep working.
const itemName = (it) => (typeof it === 'string' ? it : it?.name ?? '');
const itemMapUrl = (it) => (typeof it === 'string' ? '' : it?.mapUrl ?? '');

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

/**
 * Vertical route strip: numbered stops joined by a connecting line, each
 * opening its own Google Maps link. Deliberately not an embedded live map —
 * that needs a billed Maps API key, and this renders instantly with none.
 */
function RouteMap({ stops }) {
  if (stops.length === 0) return null;

  // Universal Google Maps directions URL (no API key needed): first stop is
  // the origin, last is the destination, everything between is a waypoint.
  const directionsUrl = (() => {
    if (stops.length < 2) return '';
    const q = (s) => encodeURIComponent(s.name);
    const origin = q(stops[0]);
    const destination = q(stops[stops.length - 1]);
    const mid = stops.slice(1, -1).map(q).join('%7C');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}` +
      (mid ? `&waypoints=${mid}` : '') + `&travelmode=driving`;
  })();

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Navigation size={16} className="text-blue-600" />
          <h2 className="font-bold text-slate-900 text-sm">Route Map</h2>
          <span className="text-xs text-slate-400 ml-auto">{stops.length} stops</span>
        </div>

        <div className="px-5 py-5">
          {stops.map((stop, i) => {
            const isLast = i === stops.length - 1;
            const clickable = !!stop.mapUrl;
            const Inner = (
              <>
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm
                    ${i === 0 ? 'bg-emerald-500' : isLast ? 'bg-rose-500' : 'bg-blue-500'}`}>
                    {i + 1}
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 min-h-[28px] bg-slate-200 my-1" />}
                </div>
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                  <div className="flex items-start gap-2">
                    <p className={`text-sm font-semibold leading-snug ${clickable ? 'text-blue-700' : 'text-slate-700'}`}>
                      {stop.name}
                    </p>
                    {clickable && <ExternalLink size={13} className="text-blue-400 shrink-0 mt-0.5" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {i === 0 ? 'Start' : isLast ? 'Last stop' : 'Pickup point'}
                    {clickable ? ' · tap to open in Google Maps' : ''}
                  </p>
                </div>
              </>
            );

            return clickable ? (
              <a key={i} href={stop.mapUrl} target="_blank" rel="noreferrer"
                className="flex gap-3 group hover:opacity-80 transition-opacity">
                {Inner}
              </a>
            ) : (
              <div key={i} className="flex gap-3">{Inner}</div>
            );
          })}
        </div>

        {directionsUrl && (
          <a href={directionsUrl} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3.5 transition-colors">
            <MapPin size={15} /> Open full route in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

export default function DocLibraryView({
  collectionName,
  kindLabel,      // e.g. 'PICKUP POINTS'
  defaultEmoji,   // e.g. '📍'
  notFoundText,
  shareEmoji,
  showRoute = false,
}) {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, collectionName), where('slug', '==', slug));
        const snap = await getDocs(q);
        if (snap.empty) { setNotFound(true); setLoading(false); return; }
        setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } catch { setNotFound(true); }
      setLoading(false);
    })();
  }, [slug, collectionName]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsapp = () => {
    const text = encodeURIComponent(
      `${shareEmoji} *${data.name}*\n\n👉 ${window.location.href}\n\n_Powered by BT Ops_`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🏔️</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Not Found</h1>
          <p className="text-slate-500 text-sm">{notFoundText}</p>
          <p className="text-xs text-slate-400 mt-4">Powered by BT Ops · Bengaluru Trekkers</p>
        </div>
      </div>
    );
  }

  const sections = data.sections || [];
  const totalItems = sections.reduce((acc, s) => acc + (s.items || []).length, 0);

  // Every stop across all sections, in document order.
  const stops = sections
    .flatMap(s => s.items || [])
    .map(it => ({ name: itemName(it), mapUrl: itemMapUrl(it) }))
    .filter(s => s.name);

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
            <div className="text-7xl mb-4 leading-none">{data.emoji || defaultEmoji}</div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{data.name}</h1>
            <p className="text-sm font-semibold text-blue-300 uppercase tracking-widest mb-2">{kindLabel}</p>
            {data.trekName && (
              <p className="text-slate-300 text-sm">{data.trekName}</p>
            )}
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
      </div>

      {/* ── Route map (pickup points only) ── */}
      {showRoute && <RouteMap stops={stops} />}

      {/* ── Sections ── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {sections.map((section, sIdx) => {
          const items = section.items || [];
          if (items.length === 0 && !section.title) return null;
          const gradient = SECTION_BG[sIdx % SECTION_BG.length];

          return (
            <div key={sIdx}>
              <div className={`flex items-center gap-3 bg-gradient-to-r ${gradient} text-white px-5 py-3.5 rounded-2xl shadow-sm mb-4`}>
                <div>
                  <h2 className="font-bold text-base">{section.title || `Section ${sIdx + 1}`}</h2>
                  <p className="text-xs text-white/70">{items.length} items</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {items.map((item, iIdx) => {
                  const nm = itemName(item);
                  const url = itemMapUrl(item);
                  const body = (
                    <>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <p className={`text-sm leading-relaxed ${url ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>{nm}</p>
                      {url && <ExternalLink size={13} className="text-blue-400 shrink-0 mt-1" />}
                    </>
                  );
                  return url ? (
                    <a key={iIdx} href={url} target="_blank" rel="noreferrer"
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-blue-50/50 transition-colors">
                      {body}
                    </a>
                  ) : (
                    <div key={iIdx} className="flex items-start gap-3 px-5 py-3.5">{body}</div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {sections.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-10">Nothing published here yet.</p>
        )}
      </div>

      {/* ── Share CTA ── */}
      <div className="bg-slate-900 text-white py-10 px-4 text-center">
        <p className="text-slate-400 text-sm mb-4">Share this with your trek group</p>
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
    </div>
  );
}
