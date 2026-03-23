import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mountain, Users, CheckCircle, AlertTriangle, TrendingUp, Ticket, Trophy } from 'lucide-react';

const BADGE_TIERS = [
  { id: 'kumara_parvatha', name: 'Kumara Parvatha', elevation: '1,712m', minBatches: 5,  emoji: '🏔️' },
  { id: 'kedarkantha',     name: 'Kedarkantha',     elevation: '3,810m', minBatches: 10, emoji: '⛰️' },
  { id: 'roopkund',        name: 'Roopkund',        elevation: '5,029m', minBatches: 20, emoji: '🗻' },
  { id: 'trishul',         name: 'Trishul',         elevation: '7,120m', minBatches: 30, emoji: '🌟' },
  { id: 'nanda_devi',      name: 'Nanda Devi',      elevation: '7,816m', minBatches: 40, emoji: '💎' },
  { id: 'everester',       name: 'Everester',       elevation: '8,849m', minBatches: 50, emoji: '🏆' },
];

// Simple CSS confetti burst
function Confetti({ active }) {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  const colors = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#f97316','#ec4899'];
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
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top: '-10px',
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animation: `confettiFall ${duration} ${delay} ease-in forwards`,
              transform: `rotate(${rotate})`,
            }}
          />
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

  // Badge / voucher state
  const [badgeConfigs, setBadgeConfigs] = useState([]);
  const [myVouchers, setMyVouchers] = useState([]);
  const [claimingTier, setClaimingTier] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const isLeadOrCoordinator = ['Trek Lead', 'Coordinator'].includes(userProfile?.role);
  const isAdminOrManager = ['Super Admin', 'Operations Manager'].includes(userProfile?.role);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    // Stats + upcoming batches
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

    // My tasks
    try {
      const ticketsRes = await api.get('/tickets');
      const tickets = Array.isArray(ticketsRes.data) ? ticketsRes.data : ticketsRes.data.tickets || [];
      setMyTasks(tickets.filter(t => t.assignees?.includes(currentUser?.uid) && t.status !== 'Done').slice(0, 10));
    } catch {}

    // Badge configs + my vouchers (for leads / coordinators)
    try {
      const [cfgRes, vchrRes] = await Promise.all([
        api.get('/badge-config'),
        api.get('/badges/vouchers'),
      ]);
      setBadgeConfigs(cfgRes.data || []);
      setMyVouchers(vchrRes.data || []);
    } catch {}

    // My batches + trek stats (for Trek Leads)
    try {
      const [batchesRes, treksRes] = await Promise.all([
        api.get('/batches/my'),
        api.get('/treks'),
      ]);
      const batches = batchesRes.data;
      setMyBatches(batches);

      // Build trek stats: count completed batches per trek, sort descending
      const trekMap = {};
      treksRes.data.forEach(t => { trekMap[t.id] = t.name; });
      const counts = {};
      batches.forEach(b => {
        if (b.status === 'Completed' && b.trekId) {
          counts[b.trekId] = (counts[b.trekId] || 0) + 1;
        }
      });
      const stats = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([trekId, count]) => ({ trekId, trekName: trekMap[trekId] || trekId, count }))
        .sort((a, b) => b.count - a.count);
      setTrekStats(stats);
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
    { title: 'Upcoming Batches', value: stats?.totalUpcomingBatches || 0, icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50', testId: 'stat-upcoming-batches' },
    { title: 'Active Treks', value: stats?.totalActiveTreks || 0, icon: Mountain, color: 'text-green-600', bgColor: 'bg-green-50', testId: 'stat-active-treks' },
    { title: 'Active Leads', value: stats?.totalActiveLeads || 0, icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50', testId: 'stat-active-leads' },
    { title: 'Completed This Month', value: stats?.completedBatchesThisMonth || 0, icon: CheckCircle, color: 'text-teal-600', bgColor: 'bg-teal-50', testId: 'stat-completed-month' },
  ] : [
    { title: 'My Upcoming Batches', value: stats?.totalUpcomingBatches || 0, icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50', testId: 'stat-upcoming-batches' },
    { title: 'Completed This Month', value: stats?.completedBatchesThisMonth || 0, icon: CheckCircle, color: 'text-teal-600', bgColor: 'bg-teal-50', testId: 'stat-completed-month' },
  ];

  if (isAdminOrManager && stats) {
    statCards.push({
      title: 'Pending Approvals', value: stats.pendingUsers || 0, icon: AlertTriangle,
      color: 'text-orange-600', bgColor: 'bg-orange-50', testId: 'stat-pending-approvals'
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  const completedCount = myBatches.filter(b => b.status === 'Completed').length;
  const nextTier = BADGE_TIERS.find(t => completedCount < t.minBatches);
  // Use cumulative progress: completedCount out of nextTier.minBatches (not gap-relative)
  // This ensures the bar is never 0% even when exactly at a tier boundary
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
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 mb-1">Your Voucher Code</p>
            <p className="font-mono text-lg font-bold text-blue-700 tracking-widest">{justClaimed.voucherCode}</p>
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
            className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
            Awesome! 🎉
          </button>
        </div>
      </div>
    )}

    <div data-testid="dashboard-page" className="space-y-8">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-5 md:p-8 text-white shadow-lg">
        <h1 className="text-xl md:text-3xl font-bold heading-font mb-1 md:mb-2">Welcome back, {userProfile?.displayName}!</h1>
        <p className="text-blue-100 text-sm md:text-lg">{userProfile?.role} Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} data-testid={stat.testId} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-slate-600 mb-1 truncate">{stat.title}</p>
                    <p className="text-2xl md:text-3xl font-bold heading-font">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-2 md:p-3 rounded-lg flex-shrink-0`}><Icon size={20} /></div>
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
              <Trophy className="text-purple-500" size={24} />
              Trek Milestone Badges
            </CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">
              Complete batches to unlock peak badges and earn goodies!
            </p>
          </CardHeader>
          <CardContent className="p-3 md:p-6 space-y-4">
            {/* Progress bar */}
            {nextTier ? (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-slate-700">{completedCount} batches completed</span>
                  <span className="text-purple-600 font-bold">{completedCount} / {nextTier.minBatches} → {nextTier.emoji} {nextTier.name}</span>
                </div>
                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                  <div
                    className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{
                      width: `${Math.max(progressPct, 4)}%`,
                      background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
                    }}
                  >
                    {/* shimmer sweep */}
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                        animation: 'shimmer 1.8s infinite',
                        backgroundSize: '200% 100%',
                      }}
                    />
                  </div>
                  {/* percentage label inside bar if wide enough */}
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
              <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl px-4 py-3">
                <span className="text-xl">🏆</span>
                <span className="font-semibold">You've unlocked all badges — true Everester!</span>
              </div>
            )}

            {/* MOBILE: horizontal scroll strip */}
            <div className="flex gap-2 overflow-x-auto pb-1 md:hidden snap-x snap-mandatory -mx-3 px-3">
              {BADGE_TIERS.map(tier => {
                const unlocked = completedCount >= tier.minBatches;
                const claimed = myVouchers.find(v => v.tierId === tier.id);
                const isClaiming = claimingTier === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={`flex-shrink-0 snap-start w-[80px] flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                      unlocked
                        ? 'border-purple-200 bg-gradient-to-b from-purple-50 to-white shadow-sm'
                        : 'border-slate-100 bg-slate-50 opacity-40 grayscale'
                    }`}
                  >
                    <span className="text-[26px] leading-none">{tier.emoji}</span>
                    <p className="text-[10px] font-bold text-slate-800 leading-tight w-full line-clamp-2">{tier.name}</p>
                    <p className="text-[9px] text-slate-400">{tier.minBatches} batches</p>
                    {unlocked ? (
                      claimed ? (
                        <span className="text-[9px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full w-full">✓ Claimed</span>
                      ) : (
                        <button
                          onClick={() => claimBadge(tier.id)}
                          disabled={isClaiming}
                          className="text-[9px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-1 py-1 rounded-full w-full transition-colors disabled:opacity-60"
                        >
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
                  <div
                    key={tier.id}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                      unlocked
                        ? 'border-purple-200 bg-gradient-to-b from-purple-50 to-white shadow-sm'
                        : 'border-slate-100 bg-slate-50 opacity-40 grayscale'
                    }`}
                  >
                    <span className="text-3xl">{tier.emoji}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{tier.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{tier.elevation}</p>
                      <p className="text-[10px] text-slate-500">{tier.minBatches} batches</p>
                    </div>
                    {unlocked ? (
                      claimed ? (
                        <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Claimed</span>
                      ) : (
                        <button
                          onClick={() => claimBadge(tier.id)}
                          disabled={isClaiming}
                          className="text-[10px] font-semibold text-white bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded-full transition-colors disabled:opacity-60 w-full"
                        >
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
              <Trophy className="text-amber-500" size={24} />
              My Trek Journey
            </CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">Treks you've led — be proud of every summit!</p>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trekStats.map((trek, index) => {
                const rankColors = [
                  'from-amber-50 to-yellow-50 border-amber-200',
                  'from-slate-50 to-gray-50 border-slate-200',
                  'from-orange-50 to-amber-50 border-orange-200',
                ];
                const badgeColors = [
                  'bg-amber-100 text-amber-800',
                  'bg-slate-100 text-slate-700',
                  'bg-orange-100 text-orange-800',
                ];
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                const cardBg = rankColors[index] || 'from-blue-50 to-slate-50 border-slate-200';
                const countColor = (badgeColors[index] || 'bg-blue-100 text-blue-800').split(' ')[1];
                return (
                  <div key={trek.trekId} className={`bg-gradient-to-br ${cardBg} border rounded-xl p-4 flex items-center gap-3`}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                      {rankEmoji ? <span className="text-lg">{rankEmoji}</span> : <Mountain size={18} className="text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{trek.trekName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{trek.count} batch{trek.count !== 1 ? 'es' : ''} completed</p>
                    </div>
                    <span className={`flex-shrink-0 font-bold ${countColor} px-2 py-0.5 rounded-lg text-sm`}>{trek.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Assigned Batches — tabbed Upcoming / Completed with pagination */}
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
          <div data-testid={`my-batch-${batch.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-semibold text-slate-900 text-sm md:text-base">{batch.batchCode}</p>
                <Badge className={`text-xs ${
                  batch.status === 'Open' ? 'bg-green-100 text-green-800' :
                  batch.status === 'Completed' ? 'bg-teal-100 text-teal-800' :
                  'bg-slate-100 text-slate-800'
                }`}>{batch.status}</Badge>
              </div>
              <p className="text-xs md:text-sm text-slate-600">
                {new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short'})} – {new Date(batch.endDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
              </p>
            </div>
            <div className="text-left sm:text-right text-xs md:text-sm text-slate-500 flex-shrink-0">
              {batch.currentRegistrations}/{batch.maxCapacity} participants
            </div>
          </div>
        );

        return (
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="heading-font flex items-center gap-2">
                  <Calendar className="text-blue-600" size={24} />
                  My Assigned Batches
                </CardTitle>
                <Link to="/batches" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</Link>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 mt-3 bg-slate-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => { setBatchTab('upcoming'); setUpcomingPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${batchTab === 'upcoming' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Upcoming {upcoming.length > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{upcoming.length}</span>}
                </button>
                <button
                  onClick={() => { setBatchTab('completed'); setCompletedPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${batchTab === 'completed' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Completed {completed.length > 0 && <span className="ml-1 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">{completed.length}</span>}
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {paginated.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  {batchTab === 'upcoming' ? 'No upcoming batches assigned.' : 'No completed batches yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {paginated.map(batch => <BatchRow key={batch.id} batch={batch} />)}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, activeList.length)} of {activeList.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActivePage(p => Math.max(1, p - 1))}
                      disabled={activePage === 1}
                      className="px-2.5 py-1 rounded-md text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹ Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setActivePage(page)}
                        className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${activePage === page ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setActivePage(p => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      className="px-2.5 py-1 rounded-md text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next ›
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
                <Ticket className="text-blue-600" size={24} />
                My Tasks ({myTasks.length})
              </CardTitle>
              <Link to="/tasks" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="space-y-2 md:space-y-3">
              {myTasks.map(task => (
                <div key={task.id} data-testid={`my-task-${task.id}`} className="flex items-center justify-between gap-2 p-2.5 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-medium text-slate-900 truncate text-sm md:text-base">{task.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{task.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge className={`text-xs ${
                      task.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                      task.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>{task.priority}</Badge>
                    <Badge className={`text-xs hidden sm:inline-flex ${
                      task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      task.status === 'In Review' ? 'bg-purple-100 text-purple-800' :
                      task.status === 'To Do' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>{task.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Batches - Admin only */}
      {isAdminOrManager && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="heading-font flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={24} />
              Upcoming Batches (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {upcomingBatches.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                <p>No batches scheduled for the next 7 days</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {upcomingBatches.map(batch => (
                  <div key={batch.id} data-testid={`upcoming-batch-${batch.batchCode}`} className="flex items-center justify-between gap-2 p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm md:text-base">{batch.batchCode}</p>
                      <p className="text-xs md:text-sm text-slate-600 mt-1">{new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge className={`text-xs ${
                        batch.status === 'Open' ? 'bg-green-100 text-green-800' :
                        batch.status === 'Filling Fast' ? 'bg-yellow-100 text-yellow-800' :
                        batch.status === 'Full' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>{batch.status}</Badge>
                      <p className="text-xs md:text-sm text-slate-600 mt-1">{batch.currentRegistrations}/{batch.maxCapacity}</p>
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