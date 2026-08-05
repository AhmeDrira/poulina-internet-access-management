import { useAuth } from '../../store/AuthContext';
import { Role } from '../../types';
import EmployeeDashboard from './EmployeeDashboard';
import ManagerDashboard from './ManagerDashboard';
import NetworkDashboard from './NetworkDashboard';
import AdminDashboard from '../admin/AdminDashboard';
import SuperAdminDashboard from '../admin/SuperAdminDashboard';

/** Aiguille vers le tableau de bord correspondant au rôle connecté */
export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case Role.MANAGER:
      return <ManagerDashboard />;
    case Role.NETWORK_TEAM:
      return <NetworkDashboard />;
    case Role.ADMIN:
      return <AdminDashboard />;
    case Role.SUPER_ADMIN:
      return <SuperAdminDashboard />;
    case Role.SECURITY_OFFICER:
      return <AdminDashboard readOnly />;
    case Role.EMPLOYEE:
    default:
      return <EmployeeDashboard />;
  }
}
