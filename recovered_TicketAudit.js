import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '@/utils/api';
import { toast } from 'sonner';
import {
  Plus, Trash2, RefreshCw, Eye, EyeOff, Users,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight,
  Ticket, MapPin, Calendar, Clock, Edit2, ToggleLeft, ToggleRight,
  Play, AlertCircle, Search, Filter, X, ArrowUpDown, Table2, LayoutList,
  Download, History, CheckSquare, Square, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BRAND = '#f1563f';

const fmtDt = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
};

// ── Credential dialog ──────────────────────────────────────────────────────────
function CredentialDialog({ open, editing, onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', password: '', label: '', active: true });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { email: editing.email || '', password: '', label: editing.label || '', active: editing.active ?? true }
        : { email: '', password: '', label: '', active: true }
      );
      setShowPw(false);
    }
  }, [open, editing]);

  const save = async () => {
    if (!form.email) { toast.error('Email required'); return; }
    if (!editing && !form.password) { toast.error('Password required'); return; }
    setSaving(true);
    try {
      if (editing) {
        const patch = { label: form.label, active: form.active };
        if (form.password) patch.password = form.password;
        await api.patch(`/ticket-audit/credentials/${editing.id}`, patch);
        toast.success('Updated');
      } else {
        await api.post('/ticket-audit/credentials', form);
        toast.success('Account added');
      }
      onSaved();
      onClose();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-white rounded-2xl p-0">
        <DialogHeader className="sr-only"><DialogTitle>{editing ? 'Edit' : 'Add'} Account</DialogTitle></DialogHeader>
        <div className="px-5 py-4 rounded-t-2xl text-white flex items-center gap-3" style={{ background: BRAND }}>
          <Ticket size={20} />
          <div>
            <h2 className="font-black text-base">{editing ? 'Edit Account' : 'Add Account'}</h2>
            <p className="text-white/70 text-xs">Aranya Vihaara credentials</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Email</label>
            <input type="email" value={form.email} disabled={!!editing}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full h-9 border border-slate-200 rounded-xl px-3 text-sm bg-slate-50 focus:outline-none disabled:opacity-60" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Password {editing && <span className="text-slate-400 normal-case">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full h-9 border border-slate-200 rounded-xl px-3 pr-9 text-sm bg-slate-50 focus:outline-none" />
              <button onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Label (optional)</label>
            <input type="text" value={form.label} placeholder="e.g. Account 1"
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              className="w-full h-9 border border-slate-200 rounded-xl px-3 text-sm bg-slate-50 focus:outline-none" />
          </div>
          {editing && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700 font-medium">Active</span>
              <button onClick={() => setForm(p => ({ ...p, active: !p.active }))}>
                {form.active
                  ? <ToggleRight size={28} style={{ color: BRAND }} />
                  : <ToggleLeft size={28} className="text-slate-300" />}
              </button>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 text-white" style={{ background: BRAND }} onClick={save} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin mr-1" />}
              {editing ? 'Update' : 'Add Account'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Trek report card ───────────────────────────────────────────────────────────
function TrekReportCard({ trek, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalVisitors = trek.accounts?.reduce((s, a) => s + (a.visitors?.length || 0), 0) || 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(p => !p)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-black text-slate-900">{trek.trekName}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>
              {trek.totalTickets} ticket{trek.totalTickets !== 1 ? 's' : ''}
            </span>
            {totalVisitors > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                {totalVisitors} visitor{totalVisitors !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
            {trek.date && <span className="flex items-center gap-1"><Calendar size={11} />{trek.date}</span>}
            {trek.slot && <span className="flex items-center gap-1"><Clock size={11} />{trek.slot}</span>}
            {trek.district && <span className="flex items-center gap-1"><MapPin size={11} />{trek.district}</span>}
            <span className="flex items-center gap-1"><Users size={11} />{trek.accounts?.length} account{trek.accounts?.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
          : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-50 divide-y divide-slate-50">
          {trek.accounts?.map((acc, i) => (
            <div key={i} className="px-4 py-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{acc.label || acc.email}</p>
                  <p className="text-[11px] text-slate-400">{acc.email}</p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p>Ticket: <strong className="text-slate-700">{acc.ticketNo || '—'}</strong></p>
                  {acc.orderId && <p>Order: <strong className="text-slate-600">{acc.orderId}</strong></p>}
                  <p>{acc.visitorCount} visitor{acc.visitorCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {acc.visitors?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="text-left font-bold pb-1 pr-3">#</th>
                        <th className="text-left font-bold pb-1 pr-3">Name</th>
                        <th className="text-left font-bold pb-1 pr-3">Age</th>
                        <th className="text-left font-bold pb-1 pr-3">Gender</th>
                        <th className="text-left font-bold pb-1 pr-3">Mobile</th>
                        <th className="text-left font-bold pb-1">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acc.visitors.map((v, j) => (
                        <tr key={j} className="border-t border-slate-100">
                          <td className="py-1 pr-3 text-slate-400">{v.no || j + 1}</td>
                          <td className="py-1 pr-3 font-semibold text-slate-800">{v.name}</td>
                          <td className="py-1 pr-3 text-slate-600">{v.age}</td>
                          <td className="py-1 pr-3 text-slate-600">{v.gender}</td>
                          <td className="py-1 pr-3 text-slate-600">{v.mobile}</td>
                          <td className="py-1 text-slate-500">{v.idType} {v.idNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary table ──────────────────────────────────────────────────────────────
function SummaryTable({ treks }) {
  // Group by trek+date → aggregate
  const rows = treks.map(t => ({
    trekName:  t.trekName,
    date:      t.date,
    district:  t.district,
    accounts:  t.accounts?.length || 0,
    tickets:   t.totalTickets || 0,
    visitors:  t.accounts?.reduce((s, a) => s + (a.visitors?.length || 0), 0) || 0,
  }));

  const totalTickets  = rows.reduce((s, r) => s + r.tickets, 0);
  const totalVisitors = rows.reduce((s, r) => s + r.visitors, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-4 py-2.5">Trek</th>
              <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-3 py-2.5">Date</th>
              <th className="text-left font-black text-slate-500 text-[10px] uppercase tracking-widest px-3 py-2.5 hidden sm:table-cell">District</th>
              <th className="text-center font-black text-slate-500 text-[10px] uppercase tracking-widest px-3 py-2.5">Accts</th>
              <th className="text-center font-black text-slate-500 text-[10px] uppercase tracking-widest px-3 py-2.5">Tickets</th>
              <th className="text-center font-black text-slate-500 text-[10px] uppercase tracking-widest px-3 py-2.5">Visitors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-2.5 font-semibold text-slate-800">{r.trekName}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs hidden sm:table-cell">{r.district}</td>
                <td className="px-3 py-2.5 text-center text-slate-600 font-medium">{r.accounts}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{r.tickets}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">{r.visitors}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr className="bg-slate-50">
              <td className="px-4 py-2.5 font-black text-slate-700" colSpan={3}>Total — {rows.length} trek slot{rows.length !== 1 ? 's' : ''}</td>
              <td className="px-3 py-2.5 text-center text-slate-400 text-xs hidden sm:table-cell"></td>
              <td className="px-3 py-2.5 text-center font-black text-slate-900">{totalTickets}</td>
              <td className="px-3 py-2.5 text-center font-black text-blue-600">{totalVisitors}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCSV(treks) {
  const rows = [['Trek', 'Date', 'Slot', 'District', 'Account', 'Ticket No', 'Order ID', 'Visitor Name', 'Age', 'Gender', 'Mobile', 'ID Type', 'ID Number']];
  for (const trek of treks) {
    for (const acc of (trek.accounts || [])) {
      if (acc.visitors?.length) {
        for (const v of acc.visitors) {
          rows.push([trek.trekName, trek.date, trek.slot, trek.district,
            acc.label || acc.email, acc.ticketNo, acc.orderId,
            v.name, v.age, v.gender, v.mobile, v.idType, v.idNumber]);
        }
      } else {
        rows.push([trek.trekName, trek.date, trek.slot, trek.district,
          acc.label || acc.email, acc.ticketNo, acc.orderId, '', '', '', '', '', '']);
      }
    }
  }
  const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ticket-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Run status banner ──────────────────────────────────────────────────────────
function RunStatusBanner({ runStatus, onRefreshReport }) {
  if (!runStatus || runStatus.status === 'idle') return null;
  const { status, message, done = 0, total = 0 } = runStatus;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (status === 'running') return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 size={14} className="animate-spin text-blue-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-blue-800">Audit in progress…</p>
      </div>
      <p className="text-xs text-blue-600 mb-2">{message}</p>
      {total > 0 && <div className="w-full bg-blue-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#3b82f6' }} />
      </div>}
      {total > 0 && <p className="text-[11px] text-blue-400 mt-1 text-right">{done}/{total}</p>}
    </div>
  );

  if (status === 'done') return (
    <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-start gap-3">
      <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-800">Audit complete</p>
        <p className="text-xs text-green-600">{message}</p>
      </div>
      <button onClick={onRefreshReport}
        className="text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1 rounded-lg flex-shrink-0">
        View report →
      </button>
    </div>
  );

  if (status === 'error') return (
    <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-start gap-3">
      <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-700">Audit failed</p>
        <p className="text-xs text-red-500">{message}</p>
      </div>
    </div>
  );

  return null;
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TicketAudit() {
  const [tab, setTab]             = useState('report');
  const [creds, setCreds]         = useState([]);
  const [report, setReport]       = useState(null);
  const [runStatus, setRunStatus] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]         = useState(false);
  const [retrying, setRetrying]       = useState(false);
  const [clearing, setClearing]       = useState(false);
  const [history, setHistory]         = useState([]);
  const [activeRunId, setActiveRunId] = useState('latest'); // 'latest' or a run doc id
  const [activeReport, setActiveReport] = useState(null);   // report shown in UI
  // Accounts tab: search + select
  const [acctSearch,   setAcctSearch]   = useState('');
  const [selectedAccts, setSelectedAccts] = useState(new Set());
  const [runningSelected, setRunningSelected] = useState(false);
  const [credDialog, setCredDialog]   = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [deleting, setDeleting]       = useState(null);
  const [concurrency, setConcurrency] = useState(20);
  const pollRef    = useRef(null);
  const runTypeRef = useRef('full'); // 'full' | 'retry-latest' | 'retry-history' | 'selected'

  // ── Filter / search state ────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [filterTrek,    setFilterTrek]    = useState('');
  const [filterDate,    setFilterDate]    = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [sortBy,        setSortBy]        = useState('date'); // date | name | tickets | visitors
  const [viewMode,      setViewMode]      = useState('cards'); // cards | table

  // ── Derived filter options ───────────────────────────────────────────────────
  const displayReport = activeReport || report;
  const trekNames = useMemo(() =>
    [...new Set((displayReport?.treks || []).map(t => t.trekName))].sort(), [displayReport]);
  const dates = useMemo(() =>
    [...new Set((displayReport?.treks || []).map(t => t.date))].sort(), [displayReport]);
  const accountOptions = useMemo(() =>
    [...new Set((displayReport?.treks || []).flatMap(t => (t.accounts || []).map(a => a.label || a.email)))].sort(),
    [displayReport]);

  // ── Filtered + sorted treks ──────────────────────────────────────────────────
  const filteredTreks = useMemo(() => {
    let treks = (displayReport?.treks || []);

    if (filterTrek)    treks = treks.filter(t => t.trekName === filterTrek);
    if (filterDate)    treks = treks.filter(t => t.date === filterDate);

    if (filterAccount) {
      treks = treks
        .map(t => ({
          ...t,
          accounts: (t.accounts || []).filter(a => (a.label || a.email) === filterAccount),
          totalTickets: (t.accounts || []).filter(a => (a.label || a.email) === filterAccount)
            .reduce((s, a) => s + (a.visitors?.length || 0), 0),
        }))
        .filter(t => t.accounts.length > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      treks = treks.map(t => {
        if (t.trekName.toLowerCase().includes(q) || t.district?.toLowerCase().includes(q) || t.date?.includes(q)) return t;
        const matchedAccs = (t.accounts || []).filter(a =>
          a.ticketNo?.toLowerCase().includes(q) ||
          a.orderId?.toLowerCase().includes(q) ||
          (a.label || a.email)?.toLowerCase().includes(q) ||
          (a.visitors || []).some(v =>
            v.name?.toLowerCase().includes(q) ||
            v.mobile?.includes(q) ||
            v.idNumber?.toLowerCase().includes(q)
          )
        );
        if (matchedAccs.length > 0) return {
          ...t,
          accounts: matchedAccs,
          totalTickets: matchedAccs.reduce((s, a) => s + (a.visitors?.length || 0), 0),
        };
        return null;
      }).filter(Boolean);
    }

    return [...treks].sort((a, b) => {
      if (sortBy === 'name')     return a.trekName.localeCompare(b.trekName);
      if (sortBy === 'tickets')  return b.totalTickets - a.totalTickets;
      if (sortBy === 'visitors') return (
        b.accounts?.reduce((s, x) => s + (x.visitors?.length || 0), 0) -
        a.accounts?.reduce((s, x) => s + (x.visitors?.length || 0), 0)
      );
      return a.date?.localeCompare(b.date || '');
    });
  }, [displayReport, search, filterTrek, filterDate, filterAccount, sortBy]);

  const filteredTickets  = filteredTreks.reduce((s, t) => s + (t.totalTickets || 0), 0);
  const filteredVisitors = filteredTreks.reduce((s, t) =>
    s + (t.accounts || []).reduce((ss, a) => ss + (a.visitors?.length || 0), 0), 0);

  const hasFilters = search || filterTrek || filterDate || filterAccount;
  const clearFilters = () => { setSearch(''); setFilterTrek(''); setFilterDate(''); setFilterAccount(''); };

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadReport = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/report');
      const r = res.data?.generatedAt ? res.data : null;
      setReport(r);
      setActiveReport(r);
      setActiveRunId('latest');
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/report/history');
      setHistory(res.data || []);
    } catch {}
  }, []);

  // When viewing a historical run, keep activeReport in sync with the history list
  // (so after a retry it auto-refreshes from the updated history)
  useEffect(() => {
    if (activeRunId !== 'latest') {
      const found = history.find(h => h.id === activeRunId);
      if (found) setActiveReport(found);
    }
  }, [activeRunId, history]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/run/status');
      const s = res.data;
      setRunStatus(s);
      if (s?.status === 'running') { setRunning(true); setRetrying(false); setRunningSelected(false); }
      else {
        setRunning(false); setRetrying(false); setRunningSelected(false);
        if (s?.status === 'done') {
          loadHistory();
          // Only reload latest if the run touched 'latest' (full run, retry from latest, or run-selected)
          if (runTypeRef.current !== 'retry-history') loadReport();
        }
      }
    } catch {}
  }, [loadReport, loadHistory]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [credsRes] = await Promise.all([api.get('/ticket-audit/credentials'), loadReport(), loadStatus(), loadHistory()]);
      setCreds(credsRes.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [loadReport, loadStatus]);

  useEffect(() => {
    if (running || retrying || runningSelected) { pollRef.current = setInterval(loadStatus, 4000); }
    else { clearInterval(pollRef.current); }
    return () => clearInterval(pollRef.current);
  }, [running, retrying, runningSelected, loadStatus]);

  useEffect(() => { load(); }, [load]);

  const startAudit = async () => {
    if (running) return;
    runTypeRef.current = 'full';
    setRunning(true);
    setRunStatus({ status: 'running', message: 'Starting audit…', done: 0, total: 0 });
    try {
      await api.post(`/ticket-audit/run?concurrency=${concurrency}`);
      setTab('run');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to start audit';
      toast.error(msg);
      setRunning(false);
      setRunStatus({ status: 'error', message: msg });
    }
  };

  const retryFailed = async () => {
    if (running || retrying) return;
    runTypeRef.current = activeRunId === 'latest' ? 'retry-latest' : 'retry-history';
    setRetrying(true);
    setRunStatus({ status: 'running', message: 'Retrying failed accounts…', done: 0, total: 0 });
    try {
      await api.post(`/ticket-audit/run/retry?concurrency=${concurrency}&source_run_id=${activeRunId}`);
      setTab('report');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to start retry';
      toast.error(msg);
      setRetrying(false);
      setRunStatus({ status: 'error', message: msg });
    }
  };

  const clearReport = async () => {
    if (running || retrying) { toast.error('Wait for the current audit to finish'); return; }
    setClearing(true);
    try {
      await api.delete('/ticket-audit/report');
      setReport(null);
      setRunStatus(null);
      toast.success('Report cleared');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to clear report');
    } finally { setClearing(false); }
  };

  const runSelected = async () => {
    if (running || retrying || runningSelected || selectedAccts.size === 0) return;
    runTypeRef.current = 'selected';
    setRunningSelected(true);
    setRunStatus({ status: 'running', message: `Auditing ${selectedAccts.size} selected account(s)…`, done: 0, total: selectedAccts.size });
    try {
      await api.post(`/ticket-audit/run/selected?concurrency=${concurrency}`, [...selectedAccts]);
      setTab('report');
      setSelectedAccts(new Set());
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to start selected audit';
      toast.error(msg);
      setRunningSelected(false);
      setRunStatus({ status: 'error', message: msg });
    }
  };

  const clearAllHistory = async () => {
    if (running || retrying) { toast.error('Wait for the current audit to finish'); return; }
    try {
      const res = await api.delete('/ticket-audit/reports/history');
      setHistory([]);
      toast.success(`Cleared ${res.data.deleted} historical run(s)`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to clear history');
    }
  };

  const deleteCred = async (id) => {
    setDeleting(id);
    try {
      await api.delete(`/ticket-audit/credentials/${id}`);
      toast.success('Removed');
      load();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const activeCreds = creds.filter(c => c.active !== false);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 size={32} className="animate-spin" style={{ color: BRAND }} />
      <p className="text-sm text-slate-400">Loading…</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 heading-font">Ticket Audit</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Aranya Vihaara · {activeCreds.length} active account{activeCreds.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={load} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
            <RefreshCw size={15} className="text-slate-500" />
          </button>
          <button onClick={startAudit} disabled={running || activeCreds.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: BRAND }}>
            {running ? <><Loader2 size={14} className="animate-spin" /> Running…</> : <><Play size={14} /> Run Audit</>}
          </button>
        </div>
      </div>

      <RunStatusBanner runStatus={runStatus} onRefreshReport={() => { loadReport(); setTab('report'); }} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Accounts',        val: creds.length,                  color: '#0f172a' },
          { label: 'Active',          val: activeCreds.length,            color: '#22c55e' },
          { label: 'Treks in report', val: report?.treks?.length ?? '—',  color: BRAND },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-2xl font-black tabular-nums" style={{ color }}>{val}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {[{ k: 'report', l: 'Audit Report' }, { k: 'accounts', l: 'Accounts' }, { k: 'run', l: 'Run Audit' }].map(({ k, l }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${tab === k ? 'text-white shadow-sm' : 'text-slate-500 bg-white border border-slate-200 hover:bg-slate-50'}`}
            style={tab === k ? { background: BRAND } : {}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── REPORT TAB ──────────────────────────────────────────────────────── */}
      {tab === 'report' && (
        <div className="space-y-3">
          {!displayReport ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${BRAND}12` }}>🎫</div>
              <p className="font-bold text-slate-700">No audit report yet</p>
              <p className="text-sm text-slate-400 text-center max-w-xs">Click <strong>Run Audit</strong> to start.</p>
              <button onClick={startAudit} disabled={running || activeCreds.length === 0}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                style={{ background: BRAND }}>
                {running ? <><Loader2 size={12} className="animate-spin" /> Running…</> : <><Play size={12} /> Run Audit</>}
              </button>
            </div>
          ) : (
            <>
              {/* History run picker */}
              {history.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-2.5 flex items-center gap-2 flex-wrap">
                  <History size={13} className="text-slate-400 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">History</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setActiveRunId('latest'); setActiveReport(report); }}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${activeRunId === 'latest' ? 'text-white' : 'text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100'}`}
                      style={activeRunId === 'latest' ? { background: BRAND } : {}}>
                      Latest
                    </button>
                    {history.map(run => (
                      <button key={run.id}
                        onClick={() => { setActiveRunId(run.id); setActiveReport(run); }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${activeRunId === run.id ? 'text-white' : 'text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100'}`}
                        style={activeRunId === run.id ? { background: BRAND } : {}}>
                        {new Date(run.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        <span className="ml-1 opacity-60">({run.totalTickets}t)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Last run summary */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500">{activeRunId === 'latest' ? 'Last audit' : 'Historical run'}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmtDt(displayReport?.generatedAt)}</p>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-lg font-black text-slate-900">{displayReport?.successAccounts}</p>
                    <p className="text-[10px] text-slate-400">Logged in</p>
                  </div>
                  <div>
                    <p className="text-lg font-black" style={{ color: displayReport?.failedAccounts?.length ? '#ef4444' : '#22c55e' }}>
                      {displayReport?.failedAccounts?.length ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-400">Failed</p>
                  </div>
                  <div>
                    <p className="text-lg font-black" style={{ color: BRAND }}>
                      {displayReport?.treks?.reduce((s, t) => s + (t.totalTickets || 0), 0) ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-400">Tickets</p>
                  </div>
                </div>
              </div>

              {displayReport?.failedAccounts?.length > 0 && (
                <div className="bg-red-50 rounded-2xl border border-red-100 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-red-600">
                      Failed logins ({displayReport?.failedAccounts?.length})
                    </p>
                    <button
                      onClick={retryFailed}
                      disabled={running || retrying}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-all"
                    >
                      {retrying
                        ? <><Loader2 size={11} className="animate-spin" /> Retrying…</>
                        : <><RefreshCw size={11} /> Retry Failed ({displayReport?.failedAccounts?.length})</>}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {displayReport?.failedAccounts?.map(f => {
                      const email = typeof f === 'string' ? f : f.email;
                      const label = typeof f === 'string' ? '' : f.label;
                      const error = typeof f === 'string' ? '' : f.error;
                      return (
                        <div key={email} className="flex items-start gap-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium whitespace-nowrap">
                            {label || email}
                          </span>
                          {error && (
                            <span className="text-[11px] text-red-400 italic leading-5 break-all">{error}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* retriedAt badge */}
              {displayReport?.retriedAt && (
                <p className="text-[11px] text-slate-400 text-center">
                  Last retried: {fmtDt(displayReport?.retriedAt)}
                </p>
              )}

              {/* ── Search + Filter + Sort bar ─────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-2.5">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search trek, ticket ID, visitor name, mobile…"
                    className="w-full h-9 pl-8 pr-8 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-orange-300"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter row */}
                <div className="flex flex-wrap gap-2">
                  {/* Trek name */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Trek</label>
                    <select value={filterTrek} onChange={e => setFilterTrek(e.target.value)}
                      className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs bg-slate-50 focus:outline-none">
                      <option value="">All treks</option>
                      {trekNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {/* Date */}
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                    <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
                      className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs bg-slate-50 focus:outline-none">
                      <option value="">All dates</option>
                      {dates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  {/* Account */}
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account</label>
                    <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
                      className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs bg-slate-50 focus:outline-none">
                      <option value="">All accounts</option>
                      {accountOptions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  {/* Sort */}
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sort by</label>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                      className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs bg-slate-50 focus:outline-none">
                      <option value="date">Date</option>
                      <option value="name">Trek name</option>
                      <option value="tickets">Most tickets</option>
                      <option value="visitors">Most visitors</option>
                    </select>
                  </div>
                </div>

                {/* Results bar */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">
                      <strong className="text-slate-800">{filteredTreks.length}</strong> trek{filteredTreks.length !== 1 ? 's' : ''}
                      {' · '}<strong className="text-slate-800">{filteredTickets}</strong> tickets
                      {' · '}<strong className="text-blue-600">{filteredVisitors}</strong> visitors
                    </p>
                    {hasFilters && (
                      <button onClick={clearFilters}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5">
                        <X size={10} /> Clear filters
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* View toggle */}
                    <button onClick={() => setViewMode('cards')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${viewMode === 'cards' ? 'text-white border-transparent' : 'text-slate-400 border-slate-200 bg-slate-50'}`}
                      style={viewMode === 'cards' ? { background: BRAND } : {}}>
                      <LayoutList size={13} />
                    </button>
                    <button onClick={() => setViewMode('table')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${viewMode === 'table' ? 'text-white border-transparent' : 'text-slate-400 border-slate-200 bg-slate-50'}`}
                      style={viewMode === 'table' ? { background: BRAND } : {}}>
                      <Table2 size={13} />
                    </button>
                    {/* CSV export */}
                    <button onClick={() => exportCSV(filteredTreks)}
                      title="Export to CSV"
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                      <Download size={13} />
                    </button>
                  </div>
                </div>

                {/* Active filter chips */}
                {hasFilters && (
                  <div className="flex flex-wrap gap-1.5">
                    {filterTrek && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                        Trek: {filterTrek}
                        <button onClick={() => setFilterTrek('')}><X size={10} /></button>
                      </span>
                    )}
                    {filterDate && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Date: {filterDate}
                        <button onClick={() => setFilterDate('')}><X size={10} /></button>
                      </span>
                    )}
                    {filterAccount && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        Account: {filterAccount}
                        <button onClick={() => setFilterAccount('')}><X size={10} /></button>
                      </span>
                    )}
                    {search && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        "{search}"
                        <button onClick={() => setSearch('')}><X size={10} /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Trek list or summary table */}
              {filteredTreks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center">
                  <p className="font-bold text-slate-700">No results</p>
                  <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or search.</p>
                  <button onClick={clearFilters} className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: BRAND }}>Clear filters</button>
                </div>
              ) : viewMode === 'table' ? (
                <SummaryTable treks={filteredTreks} />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    {filteredTreks.length} trek slot{filteredTreks.length !== 1 ? 's' : ''} with bookings
                  </p>
                  {filteredTreks.map((trek, i) => (
                    <TrekReportCard key={`${trek.trekName}-${trek.date}-${i}`} trek={trek} defaultExpanded={!!search} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ACCOUNTS TAB ────────────────────────────────────────────────────── */}
      {tab === 'accounts' && (() => {
        const filteredCreds = creds.filter(c => {
          const q = acctSearch.toLowerCase();
          return !q || (c.label || '').toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
        });
        const allFiltered = filteredCreds.map(c => c.email);
        const allSelected = allFiltered.length > 0 && allFiltered.every(e => selectedAccts.has(e));
        const toggleAll = () => {
          if (allSelected) setSelectedAccts(s => { const n = new Set(s); allFiltered.forEach(e => n.delete(e)); return n; });
          else setSelectedAccts(s => { const n = new Set(s); allFiltered.forEach(e => n.add(e)); return n; });
        };
        return (
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                <input value={acctSearch} onChange={e => setAcctSearch(e.target.value)}
                  placeholder="Search accounts…"
                  className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-300" />
              </div>
              <p className="text-xs text-slate-400 font-semibold whitespace-nowrap">
                {creds.length} accounts{selectedAccts.size > 0 ? ` · ${selectedAccts.size} selected` : ''}
              </p>
              {selectedAccts.size > 0 && (
                <button onClick={() => setSelectedAccts(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                  <X size={11} /> Clear
                </button>
              )}
              {selectedAccts.size > 0 && (
                <button onClick={runSelected} disabled={running || retrying || runningSelected}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all"
                  style={{ background: BRAND }}>
                  {runningSelected
                    ? <><Loader2 size={12} className="animate-spin" /> Running…</>
                    : <><ListChecks size={12} /> Run Selected ({selectedAccts.size})</>}
                </button>
              )}
              <button onClick={() => { setEditingCred(null); setCredDialog(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white ml-auto"
                style={{ background: BRAND }}>
                <Plus size={12} /> Add Account
              </button>
            </div>

            {creds.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3">
                <span className="text-3xl">🔐</span>
                <p className="font-bold text-slate-700">No accounts yet</p>
                <p className="text-sm text-slate-400">Add Aranya Vihaara login credentials to get started.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Select-all row */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/60">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-orange-500 transition-colors">
                    {allSelected ? <CheckSquare size={15} style={{ color: BRAND }} /> : <Square size={15} />}
                  </button>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {allSelected ? 'Deselect all' : `Select all${acctSearch ? ' filtered' : ''} (${filteredCreds.length})`}
                  </p>
                </div>
                {filteredCreds.map((cred, i) => (
                  <div key={cred.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors ${i < filteredCreds.length - 1 ? 'border-b border-slate-50' : ''} ${selectedAccts.has(cred.email) ? 'bg-orange-50/40' : ''}`}
                    onClick={() => setSelectedAccts(s => { const n = new Set(s); n.has(cred.email) ? n.delete(cred.email) : n.add(cred.email); return n; })}>
                    <button className="flex-shrink-0 text-slate-300 hover:text-orange-500 transition-colors"
                      onClick={e => { e.stopPropagation(); setSelectedAccts(s => { const n = new Set(s); n.has(cred.email) ? n.delete(cred.email) : n.add(cred.email); return n; })}}>
                      {selectedAccts.has(cred.email)
                        ? <CheckSquare size={15} style={{ color: BRAND }} />
                        : <Square size={15} />}
                    </button>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: cred.active !== false ? `linear-gradient(135deg, ${BRAND}, #f97316)` : '#cbd5e1' }}>
                      {(cred.label || cred.email)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{cred.label || cred.email}</p>
                      <p className="text-[11px] text-slate-400 truncate">{cred.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {cred.active === false && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">Inactive</span>
                      )}
                      <button onClick={() => { setEditingCred(cred); setCredDialog(true); }}
                        className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <Edit2 size={11} />
                      </button>
                      <button onClick={() => deleteCred(cred.id)} disabled={deleting === cred.id}
                        className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100">
                        {deleting === cred.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── RUN AUDIT TAB ───────────────────────────────────────────────────── */}
      {tab === 'run' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-black text-slate-900 text-base">Run Full Audit</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  Logs into all <strong className="text-slate-700">{activeCreds.length} active accounts</strong>,
                  scrapes upcoming bookings, and saves the report automatically.
                </p>
              </div>
              <button onClick={startAudit} disabled={running || activeCreds.length === 0}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
                style={{ background: BRAND }}>
                {running ? <><Loader2 size={14} className="animate-spin" /> Running…</> : <><Play size={14} /> Start</>}
              </button>
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
              <label className="text-xs font-semibold text-slate-500">Parallel accounts</label>
              <div className="flex gap-1.5">
                {[10, 20, 50].map(n => (
                  <button key={n} onClick={() => setConcurrency(n)}
                    className={`w-9 h-7 rounded-lg text-xs font-bold border transition-all ${concurrency === n ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                    style={concurrency === n ? { background: BRAND } : {}}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">accounts at a time (20 is default)</p>
            </div>
          </div>

          <RunStatusBanner runStatus={runStatus} onRefreshReport={() => { loadReport(); setTab('report'); }} />

          {/* Admin: clear report */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-700">Clear Report</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wipes the current report so the next run starts completely fresh.
                  {!report && <span className="text-slate-300"> (No report to clear)</span>}
                </p>
              </div>
              <button
                onClick={clearReport}
                disabled={running || retrying || clearing || !report}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 disabled:opacity-40 transition-all"
              >
                {clearing ? <><Loader2 size={12} className="animate-spin" /> Clearing…</> : <><Trash2 size={12} /> Clear Report</>}
              </button>
            </div>
          </div>

          {/* Admin: clear all history */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-700">Clear All History</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deletes all saved run history entries. The current report is kept.
                  {history.length === 0 && <span className="text-slate-300"> (No history to clear)</span>}
                </p>
              </div>
              <button
                onClick={clearAllHistory}
                disabled={running || retrying || runningSelected || history.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100 disabled:opacity-40 transition-all"
              >
                <Trash2 size={12} /> Clear All History
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">How it works</p>
            <div className="space-y-2.5">
              {[
                { n: '1', t: 'Loads credentials from Firestore', d: 'All active accounts in the Accounts tab' },
                { n: '2', t: 'Logs into each account via HTTP', d: 'Fast HTTP login — no browser required, CAPTCHA is client-side only' },
                { n: '3', t: 'Scrapes all booking pages', d: 'Reads visitor tables directly from HTML — no clicking needed' },
                { n: '4', t: 'Saves report to Firestore', d: 'Results appear instantly in the Audit Report tab with full filtering' },
              ].map(({ n, t, d }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5"
                    style={{ background: BRAND }}>{n}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t}</p>
                    <p className="text-xs text-slate-400">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <CredentialDialog
        open={credDialog}
        editing={editingCred}
        onClose={() => { setCredDialog(false); setEditingCred(null); }}
        onSaved={load}
      />
    </div>
  );
}
