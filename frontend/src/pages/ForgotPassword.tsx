import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiPublicJson } from '../api/http';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiPublicJson<{ ok: boolean }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
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
            <h2 className="login-welcome">Recuperar contraseña</h2>
            <p className="login-welcome-sub">
              Indica tu correo corporativo. Si existe una cuenta activa, enviaremos un enlace para
              elegir una nueva contraseña.
            </p>

            {!sent ? (
              <div className="login-field">
                <label className="login-label" htmlFor="forgot-email">
                  Correo corporativo
                </label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="login-input-standalone"
                  placeholder="nombre@jikkosoft.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="login-notice" role="status">
                <p style={{ margin: 0 }}>
                  Si tu correo está registrado y la cuenta está activa, revisa tu bandeja (y spam)
                  para continuar.
                </p>
              </div>
            )}

            {err ? <p className="login-error">{err}</p> : null}

            {!sent ? (
              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar enlace'}
              </button>
            ) : null}

            <p className="login-welcome-sub" style={{ marginTop: '1.25rem' }}>
              <Link to="/login" className="login-link">
                ← Volver al inicio de sesión
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
