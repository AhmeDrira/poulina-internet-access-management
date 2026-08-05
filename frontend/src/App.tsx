import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ToastProvider } from './store/ToastContext';
import { ProtectedRoute, RoleRoute } from './routes/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { ADMIN_ROLES, GLOBAL_READ_ROLES, MESSAGING_ROLES, REQUESTER_ROLES, Role } from './types';

import LoginPage from './pages/auth/LoginPage';
import ActivationPage from './pages/auth/ActivationPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ChooseRequestTypePage from './pages/requests/ChooseRequestTypePage';
import NewRequestPage from './pages/requests/NewRequestPage';
import MyRequestsPage from './pages/requests/MyRequestsPage';
import RequestDetailsPage from './pages/requests/RequestDetailsPage';
import MessagingPage from './pages/messaging/MessagingPage';
import AllRequestsPage from './pages/admin/AllRequestsPage';
import UsersPage from './pages/admin/UsersPage';
import FormsPage from './pages/admin/FormsPage';
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
            {/* Activation d'un compte par lien temporaire : accessible sans session */}
            <Route path="/activation/:token" element={<ActivationPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/change-password" element={<ChangePasswordPage />} />
                <Route
                  path="/requests/new"
                  element={
                    <RoleRoute roles={REQUESTER_ROLES}>
                      <ChooseRequestTypePage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/requests/new/:type"
                  element={
                    <RoleRoute roles={REQUESTER_ROLES}>
                      <NewRequestPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/requests/:id/edit"
                  element={
                    <RoleRoute roles={REQUESTER_ROLES}>
                      <NewRequestPage editMode />
                    </RoleRoute>
                  }
                />
                <Route path="/my-requests" element={<MyRequestsPage />} />
                <Route
                  path="/requests"
                  element={
                    <RoleRoute roles={GLOBAL_READ_ROLES}>
                      <AllRequestsPage />
                    </RoleRoute>
                  }
                />
                <Route path="/requests/:id" element={<RequestDetailsPage />} />
                <Route
                  path="/messaging"
                  element={
                    <RoleRoute roles={MESSAGING_ROLES}>
                      <MessagingPage />
                    </RoleRoute>
                  }
                />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route
                  path="/admin/users"
                  element={
                    <RoleRoute roles={ADMIN_ROLES}>
                      <UsersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/forms"
                  element={
                    <RoleRoute roles={[Role.SUPER_ADMIN]}>
                      <FormsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/departments"
                  element={
                    <RoleRoute roles={ADMIN_ROLES}>
                      <DepartmentsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin/services"
                  element={
                    <RoleRoute roles={ADMIN_ROLES}>
                      <ServicesPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <RoleRoute roles={GLOBAL_READ_ROLES}>
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
