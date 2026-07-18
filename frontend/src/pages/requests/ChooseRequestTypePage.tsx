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
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { RequestType } from '../../types';
import {
  REQUEST_TYPE_DESCRIPTIONS,
  REQUEST_TYPE_FULL_LABELS,
} from '../../utils/labels';

const TYPE_CARDS: { type: RequestType; icon: ReactNode; accent: string }[] = [
  { type: RequestType.INTERNET_ACCESS, icon: <Globe size={22} />, accent: 'accent-blue' },
  { type: RequestType.REMOTE_ACCESS, icon: <MonitorSmartphone size={22} />, accent: 'accent-purple' },
  { type: RequestType.EXTERNAL_DRIVE, icon: <HardDrive size={22} />, accent: 'accent-orange' },
  { type: RequestType.NETWORK_SHARE, icon: <FolderOpen size={22} />, accent: 'accent-cyan' },
  { type: RequestType.USB_3G_KEY, icon: <Signal size={22} />, accent: 'accent-green' },
  { type: RequestType.PASSWORD_COMMITMENT, icon: <KeyRound size={22} />, accent: 'accent-slate' },
];

/** Étape 1 : l'employé choisit le type de formulaire à remplir */
export default function ChooseRequestTypePage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Nouvelle demande"
        subtitle="Choisissez le formulaire à remplir : il sera transmis à votre chef de département puis à l'équipe réseau"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {TYPE_CARDS.map(({ type, icon, accent }) => (
          <div
            key={type}
            onClick={() => navigate(`/requests/new/${type}`)}
            style={{ cursor: 'pointer' }}
          >
            <Card>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div
                  className={`stat-card-icon ${accent}`}
                  style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}
                >
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                    {REQUEST_TYPE_FULL_LABELS[type]}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    {REQUEST_TYPE_DESCRIPTIONS[type]}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
