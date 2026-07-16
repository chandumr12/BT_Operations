import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, AlertTriangle, Eye, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BRAND = '#f1563f';

const CAT_META = {
  weekday:   { label: 'Weekday',   color: '#3b82f6', bg: '#eff6ff' },
  weekend:   { label: 'Weekend',   color: '#7c3aed', bg: '#f5f3ff' },
  himalayan: { label: 'Himalayan', color: '#059669', bg: '#ecfdf5' },
};

const WEEK_LABELS = { 1: 'Week 1', 2: 'Week 2', 3: 'Week 3', 4: 'Week 4' };

const currentYearMonth = () => new Date().toISOString().slice(0, 7);

const fmtSlotDate = (iso) => {
  if (!iso) return '?';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
};

const fmtMonth = (m) => {
  try { return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
  catch { return m; }
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: on ? BRAND : '#e2e8f0' }}
      role="switch" aria-checked={on}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(24px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────
function CancelDialog({ open, slotLabel, slotId, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/availability/cancel-notice', { slotId, slotLabel, reason });
      toast.success('Ops manager notified');
      onConfirm();
    } catch { toast.error('Failed to send notice'); }
    finally { setLoading(false); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-white rounded-2xl p-0">
        <DialogHeader className="sr-only"><DialogTitle>Cancel availability</DialogTitle></DialogHeader>
        <div className="px-5 py-4 rounded-t-2xl flex items-center gap-3 bg-amber-500 text-white">
          <AlertTriangle size={20} />
          <div>
            <h2 className="font-black text-base">Cancel Availability</h2>
            <p className="text-white/70 text-xs truncate">{slotLabel}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700">This will alert the Ops Manager. Add a reason if you like.</p>
          <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none" rows={3}
            placeholder="Optional reason…" value={reason} onChange={e => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Keep it</Button>
            <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={submit} disabled={loading}>
              {loading && <Loader2 size={14} className="animate-spin mr-1" />} Confirm cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── See team modal ───────────────────────────────────────────────────────────
function TeamModal({ open, onClose, activeMonths, allSlots }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState(activeMonths[0] || currentYearMonth());

  useEffect(() => {
    if (!open) return;
    if (activeMonths[0]) setViewMonth(activeMonths[0]);
  }, [open, activeMonths]);

  useEffect(() => {
    if (!open || !viewMonth) return;
    setLoading(true);
    api.get('/availability/all', { params: { month: viewMonth } })
      .then(r => setData(r.data || []))
      .catch(() => toast.error('Could not load team data'))
      .finally(() => setLoading(false));
  }, [open, viewMonth]);

  const slotMap = useMemo(() => {
    const m = {};
    allSlots.forEach(s => { m[s.id] = s; });
    return m;
  }, [allSlots]);

  const males   = data.filter(l => l.gender?.toLowerCase() === 'male').length;
  const females = data.filter(l => l.gender?.toLowerCase() === 'female').length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm md:max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-0">
        <DialogHeader className="sr-only"><DialogTitle>Team availability</DialogTitle></DialogHeader>
        <div className="px-5 py-4 text-white rounded-t-2xl flex items-center gap-3" style={{ background: BRAND }}>
          <Users size={20} />
          <div>
            <h2 className="font-black text-base">Team Availability</h2>
            <p className="text-white/65 text-xs">{data.length} leads responded</p>
          </div>
        </div>

        {/* Month tabs if multiple */}
        {activeMonths.length > 1 && (
          <div className="flex gap-1.5 px-4 pt-3">
            {activeMonths.map(m => (
              <button key={m} onClick={() => setViewMonth(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMonth === m ? 'text-white' : 'text-slate-500 bg-slate-100'}`}
                style={viewMonth === m ? { background: BRAND } : {}}>
                {fmtMonth(m)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin" style={{ color: BRAND }} /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No responses yet.</p>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex gap-3 mb-2">
              <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-600">{males}</p>
                <p className="text-xs text-slate-500">Male</p>
              </div>
              <div className="flex-1 rounded-xl p-3 text-center" style={{ background: `${BRAND}12` }}>
                <p className="text-2xl font-black" style={{ color: BRAND }}>{females}</p>
                <p className="text-xs text-slate-500">Female</p>
              </div>
            </div>
            {data.map((lead, i) => {
              const mySlots = (lead.selectedSlotIds || []).map(id => slotMap[id]).filter(Boolean);
              return (
                <div key={i} className="border border-slate-100 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{lead.displayName}</p>
                      <p className="text-xs text-slate-400">{lead.gender}</p>
                    </div>
                  </div>
                  {mySlots.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No slots selected</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {mySlots.map(slot => {
                        const meta = CAT_META[slot.category] || CAT_META.weekday;
                        return (
                          <span key={slot.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: meta.bg, color: meta.color }}>
                            {slot.trekName || 'TREK'} · {fmtSlotDate(slot.deptDate)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Single-month slot view ───────────────────────────────────────────────────
function MonthSlotView({ month, userProfile }) {
  const [slots, setSlots]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [savedIds,    setSavedIds]    = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/availability/slots', { params: { month } }),
      api.get('/availability', { params: { month } }),
    ])
      .then(([slotRes, avRes]) => {
        setSlots(slotRes.data || []);
        const saved = avRes.data?.selectedSlotIds || [];
        setSelectedIds(saved);
        setSavedIds(saved);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [month]);

  const grouped = useMemo(() => {
    const g = {};
    slots.forEach(slot => {
      const w = slot.week || 1;
      if (!g[w]) g[w] = {};
      if (!g[w][slot.category]) g[w][slot.category] = [];
      g[w][slot.category].push(slot);
    });
    return g;
  }, [slots]);

  const weeks = Object.keys(grouped).map(Number).sort();
  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/availability', { month, selectedSlotIds: selectedIds });
      toast.success('Availability saved!');
      setSavedIds(selectedIds);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const isDirty = JSON.stringify([...selectedIds].sort()) !== JSON.stringify([...savedIds].sort());

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 size={24} className="animate-spin" style={{ color: BRAND }} />
    </div>
  );

  return (
    <div className="space-y-3">
      {slots.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND}12` }}>
            <span className="text-xl">📅</span>
          </div>
          <p className="font-bold text-slate-700 text-sm">No slots set yet</p>
          <p className="text-xs text-slate-400">The ops manager hasn't added slots for {fmtMonth(month)} yet.</p>
        </div>
      )}

      {weeks.map(week => (
        <div key={week} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50" style={{ background: `${BRAND}08`, borderLeft: `3px solid ${BRAND}` }}>
            <p className="font-black text-slate-900 text-sm">{WEEK_LABELS[week] || `Week ${week}`}</p>
          </div>
          {['weekday', 'weekend', 'himalayan'].map(cat => {
            const catSlots = grouped[week]?.[cat];
            if (!catSlots?.length) return null;
            const meta = CAT_META[cat];
            return (
              <div key={cat}>
                <div className="px-4 py-2 border-b border-slate-50 flex items-center gap-2" style={{ background: meta.bg }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                  <span className="text-[10px] font-black px-2 py-0.5 uppercase tracking-widest"
                    style={{ color: meta.color }}>{meta.label}</span>
                </div>
                {catSlots.map(slot => {
                  const selected = selectedIds.includes(slot.id);
                  const wasSaved = savedIds.includes(slot.id);
                  const label = `${slot.trekName || 'TREK'} · ${fmtSlotDate(slot.deptDate)} → ${fmtSlotDate(slot.returnDate)}`;
                  return (
                    <div key={slot.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">
                          {slot.trekName || <span className="text-slate-400 italic">TREK</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ↑ {fmtSlotDate(slot.deptDate)} &nbsp;→&nbsp; ↓ {fmtSlotDate(slot.returnDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {wasSaved && !selected && (
                          <button className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg"
                            onClick={() => setCancelTarget({ slotId: slot.id, slotLabel: label })}>
                            Warn ops
                          </button>
                        )}
                        <Toggle on={selected} onChange={() => toggle(slot.id)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}

      {slots.length > 0 && (
        <Button
          className="w-full h-12 text-base font-bold rounded-xl shadow-lg text-white"
          style={{ background: isDirty ? BRAND : '#94a3b8' }}
          disabled={saving || !isDirty}
          onClick={handleSave}
        >
          {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving…</>
            : isDirty ? <><Save size={16} className="mr-2" />Save Availability</>
            : <><CheckCircle2 size={16} className="mr-2" />Up to date</>}
        </Button>
      )}

      <CancelDialog
        open={!!cancelTarget}
        slotId={cancelTarget?.slotId}
        slotLabel={cancelTarget?.slotLabel}
        onConfirm={() => { setSelectedIds(p => p.filter(id => id !== cancelTarget?.slotId)); setCancelTarget(null); }}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LeadAvailability() {
  const { userProfile } = useAuth();

  const [activeMonths, setActiveMonths] = useState([]);
  const [allSlots,     setAllSlots]     = useState([]);   // for TeamModal slotMap
  const [viewMonth,    setViewMonth]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showTeam,     setShowTeam]     = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const cfgRes = await api.get('/availability/config');
      const cfg = cfgRes.data || {};
      const months = cfg.activeMonths?.length ? cfg.activeMonths : [cfg.activeMonth || currentYearMonth()];
      setActiveMonths(months);
      const vm = months[0];
      setViewMonth(vm);

      // pre-load all slots for TeamModal slotMap
      const allSlotFetches = await Promise.all(
        months.map(m => api.get('/availability/slots', { params: { month: m } }))
      );
      setAllSlots(allSlotFetches.flatMap(r => r.data || []));
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 size={32} className="animate-spin" style={{ color: BRAND }} />
      <p className="text-sm text-slate-400">Loading availability…</p>
    </div>
  );

  if (activeMonths.length === 0) return (
    <div className="max-w-lg mx-auto px-3 md:px-0 py-6">
      <h1 className="text-2xl font-black text-slate-900 heading-font mb-1">My Availability</h1>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3 text-center mt-4">
        <span className="text-3xl">📅</span>
        <p className="font-bold text-slate-700">No active month set</p>
        <p className="text-sm text-slate-400">The ops manager hasn't opened availability yet.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-3 md:px-0 py-2 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 heading-font">My Availability</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {activeMonths.map(fmtMonth).join(' & ')}
          </p>
        </div>
        <button onClick={() => setShowTeam(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border mt-1"
          style={{ borderColor: `${BRAND}40`, color: BRAND }}>
          <Eye size={13} /> See team
        </button>
      </div>

      {/* Banner */}
      <div className="px-4 py-3 rounded-2xl text-sm" style={{ background: `${BRAND}10` }}>
        Hi <strong className="text-slate-800">{userProfile?.displayName}</strong> — toggle the slots you're available for, then Save.
      </div>

      {/* Month tabs (only if 2 active months) */}
      {activeMonths.length > 1 && (
        <div className="flex gap-2">
          {activeMonths.map(m => (
            <button key={m} onClick={() => setViewMonth(m)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                viewMonth === m ? 'text-white border-transparent shadow-sm' : 'text-slate-500 bg-white border-slate-200'
              }`}
              style={viewMonth === m ? { background: BRAND } : {}}>
              {fmtMonth(m)}
            </button>
          ))}
        </div>
      )}

      {/* Per-month slot view */}
      {viewMonth && (
        <MonthSlotView key={viewMonth} month={viewMonth} userProfile={userProfile} />
      )}

      <TeamModal
        open={showTeam}
        onClose={() => setShowTeam(false)}
        activeMonths={activeMonths}
        allSlots={allSlots}
      />
    </div>
  );
}
