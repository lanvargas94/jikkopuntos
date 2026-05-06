import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/http';
import { useAuth } from '../auth/AuthContext';

type ProfileSection = 'personal' | 'education' | 'experience' | 'role';

const SECTION_LABELS: Record<ProfileSection, string> = {
  personal: 'Información personal',
  education: 'Educación',
  experience: 'Experiencia',
  role: 'Rol en Jikkosoft',
};

type ProfileSheet = {
  currentRole: {
    code: string;
    displayName: string;
    highlighted: boolean;
  };
  corporate: {
    corporateEmail: string;
    idNumber: string;
    idIssueDate: string;
  };
  employment?: {
    jobTitle: string | null;
    area: string | null;
    organizationalDepartment: string | null;
    organizationalDepartmentLabel: string | null;
    employmentStatus: string;
  };
  personal: {
    firstName: string;
    lastName: string;
    personalEmail: string | null;
    phoneMobile: string | null;
    phoneAlt: string | null;
    address: string | null;
    city: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyRelationship: string | null;
    eps: string | null;
    arl: string | null;
  };
  career: {
    professionalSummary: string | null;
    educationBackground: string | null;
    previousWorkExperience: string | null;
    skills: string | null;
    linkedInUrl: string | null;
    profilePhotoUrl: string | null;
  };
  profileUpdatedAt: string;
  fieldPolicy: { readOnly: string[]; editable: string[] };
};

function str(v: string | null | undefined) {
  return v ?? '';
}

function formatDocDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function skillPills(skills: string) {
  return skills
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function initials(first: string, last: string) {
  const a = (first[0] ?? '').toUpperCase();
  const b = (last[0] ?? '').toUpperCase();
  return `${a}${b}` || '?';
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconId({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <path d="M13 10h4M13 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a1 1 0 0 1-1 1C9.5 19 5 14.5 5 9a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.5 8.5h-3v12h3v-12zm-1.5-4.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5zm13 8.2v8.3h-3v-7.7c0-1.8-.7-2.8-2.1-2.8-1.2 0-1.9.8-2.2 1.6-.1.3-.1.7-.1 1.1v7.8h-3s0-12.6 0-13.9h3v2c.4-.7 1.5-1.7 3.6-1.7 2.6 0 4.8 1.7 4.8 5.4z" />
    </svg>
  );
}

function IconGradCap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 10L12 5 2 10l10 5 10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 11v6M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCamera({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconSave({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 3v4h6V3M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const FORM_ID = 'profile-collaborator-form';

export function Profile() {
  const { refreshMe, user } = useAuth();
  const isAdmin = user?.roleCode === 'ADMIN';
  const [sheet, setSheet] = useState<ProfileSheet | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [phoneMobile, setPhoneMobile] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [eps, setEps] = useState('');
  const [arl, setArl] = useState('');
  const [professionalSummary, setProfessionalSummary] = useState('');
  const [educationBackground, setEducationBackground] = useState('');
  const [previousWorkExperience, setPreviousWorkExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  function hydrate(data: ProfileSheet) {
    setSheet(data);
    setFirstName(data.personal.firstName);
    setLastName(data.personal.lastName);
    setPersonalEmail(str(data.personal.personalEmail));
    setPhoneMobile(str(data.personal.phoneMobile));
    setPhoneAlt(str(data.personal.phoneAlt));
    setAddress(str(data.personal.address));
    setCity(str(data.personal.city));
    setEmergencyContactName(str(data.personal.emergencyContactName));
    setEmergencyContactPhone(str(data.personal.emergencyContactPhone));
    setEmergencyRelationship(str(data.personal.emergencyRelationship));
    setEps(str(data.personal.eps));
    setArl(str(data.personal.arl));
    setProfessionalSummary(str(data.career.professionalSummary));
    setEducationBackground(str(data.career.educationBackground));
    setPreviousWorkExperience(str(data.career.previousWorkExperience));
    setSkills(str(data.career.skills));
    setLinkedInUrl(str(data.career.linkedInUrl));
    setProfilePhotoUrl(str(data.career.profilePhotoUrl));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<ProfileSheet>('/profile/me');
        if (cancelled) return;
        hydrate(data);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const body: Record<string, string | null> = {
        firstName,
        lastName,
        personalEmail: personalEmail.trim() || null,
        phoneMobile: phoneMobile.trim() || null,
        phoneAlt: phoneAlt.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        emergencyContactName: emergencyContactName.trim() || null,
        emergencyContactPhone: emergencyContactPhone.trim() || null,
        emergencyRelationship: emergencyRelationship.trim() || null,
        eps: eps.trim() || null,
        arl: arl.trim() || null,
      };
      if (!isAdmin) {
        body.professionalSummary = professionalSummary.trim() || null;
        body.educationBackground = educationBackground.trim() || null;
        body.previousWorkExperience = previousWorkExperience.trim() || null;
        body.skills = skills.trim() || null;
        body.linkedInUrl = linkedInUrl.trim() || null;
        body.profilePhotoUrl = profilePhotoUrl.trim() || null;
      }
      const updated = await api<ProfileSheet>('/profile/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      hydrate(updated);
      setMsg('Perfil actualizado correctamente');
      await refreshMe();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (!sheet) {
    return (
      <div className="fm-page profile-collab profile-collab--loading">
        <div className="profile-collab-card profile-collab-card--loading">{err ?? 'Cargando perfil…'}</div>
      </div>
    );
  }

  const employment = sheet.employment ?? {
    jobTitle: null,
    area: null,
    organizationalDepartment: null,
    organizationalDepartmentLabel: null,
    employmentStatus: 'ACTIVE',
  };

  const isActive = employment.employmentStatus === 'ACTIVE';
  const displayTitle = str(employment.jobTitle) || sheet.currentRole.displayName;
  const areaLabel = str(employment.area);
  const orgDeptLabel = str(employment.organizationalDepartmentLabel);
  const sedeLine = areaLabel
    ? areaLabel.toUpperCase().startsWith('SEDE')
      ? areaLabel.toUpperCase()
      : `SEDE ${areaLabel}`.toUpperCase()
    : '—';
  const linkedInDisplay = linkedInUrl.trim().replace(/^https?:\/\/(www\.)?/i, '') || '—';
  const pills = skillPills(skills);

  return (
    <div className="fm-page profile-collab">
      <form id={FORM_ID} onSubmit={onSave} className="profile-collab-form">
        <header className="profile-collab-header">
          <div className="profile-collab-header-main">
            <div className="profile-collab-avatar-wrap">
              {profilePhotoUrl.trim() ? (
                <img
                  className="profile-collab-avatar-img"
                  src={profilePhotoUrl.trim()}
                  alt=""
                />
              ) : (
                <div className="profile-collab-avatar-fallback" aria-hidden>
                  {initials(firstName, lastName)}
                </div>
              )}
              {!isAdmin ? (
                <button
                  type="button"
                  className="profile-collab-avatar-btn"
                  title="Editar URL de la foto"
                  onClick={() => document.getElementById('profile-photo-url')?.focus()}
                >
                  <IconCamera className="profile-collab-avatar-btn-icon" />
                  <span className="sr-only">Ir al campo URL de foto de perfil</span>
                </button>
              ) : null}
            </div>
            <div className="profile-collab-header-text">
              <h1 className="fm-title">
                {[firstName, lastName].filter(Boolean).join(' ') || 'Colaborador'}
              </h1>
              <p className="fm-subtitle profile-collab-header-email">{sheet.corporate.corporateEmail}</p>
              <div className="profile-collab-meta">
                <span className={`profile-collab-badge ${isActive ? 'is-on' : 'is-off'}`}>
                  {isActive ? 'ACTIVO' : 'INACTIVO'}
                </span>
                <span className="profile-collab-sede">{sedeLine}</span>
                {orgDeptLabel ? (
                  <span className="profile-collab-sede profile-collab-sede--dept">{orgDeptLabel}</span>
                ) : null}
              </div>
            </div>
          </div>
          <button type="submit" className="jp-btn jp-btn--primary profile-collab-save" disabled={busy}>
            <IconSave className="jp-btn-icon" aria-hidden />
            Guardar cambios
          </button>
        </header>

        <div className="profile-collab-info-note" role="note">
          <IconInfo className="profile-collab-info-note-icon" />
          <p>
            {isAdmin
              ? 'Como administrador solo puedes actualizar datos personales y de contacto. El resto de la hoja de vida no se muestra aquí; los colaboradores siguen teniendo el formulario completo.'
              : 'Los campos de identificación y datos corporativos son gestionados por RR.HH. y no pueden editarse desde el portal.'}
          </p>
        </div>

        {!isAdmin ? (
          <nav className="fm-tabs" role="tablist" aria-label="Secciones del perfil">
            {(Object.keys(SECTION_LABELS) as ProfileSection[]).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`profile-tab-${id}`}
                aria-selected={activeSection === id}
                aria-controls="profile-collab-panel"
                className={`fm-tab${activeSection === id ? ' is-active' : ''}`}
                onClick={() => setActiveSection(id)}
              >
                {SECTION_LABELS[id]}
              </button>
            ))}
          </nav>
        ) : null}

        <div
          id={!isAdmin ? 'profile-collab-panel' : undefined}
          role={!isAdmin ? 'tabpanel' : undefined}
          aria-labelledby={!isAdmin ? `profile-tab-${activeSection}` : undefined}
        >
        {isAdmin || activeSection === 'personal' ? (
        <div
          className={`profile-collab-grid-3${isAdmin ? ' profile-collab-grid-3--admin-solo' : ''}`}
        >
          <section className="profile-collab-card profile-collab-section">
            <h3 className="profile-collab-section-title">
              <IconPerson className="profile-collab-section-icon" />
              Información personal
            </h3>
            <div className="profile-collab-name-grid">
              <label className="profile-collab-field">
                <span className="profile-collab-label">Nombres</span>
                <span className="profile-collab-input-shell">
                  <IconPerson className="profile-collab-input-icon" />
                  <input
                    className="profile-collab-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                </span>
              </label>
              <label className="profile-collab-field">
                <span className="profile-collab-label">Apellidos</span>
                <span className="profile-collab-input-shell">
                  <IconPerson className="profile-collab-input-icon" />
                  <input
                    className="profile-collab-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </span>
              </label>
            </div>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Número de identificación</span>
              <span className="profile-collab-input-shell is-readonly">
                <IconId className="profile-collab-input-icon" />
                <input className="profile-collab-input" value={sheet.corporate.idNumber} readOnly />
                <IconLock className="profile-collab-input-suffix" />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">EPS (Entidad Promotora de Salud)</span>
              <span className="profile-collab-input-shell">
                <IconPerson className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={eps}
                  onChange={(e) => setEps(e.target.value)}
                  placeholder="Ej. Sura EPS, Sanitas…"
                  autoComplete="off"
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">ARL (riesgos laborales)</span>
              <span className="profile-collab-input-shell">
                <IconShield className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={arl}
                  onChange={(e) => setArl(e.target.value)}
                  placeholder="Ej. Positiva, Colmena…"
                  autoComplete="off"
                />
              </span>
            </label>
          </section>
        </div>
        ) : null}

        {!isAdmin && activeSection === 'education' ? (
          <section className="profile-collab-card profile-collab-section profile-collab-section--full">
            <h3 className="profile-collab-section-title">
              <IconGradCap className="profile-collab-section-icon" />
              Educación
            </h3>
            <p className="profile-collab-hint subtle">
              Formación académica, certificaciones y estudios relevantes.
            </p>
            <textarea
              className="profile-collab-textarea-muted"
              value={educationBackground}
              onChange={(e) => setEducationBackground(e.target.value)}
              rows={10}
              placeholder="Ej. Ingeniería de Sistemas — Universidad…"
            />
          </section>
        ) : null}

        {!isAdmin && activeSection === 'experience' ? (
          <section className="profile-collab-card profile-collab-section profile-collab-section--full">
            <h3 className="profile-collab-section-title">
              <IconClock className="profile-collab-section-icon" />
              Experiencia
            </h3>
            <p className="profile-collab-hint subtle">Experiencia laboral previa y logros destacados.</p>
            <textarea
              className="profile-collab-textarea-muted"
              value={previousWorkExperience}
              onChange={(e) => setPreviousWorkExperience(e.target.value)}
              rows={10}
              placeholder="Resumen de experiencia laboral relevante…"
            />
          </section>
        ) : null}

        {!isAdmin && activeSection === 'role' ? (
          <>
            <section className="profile-collab-card profile-collab-section profile-collab-section--full">
              <h3 className="profile-collab-section-title">
                <IconBriefcase className="profile-collab-section-icon" />
                Rol en Jikkosoft
              </h3>
              <p className="profile-collab-hint subtle">
                Estos datos los define RR.HH. Si hay un error, contacta a talento humano.
              </p>
              <div className="profile-collab-readonly-grid">
                <div>
                  <span className="profile-collab-label">Cargo</span>
                  <p className="profile-collab-readonly-value">{displayTitle || '—'}</p>
                </div>
                <div>
                  <span className="profile-collab-label">Departamento</span>
                  <p className="profile-collab-readonly-value">{orgDeptLabel || '—'}</p>
                </div>
                <div>
                  <span className="profile-collab-label">Área / sede</span>
                  <p className="profile-collab-readonly-value">{areaLabel || '—'}</p>
                </div>
                <div>
                  <span className="profile-collab-label">Rol en el sistema</span>
                  <p className="profile-collab-readonly-value">
                    <code>{sheet.currentRole.code}</code> — {sheet.currentRole.displayName}
                  </p>
                </div>
                <div>
                  <span className="profile-collab-label">Documento expedido</span>
                  <p className="profile-collab-readonly-value">{formatDocDate(sheet.corporate.idIssueDate)}</p>
                </div>
              </div>
            </section>

            <section className="profile-collab-card profile-collab-section profile-collab-section--full">
              <h3 className="profile-collab-section-title profile-collab-section-title--caps">
                <IconPerson className="profile-collab-section-icon" />
                Perfil profesional
              </h3>
              <p className="profile-collab-hint subtle">
                Resumen, habilidades y enlaces visibles internamente según las políticas del portal.
              </p>
              <label className="profile-collab-field">
                <span className="profile-collab-label">LinkedIn</span>
                <span className="profile-collab-input-shell">
                  <IconLinkedIn className="profile-collab-input-icon profile-collab-input-icon--linkedin" />
                  <input
                    className="profile-collab-input"
                    type="url"
                    value={linkedInUrl}
                    onChange={(e) => setLinkedInUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/…"
                  />
                </span>
              </label>
              {linkedInUrl.trim() ? (
                <p className="profile-collab-hint subtle">Enlace visible: {linkedInDisplay}</p>
              ) : null}
              <label className="profile-collab-field">
                <span className="profile-collab-label">Resumen profesional</span>
                <textarea
                  className="profile-collab-textarea"
                  value={professionalSummary}
                  onChange={(e) => setProfessionalSummary(e.target.value)}
                  rows={4}
                  placeholder="Liderazgo técnico, responsabilidades y enfoque en el rol…"
                />
              </label>
              <label className="profile-collab-field">
                <span className="profile-collab-label">Habilidades técnicas (separadas por comas)</span>
                <textarea
                  className="profile-collab-textarea"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  rows={4}
                  placeholder="React, TypeScript, Tailwind, Node.js"
                />
              </label>
              {pills.length > 0 ? (
                <div className="profile-collab-tags" aria-label="Habilidades">
                  {pills.map((p) => (
                    <span key={p} className="profile-collab-tag">
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
              <label className="profile-collab-field">
                <span className="profile-collab-label">Foto de perfil (URL pública)</span>
                <input
                  id="profile-photo-url"
                  className="profile-collab-plain-input"
                  type="url"
                  value={profilePhotoUrl}
                  onChange={(e) => setProfilePhotoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
            </section>
          </>
        ) : null}

        {isAdmin || activeSection === 'personal' ? (
          <>
            <div className="profile-collab-grid-2 profile-collab-grid-2--admin-solo">
          <section className="profile-collab-card profile-collab-section">
            <h3 className="profile-collab-section-title profile-collab-section-title--caps">
              <IconPhone className="profile-collab-section-icon" />
              Contacto
            </h3>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Correo corporativo</span>
              <span className="profile-collab-input-shell is-readonly">
                <IconMail className="profile-collab-input-icon" />
                <input className="profile-collab-input" value={sheet.corporate.corporateEmail} readOnly />
                <IconLock className="profile-collab-input-suffix" />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Correo personal</span>
              <span className="profile-collab-input-shell">
                <IconMail className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="opcional"
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Teléfono móvil</span>
              <span className="profile-collab-input-shell">
                <IconPhone className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={phoneMobile}
                  onChange={(e) => setPhoneMobile(e.target.value)}
                  placeholder="+57…"
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Teléfono alterno</span>
              <span className="profile-collab-input-shell">
                <IconPhone className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={phoneAlt}
                  onChange={(e) => setPhoneAlt(e.target.value)}
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Dirección de residencia</span>
              <span className="profile-collab-input-shell">
                <IconPin className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, barrio…"
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Ciudad</span>
              <span className="profile-collab-input-shell">
                <IconPin className="profile-collab-input-icon" />
                <input className="profile-collab-input" value={city} onChange={(e) => setCity(e.target.value)} />
              </span>
            </label>
          </section>
        </div>

        <section className="profile-collab-card profile-collab-section">
          <h3 className="profile-collab-section-title profile-collab-section-title--caps">
            <IconInfo className="profile-collab-section-icon" />
            Contacto de emergencia
          </h3>
          <div className="profile-collab-grid-3 profile-collab-grid-3--tight">
            <label className="profile-collab-field">
              <span className="profile-collab-label">Nombre completo</span>
              <span className="profile-collab-input-shell">
                <IconPerson className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Parentesco</span>
              <span className="profile-collab-input-shell">
                <IconPerson className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                />
              </span>
            </label>
            <label className="profile-collab-field">
              <span className="profile-collab-label">Teléfono</span>
              <span className="profile-collab-input-shell">
                <IconPhone className="profile-collab-input-icon" />
                <input
                  className="profile-collab-input"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                />
              </span>
            </label>
          </div>
        </section>
        </>
        ) : null}

        </div>

        <div className="profile-collab-privacy" role="region" aria-label="Privacidad de datos">
          <div className="profile-collab-privacy-icon-wrap" aria-hidden>
            <IconShield className="profile-collab-privacy-icon" />
          </div>
          <div className="profile-collab-privacy-text">
            <p className="profile-collab-privacy-title">Privacidad de datos</p>
            <p className="profile-collab-privacy-desc">
              Tu información está protegida bajo las políticas de Jikkosoft.
            </p>
          </div>
          <a className="profile-collab-privacy-link" href="#" onClick={(e) => e.preventDefault()}>
            Ver políticas
          </a>
        </div>

        <footer className="profile-collab-footer">
          <p className="small muted">
            Última actualización del perfil: {new Date(sheet.profileUpdatedAt).toLocaleString('es-CO')}
          </p>
          {msg ? <p className="success">{msg}</p> : null}
          {err ? <p className="error">{err}</p> : null}
          <button
            type="submit"
            className="jp-btn jp-btn--primary profile-collab-save profile-collab-save--footer"
            disabled={busy}
          >
            <IconSave className="jp-btn-icon" aria-hidden />
            Guardar cambios
          </button>
        </footer>
      </form>
    </div>
  );
}
