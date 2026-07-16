import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Upload, Plus, Trash2, Users, Star,
  Calendar, MapPin, CheckCircle, XCircle, Loader2, Edit, Search, Filter,
  DollarSign, Save, Receipt, FileText, MessageSquare, ThumbsUp, ThumbsDown,
  Truck, Package, Car, RotateCcw, Tag, Compass, MoreHorizontal, AlertTriangle,
  ClipboardList, Eye, Phone, SlidersHorizontal, IndianRupee, TrendingDown,
} from 'lucide-react';

const BRAND = '#f1563f';

const EXPENSE_ITEMS = [
  { key: 'paidToDriver',     label: 'Driver',         Icon: Truck          },
  { key: 'lunchPacking',     label: 'Lunch Packing',  Icon: Package        },
  { key: 'parkingCharges',   label: 'Parking',        Icon: MapPin         },
  { key: 'jeepCharges',      label: 'Jeep Charges',   Icon: Car            },
  { key: 'refundToCustomer', label: 'Refund',         Icon: RotateCcw      },
  { key: 'tickets',          label: 'Entry Fees',     Icon: Tag            },
  { key: 'localGuide',       label: 'Local Guide',    Icon: Compass        },
  { key: 'otherExpenses',    label: 'Other',          Icon: MoreHorizontal },
];

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtCur = (n) => Number(n || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

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
  const [sortPickup, setSortPickup] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingRemarkId, setEditingRemarkId] = useState(null);
  const [tempRemark, setTempRemark] = useState('');
  const [formData, setFormData] = useState({
    slNo: '', fullName: '', contactNo: '', age: '', gender: 'Male',
    pickupPoint: '', totalPrice: '', amountPaid: '', balanceAmount: '',
    receiptMode: '', receiptDate: '', bookedBy: '', remarks: ''
  });

  const [allExpenses, setAllExpenses] = useState([]);
  const [myExpense, setMyExpense] = useState({
    amountCollected: '', paidToDriver: '', lunchPacking: '', parkingCharges: '',
    jeepCharges: '', refundToCustomer: '', tickets: '', localGuide: '',
    otherExpenses: '', otherExpensesRemarks: '', additionalExpenses: []
  });
  const [deleteParticipantTarget, setDeleteParticipantTarget] = useState(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseSubmitted, setExpenseSubmitted] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState(false);
  const [adminExpenseView, setAdminExpenseView] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef(null);
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
        try { const r = await api.get(`/treks/${batchRes.data.trekId}`); setTrek(r.data); } catch {}
      }
    } catch { toast.error('Failed to load batch details'); }
    try {
      const [allExpRes, myExpRes] = await Promise.all([
        api.get(`/batches/${batchId}/expenses`),
        api.get(`/batches/${batchId}/expenses/my`)
      ]);
      setAllExpenses(allExpRes.data);
      if (myExpRes.data) {
        setMyExpense({
          amountCollected:      myExpRes.data.amountCollected?.toString()      || '',
          paidToDriver:         myExpRes.data.paidToDriver?.toString()         || '',
          lunchPacking:         myExpRes.data.lunchPacking?.toString()         || '',
          parkingCharges:       myExpRes.data.parkingCharges?.toString()       || '',
          jeepCharges:          myExpRes.data.jeepCharges?.toString()          || '',
          refundToCustomer:     myExpRes.data.refundToCustomer?.toString()     || '',
          tickets:              myExpRes.data.tickets?.toString()              || '',
          localGuide:           myExpRes.data.localGuide?.toString()           || '',
          otherExpenses:        myExpRes.data.otherExpenses?.toString()        || '',
          otherExpensesRemarks: myExpRes.data.otherExpensesRemarks            || '',
          additionalExpenses:   myExpRes.data.additionalExpenses              || [],
        });
        setExpenseSubmitted(true);
      }
    } catch {}
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
      const res = await api.get(`/batches/${batchId}/participants/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url;
      a.download = `participant_template_${batch?.batchCode || batchId}.xlsx`; a.click();
      URL.revokeObjectURL(url); toast.success('Template downloaded');
    } catch { toast.error('Download failed'); }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post(`/batches/${batchId}/participants/import`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${res.data.count} participants imported`); fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Import failed'); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddOrEdit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) { toast.error('Full Name is required'); return; }
    try {
      const payload = { ...formData, totalPrice: parseFloat(formData.totalPrice) || 0, amountPaid: parseFloat(formData.amountPaid) || 0, balanceAmount: parseFloat(formData.balanceAmount) || 0 };
      if (editParticipant) {
        await api.patch(`/batches/${batchId}/participants/${editParticipant.id}`, payload);
        toast.success('Participant updated');
      } else {
        await api.post(`/batches/${batchId}/participants`, payload);
        toast.success('Participant added');
      }
      setAddDialogOpen(false); resetForm(); fetchAll();
    } catch { toast.error('Failed to save participant'); }
  };

  const handleDelete = (p) => setDeleteParticipantTarget(p);

  const confirmDeleteParticipant = async () => {
    const p = deleteParticipantTarget; setDeleteParticipantTarget(null);
    try { await api.delete(`/batches/${batchId}/participants/${p.id}`); toast.success('Participant removed'); fetchAll(); }
    catch { toast.error('Failed to remove'); }
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

  const saveLeadRemark = async (p, remark) => {
    setEditingRemarkId(null);
    try {
      await api.patch(`/batches/${batchId}/participants/${p.id}`, { leadRemark: remark });
      setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, leadRemark: remark } : x));
    } catch { toast.error('Failed to save note'); }
  };

  const resetForm = () => {
    setFormData({ slNo: '', fullName: '', contactNo: '', age: '', gender: 'Male', pickupPoint: '', totalPrice: '', amountPaid: '', balanceAmount: '', receiptMode: '', receiptDate: '', bookedBy: '', remarks: '' });
    setEditParticipant(null);
  };

  const openEditDialog = (p) => {
    setEditParticipant(p);
    setFormData({ slNo: p.slNo || '', fullName: p.fullName || '', contactNo: p.contactNo || '', age: p.age || '', gender: p.gender || 'Male', pickupPoint: p.pickupPoint || '', totalPrice: p.totalPrice?.toString() || '', amountPaid: p.amountPaid?.toString() || '', balanceAmount: p.balanceAmount?.toString() || '', receiptMode: p.receiptMode || '', receiptDate: p.receiptDate || '', bookedBy: p.bookedBy || '', remarks: p.remarks || '' });
    setAddDialogOpen(true);
  };

  const filteredParticipants = participants
    .filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.fullName?.toLowerCase().includes(q) && !p.contactNo?.includes(q) && !p.pickupPoint?.toLowerCase().includes(q) && !p.remarks?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === 'boarded') return !!p.boarded;
      if (statusFilter === 'noshow')  return !!p.noShow;
      if (statusFilter === 'balance') return (p.balanceAmount || 0) > 0;
      if (statusFilter === 'pending') return !p.boarded && !p.noShow;
      return true;
    })
    .sort((a, b) => !sortPickup ? 0 : (a.pickupPoint || '').localeCompare(b.pickupPoint || ''));

  const totalBalance   = participants.reduce((s, p) => s + (p.balanceAmount || 0), 0);
  const totalCollected = participants.reduce((s, p) => s + (p.amountCollected || 0), 0);
  const boardedCount   = participants.filter(p => p.boarded).length;
  const noShowCount    = participants.filter(p => p.noShow).length;
  const maleCount      = participants.filter(p => p.gender === 'Male').length;
  const femaleCount    = participants.filter(p => p.gender === 'Female').length;

  const myExpenseNum = (field) => parseFloat(myExpense[field]) || 0;
  const fixedSpent = EXPENSE_ITEMS.reduce((s, { key }) => s + myExpenseNum(key), 0);
  const additionalSpent = (myExpense.additionalExpenses || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const myTotalSpent = fixedSpent + additionalSpent;
  const myRemaining  = myExpenseNum('amountCollected') - myTotalSpent;
  const spendPct     = myExpenseNum('amountCollected') > 0 ? Math.min(100, (myTotalSpent / myExpenseNum('amountCollected')) * 100) : 0;

  const addExpenseRow    = () => setMyExpense(p => ({ ...p, additionalExpenses: [...(p.additionalExpenses || []), { reason: '', amount: '' }] }));
  const removeExpenseRow = (idx) => setMyExpense(p => ({ ...p, additionalExpenses: (p.additionalExpenses || []).filter((_, i) => i !== idx) }));
  const updateExpenseRow = (idx, field, value) => setMyExpense(p => { const u = [...(p.additionalExpenses || [])]; u[idx] = { ...u[idx], [field]: value }; return { ...p, additionalExpenses: u }; });

  const handleSaveExpense = async () => {
    setSavingExpense(true);
    try {
      await api.post(`/batches/${batchId}/expenses`, myExpense);
      toast.success('Expense sheet submitted');
      setExpenseSubmitted(true); setExpenseEditing(false);
      const r = await api.get(`/batches/${batchId}/expenses`); setAllExpenses(r.data);
    } catch { toast.error('Failed to submit expense'); }
    setSavingExpense(false);
  };

  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`/batches/${batchId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded');
      const r = await api.get(`/batches/${batchId}/documents`); setDocuments(r.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    setUploadingDoc(false);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleDownloadDocument = async (doc) => {
    try {
      const res = await api.get(`/batches/${batchId}/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = doc.name; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const handleDeleteDocument = (doc) => setDeleteDocTarget(doc);

  const confirmDeleteDocument = async () => {
    const doc = deleteDocTarget; setDeleteDocTarget(null);
    try { await api.delete(`/batches/${batchId}/documents/${doc.id}`); setDocuments(p => p.filter(d => d.id !== doc.id)); toast.success('Document deleted'); }
    catch { toast.error('Delete failed'); }
  };

  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    try {
      await api.post(`/batches/${batchId}/feedback`, myFeedback);
      toast.success('Feedback saved');
      const r = await api.get(`/batches/${batchId}/feedback`); setAllFeedback(r.data);
    } catch { toast.error('Failed to save feedback'); }
    setSavingFeedback(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // avatar initials helper
  const initials = (name) => (name || '').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-100" style={{ borderTopColor: BRAND }} />
      </div>
    );
  }
  if (!batch) return <div className="text-center py-12 text-slate-500">Batch not found</div>;

  const tabConfig = [
    { key: 'participants', label: 'Participants', icon: Users,        count: participants.length },
    { key: 'expenses',    label: 'Expenses',     icon: Receipt,       count: allExpenses.length  },
    { key: 'documents',   label: 'Documents',    icon: FileText,      count: documents.length    },
    { key: 'feedback',    label: 'Feedback',     icon: MessageSquare, count: allFeedback.length  },
  ];

  const capacityPct = batch.maxCapacity > 0
    ? Math.min(100, Math.round((batch.currentRegistrations / batch.maxCapacity) * 100)) : 0;

  return (
    <div data-testid="batch-detail-page" className="space-y-0">

      {/* ══════════════ HERO ══════════════ */}
      <div className="relative overflow-hidden rounded-2xl mb-5 bg-[#111827]">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: BRAND }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-5 pb-6 md:px-8 md:pt-7">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => navigate('/batches')} data-testid="back-to-batches"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium group">
              <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">All Batches</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={batch.status === 'Open'
                ? { color: '#4ade80', borderColor: '#4ade8040', background: '#4ade8010' }
                : batch.status === 'Completed'
                ? { color: '#94a3b8', borderColor: '#94a3b840', background: '#94a3b810' }
                : { color: '#fbbf24', borderColor: '#fbbf2440', background: '#fbbf2410' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: batch.status === 'Open' ? '#4ade80' : batch.status === 'Completed' ? '#94a3b8' : '#fbbf24' }} />
              {batch.status}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none mb-2">{batch.batchCode}</h1>
          <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5 mb-5">
            <MapPin size={13} style={{ color: BRAND }} />
            {trek?.name || 'Unknown Trek'}
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <Calendar size={12} style={{ color: BRAND }} />
              <span>
                {new Date(batch.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(batch.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <Users size={12} style={{ color: BRAND }} />
              <span>{batch.currentRegistrations} / {batch.maxCapacity} seats</span>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-medium">Fill Rate</span>
              <span className="text-xs text-white font-bold">{capacityPct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${capacityPct}%`, background: capacityPct >= 90 ? '#ef4444' : BRAND }} />
            </div>
          </div>

          {batch.assignedLeads?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Leads</span>
              {batch.assignedLeads.map(l => (
                <div key={l.userId}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={l.isSuperLead
                    ? { background: `${BRAND}20`, color: '#fff', borderColor: `${BRAND}50` }
                    : { background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.12)' }}>
                  {l.isSuperLead && <Star size={10} style={{ color: BRAND, fill: BRAND }} className="flex-shrink-0" />}
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: BRAND, color: '#fff' }}>
                    {l.displayName?.charAt(0)?.toUpperCase()}
                  </div>
                  {l.displayName}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex border-t border-white/8 overflow-x-auto" data-testid="batch-tabs">
          {tabConfig.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setActiveTab(key)} data-testid={`tab-${key}`}
              className="relative flex items-center gap-2 px-4 md:px-6 py-3.5 text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center"
              style={{ color: activeTab === key ? '#fff' : '#64748b' }}>
              <Icon size={14} />
              <span>{label}</span>
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px]"
                style={activeTab === key ? { background: BRAND, color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: '#64748b' }}>
                {count}
              </span>
              {activeTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ background: BRAND }} />}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ PARTICIPANTS ══════════════ */}
      {activeTab === 'participants' && (<>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Total',       value: participants.length,               sub: `${maleCount}M · ${femaleCount}F`, accent: false },
            { label: 'Boarded',     value: `${boardedCount}/${participants.length}`, sub: 'checked in',              accent: true  },
            { label: 'No Show',     value: noShowCount,                       sub: 'absent',                          accent: false },
            { label: 'Balance Due', value: '₹' + fmt(totalBalance),           sub: 'outstanding',                     accent: false },
            { label: 'Collected',   value: '₹' + fmt(totalCollected),         sub: 'on site',                         accent: false },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className="bg-white rounded-xl border p-4"
              style={{ borderColor: accent ? BRAND : '#e2e8f0', borderLeftWidth: accent ? '3px' : '1px' }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-xl md:text-2xl font-black leading-none" style={{ color: accent ? BRAND : '#111827' }}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
            <Input placeholder="Search name, contact, pickup…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-slate-50 border-transparent focus:border-slate-200 focus:bg-white rounded-lg text-sm"
              data-testid="search-participants" />
          </div>
          <button onClick={() => setSortPickup(v => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors"
            style={sortPickup ? { background: BRAND, color: '#fff', borderColor: BRAND } : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}>
            <Filter size={12} /><span className="hidden sm:inline">Pickup</span>{sortPickup && <span>↑</span>}
          </button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[110px] text-xs flex-shrink-0 border border-slate-200 bg-white text-slate-500">
              <SlidersHorizontal size={12} className="mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="boarded">Boarded</SelectItem>
              <SelectItem value="noshow">No Show</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="balance">Balance Due</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (<>
            <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} data-testid="download-template-btn"
              className="h-8 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 px-2.5 gap-1.5 flex-shrink-0 whitespace-nowrap">
              <Download size={13} /> Template
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} data-testid="import-file-input" />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="import-excel-btn"
              className="h-8 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 px-2.5 gap-1.5 flex-shrink-0 whitespace-nowrap">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}{uploading ? 'Importing…' : 'Import'}
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setAddDialogOpen(true); }} data-testid="add-participant-btn"
              className="h-8 text-xs font-bold text-white px-3 gap-1.5 flex-shrink-0 whitespace-nowrap" style={{ background: BRAND }}>
              <Plus size={13} /> Add
            </Button>
          </>)}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="participants-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-12">SL</th>
                  <th className="px-3 py-3 w-10" />
                  <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none"
                    onClick={() => setSortPickup(v => !v)} style={{ color: sortPickup ? BRAND : '#94a3b8' }}>
                    Pickup {sortPickup ? '↑' : '⇅'}
                  </th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid</th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance</th>
                  <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-28">Collected</th>
                  <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24">Status</th>
                  <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredParticipants.length === 0 ? (
                  <tr><td colSpan={11} className="py-20 text-center">
                    <Users size={36} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm font-medium">No participants found</p>
                  </td></tr>
                ) : filteredParticipants.map((p, idx) => (
                  <tr key={p.id} data-testid={`participant-row-${p.id}`}
                    className="transition-colors group hover:bg-slate-50"
                    style={p.boarded ? { borderLeft: `3px solid ${BRAND}` } : {}}>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <Checkbox checked={p.boarded} onCheckedChange={() => toggleBoarded(p)} data-testid={`boarding-checkbox-${p.id}`} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-sm text-slate-900">{p.fullName}</p>
                      {p.age && <p className="text-xs text-slate-400">{p.age}y · {p.gender}</p>}
                      {p.remarks && <p className="text-[11px] text-slate-400 italic mt-0.5 max-w-[200px] truncate">{p.remarks}</p>}
                      {editingRemarkId === p.id ? (
                        <input autoFocus value={tempRemark} onChange={(e) => setTempRemark(e.target.value)}
                          onBlur={() => saveLeadRemark(p, tempRemark)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveLeadRemark(p, tempRemark); if (e.key === 'Escape') setEditingRemarkId(null); }}
                          className="mt-1 w-full text-[11px] bg-white border rounded px-1.5 py-0.5 focus:outline-none"
                          style={{ borderColor: BRAND, color: BRAND }} placeholder="Lead note… (Enter to save)" />
                      ) : (
                        <button onClick={() => { setEditingRemarkId(p.id); setTempRemark(p.leadRemark || ''); }}
                          className="flex items-center gap-1 mt-0.5 text-left w-full group/note">
                          {p.leadRemark
                            ? <><span className="text-[11px] italic truncate max-w-[190px]" style={{ color: BRAND }}>{p.leadRemark}</span><Edit size={9} className="flex-shrink-0 opacity-0 group-hover/note:opacity-60 transition-opacity" style={{ color: BRAND }} /></>
                            : <span className="text-[11px] text-slate-300 italic group-hover/note:text-slate-500 transition-colors">+ lead note</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {p.contactNo
                        ? <a href={`tel:${p.contactNo}`} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 group/ph">
                            {p.contactNo}<Phone size={11} className="text-slate-300 group-hover/ph:text-slate-500 flex-shrink-0" />
                          </a>
                        : <span className="text-slate-300 text-sm">—</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-600">{p.pickupPoint}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-700 tabular-nums">{fmt(p.totalPrice)}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-700 tabular-nums">{fmt(p.amountPaid)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className={`text-sm font-bold ${(p.balanceAmount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(p.balanceAmount)}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Input type="number" value={p.amountCollected || ''}
                        onChange={(e) => setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, amountCollected: parseFloat(e.target.value) || 0 } : x))}
                        onBlur={(e) => updateAmountCollected(p, e.target.value)}
                        className="w-24 h-7 text-xs bg-white text-right ml-auto border-slate-200"
                        placeholder="0" data-testid={`collected-input-${p.id}`} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {p.noShow
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200 text-red-600">No Show</span>
                        : p.boarded
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: BRAND }}><CheckCircle size={9} /> Boarded</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 text-slate-500">{p.status || 'Confirmed'}</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleNoShow(p)}
                          className={`p-1.5 rounded-lg transition-colors ${p.noShow ? 'bg-red-100 text-red-600' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                          data-testid={`noshow-btn-${p.id}`}><XCircle size={13} /></button>
                        {isAdmin && (<>
                          <button onClick={() => openEditDialog(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" data-testid={`edit-participant-${p.id}`}><Edit size={13} /></button>
                          <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-testid={`delete-participant-${p.id}`}><Trash2 size={13} /></button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ ADD / EDIT PARTICIPANT DIALOG ══ */}
        <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col bg-white p-0">

            {/* Header with live avatar */}
            <div className="flex items-center gap-4 px-6 py-5 flex-shrink-0" style={{ background: BRAND }}>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white text-xl font-black border-2 border-white/30">
                {initials(formData.fullName) || <Users size={22} className="text-white/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogHeader>
                  <DialogTitle className="text-white text-lg font-black">
                    {editParticipant ? 'Edit Participant' : 'Add Participant'}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-white/60 text-xs mt-0.5 truncate">
                  {formData.fullName || (editParticipant ? editParticipant.fullName : 'Enter name below')} · Batch {batch?.batchCode}
                </p>
              </div>
            </div>

            <form onSubmit={handleAddOrEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                {/* Identity */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BRAND }}>— Identity</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">SL No</Label>
                      <Input value={formData.slNo} onChange={(e) => setFormData(f => ({...f, slNo: e.target.value}))}
                        className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" placeholder="01" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Full Name <span style={{ color: BRAND }}>*</span></Label>
                      <Input value={formData.fullName} onChange={(e) => setFormData(f => ({...f, fullName: e.target.value}))}
                        required className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" placeholder="Full name"
                        data-testid="participant-name-input" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Contact</Label>
                      <Input value={formData.contactNo}
                        onChange={(e) => setFormData(f => ({...f, contactNo: e.target.value.replace(/\D/g, '').slice(0, 10)}))}
                        inputMode="numeric" maxLength={10} placeholder="10 digits"
                        className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Age</Label>
                      <Input value={formData.age} onChange={(e) => setFormData(f => ({...f, age: e.target.value}))}
                        placeholder="e.g. 28" className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Gender</Label>
                      <Select value={formData.gender} onValueChange={(v) => setFormData(f => ({...f, gender: v}))}>
                        <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Pickup Point</Label>
                    <Input value={formData.pickupPoint} onChange={(e) => setFormData(f => ({...f, pickupPoint: e.target.value}))}
                      placeholder="e.g. Silk Board, Majestic" className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" />
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Payment with live balance indicator */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BRAND }}>— Payment</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { field: 'totalPrice', label: 'Total Price' },
                      { field: 'amountPaid', label: 'Amount Paid' },
                      { field: 'balanceAmount', label: 'Balance' },
                    ].map(({ field, label }) => (
                      <div key={field}>
                        <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">{label}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">₹</span>
                          <Input type="number" value={formData[field]}
                            onChange={(e) => setFormData(f => ({...f, [field]: e.target.value}))}
                            className="pl-7 h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" placeholder="0" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Visual payment progress */}
                  {parseFloat(formData.totalPrice) > 0 && (
                    <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span>Payment Progress</span>
                        <span className="font-bold" style={{ color: BRAND }}>
                          {Math.round((parseFloat(formData.amountPaid) || 0) / (parseFloat(formData.totalPrice) || 1) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, ((parseFloat(formData.amountPaid) || 0) / (parseFloat(formData.totalPrice) || 1)) * 100)}%`,
                            background: BRAND
                          }} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Receipt Mode</Label>
                      {/* Button group */}
                      <div className="flex gap-1 flex-wrap">
                        {['Cash', 'UPI', 'Card'].map(mode => (
                          <button key={mode} type="button"
                            onClick={() => setFormData(f => ({...f, receiptMode: mode}))}
                            className="flex-1 h-9 text-xs font-semibold rounded-lg border transition-all"
                            style={formData.receiptMode === mode
                              ? { background: BRAND, color: '#fff', borderColor: BRAND }
                              : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}>
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Receipt Date</Label>
                      <Input type="date" value={formData.receiptDate}
                        onChange={(e) => setFormData(f => ({...f, receiptDate: e.target.value}))}
                        className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Booked By</Label>
                      <Input value={formData.bookedBy} onChange={(e) => setFormData(f => ({...f, bookedBy: e.target.value}))}
                        placeholder="Staff name" className="h-9 text-sm border-slate-200 bg-slate-50 focus:bg-white" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: BRAND }}>— Notes</p>
                  <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Remarks</Label>
                  <textarea rows={2} value={formData.remarks}
                    onChange={(e) => setFormData(f => ({...f, remarks: e.target.value}))}
                    placeholder="Allergies, special needs, dietary preferences…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2.5 text-sm focus:outline-none resize-none transition-colors" />
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <Button type="submit" className="flex-1 text-white h-10 font-bold" style={{ background: BRAND }}
                  data-testid="save-participant-btn">
                  {editParticipant ? 'Update Participant' : 'Add Participant'}
                </Button>
                <Button type="button" variant="outline" className="border-slate-200 text-slate-600 h-10 px-6"
                  onClick={() => { setAddDialogOpen(false); resetForm(); }}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>)}

      {/* ══════════════ EXPENSES ══════════════ */}
      {activeTab === 'expenses' && (<>
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Collected', value: myExpenseNum('amountCollected'), accent: true,  testId: 'expense-summary-collected' },
              { label: 'Spent',     value: myTotalSpent,                    accent: false, testId: 'expense-summary-spent'     },
              { label: myRemaining >= 0 ? 'Remaining' : 'Overspent', value: Math.abs(myRemaining), accent: false, testId: 'expense-summary-remaining' },
            ].map(({ label, value, accent, testId }) => (
              <div key={label} className="bg-white rounded-xl border p-4"
                style={{ borderColor: accent ? BRAND : '#e2e8f0', borderLeftWidth: accent ? '3px' : '1px' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-xl font-black tabular-nums" style={{ color: accent ? BRAND : '#111827' }}
                  data-testid={testId}>{fmtCur(value)}</p>
              </div>
            ))}
          </div>

          {/* My expense sheet card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="my-expense-sheet">
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
                  <Receipt size={16} style={{ color: BRAND }} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">My Expense Sheet</h3>
                  <p className="text-xs text-slate-400">{expenseSubmitted ? 'Submitted — view or edit' : 'Log your expenses for this batch'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expenseSubmitted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                    style={{ color: BRAND, borderColor: `${BRAND}40`, background: `${BRAND}10` }}>
                    <ClipboardList size={11} /> Submitted
                  </span>
                )}
                <Button size="sm" onClick={() => { setExpenseEditing(!expenseSubmitted); setExpenseDialogOpen(true); }}
                  className="h-8 text-xs font-bold text-white" style={{ background: BRAND }} data-testid="open-expense-dialog-btn">
                  {expenseSubmitted ? <><Eye size={13} className="mr-1.5" />View / Edit</> : <><Receipt size={13} className="mr-1.5" />Log Expenses</>}
                </Button>
              </div>
            </div>
            {expenseSubmitted && myTotalSpent > 0 && (
              <div className="px-5 py-3 flex flex-wrap gap-2">
                {EXPENSE_ITEMS.filter(({ key }) => myExpenseNum(key) > 0).map(({ key, label, Icon }) => (
                  <div key={key} className="flex items-center gap-1.5 border border-slate-100 rounded-lg px-2.5 py-1.5">
                    <Icon size={11} className="text-slate-400" />
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className="text-xs font-bold text-slate-800 ml-1 tabular-nums">₹{fmt(myExpenseNum(key))}</span>
                  </div>
                ))}
                {(myExpense.additionalExpenses || []).filter(i => parseFloat(i.amount) > 0).map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5"
                    style={{ borderColor: `${BRAND}30`, background: `${BRAND}08` }}>
                    <span className="text-[10px] max-w-[80px] truncate" style={{ color: BRAND }}>{item.reason || 'Extra'}</span>
                    <span className="text-xs font-bold ml-1 tabular-nums" style={{ color: BRAND }}>₹{fmt(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin: all expense sheets */}
          {isAdmin && allExpenses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="all-expenses-overview">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
                  <DollarSign size={16} style={{ color: BRAND }} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">All Lead Expense Sheets</h3>
                  <p className="text-xs text-slate-400">{allExpenses.length} submission{allExpenses.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {allExpenses.map(exp => {
                  const pct = exp.amountCollected > 0 ? Math.min(100, ((exp.totalSpent || 0) / exp.amountCollected) * 100) : 0;
                  return (
                    <div key={exp.id} className="px-5 py-4" data-testid={`expense-row-${exp.id}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                            style={{ background: BRAND }}>
                            {exp.leadName?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{exp.leadName}</p>
                            <p className="text-xs text-slate-400">Updated {new Date(exp.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {[
                            { label: 'Collected', val: exp.amountCollected, accent: true  },
                            { label: 'Spent',     val: exp.totalSpent,      accent: false },
                            { label: 'Remaining', val: exp.remaining,       accent: false },
                          ].map(({ label, val, accent }) => (
                            <div key={label} className="text-right">
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                              <p className="text-sm font-black tabular-nums" style={accent ? { color: BRAND } : { color: '#111827' }}>
                                ₹{fmt(val)}
                              </p>
                            </div>
                          ))}
                          <Button variant="outline" size="sm"
                            className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0"
                            onClick={() => setAdminExpenseView(exp)}>
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </div>
                      </div>
                      {/* Spend bar per lead */}
                      <div className="ml-12">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : BRAND }} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(0)}% of collected spent</p>
                      </div>
                    </div>
                  );
                })}
                <div className="px-5 py-4 bg-slate-50 flex items-center justify-between">
                  <p className="font-black text-slate-900 text-sm">Consolidated Total</p>
                  <div className="flex items-center gap-5">
                    {[
                      { label: 'Collected', val: allExpenses.reduce((s, e) => s + (e.amountCollected || 0), 0), accent: true  },
                      { label: 'Spent',     val: allExpenses.reduce((s, e) => s + (e.totalSpent || 0), 0),      accent: false },
                      { label: 'Remaining', val: allExpenses.reduce((s, e) => s + (e.remaining || 0), 0),       accent: false },
                    ].map(({ label, val, accent }) => (
                      <div key={label} className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-black tabular-nums" style={accent ? { color: BRAND } : { color: '#111827' }}>₹{fmt(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ EXPENSE FORM DIALOG ══ */}
        <Dialog open={expenseDialogOpen} onOpenChange={(open) => { setExpenseDialogOpen(open); if (!open) setExpenseEditing(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white p-0">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND}15` }}>
                <Receipt size={16} style={{ color: BRAND }} />
              </div>
              <div className="flex-1">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 text-base font-black">
                    {expenseEditing ? 'Edit Expenses' : 'Expense Sheet'} — {batch?.batchCode}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-slate-400">{expenseEditing ? 'Fill in your expenses below' : 'Your submitted report'}</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {!expenseEditing && expenseSubmitted ? (
                /* ── READ-ONLY VIEW ── */
                <div className="p-5 space-y-4">
                  {/* Collected hero */}
                  <div className="rounded-2xl p-5 flex items-center justify-between border-2" style={{ borderColor: BRAND, background: `${BRAND}08` }}>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: BRAND }}>Amount Collected</p>
                      <p className="text-3xl font-black tabular-nums" style={{ color: BRAND }}>{fmtCur(myExpenseNum('amountCollected'))}</p>
                    </div>
                    <IndianRupee size={40} style={{ color: `${BRAND}25` }} />
                  </div>

                  {/* Spend breakdown with visual bars */}
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    {[...EXPENSE_ITEMS.filter(({ key }) => myExpenseNum(key) > 0),
                      ...(myExpense.additionalExpenses || []).filter(i => parseFloat(i.amount) > 0).map((i, idx) => ({
                        key: `_add_${idx}`, label: i.reason || 'Additional', Icon: MoreHorizontal, amt: parseFloat(i.amount)
                      }))
                    ].map((item, rowIdx) => {
                      const amt = item.amt !== undefined ? item.amt : myExpenseNum(item.key);
                      const barPct = myTotalSpent > 0 ? (amt / myTotalSpent) * 100 : 0;
                      const { Icon } = item;
                      return (
                        <div key={item.key} className={`px-4 py-3 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Icon size={13} className="text-slate-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700">{item.label}</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 tabular-nums">{fmtCur(amt)}</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: BRAND }} />
                          </div>
                        </div>
                      );
                    })}
                    {myExpense.otherExpensesRemarks && myExpenseNum('otherExpenses') > 0 && (
                      <div className="px-4 py-2 bg-slate-50 pl-11">
                        <p className="text-xs text-slate-400 italic">{myExpense.otherExpensesRemarks}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-100">
                      <span className="text-sm font-black text-slate-800 flex items-center gap-1.5"><TrendingDown size={14} /> Total Spent</span>
                      <span className="text-sm font-black text-red-600 tabular-nums">{fmtCur(myTotalSpent)}</span>
                    </div>
                  </div>

                  {/* Remaining */}
                  <div className="rounded-xl border-2 px-5 py-4 flex items-center justify-between"
                    style={{ borderColor: myRemaining >= 0 ? `${BRAND}50` : '#fca5a5' }}>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                        {myRemaining >= 0 ? 'Amount Remaining' : 'Overspent by'}
                      </p>
                      <p className="text-2xl font-black tabular-nums" style={{ color: myRemaining >= 0 ? BRAND : '#ef4444' }}>
                        {fmtCur(Math.abs(myRemaining))}
                      </p>
                    </div>
                    {/* Donut-style pct */}
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                        <circle cx="18" cy="18" r="14" fill="none" strokeWidth="4"
                          stroke={myRemaining >= 0 ? BRAND : '#ef4444'}
                          strokeDasharray={`${Math.min(100, spendPct) * 0.879} 87.9`}
                          strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700">
                        {Math.round(spendPct)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── EDIT / FORM VIEW ── */
                <div>
                  {/* Amount collected — large prominent input */}
                  <div className="p-5 border-b border-slate-100" style={{ background: `${BRAND}06` }}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: BRAND }}>Amount Collected</p>
                        <p className="text-xs text-slate-500">Cash received from participants on trek day</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-lg font-black" style={{ color: BRAND }}>₹</span>
                        <input
                          type="number"
                          value={myExpense.amountCollected}
                          onChange={(e) => setMyExpense(p => ({...p, amountCollected: e.target.value}))}
                          className="w-36 text-right text-2xl font-black border-2 rounded-xl px-3 py-2 focus:outline-none bg-white"
                          style={{ borderColor: BRAND, color: BRAND }}
                          placeholder="0"
                          data-testid="expense-amount-collected"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expense card grid */}
                  <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Expense Categories</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {EXPENSE_ITEMS.map(({ key, label, Icon }) => {
                        const active = parseFloat(myExpense[key]) > 0;
                        return (
                          <div key={key} className="rounded-xl border-2 p-3 transition-all cursor-text"
                            style={active
                              ? { borderColor: BRAND, background: `${BRAND}08` }
                              : { borderColor: '#e2e8f0', background: '#fff' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                                style={active ? { background: BRAND } : { background: '#f1f5f9' }}>
                                <Icon size={13} style={active ? { color: '#fff' } : { color: '#94a3b8' }} />
                              </div>
                              <span className="text-xs font-semibold leading-tight" style={{ color: active ? '#111827' : '#64748b' }}>{label}</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">₹</span>
                              <input
                                type="number"
                                value={myExpense[key]}
                                onChange={(e) => setMyExpense(p => ({...p, [key]: e.target.value}))}
                                className="w-full pl-6 pr-2 py-2 text-sm font-bold rounded-lg border text-right focus:outline-none transition-all"
                                style={active
                                  ? { borderColor: `${BRAND}50`, color: BRAND, background: '#fff' }
                                  : { borderColor: '#e2e8f0', color: '#111827', background: '#f8fafc' }}
                                placeholder="0"
                                data-testid={`expense-${key}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Other remarks */}
                    {myExpense.otherExpenses && parseFloat(myExpense.otherExpenses) > 0 && (
                      <div className="mt-3">
                        <Label className="text-xs text-slate-400 font-semibold mb-1.5 block">Remarks for Other Expenses</Label>
                        <Input value={myExpense.otherExpensesRemarks}
                          onChange={(e) => setMyExpense(p => ({...p, otherExpensesRemarks: e.target.value}))}
                          className="bg-white border-slate-200 text-sm h-9" placeholder="What were the other expenses?" />
                      </div>
                    )}
                  </div>

                  {/* Additional expenses */}
                  <div className="border-t-2 border-dashed border-slate-200 mx-4" />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Additional Expenses</p>
                        <p className="text-xs text-slate-300 mt-0.5">Custom items with descriptions</p>
                      </div>
                      <button type="button" onClick={addExpenseRow}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-dashed transition-colors"
                        style={{ borderColor: `${BRAND}50`, color: BRAND, background: `${BRAND}08` }}
                        data-testid="add-expense-row-btn">
                        <Plus size={13} /> Add Row
                      </button>
                    </div>
                    {(myExpense.additionalExpenses || []).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2" data-testid={`additional-expense-${idx}`}>
                        <span className="text-slate-300 text-xs font-mono w-5 flex-shrink-0 text-center">{idx + 1}</span>
                        <Input value={item.reason} onChange={(e) => updateExpenseRow(idx, 'reason', e.target.value)}
                          className="flex-1 bg-white h-9 text-sm border-slate-200" placeholder="Description"
                          data-testid={`additional-reason-${idx}`} />
                        <div className="relative flex-shrink-0 w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                          <Input type="number" value={item.amount} onChange={(e) => updateExpenseRow(idx, 'amount', e.target.value)}
                            className="pl-6 w-full h-9 text-sm text-right bg-white border-slate-200" placeholder="0"
                            data-testid={`additional-amount-${idx}`} />
                        </div>
                        <button onClick={() => removeExpenseRow(idx)}
                          className="p-2 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                          data-testid={`remove-expense-row-${idx}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Live spend bar */}
                  {myExpenseNum('amountCollected') > 0 && (
                    <div className="mx-4 mb-4 rounded-xl border border-slate-100 p-4 bg-slate-50">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-500 font-semibold">Spent so far</span>
                        <span className="font-black" style={{ color: myRemaining < 0 ? '#ef4444' : BRAND }}>
                          {fmtCur(myTotalSpent)} / {fmtCur(myExpenseNum('amountCollected'))}
                        </span>
                      </div>
                      <div className="h-3 bg-white border border-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${spendPct}%`, background: myRemaining < 0 ? '#ef4444' : BRAND }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs">
                        <span className="text-slate-400">{spendPct.toFixed(0)}% used</span>
                        <span className={myRemaining >= 0 ? 'font-bold' : 'text-red-500 font-bold'}
                          style={myRemaining >= 0 ? { color: BRAND } : {}}>
                          {myRemaining >= 0 ? `₹${fmt(myRemaining)} remaining` : `₹${fmt(Math.abs(myRemaining))} overspent`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0 bg-white">
              {!expenseEditing && expenseSubmitted ? (
                <Button onClick={() => setExpenseEditing(true)} size="sm" className="h-9 text-xs font-bold text-white" style={{ background: BRAND }}>
                  <Edit size={13} className="mr-1.5" /> Edit Expenses
                </Button>
              ) : (
                <Button onClick={handleSaveExpense} disabled={savingExpense} size="sm"
                  className="h-9 text-sm font-bold text-white" style={{ background: BRAND }}
                  data-testid="save-expense-btn">
                  {savingExpense ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                  {savingExpense ? 'Submitting…' : 'Submit Expenses'}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-9 text-xs border-slate-200 text-slate-600"
                onClick={() => { setExpenseDialogOpen(false); setExpenseEditing(false); }}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ══ ADMIN EXPENSE DETAIL DIALOG ══ */}
        {adminExpenseView && (
          <Dialog open={!!adminExpenseView} onOpenChange={() => setAdminExpenseView(null)}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col bg-white p-0">
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-5 flex-shrink-0" style={{ background: BRAND }}>
                <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-lg font-black flex-shrink-0">
                  {adminExpenseView.leadName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <DialogHeader>
                    <DialogTitle className="text-white text-base font-black">{adminExpenseView.leadName}</DialogTitle>
                  </DialogHeader>
                  <p className="text-white/60 text-xs mt-0.5">Expense breakdown — {batch?.batchCode}</p>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* Collected */}
                <div className="rounded-xl border-2 px-5 py-4 flex items-center justify-between"
                  style={{ borderColor: `${BRAND}50`, background: `${BRAND}08` }}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: BRAND }}>Amount Collected</p>
                    <p className="text-2xl font-black tabular-nums" style={{ color: BRAND }}>
                      {fmtCur(adminExpenseView.amountCollected)}
                    </p>
                  </div>
                  <IndianRupee size={32} style={{ color: `${BRAND}30` }} />
                </div>

                {/* Breakdown with bars */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  {EXPENSE_ITEMS.filter(({ key }) => (adminExpenseView[key] || 0) > 0).map(({ key, label, Icon }, rowIdx) => {
                    const amt = adminExpenseView[key] || 0;
                    const barPct = (adminExpenseView.totalSpent || 0) > 0 ? (amt / adminExpenseView.totalSpent) * 100 : 0;
                    return (
                      <div key={key} className={`px-4 py-3 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Icon size={13} className="text-slate-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-700">{label}</span>
                          </div>
                          <span className="text-sm font-black text-slate-900 tabular-nums">{fmtCur(amt)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: BRAND }} />
                        </div>
                      </div>
                    );
                  })}
                  {(adminExpenseView.additionalExpenses || []).filter(i => i.amount > 0).map((item, i) => (
                    <div key={i} className="px-4 py-3" style={{ background: `${BRAND}05` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND}15` }}>
                            <MoreHorizontal size={13} style={{ color: BRAND }} />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{item.reason || 'Additional'}</span>
                        </div>
                        <span className="text-sm font-black tabular-nums" style={{ color: BRAND }}>{fmtCur(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-100">
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5"><TrendingDown size={14} /> Total Spent</span>
                    <span className="text-sm font-black text-red-600 tabular-nums">{fmtCur(adminExpenseView.totalSpent)}</span>
                  </div>
                </div>

                {/* Remaining with donut */}
                <div className="rounded-xl border-2 px-5 py-4 flex items-center justify-between"
                  style={{ borderColor: (adminExpenseView.remaining || 0) >= 0 ? `${BRAND}50` : '#fca5a5' }}>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                      {(adminExpenseView.remaining || 0) >= 0 ? 'Remaining' : 'Overspent by'}
                    </p>
                    <p className="text-2xl font-black tabular-nums"
                      style={{ color: (adminExpenseView.remaining || 0) >= 0 ? BRAND : '#ef4444' }}>
                      {fmtCur(Math.abs(adminExpenseView.remaining || 0))}
                    </p>
                  </div>
                  {(() => {
                    const pct2 = adminExpenseView.amountCollected > 0 ? Math.min(100, ((adminExpenseView.totalSpent || 0) / adminExpenseView.amountCollected) * 100) : 0;
                    return (
                      <div className="relative w-14 h-14 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                          <circle cx="18" cy="18" r="14" fill="none" strokeWidth="4"
                            stroke={(adminExpenseView.remaining || 0) >= 0 ? BRAND : '#ef4444'}
                            strokeDasharray={`${pct2 * 0.879} 87.9`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700">{Math.round(pct2)}%</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>)}

      {/* ══════════════ DOCUMENTS ══════════════ */}
      {activeTab === 'documents' && (
        <div className="space-y-4" data-testid="documents-tab">
          {isAdmin && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND}15` }}>
                  <Upload size={17} style={{ color: BRAND }} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Upload Document</p>
                  <p className="text-xs text-slate-400">PDF, Word, Excel, images — max 10MB</p>
                </div>
              </div>
              <input type="file" ref={docInputRef} onChange={handleUploadDocument} className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt" data-testid="doc-file-input" />
              <Button variant="outline" size="sm" onClick={() => docInputRef.current?.click()} disabled={uploadingDoc}
                data-testid="upload-doc-btn" className="h-9 text-sm font-bold border-2 rounded-xl"
                style={{ borderColor: BRAND, color: BRAND }}>
                {uploadingDoc ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
                {uploadingDoc ? 'Uploading…' : 'Choose File'}
              </Button>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <FileText size={28} className="text-slate-200" />
              </div>
              <p className="text-slate-500 font-bold text-sm">No documents yet</p>
              {isAdmin && <p className="text-xs text-slate-300 mt-1">Upload permits, tickets or trek documents</p>}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <FileText size={15} style={{ color: BRAND }} />
                <span className="font-bold text-slate-900 text-sm">Documents ({documents.length})</span>
              </div>
              <div className="divide-y divide-slate-50">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group"
                    data-testid={`doc-${doc.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${BRAND}12` }}>
                        <FileText size={16} style={{ color: BRAND }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(doc.size)} · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDownloadDocument(doc)} data-testid={`download-doc-${doc.id}`}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                        <Download size={15} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDeleteDocument(doc)} data-testid={`delete-doc-${doc.id}`}
                          className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
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

      {/* ══════════════ FEEDBACK ══════════════ */}
      {activeTab === 'feedback' && (
        <div className="space-y-4" data-testid="feedback-tab">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
                  <MessageSquare size={15} style={{ color: BRAND }} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">My Feedback</h3>
                  <p className="text-xs text-slate-400">What went well and what can improve</p>
                </div>
              </div>
              <Button onClick={handleSaveFeedback} disabled={savingFeedback} size="sm"
                className="h-9 text-xs font-bold text-white self-start sm:self-auto" style={{ background: BRAND }}
                data-testid="save-feedback-btn">
                {savingFeedback ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                {savingFeedback ? 'Saving…' : 'Save Feedback'}
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                  <ThumbsUp size={12} style={{ color: BRAND }} /> Positive Highlights
                </label>
                <textarea value={myFeedback.positive} onChange={(e) => setMyFeedback(p => ({ ...p, positive: e.target.value }))}
                  rows={3} data-testid="feedback-positive"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none resize-y placeholder-slate-300"
                  placeholder="What went well on this trek? Great moments, highlights…" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                  <ThumbsDown size={12} className="text-slate-400" /> Areas for Improvement
                </label>
                <textarea value={myFeedback.negative} onChange={(e) => setMyFeedback(p => ({ ...p, negative: e.target.value }))}
                  rows={3} data-testid="feedback-negative"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none resize-y placeholder-slate-300"
                  placeholder="What could be improved? Issues, suggestions…" />
              </div>
            </div>
          </div>

          {isAdmin && allFeedback.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="all-feedback-overview">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <MessageSquare size={15} style={{ color: BRAND }} />
                <span className="font-bold text-slate-900 text-sm">All Lead Feedback ({allFeedback.length})</span>
              </div>
              <div className="divide-y divide-slate-100">
                {allFeedback.map(fb => (
                  <div key={fb.id} className="p-5" data-testid={`feedback-${fb.id}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                        style={{ background: BRAND }}>
                        {fb.leadName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{fb.leadName}</p>
                        <p className="text-xs text-slate-400">{new Date(fb.updatedAt || fb.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pl-12">
                      {fb.positive && (
                        <div className="p-3 border border-slate-100 rounded-xl bg-slate-50">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 text-slate-500">
                            <ThumbsUp size={10} style={{ color: BRAND }} /> Positive
                          </p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{fb.positive}</p>
                        </div>
                      )}
                      {fb.negative && (
                        <div className="p-3 border border-slate-100 rounded-xl bg-slate-50">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 text-slate-400">
                            <ThumbsDown size={10} /> Improvement
                          </p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{fb.negative}</p>
                        </div>
                      )}
                      {!fb.positive && !fb.negative && <p className="text-sm text-slate-300 italic">No feedback provided yet</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ DELETE PARTICIPANT CONFIRM ══ */}
      <Dialog open={!!deleteParticipantTarget} onOpenChange={(open) => { if (!open) setDeleteParticipantTarget(null); }}>
        <DialogContent className="max-w-sm bg-white p-0 overflow-hidden">
          <div className="px-6 pt-7 pb-3 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
              <AlertTriangle size={26} style={{ color: BRAND }} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base mb-1">Remove Participant?</h3>
              <p className="text-sm text-slate-500">
                <span className="font-bold text-slate-700">{deleteParticipantTarget?.fullName}</span> will be permanently removed from this batch.
              </p>
            </div>
          </div>
          <div className="px-6 pb-6 pt-2 flex gap-3">
            <Button variant="outline" className="flex-1 border-slate-200 text-slate-600 h-10 text-sm"
              onClick={() => setDeleteParticipantTarget(null)}>Cancel</Button>
            <Button className="flex-1 text-white h-10 text-sm font-bold" style={{ background: BRAND }}
              onClick={confirmDeleteParticipant}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DELETE DOCUMENT CONFIRM ══ */}
      <Dialog open={!!deleteDocTarget} onOpenChange={(open) => { if (!open) setDeleteDocTarget(null); }}>
        <DialogContent className="max-w-sm bg-white p-0 overflow-hidden">
          <div className="px-6 pt-7 pb-3 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
              <AlertTriangle size={26} style={{ color: BRAND }} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base mb-1">Delete Document?</h3>
              <p className="text-sm text-slate-500">
                <span className="font-bold text-slate-700 break-all">{deleteDocTarget?.name}</span> will be permanently deleted.
              </p>
            </div>
          </div>
          <div className="px-6 pb-6 pt-2 flex gap-3">
            <Button variant="outline" className="flex-1 border-slate-200 text-slate-600 h-10 text-sm"
              onClick={() => setDeleteDocTarget(null)}>Cancel</Button>
            <Button className="flex-1 text-white h-10 text-sm font-bold" style={{ background: BRAND }}
              onClick={confirmDeleteDocument}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchDetail;
