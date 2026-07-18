import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { ROLE_LABELS } from '../utils/labels';

interface NavbarProps {
  onToggleSidebar: () => void;
  unreadCount: number;
}

export function Navbar({ onToggleSidebar, unreadCount }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-icon-btn burger-btn" onClick={onToggleSidebar} aria-label="Menu">
          <Menu size={20} />
        </button>
        <div className="navbar-title">Portail de gestion des accès Internet</div>
      </div>
      <div className="navbar-right">
        <button
          className="navbar-icon-btn"
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="navbar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
        <div className="navbar-user">
          <div className="navbar-avatar">{initials}</div>
          <div className="navbar-user-info">
            <div className="navbar-user-name">
              {user.firstName} {user.lastName}
            </div>
            <div className="navbar-user-role">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
        <button className="navbar-icon-btn" onClick={handleLogout} aria-label="Se déconnecter" title="Se déconnecter">
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
