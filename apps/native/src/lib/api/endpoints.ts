const API_PREFIX = "/api";

export const AUTH = {
	LOGIN: `${API_PREFIX}/auth/login`,
	REGISTER: `${API_PREFIX}/auth/register`,
	LOGOUT: `${API_PREFIX}/auth/logout`,
	REFRESH: `${API_PREFIX}/auth/refresh`,
	PROFILE: `${API_PREFIX}/auth/profile`,
} as const;

export const USERS = {
	PROFILE: `${API_PREFIX}/users/profile`,
	UPDATE: `${API_PREFIX}/users/profile`,
} as const;

export const ONBOARDING = {
	COMPLETE: `${API_PREFIX}/onboarding/complete`,
	STATUS: `${API_PREFIX}/onboarding/status`,
} as const;
