import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, Trash2, Search, Users, Shield, Star,
  RefreshCw, AlertTriangle, ChevronDown, UserCheck, Clock, X,
  Filter,
} from 'lucide-react';

// ─── config ──────────────────────────────────────────────────────────────────

const ROLES = ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'];

const ROLE_CFG = {
  'Super Admin':         { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    gradient: 'from-rose-500 to-orange-500' },
  'Operations Manager':  { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500',  gradient: 'from-purple-500 to-indigo-500' },
  'Coordinator':         { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500',    gradient: 'from-teal-500 to-cyan-500' },
  'Trek Lead':           { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    gradient: 'from-blue-500 to-violet-500' },
};

const getRoleCfg = (role) => ROLE_CFG[role] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', gradient: 'from-slate-400 to-slate-500' };

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, role, size = 10 }) {
  const cfg = getRoleCfg(role);
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-extrabold flex-shrink-0`}
      style={{ fontSize: size >= 12 ? 18 : 13 }}>
      {initials}
    </div>
  );
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const cfg = getRoleCfg(role);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {role}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, iconBg }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── PendingCard ──────────────────────────────────────────────────────────────

function PendingCard({ user, onApprove, onReject }) {
  const [approving, setApproving] = useState(false);
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-5 flex flex-col gap-4"
      data-testid={`pending-user-${user.uid}`}>
      {/* Top */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0">
          {(user.displayName || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">{user.displayName}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Clock size={10} /> Requested {fmt(user.createdAt)}
          </p>
        </div>
        <div className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0">
          PENDING
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          data-testid={`approve-user-${user.uid}`}
          onClick={async () => { setApproving(true); await onApprove(user.uid); setApproving(false); }}
          disabled={approving}
          className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60">
          <CheckCircle size={14} /> {approving ? 'Approving…' : 'Approve'}
        </button>
        <button
          data-testid={`reject-user-${user.uid}`}
          onClick={() => onReject(user)}
          className="h-9 w-9 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 border border-red-200 rounded-xl transition-colors">
          <XCircle size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── UserRow ──────────────────────────────────────────────────────────────────

function UserRow({ user, onRoleChange, onDelete, updating }) {
  const cfg = getRoleCfg(user.role);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all px-5 py-4"
      data-testid={`approved-user-${user.uid}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Left: avatar + info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar name={user.displayName} role={user.role} size={11} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 text-sm truncate">{user.displayName}</p>
              <RoleBadge role={user.role} />
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
            {user.createdAt && (
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <UserCheck size={9} /> Joined {fmt(user.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Right: role picker + delete */}
        <div className="flex items-center gap-2 pl-14 sm:pl-0">
          <Select value={user.role} onValueChange={(r) => onRoleChange(user.uid, r)} disabled={updating === user.uid}>
            <SelectTrigger data-testid={`role-select-${user.uid}`}
              className={`w-48 h-9 text-xs font-semibold border rounded-xl ${cfg.bg} ${cfg.text} border-transparent focus:ring-2 focus:ring-orange-200`}>
              <SelectValue />
              {updating === user.uid && <RefreshCw size={11} className="animate-spin ml-auto" />}
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl shadow-xl border border-slate-100">
              {ROLES.map(r => {
                const rc = getRoleCfg(r);
                return (
                  <SelectItem key={r} value={r} className="text-xs font-semibold">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rc.dot}`} />
                      {r}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <button
            data-testid={`delete-user-${user.uid}`}
            onClick={() => onDelete(user)}
            className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-300 hover:text-red-500 rounded-xl transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('All');
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [updating,    setUpdating]    = useState(null); // uid being updated

  useEffect(() => { load(); }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const r = await api.get('/users');
      setUsers(r.data);
    } catch { toast.error('Failed to load users'); }
    setLoading(false); setRefreshing(false);
  };

  const handleApprove = async (uid) => {
    try {
      await api.patch(`/users/${uid}/approve`);
      setUsers(p => p.map(u => u.uid === uid ? { ...u, status: 'approved' } : u));
      toast.success('User approved');
    } catch { toast.error('Failed to approve'); }
  };

  const handleRoleChange = async (uid, role) => {
    setUpdating(uid);
    try {
      await api.patch(`/users/${uid}/role?role=${encodeURIComponent(role)}`);
      setUsers(p => p.map(u => u.uid === uid ? { ...u, role } : u));
      toast.success(`Role → ${role}`);
    } catch { toast.error('Failed to update role'); }
    setUpdating(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.uid}`);
      setUsers(p => p.filter(u => u.uid !== deleteTarget.uid));
      toast.success(`${deleteTarget.displayName} removed`);
      setDeleteTarget(null);
    } catch { toast.error('Failed to delete user'); }
  };

  const pending  = users.filter(u => u.status === 'pending');
  const approved = users.filter(u => u.status === 'approved');

  const roleCounts = useMemo(() => {
    const c = {};
    ROLES.forEach(r => { c[r] = approved.filter(u => u.role === r).length; });
    return c;
  }, [approved]);

  const filtered = useMemo(() => {
    let list = approved;
    if (roleFilter !== 'All') list = list.filter(u => u.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [approved, search, roleFilter]);

  return (
    <div className="space-y-5 pb-8" data-testid="user-management-page">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Approve access requests · manage roles · control permissions</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="h-9 px-4 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl shadow-sm text-sm font-medium flex items-center gap-2 transition-colors self-start">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users}     label="Total Users"   value={approved.length} sub={`${pending.length} pending`} color="text-slate-600" iconBg="bg-slate-100" />
        <StatCard icon={Star}      label="Super Admins"  value={roleCounts['Super Admin']||0}        color="text-rose-600"   iconBg="bg-rose-50" />
        <StatCard icon={Shield}    label="Trek Leads"    value={roleCounts['Trek Lead']||0}           color="text-blue-600"   iconBg="bg-blue-50" />
        <StatCard icon={UserCheck} label="Ops / Coords"  value={(roleCounts['Operations Manager']||0)+(roleCounts['Coordinator']||0)} color="text-purple-600" iconBg="bg-purple-50" />
      </div>

      {/* ── Pending approvals ── */}
      {loading ? null : pending.length > 0 ? (
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Pending Approvals</h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{pending.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map(u => (
              <PendingCard key={u.uid} user={u}
                onApprove={handleApprove}
                onReject={setDeleteTarget}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700">All caught up — no pending approvals</p>
        </div>
      )}

      {/* ── Approved users ── */}
      <div>
        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white transition-all" />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 px-2">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* Role filter chips */}
          <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
            <Filter size={12} className="text-slate-300" />
            {['All', ...ROLES].map(r => {
              const cfg = r !== 'All' ? getRoleCfg(r) : null;
              const cnt = r === 'All' ? approved.length : roleCounts[r] || 0;
              return (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    roleFilter === r
                      ? r === 'All'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : `${cfg.bg} ${cfg.text} border-transparent shadow-sm`
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}>
                  {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                  {r}
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${roleFilter === r ? 'bg-black/10' : 'bg-slate-100 text-slate-400'}`}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 border-[3px] border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
              <Users size={24} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-semibold text-sm">No users found</p>
            {(search || roleFilter !== 'All') && (
              <button onClick={() => { setSearch(''); setRoleFilter('All'); }}
                className="text-xs text-orange-500 hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 px-1 mb-3">
              <span className="font-bold text-slate-700">{filtered.length}</span> user{filtered.length !== 1 ? 's' : ''}
              {roleFilter !== 'All' && <span className="ml-1 text-orange-400">· {roleFilter}</span>}
            </p>
            <div className="space-y-2.5">
              {filtered.map(u => (
                <UserRow key={u.uid} user={u}
                  onRoleChange={handleRoleChange}
                  onDelete={setDeleteTarget}
                  updating={updating}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0">
                {(deleteTarget.displayName || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">{deleteTarget.displayName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{deleteTarget.email}</p>
                {deleteTarget.role && <RoleBadge role={deleteTarget.role} />}
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                {deleteTarget.status === 'pending'
                  ? 'This will reject and remove this access request permanently.'
                  : 'This user will lose all access immediately. This cannot be undone.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors">
                <Trash2 size={14} />
                {deleteTarget.status === 'pending' ? 'Reject' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
