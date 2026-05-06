import type { Request } from 'express';

export type AuditRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

/** Extrae IP y UA para filas de auditoría (detrás de proxy usar trust proxy en Express). */
export function auditContextFromRequest(req: Request): AuditRequestContext {
  const xf = req.headers['x-forwarded-for'];
  const forwarded =
    typeof xf === 'string' ? xf.split(',')[0]?.trim() : undefined;
  const ip =
    forwarded ||
    req.ip ||
    req.socket?.remoteAddress ||
    undefined;
  const ua = req.headers['user-agent'];
  return {
    ip: ip ?? null,
    userAgent: typeof ua === 'string' ? ua : null,
  };
}
