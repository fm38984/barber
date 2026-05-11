import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  app.useLogger(app.get(Logger));

  app.use(helmet({
    contentSecurityPolicy: process.env['NODE_ENV'] === 'production',
  }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: [
      process.env['DASHBOARD_URL'] ?? 'http://localhost:3000',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}

bootstrap();
