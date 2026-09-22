import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const rootEnvPath = resolve(process.cwd(), '../../.env');
const localEnvPath = resolve(process.cwd(), '.env');

loadEnv({ path: existsSync(rootEnvPath) ? rootEnvPath : localEnvPath });

function configuredOrigins() {
  const values = [process.env.WEB_APP_URL, process.env.ADMIN_APP_URL]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [...new Set(values)];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = configuredOrigins();

  app.enableCors({
    origin: origins,
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Amanat Deal API')
    .setDescription('API-first MVP for protected deal workflows with mock escrow.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
