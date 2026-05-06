import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');

  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );
  /** CORS: FRONTEND_ORIGIN puede listar varias URLs separadas por coma. */
  const corsFromEnv = process.env.FRONTEND_ORIGIN?.trim();
  const fromEnv = corsFromEnv?.length
    ? corsFromEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const devLocal = ['http://localhost:5173', 'http://localhost:8080'];
  const isProd = process.env.NODE_ENV === 'production';
  let corsOrigin: string | string[];
  if (isProd) {
    corsOrigin = fromEnv.length > 0 ? fromEnv : devLocal;
    if (!fromEnv.length) {
      logger.warn(
        'FRONTEND_ORIGIN vacío en NODE_ENV=production; usando localhost como CORS (configura FRONTEND_ORIGIN).',
      );
    }
  } else {
    corsOrigin = [...new Set([...fromEnv, ...devLocal])];
  }
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  if (process.env.SWAGGER_DISABLED !== '1') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Jikko API')
      .setDescription(
        'MVP: autenticación, colaboradores, perfil, formularios y jikkopuntos. Ver también docs/API.md en el repositorio.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Documentación OpenAPI: /api/docs');
  }

  const parsed = parseInt(process.env.PORT ?? '4000', 10);
  const port = Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`API en http://localhost:${port}/api (escuchando en 0.0.0.0:${port})`);
}
bootstrap();
