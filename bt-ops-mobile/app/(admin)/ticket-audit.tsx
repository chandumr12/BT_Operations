import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, RefreshControl, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AppShell } from '@/components/AppShell';
import { PageTitle, Panel, Chip, EmptyState } from '@/components/ui';
import { DataTable, Column } from '@/components/finance/FinanceUI';
import { Button } from '@/components/Button';
import { ModalSafeArea } from '@/components/ModalSafeArea';
import { Colors } from '@/constants/Colors';
import api from '@/utils/api';
import { describeError } from '@/utils/errors';
import { confirmAction } from '@/utils/confirm';

/**
 * Ported from the actual deployed frontend/src/pages/TicketAudit.js — pulled
 * directly from the live app's JS source map since this page (and its
 * search/filter/history/CSV-export features) isn't in either the local repo
 * or origin/main; whoever built it deployed straight to Firebase Hosting
 * without ever pushing the source. Every field, endpoint, and piece of
 * logic below matches that recovered source 1:1 — this is not a guess from
 * the screenshot.
 */

interface Credential { id: string; email: string; label?: string; active?: boolean }
interface Visitor { no?: number; name?: string; age?: string; gender?: string; mobile?: string; idType?: string; idNumber?: string }
interface AccountReport { email: string; label?: string; ticketNo?: string; orderId?: string; visitorCount?: number; visitors?: Visitor[] }
interface TrekReport { trekName: string; totalTickets: number; date?: string; slot?: string; district?: string; accounts?: AccountReport[] }
interface FailedAccount { email: string; label?: string; error?: string }
interface Report {
  id?: string; generatedAt?: string; retriedAt?: string;
  successAccounts?: number; failedAccounts?: (string | FailedAccount)[];
  treks?: TrekReport[]; totalTickets?: number;
}
interface RunStatus { status: 'idle' | 'running' | 'done' | 'error'; message?: string; done?: number; total?: number }

const fmtDt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtHistDt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const failedEmail = (f: string | FailedAccount) => typeof f === 'string' ? f : f.email;
const failedLabel = (f: string | FailedAccount) => typeof f === 'string' ? '' : (f.label ?? '');
const failedError = (f: string | FailedAccount) => typeof f === 'string' ? '' : (f.error ?? '');

type Tab = 'report' | 'accounts' | 'run';
type SortBy = 'date' | 'name' | 'tickets' | 'visitors';
type ViewMode = 'cards' | 'table';
type RunType = 'full' | 'retry-latest' | 'retry-history' | 'selected';

async function exportCsv(treks: TrekReport[]) {
  const header = ['Trek', 'Date', 'Slot', 'District', 'Account', 'Ticket No', 'Order ID', 'Visitor Name', 'Age', 'Gender', 'Mobile', 'ID Type', 'ID Number'];
  const rows: string[][] = [header];
  for (const trek of treks) {
    for (const acc of trek.accounts ?? []) {
      if (acc.visitors?.length) {
        for (const v of acc.visitors) {
          rows.push([trek.trekName, trek.date ?? '', trek.slot ?? '', trek.district ?? '',
            acc.label || acc.email, acc.ticketNo ?? '', acc.orderId ?? '',
            v.name ?? '', v.age ?? '', v.gender ?? '', v.mobile ?? '', v.idType ?? '', v.idNumber ?? '']);
        }
      } else {
        rows.push([trek.trekName, trek.date ?? '', trek.slot ?? '', trek.district ?? '',
          acc.label || acc.email, acc.ticketNo ?? '', acc.orderId ?? '', '', '', '', '', '', '']);
      }
    }
  }
  const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const uri = FileSystem.cacheDirectory + `ticket-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export ticket audit CSV' });
}

export default function TicketAuditScreen() {
  const [tab, setTab] = useState<Tab>('report');
  const [creds, setCreds] = useState<Credential[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [history, setHistory] = useState<Report[]>([]);
  const [activeRunId, setActiveRunId] = useState('latest');
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [acctSearch, setAcctSearch] = useState('');
  const [selectedAccts, setSelectedAccts] = useState<Set<string>>(new Set());
  const [runningSelected, setRunningSelected] = useState(false);

  const [credModal, setCredModal] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState(20);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runTypeRef = useRef<RunType>('full');

  const [search, setSearch] = useState('');
  const [filterTrek, setFilterTrek] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filterSheet, setFilterSheet] = useState<'trek' | 'date' | 'account' | 'sort' | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const displayReport = activeReport ?? report;

  const trekNames = useMemo(() => Array.from(new Set((displayReport?.treks ?? []).map(t => t.trekName))).sort(), [displayReport]);
  const dates = useMemo(() => Array.from(new Set((displayReport?.treks ?? []).map(t => t.date).filter(Boolean) as string[])).sort(), [displayReport]);
  const accountOptions = useMemo(() => Array.from(new Set((displayReport?.treks ?? []).flatMap(t => (t.accounts ?? []).map(a => a.label || a.email)))).sort(), [displayReport]);

  const filteredTreks = useMemo(() => {
    let treks = displayReport?.treks ?? [];
    if (filterTrek) treks = treks.filter(t => t.trekName === filterTrek);
    if (filterDate) treks = treks.filter(t => t.date === filterDate);

    if (filterAccount) {
      treks = treks
        .map(t => {
          const accounts = (t.accounts ?? []).filter(a => (a.label || a.email) === filterAccount);
          return { ...t, accounts, totalTickets: accounts.reduce((s, a) => s + (a.visitors?.length ?? 0), 0) };
        })
        .filter(t => t.accounts.length > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      treks = treks.map(t => {
        if (t.trekName.toLowerCase().includes(q) || t.district?.toLowerCase().includes(q) || t.date?.includes(q)) return t;
        const matched = (t.accounts ?? []).filter(a =>
          a.ticketNo?.toLowerCase().includes(q) ||
          a.orderId?.toLowerCase().includes(q) ||
          (a.label || a.email)?.toLowerCase().includes(q) ||
          (a.visitors ?? []).some(v => v.name?.toLowerCase().includes(q) || v.mobile?.includes(q) || v.idNumber?.toLowerCase().includes(q))
        );
        if (matched.length > 0) return { ...t, accounts: matched, totalTickets: matched.reduce((s, a) => s + (a.visitors?.length ?? 0), 0) };
        return null;
      }).filter((t): t is TrekReport => !!t);
    }

    return [...treks].sort((a, b) => {
      if (sortBy === 'name') return a.trekName.localeCompare(b.trekName);
      if (sortBy === 'tickets') return b.totalTickets - a.totalTickets;
      if (sortBy === 'visitors') {
        const av = (a.accounts ?? []).reduce((s, x) => s + (x.visitors?.length ?? 0), 0);
        const bv = (b.accounts ?? []).reduce((s, x) => s + (x.visitors?.length ?? 0), 0);
        return bv - av;
      }
      return (a.date ?? '').localeCompare(b.date ?? '');
    });
  }, [displayReport, search, filterTrek, filterDate, filterAccount, sortBy]);

  const filteredTickets = filteredTreks.reduce((s, t) => s + (t.totalTickets || 0), 0);
  const filteredVisitors = filteredTreks.reduce((s, t) => s + (t.accounts ?? []).reduce((ss, a) => ss + (a.visitors?.length ?? 0), 0), 0);
  const hasFilters = !!(search || filterTrek || filterDate || filterAccount);
  const clearFilters = () => { setSearch(''); setFilterTrek(''); setFilterDate(''); setFilterAccount(''); };

  const loadReport = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/report');
      const r: Report | null = res.data?.generatedAt ? res.data : null;
      setReport(r);
      setActiveReport(r);
      setActiveRunId('latest');
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try { const res = await api.get('/ticket-audit/report/history'); setHistory(res.data ?? []); }
    catch {}
  }, []);

  useEffect(() => {
    if (activeRunId !== 'latest') {
      const found = history.find(h => h.id === activeRunId);
      if (found) setActiveReport(found);
    }
  }, [activeRunId, history]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/ticket-audit/run/status');
      const st: RunStatus = res.data;
      setRunStatus(st);
      if (st?.status === 'running') { setRunning(true); setRetrying(false); setRunningSelected(false); }
      else {
        setRunning(false); setRetrying(false); setRunningSelected(false);
        if (st?.status === 'done') {
          loadHistory();
          if (runTypeRef.current !== 'retry-history') loadReport();
        }
      }
    } catch {}
  }, [loadReport, loadHistory]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [credsRes] = await Promise.all([api.get('/ticket-audit/credentials'), loadReport(), loadStatus(), loadHistory()]);
      setCreds(credsRes.data ?? []);
    } catch (e: any) {
      setError(describeError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadReport, loadStatus, loadHistory]);

  useEffect(() => {
    if (running || retrying || runningSelected) pollRef.current = setInterval(loadStatus, 4000);
    else if (pollRef.current) clearInterval(pollRef.current);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [running, retrying, runningSelected, loadStatus]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(true); };

  const activeCreds = creds.filter(c => c.active !== false);

  const startAudit = async () => {
    if (running) return;
    runTypeRef.current = 'full';
    setRunning(true);
    setRunStatus({ status: 'running', message: 'Starting audit…', done: 0, total: 0 });
    try {
      await api.post(`/ticket-audit/run?concurrency=${concurrency}`);
      setTab('run');
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? 'Failed to start audit';
      Alert.alert('Error', msg);
      setRunning(false);
      setRunStatus({ status: 'error', message: msg });
    }
  };

  const retryFailed = async () => {
    if (running || retrying) return;
    runTypeRef.current = activeRunId === 'latest' ? 'retry-latest' : 'retry-history';
    setRetrying(true);
    setRunStatus({ status: 'running', message: 'Retrying failed accounts…', done: 0, total: 0 });
    try {
      await api.post(`/ticket-audit/run/retry?concurrency=${concurrency}&source_run_id=${activeRunId}`);
      setTab('report');
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? 'Failed to start retry';
      Alert.alert('Error', msg);
      setRetrying(false);
      setRunStatus({ status: 'error', message: msg });
    }
  };

  const clearReport = () => {
    if (running || retrying) { Alert.alert('Please wait', 'Wait for the current audit to finish.'); return; }
    confirmAction('Clear report?', 'The current audit report will be wiped so the next run starts fresh.', 'Clear', async () => {
      setClearing(true);
      try {
        await api.delete('/ticket-audit/report');
        setReport(null);
        setActiveReport(null);
        setRunStatus(null);
      } catch (e: any) {
        Alert.alert('Error', e.response?.data?.detail ?? 'Failed to clear report');
      } finally { setClearing(false); }
    });
  };

  const runSelected = async () => {
    if (running || retrying || runningSelected || selectedAccts.size === 0) return;
    runTypeRef.current = 'selected';
    setRunningSelected(true);
    setRunStatus({ status: 'running', message: `Auditing ${selectedAccts.size} selected account(s)…`, done: 0, total: selectedAccts.size });
    try {
      await api.post(`/ticket-audit/run/selected?concurrency=${concurrency}`, Array.from(selectedAccts));
      setTab('report');
      setSelectedAccts(new Set());
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? 'Failed to start selected audit';
      Alert.alert('Error', msg);
      setRunningSelected(false);
      setRunStatus({ status: 'error', message: msg });
    }
  };

  const clearAllHistory = () => {
    if (running || retrying) { Alert.alert('Please wait', 'Wait for the current audit to finish.'); return; }
    confirmAction('Clear all history?', 'All saved run history entries will be deleted. The current report is kept.', 'Clear', async () => {
      try {
        const res = await api.delete('/ticket-audit/reports/history');
        setHistory([]);
        Alert.alert('Cleared', `Cleared ${res.data?.deleted ?? 0} historical run(s).`);
      } catch (e: any) {
        Alert.alert('Error', e.response?.data?.detail ?? 'Failed to clear history');
      }
    });
  };

  const deleteCred = (c: Credential) => {
    confirmAction('Remove account?', `${c.label || c.email} will no longer be audited.`, 'Remove', async () => {
      setDeletingId(c.id);
      try { await api.delete(`/ticket-audit/credentials/${c.id}`); load(true); }
      catch { Alert.alert('Error', 'Could not remove account'); }
      finally { setDeletingId(null); }
    });
  };

  const toggleAcct = (email: string) => setSelectedAccts(s => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n; });

  const totalTickets = report?.treks?.reduce((s, t) => s + (t.totalTickets || 0), 0) ?? 0;

  const filteredCreds = creds.filter(c => {
    const q = acctSearch.toLowerCase();
    return !q || (c.label ?? '').toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });
  const allFilteredEmails = filteredCreds.map(c => c.email);
  const allSelected = allFilteredEmails.length > 0 && allFilteredEmails.every(e => selectedAccts.has(e));
  const toggleAll = () => setSelectedAccts(s => {
    const n = new Set(s);
    if (allSelected) allFilteredEmails.forEach(e => n.delete(e));
    else allFilteredEmails.forEach(e => n.add(e));
    return n;
  });

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
      <View style={{ gap: 12 }}>
        <PageTitle
          icon="scan-outline"
          title="Ticket Audit"
          subtitle={`Aranya Vihaara · ${activeCreds.length} active account${activeCreds.length !== 1 ? 's' : ''}`}
          right={
            <TouchableOpacity
              style={[s.runBtn, (running || activeCreds.length === 0) && s.runBtnDisabled]}
              onPress={startAudit}
              disabled={running || activeCreds.length === 0}
              activeOpacity={0.85}
            >
              {running ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="play" size={13} color={Colors.white} />}
              <Text style={s.runBtnText}>{running ? 'Running…' : 'Run Audit'}</Text>
            </TouchableOpacity>
          }
        />

        {error && (
          <Panel style={s.errorPanel} padding={14}>
            <View style={s.errorRow}>
              <Ionicons name="warning-outline" size={18} color={Colors.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          </Panel>
        )}

        <RunStatusBanner runStatus={runStatus} onRefreshReport={() => { loadReport(); setTab('report'); }} />

        <View style={s.statsRow}>
          <StatBlock label="Accounts" value={creds.length} color={Colors.slate900} />
          <StatBlock label="Active" value={activeCreds.length} color="#22c55e" />
          <StatBlock label="Treks in report" value={report?.treks?.length ?? '—'} color={Colors.primary} />
        </View>

        <View style={s.tabRow}>
          <Chip label="Audit Report" active={tab === 'report'} onPress={() => setTab('report')} activeBg={Colors.primary} />
          <Chip label="Accounts" active={tab === 'accounts'} onPress={() => setTab('accounts')} activeBg={Colors.primary} />
          <Chip label="Run Audit" active={tab === 'run'} onPress={() => setTab('run')} activeBg={Colors.primary} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ marginTop: 14, gap: 10 }}>

          {/* ── REPORT TAB ──────────────────────────────────────────────── */}
          {tab === 'report' && (
            !displayReport ? (
              <Panel padding={0}>
                <EmptyState icon="ticket-outline" title="No audit report yet" message="Tap Run Audit above to check all accounts." />
                <View style={{ alignItems: 'center', paddingBottom: 18 }}>
                  <TouchableOpacity
                    style={[s.runBtn, (running || activeCreds.length === 0) && s.runBtnDisabled]}
                    onPress={startAudit}
                    disabled={running || activeCreds.length === 0}
                  >
                    {running ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="play" size={12} color={Colors.white} />}
                    <Text style={s.runBtnText}>{running ? 'Running…' : 'Run Audit'}</Text>
                  </TouchableOpacity>
                </View>
              </Panel>
            ) : (
              <>
                {history.length > 0 && (
                  <Panel padding={12} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={13} color={Colors.slate400} />
                    <Text style={s.historyLabel}>HISTORY</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                      <TouchableOpacity
                        style={[s.histChip, activeRunId === 'latest' && s.histChipActive]}
                        onPress={() => { setActiveRunId('latest'); setActiveReport(report); }}
                      >
                        <Text style={[s.histChipText, activeRunId === 'latest' && s.histChipTextActive]}>Latest</Text>
                      </TouchableOpacity>
                      {history.map(run => (
                        <TouchableOpacity
                          key={run.id}
                          style={[s.histChip, activeRunId === run.id && s.histChipActive]}
                          onPress={() => { setActiveRunId(run.id!); setActiveReport(run); }}
                        >
                          <Text style={[s.histChipText, activeRunId === run.id && s.histChipTextActive]}>
                            {fmtHistDt(run.generatedAt)} <Text style={{ opacity: 0.7 }}>({run.totalTickets}t)</Text>
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Panel>
                )}

                <Panel padding={14} style={s.summaryRow}>
                  <View>
                    <Text style={s.summaryLabel}>{activeRunId === 'latest' ? 'Last audit' : 'Historical run'}</Text>
                    <Text style={s.summaryValue}>{fmtDt(displayReport?.generatedAt)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={s.summaryBig}>{displayReport?.successAccounts ?? 0}</Text>
                      <Text style={s.summaryTiny}>Logged in</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[s.summaryBig, { color: displayReport?.failedAccounts?.length ? Colors.danger : '#22c55e' }]}>
                        {displayReport?.failedAccounts?.length ?? 0}
                      </Text>
                      <Text style={s.summaryTiny}>Failed</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[s.summaryBig, { color: Colors.primary }]}>
                        {displayReport?.treks?.reduce((sum, t) => sum + (t.totalTickets || 0), 0) ?? 0}
                      </Text>
                      <Text style={s.summaryTiny}>Tickets</Text>
                    </View>
                  </View>
                </Panel>

                {!!displayReport?.failedAccounts?.length && (
                  <Panel style={s.failedPanel} padding={14}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={s.failedTitle}>Failed logins ({displayReport.failedAccounts.length})</Text>
                      <TouchableOpacity style={s.retryBtn} onPress={retryFailed} disabled={running || retrying}>
                        {retrying ? <ActivityIndicator size="small" color="#b91c1c" /> : <Ionicons name="refresh" size={11} color="#b91c1c" />}
                        <Text style={s.retryBtnText}>{retrying ? 'Retrying…' : `Retry Failed (${displayReport.failedAccounts.length})`}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ gap: 5 }}>
                      {displayReport.failedAccounts.map((f, fIdx) => (
                        <View key={`${failedEmail(f)}-${fIdx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                          <View style={s.failedChip}><Text style={s.failedChipText}>{failedLabel(f) || failedEmail(f)}</Text></View>
                          {!!failedError(f) && <Text style={s.failedErrorText}>{failedError(f)}</Text>}
                        </View>
                      ))}
                    </View>
                  </Panel>
                )}

                {!!displayReport?.retriedAt && (
                  <Text style={s.retriedText}>Last retried: {fmtDt(displayReport.retriedAt)}</Text>
                )}

                {/* Search + Filter + Sort */}
                <Panel padding={12} style={{ gap: 10 }}>
                  <View style={s.searchBox}>
                    <Ionicons name="search-outline" size={14} color={Colors.slate400} />
                    <TextInput
                      style={s.searchInput}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search trek, ticket ID, visitor name, mobile…"
                      placeholderTextColor={Colors.slate400}
                    />
                    {!!search && (
                      <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                        <Ionicons name="close" size={14} color={Colors.slate400} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={s.filterRow}>
                    <FilterField label="Trek" value={filterTrek || 'All treks'} active={!!filterTrek} onPress={() => setFilterSheet('trek')} />
                    <FilterField label="Date" value={filterDate || 'All dates'} active={!!filterDate} onPress={() => setFilterSheet('date')} />
                    <FilterField label="Account" value={filterAccount || 'All accounts'} active={!!filterAccount} onPress={() => setFilterSheet('account')} />
                    <FilterField
                      label="Sort by"
                      value={{ date: 'Date', name: 'Trek name', tickets: 'Most tickets', visitors: 'Most visitors' }[sortBy]}
                      onPress={() => setFilterSheet('sort')}
                    />
                  </View>

                  <View style={s.resultsBar}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultsText}>
                        <Text style={s.resultsBold}>{filteredTreks.length}</Text> trek{filteredTreks.length !== 1 ? 's' : ''}
                        {'  ·  '}<Text style={s.resultsBold}>{filteredTickets}</Text> tickets
                        {'  ·  '}<Text style={[s.resultsBold, { color: '#2563eb' }]}>{filteredVisitors}</Text> visitors
                      </Text>
                      {hasFilters && (
                        <TouchableOpacity onPress={clearFilters} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                          <Ionicons name="close" size={10} color={Colors.danger} />
                          <Text style={s.clearFiltersText}>Clear filters</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity style={[s.viewIconBtn, viewMode === 'cards' && s.viewIconBtnActive]} onPress={() => setViewMode('cards')}>
                        <Ionicons name="list-outline" size={14} color={viewMode === 'cards' ? Colors.white : Colors.slate400} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.viewIconBtn, viewMode === 'table' && s.viewIconBtnActive]} onPress={() => setViewMode('table')}>
                        <Ionicons name="grid-outline" size={14} color={viewMode === 'table' ? Colors.white : Colors.slate400} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.viewIconBtn} onPress={() => exportCsv(filteredTreks)}>
                        <Ionicons name="download-outline" size={14} color={Colors.slate400} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {hasFilters && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {!!filterTrek && <FilterChip label={`Trek: ${filterTrek}`} color="#c2410c" bg="#fff7ed" onClear={() => setFilterTrek('')} />}
                      {!!filterDate && <FilterChip label={`Date: ${filterDate}`} color="#1d4ed8" bg="#eff6ff" onClear={() => setFilterDate('')} />}
                      {!!filterAccount && <FilterChip label={`Account: ${filterAccount}`} color="#7c3aed" bg="#faf5ff" onClear={() => setFilterAccount('')} />}
                      {!!search && <FilterChip label={`"${search}"`} color={Colors.slate600} bg={Colors.slate100} onClear={() => setSearch('')} />}
                    </View>
                  )}
                </Panel>

                {filteredTreks.length === 0 ? (
                  <Panel padding={24} style={{ alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', color: Colors.slate700 }}>No results</Text>
                    <Text style={{ fontSize: 12.5, color: Colors.slate400, marginTop: 4 }}>Try adjusting your filters or search.</Text>
                    <TouchableOpacity style={[s.runBtn, { marginTop: 10 }]} onPress={clearFilters}>
                      <Text style={s.runBtnText}>Clear filters</Text>
                    </TouchableOpacity>
                  </Panel>
                ) : viewMode === 'table' ? (
                  <SummaryTable treks={filteredTreks} />
                ) : (
                  <>
                    <Text style={s.sectionLabel}>{filteredTreks.length} trek slot{filteredTreks.length !== 1 ? 's' : ''} with bookings</Text>
                    {filteredTreks.map((trek, i) => {
                      const key = `${trek.trekName}-${trek.date}-${i}`;
                      return (
                        <TrekReportCard
                          key={key}
                          trek={trek}
                          expanded={expanded[key] ?? !!search}
                          onToggle={() => setExpanded(prev => ({ ...prev, [key]: !(prev[key] ?? !!search) }))}
                        />
                      );
                    })}
                  </>
                )}
              </>
            )
          )}

          {/* ── ACCOUNTS TAB ────────────────────────────────────────────── */}
          {tab === 'accounts' && (
            <>
              <View style={{ gap: 8 }}>
                <View style={s.searchBox}>
                  <Ionicons name="search-outline" size={13} color={Colors.slate400} />
                  <TextInput style={s.searchInput} value={acctSearch} onChangeText={setAcctSearch} placeholder="Search accounts…" placeholderTextColor={Colors.slate400} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={s.accountsCount}>
                    {creds.length} accounts{selectedAccts.size > 0 ? ` · ${selectedAccts.size} selected` : ''}
                  </Text>
                  {selectedAccts.size > 0 && (
                    <TouchableOpacity onPress={() => setSelectedAccts(new Set())} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="close" size={11} color={Colors.slate400} />
                      <Text style={s.clearFiltersText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  {selectedAccts.size > 0 && (
                    <TouchableOpacity style={s.runSelectedBtn} onPress={runSelected} disabled={running || retrying || runningSelected}>
                      {runningSelected ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="checkmark-done" size={12} color={Colors.white} />}
                      <Text style={s.runSelectedBtnText}>{runningSelected ? 'Running…' : `Run Selected (${selectedAccts.size})`}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.addAcctBtn} onPress={() => { setEditingCred(null); setCredModal(true); }}>
                    <Ionicons name="add" size={13} color={Colors.white} />
                    <Text style={s.addAcctBtnText}>Add Account</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {creds.length === 0 ? (
                <Panel padding={0}>
                  <EmptyState icon="lock-closed-outline" title="No accounts yet" message="Add Aranya Vihaara login credentials to get started." />
                </Panel>
              ) : (
                <Panel padding={0} style={{ overflow: 'hidden' }}>
                  <TouchableOpacity style={s.selectAllRow} onPress={toggleAll} activeOpacity={0.7}>
                    <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={16} color={allSelected ? Colors.primary : Colors.slate400} />
                    <Text style={s.selectAllText}>{allSelected ? 'Deselect all' : `Select all${acctSearch ? ' filtered' : ''} (${filteredCreds.length})`}</Text>
                  </TouchableOpacity>
                  {filteredCreds.map((c, i) => {
                    const sel = selectedAccts.has(c.email);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[s.credRow, i < filteredCreds.length - 1 && s.credRowBorder, sel && s.credRowSelected]}
                        onPress={() => toggleAcct(c.email)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={16} color={sel ? Colors.primary : Colors.slate300} />
                        <View style={[s.credAvatar, c.active === false && { backgroundColor: Colors.slate300 }]}>
                          <Text style={s.credAvatarText}>{(c.label || c.email)?.[0]?.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.credName} numberOfLines={1}>{c.label || c.email}</Text>
                          <Text style={s.credEmail} numberOfLines={1}>{c.email}</Text>
                        </View>
                        {c.active === false && <View style={s.inactivePill}><Text style={s.inactivePillText}>Inactive</Text></View>}
                        <TouchableOpacity style={s.credIconBtn} onPress={() => { setEditingCred(c); setCredModal(true); }}>
                          <Ionicons name="pencil" size={12} color={Colors.slate500} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.credIconBtn, s.credIconBtnDanger]} onPress={() => deleteCred(c)} disabled={deletingId === c.id}>
                          {deletingId === c.id ? <ActivityIndicator size="small" color={Colors.danger} /> : <Ionicons name="trash" size={12} color={Colors.danger} />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </Panel>
              )}
            </>
          )}

          {/* ── RUN AUDIT TAB ───────────────────────────────────────────── */}
          {tab === 'run' && (
            <>
              <Panel padding={16} style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.runTitle}>Run Full Audit</Text>
                    <Text style={s.runDesc}>
                      Logs into all <Text style={{ fontWeight: '800', color: Colors.slate700 }}>{activeCreds.length} active accounts</Text>,
                      scrapes upcoming bookings, and saves the report automatically.
                    </Text>
                  </View>
                  <TouchableOpacity style={[s.runBtn, (running || activeCreds.length === 0) && s.runBtnDisabled]} onPress={startAudit} disabled={running || activeCreds.length === 0}>
                    {running ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="play" size={13} color={Colors.white} />}
                    <Text style={s.runBtnText}>{running ? 'Running…' : 'Start'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.concurrencyRow}>
                  <Text style={s.concurrencyLabel}>Parallel accounts</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[10, 20, 50].map(n => (
                      <TouchableOpacity key={n} style={[s.concurrencyBtn, concurrency === n && s.concurrencyBtnActive]} onPress={() => setConcurrency(n)}>
                        <Text style={[s.concurrencyBtnText, concurrency === n && s.concurrencyBtnTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.concurrencyHint}>at a time (20 is default)</Text>
                </View>
              </Panel>

              <RunStatusBanner runStatus={runStatus} onRefreshReport={() => { loadReport(); setTab('report'); }} />

              <Panel padding={16}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.adminTitle}>Clear Report</Text>
                    <Text style={s.adminDesc}>Wipes the current report so the next run starts completely fresh.{!report ? ' (No report to clear)' : ''}</Text>
                  </View>
                  <TouchableOpacity style={s.dangerBtn} onPress={clearReport} disabled={running || retrying || clearing || !report}>
                    {clearing ? <ActivityIndicator size="small" color={Colors.danger} /> : <Ionicons name="trash" size={12} color={Colors.danger} />}
                    <Text style={s.dangerBtnText}>{clearing ? 'Clearing…' : 'Clear Report'}</Text>
                  </TouchableOpacity>
                </View>
              </Panel>

              <Panel padding={16}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.adminTitle}>Clear All History</Text>
                    <Text style={s.adminDesc}>Deletes all saved run history entries. The current report is kept.{history.length === 0 ? ' (No history to clear)' : ''}</Text>
                  </View>
                  <TouchableOpacity style={s.warnBtn} onPress={clearAllHistory} disabled={running || retrying || runningSelected || history.length === 0}>
                    <Ionicons name="trash" size={12} color="#c2410c" />
                    <Text style={s.warnBtnText}>Clear All History</Text>
                  </TouchableOpacity>
                </View>
              </Panel>

              <Panel padding={16}>
                <Text style={s.howLabel}>HOW IT WORKS</Text>
                <View style={{ gap: 12, marginTop: 8 }}>
                  {[
                    { n: '1', t: 'Loads credentials from Firestore', d: 'All active accounts in the Accounts tab' },
                    { n: '2', t: 'Logs into each account via HTTP', d: 'Fast HTTP login — no browser required, CAPTCHA is client-side only' },
                    { n: '3', t: 'Scrapes all booking pages', d: 'Reads visitor tables directly from HTML — no clicking needed' },
                    { n: '4', t: 'Saves report to Firestore', d: 'Results appear instantly in the Audit Report tab with full filtering' },
                  ].map(({ n, t, d }) => (
                    <View key={n} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <View style={s.stepDot}><Text style={s.stepDotText}>{n}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stepTitle}>{t}</Text>
                        <Text style={s.stepDesc}>{d}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Panel>
            </>
          )}
        </View>
      )}
      </ScrollView>

      {credModal && (
        <CredentialModal editing={editingCred} onClose={() => { setCredModal(false); setEditingCred(null); }} onSaved={() => load(true)} />
      )}

      {filterSheet && (
        <FilterSheet
          title={filterSheet === 'trek' ? 'Trek' : filterSheet === 'date' ? 'Date' : filterSheet === 'account' ? 'Account' : 'Sort by'}
          options={
            filterSheet === 'trek' ? [{ label: 'All treks', value: '' }, ...trekNames.map(n => ({ label: n, value: n }))] :
            filterSheet === 'date' ? [{ label: 'All dates', value: '' }, ...dates.map(d => ({ label: d, value: d }))] :
            filterSheet === 'account' ? [{ label: 'All accounts', value: '' }, ...accountOptions.map(a => ({ label: a, value: a }))] :
            [{ label: 'Date', value: 'date' }, { label: 'Trek name', value: 'name' }, { label: 'Most tickets', value: 'tickets' }, { label: 'Most visitors', value: 'visitors' }]
          }
          value={filterSheet === 'trek' ? filterTrek : filterSheet === 'date' ? filterDate : filterSheet === 'account' ? filterAccount : sortBy}
          onSelect={(v) => {
            if (filterSheet === 'trek') setFilterTrek(v);
            else if (filterSheet === 'date') setFilterDate(v);
            else if (filterSheet === 'account') setFilterAccount(v);
            else setSortBy(v as SortBy);
            setFilterSheet(null);
          }}
          onClose={() => setFilterSheet(null)}
        />
      )}
    </AppShell>
  );
}

/* ── Shared bits ──────────────────────────────────────────────────────── */

function StatBlock({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <Panel padding={12} style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Panel>
  );
}

function FilterField({ label, value, active, onPress }: { label: string; value: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.filterField} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.filterFieldLabel}>{label}</Text>
      <View style={s.filterFieldValueRow}>
        <Text style={[s.filterFieldValue, active && { color: '#c2410c', fontWeight: '700' }]} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={11} color={Colors.slate400} />
      </View>
    </TouchableOpacity>
  );
}

function FilterChip({ label, color, bg, onClear }: { label: string; color: string; bg: string; onClear: () => void }) {
  return (
    <View style={[s.filterChip, { backgroundColor: bg, borderColor: color + '33' }]}>
      <Text style={[s.filterChipText, { color }]} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onClear} hitSlop={6}><Ionicons name="close" size={10} color={color} /></TouchableOpacity>
    </View>
  );
}

function FilterSheet({ title, options, value, onSelect, onClose }: {
  title: string; options: { label: string; value: string }[]; value: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <ModalSafeArea style={s.sheet} edges={['bottom']}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {options.map(o => (
              <TouchableOpacity key={o.value} style={s.sheetOption} onPress={() => onSelect(o.value)} activeOpacity={0.7}>
                <Text style={[s.sheetOptionText, value === o.value && { color: Colors.primary, fontWeight: '800' }]} numberOfLines={1}>{o.label}</Text>
                {value === o.value && <Ionicons name="checkmark" size={15} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
            {options.length === 0 && <Text style={s.noneText}>No options</Text>}
          </ScrollView>
        </ModalSafeArea>
      </View>
    </Modal>
  );
}

function RunStatusBanner({ runStatus, onRefreshReport }: { runStatus: RunStatus | null; onRefreshReport: () => void }) {
  if (!runStatus || runStatus.status === 'idle') return null;
  const { status, message, done = 0, total = 0 } = runStatus;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (status === 'running') {
    return (
      <Panel style={s.bannerBlue} padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={s.bannerTitleBlue}>Audit in progress…</Text>
        </View>
        {!!message && <Text style={s.bannerTextBlue}>{message}</Text>}
        {total > 0 && (
          <>
            <View style={s.progressTrack}><View style={[s.progressFill, { width: `${pct}%` }]} /></View>
            <Text style={s.progressText}>{done}/{total}</Text>
          </>
        )}
      </Panel>
    );
  }
  if (status === 'done') {
    return (
      <Panel style={s.bannerGreen} padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Ionicons name="checkmark-circle" size={17} color="#22c55e" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitleGreen}>Audit complete</Text>
            {!!message && <Text style={s.bannerTextGreen}>{message}</Text>}
          </View>
          <TouchableOpacity style={s.bannerCta} onPress={onRefreshReport}><Text style={s.bannerCtaText}>View report →</Text></TouchableOpacity>
        </View>
      </Panel>
    );
  }
  if (status === 'error') {
    return (
      <Panel style={s.bannerRed} padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Ionicons name="close-circle" size={17} color={Colors.danger} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitleRed}>Audit failed</Text>
            {!!message && <Text style={s.bannerTextRed}>{message}</Text>}
          </View>
        </View>
      </Panel>
    );
  }
  return null;
}

function TrekReportCard({ trek, expanded, onToggle }: { trek: TrekReport; expanded: boolean; onToggle: () => void }) {
  const totalVisitors = trek.accounts?.reduce((s, a) => s + (a.visitors?.length ?? 0), 0) ?? 0;
  return (
    <Panel padding={0} style={{ overflow: 'hidden' }}>
      <TouchableOpacity style={s.trekHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <Text style={s.trekName}>{trek.trekName}</Text>
            <View style={s.trekBadge}><Text style={s.trekBadgeText}>{trek.totalTickets} ticket{trek.totalTickets !== 1 ? 's' : ''}</Text></View>
            {totalVisitors > 0 && <View style={s.trekBadgeBlue}><Text style={s.trekBadgeBlueText}>{totalVisitors} visitor{totalVisitors !== 1 ? 's' : ''}</Text></View>}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {!!trek.date && <MetaBit icon="calendar-outline" text={trek.date} />}
            {!!trek.slot && <MetaBit icon="time-outline" text={trek.slot} />}
            {!!trek.district && <MetaBit icon="location-outline" text={trek.district} />}
            <MetaBit icon="people-outline" text={`${trek.accounts?.length ?? 0} account${trek.accounts?.length !== 1 ? 's' : ''}`} />
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={16} color={Colors.slate400} />
      </TouchableOpacity>

      {expanded && trek.accounts?.map((acc, i) => (
        <View key={i} style={s.accCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text style={s.accName}>{acc.label || acc.email}</Text>
              <Text style={s.accEmail}>{acc.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.accMeta}>Ticket: <Text style={{ fontWeight: '800', color: Colors.slate700 }}>{acc.ticketNo || '—'}</Text></Text>
              {!!acc.orderId && <Text style={s.accMeta}>Order: <Text style={{ fontWeight: '700', color: Colors.slate600 }}>{acc.orderId}</Text></Text>}
              <Text style={s.accMeta}>{acc.visitorCount ?? 0} visitor{acc.visitorCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {!!acc.visitors?.length && acc.visitors.map((v, j) => (
            <View key={j} style={s.visitorRow}>
              <Text style={s.visitorNo}>{v.no ?? j + 1}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.visitorName} numberOfLines={1}>{v.name}</Text>
                <Text style={s.visitorSub} numberOfLines={1}>{[v.age && `${v.age}y`, v.gender, v.mobile].filter(Boolean).join(' · ')}</Text>
              </View>
              {!!(v.idType || v.idNumber) && <Text style={s.visitorId} numberOfLines={1}>{v.idType} {v.idNumber}</Text>}
            </View>
          ))}
        </View>
      ))}
    </Panel>
  );
}

function SummaryTable({ treks }: { treks: TrekReport[] }) {
  const rows = treks.map(t => ({
    trekName: t.trekName, date: t.date ?? '', district: t.district ?? '',
    accounts: t.accounts?.length ?? 0, tickets: t.totalTickets ?? 0,
    visitors: t.accounts?.reduce((s, a) => s + (a.visitors?.length ?? 0), 0) ?? 0,
  }));
  const totalTickets = rows.reduce((s, r) => s + r.tickets, 0);
  const totalVisitors = rows.reduce((s, r) => s + r.visitors, 0);

  const cols: Column[] = [
    { key: 'trekName', label: 'Trek', width: 140 },
    { key: 'date', label: 'Date', width: 90 },
    { key: 'district', label: 'District', width: 100 },
    { key: 'accounts', label: 'Accts', width: 60, align: 'right' },
    {
      key: 'tickets', label: 'Tickets', width: 70, align: 'right',
      render: (r: any) => <View style={s.tablePill}><Text style={s.tablePillText}>{r.tickets}</Text></View>,
    },
    {
      key: 'visitors', label: 'Visitors', width: 70, align: 'right',
      render: (r: any) => <View style={s.tablePillBlue}><Text style={s.tablePillBlueText}>{r.visitors}</Text></View>,
    },
  ];

  return (
    <View style={{ gap: 8 }}>
      <DataTable columns={cols} rows={rows} emptyText="No rows" />
      <Panel padding={12} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.tableFooterLabel}>Total — {rows.length} trek slot{rows.length !== 1 ? 's' : ''}</Text>
        <Text style={s.tableFooterLabel}>{totalTickets} tickets · {totalVisitors} visitors</Text>
      </Panel>
    </View>
  );
}

function MetaBit({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={11} color={Colors.slate400} />
      <Text style={s.metaBitText}>{text}</Text>
    </View>
  );
}

function CredentialModal({ editing, onClose, onSaved }: { editing: Credential | null; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(editing?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [label, setLabel] = useState(editing?.label ?? '');
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!email.trim()) { Alert.alert('Email required'); return; }
    if (!editing && !password.trim()) { Alert.alert('Password required'); return; }
    setSaving(true);
    try {
      if (editing) {
        const patch: Record<string, unknown> = { label: label.trim(), active };
        if (password.trim()) patch.password = password.trim();
        await api.patch(`/ticket-audit/credentials/${editing.id}`, patch);
      } else {
        await api.post('/ticket-audit/credentials', { email: email.trim(), password: password.trim(), label: label.trim(), active: true });
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save account');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <ModalSafeArea style={s.modalSheet} edges={['bottom']}>
          <View style={s.modalHeader}>
            <View style={s.modalHeaderIcon}><Ionicons name="ticket-outline" size={17} color={Colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalHeaderTitle}>{editing ? 'Edit Account' : 'Add Account'}</Text>
              <Text style={s.modalHeaderSub}>Aranya Vihaara credentials</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={[s.input, !!editing && s.inputDisabled]}
                value={email} onChangeText={setEmail} editable={!editing}
                autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.slate400}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>Password {editing ? '(leave blank to keep current)' : ''}</Text>
              <View style={{ position: 'relative' }}>
                <TextInput style={[s.input, { paddingRight: 40 }]} value={password} onChangeText={setPassword} secureTextEntry={!showPw} placeholderTextColor={Colors.slate400} />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(p => !p)} hitSlop={8}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.slate400} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>Label (optional)</Text>
              <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder="e.g. Account 1" placeholderTextColor={Colors.slate400} />
            </View>
            {!!editing && (
              <View style={s.activeRow}>
                <Text style={s.activeLabel}>Active</Text>
                <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.primary, false: Colors.slate200 }} thumbColor={Colors.white} />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button title="Cancel" onPress={onClose} variant="outline" style={{ flex: 1 }} disabled={saving} />
              <Button title={editing ? 'Update' : 'Add Account'} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </ModalSafeArea>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },

  runBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  runBtnDisabled: { opacity: 0.5 },
  runBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },

  errorPanel: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: Colors.danger, fontWeight: '600', fontSize: 13, flex: 1 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: Colors.slate400, marginTop: 2, textAlign: 'center' },

  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  historyLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6 },
  histChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.slate50, borderWidth: 1, borderColor: Colors.slate200 },
  histChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  histChipText: { fontSize: 10.5, fontWeight: '700', color: Colors.slate500 },
  histChipTextActive: { color: Colors.white },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Colors.slate400 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Colors.slate700, marginTop: 2 },
  summaryBig: { fontSize: 17, fontWeight: '900', color: Colors.slate900 },
  summaryTiny: { fontSize: 9, color: Colors.slate400, marginTop: 1 },

  failedPanel: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  failedTitle: { fontSize: 11, fontWeight: '800', color: '#dc2626' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fee2e2', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  retryBtnText: { fontSize: 10.5, fontWeight: '800', color: '#b91c1c' },
  failedChip: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  failedChipText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },
  failedErrorText: { fontSize: 10.5, color: '#f87171', fontStyle: 'italic', flex: 1 },
  retriedText: { fontSize: 10.5, color: Colors.slate400, textAlign: 'center' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.slate50, borderWidth: 1, borderColor: Colors.slate200, borderRadius: 11, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.slate900 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterField: { flex: 1, minWidth: 130, gap: 3 },
  filterFieldLabel: { fontSize: 9.5, fontWeight: '800', color: Colors.slate400, textTransform: 'uppercase', letterSpacing: 0.4 },
  filterFieldValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, height: 32, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.slate50, borderRadius: 8, paddingHorizontal: 9 },
  filterFieldValue: { fontSize: 11.5, fontWeight: '600', color: Colors.slate600, flex: 1 },

  resultsBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingTop: 2 },
  resultsText: { fontSize: 11.5, color: Colors.slate500, flexWrap: 'wrap' },
  resultsBold: { fontWeight: '800', color: Colors.slate700 },
  clearFiltersText: { fontSize: 10, fontWeight: '800', color: Colors.danger },
  viewIconBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.slate50, alignItems: 'center', justifyContent: 'center' },
  viewIconBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, maxWidth: 200 },
  filterChipText: { fontSize: 10.5, fontWeight: '700', flexShrink: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 2 },

  accountsCount: { fontSize: 12, fontWeight: '600', color: Colors.slate400 },
  runSelectedBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  runSelectedBtnText: { color: Colors.white, fontWeight: '700', fontSize: 11 },
  addAcctBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, marginLeft: 'auto' },
  addAcctBtnText: { color: Colors.white, fontWeight: '700', fontSize: 11.5 },

  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.slate50, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
  selectAllText: { fontSize: 10.5, fontWeight: '800', color: Colors.slate400, textTransform: 'uppercase' },

  credRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  credRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.slate50 },
  credRowSelected: { backgroundColor: '#fff7ed' },
  credAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  credAvatarText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  credName: { fontSize: 13, fontWeight: '700', color: Colors.slate700 },
  credEmail: { fontSize: 11, color: Colors.slate400, marginTop: 1 },
  inactivePill: { backgroundColor: Colors.slate100, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  inactivePillText: { fontSize: 9.5, fontWeight: '800', color: Colors.slate400 },
  credIconBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.slate50, borderWidth: 1, borderColor: Colors.slate200, alignItems: 'center', justifyContent: 'center' },
  credIconBtnDanger: { backgroundColor: Colors.dangerBg, borderColor: '#fecaca' },

  runTitle: { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  runDesc: { fontSize: 12, color: Colors.slate400, marginTop: 3, lineHeight: 17 },
  concurrencyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.slate50, flexWrap: 'wrap' },
  concurrencyLabel: { fontSize: 11, fontWeight: '700', color: Colors.slate500 },
  concurrencyBtn: { minWidth: 34, height: 28, paddingHorizontal: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, backgroundColor: Colors.slate50, alignItems: 'center', justifyContent: 'center' },
  concurrencyBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  concurrencyBtnText: { fontSize: 12, fontWeight: '700', color: Colors.slate500 },
  concurrencyBtnTextActive: { color: Colors.white },
  concurrencyHint: { fontSize: 10.5, color: Colors.slate400 },

  adminTitle: { fontSize: 13, fontWeight: '800', color: Colors.slate700 },
  adminDesc: { fontSize: 11, color: Colors.slate400, marginTop: 2 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.dangerBg, borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  dangerBtnText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  warnBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  warnBtnText: { fontSize: 11, fontWeight: '700', color: '#c2410c' },

  howLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate400, letterSpacing: 0.6 },
  stepDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepDotText: { fontSize: 10, fontWeight: '800', color: Colors.white },
  stepTitle: { fontSize: 13, fontWeight: '700', color: Colors.slate700 },
  stepDesc: { fontSize: 11.5, color: Colors.slate400, marginTop: 1 },

  bannerBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  bannerTitleBlue: { fontSize: 13, fontWeight: '700', color: '#1e40af' },
  bannerTextBlue: { fontSize: 11.5, color: '#3b82f6', marginBottom: 6 },
  progressTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: '#dbeafe', overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#3b82f6' },
  progressText: { fontSize: 10, color: '#93c5fd', marginTop: 3, textAlign: 'right' },

  bannerGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  bannerTitleGreen: { fontSize: 13, fontWeight: '700', color: '#166534' },
  bannerTextGreen: { fontSize: 11.5, color: '#16a34a' },
  bannerCta: { backgroundColor: '#dcfce7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  bannerCtaText: { fontSize: 10.5, fontWeight: '800', color: '#15803d' },

  bannerRed: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bannerTitleRed: { fontSize: 13, fontWeight: '700', color: '#b91c1c' },
  bannerTextRed: { fontSize: 11.5, color: '#ef4444' },

  trekHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  trekName: { fontSize: 14, fontWeight: '800', color: Colors.slate900 },
  trekBadge: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  trekBadgeText: { fontSize: 9.5, fontWeight: '800', color: Colors.white },
  trekBadgeBlue: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  trekBadgeBlueText: { fontSize: 9.5, fontWeight: '800', color: '#2563eb' },
  metaBitText: { fontSize: 11, color: Colors.slate500 },

  accCard: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.slate50, backgroundColor: Colors.slate50 },
  accName: { fontSize: 12.5, fontWeight: '700', color: Colors.slate700 },
  accEmail: { fontSize: 10.5, color: Colors.slate400, marginTop: 1 },
  accMeta: { fontSize: 10.5, color: Colors.slate500 },

  visitorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.slate100 },
  visitorNo: { fontSize: 10, color: Colors.slate400, width: 16 },
  visitorName: { fontSize: 12, fontWeight: '700', color: Colors.slate700 },
  visitorSub: { fontSize: 10.5, color: Colors.slate500, marginTop: 1 },
  visitorId: { fontSize: 10, color: Colors.slate400, maxWidth: 90 },

  tablePill: { backgroundColor: Colors.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-end' },
  tablePillText: { fontSize: 10.5, fontWeight: '800', color: Colors.white },
  tablePillBlue: { backgroundColor: '#dbeafe', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-end' },
  tablePillBlueText: { fontSize: 10.5, fontWeight: '800', color: '#2563eb' },
  tableFooterLabel: { fontSize: 11.5, fontWeight: '800', color: Colors.slate700 },

  noneText: { textAlign: 'center', color: Colors.slate400, padding: 20, fontSize: 12 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.slate200, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: Colors.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.slate50, gap: 8 },
  sheetOptionText: { fontSize: 14, color: Colors.slate700, flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: Colors.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeaderIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalHeaderTitle: { fontSize: 15, fontWeight: '800', color: Colors.white },
  modalHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.slate500, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { height: 44, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.slate200, paddingHorizontal: 13, fontSize: 14, color: Colors.slate900, backgroundColor: Colors.white },
  inputDisabled: { backgroundColor: Colors.slate50, color: Colors.slate400 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeLabel: { fontSize: 13, fontWeight: '600', color: Colors.slate700 },
});
