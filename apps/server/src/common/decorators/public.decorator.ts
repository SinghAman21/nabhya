import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Mark a route as public — bypasses the global AuthGuard.
 * Usage: @Public() above a controller or handler.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
