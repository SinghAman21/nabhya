import "reflect-metadata";
import { env } from "@my-better-t-app/env/server";
import { NestFactory } from "@nestjs/core";
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

	await app.listen(3000);
	console.log("Server running on http://localhost:3000/api");
}

bootstrap();
