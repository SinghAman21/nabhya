import {
	apiEnvelopeSchema,
	type Paginated,
	paginatedSchema,
	type ResponseContract,
	ResponseContractError,
} from "@nabhya/shared";
import apiClient from "./client";

/**
 * A payload's runtime contract, from `@nabhya/shared` `responses.ts`. Not
 * the precise schema type: callers keep their richer client-side `T`, and the
 * schema checks the fields that must be there.
 */
type Contract = ResponseContract;

/**
 * Checks a response against its contract.
 *
 * **In development a mismatch throws**, so drift is a red screen the day it
 * happens rather than an `undefined` three screens later. **In production it
 * is reported and the data passed through**: the schemas are loose on
 * purpose, so what fails is a genuinely missing field - and the screen that
 * reads it is better placed to degrade than a blanket error is to replace it.
 */
function check(url: string, schema: Contract, value: unknown) {
	const result = schema.safeParse(value);
	if (result.success) return;
	const error = new ResponseContractError(url, result.error.issues);
	if (__DEV__) throw error;
	console.warn(error.message);
}

/**
 * The server wraps every success response in `{ success, data, timestamp }`.
 * These helpers check and unwrap that envelope so callers deal in domain
 * types only.
 */
async function unwrap<T>(
	url: string,
	promise: Promise<{ data: unknown }>,
	schema?: Contract,
): Promise<T> {
	const response = await promise;
	check(url, apiEnvelopeSchema, response.data);
	const data = (response.data as { data: T }).data;
	if (schema) check(url, schema, data);
	return data;
}

const pageContract = paginatedSchema();

export const http = {
	get<T>(url: string, params?: Record<string, unknown>, schema?: Contract) {
		return unwrap<T>(
			url,
			apiClient.get(url, { params: clean(params) }),
			schema,
		);
	},
	post<T>(url: string, body?: unknown, schema?: Contract) {
		return unwrap<T>(url, apiClient.post(url, body), schema);
	},
	patch<T>(url: string, body?: unknown, schema?: Contract) {
		return unwrap<T>(url, apiClient.patch(url, body), schema);
	},
	delete<T>(url: string) {
		return unwrap<T>(url, apiClient.delete(url));
	},
	/** Every page is held to `{ items, meta }`; `schema` refines the rows. */
	getPage<T>(url: string, params?: Record<string, unknown>, schema?: Contract) {
		return unwrap<Paginated<T>>(
			url,
			apiClient.get(url, { params: clean(params) }),
			schema ?? pageContract,
		);
	},
};

/**
 * Axios serialises `undefined` away but keeps empty strings, which the Zod
 * query schemas then reject. Dropping blanks here keeps filter UIs simple -
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

/**
 * The HTTP status of a failed request, or null when there was no response at
 * all (offline, timed out, DNS) - the case a screen must not mistake for
 * "signed out".
 */
export function apiErrorStatus(error: unknown): number | null {
	if (typeof error === "object" && error !== null && "response" in error) {
		const status = (error as { response?: { status?: unknown } }).response
			?.status;
		if (typeof status === "number") return status;
	}
	return null;
}

/** Pulls a readable message out of an axios error for toast/alert display. */
export function apiErrorMessage(
	error: unknown,
	fallback = "Something went wrong",
): string {
	let status: number | undefined;
	if (typeof error === "object" && error !== null && "response" in error) {
		const response = (
			error as {
				response?: { status?: number; data?: { message?: unknown } };
			}
		).response;
		status = response?.status;
		const message = response?.data?.message;
		if (typeof message === "string") {
			return humanise(friendlyTeamMessage(message), status, fallback);
		}
		if (Array.isArray(message) && typeof message[0] === "string") {
			return humanise(friendlyTeamMessage(message[0]), status, fallback);
		}
	}
	if (error instanceof Error) {
		return humanise(friendlyTeamMessage(error.message), status, fallback);
	}
	return fallback;
}

/**
 * Plumbing never reaches the person. A phone build pointed at an API that did
 * not have a route yet toasted "Cannot POST /api/org/donations/export" - the
 * framework's own 404 text, method and path included. Messages the server
 * *writes for people* pass through; the transport's and the framework's are
 * replaced with what happened in their terms, or the caller's fallback.
 */
function humanise(
	message: string,
	status: number | undefined,
	fallback: string,
): string {
	if (/^Cannot (GET|POST|PUT|PATCH|DELETE) \//.test(message)) {
		return "This isn't available yet. Try again after the next update.";
	}
	if (status === 429 || /ThrottlerException|Too Many Requests/i.test(message)) {
		return "Too many requests in a short time. Wait a moment and try again.";
	}
	if (message === "Network Error" || /^timeout of \d+ms/.test(message)) {
		return "Couldn't reach Nabhya. Check your connection and try again.";
	}
	if (
		/^Request failed with status code \d+$/.test(message) ||
		message === "Internal server error" ||
		(status !== undefined && status >= 500)
	) {
		return fallback === "Something went wrong"
			? "Something went wrong on our side. Try again in a moment."
			: fallback;
	}
	return message;
}

/**
 * The server's team-permission 403 names the mechanism, not the fix.
 * A viewer or member hitting it needs the next step, not the rulebook.
 */
const TEAM_PERMISSION_MESSAGE =
	"You do not have permission to perform this team action.";

function friendlyTeamMessage(message: string): string {
	if (message === TEAM_PERMISSION_MESSAGE) {
		return "Your role doesn't allow this. Ask an owner or admin.";
	}
	return message;
}
