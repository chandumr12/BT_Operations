import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Edit, Archive, Mountain, Search, Filter,
  ChevronLeft, ChevronRight, X, MapPin, Gauge, Clock, Navigation
} from 'lucide-react';

const DIFFICULTY_CONFIG = {
  'Easy':          { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-400' },
  'Moderate':      { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400' },
  'Difficult':     { bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200',  dot: 'bg-orange-400' },
  'Very Difficult':{ bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     dot: 'bg-red-400' },
};

const CATEGORIES = ['Karnataka', 'Kerala', 'Himalayas', 'Sunrise', 'Backpacking', 'Kids Batch'];
const DIFFICULTIES = ['Easy', 'Moderate', 'Difficult', 'Very Difficult'];
const PAGE_SIZE = 9;

const TrekMaster = () => {
  const [treks, setTreks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrek, setEditingTrek] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    name: '', region: '', distanceFromBengaluru: '', trekDistance: '',
    altitude: '', difficultyLevel: 'Easy', bestTimeToVisit: '',
    meetingPoint: '', reportingTime: '', requiredPermissions: '',
    vendorNotes: '', internalNotes: '', trekType: '1-day', category: 'Karnataka'
  });

  useEffect(() => { fetchTreks(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryFilter, difficultyFilter]);

  const fetchTreks = async () => {
    try {
      const response = await api.get('/treks');
      setTreks(response.data);
    } catch {
      toast.error('Failed to fetch treks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTrek) {
        await api.patch(`/treks/${editingTrek.id}`, formData);
        toast.success('Trek updated successfully');
      } else {
        await api.post('/treks', formData);
        toast.success('Trek created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchTreks();
    } catch {
      toast.error('Failed to save trek');
    }
  };

  const handleArchive = async (trekId) => {
    if (!window.confirm('Archive this trek?')) return;
    try {
      await api.patch(`/treks/${trekId}`, { archived: true });
      toast.success('Trek archived');
      fetchTreks();
    } catch {
      toast.error('Failed to archive trek');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', region: '', distanceFromBengaluru: '', trekDistance: '',
      altitude: '', difficultyLevel: 'Easy', bestTimeToVisit: '',
      meetingPoint: '', reportingTime: '', requiredPermissions: '',
      vendorNotes: '', internalNotes: '', trekType: '1-day', category: 'Karnataka'
    });
    setEditingTrek(null);
  };

  const openEditDialog = (trek) => {
    setEditingTrek(trek);
    setFormData(trek);
    setDialogOpen(true);
  };

  const filteredTreks = treks.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      t.name?.toLowerCase().includes(q) ||
      t.region?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q);
    const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
    const matchDifficulty = difficultyFilter === 'All' || t.difficultyLevel === difficultyFilter;
    return matchSearch && matchCategory && matchDifficulty;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTreks.length / PAGE_SIZE));
  const paginated = filteredTreks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasActiveFilter = searchQuery || categoryFilter !== 'All' || difficultyFilter !== 'All';
  const clearAll = () => { setSearchQuery(''); setCategoryFilter('All'); setDifficultyFilter('All'); };

  return (
    <div data-testid="trek-master-page" className="space-y-5">

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="relative px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Mountain size={22} className="text-blue-200" />
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Trek Master</h1>
            </div>
            <p className="text-blue-200 text-sm">{treks.length} trek{treks.length !== 1 ? 's' : ''} configured</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-trek-button"
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-sm flex items-center gap-2 flex-shrink-0">
                <Plus size={16} /> Add New Trek
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-slate-900 font-bold text-lg">{editingTrek ? 'Edit Trek' : 'Add New Trek'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Trek Name *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="bg-white mt-1" data-testid="trek-name-input" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Category *</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Region *</Label>
                    <Input value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value})} required className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Distance from Bengaluru *</Label>
                    <Input value={formData.distanceFromBengaluru} onChange={(e) => setFormData({...formData, distanceFromBengaluru: e.target.value})} placeholder="e.g., 250 km" required className="bg-white mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Trek Distance *</Label>
                    <Input value={formData.trekDistance} onChange={(e) => setFormData({...formData, trekDistance: e.target.value})} placeholder="e.g., 8 km one way" required className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Altitude *</Label>
                    <Input value={formData.altitude} onChange={(e) => setFormData({...formData, altitude: e.target.value})} placeholder="e.g., 1800 m" required className="bg-white mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Difficulty Level *</Label>
                    <Select value={formData.difficultyLevel} onValueChange={(val) => setFormData({...formData, difficultyLevel: val})}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Trek Type *</Label>
                    <Select value={formData.trekType} onValueChange={(val) => setFormData({...formData, trekType: val})}>
                      <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="1-day">1-day</SelectItem>
                        <SelectItem value="2-day">2-day</SelectItem>
                        <SelectItem value="Himalayan">Himalayan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Best Time to Visit</Label>
                  <Input value={formData.bestTimeToVisit} onChange={(e) => setFormData({...formData, bestTimeToVisit: e.target.value})} placeholder="e.g., October to March" className="bg-white mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Meeting Point</Label>
                    <Input value={formData.meetingPoint} onChange={(e) => setFormData({...formData, meetingPoint: e.target.value})} className="bg-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium text-sm">Reporting Time</Label>
                    <Input value={formData.reportingTime} onChange={(e) => setFormData({...formData, reportingTime: e.target.value})} placeholder="e.g., 6:00 AM" className="bg-white mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Required Permissions</Label>
                  <Textarea value={formData.requiredPermissions} onChange={(e) => setFormData({...formData, requiredPermissions: e.target.value})} rows={2} className="bg-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Vendor Notes</Label>
                  <Textarea value={formData.vendorNotes} onChange={(e) => setFormData({...formData, vendorNotes: e.target.value})} rows={2} className="bg-white mt-1" />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium text-sm">Internal SOP Notes</Label>
                  <Textarea value={formData.internalNotes} onChange={(e) => setFormData({...formData, internalNotes: e.target.value})} rows={2} className="bg-white mt-1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">Save Trek</Button>
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filter toolbar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
              <Input
                placeholder="Search by trek name, region or category…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-slate-50 border-transparent focus:border-slate-200 focus:bg-white rounded-lg text-sm transition-all"
                data-testid="trek-search"
              />
            </div>
            {hasActiveFilter && (
              <button onClick={clearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex-shrink-0 transition-all">
                <X size={11} /> Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Category chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Filter size={10} /> Category
              </span>
              {['All', ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setCategoryFilter(c)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                    categoryFilter === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}>
                  {c}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-slate-100 hidden sm:block" />

            {/* Difficulty chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Gauge size={10} /> Difficulty
              </span>
              {['All', ...DIFFICULTIES].map(d => {
                const dc = DIFFICULTY_CONFIG[d];
                const isActive = difficultyFilter === d;
                return (
                  <button key={d} onClick={() => setDifficultyFilter(d)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ring-1 ${
                      isActive && dc
                        ? `${dc.bg} ${dc.text} ${dc.ring}`
                        : isActive
                        ? 'bg-slate-600 text-white ring-slate-600'
                        : 'bg-slate-50 text-slate-500 ring-slate-100 hover:bg-slate-100'
                    }`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Trek Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filteredTreks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Mountain size={28} className="text-slate-300" />
          </div>
          {hasActiveFilter ? (
            <>
              <p className="text-slate-400 font-medium">No treks match your filters</p>
              <button onClick={clearAll} className="text-xs text-blue-500 hover:text-blue-700 mt-2 underline underline-offset-2">
                Clear all filters
              </button>
            </>
          ) : (
            <p className="text-slate-400 font-medium">No treks added yet</p>
          )}
        </div>
      ) : (
        <>
          {/* Results meta */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTreks.length)}</span>
              {' '}of{' '}
              <span className="font-semibold text-slate-600">{filteredTreks.length}</span> trek{filteredTreks.length !== 1 ? 's' : ''}
              {categoryFilter !== 'All' && <span className="ml-1 text-blue-500">· {categoryFilter}</span>}
              {difficultyFilter !== 'All' && <span className="ml-1 text-blue-500">· {difficultyFilter}</span>}
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((trek) => {
              const dc = DIFFICULTY_CONFIG[trek.difficultyLevel] || DIFFICULTY_CONFIG['Easy'];
              return (
                <div key={trek.id} data-testid={`trek-card-${trek.id}`}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex flex-col group">

                  {/* Header */}
                  <div className="px-4 pt-4 pb-3 border-b border-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Mountain size={15} className="text-blue-600" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">{trek.name}</h3>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 flex-shrink-0 ${dc.bg} ${dc.text} ${dc.ring}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />
                        {trek.difficultyLevel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 ring-1 ring-blue-100">{trek.category}</span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 ring-1 ring-slate-100">{trek.trekType}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 flex-1 space-y-1.5">
                    {trek.region && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin size={12} className="text-slate-300 flex-shrink-0" />
                        <span className="truncate">{trek.region}</span>
                      </div>
                    )}
                    {(trek.altitude || trek.trekDistance) && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Navigation size={12} className="text-slate-300 flex-shrink-0" />
                        <span>{[trek.altitude, trek.trekDistance].filter(Boolean).join(' · ')}</span>
                      </div>
                    )}
                    {trek.distanceFromBengaluru && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock size={12} className="text-slate-300 flex-shrink-0" />
                        <span>{trek.distanceFromBengaluru} from Bengaluru</span>
                      </div>
                    )}
                    {trek.bestTimeToVisit && (
                      <p className="text-[11px] text-slate-400 italic pl-1">Best: {trek.bestTimeToVisit}</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-4 pt-2 flex items-center gap-2 border-t border-slate-50">
                    <Button data-testid={`edit-trek-${trek.id}`} size="sm" variant="ghost"
                      onClick={() => openEditDialog(trek)}
                      className="flex-1 h-8 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg gap-1.5">
                      <Edit size={13} /> Edit
                    </Button>
                    <div className="w-px h-4 bg-slate-100" />
                    <Button data-testid={`archive-trek-${trek.id}`} size="sm" variant="ghost"
                      onClick={() => handleArchive(trek.id)}
                      className="h-8 px-3 text-xs text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg gap-1.5">
                      <Archive size={13} /> Archive
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
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
    </div>
  );
};

export default TrekMaster;