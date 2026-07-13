export type UserRole = "superadmin" | "volunteer" | "organisation";

export interface JwtPayload {
	sub: string; // user ID
	email: string;
	role: UserRole;
	iat: number; // issued at
	exp: number; // expiration
	type: "access" | "refresh";
}

export interface User {
	id: string;
	email: string;
	name: string | null;
	role: UserRole;
	createdAt: Date;
	updatedAt: Date;
}

export interface AuthResponse {
	user: User;
	accessToken: string;
	refreshToken: string;
}
