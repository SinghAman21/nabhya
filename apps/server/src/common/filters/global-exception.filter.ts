import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorBody {
	statusCode: number;
	timestamp: string;
	path: string;
	message: string;
	/** Field-level validation failures, keyed by field name. */
	errors?: Record<string, string[]>;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(GlobalExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const status =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		const payload =
			exception instanceof HttpException
				? exception.getResponse()
				: "Internal server error";

		// A 4xx is the client being told "no", which is expected traffic. Logging
		// a stack trace for every failed validation buries the 5xx that actually
		// need attention.
		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			this.logger.error(
				`[${request.method}] ${request.url} → ${status}`,
				exception instanceof Error ? exception.stack : String(exception),
			);
		} else {
			this.logger.warn(`[${request.method}] ${request.url} → ${status}`);
		}

		const body: ErrorBody = {
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			message: extractMessage(payload, status),
		};

		// ZodValidationPipe attaches per-field errors. Dropping them leaves the
		// client with "Validation failed" and no way to mark the offending input,
		// so they are forwarded verbatim.
		const errors = extractFieldErrors(payload);
		if (errors) body.errors = errors;

		response.status(status).json(body);
	}
}

function extractMessage(payload: unknown, status: number): string {
	if (typeof payload === "string") return payload;

	if (typeof payload === "object" && payload !== null) {
		const message = (payload as { message?: unknown }).message;
		if (typeof message === "string") return message;
		// Nest's built-in pipes hand back an array of strings.
		if (Array.isArray(message) && typeof message[0] === "string") {
			return message[0];
		}
	}

	// Never surface an internal failure's details to the caller.
	return status >= HttpStatus.INTERNAL_SERVER_ERROR
		? "Internal server error"
		: "Request failed";
}

function extractFieldErrors(
	payload: unknown,
): Record<string, string[]> | undefined {
	if (typeof payload !== "object" || payload === null) return undefined;

	const errors = (payload as { errors?: unknown }).errors;
	if (typeof errors !== "object" || errors === null) return undefined;

	const result: Record<string, string[]> = {};
	for (const [field, value] of Object.entries(errors)) {
		if (Array.isArray(value)) {
			const messages = value.filter(
				(entry): entry is string => typeof entry === "string",
			);
			if (messages.length > 0) result[field] = messages;
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}
