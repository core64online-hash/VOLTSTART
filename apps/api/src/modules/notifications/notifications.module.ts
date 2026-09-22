import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsModule } from '../documents/documents.module';
import { createMailer, MAILER } from './mailer';
import { NotificationsService } from './notifications.service';
import { createTelegram, TELEGRAM } from './telegram';

// Phase 4: email (SMTP / лог) і Telegram-сповіщення, шаблони листів.
@Module({
  imports: [DocumentsModule],
  providers: [
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createMailer((k) => config.get<string>(k), new Logger('Mailer')),
    },
    {
      provide: TELEGRAM,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createTelegram((k) => config.get<string>(k)),
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
