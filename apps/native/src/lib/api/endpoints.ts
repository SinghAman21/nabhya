const API_PREFIX = "/api";

export const USERS = {
	ME: `${API_PREFIX}/users/me`,
	PROFILE: `${API_PREFIX}/users/profile`,
	UPDATE: `${API_PREFIX}/users/profile`,
} as const;

export const ONBOARDING = {
	COMPLETE: `${API_PREFIX}/onboarding/complete`,
	STATUS: `${API_PREFIX}/onboarding/status`,
} as const;
