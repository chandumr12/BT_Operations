import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users, TrendingUp, AlertCircle, CheckCircle, Search,
  ArrowUpDown, ArrowUp, ArrowDown, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A–Z', icon: ArrowUp },
  { value: 'name-desc', label: 'Name Z–A', icon: ArrowDown },
  { value: 'tasks-desc', label: 'Most tasks', icon: ArrowDown },
  { value: 'tasks-asc', label: 'Fewest tasks', icon: ArrowUp },
  { value: 'workload-desc', label: 'Highest workload', icon: ArrowDown },
];

const WORKLOAD_LEVELS = [
  { max: 0,  level: 'Available',  color: 'text-emerald-700', bgColor: 'bg-emerald-50',  barColor: 'bg-emerald-500',  borderColor: 'border-emerald-200', rank: 0 },
  { max: 3,  level: 'Light',      color: 'text-blue-700',    bgColor: 'bg-blue-50',     barColor: 'bg-blue-500',     borderColor: 'border-blue-200',    rank: 1 },
  { max: 6,  level: 'Moderate',   color: 'text-amber-700',   bgColor: 'bg-amber-50',    barColor: 'bg-amber-500',    borderColor: 'border-amber-200',   rank: 2 },
  { max: 10, level: 'Heavy',      color: 'text-orange-700',  bgColor: 'bg-orange-50',   barColor: 'bg-orange-500',   borderColor: 'border-orange-200',  rank: 3 },
  { max: Infinity, level: 'Overloaded', color: 'text-red-700', bgColor: 'bg-red-50', barColor: 'bg-red-500', borderColor: 'border-red-200', rank: 4 },
];

const getWorkload = (totalTickets) => {
  if (totalTickets === 0) return WORKLOAD_LEVELS[0];
  return WORKLOAD_LEVELS.find(w => totalTickets <= w.max) || WORKLOAD_LEVELS[WORKLOAD_LEVELS.length - 1];
};

const PRIORITY_CONFIG = [
  { key: 'Urgent', bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
  { key: 'High',   bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  { key: 'Medium', bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  { key: 'Low',    bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
];

const AVATAR_GRADIENTS = [
  'from-blue-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-pink-600',
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
];

const getGradient = (name) => {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
};

const MAX_CAPACITY = 15;

// ─── Sub-components ─────────────────────────────────────────────────────────

const StatCard = ({ label, value, Icon, bg, fg, sub }) => (
  <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <CardContent className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-900 heading-font leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`${bg} ${fg} p-2.5 rounded-xl flex-shrink-0`}>
          <Icon size={18} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const CapacityBar = ({ totalTickets, barColor }) => {
  const pct = Math.min(Math.round((totalTickets / MAX_CAPACITY) * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Capacity</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>0</span>
        <span>{MAX_CAPACITY} tasks</span>
      </div>
    </div>
  );
};

const PriorityBreakdown = ({ byPriority }) => {
  const hasPriority = PRIORITY_CONFIG.some(p => byPriority?.[p.key] > 0);
  if (!hasPriority) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRIORITY_CONFIG.map(({ key, bg, text, dot }) =>
        byPriority?.[key] > 0 ? (
          <span key={key} className={`inline-flex items-center gap-1 ${bg} ${text} px-2 py-0.5 rounded-full text-xs font-medium`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {key}: {byPriority[key]}
          </span>
        ) : null
      )}
    </div>
  );
};

const MemberCard = ({ member, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const workload = getWorkload(member.totalTickets);
  const gradient = getGradient(member.assignee);
  const initials = member.assignee?.slice(0, 2).toUpperCase() || 'TM';

  return (
    <div className={`border rounded-xl transition-all duration-200 hover:shadow-md bg-white overflow-hidden ${workload.borderColor}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 md:gap-4 p-4 md:p-5">
        {/* Rank number */}
        <span className="text-sm font-medium text-slate-400 w-5 text-center flex-shrink-0">{idx + 1}</span>

        {/* Avatar */}
        <div className={`w-10 h-10 md:w-11 md:h-11 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
          {initials}
        </div>

        {/* Name + workload */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm md:text-base truncate">{member.assignee}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {member.totalTickets} active task{member.totalTickets !== 1 ? 's' : ''}
            {member.totalEstimatedHours > 0 && (
              <span className="ml-2 inline-flex items-center gap-0.5">
                <Clock size={10} className="opacity-60" />
                {member.totalEstimatedHours}h est.
              </span>
            )}
          </p>
        </div>

        {/* Workload badge */}
        <span className={`${workload.bgColor} ${workload.color} px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0`}>
          {workload.level}
        </span>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          aria-label="Toggle details"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Capacity bar (always visible) */}
      <div className="px-4 md:px-5 pb-4">
        <CapacityBar totalTickets={member.totalTickets} barColor={workload.barColor} />
      </div>

      {/* Expanded: priority breakdown */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 md:px-5 py-3 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Priority breakdown</p>
          {member.byPriority && Object.values(member.byPriority).some(v => v > 0) ? (
            <>
              <PriorityBreakdown byPriority={member.byPriority} />
              <div className="mt-3 flex gap-2">
                {PRIORITY_CONFIG.map(({ key, barColor: _b, dot }) => {
                  const count = member.byPriority?.[key] || 0;
                  const pct = member.totalTickets > 0 ? Math.round((count / member.totalTickets) * 100) : 0;
                  return (
                    <div key={key} className="flex-1">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                        <span>{key}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1">
                        <div
                          className={`h-full rounded-full ${dot}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">No priority data available</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const WorkloadDashboard = () => {
  const [workloadData, setWorkloadData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('tasks-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => { fetchWorkload(); }, []);

  const fetchWorkload = async () => {
    try {
      const response = await api.get('/tickets/analytics/workload');
      setWorkloadData(response.data);
    } catch {
      toast.error('Failed to load workload data');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ──
  const totalActiveTickets = workloadData.reduce((sum, w) => sum + w.totalTickets, 0);
  const avgTicketsPerPerson = workloadData.length > 0
    ? (totalActiveTickets / workloadData.length).toFixed(1) : 0;
  const overloadedMembers = workloadData.filter(w => w.totalTickets > 10).length;
  const availableMembers = workloadData.filter(w => w.totalTickets === 0).length;

  // ── Filter + sort ──
  const filtered = workloadData.filter(m =>
    !searchQuery || m.assignee?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':      return (a.assignee || '').localeCompare(b.assignee || '');
      case 'name-desc':     return (b.assignee || '').localeCompare(a.assignee || '');
      case 'tasks-asc':     return a.totalTickets - b.totalTickets;
      case 'tasks-desc':    return b.totalTickets - a.totalTickets;
      case 'workload-desc': return getWorkload(b.totalTickets).rank - getWorkload(a.totalTickets).rank;
      default:              return 0;
    }
  });

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div data-testid="workload-dashboard-page" className="space-y-5 md:space-y-6 overflow-hidden">
      {/* Page header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold heading-font text-slate-900">Team Workload</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor capacity and task distribution across your team</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Active Tasks"    value={totalActiveTickets} Icon={TrendingUp}   bg="bg-blue-50"    fg="text-blue-600"    sub="across all members" />
        <StatCard label="Team Members"    value={workloadData.length} Icon={Users}       bg="bg-purple-50"  fg="text-purple-600"  sub={`${availableMembers} available`} />
        <StatCard label="Avg / Person"    value={avgTicketsPerPerson} Icon={CheckCircle} bg="bg-emerald-50" fg="text-emerald-600" sub="tasks per member" />
        <StatCard label="Overloaded"      value={overloadedMembers}   Icon={AlertCircle} bg="bg-red-50"     fg="text-red-600"     sub="> 10 tasks" />
      </div>

      {/* Member list card */}
      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="heading-font text-base md:text-lg">
              Team Members
              <span className="ml-2 text-sm font-normal text-slate-400">({sorted.length})</span>
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 sm:w-52">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <Input
                  placeholder="Search member..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white h-9 text-sm"
                  data-testid="workload-search"
                />
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(v => !v)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <ArrowUpDown size={14} className="text-slate-400" />
                  <span className="hidden sm:inline">{activeSortLabel}</span>
                </button>
                {showSortMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                      {SORT_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => { setSortBy(value); setShowSortMenu(false); }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${sortBy === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-5">
          {sorted.length === 0 ? (
            <div className="text-center py-12">
              <Users size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">
                {searchQuery ? 'No members match your search' : 'No task assignments yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((member, idx) => (
                <MemberCard key={member.assignee || idx} member={member} idx={idx} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkloadDashboard;
