import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  BellOff,
  CheckCheck,
  FilePlus2,
  Lock,
  ThumbsDown,
  ThumbsUp,
  TimerOff,
  Wifi,
  Wrench,
} from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { notificationsApi } from '../../api/notifications.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../store/ToastContext';
import { AppNotification, NotificationType } from '../../types';
import { timeAgo } from '../../utils/date';

const TYPE_META: Record<NotificationType, { icon: ReactNode; accent: string }> = {
  [NotificationType.REQUEST_SUBMITTED]: { icon: <FilePlus2 size={17} />, accent: 'accent-blue' },
  [NotificationType.REQUEST_APPROVED]: { icon: <ThumbsUp size={17} />, accent: 'accent-blue' },
  [NotificationType.REQUEST_REJECTED]: { icon: <ThumbsDown size={17} />, accent: 'accent-red' },
  [NotificationType.REQUEST_CHANGES_REQUESTED]: { icon: <FilePlus2 size={17} />, accent: 'accent-amber' },
  [NotificationType.REQUEST_RESUBMITTED]: { icon: <FilePlus2 size={17} />, accent: 'accent-cyan' },
  [NotificationType.REQUEST_REJECTED_TECHNICAL]: { icon: <ThumbsDown size={17} />, accent: 'accent-red' },
  [NotificationType.REQUEST_IN_PROGRESS]: { icon: <Wrench size={17} />, accent: 'accent-purple' },
  [NotificationType.REQUEST_ACTIVATED]: { icon: <Wifi size={17} />, accent: 'accent-green' },
  [NotificationType.REQUEST_CLOSED]: { icon: <Lock size={17} />, accent: 'accent-slate' },
  [NotificationType.REQUEST_EXPIRED]: { icon: <TimerOff size={17} />, accent: 'accent-orange' },
  [NotificationType.REQUEST_EXPIRING_SOON]: { icon: <AlarmClock size={17} />, accent: 'accent-amber' },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, loading, reload } = useApi(
    () => notificationsApi.list({ page, limit: 15, unreadOnly: unreadOnly || undefined }),
    [page, unreadOnly],
  );

  const notifications = data?.data ?? [];
  const hasUnread = notifications.some((notification) => !notification.isRead);

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllAsRead();
      toast.success('Toutes les notifications ont été marquées comme lues.');
      reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const handleClick = async (notification: AppNotification) => {
    try {
      if (!notification.isRead) {
        await notificationsApi.markAsRead(notification._id);
      }
      if (notification.relatedRequest) {
        navigate(`/requests/${notification.relatedRequest._id}`);
      } else {
        reload();
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Suivi des événements liés à vos demandes"
        actions={
          <Button
            variant="secondary"
            icon={<CheckCheck size={16} />}
            onClick={handleMarkAll}
            disabled={!hasUnread}
          >
            Tout marquer comme lu
          </Button>
        }
      />

      <div className="flex-row" style={{ marginBottom: 14 }}>
        <Button
          size="sm"
          variant={!unreadOnly ? 'primary' : 'ghost'}
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
        >
          Toutes
        </Button>
        <Button
          size="sm"
          variant={unreadOnly ? 'primary' : 'ghost'}
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
        >
          Non lues
        </Button>
      </div>

      <Card noPadding>
        {loading ? (
          <LoadingBlock />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<BellOff size={26} />}
            title="Aucune notification"
            message={
              unreadOnly
                ? 'Vous avez lu toutes vos notifications.'
                : 'Les événements liés à vos demandes apparaîtront ici.'
            }
          />
        ) : (
          notifications.map((notification) => {
            const meta = TYPE_META[notification.type] ?? {
              icon: <FilePlus2 size={17} />,
              accent: 'accent-slate',
            };
            return (
              <div
                key={notification._id}
                onClick={() => handleClick(notification)}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--slate-100)',
                  cursor: 'pointer',
                  background: notification.isRead ? undefined : 'var(--primary-50)',
                }}
              >
                <div
                  className={`stat-card-icon ${meta.accent}`}
                  style={{ width: 38, height: 38, borderRadius: 10 }}
                >
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: notification.isRead ? 500 : 700, fontSize: 13.5 }}>
                    {notification.title}
                    {notification.relatedRequest && (
                      <span className="text-muted text-small font-mono" style={{ marginLeft: 8 }}>
                        {notification.relatedRequest.reference}
                      </span>
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {notification.message}
                  </div>
                  <div className="text-small text-muted" style={{ marginTop: 4 }}>
                    {timeAgo(notification.createdAt)}
                  </div>
                </div>
                {!notification.isRead && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--primary-600)',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })
        )}
        {data && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onChange={setPage}
          />
        )}
      </Card>
    </>
  );
}
