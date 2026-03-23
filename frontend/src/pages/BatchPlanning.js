import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, ChevronDown, Star, X, Users, Calendar, MapPin, Search, ChevronLeft, ChevronRight, Filter, AlertTriangle } from 'lucide-react';

const LeadSelector = ({ selectedLeads, onChange, users }) => {
  const [open, setOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');

  const toggleUser = (user) => {
    const exists = selectedLeads.find(l => l.userId === user.uid);
    if (exists) {
      onChange(selectedLeads.filter(l => l.userId !== user.uid));
    } else {
      onChange([...selectedLeads, { userId: user.uid, displayName: user.displayName, isSuperLead: selectedLeads.length === 0 }]);
    }
  };

  const toggleSuperLead = (userId) => {
    onChange(selectedLeads.map(l => ({ ...l, isSuperLead: l.userId === userId })));
  };

  const removeLead = (userId) => {
    const updated = selectedLeads.filter(l => l.userId !== userId);
    if (updated.length > 0 && !updated.some(l => l.isSuperLead)) {
      updated[0].isSuperLead = true;
    }
    onChange(updated);
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between bg-white h-auto min-h-[40px] py-2 text-left font-normal" data-testid="lead-selector-trigger">
            <span className="flex-1 text-sm">
              {selectedLeads.length === 0 ? <span className="text-slate-500">Select trek leads...</span> : `${selectedLeads.length} lead(s) selected`}
            </span>
            <ChevronDown size={16} className="text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2 bg-white" align="start">
          {/* Search box */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search leads..."
              value={leadSearch}
              onChange={e => setLeadSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-slate-50"
              autoFocus
            />
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {users
              .filter(u => !leadSearch || u.displayName?.toLowerCase().includes(leadSearch.toLowerCase()))
              .map(u => (
                <label key={u.uid} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                  <Checkbox checked={!!selectedLeads.find(l => l.userId === u.uid)} onCheckedChange={() => toggleUser(u)} />
                  <span className="text-sm text-slate-900">{u.displayName}</span>
                  <Badge variant="outline" className="text-xs ml-auto">{u.role}</Badge>
                </label>
              ))}
            {users.filter(u => !leadSearch || u.displayName?.toLowerCase().includes(leadSearch.toLowerCase())).length === 0 && (
              <p className="text-sm text-slate-400 p-2 text-center">No leads found</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedLeads.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {selectedLeads.map(lead => (
            <div key={lead.userId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg" data-testid={`assigned-lead-${lead.userId}`}>
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {lead.displayName?.charAt(0)?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-900 flex-1">{lead.displayName}</span>
              <button
                type="button"
                onClick={() => toggleSuperLead(lead.userId)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${lead.isSuperLead ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600 hover:bg-amber-50'}`}
                title={lead.isSuperLead ? 'Super Lead' : 'Click to make Super Lead'}
                data-testid={`super-lead-toggle-${lead.userId}`}
              >
                <Star size={12} className={lead.isSuperLead ? 'fill-amber-500' : ''} />
                {lead.isSuperLead ? 'Super Lead' : 'Lead'}
              </button>
              <button type="button" onClick={() => removeLead(lead.userId)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BatchPlanning = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const isAdmin = ['Super Admin', 'Operations Manager'].includes(userProfile?.role);
  const [batches, setBatches] = useState([]);
  const [treks, setTreks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // batch to delete

  // Search + filter + pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [formData, setFormData] = useState({
    batchCode: '', trekId: '', startDate: '', endDate: '',
    maxCapacity: 30, currentRegistrations: 0, status: 'Open',
    assignedLeads: [], transportVendor: '', stayVendor: '', internalNotes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [batchesRes, treksRes, leadsRes] = await Promise.all([
        api.get('/batches'),
        api.get('/treks'),
        api.get('/users/basic')
      ]);
      const sorted = [...batchesRes.data].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setBatches(sorted);
      setTreks(treksRes.data);
      setAllUsers(leadsRes.data.filter(u => u.status === 'approved'));
    } catch (error) {
      toast.error('Failed to fetch data');
    }
    // Also load old leads collection for backward compat display
    try {
      const leadsRes = await api.get('/leads');
      setLeads(leadsRes.data);
    } catch {}
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBatch) {
        await api.patch(`/batches/${editingBatch.id}`, formData);
        toast.success('Batch updated successfully');
      } else {
        await api.post('/batches', formData);
        toast.success('Batch created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save batch');
    }
  };

  const resetForm = () => {
    setFormData({
      batchCode: '', trekId: '', startDate: '', endDate: '',
      maxCapacity: 30, currentRegistrations: 0, status: 'Open',
      assignedLeads: [], transportVendor: '', stayVendor: '', internalNotes: ''
    });
    setEditingBatch(null);
  };

  const openEditDialog = (batch) => {
    setEditingBatch(batch);
    setFormData({
      batchCode: batch.batchCode || '',
      trekId: batch.trekId || '',
      startDate: batch.startDate || '',
      endDate: batch.endDate || '',
      maxCapacity: batch.maxCapacity || 30,
      currentRegistrations: batch.currentRegistrations || 0,
      status: batch.status || 'Open',
      assignedLeads: batch.assignedLeads || [],
      transportVendor: batch.transportVendor || '',
      stayVendor: batch.stayVendor || '',
      internalNotes: batch.internalNotes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/batches/${deleteConfirm.id}`);
      toast.success(`Batch ${deleteConfirm.batchCode} deleted`);
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete batch');
    }
  };

  const getTrekName = (trekId) => {
    const trek = treks.find(t => t.id === trekId);
    return trek ? trek.name : 'Unknown Trek';
  };

  const getLeadName = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    return lead ? lead.name : 'Not Assigned';
  };

  // Reset to page 1 whenever search or filter changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const filteredBatches = batches.filter(b => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      b.batchCode?.toLowerCase().includes(q) ||
      getTrekName(b.trekId)?.toLowerCase().includes(q) ||
      b.assignedLeads?.some(l => l.displayName?.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));
  const paginated = filteredBatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusConfig = {
    'Open':         { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    'Filling Fast': { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
    'Full':         { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 ring-red-200' },
    'Closed':       { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 ring-slate-200' },
    'Completed':    { dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
    'Cancelled':    { dot: 'bg-red-300',     badge: 'bg-red-50 text-red-500 ring-red-100' },
  };

  return (
    <div data-testid="batch-planning-page" className="space-y-6">

      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Batch Planning</h1>
            <p className="text-blue-200 text-sm mt-0.5">Manage trek batches and lead assignments</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button data-testid="add-batch-button"
                  className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-sm flex items-center gap-2 flex-shrink-0">
                  <Plus size={16} /> Add New Batch
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-slate-900 font-bold text-lg">{editingBatch ? 'Edit Batch' : 'Add New Batch'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Batch Code *</Label>
                    <Input value={formData.batchCode} onChange={(e) => setFormData({...formData, batchCode: e.target.value})} placeholder="e.g., BT501" required className="bg-white mt-1" data-testid="batch-code-input" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Trek *</Label>
                    <Select value={formData.trekId} onValueChange={(val) => setFormData({...formData, trekId: val})}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Select trek" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {treks.map(trek => <SelectItem key={trek.id} value={trek.id}>{trek.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Start Date *</Label>
                    <Input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} required className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">End Date *</Label>
                    <Input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} required className="bg-white mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Max Capacity *</Label>
                    <Input type="number" value={formData.maxCapacity} onChange={(e) => setFormData({...formData, maxCapacity: parseInt(e.target.value)})} required className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Registrations</Label>
                    <Input type="number" value={formData.currentRegistrations} onChange={(e) => setFormData({...formData, currentRegistrations: parseInt(e.target.value)})} className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {['Open','Filling Fast','Full','Closed','Completed','Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm flex items-center gap-1.5"><Users size={14} /> Assign Trek Leads</Label>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2">Select one or more leads. Click the star to designate the Super Lead.</p>
                  <LeadSelector selectedLeads={formData.assignedLeads} onChange={(leads) => setFormData({...formData, assignedLeads: leads})} users={allUsers} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Transport Vendor</Label>
                    <Input value={formData.transportVendor} onChange={(e) => setFormData({...formData, transportVendor: e.target.value})} className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Stay Vendor</Label>
                    <Input value={formData.stayVendor} onChange={(e) => setFormData({...formData, stayVendor: e.target.value})} className="bg-white mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Internal Notes</Label>
                  <Textarea value={formData.internalNotes} onChange={(e) => setFormData({...formData, internalNotes: e.target.value})} rows={2} className="bg-white mt-1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" data-testid="save-batch-btn">Save Batch</Button>
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Search & Filter toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
            <Input
              placeholder="Search by batch code, trek or lead name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-slate-50 border-transparent focus:border-slate-200 focus:bg-white rounded-lg text-sm transition-all"
              data-testid="batch-search"
            />
          </div>

          <div className="w-px h-5 bg-slate-100 hidden sm:block flex-shrink-0" />

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <Filter size={12} className="text-slate-300 flex-shrink-0" />
            {['All', 'Open', 'Filling Fast', 'Full', 'Completed', 'Closed', 'Cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Batch List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Calendar size={28} className="text-slate-300" />
          </div>
          {searchQuery || statusFilter !== 'All' ? (
            <>
              <p className="text-slate-400 font-medium">No batches match your search</p>
              <button onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                className="text-xs text-blue-500 hover:text-blue-700 mt-2 underline underline-offset-2">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 font-medium">No batches created yet</p>
              {isAdmin && <p className="text-xs text-slate-300 mt-1">Click "Add New Batch" above to get started</p>}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Results meta */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBatches.length)}</span> of <span className="font-semibold text-slate-600">{filteredBatches.length}</span> batch{filteredBatches.length !== 1 ? 'es' : ''}
              {statusFilter !== 'All' && <span className="ml-1 text-blue-500">· {statusFilter}</span>}
            </p>
            {(searchQuery || statusFilter !== 'All') && (
              <button onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X size={11} /> Clear
              </button>
            )}
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {paginated.map((batch) => {
              const pct = batch.maxCapacity > 0 ? Math.min(100, Math.round((batch.currentRegistrations / batch.maxCapacity) * 100)) : 0;
              const sc = statusConfig[batch.status] || statusConfig['Closed'];
              return (
                <div key={batch.id} data-testid={`batch-card-${batch.batchCode}`}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group">
                  <div className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                      {/* Left — batch info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{batch.batchCode}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${sc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {batch.status}
                          </span>
                        </div>

                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-3">
                          <MapPin size={13} className="text-slate-300 flex-shrink-0" />
                          {getTrekName(batch.trekId)}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Calendar size={13} className="text-slate-300 flex-shrink-0" />
                            <span>
                              {new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}
                              {' – '}
                              {new Date(batch.endDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Users size={13} className="text-slate-300 flex-shrink-0" />
                            <span className="text-slate-500">{batch.currentRegistrations}/{batch.maxCapacity}</span>
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: pct >= 90 ? '#f87171' : pct >= 70 ? '#fb923c' : '#34d399' }} />
                            </div>
                            <span className="text-xs text-slate-400">{pct}%</span>
                          </div>

                          {batch.assignedLeads && batch.assignedLeads.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {batch.assignedLeads.map(l => (
                                <span key={l.userId} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${
                                  l.isSuperLead ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-blue-50 text-blue-600 ring-blue-100'
                                }`}>
                                  {l.isSuperLead && <Star size={9} className="fill-amber-500 text-amber-500" />}
                                  {l.displayName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">No leads assigned</span>
                          )}
                        </div>
                      </div>

                      {/* Right — actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="sm" data-testid={`edit-batch-${batch.batchCode}`}
                              onClick={() => openEditDialog(batch)}
                              className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg gap-1.5">
                              <Edit size={13} /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" data-testid={`delete-batch-${batch.batchCode}`}
                              onClick={() => setDeleteConfirm(batch)}
                              className="h-8 px-3 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg gap-1.5">
                              <Trash2 size={13} /> Delete
                            </Button>
                          </>
                        )}
                        <Button size="sm" data-testid={`manage-batch-${batch.batchCode}`}
                          onClick={() => navigate(`/batches/${batch.id}`)}
                          className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5">
                          <Users size={13} /> Manage
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-1">
                {/* Prev */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft size={14} />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && arr[i - 1] !== p - 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === '...' ? (
                      <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-300">…</span>
                    ) : (
                      <button key={item}
                        onClick={() => setCurrentPage(item)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                          currentPage === item
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}>
                        {item}
                      </button>
                    )
                  )
                }

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Batch</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              You are about to permanently delete batch <span className="font-semibold text-slate-900">{deleteConfirm.batchCode}</span> ({getTrekName(deleteConfirm.trekId)}).
            </p>
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">
              <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Admin Warning: All participants, expenses and documents linked to this batch will be inaccessible.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
                <Trash2 size={14} className="mr-1.5" /> Delete Batch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchPlanning;