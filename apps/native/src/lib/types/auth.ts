export type UserRole = "superadmin" | "volunteer" | "organisation";

export interface User {
	id: string;
	email: string;
	name?: string;
	role: UserRole;
	createdAt: string;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface AuthResponse {
	user: User;
	accessToken: string;
	refreshToken: string;
}

export interface LoginResponse extends AuthResponse {}

export interface SignUpResponse extends AuthResponse {}
