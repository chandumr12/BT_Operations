/**
 * HotelStayView — Public vendor page, no login required.
 * URL: /stay-view?place=haridwar
 * Exact same visual as the standalone HTML dashboard.
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getDoc, doc as fsDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestore as firestoreDB } from '@/lib/firebase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PLACES = [
  'Haridwar', 'Barkot', 'Uttarakashi', 'Guptakashi',
  'Kedarnath', 'Mandal/Chopta', 'Joshimath-Badrinath', 'Rishikesh',
];

const SLUGS = {
  'haridwar': 'Haridwar',
  'barkot': 'Barkot',
  'uttarakashi': 'Uttarakashi',
  'guptakashi': 'Guptakashi',
  'kedarnath': 'Kedarnath',
  'mandal-chopta': 'Mandal/Chopta',
  'joshimath-badrinath': 'Joshimath-Badrinath',
  'rishikesh': 'Rishikesh',
};

const PKG = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };

function slugify(place) {
  return place.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
}

function statusClass(s) {
  if (s === 'CHECK-IN') return 'ci';
  if (s === 'CHECK-OUT') return 'co';
  return 'on';
}

function statusLabel(s) {
  if (s === 'CHECK-IN') return 'CHECK-IN';
  if (s === 'CHECK-OUT') return 'CHECK-OUT';
  return '1 NIGHT';
}

function groupByDate(stays) {
  const map = {};
  for (const s of stays) {
    const key = s.date;
    if (!map[key]) {
      const d = new Date(s.date + 'T00:00:00');
      map[key] = {
        date: s.date,
        day: d.getDate(),
        dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        year: d.getFullYear(),
        batches: [],
      };
    }
    map[key].batches.push(s);
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

function Stats({ days }) {
  const totalPax = days.reduce((s, d) => s + d.batches.reduce((a, b) => a + (b.pax || 0), 0), 0);
  const activeDays = days.length;
  const peakDay = Math.max(...days.map(d => d.batches.reduce((a, b) => a + (b.pax || 0), 0)), 0);
  const totalBatches = new Set(days.flatMap(d => d.batches.map(b => b.serial))).size;
  const items = [
    { label: 'Total Pax Nights', value: totalPax },
    { label: 'Active Days', value: activeDays },
    { label: 'Peak Day Pax', value: peakDay },
    { label: 'Total Batches', value: totalBatches },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
      {items.map(i => (
        <div key={i.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', color: '#64748b', fontWeight: 600 }}>{i.label}</div>
          <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 30, fontWeight: 700, marginTop: 2 }}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

const VENDOR_ROOM_COLORS = {
  '3':    { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', label: '#15803d' },
  '4':    { bg: '#f0f9ff', border: '#bae6fd', accent: '#0284c7', label: '#0369a1' },
  'dorm': { bg: '#fffbeb', border: '#fde68a', accent: '#d97706', label: '#b45309' },
};

function VendorBatchCard({ b, isAdmin }) {
  const [dsOpen, setDsOpen] = React.useState(false);
  const [srOpen, setSrOpen] = React.useState({});
  const sc     = statusClass(b.status);
  const colors = {
    ci: { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', paxColor: '#16a34a' },
    co: { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', paxColor: '#2563eb' },
    on: { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c', paxColor: '#ea580c' },
  }[sc];
  const pkgName = PKG[b.code] || b.packageName || b.code || '';

  // Double sharing
  const pairs   = b.doubleSharingPairs || [];
  const legacyDS = !pairs.length && (b.doubleSharing > 0);
  const dsCount = pairs.length || (legacyDS ? b.doubleSharing : 0);
  const dsM = pairs.reduce((n, p) => n + (p.gender1==='M'?1:0) + (p.gender2==='M'?1:0), 0);
  const dsF = pairs.reduce((n, p) => n + (p.gender1==='F'?1:0) + (p.gender2==='F'?1:0), 0);

  // Other sharing rooms
  const srRooms = b.sharingRooms || [];
  const srTypes = ['3','4','dorm'];
  const srByType = srTypes
    .map(t => ({ type: t, rooms: srRooms.filter(r => r.type === t) }))
    .filter(g => g.rooms.length > 0);
  const srM = srRooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'M').length, 0);
  const srF = srRooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'F').length, 0);

  const totalM = b.male || 0;
  const totalF = b.female || 0;
  const unassignedM = Math.max(0, totalM - dsM - srM);
  const unassignedF = Math.max(0, totalF - dsF - srF);
  const hasAnyRooms = dsCount > 0 || srRooms.length > 0;

  return (
    <div style={{ borderRadius: 12, border: `2px solid ${colors.border}`, background: colors.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: colors.accent }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 14px 8px 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Batch {b.serial}</div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', padding: '2px 8px', borderRadius: 4, background: colors.accent, color: '#fff', display: 'inline-block', width: 'fit-content' }}>
            {statusLabel(b.status)}
          </div>
          {isAdmin && pkgName && (
            <div style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic' }}>{b.code} • {pkgName}</div>
          )}
          {b.status === 'CHECK-OUT' && (
            <div style={{ fontSize: 9, color: '#2563eb', fontWeight: 700 }}>↩ Same rooms — luggage kept!</div>
          )}
          {/* Total M/F */}
          {(totalM > 0 || totalF > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
              {totalM > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 9999 }}>{totalM}M</span>}
              {totalF > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#fce7f3', color: '#be185d', padding: '1px 6px', borderRadius: 9999 }}>{totalF}F</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 46, marginLeft: 8 }}>
          <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 26, fontWeight: 800, lineHeight: 1, color: colors.paxColor }}>{b.pax}</div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 600 }}>PAX</div>
        </div>
      </div>

      {/* Double sharing card-inside-card */}
      {dsCount > 0 && (
        <div style={{ margin: '0 10px 10px', borderRadius: 10, border: '1px solid #e9d5ff', overflow: 'hidden', background: 'rgba(255,255,255,0.6)' }}>
          <button
            onClick={() => setDsOpen(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>🛏 {dsCount} double {dsCount === 1 ? 'room' : 'rooms'}</span>
              {pairs.length > 0 && (
                <span style={{ display: 'flex', gap: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 9999 }}>{dsM}M</span>
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#fce7f3', color: '#be185d', padding: '1px 5px', borderRadius: 9999 }}>{dsF}F</span>
                </span>
              )}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{dsOpen ? '▲' : '▼'}</span>
          </button>


          {/* Expanded pairs */}
          {dsOpen && (
            <div style={{ borderTop: '1px solid #f3e8ff', padding: '8px 8px 6px' }}>
              {pairs.map((pair, idx) => (
                <div key={idx} style={{ background: '#fff', border: '1px solid #f3e8ff', borderRadius: 8, padding: '8px 10px', marginBottom: idx < pairs.length-1 ? 6 : 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Room {idx + 1}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pair.gender1==='M'?'#dbeafe':'#fce7f3', color: pair.gender1==='M'?'#1d4ed8':'#be185d', flexShrink: 0 }}>{pair.gender1}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{pair.name1 || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pair.gender2==='M'?'#dbeafe':'#fce7f3', color: pair.gender2==='M'?'#1d4ed8':'#be185d', flexShrink: 0 }}>{pair.gender2}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{pair.name2 || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
              {legacyDS && b.clientNames?.length > 0 && (
                <div style={{ fontSize: 10, color: '#64748b', padding: '4px 4px 0' }}>{b.clientNames.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Other room types: 3-sharing, 4-sharing, dorm */}
      {srByType.map(({ type, rooms }) => {
        const rc = VENDOR_ROOM_COLORS[type] || VENDOR_ROOM_COLORS['3'];
        const typeLabel = type === 'dorm' ? 'Dorm' : `${type}-Sharing`;
        const typeM = rooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'M').length, 0);
        const typeF = rooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'F').length, 0);
        const isOpen = srOpen[type];
        return (
          <div key={type} style={{ margin: '0 10px 10px', borderRadius: 10, border: `1px solid ${rc.border}`, overflow: 'hidden', background: 'rgba(255,255,255,0.6)' }}>
            <button
              onClick={() => setSrOpen(v => ({ ...v, [type]: !v[type] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: rc.accent }}>🛏 {rooms.length} {typeLabel} {rooms.length === 1 ? 'room' : 'rooms'}</span>
                <span style={{ display: 'flex', gap: 3 }}>
                  {typeM > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 9999 }}>{typeM}M</span>}
                  {typeF > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#fce7f3', color: '#be185d', padding: '1px 5px', borderRadius: 9999 }}>{typeF}F</span>}
                </span>
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${rc.border}`, padding: '8px 8px 6px' }}>
                {rooms.map((room, ri) => (
                  <div key={ri} style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: ri < rooms.length - 1 ? 6 : 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: rc.label, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Room {ri + 1}{room.capacity ? ` · cap ${room.capacity}` : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {(room.people || []).map((person, pi) => (
                        <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: person.gender === 'M' ? '#dbeafe' : '#fce7f3', color: person.gender === 'M' ? '#1d4ed8' : '#be185d', flexShrink: 0 }}>{person.gender}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{person.name || '—'}</span>
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

      {/* Unassigned pax */}
      {hasAnyRooms && (unassignedM > 0 || unassignedF > 0) && (
        <div style={{ margin: '0 10px 10px', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Unassigned</span>
          {unassignedM > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: 9999 }}>{unassignedM}M</span>}
          {unassignedF > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#fdf2f8', color: '#be185d', padding: '1px 5px', borderRadius: 9999 }}>{unassignedF}F</span>}
        </div>
      )}
    </div>
  );
}

function DateCard({ dayData, isAdmin }) {
  const total = dayData.batches.reduce((s, b) => s + (b.pax || 0), 0);
  return (
    <div style={{
      background: '#fff', borderRadius: 14, marginBottom: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: '1px solid #e2e8f0', overflow: 'hidden',
    }}>
      {/* Date header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 26, fontWeight: 800, color: '#1e3a5f', lineHeight: 1, minWidth: 36, textAlign: 'center' }}>{dayData.day}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{dayData.dayName}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{dayData.month} {dayData.year}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1e3a5f', color: '#fff', padding: '5px 14px', borderRadius: 20, fontWeight: 700, fontSize: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 400, opacity: .8 }}>TOTAL</span> {total}
        </div>
      </div>

      {/* Batch cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8, padding: 12 }}>
        {dayData.batches.map((b, i) => (
          <VendorBatchCard key={i} b={b} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}

export default function HotelStayView() {
  const queryParams   = new URLSearchParams(window.location.search);
  const placeParam    = queryParams.get('place') || '';
  const snapId        = queryParams.get('snap') || '';
  const lockedPlace   = SLUGS[placeParam.toLowerCase()] || null;
  const isAdmin       = !lockedPlace;

  const [allStays,     setAllStays]     = useState([]);
  const [activePlace,  setActivePlace]  = useState(lockedPlace || PLACES[0]);
  const [loading,      setLoading]      = useState(true);
  const [copied,       setCopied]       = useState(null);
  const [snapshotInfo, setSnapshotInfo] = useState(null);

  useEffect(() => {
    if (snapId) {
      getDoc(fsDoc(firestoreDB, 'stay_snapshots', snapId))
        .then(snap => {
          if (snap.exists()) {
            const d = snap.data();
            setSnapshotInfo({ label: d.label, date: d.createdAt?.toDate?.(), createdBy: d.createdBy });
            setAllStays(d.stays || []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const url = lockedPlace
        ? `${API}/hotel-stays?place=${slugify(lockedPlace)}`
        : `${API}/hotel-stays`;
      axios.get(url)
        .then(r => setAllStays(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [lockedPlace, snapId]);

  const placeStays = useMemo(
    () => allStays.filter(s => s.place === activePlace),
    [allStays, activePlace]
  );
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const grouped = useMemo(
    () => groupByDate(placeStays).filter(d => new Date(d.date + 'T00:00:00') >= today),
    [placeStays]
  );

  async function copyLink(place) {
    try {
      const res = await axios.get(`${API}/hotel-stays`);
      const snapRef = await addDoc(collection(firestoreDB, 'stay_snapshots'), {
        label: `Hotel Schedule — ${place} — ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`,
        place, createdAt: serverTimestamp(), stays: res.data,
      });
      const url = `${window.location.origin}/stay-view?place=${slugify(place)}&snap=${snapRef.id}`;
      await navigator.clipboard.writeText(url);
    } catch {
      const base = `${window.location.origin}/stay-view?place=${slugify(place)}`;
      navigator.clipboard.writeText(base);
    }
    setCopied(place);
    setTimeout(() => setCopied(null), 1800);
  }

  const styles = {
    body: { fontFamily: "'DM Sans',sans-serif", background: '#f8fafc', color: '#1e293b', minHeight: '100vh' },
    header: { background: 'linear-gradient(135deg,#1e3a5f,#0f172a)', padding: '24px 28px', color: '#fff', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,.2)' },
    h1: { fontFamily: "'Outfit',sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: '-.5px', margin: 0 },
    sub: { fontSize: 12, opacity: .7, marginTop: 3 },
  };

  if (loading) return (
    <div style={{ ...styles.body, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏨</div>
        <p style={{ color: '#64748b' }}>Loading stay schedule...</p>
      </div>
    </div>
  );

  return (
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.h1}>
          🏨 {lockedPlace ? `${lockedPlace} — Stay Schedule` : 'Hotel Stay Dashboard'}
        </h1>
        <p style={styles.sub}>
          {lockedPlace
            ? 'Bengaluru Trekkers • Season 2026'
            : 'Batch-wise room allocation • Season 2026'}
        </p>
      </div>

      {/* Snapshot banner */}
      {snapshotInfo && (
        <div style={{ padding:'8px 28px', background:'#eff6ff', borderBottom:'1px solid #bfdbfe', fontSize:12, color:'#1d4ed8', display:'flex', alignItems:'center', gap:8 }}>
          <span>📸</span>
          <span>
            <strong>Snapshot</strong> — This link shows data shared on{' '}
            {snapshotInfo.date
              ? snapshotInfo.date.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
              : 'a previous date'}
            {snapshotInfo.createdBy ? ` by ${snapshotInfo.createdBy}` : ''}.
            {' '}New admin changes will not appear here.
          </span>
        </div>
      )}

      {/* Admin share bar */}
      {isAdmin && (
        <div style={{ padding: '10px 28px', background: '#fefce8', borderBottom: '1px solid #fde68a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#92400e' }}>📋 Share links (vendor sees only their place):</span>
          {PLACES.map(p => (
            <button
              key={p}
              onClick={() => copyLink(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: copied === p ? '#f0fdf4' : '#fff',
                border: `1px solid ${copied === p ? '#86efac' : '#e5e7eb'}`, borderRadius: 6,
                padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', transition: '.15s',
                color: copied === p ? '#16a34a' : 'inherit', fontWeight: copied === p ? 700 : 400,
              }}
            >
              {p} {copied === p ? '✓ copied!' : '📋'}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {[
          { cls: '#16a34a', label: 'CHECK-IN — New group, allot rooms' },
          { cls: '#2563eb', label: 'CHECK-OUT — Same group, SAME ROOMS (luggage kept!)' },
          { cls: '#ea580c', label: '1 NIGHT — Single night stay' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: l.cls }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Tabs (admin only) */}
      {isAdmin && (
        <div style={{ padding: '14px 28px 0', background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {PLACES.map(p => (
              <button
                key={p}
                onClick={() => setActivePlace(p)}
                style={{
                  padding: '9px 18px', fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                  color: activePlace === p ? '#1e3a5f' : '#64748b',
                  background: activePlace === p ? '#f0f4f8' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderBottom: `3px solid ${activePlace === p ? '#1e3a5f' : 'transparent'}`,
                  borderRadius: activePlace === p ? '8px 8px 0 0' : 0,
                  whiteSpace: 'nowrap', transition: '.2s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '20px 28px', maxWidth: 1400, margin: '0 auto' }}>
        {grouped.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏨</div>
            <p style={{ fontSize: 16 }}>No stay entries for {activePlace} yet.</p>
          </div>
        ) : (
          <>
            <Stats days={grouped} />
            {grouped.map((d, i) => (
              <DateCard key={d.date} dayData={d} isAdmin={isAdmin} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
