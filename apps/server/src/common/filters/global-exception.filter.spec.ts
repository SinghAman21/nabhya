import type { ArgumentsHost } from "@nestjs/common";
import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { GlobalExceptionFilter } from "./global-exception.filter";

function hostFor(): {
	host: ArgumentsHost;
	json: ReturnType<typeof vi.fn>;
	status: ReturnType<typeof vi.fn>;
} {
	const json = vi.fn();
	const status = vi.fn(() => ({ json }));
	const host = {
		switchToHttp: () => ({
			getResponse: () => ({ status }),
			getRequest: () => ({ method: "POST", url: "/api/test" }),
		}),
	} as unknown as ArgumentsHost;
	return { host, json, status };
}

describe("GlobalExceptionFilter", () => {
	const filter = new GlobalExceptionFilter();

	it("forwards per-field validation errors to the client", () => {
		// Without this the client receives only "Validation failed" and cannot
		// mark which input was wrong - every form silently loses its error state.
		const { host, json } = hostFor();

		filter.catch(
			new BadRequestException({
				message: "Validation failed",
				errors: { email: ["Enter a valid email"], phone: ["Too short"] },
			}),
			host,
		);

		expect(json).toHaveBeenCalledWith(
			expect.objectContaining({
				statusCode: 400,
				message: "Validation failed",
				errors: { email: ["Enter a valid email"], phone: ["Too short"] },
			}),
		);
	});

	it("keeps a plain message when there are no field errors", () => {
		const { host, json } = hostFor();
		filter.catch(new NotFoundException("Event not found"), host);

		const body = json.mock.calls[0]?.[0];
		expect(body.message).toBe("Event not found");
		expect(body.errors).toBeUndefined();
	});

	it("preserves the status code", () => {
		const { host, status } = hostFor();
		filter.catch(new ForbiddenException("Nope"), host);
		expect(status).toHaveBeenCalledWith(403);
	});

	it("never leaks internal failure details", () => {
		const { host, json } = hostFor();
		filter.catch(
			new Error("connection string is postgres://user:hunter2@..."),
			host,
		);

		const body = json.mock.calls[0]?.[0];
		expect(body.statusCode).toBe(500);
		expect(body.message).toBe("Internal server error");
		expect(JSON.stringify(body)).not.toContain("hunter2");
	});
});
