/**
 * Screen options every navigator in the app shares.
 *
 * A module constant rather than an object literal at each call site: React
 * Navigation identity-compares `screenOptions`, so `{{ headerShown: false }}`
 * written inline is a new value on every render of the layout. The navigator
 * re-renders, the layout re-renders, and the cycle surfaces as "Maximum update
 * depth exceeded" reported against whichever navigator is nearest — which is
 * rarely the one that caused it.
 *
 * Screens draw their own headers with `ScreenHeader`, so no navigator here wants
 * the native one.
 */
export const HEADERLESS = { headerShown: false } as const;
