import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { AppLogger } from "./common/logger/logger.service";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);

  // Security headers with Content-Security-Policy
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    }),
  );

  // Response compression
  app.use(compression());

  // Cookie parser for Lucia Auth sessions
  app.use(cookieParser());

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" });

  // Request ID middleware
  app.use(
    new RequestIdMiddleware(logger).use.bind(new RequestIdMiddleware(logger)),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:3001"];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // API prefix included in controllers
  // app.setGlobalPrefix('api');

  // Health check (before prefix)
  app.use("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Swagger - disable in production
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("ChefChek API")
      .setDescription(
        "API completa para gestión SaaS multi-tenant de cocinas profesionales.",
      )
      .setVersion("0.1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Lucía Session ID",
          name: "Lucía Auth",
          description: "Enter Lucía session ID",
          in: "header",
        },
        "Lucía-auth",
      )
      .addTag("Tenants", "Gestión de tenants multi-tenant")
      .addTag("Auth", "Autenticación y gestión de sesiones")
      .addTag("Users", "Gestión de usuarios")
      .addTag("Products", "Gestión de productos e ingredientes")
      .addTag("Recipes", "Gestión de recetas y escandallos")
      .addTag("Menus", "Gestión de menús y cartas")
      .addTag("TechnicalSheets", "Fichas técnicas parametrizadas")
      .addTag("Production", "Control de producción y recetas")
      .addTag("Appcc", "Sistema APPCC y control sanitario")
      .addTag("Allergens", "Gestión de alérgenos (UE 1169/2011)")
      .addTag("Orders", "Gestión de pedidos")
      .addTag("Almacenes", "Gestión de almacenes, stock e inventarios")
      .addTag("Conocimiento", "Wiki de procedimientos operativos")
      .addTag("DigitalMenu", "Cartas digitales QR y analytics")
      .addTag("Dashboard", "KPIs, métricas y alertas")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Backend ChefChek corriendo en http://localhost:${port}`);
}
bootstrap();
