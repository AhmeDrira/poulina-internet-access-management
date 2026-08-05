import { NavLink } from 'react-router-dom';
import {
  Bell,
  Building2,
  FilePlus2,
  FileSliders,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  Users,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { ADMIN_ROLES, GLOBAL_READ_ROLES, MESSAGING_ROLES, REQUESTER_ROLES, Role } from '../types';
import { ROLE_LABELS } from '../utils/labels';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  messagingUnread: number;
}

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
  roles?: Role[];
  badge?: number;
}

export function Sidebar({ open, onClose, unreadCount, messagingUnread }: SidebarProps) {
  const { user } = useAuth();
  if (!user) return null;

  const items: NavItem[] = [
    { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={18} /> },
    {
      to: '/requests/new',
      label: 'Nouvelle demande',
      icon: <FilePlus2 size={18} />,
      roles: REQUESTER_ROLES,
    },
    {
      to: '/my-requests',
      label: 'Mes demandes',
      icon: <FileText size={18} />,
      roles: REQUESTER_ROLES,
    },
    {
      to: '/requests',
      label: 'Toutes les demandes',
      icon: <FileText size={18} />,
      roles: GLOBAL_READ_ROLES,
    },
    {
      to: '/messaging',
      label: 'Messagerie interne',
      icon: <MessagesSquare size={18} />,
      roles: MESSAGING_ROLES,
      badge: messagingUnread,
    },
    { to: '/notifications', label: 'Notifications', icon: <Bell size={18} />, badge: unreadCount },
  ];

  const adminItems: NavItem[] = [
    { to: '/admin/users', label: 'Utilisateurs', icon: <Users size={18} />, roles: ADMIN_ROLES },
    {
      to: '/admin/forms',
      label: 'Formulaires',
      icon: <FileSliders size={18} />,
      roles: [Role.SUPER_ADMIN],
    },
    {
      to: '/admin/departments',
      label: 'Départements',
      icon: <Building2 size={18} />,
      roles: ADMIN_ROLES,
    },
    { to: '/admin/services', label: 'Services', icon: <Layers size={18} />, roles: ADMIN_ROLES },
    {
      to: '/audit-logs',
      label: "Journal d'audit",
      icon: <ScrollText size={18} />,
      roles: GLOBAL_READ_ROLES,
    },
  ];

  const visible = (item: NavItem) => !item.roles || item.roles.includes(user.role);
  const mainItems = items.filter(visible);
  const managementItems = adminItems.filter(visible);
  const managementTitle = user.role === Role.SUPER_ADMIN ? 'Supervision' : 'Administration';

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <Globe size={22} />
          </div>
          <div>
            <div className="sidebar-brand-name">Accès Internet</div>
            <div className="sidebar-brand-sub">Groupe Holding Poulina</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Menu</div>
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="sidebar-link-badge">{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </NavLink>
          ))}
          {managementItems.length > 0 && (
            <>
              <div className="sidebar-section-title">{managementTitle}</div>
              {managementItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          Connecté en tant que
          <br />
          <strong style={{ color: '#fff' }}>
            {user.firstName} {user.lastName}
          </strong>
          <br />
          {ROLE_LABELS[user.role]}
        </div>
      </aside>
    </>
  );
}
