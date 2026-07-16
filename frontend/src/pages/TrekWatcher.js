import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Square, Plus, RefreshCw, AlertTriangle, Bell, Trash2, Phone, CheckSquare } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';

const STATUS_PILL = {
  starting:  'bg-slate-100 text-slate-500',
  running:   'bg-blue-100 text-blue-700',
  available: 'bg-green-100 text-green-700',
  done:      'bg-slate-100 text-slate-400',
  stopped:   'bg-red-50 text-red-500',
};

const STOPPABLE = new Set(['starting', 'running', 'available']);
const MAX_NUMBERS = 5;

export default function TrekWatcher() {
  const [districts, setDistricts]         = useState([]);
  const [treks, setTreks]                 = useState([]);
  const [watchers, setWatchers]           = useState([]);
  const [loadingTreks, setLoadingTreks]   = useState(false);
  const [starting, setStarting]           = useState(false);

  // Notify numbers state
  const [notifyNumbers, setNotifyNumbers] = useState([]);
  const [numInput, setNumInput]           = useState('');
  const [savingNums, setSavingNums]       = useState(false);
  const [testing, setTesting]             = useState(false);
  const [lastAlert, setLastAlert]         = useState(null);
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [clearing, setClearing]           = useState(false);

  const [form, setForm] = useState({
    district_id:    '',
    trek_id:        '',
    trek_name:      '',
    date:           '',
    duration_hours: 2,
    interval_secs:  60,
  });

  // Load districts + notify settings on mount
  useEffect(() => {
    api.get('/trek-watcher/districts')
      .then(r => setDistricts(r.data))
      .catch(() => toast.error('Could not load districts'));

    api.get('/trek-watcher/settings')
      .then(r => setNotifyNumbers(r.data.notify_numbers || []))
      .catch(() => {});
  }, []);

  // Poll watcher status + last alert every 5 s
  const fetchStatus = useCallback(() => {
    api.get('/trek-watcher/status')
      .then(r => setWatchers(r.data))
      .catch(() => {});
    api.get('/trek-watcher/last-alert')
      .then(r => setLastAlert(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  // ── Trek district change ───────────────────────────────────────────────────
  const onDistrictChange = async (id) => {
    setForm(f => ({ ...f, district_id: id, trek_id: '', trek_name: '' }));
    setTreks([]);
    if (!id) return;
    setLoadingTreks(true);
    try {
      const r = await api.get(`/trek-watcher/treks/${id}`);
      setTreks(r.data);
    } catch {
      toast.error('Failed to load treks for this district');
    } finally {
      setLoadingTreks(false);
    }
  };

  const onTrekChange = (id) => {
    const trek = treks.find(t => t.id === id);
    setForm(f => ({ ...f, trek_id: id, trek_name: trek?.name || '' }));
  };

  // ── Start watcher ─────────────────────────────────────────────────────────
  const startWatcher = async () => {
    const { district_id, trek_id, date, duration_hours, interval_secs } = form;
    if (!district_id || !trek_id || !date) {
      toast.error('Select a district, trek, and date first');
      return;
    }
    const [y, m, d] = date.split('-');
    const dateDMY = `${d}-${m}-${y}`;

    setStarting(true);
    try {
      await api.post('/trek-watcher/start', {
        ...form,
        date:           dateDMY,
        duration_hours: Number(duration_hours),
        interval_secs:  Number(interval_secs),
      });
      toast.success('Watcher started!');
      fetchStatus();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start watcher');
    } finally {
      setStarting(false);
    }
  };

  const stopWatcher = async (job_id) => {
    try {
      await api.delete(`/trek-watcher/stop/${job_id}`);
      toast.success('Watcher stopped');
      fetchStatus();
    } catch {
      toast.error('Could not stop watcher');
    }
  };

  // ── Select / clear ───────────────────────────────────────────────────────
  const toggleSelect = (job_id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(job_id) ? next.delete(job_id) : next.add(job_id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === watchers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(watchers.map(w => w.job_id)));
    }
  };

  const clearSelected = async () => {
    if (selectedIds.size === 0) return;
    setClearing(true);
    try {
      await Promise.all(
        [...selectedIds].map(id => api.delete(`/trek-watcher/history/${id}`))
      );
      setSelectedIds(new Set());
      toast.success(`Cleared ${selectedIds.size} watcher(s)`);
      fetchStatus();
    } catch {
      toast.error('Failed to clear some watchers');
    } finally {
      setClearing(false);
    }
  };

  // ── Notify numbers ────────────────────────────────────────────────────────
  const addNumber = () => {
    const digits = numInput.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    if (notifyNumbers.length >= MAX_NUMBERS) {
      toast.error(`Maximum ${MAX_NUMBERS} numbers allowed`);
      return;
    }
    if (notifyNumbers.includes(numInput.trim())) {
      toast.error('Number already added');
      return;
    }
    setNotifyNumbers(n => [...n, numInput.trim()]);
    setNumInput('');
  };

  const removeNumber = (idx) => {
    setNotifyNumbers(n => n.filter((_, i) => i !== idx));
  };

  const saveNumbers = async () => {
    // Auto-add whatever is still in the input field before saving
    let toSave = [...notifyNumbers];
    if (numInput.trim()) {
      const digits = numInput.replace(/\D/g, '');
      if (digits.length >= 10 && toSave.length < MAX_NUMBERS && !toSave.includes(numInput.trim())) {
        toSave = [...toSave, numInput.trim()];
        setNotifyNumbers(toSave);
        setNumInput('');
      }
    }
    if (toSave.length === 0) {
      toast.error('Add at least one number before saving');
      return;
    }
    setSavingNums(true);
    try {
      await api.put('/trek-watcher/settings', { notify_numbers: toSave });
      toast.success(`Saved ${toSave.length} number(s)!`);
    } catch {
      toast.error('Failed to save numbers');
    } finally {
      setSavingNums(false);
    }
  };

  const testWhatsApp = async () => {
    if (notifyNumbers.length === 0) {
      toast.error('Add and save at least one number first');
      return;
    }
    setTesting(true);
    try {
      const r = await api.post('/trek-watcher/test-whatsapp');
      toast.success(`Test message sent to ${r.data.sent_to.length} number(s)!`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Test failed — check backend logs');
    } finally {
      setTesting(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const activeCount  = watchers.filter(w => STOPPABLE.has(w.status)).length;
  const alertWatchers = watchers.filter(w => w.status === 'available');

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 heading-font">Trek Ticket Watcher</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor Aranya Vihaara availability — WhatsApp alert fires when tickets open
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {activeCount} watching
            </span>
          )}
          <button
            onClick={fetchStatus}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {alertWatchers.length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-800 font-semibold text-sm">Tickets Available!</p>
            {alertWatchers.map(w => (
              <p key={w.job_id} className="text-green-700 text-sm mt-0.5">
                {w.trek_name} on {w.date} — {w.last_info}
              </p>
            ))}
            <a
              href="https://aranyavihaara.karnataka.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm font-medium text-green-700 underline"
            >
              Book now →
            </a>
          </div>
        </div>
      )}

      {/* Last Successful Alert card */}
      <div className={`rounded-xl border p-4 flex items-start gap-4 ${lastAlert ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex-shrink-0 mt-0.5">
          <Bell size={18} className={lastAlert ? 'text-green-500' : 'text-slate-300'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Successful Alert</p>
          {lastAlert ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-sm font-semibold text-slate-800">{lastAlert.trek_name}</span>
              <span className="text-xs text-slate-500 font-mono">{lastAlert.date}</span>
              <span className="text-sm font-bold text-green-700">{lastAlert.slots_info}</span>
              <span className="text-xs text-slate-400">{fmtDateTime(lastAlert.alerted_at)}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No alert sent yet</p>
          )}
        </div>
      </div>

      {/* Two-column row: Add Watcher + Notify Numbers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Add Watcher Form — takes 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Plus size={15} className="text-slate-400" />
            Add Watcher
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">District</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.district_id}
                onChange={e => onDistrictChange(e.target.value)}
              >
                <option value="">Select district…</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Trek</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                value={form.trek_id}
                onChange={e => onTrekChange(e.target.value)}
                disabled={!form.district_id || loadingTreks}
              >
                <option value="">{loadingTreks ? 'Loading…' : 'Select trek…'}</option>
                {treks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Watch for (hours)</label>
              <input
                type="number" min="0.5" max="12" step="0.5"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.duration_hours}
                onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Check every (seconds)</label>
              <input
                type="number" min="20" max="3600" step="10"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.interval_secs}
                onChange={e => setForm(f => ({ ...f, interval_secs: e.target.value }))}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={startWatcher}
                disabled={starting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Eye size={15} />
                {starting ? 'Starting…' : 'Start Watching'}
              </button>
            </div>
          </div>
        </div>

        {/* Notify Numbers — takes 1/3 width */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <Bell size={15} className="text-slate-400" />
            WhatsApp Alerts
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Send ticket alert to these numbers (max {MAX_NUMBERS})
          </p>

          {/* Number list */}
          <div className="flex-1 space-y-2 mb-4">
            {notifyNumbers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No numbers added yet</p>
            ) : (
              notifyNumbers.map((num, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <Phone size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 font-mono">{num}</span>
                  <button
                    onClick={() => removeNumber(i)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add number input */}
          {notifyNumbers.length < MAX_NUMBERS && (
            <div className="flex gap-2 mb-3">
              <input
                type="tel"
                placeholder="9876543210"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={numInput}
                onChange={e => setNumInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNumber()}
              />
              <button
                onClick={addNumber}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors"
              >
                <Plus size={15} />
              </button>
            </div>
          )}

          <button
            onClick={saveNumbers}
            disabled={savingNums}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {savingNums ? 'Saving…' : 'Save Numbers'}
          </button>

          <button
            onClick={testWhatsApp}
            disabled={testing || notifyNumbers.length === 0}
            className="w-full mt-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-600 rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Bell size={14} />
            {testing ? 'Sending…' : 'Send Test Message'}
          </button>
        </div>
      </div>

      {/* Watcher Status Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Watchers
            {watchers.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400">({watchers.length})</span>
            )}
          </h2>
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelected}
              disabled={clearing}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
            >
              <Trash2 size={13} />
              {clearing ? 'Clearing…' : `Clear ${selectedIds.size} selected`}
            </button>
          )}
        </div>

        {watchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Eye size={36} className="mb-3" />
            <p className="text-sm text-slate-400">No watchers yet. Add one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="pl-4 pr-2 py-3">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                      {selectedIds.size === watchers.length && watchers.length > 0
                        ? <CheckSquare size={15} className="text-blue-500" />
                        : <Square size={15} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Trek</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last Result</th>
                  <th className="px-4 py-3 text-left font-medium">Checks</th>
                  <th className="px-4 py-3 text-left font-medium">Last Checked</th>
                  <th className="px-4 py-3 text-left font-medium">Every</th>
                  <th className="px-4 py-3 text-left font-medium">Alerted</th>
                  <th className="px-4 py-3 text-left font-medium">By</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {watchers.map(w => (
                  <tr
                    key={w.job_id}
                    className={`transition-colors ${selectedIds.has(w.job_id) ? 'bg-blue-50' : w.status === 'available' ? 'bg-green-50' : 'hover:bg-slate-50/50'}`}
                  >
                    <td className="pl-4 pr-2 py-3">
                      <button onClick={() => toggleSelect(w.job_id)} className="text-slate-300 hover:text-blue-500">
                        {selectedIds.has(w.job_id)
                          ? <CheckSquare size={15} className="text-blue-500" />
                          : <Square size={15} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{w.trek_name}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{w.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[w.status] || 'bg-slate-100 text-slate-400'}`}>
                        {w.status === 'running' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        {w.status === 'available' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        )}
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {w.status === 'available' ? (
                        <span className="font-semibold text-green-700">{w.last_info}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">{w.last_info || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{w.checks}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{fmtTime(w.last_checked)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{w.interval}s</td>
                    <td className="px-4 py-3">
                      {w.last_alerted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Bell size={11} /> {fmtTime(w.last_alerted)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[90px]">{w.started_by}</td>
                    <td className="px-4 py-3">
                      {STOPPABLE.has(w.status) && (
                        <button
                          onClick={() => stopWatcher(w.job_id)}
                          className="p-1.5 rounded-md hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                          title="Stop watcher"
                        >
                          <Square size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
