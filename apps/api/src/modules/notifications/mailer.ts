import type { Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol('MAILER');

type Env = (key: string) => string | undefined;

/**
 * SMTP-транспорт, якщо задано SMTP_HOST (локально — Mailhog :1025), інакше лише лог:
 * так dev і тести не залежать від поштового сервера, а листи не губляться мовчки.
 */
export function createMailer(env: Env, logger: Pick<Logger, 'log'>): Mailer {
  const from = env('EMAIL_FROM') || 'VOLTSTAR <noreply@voltstar.local>';
  const host = env('SMTP_HOST');
  if (!host) {
    return {
      async send(m) {
        logger.log(`[mail:log] to=${m.to} subject="${m.subject}" attachments=${m.attachments?.length ?? 0}`);
      },
    };
  }

  const port = Number(env('SMTP_PORT') || 587);
  const user = env('SMTP_USER');
  const transport = createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: env('SMTP_PASSWORD') ?? '' } : undefined,
  });
  return {
    async send(m) {
      await transport.sendMail({ from, ...m });
    },
  };
}
