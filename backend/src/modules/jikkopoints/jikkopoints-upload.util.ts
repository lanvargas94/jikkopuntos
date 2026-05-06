import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const SUBDIR = 'jikkopoints-redemptions';

export function redeemRestMulterStorage() {
  const dest = join(process.cwd(), 'uploads', SUBDIR);
  return diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(dest)) {
        mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname) || '.dat'}`);
    },
  });
}

export function redeemAttachmentRelativePath(filename: string): string {
  return `${SUBDIR}/${filename}`.replace(/\\/g, '/');
}

const BENEFIT_SUBDIR = 'benefit-redemptions';

export function benefitRedeemMulterStorage() {
  const dest = join(process.cwd(), 'uploads', BENEFIT_SUBDIR);
  return diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(dest)) {
        mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname) || '.pdf'}`);
    },
  });
}

export function benefitAttachmentRelativePath(filename: string): string {
  return `${BENEFIT_SUBDIR}/${filename}`.replace(/\\/g, '/');
}
