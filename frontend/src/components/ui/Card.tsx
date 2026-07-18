import { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, subtitle, actions, children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`card ${className}`.trim()}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <div className="card-title">{title}</div>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="flex-row">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${noPadding ? 'no-padding' : ''}`.trim()}>{children}</div>
    </div>
  );
}
