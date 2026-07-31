// Shared finance helpers — mirrors frontend/src/utils/finance.js
import { Colors } from '@/constants/Colors';

export const inr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const toMonthKey = (d: any): string => {
  if (!d) return '';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d?.toDate ? d.toDate() : new Date(d);
    const y = dt.getFullYear();
    const m = `${dt.getMonth() + 1}`.padStart(2, '0');
    return `${y}-${m}`;
  } catch {
    return String(d).slice(0, 7);
  }
};

export const thisMonthKey = () => new Date().toISOString().slice(0, 10).slice(0, 7);
export const todayISO     = () => new Date().toISOString().slice(0, 10);

/** "2026-07" → "Jul 2026" */
export const monthLabel = (mk: string) => {
  if (!mk || mk.length < 7) return mk || '—';
  const [y, m] = mk.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(m) - 1] ?? m} ${y}`;
};

/** Expense categories — mirrors FinanceExpenses.js CATEGORIES exactly. */
export const EXPENSE_CATEGORIES: { value: string; label: string; parent?: string }[] = [
  { value: 'rent',            label: 'Office Rent' },
  { value: 'wifi',            label: 'Wi-Fi' },
  { value: 'insta_ads',       label: 'Instagram Ads',  parent: 'marketing' },
  { value: 'google_ads',      label: 'Google Ads',     parent: 'marketing' },
  { value: 'content_creator', label: 'Content Creator', parent: 'marketing' },
  { value: 'badges',          label: 'Round Badges' },
  { value: 'website',         label: 'Website Mgmt' },
  { value: 'b2b_vendor',      label: 'B2B Vendor' },
  { value: 'outing',          label: 'Team Outing' },
  { value: 'team_dinner',     label: 'Team Dinner' },
  { value: 'other',           label: 'Other' },
];

export const MARKETING_CATS = ['google_ads', 'insta_ads', 'content_creator'];

export const catLabel  = (v: string) =>
  EXPENSE_CATEGORIES.find(c => c.value === v)?.label ?? v;
export const parentFor = (v: string) =>
  EXPENSE_CATEGORIES.find(c => c.value === v)?.parent ?? '';

export const RECURRENCES = ['monthly', 'quarterly', 'yearly'];

/** Quarter index (0-3) for a "YYYY-MM" key or ISO date. */
export const quarterOf = (key: string): number => {
  const m = parseInt((key || '').split('-')[1], 10);
  return m ? Math.floor((m - 1) / 3) : -1;
};

export const QUARTER_LABELS = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];

/** Colour for a signed amount — green positive, red negative, gray zero. */
export const netColor = (n: number) =>
  n > 0 ? Colors.success : n < 0 ? Colors.danger : Colors.gray500;
