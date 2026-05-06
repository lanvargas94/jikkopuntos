import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/http';

type QuestionRow = {
  id: string;
  type: string;
  label: string;
  helpText: string | null;
  required: boolean;
  options: Array<{ id: string; label: string; value: string }>;
};

type FormDef = {
  title: string;
  status: string;
  questions: QuestionRow[];
  schemaJson: string | null;
};

type Resp = {
  id: string;
  submittedAt: string;
  answersJson: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

function formatAnswerValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const [def, setDef] = useState<FormDef | null>(null);
  const [rows, setRows] = useState<Resp[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let c = false;
    (async () => {
      try {
        const d = await api<FormDef>(`/forms/definitions/${id}`);
        if (c) return;
        setDef(d);
        const list = await api<Resp[]>(`/forms/definitions/${id}/responses`);
        if (c) return;
        setRows(list);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  async function downloadExport() {
    if (!id) return;
    setExportBusy(true);
    try {
      const data = await api<unknown>(
        `/forms/definitions/${id}/responses/export`,
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `formulario-${id}-respuestas.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al exportar');
    } finally {
      setExportBusy(false);
    }
  }

  if (err) {
    return (
      <div className="fm-admin-page">
        <div className="fm-panel">
          <p className="error">{err}</p>
          <Link to="/admin/formularios" className="fm-link">
            Volver a formularios
          </Link>
        </div>
      </div>
    );
  }
  if (!rows || !def) {
    return (
      <div className="fm-admin-page">
        <div className="fm-panel fm-panel--loading">Cargando respuestas…</div>
      </div>
    );
  }

  const labelById = new Map(def.questions.map((q) => [q.id, q.label]));

  return (
    <div className="fm-admin-page">
      <header className="fm-responses-head">
        <div>
          <h1 className="fm-title">Respuestas</h1>
          <p className="fm-subtitle">{def.title}</p>
        </div>
        <div className="fm-responses-actions">
          <Link to="/admin/formularios" className="fm-btn-secondary">
            ← Formularios
          </Link>
          <button
            type="button"
            className="fm-btn-primary"
            disabled={exportBusy}
            onClick={() => void downloadExport()}
          >
            {exportBusy ? 'Exportando…' : 'Exportar JSON'}
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="fm-panel fm-empty">
          <p className="fm-empty-text">Sin respuestas aún.</p>
        </div>
      ) : (
        <ul className="fm-response-list">
          {rows.map((r) => {
            let parsed: Record<string, unknown> = {};
            try {
              parsed = JSON.parse(r.answersJson) as Record<string, unknown>;
            } catch {
              parsed = { _raw: r.answersJson };
            }
            const entries = Object.entries(parsed);
            return (
              <li key={r.id} className="fm-response-card">
                <header className="fm-response-card-head">
                  <div>
                    <strong className="fm-response-name">
                      {r.user.firstName} {r.user.lastName}
                    </strong>
                    <span className="fm-response-email">&lt;{r.user.email}&gt;</span>
                  </div>
                  <time className="fm-response-time" dateTime={r.submittedAt}>
                    {new Date(r.submittedAt).toLocaleString('es-CO')}
                  </time>
                </header>
                <dl className="answer-dl fm-answer-dl">
                  {entries.map(([key, val]) => (
                    <div key={key}>
                      <dt>{labelById.get(key) ?? key}</dt>
                      <dd>{formatAnswerValue(val)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
