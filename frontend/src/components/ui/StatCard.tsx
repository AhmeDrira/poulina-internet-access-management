import { ReactNode } from 'react';
import { BadgeColor } from '../../utils/labels';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: BadgeColor;
  hint?: string;
}

export function StatCard({ label, value, icon, accent = 'blue', hint }: StatCardProps) {
  return (
    <div className="stat-card">
      {icon && <div className={`stat-card-icon accent-${accent}`}>{icon}</div>}
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {hint && <div className="stat-card-hint">{hint}</div>}
      </div>
    </div>
  );
}
