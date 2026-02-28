import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mountain, Users, CheckCircle, AlertTriangle, TrendingUp, Ticket, Star, MapPin } from 'lucide-react';

const Dashboard = () => {
  const { userProfile, currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcomingBatches, setUpcomingBatches] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [myBatches, setMyBatches] = useState([]);
  const [loading, setLoading] = useState(true);

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

    // My batches (for Trek Leads)
    try {
      const batchesRes = await api.get('/batches/my');
      setMyBatches(batchesRes.data);
    } catch {}

    setLoading(false);
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

  return (
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

      {/* My Assigned Batches (for Trek Leads) */}
      {myBatches.length > 0 && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="heading-font flex items-center gap-2">
                <Calendar className="text-blue-600" size={24} />
                My Assigned Batches ({myBatches.length})
              </CardTitle>
              <Link to="/batches" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="space-y-3">
              {myBatches.map(batch => (
                <div key={batch.id} data-testid={`my-batch-${batch.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm md:text-base">{batch.batchCode}</p>
                      <Badge className={`text-xs ${batch.myRole === 'Super Trek Lead' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {batch.myRole === 'Super Trek Lead' && <Star size={10} className="mr-1 fill-amber-500" />}
                        {batch.myRole}
                      </Badge>
                      <Badge className={`text-xs ${
                        batch.status === 'Open' ? 'bg-green-100 text-green-800' :
                        batch.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>{batch.status}</Badge>
                    </div>
                    <p className="text-xs md:text-sm text-slate-600">
                      {new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short'})} - {new Date(batch.endDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
                    </p>
                  </div>
                  <div className="text-left sm:text-right text-xs md:text-sm text-slate-500 flex-shrink-0">
                    {batch.currentRegistrations}/{batch.maxCapacity} participants
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
  );
};

export default Dashboard;
