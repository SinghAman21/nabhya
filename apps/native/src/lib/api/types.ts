export interface User {
	id: string;
	email: string;
	name?: string;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken?: string;
}

export interface ApiResponse<T> {
	data: T;
	message?: string;
}

export interface ApiError {
	message: string;
	code?: string;
	status: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface SignUpInput {
	email: string;
	password: string;
	name?: string;
}

export interface LoginResponse {
	user: User;
	tokens: AuthTokens;
}
