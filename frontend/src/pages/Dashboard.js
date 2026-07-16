import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Mountain, Users, CheckCircle, AlertTriangle, TrendingUp, Ticket, Trophy } from 'lucide-react';

const BRAND = '#f1563f';

const BADGE_TIERS = [
  { id: 'kumara_parvatha', name: 'Kumara Parvatha', elevation: '1,712m', minBatches: 5,  emoji: '🏔️' },
  { id: 'kedarkantha',     name: 'Kedarkantha',     elevation: '3,810m', minBatches: 10, emoji: '⛰️' },
  { id: 'roopkund',        name: 'Roopkund',        elevation: '5,029m', minBatches: 20, emoji: '🗻' },
  { id: 'trishul',         name: 'Trishul',         elevation: '7,120m', minBatches: 30, emoji: '🌟' },
  { id: 'nanda_devi',      name: 'Nanda Devi',      elevation: '7,816m', minBatches: 40, emoji: '💎' },
  { id: 'everester',       name: 'Everester',       elevation: '8,849m', minBatches: 50, emoji: '🏆' },
];

function Confetti({ active }) {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  const colors = [BRAND, '#fbbf24', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316'];
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(i => {
        const left = `${Math.random() * 100}%`;
        const delay = `${Math.random() * 0.6}s`;
        const duration = `${0.8 + Math.random() * 0.8}s`;
        const color = colors[i % colors.length];
        const size = `${6 + Math.floor(Math.random() * 8)}px`;
        const rotate = `${Math.random() * 360}deg`;
        return (
          <div key={i} style={{
            position: 'absolute', left, top: '-10px', width: size, height: size,
            backgroundColor: color, borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `confettiFall ${duration} ${delay} ease-in forwards`,
            transform: `rotate(${rotate})`,
          }} />
        );
      })}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const Dashboard = () => {
  const { userProfile, currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcomingBatches, setUpcomingBatches] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [myBatches, setMyBatches] = useState([]);
  const [trekStats, setTrekStats] = useState([]);
  const [batchTab, setBatchTab] = useState('upcoming');
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 5;

  const [myVouchers, setMyVouchers] = useState([]);
  const [claimingTier, setClaimingTier] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const isLeadOrCoordinator = ['Trek Lead', 'Coordinator'].includes(userProfile?.role);
  const isAdminOrManager = ['Super Admin', 'Operations Manager'].includes(userProfile?.role);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, batchesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/batches')
      ]);
      setStats(statsRes.data);
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      setUpcomingBatches(
        batchesRes.data
          .filter(b => { const d = new Date(b.startDate); return d >= today && d <= nextWeek; })
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      );
    } catch (error) {
      console.error('Dashboard stats error:', error);
    }

    try {
      const ticketsRes = await api.get('/tickets');
      const tickets = Array.isArray(ticketsRes.data) ? ticketsRes.data : ticketsRes.data.tickets || [];
      setMyTasks(tickets.filter(t => t.assignees?.includes(currentUser?.uid) && t.status !== 'Done').slice(0, 10));
    } catch {}

    try {
      const [, vchrRes] = await Promise.all([
        api.get('/badge-config'),
        api.get('/badges/vouchers'),
      ]);
      setMyVouchers(vchrRes.data || []);
    } catch {}

    try {
      const [batchesRes, treksRes] = await Promise.all([
        api.get('/batches/my'),
        api.get('/treks'),
      ]);
      const batches = batchesRes.data;
      setMyBatches(batches);
      const trekMap = {};
      treksRes.data.forEach(t => { trekMap[t.id] = t.name; });
      const counts = {};
      batches.forEach(b => {
        if (b.status === 'Completed' && b.trekId) counts[b.trekId] = (counts[b.trekId] || 0) + 1;
      });
      const st = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([trekId, count]) => ({ trekId, trekName: trekMap[trekId] || trekId, count }))
        .sort((a, b) => b.count - a.count);
      setTrekStats(st);
    } catch {}

    setLoading(false);
  };

  const claimBadge = async (tierId) => {
    setClaimingTier(tierId);
    try {
      const res = await api.post(`/badges/claim/${tierId}`);
      setMyVouchers(prev => {
        const exists = prev.find(v => v.tierId === tierId);
        return exists ? prev : [...prev, res.data];
      });
      setJustClaimed(res.data);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not claim badge. Try again.');
    } finally {
      setClaimingTier(null);
    }
  };

  const statCards = isAdminOrManager ? [
    { title: 'Upcoming Batches',     value: stats?.totalUpcomingBatches || 0,      icon: Calendar,    testId: 'stat-upcoming-batches' },
    { title: 'Active Treks',         value: stats?.totalActiveTreks || 0,          icon: Mountain,    testId: 'stat-active-treks' },
    { title: 'Active Leads',         value: stats?.totalActiveLeads || 0,          icon: Users,       testId: 'stat-active-leads' },
    { title: 'Completed This Month', value: stats?.completedBatchesThisMonth || 0, icon: CheckCircle, testId: 'stat-completed-month' },
  ] : [
    { title: 'My Batches',     value: stats?.totalUpcomingBatches || 0,      icon: Calendar,    testId: 'stat-upcoming-batches' },
    { title: 'Done This Month', value: stats?.completedBatchesThisMonth || 0, icon: CheckCircle, testId: 'stat-completed-month' },
  ];

  if (isAdminOrManager && stats) {
    statCards.push({ title: 'Pending Approvals', value: stats.pendingUsers || 0, icon: AlertTriangle, testId: 'stat-pending-approvals' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-slate-100 mx-auto"
          style={{ borderTopColor: BRAND }} />
      </div>
    );
  }

  const completedCount = myBatches.filter(b => b.status === 'Completed').length;
  const nextTier = BADGE_TIERS.find(t => completedCount < t.minBatches);
  const progressPct = nextTier
    ? Math.min(99, Math.round((completedCount / nextTier.minBatches) * 100))
    : 100;

  return (
    <>
    <Confetti active={showConfetti} />

    {/* Just-claimed modal */}
    {justClaimed && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
           onClick={() => setJustClaimed(null)}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
          <p className="text-5xl mb-3">{justClaimed.emoji}</p>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{justClaimed.tierName} Unlocked!</h2>
          <p className="text-sm text-gray-500 mb-4">{justClaimed.elevation}</p>
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-400 mb-1">Your Voucher Code</p>
            <p className="font-mono text-lg font-black tracking-widest" style={{ color: BRAND }}>{justClaimed.voucherCode}</p>
          </div>
          {justClaimed.goodieDescription ? (
            <p className="text-sm text-gray-700 mb-4">🎁 {justClaimed.goodieDescription}</p>
          ) : (
            <p className="text-sm text-gray-400 italic mb-4">Goodie details coming soon — stay tuned!</p>
          )}
          {justClaimed.goodiePicUrl && (
            <img src={justClaimed.goodiePicUrl} alt="goodie"
              className="w-full h-40 object-cover rounded-xl mb-4"
              onError={e => { e.target.style.display = 'none'; }} />
          )}
          <button onClick={() => setJustClaimed(null)}
            className="w-full py-2.5 rounded-xl text-white font-bold transition-opacity hover:opacity-90"
            style={{ background: BRAND }}>
            Awesome! 🎉
          </button>
        </div>
      </div>
    )}

    <div data-testid="dashboard-page" className="space-y-5 md:space-y-6">

      {/* Welcome banner */}
      <div className="rounded-2xl p-5 md:p-7 text-white relative overflow-hidden" style={{ background: BRAND }}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative">
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{userProfile?.role}</p>
          <h1 className="text-xl md:text-3xl font-black heading-font leading-tight">
            Welcome back, {userProfile?.displayName}!
          </h1>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} data-testid={stat.testId} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 mb-1 font-medium leading-tight">{stat.title}</p>
                    <p className="text-2xl md:text-3xl font-black heading-font text-slate-900">{stat.value}</p>
                  </div>
                  <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: `${BRAND}15` }}>
                    <Icon size={20} style={{ color: BRAND }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Badge Milestone Tracker — leads/coordinators only */}
      {isLeadOrCoordinator && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font flex items-center gap-2">
              <Trophy size={22} style={{ color: BRAND }} />
              Trek Milestone Badges
            </CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">
              Complete batches to unlock peak badges and earn goodies!
            </p>
          </CardHeader>
          <CardContent className="p-3 md:p-6 space-y-4">
            {nextTier ? (
              <div>
                <div className="flex justify-between text-sm mb-2 flex-wrap gap-1">
                  <span className="font-semibold text-slate-700">{completedCount} batches completed</span>
                  <span className="font-bold" style={{ color: BRAND }}>
                    {completedCount} / {nextTier.minBatches} → {nextTier.emoji} {nextTier.name}
                  </span>
                </div>
                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                  <div
                    className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{ width: `${Math.max(progressPct, 4)}%`, background: `linear-gradient(90deg, ${BRAND}, #ff8a70)` }}
                  >
                    <div className="absolute inset-0 opacity-40"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                        animation: 'shimmer 1.8s infinite', backgroundSize: '200% 100%',
                      }} />
                  </div>
                  {progressPct >= 15 && (
                    <span className="absolute inset-0 flex items-center px-3 text-[11px] font-bold text-white pointer-events-none">
                      {progressPct}%
                    </span>
                  )}
                </div>
                <style>{`
                  @keyframes shimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                  }
                `}</style>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 font-semibold"
                style={{ background: `${BRAND}12`, color: BRAND }}>
                <span className="text-xl">🏆</span>
                You've unlocked all badges — true Everester!
              </div>
            )}

            {/* MOBILE: horizontal scroll strip */}
            <div className="flex gap-2 overflow-x-auto pb-1 md:hidden snap-x snap-mandatory -mx-3 px-3">
              {BADGE_TIERS.map(tier => {
                const unlocked = completedCount >= tier.minBatches;
                const claimed = myVouchers.find(v => v.tierId === tier.id);
                const isClaiming = claimingTier === tier.id;
                return (
                  <div key={tier.id}
                    className={`flex-shrink-0 snap-start w-[80px] flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                      unlocked ? 'bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-40 grayscale'
                    }`}
                    style={unlocked ? { borderColor: `${BRAND}40` } : {}}>
                    <span className="text-[26px] leading-none">{tier.emoji}</span>
                    <p className="text-[10px] font-bold text-slate-800 leading-tight w-full line-clamp-2">{tier.name}</p>
                    <p className="text-[9px] text-slate-400">{tier.minBatches} batches</p>
                    {unlocked ? (
                      claimed ? (
                        <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full w-full"
                          style={{ background: '#22c55e' }}>✓ Claimed</span>
                      ) : (
                        <button onClick={() => claimBadge(tier.id)} disabled={isClaiming}
                          className="text-[9px] font-bold text-white px-1 py-1 rounded-full w-full transition-opacity disabled:opacity-60"
                          style={{ background: BRAND }}>
                          {isClaiming ? '...' : '🎁 Claim'}
                        </button>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-400">🔒</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP: grid of cards */}
            <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-3">
              {BADGE_TIERS.map(tier => {
                const unlocked = completedCount >= tier.minBatches;
                const claimed = myVouchers.find(v => v.tierId === tier.id);
                const isClaiming = claimingTier === tier.id;
                return (
                  <div key={tier.id}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                      unlocked ? 'bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-40 grayscale'
                    }`}
                    style={unlocked ? { borderColor: `${BRAND}40` } : {}}>
                    <span className="text-3xl">{tier.emoji}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{tier.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{tier.elevation}</p>
                      <p className="text-[10px] text-slate-500">{tier.minBatches} batches</p>
                    </div>
                    {unlocked ? (
                      claimed ? (
                        <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                          style={{ background: '#22c55e' }}>✓ Claimed</span>
                      ) : (
                        <button onClick={() => claimBadge(tier.id)} disabled={isClaiming}
                          className="text-[10px] font-semibold text-white px-2 py-1 rounded-full transition-opacity disabled:opacity-60 w-full"
                          style={{ background: BRAND }}>
                          {isClaiming ? '...' : '🎁 Claim'}
                        </button>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-400">🔒 Locked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trek Journey — leads/coordinators only */}
      {isLeadOrCoordinator && trekStats.length > 0 && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font flex items-center gap-2">
              <Trophy size={22} className="text-amber-500" />
              My Trek Journey
            </CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">Treks you've led — be proud of every summit!</p>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trekStats.map((trek, index) => {
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                return (
                  <div key={trek.trekId} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                      {rankEmoji ? <span className="text-lg">{rankEmoji}</span> : <Mountain size={18} style={{ color: BRAND }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{trek.trekName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{trek.count} batch{trek.count !== 1 ? 'es' : ''} completed</p>
                    </div>
                    <span className="flex-shrink-0 font-black text-sm px-2 py-0.5 rounded-lg"
                      style={{ color: BRAND, background: `${BRAND}12` }}>{trek.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Assigned Batches */}
      {myBatches.length > 0 && (() => {
        const today = new Date().toISOString().split('T')[0];
        const upcoming = myBatches.filter(b => b.status !== 'Completed' || b.startDate >= today)
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const completed = myBatches.filter(b => b.status === 'Completed')
          .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        const activeList = batchTab === 'upcoming' ? upcoming : completed;
        const activePage = batchTab === 'upcoming' ? upcomingPage : completedPage;
        const setActivePage = batchTab === 'upcoming' ? setUpcomingPage : setCompletedPage;
        const totalPages = Math.ceil(activeList.length / PAGE_SIZE);
        const paginated = activeList.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

        const BatchRow = ({ batch }) => (
          <div data-testid={`my-batch-${batch.id}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-white rounded-xl border border-slate-100 hover:shadow-sm transition-all"
            style={{ borderLeft: `3px solid ${BRAND}` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-bold text-slate-900 text-sm">{batch.batchCode}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={batch.status === 'Open'
                    ? { background: '#dcfce7', color: '#16a34a' }
                    : batch.status === 'Completed'
                    ? { background: '#f1f5f9', color: '#475569' }
                    : { background: '#fef9c3', color: '#854d0e' }}>
                  {batch.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short'})} –{' '}
                {new Date(batch.endDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
              </p>
            </div>
            <p className="text-xs text-slate-400 font-medium flex-shrink-0">
              {batch.currentRegistrations}/{batch.maxCapacity} participants
            </p>
          </div>
        );

        return (
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="heading-font flex items-center gap-2">
                  <Calendar size={20} style={{ color: BRAND }} />
                  My Assigned Batches
                </CardTitle>
                <Link to="/batches" className="text-sm font-bold" style={{ color: BRAND }}>View All</Link>
              </div>
              <div className="flex gap-1 mt-3 bg-slate-100 rounded-xl p-1 w-fit">
                {[
                  { key: 'upcoming', label: 'Upcoming', list: upcoming },
                  { key: 'completed', label: 'Completed', list: completed },
                ].map(({ key, label, list }) => (
                  <button key={key}
                    onClick={() => { setBatchTab(key); if (key === 'upcoming') setUpcomingPage(1); else setCompletedPage(1); }}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                    style={batchTab === key
                      ? { background: '#fff', color: BRAND, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                      : { color: '#64748b' }}>
                    {label}
                    {list.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: `${BRAND}15`, color: BRAND }}>{list.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {paginated.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  {batchTab === 'upcoming' ? 'No upcoming batches assigned.' : 'No completed batches yet.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {paginated.map(batch => <BatchRow key={batch.id} batch={batch} />)}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, activeList.length)} of {activeList.length}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage === 1}
                      className="px-2.5 py-1 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => setActivePage(page)}
                        className="w-8 h-8 rounded-lg text-sm font-semibold transition-colors"
                        style={activePage === page
                          ? { background: BRAND, color: '#fff' }
                          : { border: '1px solid #e2e8f0', color: '#475569' }}>
                        {page}
                      </button>
                    ))}
                    <button onClick={() => setActivePage(p => Math.min(totalPages, p + 1))} disabled={activePage === totalPages}
                      className="px-2.5 py-1 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      ›
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* My Tasks */}
      {myTasks.length > 0 && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="heading-font flex items-center gap-2">
                <Ticket size={20} style={{ color: BRAND }} />
                My Tasks ({myTasks.length})
              </CardTitle>
              <Link to="/tasks" className="text-sm font-bold" style={{ color: BRAND }}>View All</Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="space-y-2">
              {myTasks.map(task => (
                <div key={task.id} data-testid={`my-task-${task.id}`}
                  className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-medium text-slate-900 truncate text-sm">{task.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{task.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      task.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                      task.priority === 'High'   ? 'bg-orange-100 text-orange-700' :
                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{task.priority}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full hidden sm:inline-flex bg-slate-100 text-slate-600">
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Batches — admin/manager only */}
      {isAdminOrManager && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font flex items-center gap-2">
              <TrendingUp size={20} style={{ color: BRAND }} />
              Upcoming Batches (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {upcomingBatches.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar size={40} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm">No batches scheduled for the next 7 days</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingBatches.map(batch => (
                  <div key={batch.id} data-testid={`upcoming-batch-${batch.batchCode}`}
                    className="flex items-center justify-between gap-2 p-3.5 bg-white rounded-xl border border-slate-100 hover:shadow-sm transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm">{batch.batchCode}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        batch.status === 'Open'         ? 'bg-green-100 text-green-700' :
                        batch.status === 'Filling Fast' ? 'bg-yellow-100 text-yellow-700' :
                        batch.status === 'Full'         ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{batch.status}</span>
                      <p className="text-xs text-slate-400 mt-1">{batch.currentRegistrations}/{batch.maxCapacity}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
};

export default Dashboard;
