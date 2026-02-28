import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus, Clock, User, Calendar, Search, Filter, X, MoreVertical, Edit, Trash2, Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TicketDetailsDialog from '@/components/TicketDetailsDialog';

const TicketBoard = () => {
  const { userProfile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [initialEditMode, setInitialEditMode] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    priority: '',
    status: ''
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Backlog',
    category: 'Operations',
    assignees: [],
    dueDate: '',
    estimatedHours: '',
  });

  const statuses = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];
  const categories = ['Operations', 'Sales', 'Content', 'Development', 'Trek Planning'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const ticketsRes = await api.get('/tickets');
      const ticketsData = Array.isArray(ticketsRes.data)
        ? ticketsRes.data
        : ticketsRes.data.tickets || [];
      setAllTickets(ticketsData);
      setTickets(ticketsData);
    } catch (error) {
      toast.error('Failed to load tasks');
    }
    try {
      const usersRes = await api.get('/users/basic');
      setUsers(usersRes.data.filter(u => u.status === 'approved'));
    } catch (error) {
      console.warn('Could not load user list');
    }
    setLoading(false);
  };

  useEffect(() => {
    let filtered = [...allTickets];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    if (filters.category) filtered = filtered.filter(t => t.category === filters.category);
    if (filters.priority) filtered = filtered.filter(t => t.priority === filters.priority);
    if (filters.status) filtered = filtered.filter(t => t.status === filters.status);
    setTickets(filtered);
  }, [filters, allTickets]);

  const clearFilters = () => setFilters({ search: '', category: '', priority: '', status: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        estimatedHours: formData.estimatedHours ? parseInt(formData.estimatedHours) : null,
      };
      await api.post('/tickets', payload);
      toast.success('Task created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', priority: 'Medium', status: 'Backlog',
      category: 'Operations', assignees: [], dueDate: '', estimatedHours: '',
    });
  };

  const openDetails = (ticket, editMode = false) => {
    setSelectedTicket(ticket);
    setInitialEditMode(editMode);
    setDetailsDialogOpen(true);
  };

  const handleDeleteFromCard = async (ticket, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${ticket.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tickets/${ticket.id}`);
      toast.success('Task deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const getPriorityConfig = (priority) => {
    const map = {
      'Urgent': { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-200',    dot: 'bg-red-400' },
      'High':   { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-400' },
      'Medium': { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200',  dot: 'bg-amber-400' },
      'Low':    { bg: 'bg-slate-50',  text: 'text-slate-500',  ring: 'ring-slate-200',  dot: 'bg-slate-300' },
    };
    return map[priority] || map['Low'];
  };

  const getCategoryConfig = (category) => {
    const map = {
      'Operations':   { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-100' },
      'Sales':        { bg: 'bg-violet-50',  text: 'text-violet-600', ring: 'ring-violet-100' },
      'Content':      { bg: 'bg-pink-50',    text: 'text-pink-600',   ring: 'ring-pink-100' },
      'Development':  { bg: 'bg-teal-50',    text: 'text-teal-600',   ring: 'ring-teal-100' },
      'Trek Planning':{ bg: 'bg-emerald-50', text: 'text-emerald-600',ring: 'ring-emerald-100' },
    };
    return map[category] || { bg: 'bg-slate-50', text: 'text-slate-500', ring: 'ring-slate-100' };
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.uid === userId);
    return user ? user.displayName : 'Unassigned';
  };

  const getAssigneeNames = (assignees) => {
    if (!assignees || assignees.length === 0) return 'Unassigned';
    if (assignees.length === 1) return getUserName(assignees[0]);
    return `${assignees.length} people`;
  };

  const [expandedColumns, setExpandedColumns] = useState({});
  const CARDS_PER_PAGE = 5;

  const toggleColumnExpand = (status) => {
    setExpandedColumns(prev => ({ ...prev, [status]: !prev[status] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Column header config
  const columnConfig = {
    'Backlog':     { dot: 'bg-slate-400',   label: 'bg-slate-50  border-slate-200  text-slate-600' },
    'To Do':       { dot: 'bg-blue-400',    label: 'bg-blue-50   border-blue-200   text-blue-700'  },
    'In Progress': { dot: 'bg-amber-400',   label: 'bg-amber-50  border-amber-200  text-amber-700' },
    'In Review':   { dot: 'bg-violet-400',  label: 'bg-violet-50 border-violet-200 text-violet-700'},
    'Done':        { dot: 'bg-emerald-400', label: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  };

  const hasFilters = filters.search || filters.category || filters.priority || filters.status;

  return (
    <div data-testid="ticket-board-page" className="space-y-5 overflow-hidden">

      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="relative px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Clock size={20} className="text-blue-200" />
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Task Board</h1>
            </div>
            <p className="text-blue-200 text-sm">
              {allTickets.length} task{allTickets.length !== 1 ? 's' : ''} ·{' '}
              {allTickets.filter(t => t.status === 'In Progress').length} in progress
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-sm flex items-center gap-2 flex-shrink-0" data-testid="create-task-btn">
                <Plus size={16} /> Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-slate-900 font-bold text-lg">Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-1">
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Title *</Label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Task title" required className="bg-white mt-1" data-testid="create-task-title" />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Task description..." rows={4} className="bg-white mt-1" data-testid="create-task-description" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Category</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Priority</Label>
                    <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Assign To</Label>
                    <Select value={formData.assignees[0] || 'none'} onValueChange={(val) => setFormData({ ...formData, assignees: val === 'none' ? [] : [val] })}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Select user" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map(user => <SelectItem key={user.uid} value={user.uid}>{user.displayName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Due Date</Label>
                    <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Estimated Hours</Label>
                    <Input type="number" value={formData.estimatedHours} onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })} placeholder="Hours" className="bg-white mt-1" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" data-testid="submit-create-task">Create Task</Button>
                  <Button type="button" variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
            <Input
              placeholder="Search tasks…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-8 h-8 bg-slate-50 border-transparent focus:border-slate-200 focus:bg-white rounded-lg text-sm transition-all"
              data-testid="search-tasks-input"
            />
          </div>

          <div className="w-px h-5 bg-slate-100 hidden sm:block flex-shrink-0" />

          {/* Category */}
          <Select value={filters.category || 'all'} onValueChange={(val) => setFilters({ ...filters, category: val === 'all' ? '' : val })}>
            <SelectTrigger className="h-8 text-xs bg-slate-50 border-transparent rounded-lg w-full sm:w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select value={filters.priority || 'all'} onValueChange={(val) => setFilters({ ...filters, priority: val === 'all' ? '' : val })}>
            <SelectTrigger className="h-8 text-xs bg-slate-50 border-transparent rounded-lg w-full sm:w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Priorities</SelectItem>
              {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={filters.status || 'all'} onValueChange={(val) => setFilters({ ...filters, status: val === 'all' ? '' : val })}>
            <SelectTrigger className="h-8 text-xs bg-slate-50 border-transparent rounded-lg w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center justify-center gap-1 h-8 px-3 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex-shrink-0 transition-all whitespace-nowrap"
              data-testid="clear-filters-btn">
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {hasFilters && (
          <p className="text-[11px] text-slate-400 mt-2 pl-1">
            <span className="font-semibold text-slate-600">{tickets.length}</span> of <span className="font-semibold text-slate-600">{allTickets.length}</span> tasks shown
          </p>
        )}
      </div>

      {/* ── Kanban Board ── */}
      <div className="overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-3 min-w-max md:min-w-0 md:grid md:grid-cols-5 md:gap-3" data-testid="kanban-board">
          {statuses.map(status => {
            const cc = columnConfig[status] || columnConfig['Backlog'];
            const statusTickets = tickets.filter(t => t.status === status);
            const isExpanded = expandedColumns[status];
            const visibleTickets = isExpanded ? statusTickets : statusTickets.slice(0, CARDS_PER_PAGE);
            const hasMore = statusTickets.length > CARDS_PER_PAGE;

            return (
              <div key={status} className="w-[260px] md:w-auto flex flex-col gap-2">

                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cc.label}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cc.dot}`} />
                    <span className="text-xs font-semibold">{status}</span>
                  </div>
                  <span className="text-xs font-bold opacity-70">{statusTickets.length}</span>
                </div>

                {/* Task cards */}
                <div className="flex flex-col gap-2">
                  {visibleTickets.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-slate-100 py-6 text-center">
                      <p className="text-[11px] text-slate-300">No tasks</p>
                    </div>
                  )}
                  {visibleTickets.map(ticket => {
                    const pc = getPriorityConfig(ticket.priority);
                    const catc = getCategoryConfig(ticket.category);
                    const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== 'Done';

                    return (
                      <div
                        key={ticket.id}
                        className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group p-3 space-y-2.5"
                        onClick={() => openDetails(ticket, false)}
                        data-testid={`task-card-${ticket.id}`}
                      >
                        {/* Title + menu */}
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-semibold text-slate-900 text-xs leading-snug line-clamp-2 flex-1">{ticket.title}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`task-menu-${ticket.id}`}
                              >
                                <MoreVertical size={12} className="text-slate-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white w-36">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetails(ticket, false); }} className="cursor-pointer text-xs">
                                <Eye size={12} className="mr-2" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetails(ticket, true); }} className="cursor-pointer text-xs" data-testid={`task-edit-menu-${ticket.id}`}>
                                <Edit size={12} className="mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleDeleteFromCard(ticket, e)} className="cursor-pointer text-xs text-red-600 focus:text-red-600" data-testid={`task-delete-menu-${ticket.id}`}>
                                <Trash2 size={12} className="mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Description preview */}
                        {ticket.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {ticket.description.replace(/<[^>]*>/g, '')}
                          </p>
                        )}

                        {/* Priority + Category chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${pc.bg} ${pc.text} ${pc.ring}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                            {ticket.priority}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${catc.bg} ${catc.text} ${catc.ring}`}>
                            {ticket.category}
                          </span>
                        </div>

                        {/* Footer: assignee + due date */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-50 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                              <User size={9} className="text-white" />
                            </div>
                            <span className="text-[11px] text-slate-400 truncate">{getAssigneeNames(ticket.assignees)}</span>
                          </div>
                          {ticket.dueDate && (
                            <div className={`flex items-center gap-1 flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                              <Calendar size={10} />
                              <span className="text-[10px] font-medium">
                                {new Date(ticket.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show more / less */}
                {hasMore && (
                  <button
                    onClick={() => toggleColumnExpand(status)}
                    className="w-full text-center text-[11px] text-blue-500 hover:text-blue-700 py-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                    data-testid={`toggle-column-${status}`}
                  >
                    {isExpanded ? '↑ Show less' : `↓ ${statusTickets.length - CARDS_PER_PAGE} more`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ticket Details Dialog — props unchanged ── */}
      <TicketDetailsDialog
        ticket={selectedTicket}
        open={detailsDialogOpen}
        onClose={() => { setDetailsDialogOpen(false); setSelectedTicket(null); }}
        onRefresh={fetchData}
        onDelete={() => fetchData()}
        users={users}
        initialEditMode={initialEditMode}
      />
    </div>
  );
};

export default TicketBoard;