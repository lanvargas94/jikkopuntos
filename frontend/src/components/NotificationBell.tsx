import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/http';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await api<{ count: number }>('/notifications/unread-count');
      setCount(res.count);
    } catch {
      /* sesión expirada, etc. */
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const list = await api<NotificationRow[]>('/notifications?limit=25');
      setItems(list);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const t = window.setInterval(() => void refreshCount(), 45000);
    return () => window.clearInterval(t);
  }, [refreshCount]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function onOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadList();
      void refreshCount();
    }
  }

  async function markRead(id: string, link: string | null) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' });
    } catch {
      /* */
    }
    void refreshCount();
    void loadList();
    if (link) {
      setOpen(false);
    }
  }

  return (
    <div className="notif-bell-wrap" ref={rootRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(e) => {
          e.stopPropagation();
          void onOpen();
        }}
      >
        <span className="notif-bell-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </span>
        {count > 0 ? <span className="notif-bell-badge">{count > 99 ? '99+' : count}</span> : null}
        <span className="sr-only">Notificaciones{count > 0 ? `, ${count} sin leer` : ''}</span>
      </button>
      {open ? (
        <div className="notif-bell-panel" role="menu">
          <div className="notif-bell-panel-head">
            <span>Notificaciones</span>
            <button
              type="button"
              className="notif-bell-markall"
              onClick={() => {
                void (async () => {
                  try {
                    await api('/notifications/read-all', { method: 'PATCH', body: '{}' });
                  } catch {
                    /* */
                  }
                  void refreshCount();
                  void loadList();
                })();
              }}
            >
              Marcar leídas
            </button>
          </div>
          <ul className="notif-bell-list">
            {!items || items.length === 0 ? (
              <li className="notif-bell-empty muted small">No hay notificaciones recientes.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={`notif-bell-item${n.readAt ? ' is-read' : ''}`}>
                  {n.link ? (
                    <Link
                      to={n.link}
                      className="notif-bell-link"
                      onClick={() => void markRead(n.id, n.link)}
                    >
                      <strong>{n.title}</strong>
                      <span className="notif-bell-body">{n.body}</span>
                      <span className="notif-bell-time muted small">
                        {new Date(n.createdAt).toLocaleString('es-CO')}
                      </span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="notif-bell-link"
                      onClick={() => void markRead(n.id, null)}
                    >
                      <strong>{n.title}</strong>
                      <span className="notif-bell-body">{n.body}</span>
                      <span className="notif-bell-time muted small">
                        {new Date(n.createdAt).toLocaleString('es-CO')}
                      </span>
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
