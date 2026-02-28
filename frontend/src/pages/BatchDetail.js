import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Upload, Plus, Trash2, Users, Star,
  Calendar, MapPin, CheckCircle, XCircle, Loader2, Edit, Search,
  DollarSign, Save, Receipt, FileText, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';

const BatchDetail = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('participants');
  const [batch, setBatch] = useState(null);
  const [trek, setTrek] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editParticipant, setEditParticipant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    slNo: '', fullName: '', contactNo: '', age: '', gender: 'Male',
    pickupPoint: '', totalPrice: '', amountPaid: '', balanceAmount: '',
    receiptMode: '', receiptDate: '', bookedBy: '', remarks: ''
  });

  // Expense state
  const [allExpenses, setAllExpenses] = useState([]);
  const [myExpense, setMyExpense] = useState({
    amountCollected: '', paidToDriver: '', lunchPacking: '', parkingCharges: '',
    jeepCharges: '', refundToCustomer: '', tickets: '', localGuide: '',
    leadsLunchExpenses: '', otherExpenses: '', otherExpensesRemarks: '',
    additionalExpenses: []
  });
  const [savingExpense, setSavingExpense] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef(null);

  // Feedback state
  const [allFeedback, setAllFeedback] = useState([]);
  const [myFeedback, setMyFeedback] = useState({ positive: '', negative: '' });
  const [savingFeedback, setSavingFeedback] = useState(false);

  const isAdmin = ['Super Admin', 'Operations Manager'].includes(userProfile?.role);

  useEffect(() => { fetchAll(); }, [batchId]);

  const fetchAll = async () => {
    try {
      const [batchRes, partRes] = await Promise.all([
        api.get(`/batches/${batchId}`),
        api.get(`/batches/${batchId}/participants`)
      ]);
      setBatch(batchRes.data);
      setParticipants(partRes.data);
      if (batchRes.data.trekId) {
        try {
          const trekRes = await api.get(`/treks/${batchRes.data.trekId}`);
          setTrek(trekRes.data);
        } catch {}
      }
    } catch (error) {
      toast.error('Failed to load batch details');
    }
    // Load expenses
    try {
      const [allExpRes, myExpRes] = await Promise.all([
        api.get(`/batches/${batchId}/expenses`),
        api.get(`/batches/${batchId}/expenses/my`)
      ]);
      setAllExpenses(allExpRes.data);
      if (myExpRes.data) {
        setMyExpense({
          amountCollected: myExpRes.data.amountCollected?.toString() || '',
          paidToDriver: myExpRes.data.paidToDriver?.toString() || '',
          lunchPacking: myExpRes.data.lunchPacking?.toString() || '',
          parkingCharges: myExpRes.data.parkingCharges?.toString() || '',
          jeepCharges: myExpRes.data.jeepCharges?.toString() || '',
          refundToCustomer: myExpRes.data.refundToCustomer?.toString() || '',
          tickets: myExpRes.data.tickets?.toString() || '',
          localGuide: myExpRes.data.localGuide?.toString() || '',
          leadsLunchExpenses: myExpRes.data.leadsLunchExpenses?.toString() || '',
          otherExpenses: myExpRes.data.otherExpenses?.toString() || '',
          otherExpensesRemarks: myExpRes.data.otherExpensesRemarks || '',
          additionalExpenses: myExpRes.data.additionalExpenses || [],
        });
      }
    } catch {}
    // Load documents and feedback
    try {
      const [docsRes, fbAllRes] = await Promise.all([
        api.get(`/batches/${batchId}/documents`),
        api.get(`/batches/${batchId}/feedback`)
      ]);
      setDocuments(docsRes.data);
      setAllFeedback(fbAllRes.data);
      const mine = fbAllRes.data.find(f => f.userId === currentUser?.uid);
      if (mine) setMyFeedback({ positive: mine.positive || '', negative: mine.negative || '' });
    } catch {}
    setLoading(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(`/batches/${batchId}/participants/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participant_template_${batch?.batchCode || batchId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch { toast.error('Download failed'); }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/batches/${batchId}/participants/import`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`${res.data.count} participants imported`);
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) { toast.error('Full Name is required'); return; }
    try {
      const payload = {
        ...formData,
        totalPrice: parseFloat(formData.totalPrice) || 0,
        amountPaid: parseFloat(formData.amountPaid) || 0,
        balanceAmount: parseFloat(formData.balanceAmount) || 0,
      };
      if (editParticipant) {
        await api.patch(`/batches/${batchId}/participants/${editParticipant.id}`, payload);
        toast.success('Participant updated');
      } else {
        await api.post(`/batches/${batchId}/participants`, payload);
        toast.success('Participant added');
      }
      setAddDialogOpen(false);
      resetForm();
      fetchAll();
    } catch { toast.error('Failed to save participant'); }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Remove ${p.fullName}?`)) return;
    try {
      await api.delete(`/batches/${batchId}/participants/${p.id}`);
      toast.success('Participant removed');
      fetchAll();
    } catch { toast.error('Failed to remove'); }
  };

  const toggleBoarded = async (p) => {
    try {
      await api.patch(`/batches/${batchId}/participants/${p.id}`, { boarded: !p.boarded, noShow: false });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, boarded: !x.boarded, noShow: false } : x));
    } catch { toast.error('Failed to update boarding'); }
  };

  const toggleNoShow = async (p) => {
    try {
      await api.patch(`/batches/${batchId}/participants/${p.id}`, { noShow: !p.noShow, boarded: false });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, noShow: !x.noShow, boarded: false } : x));
    } catch { toast.error('Failed to update'); }
  };

  const updateAmountCollected = async (p, amount) => {
    try {
      await api.patch(`/batches/${batchId}/participants/${p.id}`, { amountCollected: parseFloat(amount) || 0 });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, amountCollected: parseFloat(amount) || 0 } : x));
    } catch { toast.error('Failed to update'); }
  };

  const resetForm = () => {
    setFormData({
      slNo: '', fullName: '', contactNo: '', age: '', gender: 'Male',
      pickupPoint: '', totalPrice: '', amountPaid: '', balanceAmount: '',
      receiptMode: '', receiptDate: '', bookedBy: '', remarks: ''
    });
    setEditParticipant(null);
  };

  const openEditDialog = (p) => {
    setEditParticipant(p);
    setFormData({
      slNo: p.slNo || '', fullName: p.fullName || '', contactNo: p.contactNo || '',
      age: p.age || '', gender: p.gender || 'Male', pickupPoint: p.pickupPoint || '',
      totalPrice: p.totalPrice?.toString() || '', amountPaid: p.amountPaid?.toString() || '',
      balanceAmount: p.balanceAmount?.toString() || '', receiptMode: p.receiptMode || '',
      receiptDate: p.receiptDate || '', bookedBy: p.bookedBy || '', remarks: p.remarks || ''
    });
    setAddDialogOpen(true);
  };

  const filteredParticipants = participants.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.fullName?.toLowerCase().includes(q) || p.contactNo?.includes(q) || p.pickupPoint?.toLowerCase().includes(q);
  });

  const totalBalance = participants.reduce((s, p) => s + (p.balanceAmount || 0), 0);
  const totalCollected = participants.reduce((s, p) => s + (p.amountCollected || 0), 0);
  const boardedCount = participants.filter(p => p.boarded).length;
  const noShowCount = participants.filter(p => p.noShow).length;

  // Expense calculations
  const myExpenseNum = (field) => parseFloat(myExpense[field]) || 0;
  const fixedSpent = myExpenseNum('paidToDriver') + myExpenseNum('lunchPacking') + myExpenseNum('parkingCharges') +
    myExpenseNum('jeepCharges') + myExpenseNum('refundToCustomer') + myExpenseNum('tickets') +
    myExpenseNum('localGuide') + myExpenseNum('leadsLunchExpenses') + myExpenseNum('otherExpenses');
  const additionalSpent = (myExpense.additionalExpenses || []).reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
  const myTotalSpent = fixedSpent + additionalSpent;
  const myRemaining = myExpenseNum('amountCollected') - myTotalSpent;

  const addExpenseRow = () => {
    setMyExpense(prev => ({
      ...prev,
      additionalExpenses: [...(prev.additionalExpenses || []), { reason: '', amount: '' }]
    }));
  };

  const updateExpenseRow = (idx, field, value) => {
    setMyExpense(prev => {
      const updated = [...(prev.additionalExpenses || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, additionalExpenses: updated };
    });
  };

  const removeExpenseRow = (idx) => {
    setMyExpense(prev => ({
      ...prev,
      additionalExpenses: (prev.additionalExpenses || []).filter((_, i) => i !== idx)
    }));
  };

  const handleSaveExpense = async () => {
    setSavingExpense(true);
    try {
      await api.post(`/batches/${batchId}/expenses`, myExpense);
      toast.success('Expense sheet saved');
      const allExpRes = await api.get(`/batches/${batchId}/expenses`);
      setAllExpenses(allExpRes.data);
    } catch { toast.error('Failed to save expense'); }
    setSavingExpense(false);
  };

  // Document handlers
  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/batches/${batchId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded');
      const res = await api.get(`/batches/${batchId}/documents`);
      setDocuments(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
    setUploadingDoc(false);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleDownloadDocument = async (doc) => {
    try {
      const response = await api.get(`/batches/${batchId}/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    try {
      await api.delete(`/batches/${batchId}/documents/${doc.id}`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Document deleted');
    } catch { toast.error('Delete failed'); }
  };

  // Feedback handlers
  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    try {
      await api.post(`/batches/${batchId}/feedback`, myFeedback);
      toast.success('Feedback saved');
      const res = await api.get(`/batches/${batchId}/feedback`);
      setAllFeedback(res.data);
    } catch { toast.error('Failed to save feedback'); }
    setSavingFeedback(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  if (!batch) {
    return <div className="text-center py-12 text-slate-500">Batch not found</div>;
  }

  // Tab icon + count helper
  const tabConfig = [
    { key: 'participants', label: 'Participants', icon: Users, count: participants.length },
    { key: 'expenses', label: 'Expenses', icon: Receipt, count: allExpenses.length },
    { key: 'documents', label: 'Documents', icon: FileText, count: documents.length },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare, count: allFeedback.length },
  ];

  const capacityPct = batch.maxCapacity > 0 ? Math.min(100, Math.round((batch.currentRegistrations / batch.maxCapacity) * 100)) : 0;

  return (
    <div data-testid="batch-detail-page" className="space-y-0">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl mb-6"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)' }}>
        {/* Subtle geometric accent */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 opacity-5"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative px-4 pt-4 pb-5 md:px-8 md:pt-6 md:pb-7">
          {/* Back + status row */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/batches')}
              data-testid="back-to-batches"
              className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-sm font-medium group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">All Batches</span>
            </button>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
              batch.status === 'Open' ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/40' :
              batch.status === 'Completed' ? 'bg-blue-300/20 text-blue-200 ring-1 ring-blue-300/40' :
              'bg-white/10 text-white/70 ring-1 ring-white/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${batch.status === 'Open' ? 'bg-emerald-400' : batch.status === 'Completed' ? 'bg-blue-300' : 'bg-white/50'}`} />
              {batch.status}
            </span>
          </div>

          {/* Batch code + trek name */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-none mb-1">
              {batch.batchCode}
            </h1>
            <p className="text-blue-200 text-sm md:text-base font-medium flex items-center gap-1.5">
              <MapPin size={14} className="flex-shrink-0" />
              {trek?.name || 'Unknown Trek'}
            </p>
          </div>

          {/* Meta pills + capacity */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
              <Calendar size={12} />
              <span>
                {new Date(batch.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}
                {' – '}
                {new Date(batch.endDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
              <Users size={12} />
              <span>{batch.currentRegistrations} / {batch.maxCapacity} seats</span>
            </div>
          </div>

          {/* Capacity bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-blue-200 font-medium">Capacity</span>
              <span className="text-xs text-white font-semibold">{capacityPct}%</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${capacityPct}%`,
                  background: capacityPct >= 90 ? '#f87171' : capacityPct >= 70 ? '#fb923c' : '#34d399'
                }}
              />
            </div>
          </div>

          {/* Assigned Leads */}
          {batch.assignedLeads && batch.assignedLeads.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-blue-300 font-medium uppercase tracking-wide">Leads</span>
              {batch.assignedLeads.map(l => (
                <div key={l.userId} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ring-1 ${
                  l.isSuperLead
                    ? 'bg-amber-400/20 text-amber-200 ring-amber-400/40'
                    : 'bg-white/10 text-white/80 ring-white/20'
                }`}>
                  {l.isSuperLead && <Star size={10} className="fill-amber-400 text-amber-400 flex-shrink-0" />}
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                    {l.displayName?.charAt(0)?.toUpperCase()}
                  </div>
                  {l.displayName}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar — sits at bottom of hero */}
        <div className="flex border-t border-white/10 overflow-x-auto" data-testid="batch-tabs">
          {tabConfig.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              data-testid={`tab-${key}`}
              className={`relative flex items-center gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                activeTab === key
                  ? 'text-white bg-white/10'
                  : 'text-blue-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] ${
                activeTab === key ? 'bg-white/20 text-white' : 'bg-white/10 text-blue-300'
              }`}>{count}</span>
              {activeTab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'participants' && (<>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4">
        {[
          { label: 'Total', value: participants.length, unit: 'participants', color: 'from-slate-700 to-slate-800', text: 'text-white', sub: 'text-slate-300', icon: <Users size={18} className="text-slate-300" /> },
          { label: 'Boarded', value: `${boardedCount}/${participants.length}`, unit: 'checked in', color: 'from-emerald-500 to-emerald-600', text: 'text-white', sub: 'text-emerald-100', icon: <CheckCircle size={18} className="text-emerald-200" /> },
          { label: 'No Show', value: noShowCount, unit: 'absent', color: 'from-red-500 to-red-600', text: 'text-white', sub: 'text-red-100', icon: <XCircle size={18} className="text-red-200" /> },
          { label: 'Balance Due', value: totalBalance.toLocaleString('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}), unit: 'outstanding', color: 'from-orange-400 to-orange-500', text: 'text-white', sub: 'text-orange-100', icon: <DollarSign size={18} className="text-orange-200" /> },
          { label: 'Collected', value: totalCollected.toLocaleString('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}), unit: 'on site', color: 'from-blue-500 to-blue-600', text: 'text-white', sub: 'text-blue-100', icon: <Receipt size={18} className="text-blue-200" /> },
        ].map(({ label, value, unit, color, text, sub, icon }) => (
          <div key={label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${color} p-4 shadow-sm`}>
            <div className="absolute -top-3 -right-3 opacity-10"><div className="w-16 h-16 rounded-full bg-white" /></div>
            <div className="flex items-start justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${sub}`}>{label}</span>
              {icon}
            </div>
            <p className={`text-xl md:text-2xl font-bold ${text} leading-none`}>{value}</p>
            <p className={`text-xs mt-1 ${sub}`}>{unit}</p>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm px-3 py-2.5 mb-4">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
            <Input
              placeholder="Search by name, contact, pickup point…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-slate-50 border-transparent focus:border-slate-200 focus:bg-white rounded-lg text-sm transition-all"
              data-testid="search-participants"
            />
          </div>

          {isAdmin && (
            <>
              <div className="w-px h-5 bg-slate-100 flex-shrink-0" />

              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} data-testid="download-template-btn"
                className="h-8 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg px-2.5 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Download size={13} /> Template
              </Button>

              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} data-testid="import-file-input" />
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="import-excel-btn"
                className="h-8 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg px-2.5 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? 'Importing…' : 'Import'}
              </Button>

              <Button size="sm" onClick={() => { resetForm(); setAddDialogOpen(true); }} data-testid="add-participant-btn"
                className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Plus size={13} /> Add Participant
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Participants Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" data-testid="participants-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-12">SL</th>
                <th className="px-3 py-2.5 w-10"></th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pickup</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Paid</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Balance</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28">Collected</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-24">Status</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredParticipants.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <Users size={36} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-slate-400 text-sm">No participants found</p>
                </td></tr>
              ) : filteredParticipants.map((p, idx) => (
                <tr key={p.id} data-testid={`participant-row-${p.id}`}
                  className={`transition-colors group ${p.boarded ? 'bg-emerald-50/40' : p.noShow ? 'bg-red-50/40' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/30`}>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{p.slNo || idx + 1}</td>
                  <td className="px-3 py-3">
                    <Checkbox checked={p.boarded} onCheckedChange={() => toggleBoarded(p)} data-testid={`boarding-checkbox-${p.id}`} />
                  </td>
                  <td className="px-3 py-3">
                    <p className={`font-medium text-sm ${p.boarded ? 'text-emerald-700' : 'text-slate-800'}`}>{p.fullName}</p>
                    {p.age && <p className="text-xs text-slate-400">{p.age}y · {p.gender}</p>}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-600">{p.contactNo}</td>
                  <td className="px-3 py-3 text-sm text-slate-600">{p.pickupPoint}</td>
                  <td className="px-3 py-3 text-right text-sm text-slate-700 tabular-nums">{(p.totalPrice || 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-sm text-slate-700 tabular-nums">{(p.amountPaid || 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className={`text-sm font-semibold ${(p.balanceAmount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {(p.balanceAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Input type="number" value={p.amountCollected || ''}
                      onChange={(e) => setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, amountCollected: parseFloat(e.target.value) || 0 } : x))}
                      onBlur={(e) => updateAmountCollected(p, e.target.value)}
                      className="w-24 h-7 text-xs bg-white text-right ml-auto border-slate-200"
                      placeholder="0" data-testid={`collected-input-${p.id}`} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    {p.noShow ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">No Show</span>
                    ) : p.boarded ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Boarded</span>
                    ) : p.cancelledReason ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Cancelled</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">{p.status || 'Confirmed'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleNoShow(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.noShow ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                        title={p.noShow ? 'Undo No Show' : 'Mark No Show'} data-testid={`noshow-btn-${p.id}`}>
                        <XCircle size={13} />
                      </button>
                      {isAdmin && (<>
                        <button onClick={() => openEditDialog(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" data-testid={`edit-participant-${p.id}`}>
                          <Edit size={13} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" data-testid={`delete-participant-${p.id}`}>
                          <Trash2 size={13} />
                        </button>
                      </>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Participant Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="heading-font text-slate-900">{editParticipant ? 'Edit Participant' : 'Add Participant'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddOrEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-900 font-medium">SL No</Label>
                <Input value={formData.slNo} onChange={(e) => setFormData({...formData, slNo: e.target.value})} className="bg-white" />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-900 font-medium">Full Name *</Label>
                <Input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required className="bg-white" data-testid="participant-name-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-900 font-medium">Contact No</Label>
                <Input value={formData.contactNo} onChange={(e) => setFormData({...formData, contactNo: e.target.value})} className="bg-white" />
              </div>
              <div>
                <Label className="text-slate-900 font-medium">Age</Label>
                <Input value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} className="bg-white" />
              </div>
              <div>
                <Label className="text-slate-900 font-medium">Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-slate-900 font-medium">Pickup Point</Label>
              <Input value={formData.pickupPoint} onChange={(e) => setFormData({...formData, pickupPoint: e.target.value})} className="bg-white" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-900 font-medium">Total Price (incl GST)</Label>
                <Input type="number" value={formData.totalPrice} onChange={(e) => setFormData({...formData, totalPrice: e.target.value})} className="bg-white" />
              </div>
              <div>
                <Label className="text-slate-900 font-medium">Amount Paid</Label>
                <Input type="number" value={formData.amountPaid} onChange={(e) => setFormData({...formData, amountPaid: e.target.value})} className="bg-white" />
              </div>
              <div>
                <Label className="text-slate-900 font-medium">Balance Amount</Label>
                <Input type="number" value={formData.balanceAmount} onChange={(e) => setFormData({...formData, balanceAmount: e.target.value})} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-900 font-medium">Receipt Mode</Label>
                <Input value={formData.receiptMode} onChange={(e) => setFormData({...formData, receiptMode: e.target.value})} placeholder="Cash/UPI/Card" className="bg-white" />
              </div>
              <div>
                <Label className="text-slate-900 font-medium">Receipt Date</Label>
                <Input type="date" value={formData.receiptDate} onChange={(e) => setFormData({...formData, receiptDate: e.target.value})} className="bg-white" />
              </div>
              <div>
                <Label className="text-slate-900 font-medium">Booked By</Label>
                <Input value={formData.bookedBy} onChange={(e) => setFormData({...formData, bookedBy: e.target.value})} className="bg-white" />
              </div>
            </div>
            <div>
              <Label className="text-slate-900 font-medium">Remarks</Label>
              <Input value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} className="bg-white" />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" data-testid="save-participant-btn">{editParticipant ? 'Update' : 'Add'} Participant</Button>
              <Button type="button" variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </>)}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Collected', value: myExpenseNum('amountCollected'), color: 'from-emerald-500 to-emerald-600', testId: 'expense-summary-collected' },
              { label: 'Total Spent', value: myTotalSpent, color: 'from-red-500 to-red-600', testId: 'expense-summary-spent' },
              { label: myRemaining >= 0 ? 'Remaining' : 'Overspent', value: Math.abs(myRemaining), color: myRemaining >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600', testId: 'expense-summary-remaining' },
            ].map(({ label, value, color, testId }) => (
              <div key={label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${color} p-4 shadow-sm`}>
                <div className="absolute top-2 right-3 text-2xl font-black opacity-10">{label === 'Collected' ? '↓' : label === 'Total Spent' ? '↑' : '='}</div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl md:text-2xl font-bold text-white" data-testid={testId}>
                  {value.toLocaleString('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0})}
                </p>
              </div>
            ))}
          </div>

          {/* My Expense Sheet */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" data-testid="my-expense-sheet">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Receipt size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">My Expense Sheet</h3>
                  <p className="text-xs text-slate-400">Log your expenses for this batch</p>
                </div>
              </div>
              <Button onClick={handleSaveExpense} disabled={savingExpense} size="sm" data-testid="save-expense-btn"
                className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm h-8 text-xs self-start sm:self-auto">
                {savingExpense ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                {savingExpense ? 'Saving…' : 'Save Expenses'}
              </Button>
            </div>
            <div className="p-0">
              {/* Income Row */}
              <div className="bg-green-50/60 border-b border-green-100 px-3 md:px-6 py-3 md:py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <DollarSign size={16} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-900 text-sm md:text-base">Amount Collected</p>
                      <p className="text-xs text-green-600">Cash collected from participants</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-11 sm:pl-0">
                    <span className="text-sm text-green-600 font-medium">INR</span>
                    <Input
                      type="number"
                      value={myExpense.amountCollected}
                      onChange={(e) => setMyExpense({...myExpense, amountCollected: e.target.value})}
                      className="w-28 md:w-36 text-right bg-white border-green-200 focus:border-green-400 font-semibold text-green-800"
                      placeholder="0"
                      data-testid="expense-amount-collected"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Expense Items */}
              <div className="divide-y divide-slate-100">
                {[
                  { key: 'paidToDriver', label: 'Paid to Driver', icon: '🚐', desc: 'Transport driver payment' },
                  { key: 'lunchPacking', label: 'Lunch Packing', icon: '🍱', desc: 'Packed meals cost' },
                  { key: 'parkingCharges', label: 'Parking Charges', icon: '🅿️', desc: 'Vehicle parking fees' },
                  { key: 'jeepCharges', label: 'Jeep Charges', icon: '🚙', desc: 'Off-road vehicle hire' },
                  { key: 'refundToCustomer', label: 'Refund to Customer', icon: '↩️', desc: 'Cancelled/partial refunds' },
                  { key: 'tickets', label: 'Tickets / Entry Fees', icon: '🎫', desc: 'Park/monument entry' },
                  { key: 'localGuide', label: 'Local Guide', icon: '🧭', desc: 'Local guide hire' },
                  { key: 'leadsLunchExpenses', label: 'Leads Lunch', icon: '🍽️', desc: 'Lead team meals' },
                  { key: 'otherExpenses', label: 'Other Expenses', icon: '📋', desc: 'Miscellaneous costs' },
                ].map(({ key, label, icon, desc }, idx) => (
                  <div key={key} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 px-3 md:px-6 py-2.5 md:py-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-base md:text-lg w-6 md:w-8 text-center flex-shrink-0">{icon}</span>
                      <div>
                        <p className="font-medium text-slate-800 text-xs md:text-sm">{label}</p>
                        <p className="text-xs text-slate-400 hidden md:block">{desc}</p>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={myExpense[key]}
                      onChange={(e) => setMyExpense({...myExpense, [key]: e.target.value})}
                      className="w-28 md:w-36 text-right bg-white ml-8 sm:ml-0"
                      placeholder="0"
                      data-testid={`expense-${key}`}
                    />
                  </div>
                ))}
                {myExpense.otherExpenses && parseFloat(myExpense.otherExpenses) > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 px-3 md:px-6 py-2 bg-slate-50/40">
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-lg w-6 md:w-8 text-center"></span>
                      <p className="text-xs text-slate-500 italic">Other expenses remarks</p>
                    </div>
                    <Input
                      value={myExpense.otherExpensesRemarks}
                      onChange={(e) => setMyExpense({...myExpense, otherExpensesRemarks: e.target.value})}
                      className="w-full sm:w-56 bg-white text-sm ml-8 sm:ml-0"
                      placeholder="Details for other expenses"
                    />
                  </div>
                )}
              </div>

              {/* Additional Custom Expenses */}
              <div className="border-t border-dashed border-slate-200">
                <div className="px-4 md:px-6 py-3 bg-slate-50/60 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">Additional Expenses</p>
                    <p className="text-xs text-slate-400">Add custom expense items with reasons</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addExpenseRow}
                    className="h-8 text-xs border-dashed border-slate-300 text-slate-500 hover:bg-white flex-shrink-0 flex items-center gap-1.5"
                    data-testid="add-expense-row-btn">
                    <Plus size={13} /> Add Expense
                  </Button>
                </div>
                {(myExpense.additionalExpenses || []).length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {(myExpense.additionalExpenses || []).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-4 md:px-6 py-2.5" data-testid={`additional-expense-${idx}`}>
                        <span className="text-slate-300 text-xs font-mono w-5 flex-shrink-0">{idx + 1}.</span>
                        <Input
                          value={item.reason}
                          onChange={(e) => updateExpenseRow(idx, 'reason', e.target.value)}
                          className="flex-1 bg-white h-8 text-sm"
                          placeholder="Reason / Description"
                          data-testid={`additional-reason-${idx}`}
                        />
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateExpenseRow(idx, 'amount', e.target.value)}
                          className="w-28 text-right bg-white h-8 text-sm flex-shrink-0"
                          placeholder="0"
                          data-testid={`additional-amount-${idx}`}
                        />
                        <button onClick={() => removeExpenseRow(idx)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                          data-testid={`remove-expense-row-${idx}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {additionalSpent > 0 && (
                      <div className="flex items-center justify-between px-3 md:px-6 py-2 bg-slate-50">
                        <span className="text-xs text-slate-500 font-medium sm:pl-9">Additional Total</span>
                        <span className="text-sm font-semibold text-red-600 w-28 md:w-36 text-right pr-8 sm:pr-10">
                          {additionalSpent.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* All Expenses Overview (Admin view) */}
          {isAdmin && allExpenses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" data-testid="all-expenses-overview">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <DollarSign size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">All Lead Expense Sheets</h3>
                  <p className="text-xs text-slate-400">{allExpenses.length} submission{allExpenses.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {allExpenses.map(exp => {
                  const addlTotal = (exp.additionalExpenses || []).reduce((s, i) => s + (i.amount || 0), 0);
                  return (
                    <div key={exp.id} className="p-4 md:p-5" data-testid={`expense-row-${exp.id}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {exp.leadName?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{exp.leadName}</p>
                            <p className="text-xs text-slate-400">Updated {new Date(exp.updatedAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-5 pl-12 sm:pl-0">
                          {[
                            { label: 'Collected', val: exp.amountCollected, cls: 'text-emerald-600' },
                            { label: 'Spent', val: exp.totalSpent, cls: 'text-red-600' },
                            { label: 'Remaining', val: exp.remaining, cls: (exp.remaining || 0) >= 0 ? 'text-blue-600' : 'text-orange-600' },
                          ].map(({ label, val, cls }) => (
                            <div key={label} className="text-right">
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                              <p className={`text-sm font-bold tabular-nums ${cls}`}>{(val || 0).toLocaleString('en-IN')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {[['Driver', exp.paidToDriver],['Lunch', exp.lunchPacking],['Parking', exp.parkingCharges],['Jeep', exp.jeepCharges],['Refund', exp.refundToCustomer],['Tickets', exp.tickets],['Guide', exp.localGuide],['Lead Lunch', exp.leadsLunchExpenses],['Other', exp.otherExpenses]]
                          .filter(([_, v]) => v > 0).map(([label, val]) => (
                          <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                            <p className="text-slate-400 text-[10px]">{label}</p>
                            <p className="font-semibold text-slate-700 tabular-nums">{(val || 0).toLocaleString('en-IN')}</p>
                          </div>
                        ))}
                        {(exp.additionalExpenses || []).filter(i => i.amount > 0).map((item, i) => (
                          <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                            <p className="text-amber-500 text-[10px] truncate max-w-[80px]">{item.reason || 'Extra'}</p>
                            <p className="font-semibold text-amber-800 tabular-nums">{(item.amount || 0).toLocaleString('en-IN')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Consolidated Total */}
                <div className="px-5 py-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="font-bold text-slate-800 text-sm">Consolidated Total</p>
                  <div className="flex items-center gap-5">
                    {[
                      { label: 'Collected', val: allExpenses.reduce((s,e) => s+(e.amountCollected||0),0), cls: 'text-emerald-700' },
                      { label: 'Spent', val: allExpenses.reduce((s,e) => s+(e.totalSpent||0),0), cls: 'text-red-700' },
                      { label: 'Remaining', val: allExpenses.reduce((s,e) => s+(e.remaining||0),0), cls: allExpenses.reduce((s,e) => s+(e.remaining||0),0) >= 0 ? 'text-blue-700' : 'text-orange-700' },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className={`text-sm font-bold tabular-nums ${cls}`}>{val.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4" data-testid="documents-tab">
          {isAdmin && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Upload size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Upload Document</p>
                  <p className="text-xs text-slate-400">PDF, Word, Excel, images — max 10MB</p>
                </div>
              </div>
              <div>
                <input type="file" ref={docInputRef} onChange={handleUploadDocument} className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt" data-testid="doc-file-input" />
                <Button variant="outline" size="sm" onClick={() => docInputRef.current?.click()} disabled={uploadingDoc}
                  data-testid="upload-doc-btn" className="rounded-lg border-slate-200 h-9 text-xs">
                  {uploadingDoc ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Upload size={13} className="mr-1.5" />}
                  {uploadingDoc ? 'Uploading…' : 'Upload File'}
                </Button>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <FileText size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium text-sm">No documents yet</p>
              {isAdmin && <p className="text-xs text-slate-300 mt-1">Upload permits, tickets or trek documents above</p>}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <FileText size={15} className="text-blue-600" />
                <span className="font-semibold text-slate-800 text-sm">Documents ({documents.length})</span>
              </div>
              <div className="divide-y divide-slate-50">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group" data-testid={`doc-${doc.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={16} className="text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(doc.size)} · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDownloadDocument(doc)} data-testid={`download-doc-${doc.id}`}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                        <Download size={15} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDeleteDocument(doc)} data-testid={`delete-doc-${doc.id}`}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="space-y-4" data-testid="feedback-tab">
          {/* My Feedback Form */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <MessageSquare size={15} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">My Feedback</h3>
                  <p className="text-xs text-slate-400">Share what went well and what can improve</p>
                </div>
              </div>
              <Button onClick={handleSaveFeedback} disabled={savingFeedback} size="sm" data-testid="save-feedback-btn"
                className="bg-blue-600 hover:bg-blue-700 rounded-lg h-8 text-xs self-start sm:self-auto">
                {savingFeedback ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                {savingFeedback ? 'Saving…' : 'Save Feedback'}
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-2 uppercase tracking-wide">
                  <ThumbsUp size={13} /> Positive Highlights
                </label>
                <textarea value={myFeedback.positive} onChange={(e) => setMyFeedback(prev => ({ ...prev, positive: e.target.value }))}
                  rows={3} data-testid="feedback-positive"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-y placeholder-slate-300"
                  placeholder="What went well on this trek? Great moments, highlights…" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">
                  <ThumbsDown size={13} /> Areas for Improvement
                </label>
                <textarea value={myFeedback.negative} onChange={(e) => setMyFeedback(prev => ({ ...prev, negative: e.target.value }))}
                  rows={3} data-testid="feedback-negative"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-y placeholder-slate-300"
                  placeholder="What could be improved? Issues, suggestions…" />
              </div>
            </div>
          </div>

          {/* All Feedback (Admin view) */}
          {isAdmin && allFeedback.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" data-testid="all-feedback-overview">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <MessageSquare size={15} className="text-blue-600" />
                <span className="font-semibold text-slate-800 text-sm">All Lead Feedback ({allFeedback.length})</span>
              </div>
              <div className="divide-y divide-slate-50">
                {allFeedback.map(fb => (
                  <div key={fb.id} className="p-5" data-testid={`feedback-${fb.id}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {fb.leadName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{fb.leadName}</p>
                        <p className="text-xs text-slate-400">{new Date(fb.updatedAt || fb.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {fb.positive && (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-semibold text-emerald-600 mb-1 flex items-center gap-1 uppercase tracking-wide"><ThumbsUp size={10} /> Positive</p>
                          <p className="text-sm text-emerald-800 whitespace-pre-wrap leading-relaxed">{fb.positive}</p>
                        </div>
                      )}
                      {fb.negative && (
                        <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                          <p className="text-[10px] font-semibold text-red-600 mb-1 flex items-center gap-1 uppercase tracking-wide"><ThumbsDown size={10} /> Improvement</p>
                          <p className="text-sm text-red-800 whitespace-pre-wrap leading-relaxed">{fb.negative}</p>
                        </div>
                      )}
                      {!fb.positive && !fb.negative && (
                        <p className="text-sm text-slate-300 italic">No feedback provided yet</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchDetail;