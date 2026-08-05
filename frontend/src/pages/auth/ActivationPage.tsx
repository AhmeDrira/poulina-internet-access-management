import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Globe, KeyRound, ShieldCheck } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input } from '../../components/ui/FormField';
import { LoadingBlock } from '../../components/ui/Spinner';
import { ActivationTarget } from '../../types';
import { formatDateTime } from '../../utils/date';
import { PASSWORD_RULES, checkPassword } from '../../utils/password';

/**
 * Page publique d'activation d'un compte.
 * L'employé arrive ici par le lien temporaire remis lors de la création de son
 * compte : il doit définir son mot de passe avant tout accès à l'application.
 */
export default function ActivationPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [target, setTarget] = useState<ActivationTarget | null>(null);
  const [linkError, setLinkError] = useState('');
  const [checking, setChecking] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .describeActivation(token)
      .then((data) => {
        if (!cancelled) setTarget(data);
      })
      .catch((error) => {
        if (!cancelled) setLinkError(getApiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: { password?: string; confirm?: string } = {};
    const policyError = checkPassword(password);
    if (policyError) nextErrors.password = policyError;
    if (password !== confirm) nextErrors.confirm = 'Les deux mots de passe ne correspondent pas.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setApiError('');
    setSubmitting(true);
    try {
      await authApi.activate(token, password);
      setDone(true);
      // Le lien est désormais consommé : retour à la connexion
      window.setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

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
          <h2>Bienvenue — activez votre compte en choisissant votre mot de passe</h2>
          <div className="login-hero-features">
            <div className="login-hero-feature">
              <ShieldCheck size={19} />
              <span>
                Votre compte a été créé par le service informatique : vous seul définissez votre
                mot de passe.
              </span>
            </div>
            <div className="login-hero-feature">
              <KeyRound size={19} />
              <span>
                Ce lien est à usage unique et expire automatiquement : il ne fonctionnera plus après
                validation.
              </span>
            </div>
          </div>
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
                <KeyRound size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 19 }}>
                  {target?.isReset ? 'Nouveau mot de passe' : 'Activation de votre compte'}
                </h2>
                <div className="text-muted text-small">
                  {target?.isReset
                    ? 'Choisissez un nouveau mot de passe pour votre compte'
                    : 'Première étape avant d’accéder au portail'}
                </div>
              </div>
            </div>

            {checking && <LoadingBlock />}

            {!checking && linkError && (
              <>
                <Alert variant="danger">{linkError}</Alert>
                <Link to="/login">
                  <Button variant="secondary" style={{ width: '100%' }}>
                    Retour à la connexion
                  </Button>
                </Link>
              </>
            )}

            {!checking && target && done && (
              <div style={{ textAlign: 'center', padding: '12px 4px' }}>
                <CheckCircle2 size={48} style={{ color: 'var(--green-600)', marginBottom: 12 }} />
                <h3 style={{ marginBottom: 8 }}>Mot de passe enregistré</h3>
                <p className="text-muted" style={{ marginBottom: 18 }}>
                  Vous pouvez maintenant vous connecter avec <strong>{target.email}</strong>.
                </p>
                <Link to="/login">
                  <Button style={{ width: '100%' }}>Aller à la connexion</Button>
                </Link>
              </div>
            )}

            {!checking && target && !done && (
              <>
                <Alert variant="info">
                  Compte de <strong>{target.firstName} {target.lastName}</strong> ({target.email}).
                  {target.expiresAt && <> Lien valable jusqu’au {formatDateTime(target.expiresAt)}.</>}
                </Alert>

                {apiError && <Alert variant="danger">{apiError}</Alert>}

                <form onSubmit={handleSubmit} noValidate>
                  <FormField
                    label="Nouveau mot de passe"
                    required
                    error={errors.password}
                    hint={PASSWORD_RULES}
                  >
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      hasError={!!errors.password}
                      autoComplete="new-password"
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Confirmation du mot de passe" required error={errors.confirm}>
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="••••••••"
                      hasError={!!errors.confirm}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <Button type="submit" loading={submitting} style={{ width: '100%' }}>
                    Enregistrer et activer mon compte
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
