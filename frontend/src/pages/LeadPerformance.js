import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users, Trophy, AlertTriangle, Search,
  TrendingUp, Mountain, Calendar, Phone,
  ChevronDown, ChevronUp, Activity, Clock,
} from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'completed-desc', label: 'Most Completed' },
  { value: 'total-desc',     label: 'Most Assigned'  },
  { value: 'treks-desc',     label: 'Most Trek Types' },
  { value: 'name-asc',       label: 'Name A–Z'       },
  { value: 'inactive-first', label: 'Inactive First'  },
];

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const STATUS_STYLE = {
  completed: 'bg-emerald-100 text-emerald-700',
  ongoing:   'bg-blue-100 text-blue-700',
  upcoming:  'bg-amber-100 text-amber-700',
};

function RecentBatches({ batches }) {
  if (!batches?.length) return (
    <div className="px-4 pb-3 pt-2 text-xs text-slate-400 border-t border-slate-100">
      No recent batches
    </div>
  );
  return (
    <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-1.5">
      {batches.map((b, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-700 truncate flex-1 min-w-0">{b.trekName || 'Trek'}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">{fmt(b.startDate)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[b.status] || 'bg-slate-100 text-slate-600'}`}>
            {b.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function LeadRow({ lead, globalRank }) {
  const [open, setOpen] = useState(false);
  const days = daysSince(lead.lastBatchDate);
  const pct  = lead.totalBatches > 0
    ? Math.round((lead.completedBatches / lead.totalBatches) * 100) : 0;

  const rankLabel = globalRank === 0 ? '🥇' : globalRank === 1 ? '🥈' : globalRank === 2 ? '🥉' : `#${globalRank + 1}`;

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-md ${
      lead.inactive ? 'border-red-200' : 'border-slate-200'
    }`}>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Rank */}
        <span className="w-7 text-center text-sm font-semibold text-slate-400 flex-shrink-0">
          {rankLabel}
        </span>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                        flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {lead.displayName.charAt(0).toUpperCase()}
        </div>

        {/* Name + email */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 text-sm truncate">{lead.displayName}</p>
          {lead.email && <p className="text-xs text-slate-400 truncate">{lead.email}</p>}
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
          <div className="text-center w-14">
            <p className="text-lg font-bold text-emerald-600">{lead.completedBatches}</p>
            <p className="text-xs text-slate-400">Done</p>
          </div>
          <div className="text-center w-14">
            <p className="text-lg font-bold text-indigo-600">{lead.totalBatches}</p>
            <p className="text-xs text-slate-400">Total</p>
          </div>
          <div className="text-center w-16">
            <p className="text-lg font-bold text-amber-600">{lead.uniqueTreks}</p>
            <p className="text-xs text-slate-400">Treks</p>
          </div>
          <div className="w-20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-1.5 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status + last active */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {lead.inactive ? (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} />
              {days !== null ? `${days}d inactive` : 'Inactive'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Activity size={10} /> Active
            </span>
          )}
          {lead.lastBatchDate && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={9} /> {fmt(lead.lastBatchDate)}
            </span>
          )}
        </div>

        {/* Phone */}
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="text-slate-300 hover:text-indigo-500 flex-shrink-0" title={lead.phone}>
            <Phone size={15} />
          </a>
        )}

        {/* Expand */}
        <button
          onClick={() => setOpen(v => !v)}
          className="text-slate-300 hover:text-slate-600 flex-shrink-0"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Mobile stats */}
      <div className="sm:hidden flex items-center gap-4 px-4 pb-3 text-center">
        <div className="flex-1"><p className="text-base font-bold text-emerald-600">{lead.completedBatches}</p><p className="text-xs text-slate-400">Done</p></div>
        <div className="flex-1"><p className="text-base font-bold text-indigo-600">{lead.totalBatches}</p><p className="text-xs text-slate-400">Total</p></div>
        <div className="flex-1"><p className="text-base font-bold text-amber-600">{lead.uniqueTreks}</p><p className="text-xs text-slate-400">Treks</p></div>
        <div className="flex-1"><p className="text-base font-bold text-blue-600">{pct}%</p><p className="text-xs text-slate-400">Done%</p></div>
      </div>

      {open && <RecentBatches batches={lead.recentBatches} />}
    </div>
  );
}

export default function LeadPerformance() {
  const [leads, setLeads]   = useState([]);
  const [loading, setLoad]  = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState('completed-desc');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/analytics/lead-performance')
      .then(r => setLeads(r.data))
      .catch(() => toast.error('Failed to load performance data'))
      .finally(() => setLoad(false));
  }, []);

  // Compute global rank order (by completedBatches) before any filter/search
  const globalRankMap = useMemo(() => {
    const sorted = [...leads].sort((a, b) => b.completedBatches - a.completedBatches);
    const map = {};
    sorted.forEach((l, i) => { map[l.userId] = i; });
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    let list = [...leads];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.displayName.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'active')   list = list.filter(l => !l.inactive);
    if (filter === 'inactive') list = list.filter(l => l.inactive);

    switch (sort) {
      case 'completed-desc': list.sort((a, b) => b.completedBatches - a.completedBatches); break;
      case 'total-desc':     list.sort((a, b) => b.totalBatches - a.totalBatches); break;
      case 'treks-desc':     list.sort((a, b) => b.uniqueTreks - a.uniqueTreks); break;
      case 'name-asc':       list.sort((a, b) => a.displayName.localeCompare(b.displayName)); break;
      case 'inactive-first': list.sort((a, b) => Number(b.inactive) - Number(a.inactive)); break;
      default: break;
    }
    return list;
  }, [leads, search, sort, filter]);

  const totalLeads    = leads.length;
  const activeLeads   = leads.filter(l => !l.inactive).length;
  const inactiveLeads = leads.filter(l => l.inactive).length;
  const totalDone     = leads.reduce((s, l) => s + l.completedBatches, 0);
  // Top lead = highest completed batches (only if > 0)
  const topLead = [...leads].sort((a, b) => b.completedBatches - a.completedBatches)
    .find(l => l.completedBatches > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 heading-font">Lead Performance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Trek lead activity, batch completion and availability</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users,         label: 'Total Leads',    value: totalLeads,    color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
          { icon: Activity,      label: 'Active (30d)',   value: activeLeads,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: AlertTriangle, label: 'Inactive (30d)', value: inactiveLeads, color: 'text-red-500',     bg: 'bg-red-50'     },
          { icon: Trophy,        label: 'Batches Done',   value: totalDone,     color: 'text-amber-600',   bg: 'bg-amber-50'   },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
                <Icon size={17} className={color} />
              </div>
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top performer banner — only when someone has completions */}
      {topLead && (
        <div className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-5 py-3">
          <span className="text-2xl">🏆</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Top Performer</p>
            <p className="font-bold text-slate-800">{topLead.displayName}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-4 text-center flex-shrink-0">
            <div>
              <p className="text-lg font-bold text-emerald-600">{topLead.completedBatches}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-indigo-600">{topLead.totalBatches}</p>
              <p className="text-xs text-slate-500">Assigned</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600">{topLead.uniqueTreks}</p>
              <p className="text-xs text-slate-500">Trek Types</p>
            </div>
          </div>
        </div>
      )}

      {/* Column headers (desktop) */}
      <div className="hidden sm:flex items-center gap-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        <span className="w-7" />
        <span className="w-9" />
        <span className="flex-1">Name</span>
        <div className="flex items-center gap-6 flex-shrink-0">
          <span className="w-14 text-center">Done</span>
          <span className="w-14 text-center">Total</span>
          <span className="w-16 text-center">Treks</span>
          <span className="w-20 text-center">Completion</span>
        </div>
        <span className="w-28 text-right">Status</span>
        <span className="w-5" />
        <span className="w-4" />
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all',      label: `All (${totalLeads})`      },
            { key: 'active',   label: `Active (${activeLeads})`  },
            { key: 'inactive', label: `Inactive (${inactiveLeads})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white text-slate-700"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lead list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No leads found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <LeadRow
              key={lead.userId}
              lead={lead}
              globalRank={globalRankMap[lead.userId] ?? 99}
            />
          ))}
        </div>
      )}
    </div>
  );
}
