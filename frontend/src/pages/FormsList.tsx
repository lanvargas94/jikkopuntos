import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/http';

type Published = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  shareToken: string | null;
  publicSlug: string | null;
  updatedAt: string;
};

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function FormsList() {
  const [items, setItems] = useState<Published[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await api<Published[]>('/forms/published');
        if (!c) setItems(res);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (err) {
    return (
      <div className="fm-page">
        <div className="fm-panel fm-panel--error">{err}</div>
      </div>
    );
  }
  if (!items) {
    return (
      <div className="fm-page">
        <div className="fm-panel fm-panel--loading">Cargando formularios…</div>
      </div>
    );
  }

  return (
    <div className="fm-page">
      <header className="fm-head">
        <div className="fm-head-icon-wrap" aria-hidden>
          <IconClipboard className="fm-head-icon" />
        </div>
        <div>
          <h1 className="fm-title">Formularios publicados</h1>
          <p className="fm-subtitle">
            Responde los formularios activos del portal. Con sesión iniciada puedes enviar y, si
            aplica, recibir jikkopuntos.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="fm-panel fm-empty">
          <p className="fm-empty-text">No hay formularios activos en este momento.</p>
        </div>
      ) : (
        <ul className="fm-list">
          {items.map((f) => (
            <li key={f.id} className="fm-list-item">
              <div className="fm-list-body">
                <h2 className="fm-list-title">{f.title}</h2>
                {f.description ? <p className="fm-list-desc">{f.description}</p> : null}
                <div className="fm-list-meta">
                  {f.pointsReward > 0 ? (
                    <span className="fm-tag fm-tag--jp">{f.pointsReward} JP</span>
                  ) : null}
                  <span className="fm-list-date">
                    Actualizado {new Date(f.updatedAt).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              {(f.publicSlug || f.shareToken) && (
                <Link
                  className="fm-btn-primary fm-btn-primary--compact"
                  to={`/forms/${encodeURIComponent(f.publicSlug ?? f.shareToken!)}`}
                >
                  Responder
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
