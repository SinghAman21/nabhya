import type { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * Request limits.
 *
 * Two buckets rather than one: a browsing volunteer legitimately makes many
 * cheap reads, while the expensive or abusable routes (issuing upload tickets,
 * starting a payment, writing a review) need a much tighter cap. Routes opt
 * into the strict bucket with @Throttle({ strict: { ... } }).
 *
 * Keyed by IP by default. Behind a proxy the app must trust the forwarded
 * header or every request appears to come from one address - see main bootstrap.
 */
export const throttlerConfig: ThrottlerModuleOptions = {
	throttlers: [
		{
			name: "default",
			ttl: 60_000,
			limit: 120,
		},
		// @nestjs/throttler v6 applies EVERY named throttler to EVERY route, so
		// this default is what an un-annotated route gets: it must not bind
		// tighter than "default". It was 10, which capped every read (users/me,
		// the unread count) at 10/min and 429'd an ordinary page-to-page walk.
		// Opted-in routes set their own tight limit with @Throttle.
		{
			name: "strict",
			ttl: 60_000,
			limit: 120,
		},
	],
};
