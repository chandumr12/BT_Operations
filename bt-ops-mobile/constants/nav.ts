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
  { path: '/(admin)/vehicle-allocation', label: 'Vehicle Allocation', icon: 'bus-outline',             roles: ADMIN, built: true },
  { path: '/(admin)/watcher',            label: 'Trek Watcher',       icon: 'eye-outline',             roles: ADMIN, built: true },
  { path: '/(admin)/my-availability',    label: 'My Availability',    icon: 'calendar-clear-outline',  roles: ALL,   built: true },
  { path: '/(admin)/rewards',            label: 'Rewards',            icon: 'trophy-outline',          roles: ['Super Admin'], built: true },
  { path: '/(admin)/users',              label: 'Users',              icon: 'person-add-outline',      roles: ['Super Admin'], built: true },
  { path: '/(admin)/settings',           label: 'Settings',           icon: 'settings-outline',        roles: ['Super Admin'], built: true },
];

export function menuForRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return OPS_MENU.filter(i => i.roles.includes(role));
}
