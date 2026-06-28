import "reflect-metadata";
import { env } from "@nabhya/env/server";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { GlobalExceptionFilter } from "./common/filters";
import { ResponseTransformInterceptor } from "./common/interceptors";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Global prefix for all routes — e.g. /api/auth/login
	app.setGlobalPrefix("api");

	app.enableCors({
		origin: env.CORS_ORIGIN,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});

	// Global exception filter — consistent error shape
	app.useGlobalFilters(new GlobalExceptionFilter());

	// Global response envelope — wraps all success responses in { success, data, timestamp }
	app.useGlobalInterceptors(new ResponseTransformInterceptor());

	// ─── Swagger / OpenAPI ────────────────────────────────────────────────────
	const swaggerConfig = new DocumentBuilder()
		.setTitle("Nabhya API")
		.setDescription(
			"Interactive REST API documentation for the Nabhya backend. " +
				"Use the Authorize button to supply a Bearer token for protected routes.",
		)
		.setVersion("1.0")
		.addBearerAuth(
			{ type: "http", scheme: "bearer", bearerFormat: "JWT" },
			"access-token", // reference name used by @ApiBearerAuth()
		)
		.build();

	const document = SwaggerModule.createDocument(app, swaggerConfig);
	// Swagger UI lives at /api/docs (distinct from the /api route prefix)
	SwaggerModule.setup("api/docs", app, document, {
		swaggerOptions: {
			persistAuthorization: true, // keeps the token across page refreshes
			tagsSorter: "alpha",
			operationsSorter: "alpha",
		},
		customSiteTitle: "Nabhya API Docs",
	});

	await app.listen(3000);
	console.log("Server running on http://localhost:3000/api");
	console.log("Swagger UI   → http://localhost:3000/api/docs");
}

bootstrap();
