import type { Paginated } from "@nabhya/shared";
import apiClient from "./client";

/**
 * The server wraps every success response in `{ success, data, timestamp }`.
 * These helpers unwrap that envelope so callers deal in domain types only.
 */
async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
	const response = await promise;
	return response.data.data;
}

export const http = {
	get<T>(url: string, params?: Record<string, unknown>) {
		return unwrap<T>(apiClient.get(url, { params: clean(params) }));
	},
	post<T>(url: string, body?: unknown) {
		return unwrap<T>(apiClient.post(url, body));
	},
	patch<T>(url: string, body?: unknown) {
		return unwrap<T>(apiClient.patch(url, body));
	},
	delete<T>(url: string) {
		return unwrap<T>(apiClient.delete(url));
	},
	getPage<T>(url: string, params?: Record<string, unknown>) {
		return unwrap<Paginated<T>>(apiClient.get(url, { params: clean(params) }));
	},
};

/**
 * Axios serialises `undefined` away but keeps empty strings, which the Zod
 * query schemas then reject. Dropping blanks here keeps filter UIs simple —
 * they can bind straight to state without clearing keys themselves.
 */
function clean(params?: Record<string, unknown>) {
	if (!params) return undefined;
	return Object.fromEntries(
		Object.entries(params).filter(
			([, value]) => value !== undefined && value !== null && value !== "",
		),
	);
}

/** Pulls a readable message out of an axios error for toast/alert display. */
export function apiErrorMessage(
	error: unknown,
	fallback = "Something went wrong",
): string {
	if (typeof error === "object" && error !== null && "response" in error) {
		const response = (error as { response?: { data?: { message?: unknown } } })
			.response;
		const message = response?.data?.message;
		if (typeof message === "string") return message;
		if (Array.isArray(message) && typeof message[0] === "string") {
			return message[0];
		}
	}
	if (error instanceof Error) return error.message;
	return fallback;
}
