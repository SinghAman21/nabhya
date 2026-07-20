import { SetMetadata } from "@nestjs/common";

export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";

/**
 * Mark a route as reachable without a token, but still resolve the user when a
 * valid one is supplied.
 *
 * Used by the public feed: anonymous visitors get the listing, while a signed-in
 * volunteer additionally sees their own application state. An invalid or expired
 * token is treated as anonymous rather than rejected.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
