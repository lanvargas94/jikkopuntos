import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { api, apiPublic } from '../api/http';
import { useAuth } from '../auth/AuthContext';

type QuestionOpt = { id: string; label: string; value: string };

type QuestionV2 = {
  id: string;
  type: 'TEXT_OPEN' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  label: string;
  helpText: string | null;
  required: boolean;
  options: QuestionOpt[];
};

type FieldLegacy =
  | { id: string; type: 'text' | 'textarea'; label: string; required?: boolean }
  | { id: string; type: 'number'; label: string; required?: boolean }
  | { id: string; type: 'boolean'; label: string; required?: boolean }
  | {
      id: string;
      type: 'select';
      label: string;
      required?: boolean;
      options: string[];
    };

type FormPayloadV2 = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  allowMultipleResponses: boolean;
  updatedAt: string;
  questions: QuestionV2[];
  schema: null;
};

type FormPayloadLegacy = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  allowMultipleResponses: boolean;
  updatedAt: string;
  questions: null;
  schema: { fields: FieldLegacy[] };
};

type FormPayload = FormPayloadV2 | FormPayloadLegacy;

type AnswerValue = string | number | boolean | string[];

function draftKey(lookup: string, updatedAt: string) {
  return `jikko_form_draft_v1_${encodeURIComponent(lookup)}_${encodeURIComponent(updatedAt)}`;
}

export function FormRespond() {
  const { token: lookup } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, bootstrapped, bumpJikkopoints, refreshMe } = useAuth();

  const [form, setForm] = useState<FormPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    hasSubmitted: boolean;
    canSubmit: boolean;
    allowMultipleResponses: boolean;
  } | null>(null);

  useEffect(() => {
    if (!lookup) return;
    let c = false;
    (async () => {
      try {
        const res = await apiPublic<FormPayload>(
          `/forms/share/${encodeURIComponent(lookup)}`,
        );
        if (c) return;
        setForm(res);
        const init: Record<string, AnswerValue> = {};
        if (res.questions?.length) {
          for (const q of res.questions) {
            if (q.type === 'MULTI_SELECT') {
              init[q.id] = [];
            } else if (q.type === 'SINGLE_SELECT' || q.type === 'TEXT_OPEN') {
              init[q.id] = '';
            }
          }
        } else if (res.schema?.fields) {
          for (const f of res.schema.fields) {
            if (f.type === 'boolean') {
              init[f.id] = false;
            } else {
              init[f.id] = '';
            }
          }
        }
        const stored = sessionStorage.getItem(draftKey(lookup, res.updatedAt));
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Record<string, AnswerValue>;
            setAnswers({ ...init, ...parsed });
          } catch {
            setAnswers(init);
          }
        } else {
          setAnswers(init);
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      c = true;
    };
  }, [lookup]);

  useEffect(() => {
    if (!lookup || !form || !bootstrapped || !user) {
      setSessionInfo(null);
      return;
    }
    let c = false;
    (async () => {
      try {
        const s = await api<{
          hasSubmitted: boolean;
          canSubmit: boolean;
          allowMultipleResponses: boolean;
        }>(`/forms/share/${encodeURIComponent(lookup)}/me`);
        if (!c) setSessionInfo(s);
      } catch {
        if (!c) setSessionInfo(null);
      }
    })();
    return () => {
      c = true;
    };
  }, [lookup, form, user, bootstrapped]);

  useEffect(() => {
    if (!lookup || !form) return;
    try {
      sessionStorage.setItem(draftKey(lookup, form.updatedAt), JSON.stringify(answers));
    } catch {
      /* cuota o modo privado */
    }
  }, [answers, lookup, form]);

  function validateClient(): string | null {
    if (!form) return 'Formulario no cargado';
    if (form.questions?.length) {
      for (const q of form.questions) {
        if (!q.required) continue;
        const v = answers[q.id];
        if (q.type === 'TEXT_OPEN') {
          if (typeof v !== 'string' || !v.trim()) {
            return `Completa: ${q.label}`;
          }
        } else if (q.type === 'SINGLE_SELECT') {
          if (typeof v !== 'string' || !v.trim()) {
            return `Selecciona una opción en: ${q.label}`;
          }
        } else if (q.type === 'MULTI_SELECT') {
          if (!Array.isArray(v) || v.length === 0) {
            return `Marca al menos una opción en: ${q.label}`;
          }
        }
      }
      return null;
    }
    if (form.schema?.fields) {
      for (const f of form.schema.fields) {
        if (!f.required) continue;
        const v = answers[f.id];
        const missing =
          v === undefined ||
          v === null ||
          (typeof v === 'string' && v.trim() === '') ||
          (f.type === 'boolean' && v !== true && v !== false);
        if (missing) {
          return `Completa: ${f.label}`;
        }
      }
    }
    return null;
  }

  function goLogin() {
    navigate('/login', { state: { from: location.pathname } });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lookup) return;
    setErr(null);
    const clientErr = validateClient();
    if (clientErr) {
      setErr(clientErr);
      return;
    }
    if (!user) {
      goLogin();
      return;
    }
    if (user.mustChangePassword) {
      setErr('Debes cambiar tu contraseña antes de enviar formularios.');
      navigate('/cambiar-clave', { state: { from: location.pathname } });
      return;
    }
    if (sessionInfo && !sessionInfo.canSubmit) {
      setErr('Ya enviaste tu respuesta para este formulario.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...answers };
      if (form?.schema?.fields) {
        for (const f of form.schema.fields) {
          if (f.type === 'number') {
            const v = payload[f.id];
            payload[f.id] = typeof v === 'string' && v !== '' ? Number(v) : v;
          }
        }
      }
      const res = await api<{ responseId: string; jikkopuntosGranted: number }>(
        `/forms/share/${encodeURIComponent(lookup)}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers: payload }),
        },
      );
      try {
        sessionStorage.removeItem(draftKey(lookup, form!.updatedAt));
      } catch {
        /* */
      }
      const pts = res.jikkopuntosGranted;
      setDone(
        pts > 0
          ? `Respuesta registrada correctamente. Se acreditaron ${pts} jikkopuntos en tu cuenta.`
          : 'Respuesta registrada correctamente.',
      );
      if (pts > 0) {
        bumpJikkopoints();
        void refreshMe();
      }
      if (user) {
        setSessionInfo({
          hasSubmitted: true,
          canSubmit: Boolean(form?.allowMultipleResponses),
          allowMultipleResponses: Boolean(form?.allowMultipleResponses),
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function toggleMulti(qid: string, optValue: string, checked: boolean) {
    setAnswers((prev) => {
      const cur = (prev[qid] as string[]) ?? [];
      const next = checked
        ? [...cur, optValue]
        : cur.filter((x) => x !== optValue);
      return { ...prev, [qid]: next };
    });
  }

  if (err && !form) {
    return (
      <div className="public-form-page">
        <header className="public-form-header">
          <Link to="/" className="public-form-brand">
            <span className="public-form-logo-mark" aria-hidden>
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="10" fill="#2563eb" />
                <path
                  d="M12 28V16l8-4 8 4v12M12 20l8 4 8-4M20 12v8"
                  stroke="#fff"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Jikkosoft
          </Link>
        </header>
        <main className="public-form-main">
          <div className="fm-respond-panel">
            <p className="error">{err}</p>
            <Link to="/" className="fm-link">
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    );
  }
  if (!form) {
    return (
      <div className="public-form-page">
        <header className="public-form-header">
          <span className="public-form-brand">
            <span className="public-form-logo-mark" aria-hidden>
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="10" fill="#2563eb" />
                <path
                  d="M12 28V16l8-4 8 4v12M12 20l8 4 8-4M20 12v8"
                  stroke="#fff"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Jikkosoft
          </span>
        </header>
        <main className="public-form-main">
          <div className="fm-respond-panel fm-respond-panel--loading">Cargando formulario…</div>
        </main>
      </div>
    );
  }

  const blockedByPassword = Boolean(user?.mustChangePassword);
  const showLoginCta = !user;
  const alreadyDone =
    sessionInfo?.hasSubmitted && !sessionInfo.canSubmit && !done;

  return (
    <div className="public-form-page">
      <header className="public-form-header">
        <Link to="/" className="public-form-brand">
          <span className="public-form-logo-mark" aria-hidden>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="#2563eb" />
              <path
                d="M12 28V16l8-4 8 4v12M12 20l8 4 8-4M20 12v8"
                stroke="#fff"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Jikkosoft
        </Link>
        <nav className="public-form-nav">
          {user ? (
            <>
              <span className="public-form-user muted small">
                {user.firstName} {user.lastName}
              </span>
              <Link to="/formularios">Mis formularios</Link>
            </>
          ) : (
            <button type="button" className="public-form-nav-login" onClick={goLogin}>
              Iniciar sesión para enviar
            </button>
          )}
        </nav>
      </header>

      <main className="public-form-main">
        <div className="fm-respond-panel">
          <h1 className="fm-respond-title">{form.title}</h1>
          {form.description && <p className="muted">{form.description}</p>}
          {form.pointsReward > 0 && (
            <p className="small muted">
              Los jikkopuntos se acreditan con sesión iniciada (una vez por formulario,
              salvo que RR.HH. permita varios envíos).
            </p>
          )}

          {showLoginCta && (
            <div className="fm-callout">
              <p>
                Puedes ver el formulario sin cuenta. Para <strong>enviar</strong> y sumar
                jikkopuntos inicia sesión con tu correo corporativo.
              </p>
            </div>
          )}

          {blockedByPassword && (
            <p className="error">
              Debes{' '}
              <Link to="/cambiar-clave" state={{ from: location.pathname }}>
                cambiar tu contraseña
              </Link>{' '}
              antes de enviar.
            </p>
          )}

          {alreadyDone && (
            <p className="success">
              Ya registramos tu respuesta para este formulario. Gracias por participar.
            </p>
          )}

          {done ? (
            <p className="success">{done}</p>
          ) : !alreadyDone ? (
            <form onSubmit={onSubmit} className="stack form-respond-fields">
              {form.questions?.map((q) => (
                <div key={q.id} className="fm-field-block field-block">
                  <p className="form-q-title">
                    {q.label}
                    {q.required ? ' *' : ''}
                  </p>
                  {q.helpText ? <p className="small muted">{q.helpText}</p> : null}
                  {q.type === 'TEXT_OPEN' && (
                    <textarea
                      className="input-touch"
                      value={(answers[q.id] as string) ?? ''}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                      rows={4}
                    />
                  )}
                  {q.type === 'SINGLE_SELECT' && (
                    <div className="stack">
                      {q.options.map((o) => (
                        <label key={o.id} className="inline checkbox touch-target">
                          <input
                            type="radio"
                            name={q.id}
                            value={o.value}
                            checked={(answers[q.id] as string) === o.value}
                            onChange={() =>
                              setAnswers((a) => ({ ...a, [q.id]: o.value }))
                            }
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'MULTI_SELECT' && (
                    <div className="stack">
                      {q.options.map((o) => {
                        const selected = ((answers[q.id] as string[]) ?? []).includes(
                          o.value,
                        );
                        return (
                          <label key={o.id} className="inline checkbox touch-target">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) =>
                                toggleMulti(q.id, o.value, e.target.checked)
                              }
                            />
                            {o.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {form.schema?.fields.map((f) => (
                <label key={f.id} className="fm-field-block field-block">
                  <span className="form-q-title">
                    {f.label}
                    {f.required ? ' *' : ''}
                  </span>
                  {f.type === 'text' && (
                    <input
                      className="input-touch"
                      value={(answers[f.id] as string) ?? ''}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [f.id]: e.target.value }))
                      }
                    />
                  )}
                  {f.type === 'textarea' && (
                    <textarea
                      className="input-touch"
                      value={(answers[f.id] as string) ?? ''}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [f.id]: e.target.value }))
                      }
                      rows={4}
                    />
                  )}
                  {f.type === 'number' && (
                    <input
                      type="number"
                      className="input-touch"
                      value={(answers[f.id] as string) ?? ''}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [f.id]: e.target.value }))
                      }
                    />
                  )}
                  {f.type === 'boolean' && (
                    <label className="inline checkbox touch-target">
                      <input
                        type="checkbox"
                        checked={Boolean(answers[f.id])}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [f.id]: e.target.checked }))
                        }
                      />
                      Sí
                    </label>
                  )}
                  {f.type === 'select' && (
                    <select
                      className="input-touch"
                      value={(answers[f.id] as string) ?? ''}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [f.id]: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ))}

              {err && <p className="error">{err}</p>}
              <div className="form-actions">
                {!user ? (
                  <button type="button" className="fm-btn-primary" onClick={goLogin}>
                    Iniciar sesión para enviar
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="fm-btn-primary"
                    disabled={busy || blockedByPassword}
                  >
                    {busy ? 'Enviando…' : 'Enviar respuesta'}
                  </button>
                )}
              </div>
            </form>
          ) : null}

          <p className="small muted fm-respond-footer-links" style={{ marginTop: '1.25rem' }}>
            <Link to="/" className="fm-link">
              Inicio
            </Link>
            {user ? (
              <>
                {' · '}
                <Link to="/formularios" className="fm-link">
                  Formularios
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </main>
    </div>
  );
}
