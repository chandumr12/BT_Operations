import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import {
  LayoutDashboard, Mountain, Calendar, Users, CheckSquare,
  UserCog, LogOut, Settings as SettingsIcon, Ticket, BarChart3, Bell, X, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const Sidebar = ({ open, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close sidebar on route change (mobile)
    onClose?.();
  }, [location.pathname]);

  const fetchNotifications = async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count')
      ]);
      setNotifications(notifsRes.data.slice(0, 10));
      setUnreadCount(countRes.data.count);
    } catch {}
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      fetchNotifications();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      fetchNotifications();
    } catch {}
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch {}
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'] },
    { path: '/treks', icon: Mountain, label: 'Trek Master', roles: ['Super Admin', 'Operations Manager'] },
    { path: '/batches', icon: Calendar, label: 'Batches', roles: ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'] },
    { path: '/leads', icon: Users, label: 'Leads', roles: ['Super Admin', 'Operations Manager'] },
    { path: '/checklists', icon: CheckSquare, label: 'Checklists', roles: ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'] },
    { path: '/tasks', icon: Ticket, label: 'Tasks', roles: ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'] },
    { path: '/workload', icon: BarChart3, label: 'Workload', roles: ['Super Admin', 'Operations Manager'] },
    { path: '/calendar', icon: CalendarDays, label: 'Calendar', roles: ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'] },
    { path: '/users', icon: UserCog, label: 'Users', roles: ['Super Admin'] },
    { path: '/settings', icon: SettingsIcon, label: 'Settings', roles: ['Super Admin'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(userProfile?.role));

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        min-h-screen
      `}>
        <div className="p-4 md:p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white heading-font">BT Ops</h1>
            <p className="text-xs text-slate-400">Operations</p>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white p-1" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-800">
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all mb-2 relative text-sm"
                data-testid="notification-bell"
              >
                <Bell size={18} />
                <span className="font-medium">Notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 left-7 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" data-testid="notification-count">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 md:w-80 p-0 bg-white" align="start" side="right">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 text-sm">Notifications</h4>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all read</button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4 text-center">No notifications</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                      onClick={() => { markAsRead(n.id); if (n.batchId) navigate('/batches'); setNotifOpen(false); }}
                      data-testid={`notification-item-${n.id}`}
                    >
                      <p className={`text-sm ${!n.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="mb-3 px-2">
            <p className="text-xs text-slate-500">Logged in as</p>
            <p className="text-white font-medium text-sm truncate">{userProfile?.displayName}</p>
            <p className="text-xs text-blue-400">{userProfile?.role}</p>
          </div>

          <Button
            data-testid="logout-button"
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white text-sm"
          >
            <LogOut size={16} className="mr-2" /> Logout
          </Button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
