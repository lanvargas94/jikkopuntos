import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { resolvePostLoginPath } from '../auth/landing';

function LogoMark({ className }: { className?: string }) {
  return (
    <div className={`login-logo-mark ${className ?? ''}`} aria-hidden>
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
  );
}

function IconMail() {
  return (
    <svg className="login-field-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16v10H4V7zm0 0l8 5 8-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="login-field-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg className="login-notice-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 10v5M12 8h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg className="login-btn-arrow" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14m-4-5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Login() {
  const { login, user, bootstrapped } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bootstrapped || !user) return;
    navigate(resolvePostLoginPath(from, user.roleCode), { replace: true });
  }, [bootstrapped, user, from, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(resolvePostLoginPath(from, u.roleCode), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-brand" aria-label="Marca Jikkosoft">
        <div className="login-brand-inner">
          <div className="login-brand-header">
            <LogoMark />
            <span className="login-brand-name">Jikkosoft</span>
          </div>
          <div className="login-brand-hero">
            <h1 className="login-brand-title">
              <span className="login-brand-title-line">Portal del</span>{' '}
              <span className="login-brand-title-accent">Colaborador</span>
            </h1>
            <p className="login-brand-tagline">
              Gestiona tu talento, accede a beneficios y mantente conectado con la
              cultura Jikkosoft desde un solo lugar.
            </p>
          </div>
          <p className="login-brand-footer">
            <span aria-hidden>🛡️</span> Acceso seguro · © {new Date().getFullYear()}{' '}
            Jikkosoft Inc.
          </p>
        </div>
      </aside>

      <main className="login-main">
        <div className="login-main-inner">
          <header className="login-main-header login-main-header--mobile">
            <div className="login-brand-header login-brand-header--compact">
              <LogoMark />
              <span className="login-brand-name login-brand-name--dark">Jikkosoft</span>
            </div>
          </header>

          <form className="login-form" onSubmit={onSubmit} noValidate>
            <h2 className="login-welcome">Bienvenido</h2>
            <p className="login-welcome-sub">Ingresa tus credenciales para continuar.</p>

            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Correo corporativo
              </label>
              <div className="login-input-wrap">
                <IconMail />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="nombre@jikkosoft.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label" htmlFor="login-password">
                  Contraseña
                </label>
                <Link to="/recuperar-clave" className="login-link-muted">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="login-input-wrap">
                <IconLock />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-notice" role="note">
              <IconInfo />
              <p>
                <strong>Nota:</strong> Si es tu primer ingreso, utiliza la contraseña
                temporal enviada a tu correo personal y cámbiala inmediatamente.
              </p>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Iniciar sesión'}
              {!busy && <IconArrowRight />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
