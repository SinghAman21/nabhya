export type UserRole = "superadmin" | "volunteer" | "organisation";

export interface User {
	id: string;
	email: string;
	name: string | null;
	role: UserRole;
	createdAt: string;
	updatedAt: string;
}

export interface AuthTokens {
	accessToken: string;
}

export interface AuthResponse {
	user: User;
	accessToken: string;
}

export interface LoginResponse extends AuthResponse {}

export interface SignUpResponse extends AuthResponse {}
