import { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Role } from '../types';
import { Spinner } from '../components/ui/Spinner';

/** Chemin de la seule page accessible quand un changement de mot de passe est imposé */
const CHANGE_PASSWORD_PATH = '/change-password';

/** Bloque l'accès aux routes tant que l'utilisateur n'est pas authentifié */
export function ProtectedRoute() {
  const { isAuthenticated, initializing, user } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="full-page-loader">
        <Spinner large />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Mot de passe imposé (compte créé par un administrateur, réinitialisation) :
  // l'API refuse toute autre route, l'interface redirige donc vers le formulaire.
  if (user?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <Outlet />;
}

interface RoleRouteProps {
  roles: Role[];
  children: ReactNode;
}

/** Restreint une page à certains rôles (sinon redirection vers /403) */
export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
