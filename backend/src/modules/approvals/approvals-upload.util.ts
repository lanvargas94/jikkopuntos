import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const SUBDIR = 'hr-medical-leaves';

export function medicalLeaveMulterStorage() {
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

export function medicalLeaveAttachmentRelativePath(filename: string): string {
  return `${SUBDIR}/${filename}`.replace(/\\/g, '/');
}
