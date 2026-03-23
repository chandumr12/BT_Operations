// src/pages/Batches.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/lib/financeFirebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import '@/components/finance/finance-compat.css';
import Pager from '@/components/finance/Pager';

function Batches() {
  const [batches, setBatches] = useState([]);
  const [treks, setTreks] = useState([]);
  const [leads, setLeads] = useState([]);

  // list filters
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [trekFilter, setTrekFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // create panel (inline)
  const [openCreate, setOpenCreate] = useState(false);
  const createRef = useRef(null);
  const [form, setForm] = useState({
    batchCode: '',
    trekName: '',
    startDate: '',
    endDate: '',
    noOfPeople: '',
    basePrice: '',
    totalDiscount: '',

    // Transport block
    transportMode: 'calc', // 'calc' | 'direct'
    transportTotalKm: '',
    transportRatePerKm: '',
    transportTollCharge: '',
    transportDriverBata: '',
    transportDriverShifts: '',
    transportRoadTax: '',          // NEW
    transportParkingCharge: '',    // NEW
    transportDirectAmount: '',

    // Homestay block
    homestayMode: 'calc', // 'calc' | 'direct'
    homestayPeople: '',
    homestayPricePerPerson: '',
    homestayJeep: '',
    homestayDirectAmount: '',

    // Other expenses (structured, replaces old "otherExpense")
    guideExpense: '',
    permitExpense: '',
    jeepExpense: '',
    otherExpensesItems: [], // [{ remark, amount }]

    // Leads
    leadPayments: [],

    // Remarks
    batchRemarks: '',
  });
  const [createErrors, setCreateErrors] = useState({});

  // quick view/edit modal
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const modalBodyRef = useRef(null);

  // pagination (centralized Pager)
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(10);

  // simple delete spinner state
  const [deletingId, setDeletingId] = useState(null);

  // ---------- Fetch ----------
  useEffect(() => {
    async function fetchInitialData() {
      const trekSnap = await getDocs(collection(db, 'treks'));
      setTreks(trekSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const leadSnap = await getDocs(collection(db, 'leads'));
      setLeads(leadSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const batchSnap = await getDocs(query(collection(db, 'batches')));
      setBatches(batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchInitialData();
  }, []);

  // ---------- Helpers ----------
  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const setLeadPayment = (i, field, value) => {
    const lp = [...(form.leadPayments || [])];
    lp[i] = { ...(lp[i] || {}), [field]: value };
    setForm(prev => ({ ...prev, leadPayments: lp }));
  };

  const setOtherExpenseItem = (i, field, value) => {
    const arr = [...(form.otherExpensesItems || [])];
    arr[i] = { ...(arr[i] || { remark: '', amount: '' }), [field]: value };
    setForm(prev => ({ ...prev, otherExpensesItems: arr }));
  };
  const addOtherExpenseItem = () => {
    setForm(prev => ({ ...prev, otherExpensesItems: [...(prev.otherExpensesItems || []), { remark: '', amount: '' }] }));
  };
  const removeOtherExpenseItem = (i) => {
    const arr = [...(form.otherExpensesItems || [])];
    arr.splice(i, 1);
    setForm(prev => ({ ...prev, otherExpensesItems: arr }));
  };

  const computeTransport = (obj) => {
    const mode = obj.transportMode || 'calc';
    if (mode === 'direct') {
      const direct = parseInt(obj.transportDirectAmount || 0) || 0;
      return { total: direct, breakdown: null };
    }
    const km = parseInt(obj.transportTotalKm || 0) || 0;
    const rate = parseInt(obj.transportRatePerKm || 0) || 0;
    const toll = parseInt(obj.transportTollCharge || 0) || 0;
    const bata = parseInt(obj.transportDriverBata || 0) || 0;
    const shifts = parseInt(obj.transportDriverShifts || 0) || 0;
    const roadTax = parseInt(obj.transportRoadTax || 0) || 0;           // NEW
    const parking = parseInt(obj.transportParkingCharge || 0) || 0;     // NEW
    const total = rate * km + toll + bata * shifts + roadTax + parking; // UPDATED
    return { total, breakdown: { km, rate, toll, bata, shifts, roadTax, parking } };
  };

  const computeHomestay = (obj) => {
    const mode = obj.homestayMode || 'calc';
    if (mode === 'direct') {
      const direct = parseInt(obj.homestayDirectAmount || 0) || 0;
      return { total: direct, breakdown: null };
    }
    const ppl = parseInt(obj.homestayPeople || 0) || 0;
    const ppp = parseInt(obj.homestayPricePerPerson || 0) || 0;
    const jeep = parseInt(obj.homestayJeep || 0) || 0;
    const total = ppl * ppp + jeep;
    return { total, breakdown: { ppl, ppp, jeep } };
  };

  const computeOtherExpensesTotal = (obj) =>
    (obj.otherExpensesItems || []).reduce((s, it) => s + (parseInt(it?.amount || 0) || 0), 0);

  const preview = useMemo(() => {
    const n = parseInt(form.noOfPeople || 0) || 0;
    const bp = parseInt(form.basePrice || 0) || 0;
    const disc = parseInt(form.totalDiscount || 0) || 0;
    const income = n * bp - disc;

    const leadTotal = (form.leadPayments || []).reduce(
      (s, l) => s + (parseInt(l?.amount || 0) || 0),
      0
    );

    const { total: transportTotal } = computeTransport(form);
    const { total: homestayTotal } = computeHomestay(form);

    const guide = parseInt(form.guideExpense || 0) || 0;
    const permit = parseInt(form.permitExpense || 0) || 0;
    const jeep = parseInt(form.jeepExpense || 0) || 0;
    const otherTotal = computeOtherExpensesTotal(form);

    const expenses = transportTotal + homestayTotal + guide + permit + jeep + otherTotal + leadTotal;
    const profit = income - expenses;

    return { income, leadTotal, transportTotal, homestayTotal, otherTotal, guide, permit, jeep, expenses, profit };
  }, [form]);

  // ---------- Validation ----------
  const validateCreate = (payload) => {
    const e = {};
    if (!payload.batchCode.trim()) e.batchCode = 'Batch Code is required';
    if (!payload.trekName.trim()) e.trekName = 'Trek is required';
    if (!payload.startDate) e.startDate = 'Start date is required';
    if (!payload.endDate) e.endDate = 'End date is required';
    if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
      e.endDate = 'End date must be after start date';
    }
    if (!Number.isFinite(payload.noOfPeople) || payload.noOfPeople <= 0) e.noOfPeople = 'Booked count must be > 0';
    if (!Number.isFinite(payload.basePrice) || payload.basePrice < 0) e.basePrice = 'Base price must be ≥ 0';
    if (!Number.isFinite(payload.totalDiscount) || payload.totalDiscount < 0) e.totalDiscount = 'Discount must be ≥ 0';

    // Transport rules
    if (payload.transport.mode === 'calc') {
      ['totalKm','ratePerKm','tollCharge','driverBata','driverShifts','roadTax','parkingCharge'].forEach(k => { // UPDATED
        const v = Number(payload.transport?.[k] ?? 0);
        if (!Number.isFinite(v) || v < 0) e[`transport.${k}`] = 'Must be ≥ 0';
      });
    } else {
      const v = Number(payload.transport?.directAmount ?? 0);
      if (!Number.isFinite(v) || v < 0) e['transport.directAmount'] = 'Must be ≥ 0';
    }

    // Homestay rules
    if (payload.homestay.mode === 'calc') {
      const keys = ['people','pricePerPerson','jeep'];
      const src = {
        people: payload.homestay?.people,
        pricePerPerson: payload.homestay?.pricePerPerson,
        jeep: payload.homestay?.jeep,
      };
      keys.forEach(k => {
        const v = Number(src[k] ?? 0);
        if (!Number.isFinite(v) || v < 0) e[`homestay.${k}`] = 'Must be ≥ 0';
      });
    } else {
      const v = Number(payload.homestay?.directAmount ?? 0);
      if (!Number.isFinite(v) || v < 0) e['homestay.directAmount'] = 'Must be ≥ 0';
    }

    // Simple numeric validations
    ['guideExpense','permitExpense','jeepExpense'].forEach(k => {
      if (!Number.isFinite(payload[k]) || payload[k] < 0) e[k] = 'Must be ≥ 0';
    });

    // Other items
    (payload.otherExpensesItems || []).forEach((it, idx) => {
      const v = Number(it?.amount ?? 0);
      if (!Number.isFinite(v) || v < 0) e[`otherExpensesItems.${idx}.amount`] = 'Must be ≥ 0';
    });

    if ((payload.leadPayments || []).length > 5) e.leadPayments = 'Max 5 lead payments';
    return e;
  };

  // ---------- Create ----------
  const handleAddBatch = async () => {
    const t = computeTransport(form);
    const transportTotal = t.total;

    const h = computeHomestay(form);
    const homestayTotal = h.total;

    const otherItems = (form.otherExpensesItems || []).map(it => ({
      remark: (it?.remark || '').trim(),
      amount: parseInt(it?.amount || 0) || 0,
    }));
    const otherTotal = otherItems.reduce((s, it) => s + (it.amount || 0), 0);

    const payload = {
      batchCode: form.batchCode || '',
      trekName: form.trekName || '',
      date: form.startDate || '',
      startDate: form.startDate || '',
      endDate: form.endDate || '',
      noOfPeople: parseInt(form.noOfPeople || 0) || 0,
      basePrice: parseInt(form.basePrice || 0) || 0,
      totalDiscount: parseInt(form.totalDiscount || 0) || 0,

      // transport object
      transport: {
        mode: form.transportMode || 'calc',
        totalKm: parseInt(form.transportTotalKm || 0) || 0,
        ratePerKm: parseInt(form.transportRatePerKm || 0) || 0,
        tollCharge: parseInt(form.transportTollCharge || 0) || 0,
        driverBata: parseInt(form.transportDriverBata || 0) || 0,
        driverShifts: parseInt(form.transportDriverShifts || 0) || 0,
        roadTax: parseInt(form.transportRoadTax || 0) || 0,            // NEW
        parkingCharge: parseInt(form.transportParkingCharge || 0) || 0,// NEW
        directAmount: parseInt(form.transportDirectAmount || 0) || 0,
        total: transportTotal,
      },
      busExpense: transportTotal, // legacy map

      // homestay object
      homestay: {
        mode: form.homestayMode || 'calc',
        people: parseInt(form.homestayPeople || 0) || 0,
        pricePerPerson: parseInt(form.homestayPricePerPerson || 0) || 0,
        jeep: parseInt(form.homestayJeep || 0) || 0,
        directAmount: parseInt(form.homestayDirectAmount || 0) || 0,
        total: homestayTotal,
      },
      stayExpense: homestayTotal, // legacy map

      // simple expense fields
      guideExpense: parseInt(form.guideExpense || 0) || 0,
      permitExpense: parseInt(form.permitExpense || 0) || 0,
      jeepExpense: parseInt(form.jeepExpense || 0) || 0,

      // other expenses structured
      otherExpensesItems: otherItems,
      otherExpensesTotal: otherTotal,
      otherExpense: otherTotal, // legacy map

      // leads
      leadPayments: (form.leadPayments || []).filter(l => l?.name || l?.amount).map(l => ({
        name: l.name,
        amount: parseInt(l.amount || 0) || 0,
      })),

      // remarks
      batchRemarks: form.batchRemarks || '',

      totalIncome: 0,
      totalExpense: 0,
      totalProfit: 0,
      timestamp: Timestamp.now(),
    };

    // totals
    const income = payload.noOfPeople * payload.basePrice - payload.totalDiscount;
    const leadTotal = payload.leadPayments.reduce((s, l) => s + (parseInt(l.amount || 0) || 0), 0);
    const expenses =
      transportTotal +
      homestayTotal +
      payload.guideExpense +
      payload.permitExpense +
      payload.jeepExpense +
      otherTotal +
      leadTotal;

    payload.totalIncome = income;
    payload.totalExpense = expenses;
    payload.totalProfit = income - expenses;

    const errs = validateCreate(payload);
    setCreateErrors(errs);
    if (Object.keys(errs).length) {
      if (createRef.current) createRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    try {
      await addDoc(collection(db, 'batches'), payload);
      // reset form
      setForm({
        batchCode: '',
        trekName: '',
        startDate: '',
        endDate: '',
        noOfPeople: '',
        basePrice: '',
        totalDiscount: '',
        transportMode: 'calc',
        transportTotalKm: '',
        transportRatePerKm: '',
        transportTollCharge: '',
        transportDriverBata: '',
        transportDriverShifts: '',
        transportRoadTax: '',          // NEW
        transportParkingCharge: '',    // NEW
        transportDirectAmount: '',

        homestayMode: 'calc',
        homestayPeople: '',
        homestayPricePerPerson: '',
        homestayJeep: '',
        homestayDirectAmount: '',

        guideExpense: '',
        permitExpense: '',
        jeepExpense: '',
        otherExpensesItems: [],

        leadPayments: [],
        batchRemarks: '',
      });
      setOpenCreate(false);

      const batchSnap = await getDocs(query(collection(db, 'batches')));
      setBatches(batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error adding batch:', err);
      alert('Failed to add batch. Check console.');
    }
  };

  // ---------- Filters + table ----------
  const filteredBatches = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return batches
      .filter(b => {
        const matchesSearch =
          (b.batchCode || '').toLowerCase().includes(term) ||
          (b.trekName || '').toLowerCase().includes(term);

        const month = (b.date || b.startDate || '').slice(0, 7);
        const matchesMonth = monthFilter ? month === monthFilter : true;
        const matchesTrek = trekFilter ? b.trekName === trekFilter : true;
        return matchesSearch && matchesMonth && matchesTrek;
      })
      .sort((a, b) => {
        const da = (a.date || a.startDate || '');
        const dbv = (b.date || b.startDate || '');
        return sortAsc ? da.localeCompare(dbv) : dbv.localeCompare(da);
      });
  }, [batches, searchTerm, monthFilter, trekFilter, sortAsc]);

  useEffect(() => {
    setBatchPage(1);
  }, [searchTerm, monthFilter, trekFilter]);

  const uniqueMonths = [...new Set(batches.map(b => (b.date || b.startDate || '').slice(0, 7)))].filter(Boolean);

  // pagination helpers
  const paginate = (arr, page, size) => {
    const start = (page - 1) * size;
    return arr.slice(start, start + size);
  };
  const batchTotalPages = Math.max(1, Math.ceil(filteredBatches.length / batchPageSize));

  // open create + smooth scroll
  const openCreateAndScroll = () => {
    setOpenCreate(true);
    requestAnimationFrame(() => {
      if (createRef.current) {
        createRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // ---------- View/Edit ----------
  const openView = (b) => {
    // hydrate transport defaults
    const hasTransport = !!b.transport;
    // hydrate homestay defaults
    const hasHomestay = !!b.homestay;

    // hydrate other items
    const hasOtherItems = Array.isArray(b.otherExpensesItems) && b.otherExpensesItems.length > 0;

    const hydrated = {
      ...b,
      startDate: b.startDate || b.date || '',
      endDate: b.endDate || '',

      // transport
      transportMode: hasTransport ? (b.transport.mode || 'calc') : 'direct',
      transportTotalKm: hasTransport ? (b.transport.totalKm ?? '') : '',
      transportRatePerKm: hasTransport ? (b.transport.ratePerKm ?? '') : '',
      transportTollCharge: hasTransport ? (b.transport.tollCharge ?? '') : '',
      transportDriverBata: hasTransport ? (b.transport.driverBata ?? '') : '',
      transportDriverShifts: hasTransport ? (b.transport.driverShifts ?? '') : '',
      transportRoadTax: hasTransport ? (b.transport.roadTax ?? '') : '',                 // NEW
      transportParkingCharge: hasTransport ? (b.transport.parkingCharge ?? '') : '',     // NEW
      transportDirectAmount: hasTransport
        ? (b.transport.directAmount ?? (b.busExpense ?? 0))
        : (b.busExpense ?? 0),

      // homestay
      homestayMode: hasHomestay ? (b.homestay.mode || 'calc') : 'direct',
      homestayPeople: hasHomestay ? (b.homestay.people ?? '') : '',
      homestayPricePerPerson: hasHomestay ? (b.homestay.pricePerPerson ?? '') : '',
      homestayJeep: hasHomestay ? (b.homestay.jeep ?? '') : '',
      homestayDirectAmount: hasHomestay
        ? (b.homestay.directAmount ?? (b.stayExpense ?? 0))
        : (b.stayExpense ?? 0),

      // other items
      otherExpensesItems: hasOtherItems
        ? b.otherExpensesItems.map(it => ({ remark: it.remark || '', amount: it.amount || '' }))
        : (b.otherExpense ? [{ remark: 'Other (legacy)', amount: b.otherExpense }] : []),
    };

    setSelectedBatch(b);
    setEditForm(hydrated);
    setTimeout(() => {
      if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
    }, 0);
  };

  const setEditField = (name, value) => setEditForm(prev => ({ ...prev, [name]: value }));

  const setEditLeadPayment = (i, field, value) => {
    const lp = [...(editForm.leadPayments || [])];
    lp[i] = { ...(lp[i] || {}), [field]: value };
    setEditForm(prev => ({ ...prev, leadPayments: lp }));
  };

  const setEditOtherItem = (i, field, value) => {
    const arr = [...(editForm.otherExpensesItems || [])];
    arr[i] = { ...(arr[i] || { remark: '', amount: '' }), [field]: value };
    setEditForm(prev => ({ ...prev, otherExpensesItems: arr }));
  };
  const addEditOtherItem = () => {
    setEditForm(prev => ({ ...prev, otherExpensesItems: [...(prev.otherExpensesItems || []), { remark: '', amount: '' }] }));
  };
  const removeEditOtherItem = (i) => {
    const arr = [...(editForm.otherExpensesItems || [])];
    arr.splice(i, 1);
    setEditForm(prev => ({ ...prev, otherExpensesItems: arr }));
  };

  const computeTransportFromEdit = () => {
    const mode = editForm.transportMode || 'calc';
    if (mode === 'direct') {
      return parseInt(editForm.transportDirectAmount || 0) || 0;
    }
    const km = parseInt(editForm.transportTotalKm || 0) || 0;
    const rate = parseInt(editForm.transportRatePerKm || 0) || 0;
    const toll = parseInt(editForm.transportTollCharge || 0) || 0;
    const bata = parseInt(editForm.transportDriverBata || 0) || 0;
    const shifts = parseInt(editForm.transportDriverShifts || 0) || 0;
    const roadTax = parseInt(editForm.transportRoadTax || 0) || 0;          // NEW
    const parking = parseInt(editForm.transportParkingCharge || 0) || 0;    // NEW
    return rate * km + toll + bata * shifts + roadTax + parking;            // UPDATED
  };

  const computeHomestayFromEdit = () => {
    const mode = editForm.homestayMode || 'calc';
    if (mode === 'direct') {
      return parseInt(editForm.homestayDirectAmount || 0) || 0;
    }
    const ppl = parseInt(editForm.homestayPeople || 0) || 0;
    const ppp = parseInt(editForm.homestayPricePerPerson || 0) || 0;
    const jeep = parseInt(editForm.homestayJeep || 0) || 0;
    return ppl * ppp + jeep;
  };

  const computeOtherFromEdit = () =>
    (editForm.otherExpensesItems || []).reduce((s, it) => s + (parseInt(it?.amount || 0) || 0), 0);

  const handleSaveEdit = async () => {
    if (!selectedBatch?.id) return;

    const n = parseInt(editForm.noOfPeople || 0) || 0;
    const bp = parseInt(editForm.basePrice || 0) || 0;
    const disc = parseInt(editForm.totalDiscount || 0) || 0;
    const income = n * bp - disc;

    const leadTotal = (editForm.leadPayments || []).reduce(
      (s, l) => s + (parseInt(l?.amount || 0) || 0),
      0
    );

    const transportTotal = computeTransportFromEdit();
    const homestayTotal = computeHomestayFromEdit();
    const otherTotal = computeOtherFromEdit();

    const guide = parseInt(editForm.guideExpense || 0) || 0;
    const permit = parseInt(editForm.permitExpense || 0) || 0;
    const jeep = parseInt(editForm.jeepExpense || 0) || 0;

    const expenses = transportTotal + homestayTotal + guide + permit + jeep + otherTotal + leadTotal;

    const payload = {
      ...editForm,
      date: editForm.startDate || '',

      // normalize numerics
      guideExpense: guide,
      permitExpense: permit,
      jeepExpense: jeep,

      // transport object
      transport: {
        mode: editForm.transportMode || 'calc',
        totalKm: parseInt(editForm.transportTotalKm || 0) || 0,
        ratePerKm: parseInt(editForm.transportRatePerKm || 0) || 0,
        tollCharge: parseInt(editForm.transportTollCharge || 0) || 0,
        driverBata: parseInt(editForm.transportDriverBata || 0) || 0,
        driverShifts: parseInt(editForm.transportDriverShifts || 0) || 0,
        roadTax: parseInt(editForm.transportRoadTax || 0) || 0,           // NEW
        parkingCharge: parseInt(editForm.transportParkingCharge || 0) || 0,// NEW
        directAmount: parseInt(editForm.transportDirectAmount || 0) || 0,
        total: transportTotal,
      },
      busExpense: transportTotal, // legacy

      // homestay object
      homestay: {
        mode: editForm.homestayMode || 'calc',
        people: parseInt(editForm.homestayPeople || 0) || 0,
        pricePerPerson: parseInt(editForm.homestayPricePerPerson || 0) || 0,
        jeep: parseInt(editForm.homestayJeep || 0) || 0,
        directAmount: parseInt(editForm.homestayDirectAmount || 0) || 0,
        total: homestayTotal,
      },
      stayExpense: homestayTotal, // legacy

      // other items
      otherExpensesItems: (editForm.otherExpensesItems || []).map(it => ({
        remark: (it?.remark || '').trim(),
        amount: parseInt(it?.amount || 0) || 0,
      })),
      otherExpensesTotal: otherTotal,
      otherExpense: otherTotal, // legacy

      totalIncome: income,
      totalExpense: expenses,
      totalProfit: income - expenses,
      leadPayments: (editForm.leadPayments || []).filter(l => l?.name || l?.amount).map(l => ({
        name: l.name,
        amount: parseInt(l.amount || 0) || 0,
      })),
    };

    // Validate
    const errs = validateCreate(payload);
    if (Object.keys(errs).length) {
      alert('Please fix required fields in the edit form before saving.');
      return;
    }

    try {
      await updateDoc(doc(db, 'batches', selectedBatch.id), payload);
      const batchSnap = await getDocs(query(collection(db, 'batches')));
      const updated = batchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBatches(updated);
      setSelectedBatch(null);
      setEditForm(null);
    } catch (e) {
      console.error('Failed to save changes:', e);
      alert('Failed to save changes.');
    }
  };

  // ---------- Delete ----------
  const handleDeleteBatch = async (b) => {
    if (!b?.id) return;
    const ok = window.confirm(`Delete batch "${b.batchCode || b.id}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setDeletingId(b.id);
      await deleteDoc(doc(db, 'batches', b.id));
      const snap = await getDocs(query(collection(db, 'batches')));
      setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (selectedBatch?.id === b.id) {
        setSelectedBatch(null);
        setEditForm(null);
      }
    } catch (e) {
      console.error('Failed to delete batch:', e);
      alert('Failed to delete batch.');
    } finally {
      setDeletingId(null);
    }
  };

  // ---------- UI ----------
  return (
    <div className="finance-scope">
    <div className="container">
      {/* Header + actions */}
      <div className="filters">
        <input
          className="input"
          placeholder="Search batch code or trek"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select
          className="select"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
        >
          <option value="">All Months</option>
          {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          className="select"
          value={trekFilter}
          onChange={e => setTrekFilter(e.target.value)}
        >
          <option value="">All Treks</option>
          {treks.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>

        <div className="filters__spacer" />

        <div className="field" style={{ minWidth: 130 }}>
          <label className="field__label">Rows per page</label>
          <select
            className="select"
            value={batchPageSize}
            onChange={(e) => { setBatchPageSize(parseInt(e.target.value, 10)); setBatchPage(1); }}
          >
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button className="btn btn--primary" onClick={openCreateAndScroll}>+ Add Batch</button>
      </div>

      {/* Inline Create Panel */}
      {openCreate && (
        <div ref={createRef} className="card" style={{ marginBottom: 16 }}>
          <div className="modal__header" style={{ padding: 12 }}>
            <div className="modal__title">Add New Batch</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn--ghost" onClick={() => setOpenCreate(false)}>Hide</button>
              <button className="btn btn--primary" onClick={handleAddBatch}>Create</button>
            </div>
          </div>

          <div className="modal__body" style={{ paddingTop: 0 }}>
            <div className="grid-2">
              <div className="field">
                <label className="field__label">Trek</label>
                <select className="select" value={form.trekName} onChange={(e)=>setField('trekName', e.target.value)}>
                  <option value="">Select trek</option>
                  {treks.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                {createErrors.trekName && <div className="error">{createErrors.trekName}</div>}
              </div>
              <div className="field">
                <label className="field__label">Batch Code</label>
                <input className="input" value={form.batchCode} onChange={(e)=>setField('batchCode', e.target.value)} placeholder="BT101" />
                {createErrors.batchCode && <div className="error">{createErrors.batchCode}</div>}
              </div>

              <div className="field">
                <label className="field__label">Start Date</label>
                <input className="input" type="date" value={form.startDate} onChange={(e)=>setField('startDate', e.target.value)} />
                {createErrors.startDate && <div className="error">{createErrors.startDate}</div>}
              </div>
              <div className="field">
                <label className="field__label">End Date</label>
                <input className="input" type="date" value={form.endDate} onChange={(e)=>setField('endDate', e.target.value)} />
                {createErrors.endDate && <div className="error">{createErrors.endDate}</div>}
              </div>

              <div className="field">
                <label className="field__label">Booked Count</label>
                <input className="input" type="number" value={form.noOfPeople} onChange={(e)=>setField('noOfPeople', e.target.value)} placeholder="No. of People" />
                {createErrors.noOfPeople && <div className="error">{createErrors.noOfPeople}</div>}
              </div>
              <div className="field">
                <label className="field__label">Base Price (₹)</label>
                <input className="input" type="number" value={form.basePrice} onChange={(e)=>setField('basePrice', e.target.value)} placeholder="Base Price per Person" />
                {createErrors.basePrice && <div className="error">{createErrors.basePrice}</div>}
              </div>

              <div className="field" style={{gridColumn:'1/-1'}}>
                <label className="field__label">Total Discount (₹)</label>
                <input className="input" type="number" value={form.totalDiscount} onChange={(e)=>setField('totalDiscount', e.target.value)} placeholder="0" />
                {createErrors.totalDiscount && <div className="error">{createErrors.totalDiscount}</div>}
              </div>
            </div>

            {/* Transport Expenses */}
            <h4 className="muted" style={{marginTop:12}}>Transport Expenses</h4>
            <div className="grid-3" style={{ alignItems: 'end' }}>
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label className="field__label">Mode</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label><input type="radio" name="transportMode" value="calc" checked={form.transportMode === 'calc'} onChange={(e)=>setField('transportMode', e.target.value)} /> Calculate</label>
                  <label><input type="radio" name="transportMode" value="direct" checked={form.transportMode === 'direct'} onChange={(e)=>setField('transportMode', e.target.value)} /> Direct amount</label>
                </div>
              </div>
              {form.transportMode === 'calc' ? (
                <>
                  <div className="field">
                    <label className="field__label">Total KM</label>
                    <input className="input" type="number" value={form.transportTotalKm} onChange={(e)=>setField('transportTotalKm', e.target.value)} />
                    {createErrors['transport.totalKm'] && <div className="error">{createErrors['transport.totalKm']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Rate / KM (₹)</label>
                    <input className="input" type="number" value={form.transportRatePerKm} onChange={(e)=>setField('transportRatePerKm', e.target.value)} />
                    {createErrors['transport.ratePerKm'] && <div className="error">{createErrors['transport.ratePerKm']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Toll Charges (₹)</label>
                    <input className="input" type="number" value={form.transportTollCharge} onChange={(e)=>setField('transportTollCharge', e.target.value)} />
                    {createErrors['transport.tollCharge'] && <div className="error">{createErrors['transport.tollCharge']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Driver Bata (₹)</label>
                    <input className="input" type="number" value={form.transportDriverBata} onChange={(e)=>setField('transportDriverBata', e.target.value)} />
                    {createErrors['transport.driverBata'] && <div className="error">{createErrors['transport.driverBata']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">No. of Shifts</label>
                    <input className="input" type="number" value={form.transportDriverShifts} onChange={(e)=>setField('transportDriverShifts', e.target.value)} />
                    {createErrors['transport.driverShifts'] && <div className="error">{createErrors['transport.driverShifts']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Road Tax (₹)</label>
                    <input className="input" type="number" value={form.transportRoadTax} onChange={(e)=>setField('transportRoadTax', e.target.value)} />
                    {createErrors['transport.roadTax'] && <div className="error">{createErrors['transport.roadTax']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Parking Charge (₹)</label>
                    <input className="input" type="number" value={form.transportParkingCharge} onChange={(e)=>setField('transportParkingCharge', e.target.value)} />
                    {createErrors['transport.parkingCharge'] && <div className="error">{createErrors['transport.parkingCharge']}</div>}
                  </div>
                </>
              ) : (
                <div className="field" style={{ gridColumn: '1/3' }}>
                  <label className="field__label">Direct Transport Amount (₹)</label>
                  <input className="input" type="number" value={form.transportDirectAmount} onChange={(e)=>setField('transportDirectAmount', e.target.value)} />
                  {createErrors['transport.directAmount'] && <div className="error">{createErrors['transport.directAmount']}</div>}
                </div>
              )}
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <div className="card" style={{ padding: 12 }}>
                  <div className="card__title">Transport Total</div>
                  <div className="card__metric">₹{preview.transportTotal || 0}</div>
                </div>
              </div>
            </div>

            {/* Homestay */}
            <h4 className="muted" style={{marginTop:12}}>Homestay</h4>
            <div className="grid-3" style={{ alignItems: 'end' }}>
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label className="field__label">Mode</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label><input type="radio" name="homestayMode" value="calc" checked={form.homestayMode === 'calc'} onChange={(e)=>setField('homestayMode', e.target.value)} /> Calculate</label>
                  <label><input type="radio" name="homestayMode" value="direct" checked={form.homestayMode === 'direct'} onChange={(e)=>setField('homestayMode', e.target.value)} /> Direct amount</label>
                </div>
              </div>
              {form.homestayMode === 'calc' ? (
                <>
                  <div className="field">
                    <label className="field__label">No. of People</label>
                    <input className="input" type="number" value={form.homestayPeople} onChange={(e)=>setField('homestayPeople', e.target.value)} />
                    {createErrors['homestay.people'] && <div className="error">{createErrors['homestay.people']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Price / Person (₹)</label>
                    <input className="input" type="number" value={form.homestayPricePerPerson} onChange={(e)=>setField('homestayPricePerPerson', e.target.value)} />
                    {createErrors['homestay.pricePerPerson'] && <div className="error">{createErrors['homestay.pricePerPerson']}</div>}
                  </div>
                  <div className="field">
                    <label className="field__label">Homestay Jeep (₹)</label>
                    <input className="input" type="number" value={form.homestayJeep} onChange={(e)=>setField('homestayJeep', e.target.value)} />
                    {createErrors['homestay.jeep'] && <div className="error">{createErrors['homestay.jeep']}</div>}
                  </div>
                </>
              ) : (
                <div className="field" style={{ gridColumn: '1/3' }}>
                  <label className="field__label">Direct Homestay Amount (₹)</label>
                  <input className="input" type="number" value={form.homestayDirectAmount} onChange={(e)=>setField('homestayDirectAmount', e.target.value)} />
                  {createErrors['homestay.directAmount'] && <div className="error">{createErrors['homestay.directAmount']}</div>}
                </div>
              )}
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <div className="card" style={{ padding: 12 }}>
                  <div className="card__title">Homestay Total</div>
                  <div className="card__metric">₹{preview.homestayTotal || 0}</div>
                </div>
              </div>
            </div>

            {/* Simple expense fields */}
            <h4 className="muted" style={{marginTop:12}}>Other Fixed Expenses</h4>
            <div className="grid-3">
              {['guideExpense','permitExpense','jeepExpense'].map(key => (
                <div className="field" key={key}>
                  <label className="field__label">
                    {key === 'guideExpense' && 'Guide (₹)'}
                    {key === 'permitExpense' && 'Permit (₹)'}
                    {key === 'jeepExpense' && 'Jeep (₹)'}
                  </label>
                  <input className="input" type="number" value={form[key]} onChange={(e)=>setField(key, e.target.value)} />
                  {createErrors[key] && <div className="error">{createErrors[key]}</div>}
                </div>
              ))}
            </div>

            {/* Dynamic other expenses */}
            <h4 className="muted" style={{marginTop:12}}>Additional Expenses (with remarks)</h4>
            <div className="field">
              <button type="button" className="btn" onClick={addOtherExpenseItem}>+ Add Expense</button>
            </div>
            {(form.otherExpensesItems || []).length === 0 ? (
              <div className="empty-state">No extra expenses added.</div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th style={{width:'70%'}}>Remarks</th>
                      <th>Amount (₹)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.otherExpensesItems.map((it, i) => (
                      <tr key={i}>
                        <td>
                          <input className="input" placeholder="e.g. Extra porter, snacks…" value={it.remark} onChange={(e)=>setOtherExpenseItem(i,'remark',e.target.value)} />
                        </td>
                        <td style={{width:140}}>
                          <input className="input" type="number" value={it.amount} onChange={(e)=>setOtherExpenseItem(i,'amount',e.target.value)} />
                          {createErrors[`otherExpensesItems.${i}.amount`] && <div className="error">{createErrors[`otherExpensesItems.${i}.amount`]}</div>}
                        </td>
                        <td style={{width:80}}>
                          <button type="button" className="btn btn--ghost" onClick={()=>removeOtherExpenseItem(i)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Lead Payments */}
            <h4 className="muted" style={{marginTop:12}}>Lead Payments (max 5)</h4>
            {[0,1,2,3,4].map(i => (
              <div key={i} className="grid-2" style={{marginBottom:8}}>
                <div className="field">
                  <label className="field__label">Lead</label>
                  <select className="select" value={form.leadPayments?.[i]?.name || ''} onChange={(e)=>setLeadPayment(i,'name',e.target.value)}>
                    <option value="">-- Select Lead --</option>
                    {leads.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Amount (₹)</label>
                  <input className="input" type="number" value={form.leadPayments?.[i]?.amount || ''} onChange={(e)=>setLeadPayment(i,'amount',e.target.value)} placeholder="₹ Amount" />
                </div>
              </div>
            ))}

            {/* Batch Remarks */}
            <h4 className="muted" style={{marginTop:12}}>Batch Remarks</h4>
            <textarea className="input" rows={3} placeholder="Any notes for this batch…" value={form.batchRemarks} onChange={(e)=>setField('batchRemarks', e.target.value)} />

            {/* Live P&L preview */}
            <div className="cards-grid" style={{marginTop:8}}>
              <div className="card"><div className="card__title">Income</div><div className="card__metric">₹{preview.income || 0}</div></div>
              <div className="card"><div className="card__title">Lead Payment</div><div className="card__metric">₹{preview.leadTotal || 0}</div></div>
              <div className="card"><div className="card__title">Transport</div><div className="card__metric">₹{preview.transportTotal || 0}</div></div>
              <div className="card"><div className="card__title">Homestay</div><div className="card__metric">₹{preview.homestayTotal || 0}</div></div>
              <div className="card"><div className="card__title">Other (custom)</div><div className="card__metric">₹{preview.otherTotal || 0}</div></div>
              <div className="card"><div className="card__title">Expenses</div><div className="card__metric">₹{preview.expenses || 0}</div></div>
              <div className="card"><div className="card__title">Profit</div><div className="card__metric">₹{preview.profit || 0}</div></div>
            </div>

            <div className="modal__footer" style={{ paddingTop: 12 }}>
              <button className="btn btn--ghost" onClick={()=>setOpenCreate(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleAddBatch}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Batch Code</th>
              <th style={{cursor:'pointer'}} onClick={() => setSortAsc(!sortAsc)}>
                Date {sortAsc ? '🔽' : '🔼'}
              </th>
              <th>Trek</th>
              <th>Income</th>
              <th>Expense</th>
              <th>Profit</th>
              <th>Total Leads</th>
              <th>Lead Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.length === 0 && (
              <tr><td colSpan={9} className="empty-state">No batches match your filters.</td></tr>
            )}
            {paginate(filteredBatches, batchPage, batchPageSize).map((b) => {
              const leadCount = b.leadPayments?.filter(lp => lp?.name && parseInt(lp?.amount || 0) > 0).length || 0;
              const leadTotal = b.leadPayments?.reduce((sum, lp) => sum + (parseInt(lp?.amount || 0)), 0) || 0;
              const isDeleting = deletingId === b.id;
              return (
                <tr key={b.id}>
                  <td>{b.batchCode || '-'}</td>
                  <td>{b.date || b.startDate || '-'}</td>
                  <td>{b.trekName || '-'}</td>
                  <td>₹{b.totalIncome || 0}</td>
                  <td>₹{b.totalExpense || 0}</td>
                  <td>₹{b.totalProfit || 0}</td>
                  <td>{leadCount}</td>
                  <td>₹{leadTotal}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn--ghost" onClick={() => openView(b)} disabled={isDeleting}>View</button>
                    <button
                      className="btn btn--danger"
                      onClick={() => handleDeleteBatch(b)}
                      disabled={isDeleting}
                      style={{ marginLeft: 6 }}
                      title="Delete batch"
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pager */}
        <Pager page={batchPage} setPage={setBatchPage} totalPages={batchTotalPages} />
      </div>

      {/* Detail Modal (scrollable + editable) */}
      {selectedBatch && editForm && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header">
              <div className="modal__title">Edit Batch — {selectedBatch.batchCode}</div>
              <button className="btn btn--icon" onClick={()=>{ setSelectedBatch(null); setEditForm(null); }}>✕</button>
            </div>

            <div
              className="modal__body"
              ref={modalBodyRef}
              style={{ overflowY: 'auto', paddingTop: 8 }}
            >
              <div className="grid-2">
                <div className="field">
                  <label className="field__label">Trek</label>
                  <select className="select" value={editForm.trekName || ''} onChange={(e)=>setEditField('trekName', e.target.value)}>
                    <option value="">Select trek</option>
                    {treks.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">Batch Code</label>
                  <input className="input" value={editForm.batchCode || ''} onChange={(e)=>setEditField('batchCode', e.target.value)} />
                </div>

                <div className="field">
                  <label className="field__label">Start Date</label>
                  <input className="input" type="date" value={editForm.startDate || ''} onChange={(e)=>setEditField('startDate', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">End Date</label>
                  <input className="input" type="date" value={editForm.endDate || ''} onChange={(e)=>setEditField('endDate', e.target.value)} />
                </div>

                <div className="field">
                  <label className="field__label">Booked Count</label>
                  <input className="input" type="number" value={editForm.noOfPeople || ''} onChange={(e)=>setEditField('noOfPeople', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">Base Price (₹)</label>
                  <input className="input" type="number" value={editForm.basePrice || ''} onChange={(e)=>setEditField('basePrice', e.target.value)} />
                </div>

                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label className="field__label">Total Discount (₹)</label>
                  <input className="input" type="number" value={editForm.totalDiscount || ''} onChange={(e)=>setEditField('totalDiscount', e.target.value)} />
                </div>
              </div>

              {/* Transport */}
              <h4 className="muted" style={{marginTop:12}}>Transport Expenses</h4>
              <div className="grid-3" style={{ alignItems: 'end' }}>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label className="field__label">Mode</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label><input type="radio" name="editTransportMode" value="calc" checked={editForm.transportMode === 'calc'} onChange={(e)=>setEditField('transportMode', e.target.value)} /> Calculate</label>
                    <label><input type="radio" name="editTransportMode" value="direct" checked={editForm.transportMode === 'direct'} onChange={(e)=>setEditField('transportMode', e.target.value)} /> Direct amount</label>
                  </div>
                </div>
                {editForm.transportMode === 'calc' ? (
                  <>
                    <div className="field">
                      <label className="field__label">Total KM</label>
                      <input className="input" type="number" value={editForm.transportTotalKm || ''} onChange={(e)=>setEditField('transportTotalKm', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Rate / KM (₹)</label>
                      <input className="input" type="number" value={editForm.transportRatePerKm || ''} onChange={(e)=>setEditField('transportRatePerKm', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Toll Charges (₹)</label>
                      <input className="input" type="number" value={editForm.transportTollCharge || ''} onChange={(e)=>setEditField('transportTollCharge', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Driver Bata (₹)</label>
                      <input className="input" type="number" value={editForm.transportDriverBata || ''} onChange={(e)=>setEditField('transportDriverBata', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">No. of Shifts</label>
                      <input className="input" type="number" value={editForm.transportDriverShifts || ''} onChange={(e)=>setEditField('transportDriverShifts', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Road Tax (₹)</label>
                      <input className="input" type="number" value={editForm.transportRoadTax || ''} onChange={(e)=>setEditField('transportRoadTax', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Parking Charge (₹)</label>
                      <input className="input" type="number" value={editForm.transportParkingCharge || ''} onChange={(e)=>setEditField('transportParkingCharge', e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="field" style={{ gridColumn: '1/3' }}>
                    <label className="field__label">Direct Transport Amount (₹)</label>
                    <input className="input" type="number" value={editForm.transportDirectAmount || ''} onChange={(e)=>setEditField('transportDirectAmount', e.target.value)} />
                  </div>
                )}
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="card__title">Transport Total</div>
                    <div className="card__metric">₹{computeTransportFromEdit()}</div>
                  </div>
                </div>
              </div>

              {/* Homestay */}
              <h4 className="muted" style={{marginTop:12}}>Homestay</h4>
              <div className="grid-3" style={{ alignItems: 'end' }}>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label className="field__label">Mode</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label><input type="radio" name="editHomestayMode" value="calc" checked={editForm.homestayMode === 'calc'} onChange={(e)=>setEditField('homestayMode', e.target.value)} /> Calculate</label>
                    <label><input type="radio" name="editHomestayMode" value="direct" checked={editForm.homestayMode === 'direct'} onChange={(e)=>setEditField('homestayMode', e.target.value)} /> Direct amount</label>
                  </div>
                </div>
                {editForm.homestayMode === 'calc' ? (
                  <>
                    <div className="field">
                      <label className="field__label">No. of People</label>
                      <input className="input" type="number" value={editForm.homestayPeople || ''} onChange={(e)=>setEditField('homestayPeople', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Price / Person (₹)</label>
                      <input className="input" type="number" value={editForm.homestayPricePerPerson || ''} onChange={(e)=>setEditField('homestayPricePerPerson', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field__label">Homestay Jeep (₹)</label>
                      <input className="input" type="number" value={editForm.homestayJeep || ''} onChange={(e)=>setEditField('homestayJeep', e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="field" style={{ gridColumn: '1/3' }}>
                    <label className="field__label">Direct Homestay Amount (₹)</label>
                    <input className="input" type="number" value={editForm.homestayDirectAmount || ''} onChange={(e)=>setEditField('homestayDirectAmount', e.target.value)} />
                  </div>
                )}
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="card__title">Homestay Total</div>
                    <div className="card__metric">₹{computeHomestayFromEdit()}</div>
                  </div>
                </div>
              </div>

              {/* Fixed expense fields */}
              <h4 className="muted" style={{marginTop:12}}>Other Fixed Expenses</h4>
              <div className="grid-3">
                {['guideExpense','permitExpense','jeepExpense'].map(key => (
                  <div className="field" key={key}>
                    <label className="field__label">
                      {key === 'guideExpense' && 'Guide (₹)'}
                      {key === 'permitExpense' && 'Permit (₹)'}
                      {key === 'jeepExpense' && 'Jeep (₹)'}
                    </label>
                    <input className="input" type="number" value={editForm[key] || ''} onChange={(e)=>setEditField(key, e.target.value)} />
                  </div>
                ))}
              </div>

              {/* Dynamic other expenses */}
              <h4 className="muted" style={{marginTop:12}}>Additional Expenses (with remarks)</h4>
              <div className="field">
                <button type="button" className="btn" onClick={addEditOtherItem}>+ Add Expense</button>
              </div>
              {(editForm.otherExpensesItems || []).length === 0 ? (
                <div className="empty-state">No extra expenses added.</div>
              ) : (
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th style={{width:'70%'}}>Remarks</th>
                        <th>Amount (₹)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editForm.otherExpensesItems.map((it, i) => (
                        <tr key={i}>
                          <td>
                            <input className="input" placeholder="e.g. Extra porter, snacks…" value={it.remark} onChange={(e)=>setEditOtherItem(i,'remark',e.target.value)} />
                          </td>
                          <td style={{width:140}}>
                            <input className="input" type="number" value={it.amount} onChange={(e)=>setEditOtherItem(i,'amount',e.target.value)} />
                          </td>
                          <td style={{width:80}}>
                            <button type="button" className="btn btn--ghost" onClick={()=>removeEditOtherItem(i)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Leads */}
              <h4 className="muted" style={{marginTop:12}}>Lead Payments (max 5)</h4>
              {[0,1,2,3,4].map(i => (
                <div key={i} className="grid-2" style={{marginBottom:8}}>
                  <div className="field">
                    <label className="field__label">Lead</label>
                    <select className="select" value={editForm.leadPayments?.[i]?.name || ''} onChange={(e)=>setEditLeadPayment(i,'name',e.target.value)}>
                      <option value="">-- Select Lead --</option>
                      {leads.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label">Amount (₹)</label>
                    <input className="input" type="number" value={editForm.leadPayments?.[i]?.amount || ''} onChange={(e)=>setEditLeadPayment(i,'amount',e.target.value)} placeholder="₹ Amount" />
                  </div>
                </div>
              ))}

              {/* Remarks */}
              <h4 className="muted" style={{marginTop:12}}>Batch Remarks</h4>
              <textarea className="input" rows={3} placeholder="Any notes for this batch…" value={editForm.batchRemarks || ''} onChange={(e)=>setEditField('batchRemarks', e.target.value)} />
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={()=>{ setSelectedBatch(null); setEditForm(null); }}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default Batches;