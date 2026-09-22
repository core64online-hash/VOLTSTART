import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: потрібні сирі байти тіла для перевірки підписів платіжних вебхуків.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const origins = (process.env.API_CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  // Content-Disposition — щоб web міг прочитати імʼя PDF-файлу при завантаженні документів.
  app.enableCors({ origin: origins, credentials: true, exposedHeaders: ['Content-Disposition'] });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('VOLTSTAR API')
    .setDescription('API платформи підбору й продажу генераторів (B2C/B2B/B2G)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`VOLTSTAR API → http://localhost:${port}/api (docs: /docs)`);
}

void bootstrap();
