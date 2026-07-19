export * from "./auth";

export interface ApiResponse<T> {
	data: T;
	message?: string;
	timestamp?: string;
	success?: boolean;
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
	name: string;
}
