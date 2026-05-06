import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setRefreshToken, setStoredToken } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { defaultLandingForRole } from '../auth/landing';
import { PASSWORD_POLICY_HINT } from '../auth/passwordPolicy';

function IconShieldLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="9.5" y="10" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 12.5v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ChangePassword() {
  const { refreshMe, user, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const forced = user?.mustChangePassword === true;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== confirm) {
      setErr('La confirmación no coincide con la nueva contraseña');
      return;
    }
    setBusy(true);
    try {
      const role = user?.roleCode ?? 'COLLABORATOR';
      const res = await api<{
        ok: boolean;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          confirmNewPassword: confirm,
        }),
      });
      if (res.accessToken && res.refreshToken) {
        setStoredToken(res.accessToken);
        setRefreshToken(res.refreshToken);
      }
      setOk(true);
      await refreshMe();
      setCurrent('');
      setNext('');
      setConfirm('');
      if (forced) {
        navigate(defaultLandingForRole(role), { replace: true });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fm-page sec-page">
      <header className="fm-head">
        <div className="fm-head-icon-wrap" aria-hidden>
          <IconShieldLock className="fm-head-icon" />
        </div>
        <div>
          <h1 className="fm-title">Seguridad</h1>
          <p className="fm-subtitle">
            {forced ? (
              <>
                Por política de la organización debes <strong>actualizar tu contraseña</strong> antes de
                continuar usando el portal.
              </>
            ) : (
              <>
                Actualiza tu contraseña de acceso. Tras guardar, las sesiones anteriores se cierran por
                seguridad.
              </>
            )}
          </p>
        </div>
      </header>

      <section className="fm-panel sec-panel">
        <h2 className="sec-panel-title">Cambiar contraseña</h2>
        <p className="sec-policy" role="note">
          {PASSWORD_POLICY_HINT}
        </p>
        <form onSubmit={onSubmit} className="sec-form">
          <label className="jp-modal-field">
            <span>Contraseña actual</span>
            <input
              type="password"
              autoComplete="current-password"
              className="jp-admin-redeem-input sec-input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </label>
          <label className="jp-modal-field">
            <span>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              className="jp-admin-redeem-input sec-input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label className="jp-modal-field">
            <span>Confirmar nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              className="jp-admin-redeem-input sec-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          {err ? <p className="error sec-form-err">{err}</p> : null}
          {ok ? (
            <p className="success sec-form-success">Contraseña actualizada. Sesiones anteriores cerradas.</p>
          ) : null}
          <div className="sec-form-actions">
            <button type="submit" className="jp-btn jp-btn--primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
            <button
              type="button"
              className="fm-btn-secondary"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  await logout();
                  navigate('/login');
                })();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
