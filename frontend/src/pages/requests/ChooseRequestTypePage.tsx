import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Globe,
  HardDrive,
  KeyRound,
  MonitorSmartphone,
  Signal,
} from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import { RequestType } from '../../types';
import { REQUEST_TYPE_DESCRIPTIONS, REQUEST_TYPE_FULL_LABELS } from '../../utils/labels';

const TYPE_VISUALS: Record<RequestType, { icon: ReactNode; accent: string }> = {
  [RequestType.INTERNET_ACCESS]: { icon: <Globe size={22} />, accent: 'accent-blue' },
  [RequestType.REMOTE_ACCESS]: { icon: <MonitorSmartphone size={22} />, accent: 'accent-purple' },
  [RequestType.EXTERNAL_DRIVE]: { icon: <HardDrive size={22} />, accent: 'accent-orange' },
  [RequestType.NETWORK_SHARE]: { icon: <FolderOpen size={22} />, accent: 'accent-cyan' },
  [RequestType.USB_3G_KEY]: { icon: <Signal size={22} />, accent: 'accent-green' },
  [RequestType.PASSWORD_COMMITMENT]: { icon: <KeyRound size={22} />, accent: 'accent-slate' },
};

/**
 * Étape 1 : l'employé choisit le formulaire à remplir.
 * Le catalogue provient de l'API : un formulaire retiré par le super
 * administrateur n'apparaît plus ici.
 */
export default function ChooseRequestTypePage() {
  const navigate = useNavigate();
  const { activeDefinitions, loading, error } = useFormDefinitions();

  return (
    <>
      <PageHeader
        title="Nouvelle demande"
        subtitle="Choisissez le formulaire à remplir : il sera transmis à votre chef de département puis à l'équipe réseau"
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {loading && activeDefinitions.length === 0 ? (
        <LoadingBlock />
      ) : activeDefinitions.length === 0 ? (
        <Card>
          <EmptyState
            title="Aucun formulaire disponible"
            message="Aucun formulaire n'est actuellement proposé. Contactez le service informatique."
          />
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {activeDefinitions.map((definition) => {
            const visual = TYPE_VISUALS[definition.requestType];
            return (
              <div
                key={definition.requestType}
                onClick={() => navigate(`/requests/new/${definition.requestType}`)}
                style={{ cursor: 'pointer' }}
              >
                <Card>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div
                      className={`stat-card-icon ${visual?.accent ?? 'accent-blue'}`}
                      style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}
                    >
                      {visual?.icon ?? <Globe size={22} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                        {definition.title || REQUEST_TYPE_FULL_LABELS[definition.requestType]}
                      </div>
                      <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        {definition.description ||
                          REQUEST_TYPE_DESCRIPTIONS[definition.requestType]}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
