import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/http';

type QType = 'TEXT_OPEN' | 'SINGLE_SELECT' | 'MULTI_SELECT';

type DraftOption = {
  localKey: string;
  id?: string;
  label: string;
  value: string;
};

type DraftQuestion = {
  localKey: string;
  id?: string;
  type: QType;
  label: string;
  helpText: string;
  required: boolean;
  options: DraftOption[];
};

type LegacyField =
  | { id: string; type: 'text' | 'textarea' | 'number'; label: string; required?: boolean }
  | { id: string; type: 'boolean'; label: string; required?: boolean }
  | {
      id: string;
      type: 'select';
      label: string;
      required?: boolean;
      options: string[];
    };

function newLocalKey() {
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyOption(): DraftOption {
  return { localKey: newLocalKey(), label: '', value: '' };
}

function emptyQuestion(): DraftQuestion {
  return {
    localKey: newLocalKey(),
    type: 'TEXT_OPEN',
    label: '',
    helpText: '',
    required: false,
    options: [emptyOption(), emptyOption()],
  };
}

function legacySchemaToDraft(schema: { fields: LegacyField[] }): DraftQuestion[] {
  return schema.fields.map((f) => {
    if (f.type === 'boolean') {
      return {
        localKey: newLocalKey(),
        id: f.id,
        type: 'SINGLE_SELECT',
        label: f.label,
        helpText: '',
        required: Boolean(f.required),
        options: [
          { localKey: newLocalKey(), label: 'Sí', value: 'true' },
          { localKey: newLocalKey(), label: 'No', value: 'false' },
        ],
      };
    }
    if (f.type === 'select') {
      return {
        localKey: newLocalKey(),
        id: f.id,
        type: 'SINGLE_SELECT',
        label: f.label,
        helpText: '',
        required: Boolean(f.required),
        options: (f.options ?? []).map((label) => ({
          localKey: newLocalKey(),
          label,
          value: label,
        })),
      };
    }
    return {
      localKey: newLocalKey(),
      id: f.id,
      type: 'TEXT_OPEN',
      label: f.label,
      helpText: '',
      required: Boolean(f.required),
      options: [],
    };
  });
}

function validateDrafts(drafts: DraftQuestion[]): string | null {
  if (drafts.length === 0) {
    return 'Agrega al menos una pregunta antes de guardar.';
  }
  for (const d of drafts) {
    if (!d.label.trim()) {
      return 'Cada pregunta debe tener un enunciado visible.';
    }
    if (d.type !== 'TEXT_OPEN') {
      const opts = d.options.filter((o) => o.label.trim());
      if (opts.length < 2) {
        return `La pregunta «${d.label.slice(0, 40) || '…'}» necesita al menos dos opciones.`;
      }
      const vals = opts.map((o) => (o.value.trim() || o.label.trim()));
      if (new Set(vals).size !== vals.length) {
        return `Opciones con el mismo valor interno en: ${d.label.slice(0, 40)}`;
      }
    }
  }
  return null;
}

function toApiPayload(drafts: DraftQuestion[]) {
  return {
    questions: drafts.map((d, i) => {
      const base = {
        id: d.id,
        type: d.type,
        label: d.label.trim(),
        helpText: d.helpText.trim() || undefined,
        required: d.required,
        sortOrder: i,
      };
      if (d.type === 'TEXT_OPEN') {
        return { ...base, options: undefined };
      }
      return {
        ...base,
        options: d.options
          .filter((o) => o.label.trim())
          .map((o, j) => ({
            id: o.id,
            label: o.label.trim(),
            value: o.value.trim() || undefined,
            sortOrder: j,
          })),
      };
    }),
  };
}

const TYPE_LABELS: Record<QType, string> = {
  TEXT_OPEN: 'Respuesta abierta',
  SINGLE_SELECT: 'Selección única',
  MULTI_SELECT: 'Selección múltiple',
};

export function FormEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nuevo';
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [pointsReward, setPointsReward] = useState(0);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [status, setStatus] = useState<string>('DRAFT');
  const [showPreview, setShowPreview] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    let c = false;
    (async () => {
      try {
        const def = await api<{
          title: string;
          description: string | null;
          pointsReward: number;
          publicSlug: string | null;
          allowMultipleResponses: boolean;
          status: string;
          schemaJson: string | null;
          questions: Array<{
            id: string;
            type: string;
            label: string;
            helpText: string | null;
            required: boolean;
            options: Array<{ id: string; label: string; value: string }>;
          }>;
        }>(`/forms/definitions/${id}`);
        if (c) return;
        setStatus(def.status);
        if (def.status !== 'DRAFT') {
          setErr('Solo se pueden editar borradores.');
          setLoaded(true);
          return;
        }
        setTitle(def.title);
        setDescription(def.description ?? '');
        setPublicSlug(def.publicSlug ?? '');
        setAllowMultipleResponses(Boolean(def.allowMultipleResponses));
        setPointsReward(def.pointsReward);
        if (def.questions?.length) {
          setDrafts(
            def.questions.map((q) => ({
              localKey: newLocalKey(),
              id: q.id,
              type: q.type as QType,
              label: q.label,
              helpText: q.helpText ?? '',
              required: q.required,
              options:
                q.type === 'TEXT_OPEN'
                  ? []
                  : q.options.map((o) => ({
                      localKey: newLocalKey(),
                      id: o.id,
                      label: o.label,
                      value: o.value,
                    })),
            })),
          );
        } else if (def.schemaJson) {
          const schema = JSON.parse(def.schemaJson) as { fields: LegacyField[] };
          const mapped = legacySchemaToDraft(schema);
          setDrafts(mapped.length ? mapped : [emptyQuestion()]);
        } else {
          setDrafts([emptyQuestion()]);
        }
        setLoaded(true);
      } catch (e) {
        if (!c) {
          setErr(e instanceof Error ? e.message : 'Error');
          setLoaded(true);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [id, isNew]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const structural = validateDrafts(drafts);
    if (structural) {
      setErr(structural);
      return;
    }
    if (!title.trim()) {
      setErr('El título del formulario es obligatorio.');
      return;
    }
    setBusy(true);
    try {
      const payload = toApiPayload(drafts);
      if (isNew) {
        const created = await api<{ id: string }>('/forms/definitions', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            pointsReward,
          }),
        });
        await api(`/forms/definitions/${created.id}/questions`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await api(`/forms/definitions/${created.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            publicSlug: publicSlug.trim() || null,
            allowMultipleResponses,
          }),
        });
        navigate(`/admin/formularios/${created.id}`, { replace: true });
      } else {
        await api(`/forms/definitions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            pointsReward,
            publicSlug: publicSlug.trim() || null,
            allowMultipleResponses,
          }),
        });
        await api(`/forms/definitions/${id}/questions`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setErr(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    setDrafts((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const t = next[index]!;
      next[index] = next[j]!;
      next[j] = t;
      return next;
    });
  }

  if (!loaded) {
    return (
      <div className="fm-admin-page">
        <div className="fm-panel fm-panel--loading">Cargando…</div>
      </div>
    );
  }

  if (!isNew && status !== 'DRAFT') {
    const hint =
      status === 'CLOSED'
        ? 'Este formulario está cerrado. En el listado puedes despublicarlo para volver a borrador y editarlo.'
        : 'Solo los borradores se pueden editar aquí. Despublica desde el listado si necesitas cambiar la estructura.';
    return (
      <div className="fm-admin-page">
        <div className="fm-panel">
          <h1 className="fm-title">Editar formulario</h1>
          <p className="error">{err ?? hint}</p>
          <p className="small">
            <Link to="/admin/formularios" className="fm-link">
              ← Volver al listado
            </Link>
            {' · '}
            {id ? (
              <Link to={`/admin/formularios/${id}/respuestas`} className="fm-link">
                Ver respuestas
              </Link>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-admin-page fm-editor">
      <header className="fm-editor-head">
        <h1 className="fm-title">{isNew ? 'Nuevo formulario' : 'Editar borrador'}</h1>
        <p className="fm-subtitle">
          Define título, recompensa en jikkopuntos y preguntas. Guarda como borrador antes de
          publicar desde el listado.
        </p>
      </header>
      <form onSubmit={onSave} className="stack fm-editor-form">
          <fieldset className="fm-fieldset field-block">
            <legend className="fm-fieldset-legend">Datos generales</legend>
            <label>
              Título del formulario *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Encuesta bienestar Q2"
                required
              />
            </label>
            <label>
              Descripción (opcional)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Contexto para el colaborador"
              />
            </label>
            <label>
              Jikkopuntos al enviar la respuesta
              <input
                type="number"
                min={0}
                value={pointsReward}
                onChange={(e) => setPointsReward(Number(e.target.value))}
              />
            </label>
            <label>
              Slug público opcional (URL legible)
              <input
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value.toLowerCase())}
                placeholder="ej. encuesta-bienestar"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <span className="small muted">
                Si lo defines, el enlace será <code>/forms/tu-slug</code> (solo minúsculas y
                guiones).
              </span>
            </label>
            <label className="inline checkbox">
              <input
                type="checkbox"
                checked={allowMultipleResponses}
                onChange={(e) => setAllowMultipleResponses(e.target.checked)}
              />
              Permitir varias respuestas por colaborador
            </label>
            <p className="small muted">
              Los jikkopuntos por recompensa solo se acreditan en el <strong>primer</strong>{' '}
              envío de cada persona (incluso si el formulario admite varios envíos).
            </p>
          </fieldset>

          <div className="fm-section-head row-between">
            <h2 className="fm-section-title">Preguntas</h2>
            <label className="inline checkbox">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              Vista previa
            </label>
          </div>
          <p className="small muted">
            Tipos disponibles: abierta, una opción, varias opciones. Las preguntas
            obligatorias y las opciones se validan al guardar y al publicar.
          </p>

          {drafts.map((d, idx) => (
            <fieldset key={d.localKey} className="fm-fieldset fm-question field-block">
              <legend className="fm-fieldset-legend">
                Pregunta {idx + 1}
                <span className="muted small"> · {TYPE_LABELS[d.type]}</span>
              </legend>
              <div className="actions" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="fm-link"
                  onClick={() => moveQuestion(idx, -1)}
                  disabled={idx === 0}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="fm-link"
                  onClick={() => moveQuestion(idx, 1)}
                  disabled={idx === drafts.length - 1}
                >
                  Bajar
                </button>
                <button
                  type="button"
                  className="fm-link"
                  onClick={() =>
                    setDrafts((prev) => {
                      const next = prev.filter((_, i) => i !== idx);
                      return next.length ? next : [emptyQuestion()];
                    })
                  }
                >
                  Quitar pregunta
                </button>
              </div>
              <label>
                Enunciado *
                <input
                  value={d.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDrafts((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, label: v } : x)),
                    );
                  }}
                  placeholder="¿Qué quieres preguntar?"
                />
              </label>
              <label>
                Texto de ayuda (opcional)
                <input
                  value={d.helpText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDrafts((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, helpText: v } : x)),
                    );
                  }}
                />
              </label>
              <label>
                Tipo de respuesta
                <select
                  value={d.type}
                  onChange={(e) => {
                    const t = e.target.value as QType;
                    setDrafts((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              type: t,
                              options:
                                t === 'TEXT_OPEN'
                                  ? []
                                  : x.options.length >= 2
                                    ? x.options
                                    : [emptyOption(), emptyOption()],
                            }
                          : x,
                      ),
                    );
                  }}
                >
                  <option value="TEXT_OPEN">{TYPE_LABELS.TEXT_OPEN}</option>
                  <option value="SINGLE_SELECT">{TYPE_LABELS.SINGLE_SELECT}</option>
                  <option value="MULTI_SELECT">{TYPE_LABELS.MULTI_SELECT}</option>
                </select>
              </label>
              <label className="inline checkbox">
                <input
                  type="checkbox"
                  checked={d.required}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setDrafts((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, required: v } : x)),
                    );
                  }}
                />
                Obligatoria
              </label>

              {d.type !== 'TEXT_OPEN' && (
                <div className="stack">
                  <strong className="small">Opciones (mínimo 2)</strong>
                  {d.options.map((o, oi) => (
                    <div key={o.localKey} className="grid-2">
                      <label>
                        Texto visible
                        <input
                          value={o.label}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDrafts((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      options: x.options.map((oo, j) =>
                                        j === oi ? { ...oo, label: v } : oo,
                                      ),
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </label>
                      <label>
                        Valor interno (opcional)
                        <input
                          value={o.value}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDrafts((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      options: x.options.map((oo, j) =>
                                        j === oi ? { ...oo, value: v } : oo,
                                      ),
                                    }
                                  : x,
                              ),
                            );
                          }}
                          placeholder="Se genera si lo dejas vacío"
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="fm-btn-secondary"
                    onClick={() =>
                      setDrafts((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, options: [...x.options, emptyOption()] }
                            : x,
                        ),
                      )
                    }
                  >
                    + Añadir opción
                  </button>
                </div>
              )}
            </fieldset>
          ))}

          <button
            type="button"
            className="fm-btn-secondary"
            onClick={() => setDrafts((prev) => [...prev, emptyQuestion()])}
          >
            + Añadir pregunta
          </button>

          {showPreview && (
            <div className="readonly-block fm-preview-box">
              <h3 className="fm-preview-title">Vista previa</h3>
              <p className="small muted">
                Así verá el colaborador el formulario publicado (sin enviar datos).
              </p>
              <div className="stack" style={{ marginTop: '0.75rem' }}>
                <strong>{title || 'Sin título'}</strong>
                {description ? <p className="muted small">{description}</p> : null}
                {drafts.map((d, i) => (
                  <div key={d.localKey} className="field-block">
                    <p>
                      {d.label || `Pregunta ${i + 1}`}
                      {d.required ? ' *' : ''}
                    </p>
                    {d.helpText ? <p className="small muted">{d.helpText}</p> : null}
                    {d.type === 'TEXT_OPEN' && <textarea readOnly rows={3} />}
                    {d.type === 'SINGLE_SELECT' && (
                      <div className="stack">
                        {d.options
                          .filter((o) => o.label.trim())
                          .map((o) => (
                            <label key={o.localKey} className="inline checkbox">
                              <input type="radio" disabled />
                              {o.label}
                            </label>
                          ))}
                      </div>
                    )}
                    {d.type === 'MULTI_SELECT' && (
                      <div className="stack">
                        {d.options
                          .filter((o) => o.label.trim())
                          .map((o) => (
                            <label key={o.localKey} className="inline checkbox">
                              <input type="checkbox" disabled />
                              {o.label}
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <p className="error">{err}</p>}
          <div className="fm-editor-footer row-between">
            <Link to="/admin/formularios" className="fm-link">
              ← Volver al listado
            </Link>
            <button type="submit" className="fm-btn-primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar borrador'}
            </button>
          </div>
        </form>
    </div>
  );
}
