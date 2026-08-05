import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { messagingApi } from '../api/messaging.api';
import { notificationsApi } from '../api/notifications.api';
import { FormDefinitionsProvider } from '../store/FormDefinitionsContext';
import { useAuth } from '../store/AuthContext';
import { MESSAGING_ROLES } from '../types';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

/** Gabarit principal : sidebar (selon rôle) + navbar + contenu */
export function AppLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagingUnread, setMessagingUnread] = useState(0);
  const location = useLocation();

  const usesMessaging = user ? MESSAGING_ROLES.includes(user.role) : false;

  // Compteurs non lus : à chaque navigation + toutes les 30 s
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      notificationsApi
        .unreadCount()
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch(() => undefined);
      if (usesMessaging) {
        messagingApi
          .unreadCount()
          .then((count) => {
            if (!cancelled) setMessagingUnread(count);
          })
          .catch(() => undefined);
      }
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [location.pathname, usesMessaging]);

  return (
    <FormDefinitionsProvider>
      <div className="app-shell">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadCount={unreadCount}
          messagingUnread={messagingUnread}
        />
        <div className="main-area">
          <Navbar onToggleSidebar={() => setSidebarOpen((value) => !value)} unreadCount={unreadCount} />
          <main className="page-content">
            <Outlet />
          </main>
        </div>
      </div>
    </FormDefinitionsProvider>
  );
}
