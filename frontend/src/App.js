// frontend/src/App.js
// BT Ops + Finance — merged single app
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';
import '@/App.css';

// ── BT Ops pages ────────────────────────────────────────────────────────────
import Login            from '@/pages/Login';
import LeadSignup       from '@/pages/LeadSignup';
import Dashboard        from '@/pages/Dashboard';
import TrekMaster       from '@/pages/TrekMaster';
import BatchPlanning    from '@/pages/BatchPlanning';
import BatchDetail      from '@/pages/BatchDetail';
import LeadManagement   from '@/pages/LeadManagement';
import Checklists       from '@/pages/Checklists';
import UserManagement   from '@/pages/UserManagement';
import Settings         from '@/pages/Settings';
import TicketBoard      from '@/pages/TicketBoard';
import WorkloadDashboard from '@/pages/WorkloadDashboard';
import CalendarView     from '@/pages/CalendarView';
import Rewards         from '@/pages/Rewards';
import MyVouchers      from '@/pages/MyVouchers';
import MeetTheTeam      from '@/pages/MeetTheTeam';
import LeadPerformance  from '@/pages/LeadPerformance';
import HotelStays       from '@/pages/HotelStays';
import HotelStayView    from '@/pages/HotelStayView';
import PackingLists     from '@/pages/PackingLists';
import PackingListEdit  from '@/pages/PackingListEdit';
import PackingListView  from '@/pages/PackingListView';
import PickupPoints     from '@/pages/PickupPoints';
import PickupPointsEdit from '@/pages/PickupPointsEdit';
import PickupPointsView from '@/pages/PickupPointsView';
import TrekProtocol     from '@/pages/TrekProtocol';
import TrekProtocolEdit from '@/pages/TrekProtocolEdit';
import TrekProtocolView from '@/pages/TrekProtocolView';
import VehicleAllocation from '@/pages/VehicleAllocation';
import VehicleView      from '@/pages/VehicleView';
import LeadView         from '@/pages/LeadView';
import TrekWatcher      from '@/pages/TrekWatcher';
import LeadAvailability from '@/pages/LeadAvailability';

// ── Finance pages (from bt-finance, now integrated) ─────────────────────────
import FinanceDashboard       from '@/pages/finance/FinanceDashboard';
import FinanceBatches         from '@/pages/finance/FinanceBatches';
import FinanceExpenses        from '@/pages/finance/FinanceExpenses';
import FinancePayroll         from '@/pages/finance/FinancePayroll';
import FinanceTeam            from '@/pages/finance/FinanceTeam';
import FinanceReports         from '@/pages/finance/FinanceReports';
import FinanceExpenseTemplates from '@/pages/finance/FinanceExpenseTemplates';
import FinanceLeads           from '@/pages/finance/FinanceLeads';

import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar        from '@/components/Sidebar';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 text-white flex-shrink-0 z-30">
          <button onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-btn">
            <Menu size={22} />
          </button>
          <span className="font-bold text-sm heading-font">BT Ops</span>
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
};

// Finance routes are restricted to Super Admin and Operations Manager only
const FINANCE_ROLES = ['Super Admin'];

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* ── Public ─────────────────────────────────────────────────── */}
          <Route path="/login"       element={<Login />} />
          <Route path="/lead-signup" element={<LeadSignup />} />

          {/* ── Operations pages ───────────────────────────────────────── */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/treks" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><TrekMaster /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/batches" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead']}>
              <Layout><BatchPlanning /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/batches/:batchId" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager', 'Coordinator', 'Trek Lead']}>
              <Layout><BatchDetail /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/leads" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><LeadManagement /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/checklists" element={
            <ProtectedRoute>
              <Layout><Checklists /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['Super Admin']}>
              <Layout><UserManagement /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['Super Admin']}>
              <Layout><Settings /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/tasks" element={
            <ProtectedRoute>
              <Layout><TicketBoard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/workload" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><WorkloadDashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/calendar" element={
            <ProtectedRoute>
              <Layout><CalendarView /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/rewards" element={
            <ProtectedRoute allowedRoles={['Super Admin']}>
              <Layout><Rewards /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/my-vouchers" element={
            <ProtectedRoute allowedRoles={['Trek Lead', 'Coordinator']}>
              <Layout><MyVouchers /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/meet-the-team" element={
            <ProtectedRoute>
              <Layout><MeetTheTeam /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/lead-performance" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><LeadPerformance /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/hotel-stays" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><HotelStays /></Layout>
            </ProtectedRoute>
          } />

          {/* ── Packing Lists ───────────────────────────────────────── */}
          <Route path="/packing-lists" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><PackingLists /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/packing-lists/:id/edit" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><PackingListEdit /></Layout>
            </ProtectedRoute>
          } />

          {/* Public packing list view — no auth */}
          <Route path="/packing/:slug" element={<PackingListView />} />

          {/* ── Pickup Points ───────────────────────────────────────── */}
          <Route path="/pickup-points" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><PickupPoints /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/pickup-points/:id/edit" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><PickupPointsEdit /></Layout>
            </ProtectedRoute>
          } />

          {/* ── Trek Protocol ───────────────────────────────────────── */}
          <Route path="/trek-protocol" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><TrekProtocol /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/trek-protocol/:id/edit" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><TrekProtocolEdit /></Layout>
            </ProtectedRoute>
          } />

          {/* Public pickup points / trek protocol views — no auth.
              Reachable from either the web admin pages above or the mobile
              app; these are the targets of the links shared with leads. */}
          <Route path="/pickup/:slug"   element={<PickupPointsView />} />
          <Route path="/protocol/:slug" element={<TrekProtocolView />} />

          {/* ── Vehicle Allocation ─────────────────────────────────── */}
          <Route path="/vehicle-allocation" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><VehicleAllocation /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/trek-watcher" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Operations Manager']}>
              <Layout><TrekWatcher /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/my-availability" element={
            <ProtectedRoute allowedRoles={['Trek Lead', 'Coordinator', 'Operations Manager', 'Super Admin']}>
              <Layout><LeadAvailability /></Layout>
            </ProtectedRoute>
          } />

          {/* Public vendor views — no auth */}
          <Route path="/stay-view"    element={<HotelStayView />} />
          <Route path="/vehicle-view" element={<VehicleView />} />
          <Route path="/lead-view"    element={<LeadView />} />

          {/* ── Finance pages ───────────────────────────────────────────── */}
          <Route path="/finance" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceDashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/batches" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceBatches /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/expenses" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceExpenses /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/expense-templates" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceExpenseTemplates /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/payroll" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinancePayroll /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/team" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceTeam /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/reports" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceReports /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/finance/leads" element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <Layout><FinanceLeads /></Layout>
            </ProtectedRoute>
          } />

          {/* ── Fallback ─────────────────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;