import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPublicJson } from '../api/http';
import { PASSWORD_POLICY_HINT } from '../auth/passwordPolicy';

export function ResetPassword() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (search.get('token') ?? '').trim(), [search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const tokenOk = /^[a-f0-9]{64}$/i.test(token);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!tokenOk) {
      setErr('El enlace no es válido. Solicita uno nuevo desde «Olvidé mi contraseña».');
      return;
    }
    setBusy(true);
    try {
      await apiPublicJson<{ ok: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword: password,
          confirmNewPassword: confirm,
        }),
      });
      setOk(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-brand" aria-label="Marca Jikkosoft">
        <div className="login-brand-inner">
          <div className="login-brand-header">
            <div className="login-logo-mark" aria-hidden>
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
            </div>
            <span className="login-brand-name">Jikkosoft</span>
          </div>
        </div>
      </aside>
      <main className="login-main">
        <div className="login-main-inner">
          <form className="login-form" onSubmit={onSubmit} noValidate>
            <h2 className="login-welcome">Nueva contraseña</h2>
            <p className="login-welcome-sub muted small" style={{ marginBottom: '0.75rem' }}>
              {PASSWORD_POLICY_HINT}
            </p>

            {!tokenOk ? (
              <p className="login-error">
                Falta un enlace válido. Abre el enlace del correo o solicita uno nuevo.
              </p>
            ) : null}

            <div className="login-field">
              <label className="login-label" htmlFor="reset-pass">
                Nueva contraseña
              </label>
              <input
                id="reset-pass"
                type="password"
                autoComplete="new-password"
                className="login-input-standalone"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
                disabled={!tokenOk || ok}
              />
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="reset-confirm">
                Confirmar contraseña
              </label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                className="login-input-standalone"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={12}
                required
                disabled={!tokenOk || ok}
              />
            </div>

            {err ? <p className="login-error">{err}</p> : null}
            {ok ? (
              <p className="login-notice" role="status">
                Contraseña actualizada. Redirigiendo al inicio de sesión…
              </p>
            ) : null}

            <button
              type="submit"
              className="login-submit"
              disabled={busy || !tokenOk || ok}
            >
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>

            <p className="login-welcome-sub" style={{ marginTop: '1.25rem' }}>
              <Link to="/login" className="login-link">
                ← Inicio de sesión
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
