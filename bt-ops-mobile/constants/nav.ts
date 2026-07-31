import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface NavItem {
  /** expo-router path within the (admin) group */
  path: string;
  label: string;
  icon: IoniconName;
  roles: string[];
  /** false while the screen is still a placeholder */
  built?: boolean;
}

const ALL = ['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead'];
const ADMIN = ['Super Admin', 'Operations Manager'];

/**
 * Mirrors frontend/src/components/Sidebar.js `opsMenu` — same order, same
 * labels, same role gating. Ionicons chosen to match the lucide icons the
 * web app uses.
 */
export const OPS_MENU: NavItem[] = [
  { path: '/(admin)/',                   label: 'Dashboard',          icon: 'grid-outline',            roles: ALL,   built: true },
  { path: '/(admin)/treks',              label: 'Trek Master',        icon: 'triangle-outline',        roles: ADMIN, built: true },
  { path: '/(admin)/batches',            label: 'Batches',            icon: 'calendar-outline',        roles: ALL,   built: true },
  { path: '/(admin)/leads',              label: 'Leads',              icon: 'people-outline',          roles: ADMIN, built: true },
  { path: '/(admin)/checklists',         label: 'Checklists',         icon: 'checkbox-outline',        roles: ALL,   built: true },
  { path: '/(admin)/tasks',              label: 'Tasks',              icon: 'ticket-outline',          roles: ALL,   built: true },
  { path: '/(admin)/workload',           label: 'Workload',           icon: 'bar-chart-outline',       roles: ADMIN, built: true },
  { path: '/(admin)/calendar',           label: 'Calendar',           icon: 'calendar-number-outline', roles: ALL,   built: true },
  { path: '/(admin)/meet-the-team',      label: 'Meet the Team',      icon: 'people-circle-outline',   roles: ALL,   built: true },
  { path: '/(admin)/lead-performance',   label: 'Lead Performance',   icon: 'trending-up-outline',     roles: ADMIN, built: true },
  { path: '/(admin)/hotel-stays',        label: 'Hotel Stays',        icon: 'business-outline',        roles: ADMIN, built: true },
  { path: '/(admin)/packing-lists',      label: 'Packing Lists',      icon: 'clipboard-outline',       roles: ADMIN, built: true },
  { path: '/(admin)/pickup-points',      label: 'Pickup Points',      icon: 'location-outline',        roles: ALL,   built: true },
  { path: '/(admin)/trek-protocol',      label: 'Trek Protocol',      icon: 'shield-checkmark-outline', roles: ALL,  built: true },
  { path: '/(admin)/vehicle-allocation', label: 'Vehicle Allocation', icon: 'bus-outline',             roles: ADMIN, built: true },
  { path: '/(admin)/watcher',            label: 'Trek Watcher',       icon: 'eye-outline',             roles: ADMIN, built: true },
  { path: '/(admin)/ticket-audit',       label: 'Ticket Audit',       icon: 'scan-outline',            roles: ADMIN, built: true },
  { path: '/(admin)/my-availability',    label: 'My Availability',    icon: 'calendar-clear-outline',  roles: ALL,   built: true },
  { path: '/(admin)/my-vouchers',        label: 'My Vouchers',        icon: 'gift-outline',            roles: ['Trek Lead', 'Coordinator'], built: true },
  { path: '/(admin)/rewards',            label: 'Rewards',            icon: 'trophy-outline',          roles: ['Super Admin'], built: true },
  { path: '/(admin)/users',              label: 'Users',              icon: 'person-add-outline',      roles: ['Super Admin'], built: true },
  { path: '/(admin)/settings',           label: 'Settings',           icon: 'settings-outline',        roles: ['Super Admin'], built: true },
];

/**
 * Mirrors the web app's FINANCE section. Note the gating: App.js defines
 * `FINANCE_ROLES = ['Super Admin']`, so every finance route is Super-Admin-only
 * even though the comment above it mentions Operations Manager.
 */
const FINANCE_ROLES = ['Super Admin'];

export const FINANCE_MENU: NavItem[] = [
  { path: '/(admin)/finance',                    label: 'F&L Dashboard',     icon: 'cash-outline',              roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/batches',            label: 'Finance Batches',   icon: 'calendar-outline',          roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/reports',            label: 'Reports',           icon: 'document-text-outline',     roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/expenses',           label: 'Expenses',          icon: 'receipt-outline',           roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/expense-templates',  label: 'Exp. Templates',    icon: 'extension-puzzle-outline',  roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/payroll',            label: 'Payroll',           icon: 'card-outline',              roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/team',               label: 'Finance Team',      icon: 'people-outline',            roles: FINANCE_ROLES, built: true },
  { path: '/(admin)/finance/leads',              label: 'Finance Leads',     icon: 'person-outline',            roles: FINANCE_ROLES, built: true },
];

export function menuForRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return OPS_MENU.filter(i => i.roles.includes(role));
}

export function financeMenuForRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return FINANCE_MENU.filter(i => i.roles.includes(role));
}
