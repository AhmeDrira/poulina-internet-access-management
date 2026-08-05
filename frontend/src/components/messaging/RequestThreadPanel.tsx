import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCheck, RotateCcw, Send } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { messagingApi } from '../../api/messaging.api';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Textarea } from '../ui/FormField';
import { LoadingBlock } from '../ui/Spinner';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { Role, ThreadStatus, ThreadView } from '../../types';
import { formatDateTime, timeAgo } from '../../utils/date';
import { ROLE_LABELS, THREAD_STATUS_COLORS, THREAD_STATUS_LABELS } from '../../utils/labels';

interface RequestThreadPanelProps {
  requestId: string;
  /** Notifie le parent après envoi ou changement d'état (rafraîchit les compteurs) */
  onChanged?: () => void;
}

/**
 * Conversation interne rattachée à une demande.
 * Rendu uniquement pour le chef du département concerné et l'équipe réseau
 * (le serveur refuse l'accès aux autres rôles).
 */
export function RequestThreadPanel({ requestId, onChanged }: RequestThreadPanelProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<ThreadView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    messagingApi
      .threadForRequest(requestId)
      .then((data) => {
        if (!cancelled) setView(data);
      })
      .catch((apiError) => {
        if (!cancelled) setError(getApiErrorMessage(apiError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [view?.messages.length]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (text.length < 2) {
      toast.error('Votre message est trop court.');
      return;
    }
    setSending(true);
    try {
      const updated = await messagingApi.postMessage(requestId, text);
      setView(updated);
      setBody('');
      onChanged?.();
    } catch (apiError) {
      toast.error(getApiErrorMessage(apiError));
    } finally {
      setSending(false);
    }
  };

  const handleToggleResolved = async () => {
    if (!view?.thread) return;
    const resolved = view.thread.status === ThreadStatus.OPEN;
    setUpdating(true);
    try {
      await messagingApi.setResolved(view.thread._id, resolved);
      const refreshed = await messagingApi.threadForRequest(requestId);
      setView(refreshed);
      toast.success(resolved ? 'Échange marqué comme traité.' : 'Échange rouvert.');
      onChanged?.();
    } catch (apiError) {
      toast.error(getApiErrorMessage(apiError));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <Alert variant="warning">{error}</Alert>;
  if (!view) return null;

  const counterpartLabel =
    view.counterpart === 'MANAGER'
      ? ROLE_LABELS[Role.MANAGER]
      : ROLE_LABELS[Role.NETWORK_TEAM];

  return (
    <>
      {view.thread && (
        <div
          className="flex-row"
          style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}
        >
          <div className="flex-row" style={{ gap: 8, alignItems: 'center' }}>
            <Badge color={THREAD_STATUS_COLORS[view.thread.status]} withDot>
              {THREAD_STATUS_LABELS[view.thread.status]}
            </Badge>
            <span className="text-small text-muted">
              {view.thread.messageCount} message(s)
              {view.thread.resolvedAt && ` · traité le ${formatDateTime(view.thread.resolvedAt)}`}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={updating}
            icon={
              view.thread.status === ThreadStatus.OPEN ? (
                <CheckCheck size={15} />
              ) : (
                <RotateCcw size={15} />
              )
            }
            onClick={handleToggleResolved}
          >
            {view.thread.status === ThreadStatus.OPEN ? 'Marquer comme traité' : 'Rouvrir'}
          </Button>
        </div>
      )}

      {view.messages.length === 0 ? (
        <EmptyState
          title="Aucun échange sur cette demande"
          message={`Posez votre question au ${counterpartLabel.toLowerCase()} : elle restera rattachée à la demande ${view.request.reference}.`}
        />
      ) : (
        <div className="conversation">
          {view.messages.map((message) => {
            const mine = message.author?._id === user?._id;
            return (
              <div key={message._id} className={`message-row ${mine ? 'mine' : 'theirs'}`}>
                <div className="message-bubble">{message.body}</div>
                <div className="message-meta">
                  {mine
                    ? 'Vous'
                    : `${message.author?.firstName ?? ''} ${message.author?.lastName ?? ''} · ${
                        ROLE_LABELS[message.authorRole]
                      }`}{' '}
                  · {timeAgo(message.createdAt)}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <form className="message-composer" onSubmit={handleSend}>
        <Textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          placeholder={`Message professionnel à destination du ${counterpartLabel.toLowerCase()} — précision technique, contrainte, confirmation...`}
        />
        <div className="message-composer-actions">
          <span className="text-small text-muted">
            {body.length}/2000 · échange rattaché à {view.request.reference}, visible uniquement du
            chef de département et de l’équipe réseau.
          </span>
          <Button type="submit" loading={sending} icon={<Send size={15} />}>
            Envoyer
          </Button>
        </div>
      </form>
    </>
  );
}
