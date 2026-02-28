import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Plus, User, Calendar, Clock, Search, Filter, 
  MessageSquare, Paperclip, Trash2, X, Send, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const TicketBoardEnhanced = () => {
  const { userProfile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Backlog',
    category: 'Operations',
    assignees: [],
    dueDate: '',
    estimatedHours: '',
    labels: []
  });
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    assignee: '',
    search: '',
    dateFilter: 'all' // all, week, month
  });
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  const statuses = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  useEffect(() => {
    fetchData();
  }, [filters, pagination.page]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/config');
      setCategories(response.data.taskCategories || ['Operations', 'Sales', 'Content', 'Development', 'Trek Planning']);
    } catch (error) {
      console.error('Failed to fetch config');
    }
  };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.assignee && { assignee: filters.assignee }),
        ...(filters.search && { search: filters.search })
      });

      const [ticketsRes, usersRes] = await Promise.all([
        api.get(`/tickets?${params}`),
        api.get('/users')
      ]);
      
      setTickets(ticketsRes.data.tickets || ticketsRes.data);
      setPagination(prev => ({
        ...prev,
        total: ticketsRes.data.total || ticketsRes.data.length,
        pages: ticketsRes.data.pages || 1
      }));
      setUsers(usersRes.data.filter(u => u.status === 'approved'));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedTicket) {
        await api.patch(`/tickets/${selectedTicket.id}`, formData);
        toast.success('Task updated successfully');
      } else {
        await api.post('/tickets', formData);
        toast.success('Task created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save task');
    }
  };

  const handleDelete = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await api.delete(`/tickets/${ticketId}`);
      toast.success('Task deleted successfully');
      fetchData();
      setDetailsDialogOpen(false);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleAddComment = async (ticketId) => {
    if (!commentText.trim()) return;
    
    try {
      await api.post(`/tickets/${ticketId}/comments`, { text: commentText });
      setCommentText('');
      toast.success('Comment added');
      
      // Refresh ticket details
      const response = await api.get(`/tickets/${ticketId}`);
      setSelectedTicket(response.data);
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Backlog',
      category: 'Operations',
      assignees: [],
      dueDate: '',
      estimatedHours: '',
      labels: []
    });
    setSelectedTicket(null);
  };

  const openEditDialog = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      title: ticket.title,
      description: ticket.description || '',
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.category,
      assignees: ticket.assignees || [],
      dueDate: ticket.dueDate || '',
      estimatedHours: ticket.estimatedHours || '',
      labels: ticket.labels || []
    });
    setDialogOpen(true);
  };

  const openDetailsDialog = async (ticket) => {
    try {
      const response = await api.get(`/tickets/${ticket.id}`);
      setSelectedTicket(response.data);
      setDetailsDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load task details');
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Urgent': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Operations': 'bg-blue-100 text-blue-800',
      'Sales': 'bg-purple-100 text-purple-800',
      'Content': 'bg-pink-100 text-pink-800',
      'Development': 'bg-teal-100 text-teal-800',
      'Trek Planning': 'bg-green-100 text-green-800'
    };
    return colors[category] || 'bg-slate-100 text-slate-800';
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.uid === userId);
    return user ? user.displayName : userId;
  };

  const toggleAssignee = (userId) => {
    setFormData(prev => ({
      ...prev,
      assignees: prev.assignees.includes(userId)
        ? prev.assignees.filter(id => id !== userId)
        : [...prev.assignees, userId]
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      category: '',
      priority: '',
      assignee: '',
      search: '',
      dateFilter: 'all'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="ticket-board-enhanced" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold heading-font text-slate-900">Task Board</h1>
          <p className="text-slate-600 mt-1">Manage tasks and team assignments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
              <Plus size={20} className="mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="heading-font text-slate-900">
                {selectedTicket ? 'Edit Task' : 'Create New Task'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-slate-900 font-medium">Title *</Label>
                <Input 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="Task title"
                  required 
                  className="bg-white" 
                />
              </div>
              
              <div>
                <Label className="text-slate-900 font-medium">Description</Label>
                <ReactQuill 
                  theme="snow"
                  value={formData.description} 
                  onChange={(value) => setFormData({...formData, description: value})}
                  className="bg-white"
                  modules={{
                    toolbar: [
                      ['bold', 'italic', 'underline'],
                      [{'list': 'ordered'}, {'list': 'bullet'}],
                      ['link'],
                      ['clean']
                    ]
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-900 font-medium">Category *</Label>
                  <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-900 font-medium">Priority *</Label>
                  <Select value={formData.priority} onValueChange={(val) => setFormData({...formData, priority: val})}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {priorities.map(pri => (
                        <SelectItem key={pri} value={pri}>{pri}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-900 font-medium">Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {statuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-900 font-medium">Assign To (Multiple)</Label>
                  <div className="border border-slate-200 rounded-md p-2 bg-white max-h-32 overflow-y-auto">
                    {users.map(user => (
                      <label key={user.uid} className="flex items-center gap-2 p-1 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assignees.includes(user.uid)}
                          onChange={() => toggleAssignee(user.uid)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{user.displayName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-900 font-medium">Due Date</Label>
                  <Input 
                    type="date"
                    value={formData.dueDate} 
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})} 
                    className="bg-white" 
                  />
                </div>

                <div>
                  <Label className="text-slate-900 font-medium">Estimated Hours</Label>
                  <Input 
                    type="number"
                    value={formData.estimatedHours} 
                    onChange={(e) => setFormData({...formData, estimatedHours: e.target.value})} 
                    placeholder="Hours"
                    className="bg-white" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {selectedTicket ? 'Update Task' : 'Create Task'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <Input
                  placeholder="Search tasks..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="pl-10 bg-white"
                />
              </div>
            </div>
            
            <Select value={filters.category} onValueChange={(val) => setFilters({...filters, category: val})}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(val) => setFilters({...filters, priority: val})}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="">All Priorities</SelectItem>
                {priorities.map(pri => (
                  <SelectItem key={pri} value={pri}>{pri}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              <X size={16} className="mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board continues... */}
      <div className="grid grid-cols-5 gap-4">
        {statuses.map(status => {
          const statusTickets = tickets.filter(t => t.status === status);
          
          return (
            <div key={status} className="space-y-3">
              <div className="bg-slate-100 rounded-lg p-3 sticky top-0">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {status}
                  <span className="ml-2 text-xs bg-slate-200 px-2 py-1 rounded-full">
                    {statusTickets.length}
                  </span>
                </h3>
              </div>

              <div className="space-y-2">
                {statusTickets.map(ticket => (
                  <Card 
                    key={ticket.id} 
                    className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer card-hover"
                    onClick={() => openDetailsDialog(ticket)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-slate-900 text-sm line-clamp-2">{ticket.title}</h4>
                        <Badge className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={`text-xs ${getCategoryColor(ticket.category)}`}>
                          {ticket.category}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          <span>{ticket.assignees?.length || 0}</span>
                        </div>
                        {ticket.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{new Date(ticket.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
            disabled={pagination.page === pagination.pages}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Task Details Dialog - Part of component but truncated for space */}
    </div>
  );
};

export default TicketBoardEnhanced;
