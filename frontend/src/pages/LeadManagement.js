import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Edit, Users, Phone, Calendar, Search, Filter,
  ChevronLeft, ChevronRight, X, Mail, Star, Languages, Zap, Copy,
  CheckCircle, XCircle, Clock, Trash2, AlertTriangle
} from 'lucide-react';

const PAGE_SIZE = 9;

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [pendingLeads, setPendingLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('approved'); // 'approved' | 'pending'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // lead object to confirm delete

  // Search + filter + pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    name: '', phone: '', age: 25, gender: 'Male', active: true,
    hiredDate: '', languages: [], specialSkills: [],
    email: '', password: '', role: 'Trek Lead'
  });
  const [languageInput, setLanguageInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => { fetchLeads(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const fetchLeads = async () => {
    try {
      const [approvedRes, pendingRes] = await Promise.all([
        api.get('/leads'),
        api.get('/leads?approval_status=pending'),
      ]);
      setLeads(approvedRes.data);
      setPendingLeads(pendingRes.data);
    } catch {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (leadId) => {
    try {
      await api.post(`/leads/${leadId}/approve`);
      toast.success('Lead approved');
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve lead');
    }
  };

  const handleReject = async (leadId) => {
    try {
      await api.post(`/leads/${leadId}/reject`);
      toast.success('Application rejected');
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject application');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/leads/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name}'s profile deleted`);
      setDeleteTarget(null);
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete lead');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLead) {
        const { email, password, role, ...updateData } = formData;
        await api.patch(`/leads/${editingLead.id}`, updateData);
        toast.success('Lead updated successfully');
      } else {
        if (!formData.email || !formData.password) {
          toast.error('Email and password are required for new leads');
          return;
        }
        await api.post('/leads', formData);
        setCreatedCreds({ name: formData.name, email: formData.email, password: formData.password, role: formData.role });
        toast.success('Lead created with login account');
      }
      setDialogOpen(false);
      resetForm();
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save lead');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', age: 25, gender: 'Male', active: true, hiredDate: '', languages: [], specialSkills: [], email: '', password: '', role: 'Trek Lead' });
    setLanguageInput('');
    setSkillInput('');
    setEditingLead(null);
  };

  const addLanguage = () => {
    if (languageInput.trim() && !formData.languages.includes(languageInput.trim())) {
      setFormData({ ...formData, languages: [...formData.languages, languageInput.trim()] });
      setLanguageInput('');
    }
  };
  const removeLanguage = (lang) => setFormData({ ...formData, languages: formData.languages.filter(l => l !== lang) });

  const addSkill = () => {
    if (skillInput.trim() && !formData.specialSkills.includes(skillInput.trim())) {
      setFormData({ ...formData, specialSkills: [...formData.specialSkills, skillInput.trim()] });
      setSkillInput('');
    }
  };
  const removeSkill = (skill) => setFormData({ ...formData, specialSkills: formData.specialSkills.filter(s => s !== skill) });

  const openEditDialog = (lead) => { setEditingLead(lead); setFormData(lead); setDialogOpen(true); };

  // Derived data
  const filteredLeads = leads.filter(l => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      l.name?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.languages?.some(lang => lang.toLowerCase().includes(q)) ||
      l.specialSkills?.some(sk => sk.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? l.active : !l.active);
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const paginated = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasActiveFilter = searchQuery || statusFilter !== 'All';
  const clearAll = () => { setSearchQuery(''); setStatusFilter('All'); };

  // Avatar colour from name
  const avatarColor = (name = '') => {
    const colors = [
      'from-blue-500 to-blue-600', 'from-violet-500 to-purple-600',
      'from-rose-500 to-pink-600', 'from-amber-500 to-orange-500',
      'from-teal-500 to-cyan-600', 'from-indigo-500 to-blue-600',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div data-testid="lead-management-page" className="space-y-5">

      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="relative px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Users size={22} className="text-blue-200" />
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Lead Management</h1>
            </div>
            <p className="text-blue-200 text-sm flex items-center gap-2">
              {leads.filter(l => l.active).length} active · {leads.length} total
              {pendingLeads.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-900">
                  <Clock size={10} /> {pendingLeads.length} pending
                </span>
              )}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-lead-button"
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-sm flex items-center gap-2 flex-shrink-0">
                <Plus size={16} /> Add New Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-slate-900 font-bold text-lg">
                  {editingLead ? 'Edit Lead' : 'Add New Lead'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Name *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="bg-white mt-1" data-testid="lead-name-input" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Phone *</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required className="bg-white mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Age *</Label>
                    <Input type="number" value={formData.age} onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})} required className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Gender *</Label>
                    <Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Hired Date *</Label>
                    <Input type="date" value={formData.hiredDate} onChange={(e) => setFormData({...formData, hiredDate: e.target.value})} required className="bg-white mt-1" />
                  </div>
                </div>

                {/* Login Credentials — new leads only */}
                {!editingLead && (
                  <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Login Credentials</p>
                      <p className="text-xs text-blue-500 mt-0.5">Create a login account for this lead.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">Email *</Label>
                        <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required placeholder="lead@example.com" className="bg-white mt-1" data-testid="lead-email" />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium text-sm">Password *</Label>
                        <Input type="text" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required placeholder="Min 6 characters" className="bg-white mt-1" data-testid="lead-password" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-700 font-medium text-sm">Role / Permission Group</Label>
                      <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                        <SelectTrigger className="bg-white mt-1" data-testid="lead-role"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Trek Lead">Trek Lead</SelectItem>
                          <SelectItem value="Coordinator">Coordinator</SelectItem>
                          <SelectItem value="Operations Manager">Operations Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Languages */}
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Languages Known</Label>
                  <div className="flex gap-2 mt-1 mb-2">
                    <Input value={languageInput} onChange={(e) => setLanguageInput(e.target.value)}
                      placeholder="Type and press Add…" className="bg-white"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())} />
                    <Button type="button" onClick={addLanguage} variant="outline" className="flex-shrink-0">Add</Button>
                  </div>
                  {formData.languages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.languages.map((lang, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                          {lang}
                          <button type="button" onClick={() => removeLanguage(lang)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skills */}
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Special Skills</Label>
                  <div className="flex gap-2 mt-1 mb-2">
                    <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                      placeholder="Type and press Add…" className="bg-white"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
                    <Button type="button" onClick={addSkill} variant="outline" className="flex-shrink-0">Add</Button>
                  </div>
                  {formData.specialSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.specialSkills.map((skill, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" id="active-check" checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <Label htmlFor="active-check" className="text-slate-700 font-medium text-sm cursor-pointer">Active</Label>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">Save Lead</Button>
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-100 shadow-sm p-1 w-fit">
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'approved' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}>
          Approved Leads
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
          }`}>
          <Clock size={13} /> Pending Applications
          {pendingLeads.length > 0 && (
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
              activeTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
            }`}>{pendingLeads.length}</span>
          )}
        </button>
      </div>

      {/* ── Pending Applications Panel ── */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={26} className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">No pending applications</p>
            </div>
          ) : (
            pendingLeads.map((lead) => (
              <div key={lead.id} className="bg-white rounded-xl border border-amber-100 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(lead.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {lead.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-sm">{lead.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{lead.age}y · {lead.gender} · {lead.phone}</p>
                  {lead.email && <p className="text-xs text-slate-400">{lead.email}</p>}
                  {lead.languages?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {lead.languages.map((lang, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-100">{lang}</span>
                      ))}
                    </div>
                  )}
                  {lead.specialSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {lead.specialSkills.map((sk, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-600 ring-1 ring-violet-100">{sk}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm"
                    onClick={() => handleApprove(lead.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs">
                    <CheckCircle size={13} /> Approve
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => handleReject(lead.id)}
                    className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 gap-1.5 h-8 text-xs">
                    <XCircle size={13} /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Approved leads section (search + grid) — hidden when on pending tab ── */}
      {activeTab === 'approved' && <>

      {/* ── Search & Filter toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
            <Input
              placeholder="Search by name, phone, email, language or skill…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-slate-50 border-transparent focus:border-slate-200 focus:bg-white rounded-lg text-sm transition-all"
              data-testid="lead-search"
            />
          </div>

          <div className="w-px h-5 bg-slate-100 flex-shrink-0" />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Filter size={11} className="text-slate-300" />
            {['All', 'Active', 'Inactive'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                  statusFilter === s
                    ? s === 'Active' ? 'bg-emerald-500 text-white shadow-sm'
                    : s === 'Inactive' ? 'bg-slate-400 text-white shadow-sm'
                    : 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                {s}
              </button>
            ))}
          </div>

          {hasActiveFilter && (
            <button onClick={clearAll}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex-shrink-0 transition-all">
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Lead Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-slate-300" />
          </div>
          {hasActiveFilter ? (
            <>
              <p className="text-slate-400 font-medium">No leads match your search</p>
              <button onClick={clearAll} className="text-xs text-blue-500 hover:text-blue-700 mt-2 underline underline-offset-2">Clear filters</button>
            </>
          ) : (
            <p className="text-slate-400 font-medium">No leads added yet</p>
          )}
        </div>
      ) : (
        <>
          {/* Results meta */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)}</span>
              {' '}of{' '}
              <span className="font-semibold text-slate-600">{filteredLeads.length}</span> lead{filteredLeads.length !== 1 ? 's' : ''}
              {statusFilter !== 'All' && <span className={`ml-1 ${statusFilter === 'Active' ? 'text-emerald-500' : 'text-slate-400'}`}>· {statusFilter}</span>}
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((lead) => (
              <div key={lead.id} data-testid={`lead-card-${lead.id}`}
                className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex flex-col group">

                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(lead.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {lead.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{lead.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                          lead.active
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${lead.active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          {lead.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{lead.age}y · {lead.gender}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-3 flex-1 space-y-2">
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone size={12} className="text-slate-300 flex-shrink-0" />
                      {lead.phone}
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail size={12} className="text-slate-300 flex-shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.hiredDate && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={12} className="text-slate-300 flex-shrink-0" />
                      Joined {new Date(lead.hiredDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}

                  {/* Languages */}
                  {lead.languages?.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Languages size={10} className="text-slate-300" />
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Languages</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lead.languages.map((lang, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-100">{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {lead.specialSkills?.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Zap size={10} className="text-slate-300" />
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Skills</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lead.specialSkills.map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-600 ring-1 ring-violet-100">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 pb-4 pt-2 border-t border-slate-50 flex gap-2">
                  <Button data-testid={`edit-lead-${lead.id}`} size="sm" variant="ghost"
                    onClick={() => openEditDialog(lead)}
                    className="flex-1 h-8 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg gap-1.5">
                    <Edit size={13} /> Edit
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => setDeleteTarget(lead)}
                    className="h-8 px-2.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && arr[i - 1] !== p - 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === '...' ? (
                      <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-300">…</span>
                    ) : (
                      <button key={item} onClick={() => setCurrentPage(item)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                          currentPage === item ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}>
                        {item}
                      </button>
                    )
                  )
                }

                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      </>}

      {/* ── Credentials Modal ── */}
      {createdCreds && (
        <Dialog open={!!createdCreds} onOpenChange={() => setCreatedCreds(null)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-bold text-lg">Login Credentials Created</DialogTitle>
            </DialogHeader>
            <div className="space-y-4" data-testid="creds-display">
              <p className="text-sm text-slate-500">Share these with <span className="font-semibold text-slate-800">{createdCreds.name}</span> so they can log in.</p>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 font-mono text-sm">
                {[
                  { label: 'Email', value: createdCreds.email, testId: 'creds-email' },
                  { label: 'Password', value: createdCreds.password, testId: 'creds-password' },
                  { label: 'Role', value: createdCreds.role, testId: 'creds-role' },
                ].map(({ label, value, testId }) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-400 text-xs">{label}</span>
                    <span className="font-semibold text-slate-900 text-xs" data-testid={testId}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <Star size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Copy these before closing — the password won't be shown again.</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" data-testid="copy-creds-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}\nRole: ${createdCreds.role}`);
                    toast.success('Credentials copied to clipboard');
                  }}>
                  <Copy size={14} /> Copy
                </Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setCreatedCreds(null)}>Done</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-bold text-lg flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" /> Delete Lead Profile
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(deleteTarget.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {deleteTarget.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{deleteTarget.name}</p>
                  {deleteTarget.email && <p className="text-xs text-slate-400">{deleteTarget.email}</p>}
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-red-700">This action cannot be undone.</p>
                <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                  <li>The lead profile will be permanently removed</li>
                  <li>Their login account will be deleted</li>
                  <li>They will lose access to the system immediately</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1"
                  onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                  onClick={handleDeleteConfirmed}>
                  <Trash2 size={14} /> Delete Permanently
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default LeadManagement;