import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, MessagesSquare } from 'lucide-react';
import { messagingApi } from '../../api/messaging.api';
import { RequestThreadPanel } from '../../components/messaging/RequestThreadPanel';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../store/AuthContext';
import { useFormDefinitions } from '../../store/FormDefinitionsContext';
import { Role, ThreadStatus } from '../../types';
import { timeAgo } from '../../utils/date';
import { THREAD_STATUS_COLORS, THREAD_STATUS_LABELS } from '../../utils/labels';

/**
 * Messagerie interne de traitement : liste des échanges rattachés aux demandes
 * et conversation avec le correspondant (chef de département ↔ équipe réseau).
 */
export default function MessagingPage() {
  const { user } = useAuth();
  const { shortLabelOf } = useFormDefinitions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ThreadStatus | ''>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    searchParams.get('request'),
  );
  const [unreadThreads, setUnreadThreads] = useState<string[]>([]);

  const debouncedSearch = useDebounce(search);

  const list = useApi(
    () => messagingApi.threads({ page, limit: 15, search: debouncedSearch, status, unreadOnly }),
    [page, debouncedSearch, status, unreadOnly],
  );

  const loadUnread = () => {
    messagingApi
      .unreadThreadIds()
      .then(setUnreadThreads)
      .catch(() => setUnreadThreads([]));
  };

  useEffect(loadUnread, [list.data]);

  const threads = list.data?.data ?? [];

  // Sélection automatique du premier fil quand aucun n'est demandé dans l'URL
  useEffect(() => {
    if (!selectedRequestId && threads.length > 0) {
      setSelectedRequestId(threads[0].request);
    }
  }, [threads, selectedRequestId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.request === selectedRequestId) ?? null,
    [threads, selectedRequestId],
  );

  const selectThread = (requestId: string) => {
    setSelectedRequestId(requestId);
    setSearchParams({ request: requestId }, { replace: true });
  };

  const counterpart =
    user?.role === Role.MANAGER ? "l'équipe réseau" : 'les chefs de département';

  return (
    <>
      <PageHeader
        title="Messagerie interne"
        subtitle={`Échanges professionnels avec ${counterpart}, rattachés aux demandes en cours de traitement`}
      />

      <Alert variant="info">
        Cet espace est réservé aux chefs de département et à l’équipe réseau. Les employés n’y ont
        pas accès : les échanges portent uniquement sur le traitement technique des demandes
        validées.
      </Alert>

      <div className="messaging-layout">
        <Card noPadding>
          <div className="table-toolbar">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Référence, demandeur..."
            />
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ThreadStatus | '');
                setPage(1);
              }}
              style={{ maxWidth: 150 }}
            >
              <option value="">Tous les états</option>
              {Object.values(ThreadStatus).map((value) => (
                <option key={value} value={value}>
                  {THREAD_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
            <label
              className="text-small"
              style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => {
                  setUnreadOnly(event.target.checked);
                  setPage(1);
                }}
              />
              Non lus
            </label>
          </div>

          {list.loading && threads.length === 0 ? (
            <LoadingBlock />
          ) : threads.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare size={26} />}
              title="Aucun échange"
              message="Les fils apparaissent dès qu'un premier message est envoyé sur une demande validée."
            />
          ) : (
            <div className="thread-list">
              {threads.map((thread) => {
                const unread = unreadThreads.includes(thread._id);
                return (
                  <button
                    key={thread._id}
                    type="button"
                    className={`thread-list-item ${
                      thread.request === selectedRequestId ? 'active' : ''
                    } ${unread ? 'unread' : ''}`}
                    onClick={() => selectThread(thread.request)}
                  >
                    <div className="thread-list-item-head">
                      <span className="thread-list-item-ref">{thread.reference}</span>
                      <div className="flex-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        {unread && <span className="thread-unread-dot" />}
                        <Badge color={THREAD_STATUS_COLORS[thread.status]}>
                          {THREAD_STATUS_LABELS[thread.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-small">
                      {thread.requesterName} · {shortLabelOf(thread.requestType)}
                    </div>
                    <div className="thread-list-item-preview">{thread.lastMessagePreview}</div>
                    <div className="text-small text-muted">{timeAgo(thread.lastMessageAt)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {list.data && list.data.totalPages > 1 && (
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              onChange={setPage}
            />
          )}
        </Card>

        <div>
          {selectedRequestId ? (
            <Card
              title={
                selectedThread
                  ? `${selectedThread.reference} — ${selectedThread.requesterName}`
                  : 'Conversation'
              }
              subtitle={
                selectedThread
                  ? `${shortLabelOf(selectedThread.requestType)} · département ${
                      selectedThread.department?.name ?? '—'
                    }`
                  : undefined
              }
              actions={
                <Link to={`/requests/${selectedRequestId}`}>
                  <Badge color="blue">
                    <ExternalLink size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Voir la demande
                  </Badge>
                </Link>
              }
            >
              <RequestThreadPanel
                requestId={selectedRequestId}
                onChanged={() => {
                  list.reload();
                  loadUnread();
                }}
              />
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={<MessagesSquare size={26} />}
                title="Sélectionnez un échange"
                message="Choisissez un fil à gauche, ou ouvrez une demande validée pour démarrer un échange."
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
