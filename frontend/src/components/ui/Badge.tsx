import { ReactNode } from 'react';
import {
  BadgeColor,
  RECOMMENDATION_COLORS,
  RECOMMENDATION_LABELS,
  ROLE_COLORS,
  ROLE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../../utils/labels';
import { DecisionSupport, RequestStatus, Role } from '../../types';

interface BadgeProps {
  color?: BadgeColor;
  children: ReactNode;
  withDot?: boolean;
}

export function Badge({ color = 'slate', children, withDot = false }: BadgeProps) {
  return (
    <span className={`badge badge-${color}`}>
      {withDot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge color={STATUS_COLORS[status]} withDot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>;
}

/** Badge compact du score d'aide à la décision (affiché au chef de département) */
export function ScoreBadge({ decision }: { decision: DecisionSupport }) {
  return (
    <Badge color={RECOMMENDATION_COLORS[decision.level]} withDot>
      {decision.score}/100 · {RECOMMENDATION_LABELS[decision.level]}
    </Badge>
  );
}
