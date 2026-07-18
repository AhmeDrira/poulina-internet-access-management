import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

export default function ForbiddenPage() {
  return (
    <div className="full-page-loader">
      <EmptyState
        icon={<ShieldAlert size={26} />}
        title="Accès refusé (403)"
        message="Vous n'avez pas les droits nécessaires pour consulter cette page."
        action={
          <Link to="/">
            <Button variant="secondary">Retour au tableau de bord</Button>
          </Link>
        }
      />
    </div>
  );
}
