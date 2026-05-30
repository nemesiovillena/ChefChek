import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración CORS para Next.js frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  // Prefix global para la API
  app.setGlobalPrefix('api');

  await app.listen(3001);
  console.log('🚀 Backend ChefChek corriendo en http://localhost:3001');
}
bootstrap();