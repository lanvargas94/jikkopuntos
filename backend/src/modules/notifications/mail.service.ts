import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.log.warn('SMTP_HOST no configurado: el correo saliente está desactivado.');
      return;
    }
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        user && pass
          ? { user, pass }
          : undefined,
    });
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      return;
    }
    const from =
      this.config.get<string>('SMTP_FROM')?.trim() ?? 'noreply@jikkosoft.local';
    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
      });
    } catch (e) {
      this.log.warn(`No se pudo enviar correo a ${to}: ${e}`);
    }
  }
}
