import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Globe, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useAuth } from '../../store/AuthContext';

/**
 * Retour de l'authentification unique.
 *
 * Le fournisseur d'identité renvoie ici un **code à usage unique** (jamais le
 * jeton lui-même, qui n'a donc jamais transité par une URL). Cette page
 * l'échange contre la session applicative puis redirige vers le portail.
 */
export default function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithSsoCode } = useAuth();
  const [error, setError] = useState('');
  // Le code est à usage unique : on ne l'échange qu'une fois, même en mode strict React
  const exchanged = useRef(false);

  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    if (providerError) {
      setError(providerError);
      return;
    }
    if (!code) {
      setError('Réponse incomplète du fournisseur d’identité.');
      return;
    }

    loginWithSsoCode(code)
      .then(() => navigate(returnTo, { replace: true }))
      .catch((apiError) => setError(getApiErrorMessage(apiError)));
  }, [code, providerError, returnTo, loginWithSsoCode, navigate]);

  return (
    <div className="login-page">
      <div className="login-hero">
        <div>
          <div className="login-logo">
            <div className="sidebar-brand-logo">
              <Globe size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Accès Internet</div>
              <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>Groupe Holding Poulina</div>
            </div>
          </div>
          <h2>Authentification unique du groupe</h2>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--slate-500)' }}>
          Groupe Holding Poulina — Département Informatique
        </div>
      </div>

      <div className="login-panel">
        <div className="login-box">
          <Card>
            <div className="login-logo">
              <div className="sidebar-brand-logo">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 19 }}>Connexion en cours</h2>
                <div className="text-muted text-small">Vérification auprès du fournisseur</div>
              </div>
            </div>

            {error ? (
              <>
                <Alert variant="danger">{error}</Alert>
                <Link to="/login">
                  <Button variant="secondary" style={{ width: '100%' }}>
                    Retour à la connexion
                  </Button>
                </Link>
              </>
            ) : (
              <LoadingBlock />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
