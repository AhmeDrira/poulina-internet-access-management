import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { PASSWORD_RULES, checkPassword } from '../../utils/password';

/**
 * Changement de mot de passe, en deux situations :
 *  - volontaire, depuis le menu utilisateur ;
 *  - imposé (compte créé par un administrateur ou réinitialisation) : dans ce
 *    cas l'API bloque tout le reste de l'application jusqu'au changement.
 */
export default function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const forced = user?.mustChangePassword === true;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = 'Le mot de passe actuel est obligatoire.';
    const policyError = checkPassword(newPassword);
    if (policyError) nextErrors.newPassword = policyError;
    if (newPassword && newPassword === currentPassword) {
      nextErrors.newPassword = 'Le nouveau mot de passe doit être différent de l’actuel.';
    }
    if (newPassword !== confirm) {
      nextErrors.confirm = 'Les deux mots de passe ne correspondent pas.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setApiError('');
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      await refreshUser();
      toast.success('Mot de passe modifié.');
      navigate('/');
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Changer mon mot de passe"
        subtitle={
          forced
            ? 'Cette étape est obligatoire avant d’utiliser l’application'
            : 'Sécurisez votre compte en renouvelant régulièrement votre mot de passe'
        }
      />

      <div style={{ maxWidth: 560 }}>
        {forced && (
          <Alert variant="warning">
            Un changement de mot de passe a été demandé pour votre compte. Vous pourrez accéder au
            portail dès qu’un nouveau mot de passe sera enregistré.
          </Alert>
        )}

        <Card title="Nouveau mot de passe">
          {apiError && <Alert variant="danger">{apiError}</Alert>}
          <form onSubmit={handleSubmit} noValidate>
            <FormField label="Mot de passe actuel" required error={errors.currentPassword}>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                hasError={!!errors.currentPassword}
                autoComplete="current-password"
                autoFocus
              />
            </FormField>
            <FormField
              label="Nouveau mot de passe"
              required
              error={errors.newPassword}
              hint={PASSWORD_RULES}
            >
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                hasError={!!errors.newPassword}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirmation" required error={errors.confirm}>
              <Input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                hasError={!!errors.confirm}
                autoComplete="new-password"
              />
            </FormField>
            <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
              {!forced && (
                <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                  Annuler
                </Button>
              )}
              <Button type="submit" loading={submitting} icon={<KeyRound size={16} />}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
