import "reflect-metadata";
import { env } from "@nabhya/env/server";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { GlobalExceptionFilter } from "./common/filters";
import { ResponseTransformInterceptor } from "./common/interceptors";

async function bootstrap() {
	// rawBody is required by the payment webhook: its signature is computed over
	// the exact bytes sent, so a re-serialised JSON body would never verify.
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		rawBody: true,
	});

	// Global prefix for all routes — e.g. /api/users/me
	app.setGlobalPrefix("api");

	// Behind a load balancer the socket address is the proxy's. Without this
	// every request looks like one client and rate limiting would throttle the
	// entire user base together.
	app.set("trust proxy", 1);

	// Give in-flight requests a chance to finish on SIGTERM instead of dropping
	// them mid-transaction during a rolling deploy.
	app.enableShutdownHooks();

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
