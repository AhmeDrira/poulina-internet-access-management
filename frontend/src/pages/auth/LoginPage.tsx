import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BarChart3, Bell, GitBranch, Globe, KeyRound, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { ssoApi, SsoConfig } from '../../api/sso.api';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input } from '../../components/ui/FormField';
import { useAuth } from '../../store/AuthContext';

const FEATURES = [
  { icon: <GitBranch size={19} />, text: 'Workflow de validation : employé → chef de département → équipe réseau' },
  { icon: <ShieldCheck size={19} />, text: 'Sécurité RBAC, traçabilité et journal d’audit complet' },
  { icon: <Bell size={19} />, text: 'Notifications à chaque étape du traitement' },
  { icon: <BarChart3 size={19} />, text: 'Statistiques et aide à la décision pour les validateurs' },
];

const DEMO_ACCOUNTS = [
  { role: 'Administrateur', email: 'admin@poulina.tn', password: 'Admin@2026' },
  { role: 'Chef département IT', email: 'manager.it@poulina.tn', password: 'Manager@2026' },
  { role: 'Employé', email: 'employee@poulina.tn', password: 'Employee@2026' },
  { role: 'Équipe réseau', email: 'network@poulina.tn', password: 'Network@2026' },
  { role: 'Responsable sécurité', email: 'security@poulina.tn', password: 'Security@2026' },
];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [sso, setSso] = useState<SsoConfig>({ enabled: false, label: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  // Disponibilité de l'authentification unique (masque le bouton si non configurée)
  useEffect(() => {
    let cancelled = false;
    ssoApi
      .config()
      .then((config) => {
        if (!cancelled) setSso(config);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "L'adresse email est obligatoire.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = "L'adresse email est invalide.";
    }
    if (!password) {
      errors.password = 'Le mot de passe est obligatoire.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setApiError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
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
          <h2>Digitalisez les demandes d'accès Internet de vos employés</h2>
          <div className="login-hero-features">
            {FEATURES.map((feature, index) => (
              <div key={index} className="login-hero-feature">
                {feature.icon}
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--slate-500)' }}>
          Groupe Holding Poulina — Département Informatique · Projet de stage d'été
        </div>
      </div>

      <div className="login-panel">
        <div className="login-box">
          <Card>
            <div className="login-logo">
              <div className="sidebar-brand-logo">
                <Globe size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 19 }}>Connexion</h2>
                <div className="text-muted text-small">Portail de gestion des accès Internet</div>
              </div>
            </div>

            {apiError && <Alert variant="danger">{apiError}</Alert>}

            {sso.enabled && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<ShieldCheck size={16} />}
                  style={{ width: '100%' }}
                  onClick={() => ssoApi.startLogin('/')}
                >
                  {sso.label}
                </Button>
                <div className="login-separator">
                  <span>ou avec vos identifiants</span>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <FormField label="Email professionnel" required error={fieldErrors.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="prenom.nom@poulina.tn"
                  hasError={!!fieldErrors.email}
                  autoComplete="username"
                  autoFocus
                />
              </FormField>
              <FormField label="Mot de passe" required error={fieldErrors.password}>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  hasError={!!fieldErrors.password}
                  autoComplete="current-password"
                />
              </FormField>
              <Button
                type="submit"
                loading={loading}
                icon={<KeyRound size={16} />}
                style={{ width: '100%' }}
              >
                Se connecter
              </Button>
            </form>

            <details className="demo-accounts">
              <summary>Comptes de démonstration</summary>
              <table>
                <tbody>
                  {DEMO_ACCOUNTS.map((account) => (
                    <tr key={account.email}>
                      <td>{account.role}</td>
                      <td>
                        <code>{account.email}</code>
                      </td>
                      <td>
                        <code>{account.password}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Card>
        </div>
      </div>
    </div>
  );
}
