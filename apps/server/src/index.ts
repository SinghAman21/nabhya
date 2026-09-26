import "reflect-metadata";
import { env } from "@nabhya/env/server";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { GlobalExceptionFilter } from "./common/filters";
import { ResponseTransformInterceptor } from "./common/interceptors";

type CorsCallback = (err: Error | null, allow?: boolean) => void;

async function bootstrap() {
	// rawBody is required by the payment webhook: its signature is computed over
	// the exact bytes sent, so a re-serialised JSON body would never verify.
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		rawBody: true,
	});

	// Global prefix for all routes - e.g. /api/users/me
	app.setGlobalPrefix("api");

	// Behind a load balancer the socket address is the proxy's, and without
	// this every request looks like one client, throttling the entire user
	// base together. But the inverse trap is just as real: turned on with no
	// proxy actually in front - true of every local/LAN dev run - it has the
	// same effect for the opposite reason, trusting a forwarded-for chain
	// nothing is providing. Only turn it on where `Deploying` in AGENTS.md
	// says a load balancer is assumed.
	if (env.NODE_ENV === "production") app.set("trust proxy", 1);

	// Give in-flight requests a chance to finish on SIGTERM instead of dropping
	// them mid-transaction during a rolling deploy.
	app.enableShutdownHooks();

	// CORS_ORIGIN is documented as comma-separated, but passing the raw string
	// through emits it verbatim as Access-Control-Allow-Origin - a header that
	// may name at most one origin, so browsers reject it and every cross-origin
	// request fails. Split it so cors() echoes back just the matching origin.
	const allowedOrigins = env.CORS_ORIGIN.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
	const isDevelopment = env.NODE_ENV !== "production";
	const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

	app.enableCors({
		origin: (origin: string | undefined, callback: CorsCallback) => {
			// Native apps, curl and server-to-server calls send no Origin header;
			// CORS only governs browsers, so there is nothing to check.
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) return callback(null, true);
			// Expo's dev server takes whatever port is free - 8081, then 8082,
			// then 8083 - so pinning one in CORS_ORIGIN silently breaks the web
			// client every time it moves. Any localhost port is fine in dev;
			// production stays restricted to the configured list.
			if (isDevelopment && LOCALHOST.test(origin)) return callback(null, true);
			return callback(null, false);
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});

	// Global exception filter - consistent error shape
	app.useGlobalFilters(new GlobalExceptionFilter());

	// Global response envelope - wraps all success responses in { success, data, timestamp }
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
