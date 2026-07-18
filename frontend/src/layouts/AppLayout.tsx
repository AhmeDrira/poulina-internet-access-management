import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { notificationsApi } from '../api/notifications.api';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

/** Gabarit principal : sidebar (selon rôle) + navbar + contenu */
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  // Compteur de notifications non lues : à chaque navigation + toutes les 30 s
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      notificationsApi
        .unreadCount()
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch(() => undefined);
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />
      <div className="main-area">
        <Navbar onToggleSidebar={() => setSidebarOpen((value) => !value)} unreadCount={unreadCount} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
