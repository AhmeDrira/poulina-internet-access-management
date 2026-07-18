import {
  CheckCircle2,
  CircleDot,
  Clock,
  FilePlus2,
  Lock,
  MessageSquareWarning,
  ShieldX,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Wifi,
} from 'lucide-react';
import { RequestHistoryEntry, RequestStatus } from '../../types';
import { formatDateTime } from '../../utils/date';
import { fullName } from '../../utils/labels';

const STATUS_MARKERS: Record<RequestStatus, { icon: JSX.Element; className: string }> = {
  [RequestStatus.PENDING_MANAGER]: { icon: <FilePlus2 size={13} />, className: 'accent-amber' },
  [RequestStatus.CHANGES_REQUESTED]: { icon: <MessageSquareWarning size={13} />, className: 'accent-amber' },
  [RequestStatus.REJECTED]: { icon: <ThumbsDown size={13} />, className: 'accent-red' },
  [RequestStatus.REJECTED_TECHNICAL]: { icon: <ShieldX size={13} />, className: 'accent-red' },
  [RequestStatus.APPROVED_BY_MANAGER]: { icon: <ThumbsUp size={13} />, className: 'accent-blue' },
  [RequestStatus.PENDING_NETWORK]: { icon: <Clock size={13} />, className: 'accent-cyan' },
  [RequestStatus.IN_PROGRESS_NETWORK]: { icon: <CircleDot size={13} />, className: 'accent-purple' },
  [RequestStatus.ACTIVATED]: { icon: <Wifi size={13} />, className: 'accent-green' },
  [RequestStatus.CLOSED]: { icon: <Lock size={13} />, className: 'accent-slate' },
  [RequestStatus.EXPIRED]: { icon: <Timer size={13} />, className: 'accent-orange' },
};

interface RequestTimelineProps {
  entries: RequestHistoryEntry[];
}

/** Timeline verticale des actions d'une demande (du plus ancien au plus récent) */
export function RequestTimeline({ entries }: RequestTimelineProps) {
  const ordered = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <ul className="timeline">
      {ordered.map((entry) => {
        const marker = STATUS_MARKERS[entry.toStatus] ?? {
          icon: <CheckCircle2 size={13} />,
          className: 'accent-slate',
        };
        return (
          <li key={entry._id} className="timeline-item">
            <span className={`timeline-marker ${marker.className}`}>{marker.icon}</span>
            <div className="timeline-action">{entry.action}</div>
            <div className="timeline-meta">
              {formatDateTime(entry.createdAt)}
              {entry.performedBy ? ` — par ${fullName(entry.performedBy)}` : ' — action système'}
            </div>
            {entry.comment && <div className="timeline-comment">{entry.comment}</div>}
          </li>
        );
      })}
    </ul>
  );
}
