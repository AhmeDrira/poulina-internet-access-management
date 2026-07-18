import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ToastProvider } from './store/ToastContext';
import { ProtectedRoute, RoleRoute } from './routes/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { Role } from './types';

import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ChooseRequestTypePage from './pages/requests/ChooseRequestTypePage';
import NewRequestPage from './pages/requests/NewRequestPage';
import MyRequestsPage from './pages/requests/MyRequestsPage';
import RequestDetailsPage from './pages/requests/RequestDetailsPage';
import AllRequestsPage from './pages/admin/AllRequestsPage';
import UsersPage from './pages/admin/UsersPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import ServicesPage from './pages/admin/ServicesPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ForbiddenPage from './pages/errors/ForbiddenPage';
import NotFoundPage from './pages/errors/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route
                  path="/requests/new"
                  element={
                    <RoleRoute roles={[Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM]}>
                      <ChooseRequestTypePage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/requests/new/:type"
                  element={
                    <RoleRoute roles={[Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM]}>
                      <NewRequestPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/requests/:id/edit"
                  element={
                    <RoleRoute roles={[Role.EMPLOYEE, Role.MANAGER, Role.NETWORK_TEAM]}>
                      <NewRequestPage editMode />
                    </RoleRoute>
                  }
                />
                <Route path="/my-requests" element={<MyRequestsPage />} />
                <Route
                  path="/requests"
                  element={
                    <RoleRoute roles={[Role.ADMIN, Role.SECURITY_OFFICER]}>
                      <AllRequestsPage />
                    </RoleRoute>
                  }
                />
                <Route path="/requests/:id" element={<RequestDetailsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route
                  path="/admin/users"
                  element={
                    <RoleRoute roles={[Role.ADMIN]}>
                      <UsersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/departments"
                  element={
                    <RoleRoute roles={[Role.ADMIN]}>
                      <DepartmentsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/services"
                  element={
                    <RoleRoute roles={[Role.ADMIN]}>
                      <ServicesPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <RoleRoute roles={[Role.ADMIN, Role.SECURITY_OFFICER]}>
                      <AuditLogsPage />
                    </RoleRoute>
                  }
                />
                <Route path="/403" element={<ForbiddenPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
