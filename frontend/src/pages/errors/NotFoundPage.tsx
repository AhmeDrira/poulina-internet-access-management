import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="full-page-loader">
      <EmptyState
        icon={<SearchX size={26} />}
        title="Page introuvable (404)"
        message="La page demandée n'existe pas ou a été déplacée."
        action={
          <Link to="/">
            <Button variant="secondary">Retour au tableau de bord</Button>
          </Link>
        }
      />
    </div>
  );
}
