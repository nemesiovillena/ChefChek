import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Response compression
  app.use(compression());

  // Cookie parser for Lucia Auth sessions
  app.use(cookieParser());

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

  // API prefix
  app.setGlobalPrefix("api");

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
          bearerFormat: "JWT",
          name: "JWT",
          description: "Enter JWT token",
          in: "header",
        },
        "JWT-auth",
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
  console.log(`Backend ChefChek corriendo en http://localhost:${port}`);
}
bootstrap();
