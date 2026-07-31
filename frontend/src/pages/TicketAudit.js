import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/utils/api';
import { toast } from 'sonner';
import {
  Plus, Trash2, RefreshCw, Eye, EyeOff, Users,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight,
  Ticket, MapPin, Calendar, Clock, Edit2, ToggleLeft, ToggleRight,
  Play, AlertCircle,
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
function TrekReportCard({ trek }) {
  const [expanded, setExpanded] = useState(false);
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

// ── Run status banner ──────────────────────────────────────────────────────────
function RunStatusBanner({ runStatus, onRefreshReport }) {
  if (!runStatus || runStatus.status === 'idle') return null;

  const { status, message, done = 0, total = 0 } = runStatus;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (status === 'running') {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={14} className="animate-spin text-blue-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-blue-800">Audit in progress…</p>
        </div>
        <p className="text-xs text-blue-600 mb-2">{message}</p>
        {total > 0 && (
          <div className="w-full bg-blue-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: '#3b82f6' }} />
          </div>
        )}
        {total > 0 && (
          <p className="text-[11px] text-blue-400 mt-1 text-right">{done}/{total}</p>
        )}
      </div>
    );
  }

  if (status === 'done') {
    return (
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
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-start gap-3">
        <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700">Audit failed</p>
          <p className="text-xs text-red-500">{message}</p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TicketAudit() {
  const [tab, setTab] = useState('report');
  const [creds, setCreds] = useState([]);
  const [report, setReport] = useState(null);
  const [runStatus, setRunStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [credDialog, setCredDialog] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [concurrency, setConcurrency] = useState(3);
  const pollRef = useRef(null);

  const loadReport = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/report');
      setReport(res.data?.generatedAt ? res.data : null);
    } catch {}
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/run/status');
      const s = res.data;
      setRunStatus(s);
      if (s?.status === 'running') {
        setRunning(true);
      } else {
        setRunning(false);
        if (s?.status === 'done') {
          loadReport();
        }
      }
    } catch {}
  }, [loadReport]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [credsRes] = await Promise.all([
        api.get('/ticket-audit/credentials'),
        loadReport(),
        loadStatus(),
      ]);
      setCreds(credsRes.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [loadReport, loadStatus]);

  // Poll status every 4s while running
  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(loadStatus, 4000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [running, loadStatus]);

  useEffect(() => { load(); }, [load]);

  const startAudit = async () => {
    if (running) return;
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
          <button
            onClick={startAudit}
            disabled={running || activeCreds.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: BRAND }}>
            {running
              ? <><Loader2 size={14} className="animate-spin" /> Running…</>
              : <><Play size={14} /> Run Audit</>}
          </button>
        </div>
      </div>

      {/* Run status banner — shows when audit is running or just finished */}
      <RunStatusBanner
        runStatus={runStatus}
        onRefreshReport={() => { loadReport(); setTab('report'); }}
      />

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
          {!report ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: `${BRAND}12` }}>🎫</div>
              <p className="font-bold text-slate-700">No audit report yet</p>
              <p className="text-sm text-slate-400 text-center max-w-xs">
                Click <strong>Run Audit</strong> at the top to start automatically checking all accounts.
              </p>
              <button onClick={startAudit} disabled={running || activeCreds.length === 0}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                style={{ background: BRAND }}>
                {running ? <><Loader2 size={12} className="animate-spin" /> Running…</> : <><Play size={12} /> Run Audit</>}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500">Last audit</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmtDt(report.generatedAt)}</p>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-lg font-black text-slate-900">{report.successAccounts}</p>
                    <p className="text-[10px] text-slate-400">Logged in</p>
                  </div>
                  <div>
                    <p className="text-lg font-black" style={{ color: report.failedAccounts?.length ? '#ef4444' : '#22c55e' }}>
                      {report.failedAccounts?.length ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-400">Failed</p>
                  </div>
                  <div>
                    <p className="text-lg font-black" style={{ color: BRAND }}>
                      {report.treks?.reduce((s, t) => s + (t.totalTickets || 0), 0)}
                    </p>
                    <p className="text-[10px] text-slate-400">Tickets</p>
                  </div>
                </div>
              </div>

              {report.failedAccounts?.length > 0 && (
                <div className="bg-red-50 rounded-2xl border border-red-100 px-4 py-3">
                  <p className="text-xs font-bold text-red-600 mb-2">Failed logins ({report.failedAccounts.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.failedAccounts.map(e => (
                      <span key={e} className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {report.treks?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center">
                  <p className="font-bold text-slate-700">No upcoming bookings found</p>
                  <p className="text-sm text-slate-400 mt-1">All accounts have no upcoming treks.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    {report.treks?.length} trek{report.treks?.length !== 1 ? 's' : ''} with bookings
                  </p>
                  {report.treks?.map((trek, i) => <TrekReportCard key={i} trek={trek} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ACCOUNTS TAB ────────────────────────────────────────────────────── */}
      {tab === 'accounts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-semibold">{creds.length} account{creds.length !== 1 ? 's' : ''} saved</p>
            <button onClick={() => { setEditingCred(null); setCredDialog(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
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
              {creds.map((cred, i) => (
                <div key={cred.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < creds.length - 1 ? 'border-b border-slate-50' : ''}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                    style={{ background: cred.active !== false ? `linear-gradient(135deg, ${BRAND}, #f97316)` : '#cbd5e1' }}>
                    {(cred.label || cred.email)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{cred.label || cred.email}</p>
                    <p className="text-[11px] text-slate-400 truncate">{cred.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
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
      )}

      {/* ── RUN AUDIT TAB ───────────────────────────────────────────────────── */}
      {tab === 'run' && (
        <div className="space-y-3">

          {/* Big run card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-black text-slate-900 text-base">Run Full Audit</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  Logs into all <strong className="text-slate-700">{activeCreds.length} active accounts</strong>,
                  scrapes upcoming bookings, and saves the report automatically.
                </p>
              </div>
              <button
                onClick={startAudit}
                disabled={running || activeCreds.length === 0}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
                style={{ background: BRAND }}>
                {running
                  ? <><Loader2 size={14} className="animate-spin" /> Running…</>
                  : <><Play size={14} /> Start</>}
              </button>
            </div>

            {/* Concurrency selector */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
              <label className="text-xs font-semibold text-slate-500">Parallel accounts</label>
              <div className="flex gap-1.5">
                {[2, 3, 5].map(n => (
                  <button key={n} onClick={() => setConcurrency(n)}
                    className={`w-8 h-7 rounded-lg text-xs font-bold border transition-all ${concurrency === n ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                    style={concurrency === n ? { background: BRAND } : {}}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">accounts at a time (3 is safe default)</p>
            </div>
          </div>

          {/* Live status */}
          <RunStatusBanner
            runStatus={runStatus}
            onRefreshReport={() => { loadReport(); setTab('report'); }}
          />

          {/* How it works */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">How it works</p>
            <div className="space-y-2.5">
              {[
                { n: '1', t: 'Loads credentials from Firestore', d: 'All active accounts in the Accounts tab' },
                { n: '2', t: 'Logs into each account', d: 'Playwright browser running on the server + DOM/OCR to solve CAPTCHAs' },
                { n: '3', t: 'Scrapes upcoming treks', d: 'Clicks "View Visitors" for every booking and extracts the visitor table' },
                { n: '4', t: 'Saves report', d: 'Results appear in the Audit Report tab as soon as it finishes' },
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

          {/* Note about CAPTCHA */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
            <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700 mb-1">About CAPTCHA</p>
              <p className="text-xs text-amber-700">
                The server reads the CAPTCHA text directly from the page DOM — no OCR needed in most cases.
                Accounts where CAPTCHA solving fails will appear in the "Failed logins" list and can be re-audited by running again.
              </p>
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
