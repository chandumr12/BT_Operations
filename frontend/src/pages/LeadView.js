/**
 * LeadView — Live (non-snapshot) batch info page for trip leaders.
 * URL: /lead-view?batch=C-01
 * Public, no login required.
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getDoc, doc, collection, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PKG = { K: 'Kedarnath 7D', T: 'KBT 9D', C: 'Chardham 11D' };
const VEHICLE_EMOJI = { Dzire: '🚗', Ertiga: '🚙', '12-Seater TT': '🚐', '16-Seater TT': '🚌', '22-Seater TT': '🚍' };
const STATUS_COLOR = {
  'CHECK-IN':  { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', label: 'CHECK-IN' },
  'CHECK-OUT': { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', label: 'CHECK-OUT' },
  '1N':        { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c', label: '1 NIGHT' },
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' });
}

function fmtShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Group stays by place, sorted by date
function groupByPlace(stays) {
  const map = {};
  for (const s of stays) {
    if (!map[s.place]) map[s.place] = [];
    map[s.place].push(s);
  }
  for (const p of Object.keys(map)) {
    map[p].sort((a, b) => a.date.localeCompare(b.date));
  }
  // Return ordered by first date
  return Object.entries(map)
    .sort(([, a], [, b]) => a[0].date.localeCompare(b[0].date))
    .map(([place, entries]) => ({ place, entries }));
}

function GenderPill({ gender }) {
  const isMale = gender === 'M';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, width: 18, height: 18, borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: isMale ? '#dbeafe' : '#fce7f3',
      color: isMale ? '#1d4ed8' : '#be185d', flexShrink: 0,
    }}>{gender}</span>
  );
}

function RoomSection({ pairs, sharingRooms }) {
  const [dsOpen, setDsOpen] = useState(false);
  const [srOpen, setSrOpen] = useState({});

  const dsCount = pairs.length;
  const dsM = pairs.reduce((n, p) => n + (p.gender1 === 'M' ? 1 : 0) + (p.gender2 === 'M' ? 1 : 0), 0);
  const dsF = pairs.reduce((n, p) => n + (p.gender1 === 'F' ? 1 : 0) + (p.gender2 === 'F' ? 1 : 0), 0);

  const srTypes = ['3', '4', 'dorm'];
  const srByType = srTypes
    .map(t => ({ type: t, rooms: (sharingRooms || []).filter(r => r.type === t) }))
    .filter(g => g.rooms.length > 0);

  const ROOM_COLORS = {
    '3':    { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', label: '3-Sharing' },
    '4':    { bg: '#f0f9ff', border: '#bae6fd', accent: '#0284c7', label: '4-Sharing' },
    'dorm': { bg: '#fffbeb', border: '#fde68a', accent: '#d97706', label: 'Dorm' },
  };

  if (dsCount === 0 && srByType.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Room Allocation</div>

      {/* Double sharing */}
      {dsCount > 0 && (
        <div style={{ marginBottom: 6, borderRadius: 8, border: '1px solid #e9d5ff', overflow: 'hidden', background: '#faf5ff' }}>
          <button
            onClick={() => setDsOpen(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>🛏 {dsCount} double {dsCount === 1 ? 'room' : 'rooms'}</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 9999 }}>{dsM}M</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: '#fce7f3', color: '#be185d', padding: '1px 5px', borderRadius: 9999 }}>{dsF}F</span>
            </span>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{dsOpen ? '▲' : '▼'}</span>
          </button>
          {dsOpen && (
            <div style={{ borderTop: '1px solid #f3e8ff', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {pairs.map((pair, idx) => (
                <div key={idx} style={{ background: '#fff', border: '1px solid #f3e8ff', borderRadius: 6, padding: '7px 9px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Room {idx + 1}</div>
                  {[{ name: pair.name1, gender: pair.gender1 }, { name: pair.name2, gender: pair.gender2 }].map((p, pi) => (
                    <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: pi === 0 ? 4 : 0 }}>
                      <GenderPill gender={p.gender} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{p.name || '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Other room types */}
      {srByType.map(({ type, rooms }) => {
        const rc = ROOM_COLORS[type] || ROOM_COLORS['3'];
        const typeM = rooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'M').length, 0);
        const typeF = rooms.reduce((n, r) => n + r.people.filter(p => p.gender === 'F').length, 0);
        const isOpen = srOpen[type];
        return (
          <div key={type} style={{ marginBottom: 6, borderRadius: 8, border: `1px solid ${rc.border}`, overflow: 'hidden', background: rc.bg }}>
            <button
              onClick={() => setSrOpen(v => ({ ...v, [type]: !v[type] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: rc.accent }}>🛏 {rooms.length} {rc.label} {rooms.length === 1 ? 'room' : 'rooms'}</span>
                {typeM > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 9999 }}>{typeM}M</span>}
                {typeF > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#fce7f3', color: '#be185d', padding: '1px 5px', borderRadius: 9999 }}>{typeF}F</span>}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${rc.border}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {rooms.map((room, ri) => (
                  <div key={ri} style={{ background: '#fff', border: `1px solid ${rc.border}`, borderRadius: 6, padding: '7px 9px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: rc.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Room {ri + 1}{room.capacity ? ` · cap ${room.capacity}` : ''}</div>
                    {(room.people || []).map((person, pi) => (
                      <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: pi < room.people.length - 1 ? 4 : 0 }}>
                        <GenderPill gender={person.gender} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{person.name || '—'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlaceCard({ place, entries, accomInfo }) {
  const info = accomInfo || {};
  const firstEntry = entries[0] || {};
  const pairs = firstEntry.doubleSharingPairs || [];
  const sharingRooms = firstEntry.sharingRooms || [];

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 12 }}>
      {/* Place header */}
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{place}</div>
            {info.hotelName && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{info.hotelName}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {info.phone && (
            <a href={`tel:${info.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '4px 10px', textDecoration: 'none' }}>
              📞 {info.phone}
            </a>
          )}
          {info.locationLink && (
            <a href={info.locationLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', textDecoration: 'none' }}>
              🗺 View Map
            </a>
          )}
        </div>
      </div>

      {/* Night entries */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {entries.map((entry, i) => {
            const sc = STATUS_COLOR[entry.status] || STATUS_COLOR['1N'];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: '7px 12px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: sc.accent, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{sc.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{fmt(entry.date)}</span>
                {entry.status === 'CHECK-OUT' && (
                  <span style={{ fontSize: 10, color: sc.accent, fontWeight: 700 }}>↩ Same rooms, luggage kept</span>
                )}
              </div>
            );
          })}
        </div>

        <RoomSection pairs={pairs} sharingRooms={sharingRooms} />
      </div>
    </div>
  );
}

export default function LeadView() {
  const params      = new URLSearchParams(window.location.search);
  const batchSerial = params.get('batch') || '';
  const batchCode   = params.get('code') || '';

  const [allStays,    setAllStays]    = useState([]);
  const [accomInfo,   setAccomInfo]   = useState({});
  const [leadName,    setLeadName]    = useState('');
  const [documents,   setDocuments]   = useState([]);
  const [vehicles,    setVehicles]    = useState([]);
  const [driverData,  setDriverData]  = useState({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [activeTab,   setActiveTab]   = useState('stays');
  const staysRef    = React.useRef(null);
  const vehiclesRef = React.useRef(null);
  const docsRef     = React.useRef(null);

  useEffect(() => {
    if (!batchSerial) { setError('No batch specified in URL.'); setLoading(false); return; }


    Promise.all([
      axios.get(`${API}/hotel-stays`),
      getDoc(doc(firestore, 'batch_lead_info', batchCode ? `${batchCode}-${batchSerial}` : batchSerial)),
      getDocs(collection(firestore, 'vehicles')),
      getDocs(collection(firestore, 'vehicle_driver_details')),
    ]).then(([staysRes, leadDoc, vehicleSnap, driverSnap]) => {
      // Filter by both serial AND code to avoid cross-package collisions
      const batchStays = staysRes.data.filter(s =>
        String(s.serial) === batchSerial && (!batchCode || s.code === batchCode)
      );
      if (batchStays.length === 0) { setError(`No batch found with serial "${batchSerial}"${batchCode ? ` (${batchCode})` : ''}.`); setLoading(false); return; }
      setAllStays(batchStays);

      const ld = leadDoc.exists() ? leadDoc.data() : {};
      setAccomInfo(ld.accommodations || {});
      setLeadName(ld.leadName || '');
      setDocuments(ld.documents || []);

      const allVehicles = vehicleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const resolvedCode = batchCode || (batchStays[0]?.code || '');
      // Exact batchCode match first (e.g. "C-3"), then fall back to code+date proximity
      const exactLabel = `${resolvedCode}-${batchSerial}`;
      let matched = allVehicles.filter(v => v.batchCode === exactLabel);
      if (matched.length === 0) {
        const batchStart = batchStays.reduce((m, s) => s.date < m ? s.date : m, batchStays[0].date);
        const bStart = new Date(batchStart);
        matched = allVehicles.filter(v => {
          if ((v.packageCode || v.code) !== resolvedCode) return false;
          if (!v.startDate) return false;
          return Math.abs(new Date(v.startDate) - bStart) / 86400000 <= 3;
        });
      }
      setVehicles(matched);

      const dd = {};
      driverSnap.docs.forEach(d => { dd[d.id] = d.data().slots || []; });
      setDriverData(dd);

      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError('Failed to load batch data.');
      setLoading(false);
    });
  }, [batchSerial]);

  const placeGroups = useMemo(() => groupByPlace(allStays), [allStays]);
  const batchInfo   = useMemo(() => {
    if (!allStays.length) return null;
    const first = allStays[0];
    const dates = allStays.map(s => s.date).sort();
    return {
      serial: first.serial,
      code: first.code,
      packageName: PKG[first.code] || first.packageName || first.code || '',
      pax: first.pax || 0,
      male: first.male || 0,
      female: first.female || 0,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
    };
  }, [allStays]);

  const styles = {
    body: { fontFamily: "'DM Sans',sans-serif", background: '#f8fafc', color: '#1e293b', minHeight: '100vh' },
    header: { background: 'linear-gradient(135deg,#1e3a5f,#0f172a)', padding: '20px 24px', color: '#fff' },
  };

  if (loading) return (
    <div style={{ ...styles.body, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏕</div>
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading batch details…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...styles.body, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 14 }}>{error}</p>
        <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>Contact your BT operations manager for the correct link.</p>
      </div>
    </div>
  );

  return (
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Bengaluru Trekkers · Trip Leader Info
            </p>
            <h1 style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              Batch {batchInfo.serial}
            </h1>
            <p style={{ fontSize: 13, opacity: 0.75, marginTop: 3 }}>{batchInfo.packageName}</p>
            {leadName && <p style={{ fontSize: 12, opacity: 0.85, marginTop: 4, fontWeight: 600 }}>👤 Trip Lead: {leadName}</p>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 56 }}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{batchInfo.pax}</div>
              <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>PAX</div>
            </div>
            {batchInfo.male > 0 && (
              <div style={{ background: 'rgba(219,234,254,0.18)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 48 }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{batchInfo.male}</div>
                <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Male</div>
              </div>
            )}
            {batchInfo.female > 0 && (
              <div style={{ background: 'rgba(252,231,243,0.18)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 48 }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{batchInfo.female}</div>
                <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Female</div>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
          {fmtShort(batchInfo.startDate)} → {fmtShort(batchInfo.endDate)}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.5 }}>
          ⚡ Live link — always shows latest data
        </div>
      </div>

      {/* ── Sticky Nav Tabs ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 0 }}>
          {[
            { key: 'stays',    label: '🏨 Stay Details',    ref: staysRef },
            { key: 'vehicles', label: '🚐 Vehicle Details', ref: vehiclesRef },
            { key: 'docs',     label: '📄 Documents',       ref: docsRef },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                tab.ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                flex: 1, padding: '13px 8px', fontSize: 12, fontWeight: 700,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: `3px solid ${activeTab === tab.key ? '#1e3a5f' : 'transparent'}`,
                color: activeTab === tab.key ? '#1e3a5f' : '#64748b',
                transition: '.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Stay Schedule ── */}
        <div ref={staysRef} style={{ marginBottom: 28, scrollMarginTop: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 3, height: 18, background: '#1e3a5f', borderRadius: 2 }} />
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16, color: '#1e293b', margin: 0 }}>Stay Schedule</h2>
          </div>
          {placeGroups.map(({ place, entries }) => (
            <PlaceCard key={place} place={place} entries={entries} accomInfo={accomInfo[place]} />
          ))}
        </div>

        {/* ── Vehicles ── */}
        <div ref={vehiclesRef} style={{ marginBottom: 28, scrollMarginTop: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 3, height: 18, background: '#1e3a5f', borderRadius: 2 }} />
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16, color: '#1e293b', margin: 0 }}>Transport</h2>
          </div>
          {vehicles.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px dashed #e2e8f0', padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Vehicle details not yet assigned. Check back later.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {vehicles.map(v => {
                const drivers = driverData[v.id] || [];
                return (
                  <div key={v.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    {/* Vehicle header */}
                    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{v.batchCode}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{fmtShort(v.startDate)} → {fmtShort(v.endDate)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(v.vehicles || []).map((vt, i) => (
                          <span key={i} style={{ fontSize: 12, fontWeight: 600, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {VEHICLE_EMOJI[vt.type] || '🚐'} {vt.count} × {vt.type}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Driver slots */}
                    {drivers.length > 0 && (
                      <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
                        {drivers.map((slot, si) => (
                          <div key={si} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                              {VEHICLE_EMOJI[slot.vehicleType] || '🚐'} {slot.vehicleType}{slot.slotIndex > 0 ? ` #${slot.slotIndex + 1}` : ''}
                            </div>
                            {slot.driverName ? (
                              <>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{slot.driverName}</div>
                                {slot.phone && (
                                  <a href={`tel:${slot.phone}`} style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, textDecoration: 'none', display: 'block', marginTop: 3 }}>
                                    📞 {slot.phone}
                                  </a>
                                )}
                                {slot.vehicleNo && (
                                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontFamily: 'monospace' }}>{slot.vehicleNo}</div>
                                )}
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Driver TBD</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {v.notes && (
                      <div style={{ margin: '0 14px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#92400e' }}>
                        📝 {v.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Documents ── */}
        <div ref={docsRef} style={{ marginBottom: 28, scrollMarginTop: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 3, height: 18, background: '#1e3a5f', borderRadius: 2 }} />
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16, color: '#1e293b', margin: 0 }}>Documents</h2>
          </div>
          {documents.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px dashed #e2e8f0', padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No documents uploaded yet. Check back later.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {documents.map((d, i) => {
                const isPdf = d.name?.match(/\.pdf$/i);
                const isImg = d.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const icon  = isPdf ? '📄' : isImg ? '🖼' : '📎';
                return (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                      padding: '12px 16px', textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      {d.uploadedAt && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          {new Date(d.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                      Open ↗
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#94a3b8' }}>
          Bengaluru Trekkers · BT Ops Platform · For queries contact your BT operations manager.
        </p>
      </div>
    </div>
  );
}
