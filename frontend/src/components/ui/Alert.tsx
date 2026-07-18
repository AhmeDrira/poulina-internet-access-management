import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const ICONS: Record<AlertVariant, ReactNode> = {
  info: <Info size={17} />,
  success: <CheckCircle2 size={17} />,
  warning: <AlertTriangle size={17} />,
  danger: <XCircle size={17} />,
};

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
}

export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`}>
      {ICONS[variant]}
      <div>{children}</div>
    </div>
  );
}
